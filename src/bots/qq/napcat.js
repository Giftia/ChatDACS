'use strict'

function buildNapCatConfigFromRuntime({config, eventHost = '127.0.0.1'}) {
  const callback = new URL(`http://${eventHost}`)
  callback.port = String(config.WEB_PORT)
  callback.pathname = config.ONE_BOT_ANTI_POST_API.startsWith('/')
    ? config.ONE_BOT_ANTI_POST_API
    : `/${config.ONE_BOT_ANTI_POST_API}`

  return createNapCatOneBotConfig({
    apiUrl: config.ONE_BOT_API_URL,
    callbackUrl: callback.toString(),
  })
}

function createNapCatOneBotConfig({apiUrl, callbackUrl}) {
  const api = parseApiUrl(apiUrl)
  const callback = new URL(callbackUrl)

  return {
    network: {
      httpServers: [
        {
          name: 'ChatDACS API',
          enable: true,
          port: api.port,
          host: api.hostname,
          enableCors: false,
          enableWebsocket: false,
          messagePostFormat: 'string',
          token: '',
          debug: false,
        },
      ],
      httpClients: [
        {
          name: 'ChatDACS Events',
          enable: true,
          url: callback.toString(),
          messagePostFormat: 'string',
          reportSelfMessage: false,
          token: '',
          debug: false,
        },
      ],
      websocketServers: [],
      websocketClients: [],
    },
    musicSignUrl: '',
    enableLocalFile2Url: false,
    parseMultMsg: false,
  }
}

async function probeNapCat({apiUrl, axios, timeoutMs = 3000}) {
  try {
    const response = await axios.get(`${normalizeApiBaseUrl(apiUrl)}/get_version_info`, {timeout: timeoutMs})
    const payload = response?.data ?? {}
    const version = payload.data ?? {}
    const appName = String(version.app_name ?? '')
    const protocolVersion = String(version.protocol_version ?? '')

    return {
      reachable: true,
      compatible: payload.status === 'ok' && /napcat/i.test(appName) && protocolVersion.toLowerCase() === 'v11',
      appName,
      appVersion: String(version.app_version ?? ''),
      protocolVersion,
    }
  } catch (error) {
    return {
      reachable: false,
      compatible: false,
      error: formatError(error),
    }
  }
}

async function verifyNapCatConnection({config, axios, logger = console}) {
  const result = await probeNapCat({
    apiUrl: config.ONE_BOT_API_URL,
    axios,
    timeoutMs: config.ONE_BOT_CONNECT_TIMEOUT_MS,
  })

  if (result.compatible) {
    logger.info(
      `NapCat OneBot 11 已连接: ${result.appName} ${result.appVersion} (${result.protocolVersion})`,
    )
  } else if (result.reachable) {
    logger.warn(
      `OneBot 服务可访问，但不是兼容的 NapCat OneBot 11: ${result.appName || 'unknown'} ${
        result.protocolVersion || 'unknown'
      }`,
    )
  } else {
    logger.warn(
      `NapCat 暂不可用 (${config.ONE_BOT_API_URL}): ${result.error}；Web 与其他平台将继续启动，NapCat 上线后请重启 ChatDACS 以初始化 QQ Adapter`,
    )
  }

  return result
}

async function checkNapCatReadiness({config, axios}) {
  const connection = await probeNapCat({
    apiUrl: config.ONE_BOT_API_URL,
    axios,
    timeoutMs: config.ONE_BOT_CONNECT_TIMEOUT_MS,
  })
  if (!connection.compatible) {
    return {...connection, loggedIn: false, groupCount: 0}
  }

  try {
    const baseUrl = normalizeApiBaseUrl(config.ONE_BOT_API_URL)
    const options = {timeout: config.ONE_BOT_CONNECT_TIMEOUT_MS}
    const [loginResponse, groupsResponse] = await Promise.all([
      axios.get(`${baseUrl}/get_login_info`, options),
      axios.get(`${baseUrl}/get_group_list`, options),
    ])
    const loginPayload = loginResponse?.data ?? {}
    const groupsPayload = groupsResponse?.data ?? {}
    const groups = Array.isArray(groupsPayload.data) ? groupsPayload.data : []

    return {
      ...connection,
      loggedIn: loginPayload.status === 'ok' && loginPayload.data?.user_id != null,
      groupCount: groupsPayload.status === 'ok' ? groups.length : 0,
    }
  } catch (error) {
    return {
      ...connection,
      loggedIn: false,
      groupCount: 0,
      error: formatError(error),
    }
  }
}

function normalizeApiBaseUrl(apiUrl) {
  const parsed = parseApiUrl(apiUrl)
  return `${parsed.protocol}//${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')}`
}

function parseApiUrl(apiUrl) {
  if (!apiUrl) {
    throw new Error('ONE_BOT_API_URL is required')
  }

  const value = String(apiUrl).trim()
  const parsed = new URL(value.includes('://') ? value : `http://${value}`)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported OneBot protocol: ${parsed.protocol}`)
  }

  return {
    protocol: parsed.protocol,
    host: parsed.host,
    hostname: parsed.hostname,
    port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
    pathname: parsed.pathname,
  }
}

function formatError(error) {
  return error?.message ?? String(error)
}

module.exports = {
  buildNapCatConfigFromRuntime,
  checkNapCatReadiness,
  createNapCatOneBotConfig,
  normalizeApiBaseUrl,
  probeNapCat,
  verifyNapCatConnection,
}
