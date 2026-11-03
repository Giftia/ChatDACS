'use strict'

const {registerOneBotWebhook, captureOneBotRawBody} = require('./webhook')
const {createHmac} = require('crypto')
const http = require('http')
const express = require('express')

const missing = () => { throw Object.assign(new Error('private file error'), {code: 'ENOENT'}) }

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

    registerOneBotWebhook({app, path: '/bot', handleEvent, logger, env: {}, readFileSync: missing})
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

    registerOneBotWebhook({app, path: '/bot', handleEvent, logger, env: {}, readFileSync: missing})
    routeHandler({body: {post_type: 'notice'}}, response)
    await flushPromises()

    expect(response.status).toHaveBeenCalledTimes(1)
    expect(response.end).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith('ONEBOT_EVENT_FAILED')
  })
})

describe('OneBot webhook authentication', () => {
  const secret = 'callback-test-secret'
  const body = {self_id: 123, post_type: 'message', message: 'hello'}
  const raw = Buffer.from(JSON.stringify(body))
  const signature = (bytes) => `sha1=${createHmac('sha1', secret).update(bytes).digest('hex')}`

  function setup({config = {}, env = {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}, isReady} = {}) {
    let handler
    const handleEvent = jest.fn().mockResolvedValue(undefined)
    const logger = {error: jest.fn()}
    registerOneBotWebhook({app: {post: (_path, next) => { handler = next }}, path: '/bot',
      handleEvent, logger, config, env, readFileSync: missing, isReady})
    return {handler, handleEvent, logger}
  }

  test.each([false, undefined, 0, null, ''])('not-ready result rejects without processing %#', async (value) => {
    const isReady = jest.fn(() => value)
    const {handler, handleEvent, logger} = setup({isReady})
    const response = makeResponse()
    handler({headers: {authorization: `Bearer ${secret}`}, body}, response)
    await flushPromises()
    expect(isReady).toHaveBeenCalledTimes(1)
    expect(response.status.mock.calls).toEqual([[503]])
    expect(response.end).toHaveBeenCalledTimes(1)
    expect(logger.error.mock.calls).toEqual([['ONEBOT_NOT_READY']])
    expect(handleEvent).not.toHaveBeenCalled()
  })

  test('throwing readiness check returns safe 503 without logging the original error', async () => {
    const {handler, handleEvent, logger} = setup({isReady: () => { throw new Error('private initialization error') }})
    const response = makeResponse()
    expect(() => handler({headers: {authorization: `Bearer ${secret}`}, body}, response)).not.toThrow()
    await flushPromises()
    expect(response.status.mock.calls).toEqual([[503]])
    expect(logger.error.mock.calls).toEqual([['ONEBOT_NOT_READY']])
    expect(handleEvent).not.toHaveBeenCalled()
  })

  test.each([
    [{}, {}, {}, 503],
    [{}, {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}, {}, 401],
    [{ONE_BOT_SELF_ID: '456'}, {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}, {authorization: `Bearer ${secret}`}, 403],
  ])('credentials, authentication and self ID are checked before readiness %#', async (settings, env, headers, status) => {
    const isReady = jest.fn(() => false)
    const {handler, handleEvent} = setup({config: {ONE_BOT_PROVIDER: 'snowluma', ...settings}, env, isReady})
    const response = makeResponse()
    handler({headers, body}, response)
    await flushPromises()
    expect(response.status).toHaveBeenCalledWith(status)
    expect(isReady).not.toHaveBeenCalled()
    expect(handleEvent).not.toHaveBeenCalled()
  })

  test('readiness is evaluated per request and accepts once initialization finishes', async () => {
    let ready = false
    const {handler, handleEvent, logger} = setup({isReady: () => ready})
    const request = {headers: {authorization: `Bearer ${secret}`}, body}
    const pending = makeResponse()
    handler(request, pending)
    expect(pending.status).toHaveBeenCalledWith(503)
    await flushPromises()
    expect(handleEvent).not.toHaveBeenCalled()
    ready = true
    const accepted = makeResponse()
    handler(request, accepted)
    expect(accepted.status).toHaveBeenCalledWith(204)
    await flushPromises()
    expect(handleEvent).toHaveBeenCalledTimes(1)
    expect(handleEvent).toHaveBeenCalledWith(body)
    expect(logger.error.mock.calls).toEqual([['ONEBOT_NOT_READY']])
  })

  test.each([
    {}, {authorization: 'Bearer wrong'}, {'x-signature': 'sha1=bad'},
    {'x-signature': `sha1=${'0'.repeat(40)}`}, {authorization: ['Bearer callback-test-secret']},
  ])('rejects missing/invalid authentication %#', async (headers) => {
    const {handler, handleEvent, logger} = setup({config: {ONE_BOT_PROVIDER: 'snowluma'}})
    const response = makeResponse()
    handler({headers, body, rawBody: raw}, response)
    await flushPromises()
    expect(response.status).toHaveBeenCalledWith(401)
    expect(handleEvent).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith('ONEBOT_AUTH_FAILED')
  })

  test('signature without raw Buffer is refused, never reconstructed from parsed JSON', async () => {
    const {handler, handleEvent} = setup()
    for (const rawBody of [undefined, raw.toString()]) {
      const response = makeResponse()
      handler({headers: {'x-signature': signature(raw)}, body, rawBody}, response)
      expect(response.status).toHaveBeenCalledWith(401)
    }
    await flushPromises()
    expect(handleEvent).not.toHaveBeenCalled()
  })

  test('explicit Bearer cannot bypass an unverifiable supplied signature', async () => {
    const {handler, handleEvent} = setup()
    const response = makeResponse()
    handler({headers: {authorization: `Bearer ${secret}`, 'x-signature': signature(raw)}, body}, response)
    expect(response.status).toHaveBeenCalledWith(401)
    await flushPromises()
    expect(handleEvent).not.toHaveBeenCalled()
  })

  test.each(['snowluma', 'napcat'])('explicit Bearer succeeds for %s', async (provider) => {
    const {handler, handleEvent} = setup({config: {ONE_BOT_PROVIDER: provider}})
    const response = makeResponse()
    handler({headers: {authorization: `Bearer ${secret}`}, body}, response)
    expect(response.status).toHaveBeenCalledWith(204)
    await flushPromises()
    expect(handleEvent).toHaveBeenCalledWith(body)
  })

  test.each([
    [{ONE_BOT_PROVIDER: 'snowluma'}, {}], [{ONE_BOT_PROVIDER: 'napcat'}, {CHATDACS_ONEBOT_ACCESS_TOKEN: ''}],
  ])('unavailable required credentials return 503 %#', async (config, env) => {
    const {handler, handleEvent, logger} = setup({config, env})
    const response = makeResponse()
    handler({headers: {}, body}, response)
    await flushPromises()
    expect(response.status).toHaveBeenCalledWith(503)
    expect(handleEvent).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith('ONEBOT_AUTH_REQUIRED')
  })

  test.each([{}, {self_id: 456}])('self ID mismatch is 403 after authentication %#', async (event) => {
    const {handler, handleEvent} = setup({config: {ONE_BOT_SELF_ID: '123'}})
    const response = makeResponse()
    handler({headers: {authorization: `Bearer ${secret}`}, body: event}, response)
    await flushPromises()
    expect(response.status).toHaveBeenCalledWith(403)
    expect(handleEvent).not.toHaveBeenCalled()
  })

  test('legacy without token succeeds but unsolicited signature is rejected', async () => {
    const {handler, handleEvent} = setup({env: {}})
    const response = makeResponse()
    handler({headers: {}, body}, response)
    expect(response.status).toHaveBeenCalledWith(204)
    await flushPromises()
    expect(handleEvent).toHaveBeenCalledTimes(1)
    const refused = makeResponse()
    handler({headers: {'x-signature': signature(raw)}, body, rawBody: raw}, refused)
    expect(refused.status).toHaveBeenCalledWith(401)
    await flushPromises()
    expect(handleEvent).toHaveBeenCalledTimes(1)
  })

  describe('SnowLuma signed callback loopback', () => {
    let server
    let handleEvent
    let logger
    let port
    let ready
    beforeEach(async () => {
      const app = express()
      app.use(express.json({verify: captureOneBotRawBody}))
      handleEvent = jest.fn().mockResolvedValue(undefined)
      logger = {error: jest.fn()}
      ready = true
      registerOneBotWebhook({app, path: '/bot', handleEvent, logger,
        config: {ONE_BOT_PROVIDER: 'snowluma', ONE_BOT_SELF_ID: '123'},
        env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}, readFileSync: missing, isReady: () => ready})
      server = await new Promise((resolve) => {
        const listening = app.listen(0, '127.0.0.1', () => resolve(listening))
      })
      port = server.address().port
    })
    afterEach(async () => {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    })

    function post(bytes, signedBytes = bytes) {
      return new Promise((resolve, reject) => {
        const request = http.request({host: '127.0.0.1', port, path: '/bot', method: 'POST', headers: {
          'Content-Type': 'application/json', 'Content-Length': bytes.length, 'X-Signature': signature(signedBytes),
        }}, (response) => { response.resume(); response.on('end', () => resolve(response.statusCode)) })
        request.on('error', reject)
        request.end(bytes)
      })
    }

    test('verifies exact bytes including whitespace, key order and UTF-8', async () => {
      const bytes = Buffer.from('{\n "message": "\u4f60\u597d", "post_type": "message", "self_id": 123\n}')
      expect(await post(bytes)).toBe(204)
      expect(handleEvent).toHaveBeenCalledWith(JSON.parse(bytes))
      expect(logger.error).not.toHaveBeenCalled()
    })

    test('format-only change and content tampering fail without event execution', async () => {
      const formatted = Buffer.from(JSON.stringify(body, null, 2))
      const tampered = Buffer.from(JSON.stringify({...body, message: 'tampered'}))
      expect(await post(formatted, raw)).toBe(401)
      expect(await post(tampered, raw)).toBe(401)
      expect(handleEvent).not.toHaveBeenCalled()
      expect(logger.error.mock.calls).toEqual([['ONEBOT_AUTH_FAILED'], ['ONEBOT_AUTH_FAILED']])
    })

    test('valid signature with wrong self ID returns 403', async () => {
      expect(await post(Buffer.from(JSON.stringify({...body, self_id: 456})))).toBe(403)
      expect(handleEvent).not.toHaveBeenCalled()
    })

    test('registered signed callback returns 503 until ready, then 204', async () => {
      ready = false
      expect(await post(raw)).toBe(503)
      expect(handleEvent).not.toHaveBeenCalled()
      ready = true
      expect(await post(raw)).toBe(204)
      expect(handleEvent).toHaveBeenCalledTimes(1)
      expect(logger.error.mock.calls).toEqual([['ONEBOT_NOT_READY']])
    })
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
