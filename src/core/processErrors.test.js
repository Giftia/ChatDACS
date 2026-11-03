'use strict'

const {registerProcessErrorHandlers} = require('./processErrors')

describe('process error reporting', () => {
  test('reports errors to Web and logger while isolating admin notification failures', async () => {
    const handlers = new Map()
    const processLike = {
      on: jest.fn((event, handler) => handlers.set(event, handler)),
      off: jest.fn(),
    }
    const io = {emit: jest.fn()}
    const logger = {error: jest.fn()}
    const notifyAdmin = jest.fn().mockRejectedValue(new Error('onebot offline'))

    const registration = registerProcessErrorHandlers({processLike, io, logger, notifyAdmin})
    await expect(handlers.get('unhandledRejection')(new Error('plugin failed'))).resolves.toBeUndefined()

    expect(io.emit).toHaveBeenCalledWith('system', '系统处理失败，请稍后再试')
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('PROCESS_UNHANDLED_REJECTION'))
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('PROCESS_NOTIFICATION_ERROR'))
    expect(notifyAdmin).toHaveBeenCalledWith({code: 'PROCESS_UNHANDLED_REJECTION'})
    const serialized = JSON.stringify({web: io.emit.mock.calls, logs: logger.error.mock.calls, notifications: notifyAdmin.mock.calls})
    expect(serialized).not.toContain('plugin failed')
    expect(serialized).not.toContain('onebot offline')

    registration.dispose()
    expect(processLike.off).toHaveBeenCalledWith('uncaughtException', handlers.get('uncaughtException'))
    expect(processLike.off).toHaveBeenCalledWith('unhandledRejection', handlers.get('unhandledRejection'))
  })

  test('does not require a QQ notifier in Web-only mode', async () => {
    const handlers = new Map()
    const processLike = {
      on: jest.fn((event, handler) => handlers.set(event, handler)),
      off: jest.fn(),
    }
    const io = {emit: jest.fn()}
    const logger = {error: jest.fn()}

    registerProcessErrorHandlers({processLike, io, logger})

    await expect(handlers.get('uncaughtException')(new Error('web failure'))).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('PROCESS_UNCAUGHT_EXCEPTION'))
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('web failure')
  })

  test('direct report ignores untrusted prefix and never inspects raw error properties', async () => {
    const processLike = {on: jest.fn(), off: jest.fn()}
    const io = {emit: jest.fn()}
    const logger = {error: jest.fn()}
    const notifyAdmin = jest.fn()
    const error = {get stack() {throw new Error('must not inspect')}, toString() {throw new Error('must not stringify')}}
    const registration = registerProcessErrorHandlers({processLike, io, logger, notifyAdmin})
    await expect(registration.report('SECRET_PREFIX', error)).resolves.toBeUndefined()
    expect(notifyAdmin).toHaveBeenCalledWith({code: 'PROCESS_ERROR'})
    expect(JSON.stringify({web: io.emit.mock.calls, logs: logger.error.mock.calls})).not.toContain('SECRET_PREFIX')
  })

  test('broadcast and logger failures cannot prevent safe admin notification', async () => {
    const processLike = {on: jest.fn(), removeListener: jest.fn()}
    const io = {emit: jest.fn(() => {throw new Error('SECRET_WEB')})}
    const logger = {error: jest.fn(() => {throw new Error('SECRET_LOG')})}
    const notifyAdmin = jest.fn()
    const registration = registerProcessErrorHandlers({processLike, io, logger, notifyAdmin})
    await expect(registration.report('@未捕获的异常', new Error('SECRET_ORIGINAL'))).resolves.toBeUndefined()
    expect(notifyAdmin).toHaveBeenCalledWith({code: 'PROCESS_UNCAUGHT_EXCEPTION'})
    registration.dispose()
    expect(processLike.removeListener).toHaveBeenCalledTimes(2)
  })
})
