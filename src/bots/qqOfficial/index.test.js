'use strict'

const {startQQOfficial} = require('./index')
const {toMessageContext} = require('./context')
const {sendResponse, textChunks} = require('./response')

function makeSdk() {
  const events = {}
  const bot = {
    use: jest.fn(), on: jest.fn((name, handler) => { events[name] = handler }),
    start: jest.fn(() => new Promise((resolve) => { bot.finish = resolve })),
    stop: jest.fn(() => bot.finish?.()), sendText: jest.fn(), sendImage: jest.fn(),
  }
  const middleware = () => jest.fn()
  const sdk = {QQBot: jest.fn(() => bot), accessPolicy: middleware, messageFilter: middleware,
    mentionGate: middleware, contentSanitizer: middleware, concurrencyGuard: middleware, rateLimiter: middleware}
  return {sdk, bot, events}
}

const message = (overrides = {}) => ({kind: 'c2c', senderId: 'openid', messageId: 'msg-1', content: '/ping', ...overrides})
const credentials = () => ({appId: 'app', appSecret: 'never-log-me'})

describe('QQ official adapter', () => {
  let resource
  afterEach(async () => { await resource?.stop(); resource = undefined })

  test('does not load SDK or credentials while disabled', async () => {
    const loadSdk = jest.fn()
    const getCredentials = jest.fn()
    resource = await startQQOfficial({config: {}, loadSdk, getCredentials})
    expect(resource.getState()).toBe('disabled')
    expect(loadSdk).not.toHaveBeenCalled()
    expect(getCredentials).not.toHaveBeenCalled()
  })

  test('missing or malformed credentials do not block application startup', async () => {
    const logger = {warn: jest.fn(), error: jest.fn()}
    resource = await startQQOfficial({config: {CONNECT_QQ_OFFICIAL_SWITCH: true}, getCredentials: () => null, logger})
    expect(resource.getState()).toBe('unbound')
    const blocked = await startQQOfficial({config: {CONNECT_QQ_OFFICIAL_SWITCH: true},
      getCredentials: () => { throw new Error('never-log-me') }, logger})
    expect(blocked.getState()).toBe('blocked')
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('never-log-me')
  })

  async function start({execute = jest.fn(async () => ({handled: true, type: 'text', content: 'pong'})), chatProcess = jest.fn()} = {}) {
    const {sdk, bot, events} = makeSdk()
    const logger = {info: jest.fn(), warn: jest.fn(), error: jest.fn()}
    resource = await startQQOfficial({config: {CONNECT_QQ_OFFICIAL_SWITCH: true}, logger, execute, chatProcess,
      getCredentials: credentials, loadSdk: async () => sdk})
    return {bot, events, logger, execute, chatProcess}
  }

  test('returns before long-running start settles; ready/disconnect/stop are observable', async () => {
    const {bot, events} = await start()
    expect(bot.start).toHaveBeenCalledTimes(1)
    expect(resource.getState()).toBe('connecting')
    events.ready()
    expect(resource.getState()).toBe('ready')
    events.disconnected({code: 4000, willReconnect: true})
    expect(resource.getState()).toBe('reconnecting')
    events.resumed()
    expect(resource.getState()).toBe('ready')
    events.disconnected({code: 4915, willReconnect: false})
    expect(resource.getState()).toBe('blocked')
  })

  test('handled plugin response never falls through and uses original reply target', async () => {
    const {events, bot, execute, chatProcess} = await start()
    await events.message({message: message()})
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({platform: 'qqOfficial'}))
    expect(chatProcess).not.toHaveBeenCalled()
    expect(bot.sendText).toHaveBeenCalledWith({scope: 'c2c', targetId: 'openid', msgId: 'msg-1'}, 'pong')
  })

  test('only unhandled results invoke Xiaoye fallback', async () => {
    const chatProcess = jest.fn(async () => 'hello')
    const {events, bot} = await start({execute: async () => ({handled: false}), chatProcess})
    await events.message({message: message({content: 'hello'})})
    expect(chatProcess).toHaveBeenCalledWith('hello')
    expect(bot.sendText).toHaveBeenCalledWith(expect.any(Object), 'hello')
  })

  test('handled empty response, send failure and stopped handlers never produce extra replies', async () => {
    const chatProcess = jest.fn()
    const {events, bot} = await start({execute: async () => ({handled: true, type: 'text', content: ''}), chatProcess})
    await events.message({message: message()})
    expect(bot.sendText).not.toHaveBeenCalled()
    expect(chatProcess).not.toHaveBeenCalled()
    await resource.stop()
    await events.message({message: message({content: 'later'})})
    expect(bot.sendText).not.toHaveBeenCalled()
  })

  test('a send error is logged once without replay or credential leakage', async () => {
    const {events, bot, logger, execute} = await start()
    bot.sendText.mockRejectedValue(new Error('never-log-me'))
    await events.message({message: message()})
    expect(execute).toHaveBeenCalledTimes(1)
    expect(bot.sendText).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('never-log-me')
  })

  test('chat timeout returns once and ignores late completion', async () => {
    jest.useFakeTimers()
    try {
      let finish
      const {events, bot} = await start({execute: async () => ({handled: false}),
        chatProcess: () => new Promise((resolve) => { finish = resolve })})
      const processing = events.message({message: message()})
      await jest.advanceTimersByTimeAsync(12000)
      await processing
      expect(bot.sendText).toHaveBeenCalledWith(expect.any(Object), '聊天响应超时，请稍后再试')
      finish('late reply')
      await Promise.resolve()
      expect(bot.sendText).toHaveBeenCalledTimes(1)
    } finally { jest.useRealTimers() }
  })
})

