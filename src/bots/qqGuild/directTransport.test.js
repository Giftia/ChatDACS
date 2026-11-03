'use strict'

const resty = require('resty-client')
const {createOpenAPI, createWebsocket} = require('qq-guild-bot')
const {createGuildDirectTransport} = require('./directTransport')
const {createGuildDirectMessageHandler} = require('./directMessage')
const {StartQQGuild} = require('../qqGuild')

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

test('real SDK DM request is aborted on deadline and queued messages recover without replay', async () => {
  jest.useFakeTimers()
  const signals = []
  const request = jest.fn((url, options) => {
    signals.push(options.signal)
    expect(options.timeout).toBe(10000)
    expect(url).toContain('/dms/:guildID/messages')
    expect(options.rest).toEqual({guildID: 'session'})
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('cancelled')), {once: true})
      if (signals.length > 1) resolve({})
    })
  })
  jest.spyOn(resty, 'create').mockReturnValue({request})
  const transport = createGuildDirectTransport(createOpenAPI({appID: 'app', token: 'fake', sandbox: true}).directMessageApi)
  const handler = createGuildDirectMessageHandler({appId: 'app', client: {directMessageApi: transport},
    processExecute: async () => ({type: 'text', content: 'Pong!'}), chatProcess: jest.fn(),
    logger: {info() {}, error() {}, warn() {}}})
  const event = (id) => ({msg: {id, guild_id: 'session', author: {id: 'user'}, content: '/ping'}})
  const first = handler(event('1'))
  const second = handler(event('2'))
  await jest.advanceTimersByTimeAsync(10000)
  await Promise.all([first, second])
  expect(signals[0].aborted).toBe(true)
  expect(request).toHaveBeenCalledTimes(2)
  await handler(event('1'))
  expect(request).toHaveBeenCalledTimes(2)
  transport.stop()
})

test('transport stop cancels in-flight sends and rejects subsequent sends', async () => {
  let signal
  const api = {postDirectMessage() { return this.request({}) }, request: jest.fn((options) => {
    signal = options.signal
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled'))))
  })}
  const transport = createGuildDirectTransport(api)
  const result = transport.postDirectMessage().catch((error) => error.message)
  transport.stop()
  expect(await result).toBe('cancelled')
  expect(signal.aborted).toBe(true)
  await expect(transport.postDirectMessage()).rejects.toThrow('stopped')
  expect(api.request).toHaveBeenCalledTimes(1)
})

test('stopping the real SDK connection removes its reconnect listener before disconnect', async () => {
  const create = jest.spyOn(resty, 'create').mockReturnValue({get: () => new Promise(() => {})})
  let socket
  const processExecute = jest.fn()
  const running = await StartQQGuild({config: {QQ_GUILD_APP_ID: 'app', QQ_GUILD_TOKEN: 'fake'},
    processExecute, chatProcess: jest.fn(), logger: {}, utils: {}, createWebsocket(config) {
      socket = createWebsocket(config)
      socket.session.ws.ws = {close: () => socket.emit('EVENT_WS', {eventType: 'DISCONNECT'})}
      return socket
    }})
  expect(socket.listenerCount('EVENT_WS')).toBe(1)
  running.stop()
  running.stop()
  socket.emit('GUILD_MESSAGES', {})
  expect(create).toHaveBeenCalledTimes(1)
  expect(processExecute).not.toHaveBeenCalled()
  expect(socket.eventNames()).toEqual([])
})

test('stop during gateway lookup neither throws nor opens a late socket', async () => {
  let finish
  jest.spyOn(resty, 'create').mockReturnValue({get: () => new Promise((resolve) => { finish = resolve })})
  let socket
  const running = await StartQQGuild({config: {QQ_GUILD_APP_ID: 'app', QQ_GUILD_TOKEN: 'fake'},
    processExecute: jest.fn(), chatProcess: jest.fn(), logger: {}, utils: {}, createWebsocket(config) {
      socket = createWebsocket(config)
      return socket
    }})
  const connect = jest.spyOn(socket.session.ws, 'connectWs').mockImplementation(() => {})
  expect(() => running.stop()).not.toThrow()
  finish({data: {url: 'wss://unused.invalid'}})
  await Promise.resolve()
  await Promise.resolve()
  expect(connect).not.toHaveBeenCalled()
  expect(socket.session.ws.ws).toBeUndefined()
})
