'use strict'

const {isIP} = require('net')
const {createOneBotHttpClient, readOneBotAccessToken} = require('../../platforms/oneBotHttp')

const names = {napcat: 'NapCat', snowluma: 'SnowLuma', external: 'OneBot'}
const fail = (code) => Object.assign(new Error(code), {code})
const requestCodes = new Set(['ONEBOT_AUTH_REQUIRED', 'ONEBOT_AUTH_FAILED', 'ONEBOT_REQUEST_FAILED',
  'ONEBOT_ACTION_FAILED', 'ONEBOT_TIMEOUT', 'ONEBOT_URL_INVALID', 'ONEBOT_PROVIDER_INVALID'])

function parseApiUrl(value) {
  try {
    if (typeof value !== 'string' || !value || /[\s\\?#]/.test(value)) throw new Error()
    const url = new URL(value.includes('://') ? value : `http://${value}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error()
    return url
  } catch { throw fail('ONEBOT_URL_INVALID') }
}

function normalizeApiBaseUrl(apiUrl) {
  return parseApiUrl(apiUrl).href.replace(/\/+$/, '')
}

function createNapCatOneBotConfig({apiUrl, callbackUrl, accessToken = ''}) {
  const api = parseApiUrl(apiUrl)
  const callback = parseApiUrl(callbackUrl)
  if (api.protocol !== 'http:') throw fail('ONEBOT_LISTENER_HTTP_REQUIRED')
  return {network: {
    httpServers: [{name: 'ChatDACS API', enable: true, port: Number(api.port || 80),
      host: api.hostname.replace(/^\[|\]$/g, ''), enableCors: false, enableWebsocket: false,
      messagePostFormat: 'string', token: accessToken, debug: false}],
    httpClients: [{name: 'ChatDACS Events', enable: true, url: callback.href,
      messagePostFormat: 'string', reportSelfMessage: false, token: accessToken, debug: false}],
    websocketServers: [], websocketClients: [],
  }, musicSignUrl: '', enableLocalFile2Url: false, parseMultMsg: false}
}

// Mirrors SnowLuma v2.4.0 config.ts isValidBindHost; this is syntax-only.
function isValidSnowLumaBindHost(value) {
  if (!value || value.length > 253 || /[\s/?#@]/u.test(value)) return false
  if (value.includes(':')) return isIP(value) === 6
  if (/^[\d.]+$/.test(value)) return isIP(value) === 4
  const normalized = value.endsWith('.') ? value.slice(0, -1) : value
  return normalized.split('.').every((label) => /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/.test(label))
}

// SnowLuma v2.4.0 uses `networks` / `enabled` / `accessToken`, not NapCat's schema.
function createSnowLumaOneBotConfig({apiUrl, callbackUrl, accessToken}) {
  const api = parseApiUrl(apiUrl)
  const callback = parseApiUrl(callbackUrl)
  if (api.protocol !== 'http:') throw fail('ONEBOT_LISTENER_HTTP_REQUIRED')
  const host = api.hostname.replace(/^\[|\]$/g, '')
  if (!isValidSnowLumaBindHost(host)) throw fail('ONEBOT_URL_INVALID')
  const port = Number(api.port || 80)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw fail('ONEBOT_URL_INVALID')
  readOneBotAccessToken({config: {ONE_BOT_PROVIDER: 'snowluma'}, env: {CHATDACS_ONEBOT_ACCESS_TOKEN: accessToken}})
  if (/^(?:token|changeme|change-me|replace-me|your[-_]?token|your[-_]?access[-_]?token|placeholder)$/i.test(accessToken)) {
    throw fail('ONEBOT_AUTH_REQUIRED')
  }
  const common = {enabled: true, accessToken, messageFormat: 'string', reportSelfMessage: false}
  return {mode: 'snapshot', networks: {
    httpServers: [{name: 'ChatDACS API', ...common, host,
      port, path: api.pathname, enableWebSocket: false, enableSse: false}],
    httpClients: [{name: 'ChatDACS Events', ...common, url: callback.href, timeoutMs: 15000}],
    wsServers: [], wsClients: [],
  }}
}

function buildProviderConfigFromRuntime({config, eventHost = '127.0.0.1', accessToken, env, readFileSync}) {
  if (!config || typeof eventHost !== 'string') throw fail('ONEBOT_CONFIG_INVALID')
  const callback = parseApiUrl(eventHost.includes('://') ? eventHost : `http://${eventHost}`)
  if (callback.pathname !== '/') throw fail('ONEBOT_CALLBACK_INVALID')
  if (!Number.isInteger(Number(config.WEB_PORT)) || Number(config.WEB_PORT) < 1 || Number(config.WEB_PORT) > 65535) throw fail('ONEBOT_CALLBACK_PORT_INVALID')
  callback.port = String(config.WEB_PORT)
  const route = config.ONE_BOT_ANTI_POST_API
  if (typeof route !== 'string' || !route || /[\s\\?#]/.test(route) || route.startsWith('//')) throw fail('ONEBOT_CALLBACK_INVALID')
  callback.pathname = route.startsWith('/') ? route : `/${route}`
  const provider = config.ONE_BOT_PROVIDER ?? 'napcat'
  if (!['napcat', 'snowluma'].includes(provider)) throw fail('ONEBOT_PROVIDER_CONFIG_UNSUPPORTED')
  const token = accessToken === undefined ? readOneBotAccessToken({config, env, readFileSync}) : accessToken
  const options = {apiUrl: config.ONE_BOT_API_URL, callbackUrl: callback.href, accessToken: token}
  if (provider === 'snowluma') return createSnowLumaOneBotConfig(options)
  if (provider === 'napcat') return createNapCatOneBotConfig(options)
  throw fail('ONEBOT_PROVIDER_CONFIG_UNSUPPORTED')
}

function ok(payload) {
  return payload?.status === 'ok' && (payload.retcode === undefined || payload.retcode === 0)
}

async function checkOneBotSession({config, client}) {
  const base = normalizeApiBaseUrl(config.ONE_BOT_API_URL)
  const options = {timeout: config.ONE_BOT_CONNECT_TIMEOUT_MS ?? 3000}
  const {data: login} = await client.get(`${base}/get_login_info`, options)
  const id = login?.data?.user_id
  const validId = typeof id === 'number' ? Number.isSafeInteger(id) && id > 0
    : typeof id === 'string' && /^[1-9]\d*$/.test(id)
  if (!ok(login) || !validId) throw fail('ONEBOT_LOGIN_INVALID')
  if (config.ONE_BOT_SELF_ID != null && String(id) !== String(config.ONE_BOT_SELF_ID)) {
    throw fail('ONEBOT_SELF_ID_MISMATCH')
  }
  if (config.ONE_BOT_PROVIDER === 'snowluma') {
    // SnowLuma can return the configured account even while its bridge is offline.
    const {data: status} = await client.get(`${base}/get_status`, options)
    if (!ok(status) || typeof status?.data?.online !== 'boolean' || typeof status?.data?.good !== 'boolean') {
      throw fail('ONEBOT_STATUS_INVALID')
    }
    if (!status.data.online) throw fail('ONEBOT_OFFLINE')
    if (!status.data.good) throw fail('ONEBOT_UNHEALTHY')
  }
}

const readinessCodes = new Set([...requestCodes, 'ONEBOT_LOGIN_INVALID', 'ONEBOT_SELF_ID_MISMATCH',
  'ONEBOT_STATUS_INVALID', 'ONEBOT_OFFLINE', 'ONEBOT_UNHEALTHY'])

async function probeOneBot({config, axios, env, readFileSync}) {
  try {
    if (!Object.hasOwn(names, config?.ONE_BOT_PROVIDER ?? 'external')) throw fail('ONEBOT_PROVIDER_INVALID')
    const client = createOneBotHttpClient({config, axios, env, readFileSync})
    const response = await client.get(`${normalizeApiBaseUrl(config.ONE_BOT_API_URL)}/get_version_info`,
      {timeout: config.ONE_BOT_CONNECT_TIMEOUT_MS ?? 3000})
    const payload = response?.data
    const info = payload?.data ?? {}
    const appName = typeof info.app_name === 'string' ? info.app_name : ''
    const protocolVersion = String(info.protocol_version ?? '')
    const provider = config.ONE_BOT_PROVIDER ?? 'external'
    const providerMatches = provider === 'external' || (provider === 'napcat' && /napcat/i.test(appName)) ||
      (provider === 'snowluma' && /snowluma/i.test(appName))
    return {reachable: true, compatible: ok(payload) && /^(v)?11$/i.test(protocolVersion) && providerMatches,
      appName, appVersion: String(info.app_version ?? ''), protocolVersion}
  } catch (error) {
    const safeCode = requestCodes.has(error?.code) ? error.code : 'ONEBOT_PROBE_FAILED'
    return {reachable: safeCode === 'ONEBOT_AUTH_FAILED', compatible: false, error: safeCode}
  }
}

async function checkOneBotReadiness({config, axios, env, readFileSync}) {
  const connection = await probeOneBot({config, axios, env, readFileSync})
  if (!connection.compatible) return {...connection, loggedIn: false, groupCount: 0}
  try {
    const client = createOneBotHttpClient({config, axios, env, readFileSync})
    const base = normalizeApiBaseUrl(config.ONE_BOT_API_URL)
    const options = {timeout: config.ONE_BOT_CONNECT_TIMEOUT_MS ?? 3000}
    await checkOneBotSession({config, client})
    const groups = await client.get(`${base}/get_group_list`, options)
    const validGroups = ok(groups.data) && Array.isArray(groups.data.data)
    return {...connection, loggedIn: true,
      groupCount: validGroups ? groups.data.data.length : 0, ...(validGroups ? {} : {error: 'ONEBOT_GROUP_LIST_INVALID'})}
  } catch (error) {
    return {...connection, loggedIn: false, groupCount: 0, error: readinessCodes.has(error?.code) ? error.code : 'ONEBOT_READINESS_FAILED'}
  }
}

async function verifyOneBotConnection({config, axios, logger = console, env, readFileSync}) {
  const result = await probeOneBot({config, axios, env, readFileSync})
  const name = names[config.ONE_BOT_PROVIDER] ?? 'OneBot'
  if (result.compatible) logger.info(`${name} OneBot 11 已连接: ${result.appName} ${result.appVersion} (${result.protocolVersion})`)
  else logger.warn(`${name} 尚未就绪 code=${result.error ?? 'ONEBOT_PROVIDER_MISMATCH'}；Web 与其他平台继续运行`)
  return result
}

module.exports = {normalizeApiBaseUrl, createNapCatOneBotConfig, createSnowLumaOneBotConfig,
  buildProviderConfigFromRuntime, probeOneBot, checkOneBotSession, checkOneBotReadiness, verifyOneBotConnection}
