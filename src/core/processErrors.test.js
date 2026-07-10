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

    expect(io.emit).toHaveBeenCalledWith('system', expect.stringContaining('@未捕获的promise异常'))
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('plugin failed'))
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('onebot offline'))
    expect(notifyAdmin).toHaveBeenCalledWith(expect.any(Error))

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
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('web failure'))
  })
})
