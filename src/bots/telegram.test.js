'use strict'

jest.mock('node-telegram-bot-api', () => {
  const {EventEmitter} = require('events')
  return jest.fn(() => Object.assign(new EventEmitter(), {
    _polling: {_abort: false, requests: jest.fn(),
      _polling: jest.fn(function () { this.requests(); return Promise.resolve() }), _pollingTimeout: null},
    stopPolling: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined), sendPhoto: jest.fn().mockResolvedValue(undefined),
    sendAudio: jest.fn().mockResolvedValue(undefined),
  }))
})
const TelegramBot = require('node-telegram-bot-api')
const {StartTelegram} = require('./telegram')
const event = {chat: {id: 456}, text: 'mock body', from: {id: 123, username: 'mock user'}}
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return {promise, resolve, reject}
}

describe('Telegram owned lifecycle', () => {
  let deps
  let runtime
  let client
  let logSpy
  let randomSpy
  beforeEach(async () => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0)
    deps = {config: {TELEGRAM_BOT_TOKEN: 'mock-token', QQBOT_REPLY_PROBABILITY: 50},
      processExecute: jest.fn().mockResolvedValue({type: 'text', content: 'reply'}),
      chatProcess: jest.fn().mockResolvedValue('chat reply'), logger: {info: jest.fn(), error: jest.fn()},
      utils: {PluginAnswerToTelegramStyle: jest.fn(() => ({text: 'reply', image: 'image', audio: 'audio', duration: 2}))}}
    runtime = await StartTelegram(deps)
    client = TelegramBot.mock.results.at(-1).value
  })
  afterEach(async () => {
    await runtime.stop()
    jest.clearAllTimers()
    jest.useRealTimers()
    randomSpy.mockRestore()
    logSpy.mockRestore()
  })

  test.each(['text', 'picture', 'directPicture', 'audio'])('preserves %s reply shape', async (type) => {
    deps.processExecute.mockResolvedValue({type, content: 'reply'})
    await client.listeners('message')[0](event)
    expect(TelegramBot).toHaveBeenCalledWith('mock-token', {polling: true})
    expect(deps.processExecute).toHaveBeenCalledWith('mock body', 123, 'mock user', 456, '', {type: 'telegram'})
    if (type === 'text') expect(client.sendMessage).toHaveBeenCalledWith(456, 'reply')
    if (type === 'picture' || type === 'directPicture') expect(client.sendPhoto).toHaveBeenCalledWith(456, 'image', {}, {contentType: 'image/jpeg'})
    if (type === 'audio') expect(client.sendAudio).toHaveBeenCalledWith(456, 'audio', {title: 'reply', duration: 2}, {contentType: 'audio/mpeg'})
  })

  test.each([undefined, null, {}, {chat: {id: 456}, photo: [{}]}, {...event, text: 42},
    {...event, text: null}, {...event, chat: undefined}])('ignores non-text or incomplete events safely %#', async (data) => {
    await expect(client.listeners('message')[0](data)).resolves.toBeUndefined()
    expect(deps.processExecute).not.toHaveBeenCalled()
    expect(deps.chatProcess).not.toHaveBeenCalled()
    expect(client.sendMessage).not.toHaveBeenCalled()
    expect(client.sendPhoto).not.toHaveBeenCalled()
    expect(client.sendAudio).not.toHaveBeenCalled()
    expect(deps.logger.error).not.toHaveBeenCalled()
  })

  test.each([undefined, null, {id: 123}, {id: 123, username: null}])
  ('text replies still work without sender username %#', async (from) => {
    await expect(client.listeners('message')[0]({...event, from})).resolves.toBeUndefined()
    expect(deps.processExecute).toHaveBeenCalledWith('mock body', from?.id ?? '', '', 456, '', {type: 'telegram'})
    expect(client.sendMessage).toHaveBeenCalledWith(456, 'reply')
    expect(deps.logger.error).not.toHaveBeenCalled()
  })

  test.each([[0.49, true], [0.5, false], [0.99, false]])('preserves probability boundary %s', async (random, sends) => {
    randomSpy.mockReturnValue(random)
    deps.processExecute.mockResolvedValue(null)
    await client.listeners('message')[0](event)
    expect(deps.chatProcess).toHaveBeenCalledTimes(sends ? 1 : 0)
    expect(client.sendMessage).toHaveBeenCalledTimes(sends ? 1 : 0)
    if (sends) expect(client.sendMessage).toHaveBeenCalledWith(456, 'chat reply')
  })

  test('stop cancels polling exactly once, removes only owned message handler and gates queued callbacks', async () => {
    const handler = client.listeners('message')[0]
    const external = jest.fn()
    client.on('message', external)
    setTimeout(() => handler(event), 1)
    const pending = runtime.stop()
    expect(runtime.stop()).toBe(pending)
    await pending
    expect(client.stopPolling).toHaveBeenCalledTimes(1)
    expect(client.stopPolling).toHaveBeenCalledWith({cancel: true})
    expect(client.listeners('message')).toEqual([external])
    await jest.advanceTimersByTimeAsync(1)
    client.emit('message', event)
    expect(external).toHaveBeenCalledTimes(1)
    expect(deps.processExecute).not.toHaveBeenCalled()
    expect(client.sendMessage).not.toHaveBeenCalled()
  })

  test('stop prevents queued and cancellation-finally polling from restarting the owned client', async () => {
    const polling = client._polling
    await polling._polling()
    const guard = polling._polling
    polling._pollingTimeout = setTimeout(() => polling._polling(), 10)
    setTimeout(() => polling._polling(), 20)
    client.stopPolling.mockImplementation(() => {
      setTimeout(() => {
        if (!polling._abort) polling._pollingTimeout = setTimeout(() => polling._polling(), 30)
      }, 1)
      return Promise.resolve()
    })
    await runtime.stop()
    expect(polling._abort).toBe(true)
    await jest.runAllTimersAsync()
    expect(polling._polling).toBe(guard)
    expect(polling._polling()).toBeUndefined()
    expect(polling.requests).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  test('stopping one client does not stop another instance polling', async () => {
    const second = await StartTelegram(deps)
    const other = TelegramBot.mock.results.at(-1).value
    await runtime.stop()
    await expect(other._polling._polling()).resolves.toBeUndefined()
    expect(other._polling.requests).toHaveBeenCalledTimes(1)
    expect(other._polling._abort).toBe(false)
    await second.stop()
  })

  test.each(['plugin', 'chat'])('stop gates late %s reply', async (stage) => {
    const wait = deferred()
    if (stage === 'plugin') deps.processExecute.mockReturnValue(wait.promise)
    else { deps.processExecute.mockResolvedValue(null); deps.chatProcess.mockReturnValue(wait.promise) }
    const handler = client.listeners('message')[0]
    const processing = handler(event)
    await jest.advanceTimersByTimeAsync(0)
    await runtime.stop()
    wait.resolve(stage === 'plugin' ? {type: 'text', content: 'late'} : 'late chat')
    await processing
    expect(client.sendMessage).not.toHaveBeenCalled()
    expect(client.sendPhoto).not.toHaveBeenCalled()
    expect(client.sendAudio).not.toHaveBeenCalled()
    expect(deps.utils.PluginAnswerToTelegramStyle).not.toHaveBeenCalled()
  })

  test.each(['sendMessage', 'sendPhoto', 'sendAudio'])('handles %s rejection without leaking payload', async (method) => {
    const type = {sendMessage: 'text', sendPhoto: 'picture', sendAudio: 'audio'}[method]
    deps.processExecute.mockResolvedValue({type, content: 'private body'})
    client[method].mockRejectedValue(new Error('private token and body'))
    await client.listeners('message')[0](event)
    expect(deps.logger.error.mock.calls).toEqual([['TELEGRAM_MESSAGE_FAILED']])
  })

  test('late async rejection and late polling errors remain safely consumed', async () => {
    const wait = deferred()
    deps.processExecute.mockReturnValue(wait.promise)
    const processing = client.listeners('message')[0](event)
    client.emit('polling_error', new Error('private token'))
    expect(deps.logger.error.mock.calls).toEqual([['TELEGRAM_POLLING_FAILED']])
    deps.logger.error.mockClear()
    await runtime.stop()
    wait.reject(new Error('private token'))
    await processing
    client.emit('polling_error', new Error('private token'))
    expect(deps.logger.error).not.toHaveBeenCalled()
  })

  test.each(['throw', 'reject'])('polling stop failure %s exposes only a fixed code', async (mode) => {
    const error = new Error('private token / bot URL')
    if (mode === 'throw') client.stopPolling.mockImplementation(() => { throw error })
    else client.stopPolling.mockRejectedValue(error)
    const result = await runtime.stop().catch((value) => value)
    expect(result).toMatchObject({message: 'TELEGRAM_STOP_FAILED', code: 'TELEGRAM_STOP_FAILED'})
    expect(Object.keys(result)).toEqual(['code'])
    expect(deps.logger.error.mock.calls).toEqual([['TELEGRAM_STOP_FAILED']])
    expect(client.listenerCount('message')).toBe(0)
    runtime = {stop: async () => {}}
  })
})