test('official identities isolate bots, scopes, members and conversations', () => {
  const a = toMessageContext(message(), 'bot-a')
  const b = toMessageContext(message(), 'bot-b')
  const group = toMessageContext(message({kind: 'group', groupOpenid: 'openid'}), 'bot-a')
  expect(new Set([a.groupId, b.groupId, group.groupId]).size).toBe(3)
  expect(group.userId).not.toBe(a.userId)
  expect(toMessageContext(message({kind: 'group'}), 'bot-a')).toBeNull()
  expect(toMessageContext(message({kind: 'guild'}), 'bot-a')).toBeNull()
  expect(toMessageContext(message({messageId: ''}), 'bot-a')).toBeNull()
})

test('official text output strips CQ segments, bounds replies and preserves Unicode', () => {
  expect(textChunks('a[CQ:at,qq=123]b')).toEqual(['a[此消息段暂不支持]b'])
  expect(textChunks('😀😀😀', 1, 2)).toEqual(['😀', '😀\n（内容过长，已截断）'])
  expect(textChunks('')).toEqual([])
})

test('image and unsupported formats use explicit safe output', async () => {
  const bot = {sendImage: jest.fn(), sendText: jest.fn()}
  const target = {scope: 'c2c', targetId: 'u', msgId: 'm'}
  await sendResponse({bot, target, response: {type: 'picture', content: 'https://example.com/test.png'}})
  expect(bot.sendImage).toHaveBeenCalledWith(target, {url: 'https://example.com/test.png'})
  await sendResponse({bot, target, response: {type: 'picture', content: 'file:///secret'}})
  await sendResponse({bot, target, response: {type: 'audio', content: '/local/file'}})
  expect(bot.sendText).toHaveBeenCalledTimes(2)
  expect(bot.sendImage).toHaveBeenCalledTimes(1)
  await sendResponse({bot, target, response: {type: 'text', content: undefined}})
  await sendResponse({bot, target, response: {type: 'text', content: {unexpected: true}}})
  expect(bot.sendText).toHaveBeenCalledTimes(2)
})
