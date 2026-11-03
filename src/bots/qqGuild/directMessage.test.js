'use strict'

const {EventEmitter} = require('events')
const {createGuildDirectMessageHandler} = require('./directMessage')
const {StartQQGuild} = require('../qqGuild')

const event = (overrides = {}) => ({eventType: 'DIRECT_MESSAGE_CREATE', msg: {
  id: 'm1', guild_id: 'private-session', author: {id: 'u1', username: 'User'}, content: '/ping', ...overrides,
}})

function setup() {
  const send = jest.fn(async () => ({}))
  const processExecute = jest.fn(async () => ({type: 'text', content: 'Pong!'}))
  const chatProcess = jest.fn(async () => '小夜回复')
  const logger = {info: jest.fn(), warn: jest.fn(), error: jest.fn()}
  const handler = createGuildDirectMessageHandler({appId: 'app', client: {directMessageApi: {postDirectMessage: send}},
    processExecute, chatProcess, logger})
  return {handler, send, processExecute, chatProcess, logger}
}

test('replies to the original DM session and message with an isolated plugin context', async () => {
  const {handler, send, processExecute, chatProcess} = setup()
  await handler(event())
  expect(send).toHaveBeenCalledWith('private-session', {content: 'Pong!', msg_id: 'm1'})
  expect(processExecute).toHaveBeenCalledWith('/ping', expect.any(String), 'User',
    JSON.stringify(['qqGuildDirect', 'app', 'private-session', 'u1']), '',
    expect.objectContaining({type: 'qqGuildDirect', selfId: 'app'}))
  expect(chatProcess).not.toHaveBeenCalled()
})

test('ordinary chat falls back; handled empty plugin responses do not', async () => {
  const {handler, send, processExecute, chatProcess} = setup()
  processExecute.mockResolvedValueOnce('')
  await handler(event({content: 'hello'}))
  expect(chatProcess).toHaveBeenCalledWith('hello')
  expect(send).toHaveBeenCalledWith('private-session', {content: '小夜回复', msg_id: 'm1'})
  processExecute.mockResolvedValueOnce({type: 'text', content: ''})
  await handler(event({id: 'm2'}))
  expect(send).toHaveBeenCalledTimes(1)
  expect(chatProcess).toHaveBeenCalledTimes(1)
})

test('deduplicates in-flight events and ignores deletes, malformed and bot events', async () => {
  const {handler, send, processExecute} = setup()
  await Promise.all([handler(event()), handler(event())])
  await handler({...event(), eventType: 'DIRECT_MESSAGE_DELETE'})
  await handler(event({id: '', guild_id: ''}))
  await handler(event({id: 'bot', author: {id: 'b', bot: true}}))
  expect(processExecute).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledTimes(1)
})

test('serializes the same session while keeping separate conversations independent', async () => {
  const {handler, send, processExecute} = setup()
  let release
  processExecute.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
  const first = handler(event())
  const second = handler(event({id: 'm2'}))
  await Promise.resolve()
  await handler(event({id: 'm3', guild_id: 'other-session'}))
  expect(send).toHaveBeenCalledWith('other-session', {content: 'Pong!', msg_id: 'm3'})
  release({type: 'text', content: 'first'})
  await Promise.all([first, second])
  expect(send.mock.calls.filter(([id]) => id === 'private-session').map(([, reply]) => reply.msg_id)).toEqual(['m1', 'm2'])
})

test('send failure never replays work or falls through; logs do not expose API payloads', async () => {
  const {handler, send, processExecute, chatProcess, logger} = setup()
  send.mockRejectedValue(new Error('private-secret'))
  await handler(event())
  await handler(event())
  expect(processExecute).toHaveBeenCalledTimes(1)
  expect(send).toHaveBeenCalledTimes(1)
  expect(chatProcess).not.toHaveBeenCalled()
  expect(JSON.stringify(logger.error.mock.calls)).not.toContain('private-secret')
})

test('stop suppresses late and queued responses and prevents further plugin executions', async () => {
  const {handler, send, processExecute} = setup()
  let finish
  processExecute.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  const first = handler(event())
  const second = handler(event({id: 'm2'}))
  await Promise.resolve()
  handler.stop()
  finish({type: 'text', content: 'late'})
  await Promise.all([first, second])
  await handler(event({id: 'm3'}))
  expect(processExecute).toHaveBeenCalledTimes(1)
  expect(send).not.toHaveBeenCalled()
})

test('queue overflow does not run extra plugin work and recovers after draining', async () => {
  const {handler, send, processExecute, logger} = setup()
  let finish
  processExecute.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  const tasks = Array.from({length: 5}, (_, i) => handler(event({id: 'q' + i})))
  await Promise.resolve()
  expect(logger.warn).toHaveBeenCalledTimes(1)
  finish({type: 'text', content: 'first'})
  await Promise.all(tasks)
  expect(send).toHaveBeenCalledTimes(4)
  await handler(event({id: 'new'}))
  expect(send).toHaveBeenCalledTimes(5)
})

test('chat timeout replies once and ignores late resolution', async () => {
  jest.useFakeTimers()
  try {
    const {handler, send, processExecute, chatProcess} = setup()
    processExecute.mockResolvedValue('')
    let finish
    chatProcess.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const running = handler(event({content: 'hello'}))
    await jest.advanceTimersByTimeAsync(12000)
    await running
    expect(send).toHaveBeenCalledWith('private-session', {content: '聊天响应超时，请稍后再试', msg_id: 'm1'})
    finish('late')
    await Promise.resolve()
    expect(send).toHaveBeenCalledTimes(1)
  } finally { jest.useRealTimers() }
})

test.each([false, true])('DM subscription is explicitly opt-in (%s)', async (enabled) => {
  const ws = new EventEmitter()
  ws.disconnect = jest.fn()
  const createWebsocket = jest.fn(() => ws)
  const client = {directMessageApi: {postDirectMessage: jest.fn()}}
  const running = await StartQQGuild({config: {QQ_GUILD_APP_ID: 'app', QQ_GUILD_TOKEN: 'fake',
    QQ_GUILD_DIRECT_MESSAGE_SWITCH: enabled}, processExecute: jest.fn(), chatProcess: jest.fn(),
    logger: {info() {}, error() {}}, utils: {}, createOpenAPI: () => client, createWebsocket})
  expect(createWebsocket.mock.calls[0][0].intents).toEqual(enabled ? ['GUILD_MESSAGES', 'DIRECT_MESSAGE'] : ['GUILD_MESSAGES'])
  running.stop()
  expect(ws.disconnect).toHaveBeenCalledTimes(1)
})
