'use strict'

jest.mock('../../plugins/system/utils.js', () => ({
  FullContentSearchAnswer: jest.fn(), FuzzyContentSearchAnswer: jest.fn(),
  ChatJiebaFuzzy: jest.fn(), PerfunctoryAnswer: jest.fn(),
}))
jest.mock('nodejs-jieba', () => ({extract: jest.fn()}))
jest.mock('axios', () => ({default: {
  get: jest.fn(() => {throw new Error('UNEXPECTED_NETWORK')}),
  post: jest.fn(() => {throw new Error('UNEXPECTED_NETWORK')}),
}}))

const fs = require('fs')
const os = require('os')
const path = require('path')
const utils = require('../../plugins/system/utils')
const {matchChat} = require('../core/chat')
const {createConversationRuntime} = require('./conversationRuntime')
const {createPluginRuntime} = require('./runtime')
const {createChatContext} = require('./chatContext')
const {createLlmClient} = require('./llmClient')

const fixtures = []
const message = (text, overrides = {}) => ({
  text, userId: 'user-a', userName: 'Alice', groupId: 'room-a', selfId: 'bot-a',
  platform: 'napcat', raw: {scope: 'group'}, ...overrides,
})
const prompt = (context) => `${context.userName} (${context.userId})说：${context.text}`
const user = (context) => ({role: 'user', content: prompt(context)})
const assistant = (content) => ({role: 'assistant', content})

beforeEach(() => {
  jest.clearAllMocks()
  utils.FullContentSearchAnswer.mockReset().mockResolvedValue(null)
  utils.FuzzyContentSearchAnswer.mockReset().mockResolvedValue(null)
  utils.ChatJiebaFuzzy.mockReset().mockResolvedValue([])
  utils.PerfunctoryAnswer.mockReset().mockImplementation(() => {throw new Error('UNEXPECTED_PERFUNCTORY_FALLBACK')})
})

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await fixture.router?.stop()
    expect(path.dirname(fixture.directory)).toBe(path.resolve(os.tmpdir()))
    expect(path.basename(fixture.directory)).toMatch(/^chatdacs-conversation-integration-/)
    fs.rmSync(fixture.directory, {recursive: true, force: true})
  }
  jest.restoreAllMocks()
})

function createFixture({provider = 'ollama'} = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-conversation-integration-'))
  const fixture = {directory}
  fixtures.push(fixture)
  const pluginDir = path.join(directory, 'plugins')
  const personaDir = path.join(directory, 'personas')
  fs.mkdirSync(pluginDir)
  fs.mkdirSync(personaDir)
  fs.writeFileSync(path.join(pluginDir, 'ping.js'), `module.exports = {
    插件名: 'IntegrationPing', 指令: '^/ping$', init({ping}) {this.ping = ping},
    execute() {this.ping(); return {type: 'text', content: 'Pong!'}}
  }`, 'utf8')
  fs.writeFileSync(path.join(pluginDir, 'ollama.js'),
    `module.exports = {...require(${JSON.stringify(require.resolve('../../plugins/ollama'))})}`, 'utf8')
  let generated = 0
  const axios = {post: jest.fn(async () => {
    const content = `<think>not delivered</think>answer-${++generated}`
    return provider === 'openai' ? {status: 200, data: {choices: [{message: {content}}]}}
      : {status: 200, data: {message: {content}}}
  }), get: jest.fn(() => {throw new Error('UNEXPECTED_MODEL_LIST')})}
  const config = {llm: {provider, baseUrl: 'https://llm.invalid/v1', model: 'integration-model', timeoutMs: 1000,
    personaDir, personaStateFile: path.join(directory, 'persona-state.json'),
    modelStateFile: path.join(directory, 'model-state.json')}}
  const logger = {info: jest.fn(), warn: jest.fn(), error: jest.fn()}
  const ping = jest.fn()
  const contexts = createChatContext()
  const plugins = createPluginRuntime({pluginDir, logger, dependencies: {axios, config, logger, ping, chatContext: contexts},
    getPluginStatus: jest.fn().mockResolvedValue(true)})
  plugins.load()
  expect(plugins.list().every((entry) => entry.valid && entry.initError === null)).toBe(true)
  const llm = plugins.plugins.ollama
  expect(llm.contexts).toBe(contexts)
  // Inject credentials only into the real client, never process.env or user files.
  const readFileSync = jest.fn(() => {throw new Error('UNEXPECTED_CREDENTIAL_READ')})
  llm.client = createLlmClient({config, axios, env: {CHATDACS_LLM_API_KEY: 'integration-only-key'}, readFileSync})
  const observe = jest.fn((context) => llm.observeMessage(context))
  const recordReply = jest.fn((context, text) => llm.recordReply(context, text))
  const execute = jest.fn((context) => plugins.execute(context))
  const corpus = jest.fn((text) => matchChat(text))
  const fallback = jest.fn((context) => plugins.executeFallback(context))
  const send = jest.fn(async (_context, reply) => reply.content)
  // Sidecar wiring mirrors the agreed hooks, not a real platform's inbound gate.
  const router = createConversationRuntime({execute, matchChat: corpus, fallback, observe, recordReply, send, logger})
  return Object.assign(fixture, {router, plugins, llm, contexts, axios, readFileSync, observe, recordReply,
    execute, corpus, fallback, send, ping, logger, body: (index) => axios.post.mock.calls[index][1]})
}

