'use strict'

jest.mock('fs', () => ({writeFileSync: jest.fn()}))
jest.mock('../../config/constants.js', () => ({TTS_FILE_RECV_PATH: 'mock-caption.txt'}))
jest.mock('bilibili-live-ws', () => {
  const {EventEmitter} = require('events')
  return {KeepLiveTCP: jest.fn(() => {
    const live = new EventEmitter()
    const connection = () => {
      const current = new EventEmitter()
      current.socket = {destroy: jest.fn()}
      current.close = jest.fn(() => current.emit('close'))
      return current
    }
    live.closed = false
    live.connection = connection()
    live.connect = jest.fn(function (reconnect = true) {
      if (reconnect) { this.connection.close(); this.connection = connection() }
      this.connection.on('close', () => {
        if (!this.closed) setTimeout(() => this.connect(), 100)
      })
    })
    live.close = jest.fn(() => { live.closed = true; live.connection.close() })
    live.connect(false)
    return live
  })}
})

const {KeepLiveTCP} = require('bilibili-live-ws')
const fs = require('fs')
const {StartLive} = require('./bilibili')
const event = {info: [null, 'mock message', [123, 'mock user']]}
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return {promise, resolve, reject}
}

describe('Bilibili validates room ID before SDK allocation', () => {
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks() })
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers() })

  test.each([undefined, null, '', '   ', 'private-invalid-room', '42.5', 0, -1, 1.5,
    NaN, Infinity, true, false, {}, [], Symbol('private'), Number.MAX_SAFE_INTEGER + 1])
  ('invalid configuration rejects without constructing any SDK connection %#', async (roomId) => {
    const error = await StartLive({config: {BILIBILI_LIVE_ROOM_ID: roomId}}).catch((value) => value)
    expect(error).toMatchObject({message: 'BILIBILI_CONFIG_INVALID', code: 'BILIBILI_CONFIG_INVALID'})
    expect(Object.keys(error)).toEqual(['code'])
    expect(KeepLiveTCP).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })

  test('missing configuration also fails before SDK allocation', async () => {
    await expect(StartLive({})).rejects.toMatchObject({code: 'BILIBILI_CONFIG_INVALID'})
    expect(KeepLiveTCP).not.toHaveBeenCalled()
  })

  test.each([42, '42', ' 42 ', '0042'])('valid room ID is converted to a number %#', async (roomId) => {
    const runtime = await StartLive({config: {BILIBILI_LIVE_ROOM_ID: roomId}, logger: {error: jest.fn()}})
    expect(KeepLiveTCP).toHaveBeenCalledTimes(1)
    expect(KeepLiveTCP).toHaveBeenCalledWith(42)
    await runtime.stop()
  })
})

