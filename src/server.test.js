'use strict'

const {EventEmitter} = require('events')

function setup(listenError, config = {}) {
  const app = {use: jest.fn(), get: jest.fn(), post: jest.fn()}
  const middleware = (req, res, next) => next()
  const express = Object.assign(() => app, {
    static: () => middleware, json: () => middleware, urlencoded: () => middleware,
  })
  const http = new EventEmitter()
  http.listen = jest.fn()
  if (listenError) http.listen.mockImplementationOnce(() => { throw listenError })
  http.close = jest.fn(() => http.emit('close'))
  const io = {on: jest.fn(), emit: jest.fn()}
  const logger = {info: jest.fn(), error: jest.fn()}
  jest.doMock('express', () => express)
  jest.doMock('compression', () => () => middleware)
  jest.doMock('multer', () => () => ({single: () => middleware}))
  jest.doMock('http', () => ({Server: () => http}))
  jest.doMock('socket.io', () => () => io)
  jest.doMock('lib-qqwry', () => () => ({searchIP: jest.fn()}))
  jest.doMock('../plugins/system/utils.js', () => ({}))
  jest.doMock('../config/constants.js', () => ({}))
  let server
  jest.isolateModules(() => { server = require('./server') })
  const dispose = jest.fn()
  const stop = jest.fn()
  // Mirrors index ownership without importing the real entrypoint/configuration.
  http.once('close', () => { dispose(); stop() })
  server.startServer({version: 'test', globalConfig: {WEB_PORT: 12345, ...config}, logger,
    chatProcess: jest.fn(), processExecute: jest.fn()})
  return {http, logger, dispose, stop}
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.resetModules()
})

test('legacy listen omits host while an explicit host remains loopback on retries', () => {
  expect(setup().http.listen).toHaveBeenCalledWith(12345)
  jest.resetModules()
  const {http} = setup(undefined, {WEB_HOST: '127.0.0.1'})
  expect(http.listen).toHaveBeenCalledWith(12345, '127.0.0.1')
  http.emit('error', {code: 'EADDRINUSE'})
  jest.advanceTimersByTime(10000)
  expect(http.listen.mock.calls).toEqual([[12345, '127.0.0.1'], [12345, '127.0.0.1']])
})

test('EADDRINUSE retries after 10s without emitting final close or disposing adapters', () => {
  const {http, dispose, stop} = setup()
  http.emit('error', Object.assign(new Error('PRIVATE_LISTEN_ERROR'), {code: 'EADDRINUSE'}))
  expect(http.close).not.toHaveBeenCalled()
  expect(dispose).not.toHaveBeenCalled()
  expect(stop).not.toHaveBeenCalled()
  jest.advanceTimersByTime(9999)
  expect(http.listen).toHaveBeenCalledTimes(1)
  jest.advanceTimersByTime(1)
  expect(http.listen).toHaveBeenCalledTimes(2)
  expect(http.listen.mock.calls[1][0]).toBe(12345)
  expect(dispose).not.toHaveBeenCalled()
  expect(stop).not.toHaveBeenCalled()
})

test('duplicate address errors schedule only one retry and successful listen cancels pending retry', () => {
  const {http, logger} = setup()
  http.emit('error', {code: 'EADDRINUSE'})
  http.emit('error', {code: 'EADDRINUSE'})
  expect(jest.getTimerCount()).toBe(1)
  jest.advanceTimersByTime(10000)
  expect(http.listen).toHaveBeenCalledTimes(2)
  http.emit('error', {code: 'EADDRINUSE'})
  http.emit('listening')
  expect(logger.info).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
  jest.advanceTimersByTime(10000)
  expect(http.listen).toHaveBeenCalledTimes(2)
})

test('explicit final close retains parent cleanup and prevents a scheduled retry from reopening', () => {
  const {http, dispose, stop} = setup()
  http.emit('error', {code: 'EADDRINUSE'})
  http.close()
  expect(dispose).toHaveBeenCalledTimes(1)
  expect(stop).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
  jest.advanceTimersByTime(20000)
  expect(http.listen).toHaveBeenCalledTimes(1)
  http.emit('error', {code: 'EADDRINUSE'})
  expect(jest.getTimerCount()).toBe(0)
})

test.each(['EACCES', 'EPERM', 'PRIVATE_CODE', undefined])('non-address error %p fails explicitly without retry or raw leakage', (code) => {
  const {http, logger, dispose} = setup()
  http.emit('error', Object.assign(new Error('PRIVATE_LISTEN_ERROR'), {code}))
  expect(logger.error).toHaveBeenCalledWith(code === 'EACCES' ? 'HTTP_LISTEN_FORBIDDEN' : 'HTTP_LISTEN_FAILED')
  expect(JSON.stringify(logger.error.mock.calls)).not.toContain('PRIVATE')
  expect(jest.getTimerCount()).toBe(0)
  expect(http.close).not.toHaveBeenCalled()
  expect(dispose).not.toHaveBeenCalled()
})

test('non-address failure cancels an older scheduled retry', () => {
  const {http} = setup()
  http.emit('error', {code: 'EADDRINUSE'})
  http.emit('error', {code: 'EACCES'})
  jest.advanceTimersByTime(20000)
  expect(http.listen).toHaveBeenCalledTimes(1)
})

test('synchronous listen failure uses the same retry path without closing adapters', () => {
  const {http, dispose, stop} = setup(Object.assign(new Error('PRIVATE_LISTEN_ERROR'), {code: 'EADDRINUSE'}))
  expect(http.listen).toHaveBeenCalledTimes(1)
  expect(dispose).not.toHaveBeenCalled()
  jest.advanceTimersByTime(10000)
  expect(http.listen).toHaveBeenCalledTimes(2)
  expect(stop).not.toHaveBeenCalled()
})