test.each(['ollama', 'openai'])('%s: unprefixed non-mention group text reaches LLM after real plugin and corpus misses, then carries actual first turn', async (provider) => {
  const s = createFixture({provider})
  const first = message('ordinary first message')
  const second = message('ordinary second message')
  expect(first.text).not.toMatch(/小夜|@|^[/!]/)
  expect(await s.router.handle(first)).toEqual({status: 'sent', source: 'llm'})
  expect(await s.router.handle(second)).toEqual({status: 'sent', source: 'llm'})
  expect(await s.execute.mock.results[0].value).toMatchObject({handled: false})
  expect(s.ping).not.toHaveBeenCalled()
  expect(utils.FullContentSearchAnswer).toHaveBeenCalledWith(first.text)
  expect(utils.FuzzyContentSearchAnswer).toHaveBeenCalledWith(first.text)
  expect(utils.ChatJiebaFuzzy).toHaveBeenCalledWith(first.text)
  expect(utils.PerfunctoryAnswer).not.toHaveBeenCalled()
  expect(s.body(0).messages).toEqual([expect.objectContaining({role: 'system'}), user(first)])
  expect(s.body(1).messages).toEqual([expect.objectContaining({role: 'system'}), user(first), assistant('answer-1'), user(second)])
  expect(s.body(1)).toMatchObject({model: 'integration-model', stream: false})
  expect(s.send.mock.calls[0][1].content).toBe('answer-1')
  expect(s.recordReply).toHaveBeenNthCalledWith(1, first, 'answer-1')
  expect(s.observe.mock.invocationCallOrder[0]).toBeLessThan(s.execute.mock.invocationCallOrder[0])
  expect(s.execute.mock.invocationCallOrder[0]).toBeLessThan(s.corpus.mock.invocationCallOrder[0])
  expect(s.corpus.mock.invocationCallOrder[0]).toBeLessThan(s.fallback.mock.invocationCallOrder[0])
  expect(s.axios.post).toHaveBeenCalledTimes(2)
  expect(s.readFileSync).not.toHaveBeenCalled()
})

test('different groups and private users never share history, while users in the same group do', async () => {
  const s = createFixture()
  const firsts = [message('group A first'), message('group B first', {groupId: 'room-b'}),
    message('private A first', {raw: {scope: 'private'}}),
    message('private B first', {raw: {scope: 'private'}, userId: 'user-b', userName: 'Bob'})]
  for (const first of firsts) expect(await s.router.handle(first)).toMatchObject({source: 'llm', status: 'sent'})
  for (let index = 0; index < firsts.length; index++) {
    expect(s.body(index).messages).toEqual([expect.objectContaining({role: 'system'}), user(firsts[index])])
    const next = {...firsts[index], text: `followup-${index}`,
      ...(index === 0 ? {userId: 'user-b', userName: 'Bob'} : {})}
    expect(await s.router.handle(next)).toMatchObject({status: 'sent', source: 'llm'})
    expect(s.body(index + firsts.length).messages).toEqual([expect.objectContaining({role: 'system'}),
      user(firsts[index]), assistant(`answer-${index + 1}`), user(next)])
  }
})