describe('Bilibili owned lifecycle', () => {
  let deps
  let runtime
  let live
  let logSpy
  beforeEach(async () => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    deps = {config: {BILIBILI_LIVE_ROOM_ID: 42}, logger: {info: jest.fn(), error: jest.fn()},
      processExecute: jest.fn().mockResolvedValue('plugin reply'), chatProcess: jest.fn().mockResolvedValue('chat reply'),
      plugins: {tts: {execute: jest.fn().mockResolvedValue({content: {file: '/mock.mp3'}})}},
      voicePlayer: {play: jest.fn((_file, callback) => callback(null))}}
    runtime = await StartLive(deps)
    live = KeepLiveTCP.mock.results.at(-1).value
  })
  afterEach(async () => {
    await runtime.stop()
    jest.clearAllTimers()
    jest.useRealTimers()
    logSpy.mockRestore()
  })

  test('repeated live events do not duplicate handlers or replies', async () => {
    live.emit('DANMU_MSG', event)
    expect(deps.processExecute).not.toHaveBeenCalled()
    live.emit('live'); live.emit('live'); live.emit('live')
    expect(live.listenerCount('DANMU_MSG')).toBe(1)
    live.emit('DANMU_MSG', event)
    await jest.advanceTimersByTimeAsync(0)
    expect(deps.processExecute).toHaveBeenCalledTimes(1)
    expect(deps.processExecute).toHaveBeenCalledWith('mock message', 123, 'mock user', '', '', {type: 'bilibili'})
    expect(fs.writeFileSync).toHaveBeenCalledWith('mock-caption.txt', '@mock user plugin reply')
    expect(deps.plugins.tts.execute).toHaveBeenCalledWith('吠 plugin reply')
    expect(deps.voicePlayer.play).toHaveBeenCalledWith(`${process.cwd()}/static/mock.mp3`, expect.any(Function))
  })

  test('chat fallback remains available while running', async () => {
    deps.processExecute.mockResolvedValue(null)
    live.emit('live'); live.emit('DANMU_MSG', event)
    await jest.advanceTimersByTimeAsync(0)
    expect(deps.chatProcess).toHaveBeenCalledWith('mock message')
    expect(deps.plugins.tts.execute).toHaveBeenCalledWith('吠 chat reply')
  })

  test('structured text plugin reply sends Pong to captions and TTS without object coercion', async () => {
    deps.processExecute.mockResolvedValue({type: 'text', content: 'Pong'})
    live.emit('live')
    await live.listeners('DANMU_MSG')[0](event)
    expect(fs.writeFileSync).toHaveBeenCalledWith('mock-caption.txt', '@mock user Pong')
    expect(deps.plugins.tts.execute).toHaveBeenCalledWith('吠 Pong')
    expect(deps.chatProcess).not.toHaveBeenCalled()
  })

  test.each([
    {type: 'picture', content: {file: '/image.jpg'}}, {type: 'audio', content: {file: '/audio.mp3'}},
    {type: 'text'}, {type: 'text', content: undefined}, {type: 'text', content: {text: 'not a string'}},
    {type: 'unknown', content: 'do not speak'}, {}, ['not text'], 42, {type: 'text', content: '   '},
  ])('unknown or media plugin reply never writes undefined/objects or synthesizes speech %#', async (reply) => {
    deps.processExecute.mockResolvedValue(reply)
    live.emit('live')
    await live.listeners('DANMU_MSG')[0](event)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
    expect(deps.plugins.tts.execute).not.toHaveBeenCalled()
    expect(deps.voicePlayer.play).not.toHaveBeenCalled()
    expect(deps.chatProcess).not.toHaveBeenCalled()
    expect(deps.logger.error).not.toHaveBeenCalled()
  })

  test.each([undefined, null, {}, {type: 'text'}, {type: 'picture', content: {file: '/mock.jpg'}}])
  ('missing or unsupported chat reply is not coerced to speech %#', async (reply) => {
    deps.processExecute.mockResolvedValue(null)
    deps.chatProcess.mockResolvedValue(reply)
    live.emit('live')
    await live.listeners('DANMU_MSG')[0](event)
    expect(fs.writeFileSync).not.toHaveBeenCalled()
    expect(deps.plugins.tts.execute).not.toHaveBeenCalled()
    expect(deps.voicePlayer.play).not.toHaveBeenCalled()
  })

  test('stop is idempotent, closes current socket and blocks an already queued reconnect', async () => {
    const ownedConnect = live.connect
    const connection = live.connection
    connection.close()
    expect(jest.getTimerCount()).toBe(1)
    const external = jest.fn()
    live.on('heartbeat', external)
    const pending = runtime.stop()
    expect(runtime.stop()).toBe(pending)
    await pending
    await jest.advanceTimersByTimeAsync(100)
    expect(live.connection).toBe(connection)
    expect(live.close).toHaveBeenCalledTimes(1)
    expect(connection.socket.destroy).toHaveBeenCalledTimes(1)
    expect(live.listenerCount('DANMU_MSG')).toBe(0)
    live.emit('heartbeat', 10)
    expect(external).toHaveBeenCalledTimes(1)
    expect(live.connect).toBe(ownedConnect)
    expect(ownedConnect()).toBeUndefined()
    expect(jest.getTimerCount()).toBe(0)
  })

  test('running reconnect still works and does not alter another owned instance', async () => {
    const original = live.connection
    live.connection.close()
    await jest.advanceTimersByTimeAsync(100)
    expect(live.connection).not.toBe(original)
    const second = await StartLive(deps)
    const secondLive = KeepLiveTCP.mock.results.at(-1).value
    await runtime.stop()
    const secondConnection = secondLive.connection
    secondLive.connection.close()
    await jest.advanceTimersByTimeAsync(100)
    expect(secondLive.connection).not.toBe(secondConnection)
    await second.stop()
  })

  test.each(['plugin', 'chat', 'tts'])('stop gates late %s completion before subsequent side effects', async (stage) => {
    const wait = deferred()
    if (stage === 'plugin') deps.processExecute.mockReturnValue(wait.promise)
    if (stage === 'chat') { deps.processExecute.mockResolvedValue(null); deps.chatProcess.mockReturnValue(wait.promise) }
    if (stage === 'tts') deps.plugins.tts.execute.mockReturnValue(wait.promise)
    live.emit('live')
    const handler = live.listeners('DANMU_MSG')[0]
    const processing = handler(event)
    await jest.advanceTimersByTimeAsync(0)
    await runtime.stop()
    const writes = fs.writeFileSync.mock.calls.length
    const ttsCalls = deps.plugins.tts.execute.mock.calls.length
    wait.resolve(stage === 'tts' ? {content: {file: '/late.mp3'}} : 'late reply')
    await processing
    expect(fs.writeFileSync).toHaveBeenCalledTimes(writes)
    expect(deps.plugins.tts.execute).toHaveBeenCalledTimes(ttsCalls)
    expect(deps.voicePlayer.play).not.toHaveBeenCalled()
    expect(handler(event)).toBeUndefined()
  })

  test('late rejected work is consumed without logging its private payload', async () => {
    const wait = deferred()
    deps.processExecute.mockReturnValue(wait.promise)
    live.emit('live')
    const processing = live.listeners('DANMU_MSG')[0](event)
    await runtime.stop()
    wait.reject(new Error('private payload and token'))
    await processing
    expect(deps.logger.error).not.toHaveBeenCalled()
  })

  test('event and playback errors use only fixed codes', async () => {
    live.emit('live')
    deps.processExecute.mockRejectedValueOnce(new Error('private body'))
    await live.listeners('DANMU_MSG')[0](event)
    expect(deps.logger.error.mock.calls).toEqual([['BILIBILI_EVENT_FAILED']])
    deps.voicePlayer.play.mockImplementation((_file, callback) => callback(new Error('private playback error')))
    await live.listeners('DANMU_MSG')[0](event)
    expect(deps.logger.error).toHaveBeenLastCalledWith('BILIBILI_PLAY_FAILED')
    live.emit('e', new Error('private connection'))
    expect(deps.logger.error).toHaveBeenLastCalledWith('BILIBILI_CONNECTION_FAILED')
  })

  test('close failure is sanitized and still destroys the socket', async () => {
    live.close.mockImplementation(() => { throw new Error('private socket URL') })
    await expect(runtime.stop()).rejects.toMatchObject({code: 'BILIBILI_STOP_FAILED', message: 'BILIBILI_STOP_FAILED'})
    expect(live.connection.socket.destroy).toHaveBeenCalledTimes(1)
    expect(deps.logger.error.mock.calls).toEqual([['BILIBILI_STOP_FAILED']])
    // Keep teardown from reporting the same intentionally failed cached stop again.
    runtime = {stop: async () => {}}
  })
})
