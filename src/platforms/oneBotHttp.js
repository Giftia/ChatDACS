'use strict'

const fs = require('fs')

function safeError(code) {
  return Object.assign(new Error(code), {code})
}

function readOneBotAccessToken({config = {}, env = process.env, readFileSync = fs.readFileSync} = {}) {
  const required = String(config.ONE_BOT_PROVIDER).trim().toLowerCase() === 'snowluma'
  let token
  try {
    if (Object.prototype.hasOwnProperty.call(env, 'CHATDACS_ONEBOT_ACCESS_TOKEN')) {
      token = env.CHATDACS_ONEBOT_ACCESS_TOKEN
    } else {
      let content
      try {
        content = readFileSync(config.ONE_BOT_CREDENTIALS_FILE ?? 'config/onebot.credentials.json')
      } catch (error) {
        if (error?.code === 'ENOENT' && !required) return ''
        throw safeError('ONEBOT_AUTH_REQUIRED')
      }
      if (Buffer.byteLength(content) > 65536) throw safeError('ONEBOT_AUTH_REQUIRED')
      token = JSON.parse(content.toString('utf8')).accessToken
    }
    if (typeof token !== 'string' || token.length === 0 || token.length > 4096 ||
        /[\r\n]/.test(token) || !/^[A-Za-z0-9._~+/-]+=*$/.test(token)) throw safeError('ONEBOT_AUTH_REQUIRED')
    return token
  } catch {
    throw safeError('ONEBOT_AUTH_REQUIRED')
  }
}