test.each([{selfId: 'bot-b'}, {platform: 'qq'}])('same room on another bot or platform stays isolated: %j', async (overrides) => {
  const s = createFixture()
  const first = message('original identity message')
  const other = message('other identity message', overrides)
  await s.router.handle(first)
  await s.router.handle(other)
  expect(s.body(1).messages).toEqual([expect.objectContaining({role: 'system'}), user(other)])
})

test('plugin and real corpus-match replies appear in later LLM history without invoking generation for the hits', async () => {
  const s = createFixture()
  utils.FullContentSearchAnswer.mockImplementation(async (text) => text === 'known phrase' ? 'corpus reply' : null)
  const ping = message('/ping')
  const corpus = message('known phrase')
  const followup = message('continue the conversation')
  expect(await s.router.handle(ping)).toEqual({status: 'sent', source: 'plugin'})
  expect(s.corpus).not.toHaveBeenCalled()
  expect(s.axios.post).not.toHaveBeenCalled()
  expect(await s.router.handle(corpus)).toEqual({status: 'sent', source: 'corpus'})
  expect(s.axios.post).not.toHaveBeenCalled()
  expect(await s.router.handle(followup)).toEqual({status: 'sent', source: 'llm'})
  expect(s.body(0).messages).toEqual([expect.objectContaining({role: 'system'}),
    user(ping), assistant('Pong!'), user(corpus), assistant('corpus reply'), user(followup)])
  expect(s.ping).toHaveBeenCalledTimes(1)
  expect(s.fallback).toHaveBeenCalledTimes(1)
  expect(s.recordReply).toHaveBeenNthCalledWith(1, ping, 'Pong!')
  expect(s.recordReply).toHaveBeenNthCalledWith(2, corpus, 'corpus reply')
  expect(utils.PerfunctoryAnswer).not.toHaveBeenCalled()
})

test('history stores text acknowledged by send, not the unmodified generated reply', async () => {
  const s = createFixture()
  s.send.mockResolvedValueOnce('wire-formatted actual reply')
  const first = message('first request')
  const second = message('next request')
  await s.router.handle(first)
  await s.router.handle(second)
  expect(s.body(1).messages).toEqual([expect.objectContaining({role: 'system'}), user(first),
    assistant('wire-formatted actual reply'), user(second)])
})

test('failed delivery is not remembered as an assistant reply', async () => {
  const s = createFixture()
  s.send.mockRejectedValueOnce(new Error('synthetic delivery failure'))
  const first = message('not delivered request')
  const second = message('next request')
  expect(await s.router.handle(first)).toEqual({status: 'error'})
  expect(s.recordReply).not.toHaveBeenCalled()
  expect(await s.router.handle(second)).toEqual({status: 'sent', source: 'llm'})
  expect(s.body(1).messages).toEqual([expect.objectContaining({role: 'system'}), user(first), user(second)])
  expect(s.recordReply).toHaveBeenCalledTimes(1)
})

test('same-conversation concurrent input waits for first send and record before generating the second turn', async () => {
  const s = createFixture()
  let releaseSend, startedSend
  const started = new Promise((resolve) => {startedSend = resolve})
  const held = new Promise((resolve) => {releaseSend = resolve})
  s.send.mockImplementationOnce(async (_context, reply) => {startedSend(); await held; return reply.content})
  const first = message('first concurrent message')
  const second = message('second concurrent message')
  const pendingFirst = s.router.handle(first)
  const pendingSecond = s.router.handle(second)
  try {
    await started
    expect(s.axios.post).toHaveBeenCalledTimes(1)
    expect(s.observe).toHaveBeenCalledTimes(1)
    expect(s.recordReply).not.toHaveBeenCalled()
  } finally {releaseSend()}
  expect(await pendingFirst).toMatchObject({status: 'sent'})
  expect(await pendingSecond).toMatchObject({status: 'sent'})
  expect(s.body(1).messages).toEqual([expect.objectContaining({role: 'system'}), user(first), assistant('answer-1'), user(second)])
  expect(s.router.getPending()).toBe(0)
})
