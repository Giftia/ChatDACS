'use strict'

const {createHmac, timingSafeEqual} = require('crypto')
const {readOneBotAccessToken} = require('../../platforms/oneBotHttp')

function captureOneBotRawBody(req, _res, buffer) {
  req.rawBody = Buffer.from(buffer)
}

function equalSecret(actual, expected) {
  if (typeof actual !== 'string') return false
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function registerOneBotWebhook({app, path, handleEvent, logger = console, config = {}, env, readFileSync,
  isReady = () => true}) {
  if (!app || typeof app.post !== 'function') {
    throw new Error('app.post is required')
  }
  if (!path) {
    throw new Error('path is required')
  }
  if (typeof handleEvent !== 'function') {
    throw new Error('handleEvent is required')
  }

  app.post(path, (req, res) => {
    const reject = (status, code) => {
      logger?.error?.(code)
      res.status(status).end()
    }
    let token
    try {
      token = readOneBotAccessToken({config, env, readFileSync})
    } catch {
      reject(503, 'ONEBOT_AUTH_REQUIRED')
      return
    }
    if (token) {
      const signature = req.headers?.['x-signature']
      const bearer = equalSecret(req.headers?.authorization, `Bearer ${token}`)
      const signed = typeof signature === 'string' && /^sha1=[a-f0-9]{40}$/.test(signature) &&
        Buffer.isBuffer(req.rawBody) && equalSecret(signature,
          `sha1=${createHmac('sha1', token).update(req.rawBody).digest('hex')}`)
      if ((signature !== undefined && !signed) || (!bearer && !signed)) {
        reject(401, 'ONEBOT_AUTH_FAILED')
        return
      }
    } else if (req.headers?.['x-signature'] !== undefined) {
      reject(401, 'ONEBOT_AUTH_FAILED')
      return
    }
    if (config.ONE_BOT_SELF_ID !== undefined &&
        String(req.body?.self_id) !== String(config.ONE_BOT_SELF_ID)) {
      reject(403, 'ONEBOT_SELF_ID_MISMATCH')
      return
    }
    let ready = false
    try {
      ready = isReady()
    } catch {
      // Readiness failures must not expose initialization errors or accept events.
    }
    if (!ready) {
      reject(503, 'ONEBOT_NOT_READY')
      return
    }
    res.status(204).end()

    Promise.resolve()
      .then(() => handleEvent(req.body))
      .catch(() => {
        if (typeof logger?.error === 'function') {
          logger.error('ONEBOT_EVENT_FAILED')
        }
      })
  })
}

module.exports = {
  registerOneBotWebhook,
  captureOneBotRawBody,
}