function parseBase(value) {
  try {
    if (typeof value !== 'string' || !value || /[\s\\]/.test(value)) throw new Error()
    const url = new URL(value.includes('://') ? value : `http://${value}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || value.includes('?') || value.includes('#')) throw new Error()
    return url
  } catch {
    throw safeError('ONEBOT_REQUEST_FAILED')
  }
}

function allowDisabledExternal(rawUrl, options, defaults = {}) {
  const credentialKey = /^(?:authorization|proxy-authorization|cookie|x-api-key|api-key|access_token|token|api_key|apikey)$/i
  try {
    if (typeof rawUrl !== 'string' || !/^https?:\/\//i.test(rawUrl) || /[\s\\]/.test(rawUrl)) return false
    const target = new URL(rawUrl)
    if (target.username || target.password || [...target.searchParams.keys()].some((key) => credentialKey.test(key))) return false
    // Without a valid OneBot base, inherited or caller credentials cannot be
    // safely classified as external. Reject rather than silently stripping them.
    for (const settings of [options, defaults]) {
      if (settings.auth) return false
      const headers = settings.headers ?? {}
      const scopes = [headers, ...['common', 'get', 'delete', 'head', 'options', 'post', 'put', 'patch'].map((key) => headers[key])]
      if (scopes.some((scope) => scope && Object.keys(scope).some((key) => credentialKey.test(key)))) return false
      const params = typeof settings.params === 'string' ? new URLSearchParams(settings.params) : settings.params
      const keys = params instanceof URLSearchParams ? [...params.keys()] : Object.keys(params ?? {})
      if (keys.some((key) => credentialKey.test(key))) return false
    }
    return true
  } catch {
    return false
  }
}

function createOneBotHttpClient({axios, config = {}, env = process.env, readFileSync = fs.readFileSync}) {
  const methods = new Set(['get', 'delete', 'head', 'options', 'post', 'put', 'patch', 'request'])
  const invoke = async (method, args) => {
    const dataMethod = ['post', 'put', 'patch'].includes(method)
    const objectForm = (method === 'request' || method === null) && typeof args[0] !== 'string'
    const options = (objectForm ? args[0] : args[dataMethod ? 2 : 1]) ?? {}
    const rawUrl = objectForm ? options.url : args[0]
    const call = (nextArgs) => method === null ? Reflect.apply(axios, axios, nextArgs) : axios[method](...nextArgs)
    let base
    try {
      base = parseBase(config.ONE_BOT_API_URL)
    } catch {
      const switches = [config.CONNECT_ONE_BOT_SWITCH, config.GO_CQHTTP_SWITCH, config.CONNECT_GO_CQHTTP_SWITCH]
      const explicitlyDisabled = switches.includes(false) && switches.every((value) => value === false || value === undefined)
      if (explicitlyDisabled && allowDisabledExternal(rawUrl, options, axios.defaults)) return call(args)
      throw safeError('ONEBOT_REQUEST_FAILED')
    }
    let target
    try {
      if (typeof rawUrl !== 'string') throw new Error()
      if (/^([a-z][a-z\d+.-]*:)?\/\//i.test(rawUrl)) {
        target = new URL(rawUrl, base)
      } else {
        // Axios joins baseURL and relative URLs, including leading slashes.
        const relativeBase = options.baseURL ?? axios.defaults?.baseURL ?? base.href
        target = new URL(`${relativeBase.replace(/\/+$/, '')}/${rawUrl.replace(/^\/+/, '')}`)
      }
    } catch {
      return Promise.reject(safeError('ONEBOT_REQUEST_FAILED'))
    }
    const path = base.pathname.replace(/\/+$/, '')
    const isOneBot = target.origin === base.origin &&
      (target.pathname === path || target.pathname.startsWith(`${path}/`))
    if (!isOneBot) return call(args)
    if (target.username || target.password) throw safeError('ONEBOT_REQUEST_FAILED')
    return execute(options, async (next) => {
      const nextArgs = [...args]
      if (objectForm) nextArgs[0] = {...next, url: target.href}
      else {
        nextArgs[0] = target.href
        nextArgs[dataMethod ? 2 : 1] = next
      }
      return call(nextArgs)
    })
  }

  async function execute(options, send) {
    const token = readOneBotAccessToken({config, env, readFileSync})
    const controller = new AbortController()
    const positive = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0
    const timeout = positive(options.timeout) ? options.timeout :
      (positive(config.ONE_BOT_REQUEST_TIMEOUT_MS) ? config.ONE_BOT_REQUEST_TIMEOUT_MS : 15000)
    let expired = false
    let timer
    let onAbort
    try {
      const headers = {...options.headers}
      if (token) {
        for (const key of Object.keys(headers)) if (key.toLowerCase() === 'authorization') delete headers[key]
        headers.Authorization = `Bearer ${token}`
      }
      const cancellation = new Promise((_, reject) => {
        onAbort = () => {
          controller.abort()
          reject(safeError(expired ? 'ONEBOT_TIMEOUT' : 'ONEBOT_REQUEST_FAILED'))
        }
        options.signal?.addEventListener('abort', onAbort, {once: true})
        timer = setTimeout(() => { expired = true; onAbort() }, timeout)
        if (options.signal?.aborted) onAbort()
      })
      const response = await Promise.race([
        cancellation,
        Promise.resolve().then(() => {
          if (controller.signal.aborted) throw safeError('ONEBOT_REQUEST_FAILED')
          return send({...options, ...(token ? {auth: null} : {}), headers, timeout, maxRedirects: 0,
            signal: controller.signal})
        }),
      ])
      if (response?.status === 401 || response?.status === 403) throw safeError('ONEBOT_AUTH_FAILED')
      if (response?.status >= 300) throw safeError('ONEBOT_REQUEST_FAILED')
      const body = response?.data
      if (body && typeof body === 'object' &&
          ((Object.hasOwn(body, 'status') && body.status !== 'ok') ||
           (Object.hasOwn(body, 'retcode') && body.retcode !== 0))) throw safeError('ONEBOT_ACTION_FAILED')
      return response
    } catch (error) {
      const code = expired || ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code) ? 'ONEBOT_TIMEOUT' :
        [401, 403].includes(error?.response?.status) || error?.code === 'ONEBOT_AUTH_FAILED' ? 'ONEBOT_AUTH_FAILED' :
          error?.code === 'ONEBOT_ACTION_FAILED' ? 'ONEBOT_ACTION_FAILED' : 'ONEBOT_REQUEST_FAILED'
      throw safeError(code)
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }
  }

  return new Proxy(axios, {
    get(target, property, receiver) {
      if (methods.has(property)) return (...args) => invoke(property, args)
      return Reflect.get(target, property, receiver)
    },
    apply(_target, _thisArg, args) { return invoke(null, args) },
  })
}

module.exports = {readOneBotAccessToken, createOneBotHttpClient}
