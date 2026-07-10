'use strict'

const {registerOneBotWebhook} = require('./webhook')

describe('OneBot webhook registration', () => {
  test('acknowledges immediately and processes the event in the background', async () => {
    let routeHandler
    const app = {
      post: jest.fn((_path, handler) => {
        routeHandler = handler
      }),
    }
    const handleEvent = jest.fn().mockResolvedValue(undefined)
    const logger = {error: jest.fn()}
    const response = makeResponse()

    registerOneBotWebhook({app, path: '/bot', handleEvent, logger})
    const routeReturn = routeHandler({body: {post_type: 'message'}}, response)

    expect(routeReturn).toBeUndefined()
    expect(response.status).toHaveBeenCalledWith(204)
    expect(response.end).toHaveBeenCalled()

    await flushPromises()
    expect(handleEvent).toHaveBeenCalledWith({post_type: 'message'})
    expect(logger.error).not.toHaveBeenCalled()
  })

  test('logs background processing failures without touching the completed response', async () => {
    let routeHandler
    const app = {
      post: jest.fn((_path, handler) => {
        routeHandler = handler
      }),
    }
    const handleEvent = jest.fn().mockRejectedValue(new Error('event failed'))
    const logger = {error: jest.fn()}
    const response = makeResponse()

    registerOneBotWebhook({app, path: '/bot', handleEvent, logger})
    routeHandler({body: {post_type: 'notice'}}, response)
    await flushPromises()

    expect(response.status).toHaveBeenCalledTimes(1)
    expect(response.end).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('event failed'))
  })
})

function makeResponse() {
  const response = {
    status: jest.fn(),
    end: jest.fn(),
  }
  response.status.mockReturnValue(response)
  return response
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve))
}
