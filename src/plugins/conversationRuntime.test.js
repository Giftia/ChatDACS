'use strict'

const {createConversationRuntime} = require('./conversationRuntime')
const context = {text: 'hello', userId: '1', selfId: '2', platform: 'napcat', groupId: '3', raw: {scope: 'group'}}
function setup(overrides = {}) {
  const dependencies = {execute: jest.fn(async () => ({handled: false})),
    matchChat: jest.fn(async () => ({handled: false})),
    fallback: jest.fn(async () => ({type: 'text', content: 'model'})),
    observe: jest.fn(), recordReply: jest.fn(), onMessage: jest.fn(),
    send: jest.fn(async () => {}), logger: {warn: jest.fn()}, ...overrides}
  return {runtime: createConversationRuntime(dependencies), ...dependencies}
}
test.each(['plugin', 'corpus', 'llm'])('routes through %s and records only sent reply', async source => {
  const s = setup()
  if (source === 'plugin') s.execute.mockResolvedValue({handled: true, type: 'text', content: 'plugin'})
  if (source === 'corpus') s.matchChat.mockResolvedValue({handled: true, content: 'corpus'})
  expect(await s.runtime.handle(context)).toEqual({status: 'sent', source})
  expect(s.recordReply).toHaveBeenCalledWith(context, source === 'llm' ? 'model' : source)
  if (source === 'plugin') expect(s.matchChat).not.toHaveBeenCalled()
  if (source !== 'llm') expect(s.fallback).not.toHaveBeenCalled()
})
test('failed sends are not remembered as assistant replies', async () => {
  const s = setup({send: jest.fn(async () => { throw Error('private transport') })})
  expect(await s.runtime.handle(context)).toEqual({status: 'error'})
  expect(s.recordReply).not.toHaveBeenCalled()
  expect(s.logger.warn).toHaveBeenCalledWith('CONVERSATION_PROCESS_FAILED')
})
test('corpus failure degrades to LLM instead of dropping the message', async () => {
  const s = setup({matchChat: jest.fn(async () => { throw Error('db unavailable') })})
  expect(await s.runtime.handle(context)).toEqual({status: 'sent', source: 'llm'})
  expect(s.logger.warn).toHaveBeenCalledWith('CONVERSATION_CORPUS_FAILED')
})
test('remembers the actual rendered text returned by a sender', async () => {
  const s = setup({send: jest.fn(async () => 'shortened text')})
  await s.runtime.handle(context)
  expect(s.recordReply).toHaveBeenCalledWith(context, 'shortened text')
})
test('media replies reach the sender without polluting textual context', async () => {
  const media = {handled: true, type: 'picture', content: {url: 'https://example.test/image.png'}}
  const s = setup({execute: jest.fn(async () => media)})
  expect(await s.runtime.handle(context)).toEqual({status: 'sent', source: 'plugin'})
  expect(s.send).toHaveBeenCalledWith(context, media)
  expect(s.recordReply).not.toHaveBeenCalled()
})
test('timeout notices are sent but not saved as conversation content', async () => {
  const s = setup({execute: jest.fn(async () => ({handled: true, type: 'text', content: 'timeout', timeout: true}))})
  await s.runtime.handle(context)
  expect(s.send).toHaveBeenCalled()
  expect(s.recordReply).not.toHaveBeenCalled()
})
test('serializes a conversation, observes arrivals immediately and limits its queue', async () => {
  let release
  const s = setup({execute: jest.fn(() => new Promise(resolve => { release = resolve })), maxPerConversation: 1})
  const first = s.runtime.handle(context)
  await Promise.resolve()
  expect(await s.runtime.handle(context)).toEqual({status: 'busy'})
  release({handled: true, content: 'done'})
  await first
  expect(s.runtime.getPending()).toBe(0)
})
test('stop prevents late generated output and ignores own messages', async () => {
  let release
  const s = setup({execute: jest.fn(() => new Promise(resolve => { release = resolve }))})
  expect(await s.runtime.handle({...context, userId: '2'})).toEqual({status: 'ignored'})
  const first = s.runtime.handle(context)
  await Promise.resolve()
  await Promise.resolve()
  const stopping = s.runtime.stop()
  release({handled: true, content: 'late'})
  await first
  await stopping
  expect(s.send).not.toHaveBeenCalled()
})
test('stopping during observation never starts a plugin or LLM', async () => {
  let release
  const s = setup({observe: jest.fn(() => new Promise(resolve => { release = resolve }))})
  const handling = s.runtime.handle(context)
  await Promise.resolve()
  const stopping = s.runtime.stop()
  release()
  await handling
  await stopping
  expect(s.execute).not.toHaveBeenCalled()
  expect(s.fallback).not.toHaveBeenCalled()
})
test('drain deadline bounds a dependency that never settles', async () => {
  jest.useFakeTimers()
  try {
    const s = setup({observe: jest.fn(() => new Promise(() => {})), drainTimeoutMs: 20})
    void s.runtime.handle(context)
    await Promise.resolve()
    const stopped = expect(s.runtime.stop()).rejects.toMatchObject({code: 'CONVERSATION_DRAIN_TIMEOUT'})
    await jest.advanceTimersByTimeAsync(20)
    await stopped
  } finally { jest.useRealTimers() }
})
