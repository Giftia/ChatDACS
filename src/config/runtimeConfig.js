'use strict'

function normalizeRuntimeConfig(rawConfig = {}, {logger} = {}) {
  const system = rawConfig.System ?? {}
  const apiKey = rawConfig.ApiKey ?? {}
  const qqBot = rawConfig.qqBot ?? {}
  const others = rawConfig.Others ?? {}
  const legacyGoCqhttpSwitch = system.CONNECT_GO_CQHTTP_SWITCH
  const callbackRoute = system.ONE_BOT_ANTI_POST_API ?? system.GO_CQHTTP_SERVICE_ANTI_POST_API ?? '/bot'
  const goCqhttpSwitch = system.GO_CQHTTP_SWITCH ?? legacyGoCqhttpSwitch ?? false
  const oneBotProvider = normalizeOneBotProvider(
    goCqhttpSwitch ? 'go-cqhttp' : system.ONE_BOT_PROVIDER,
    logger,
  )
  const oneBotConnectTimeoutMs = normalizePositiveNumber(
    system.ONE_BOT_CONNECT_TIMEOUT_MS,
    3000,
    'ONE_BOT_CONNECT_TIMEOUT_MS',
    logger,
  )
  const legacyKeysUsed =
    (system.GO_CQHTTP_SWITCH === undefined && legacyGoCqhttpSwitch !== undefined) ||
    (system.ONE_BOT_ANTI_POST_API === undefined && system.GO_CQHTTP_SERVICE_ANTI_POST_API !== undefined) ||
    (system.ONE_BOT_API_URL === undefined && system.GO_CQHTTP_SERVICE_API_URL !== undefined)

  if (legacyKeysUsed && typeof logger?.warn === 'function') {
    logger.warn('检测到 v3.7 配置键，已自动映射到当前 OneBot 配置；建议确认运行正常后再更新 config.yml')
  }

  return {
    ...rawConfig,
    System: system,
    ApiKey: apiKey,
    qqBot,
    Others: others,
    CHAT_SWITCH: system.CHAT_SWITCH ?? true,
    CONNECT_ONE_BOT_SWITCH: system.CONNECT_ONE_BOT_SWITCH ?? legacyGoCqhttpSwitch ?? false,
    GO_CQHTTP_SWITCH: goCqhttpSwitch,
    CONNECT_BILIBILI_LIVE_SWITCH: system.CONNECT_BILIBILI_LIVE_SWITCH ?? false,
    CONNECT_QQ_GUILD_SWITCH: system.CONNECT_QQ_GUILD_SWITCH ?? false,
    CONNECT_TELEGRAM_SWITCH: system.CONNECT_TELEGRAM_SWITCH ?? false,
    CONNECT_QQ_OFFICIAL_SWITCH: system.CONNECT_QQ_OFFICIAL_SWITCH === true,
    QQ_OFFICIAL_CREDENTIALS_FILE: rawConfig.qqOfficial?.credentialsFile ?? 'config/qq-official.credentials.json',
    QQ_OFFICIAL_PLUGIN_ALLOWLIST: normalizeStringList(rawConfig.qqOfficial?.pluginAllowlist, ['ping', 'help']),
    QQ_OFFICIAL_ACCESS: normalizeOfficialAccess(rawConfig.qqOfficial?.access),
    WEB_PORT: system.WEB_PORT ?? 80,
    WEB_HOST: system.WEB_HOST,
    PLUGIN_TIMEOUT_MS: system.PLUGIN_TIMEOUT_MS ?? 8000,
    PLUGIN_TIMEOUTS: system.PLUGIN_TIMEOUTS ?? {},
    ONE_BOT_ANTI_POST_API: typeof callbackRoute === 'string' && callbackRoute && !callbackRoute.startsWith('/')
      ? `/${callbackRoute}` : callbackRoute,
    ONE_BOT_API_URL: system.ONE_BOT_API_URL ?? system.GO_CQHTTP_SERVICE_API_URL ??
      `127.0.0.1:${oneBotProvider === 'snowluma' ? 3000 : 5700}`,
    ONE_BOT_PROVIDER: oneBotProvider,
    ONE_BOT_CONNECT_TIMEOUT_MS: oneBotConnectTimeoutMs,
    ONE_BOT_CREDENTIALS_FILE: system.ONE_BOT_CREDENTIALS_FILE ?? 'config/onebot.credentials.json',
    ONE_BOT_SELF_ID: system.ONE_BOT_SELF_ID == null || String(system.ONE_BOT_SELF_ID).trim() === ''
      ? undefined : String(system.ONE_BOT_SELF_ID).trim(),
    ONE_BOT_REQUEST_TIMEOUT_MS: normalizePositiveNumber(
      system.ONE_BOT_REQUEST_TIMEOUT_MS, 15000, 'ONE_BOT_REQUEST_TIMEOUT_MS', logger,
    ),
    ERROR_NOTIFY_GROUP_ID: normalizeErrorNotifyGroupId(system.ERROR_NOTIFY_GROUP_ID, logger),
    TIAN_XING_API_KEY: apiKey.TIAN_XING_API_KEY ?? '',
    SUMT_API_KEY: apiKey.SUMT_API_KEY ?? '',
    XIZHI_CHANNEL_KEY: apiKey.XIZHI_CHANNEL_KEY ?? '',
    QQ_GUILD_APP_ID: apiKey.QQ_GUILD_APP_ID ?? '',
    QQ_GUILD_TOKEN: apiKey.QQ_GUILD_TOKEN ?? '',
    TELEGRAM_BOT_TOKEN: apiKey.TELEGRAM_BOT_TOKEN ?? '',
    QQBOT_ADMIN_LIST: qqBot.QQBOT_ADMIN_LIST ?? [],
    QQ_GUILD_DIRECT_MESSAGE_SWITCH: qqBot.QQ_GUILD_DIRECT_MESSAGE_SWITCH === true,
    QQ_GROUP_WELCOME_MESSAGE: qqBot.QQ_GROUP_WELCOME_MESSAGE ?? '欢迎新人加入！',
    QQ_GROUP_POKE_REPLY_MESSAGE: qqBot.QQ_GROUP_POKE_REPLY_MESSAGE ?? '别戳啦！',
    QQ_GROUP_POKE_BOOM_REPLY_MESSAGE: qqBot.QQ_GROUP_POKE_BOOM_REPLY_MESSAGE ?? '戳坏啦！',
    AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH: qqBot.AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH ?? false,
    QQBOT_PRIVATE_CHAT_SWITCH: qqBot.QQBOT_PRIVATE_CHAT_SWITCH ?? false,
    CHAT_JIEBA_LIMIT: qqBot.CHAT_JIEBA_LIMIT ?? 5,
    QQBOT_REPLY_PROBABILITY: qqBot.QQBOT_REPLY_PROBABILITY ?? 10,
    QQBOT_FUDU_PROBABILITY: qqBot.QQBOT_FUDU_PROBABILITY ?? 1,
    QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH: qqBot.QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH ?? false,
    QQBOT_MAX_MINE_AT_MOST: qqBot.QQBOT_MAX_MINE_AT_MOST ?? 5,
    CHAT_BAN_WORDS: qqBot.CHAT_BAN_WORDS ?? [],
    BILIBILI_LIVE_ROOM_ID: others.BILIBILI_LIVE_ROOM_ID ?? 49148,
  }
}

function normalizeStringList(value, fallback = []) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : fallback
}

function normalizeOfficialAccess(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {c2cMode: 'disabled', c2cAllow: [], groupMode: 'disabled', groupAllow: []}
  }
  const mode = (input) => input === undefined ? 'open' : ['open', 'allowlist', 'disabled'].includes(input) ? input : 'disabled'
  return {
    c2cMode: mode(value?.c2cMode), c2cAllow: normalizeStringList(value?.c2cAllow),
    groupMode: mode(value?.groupMode), groupAllow: normalizeStringList(value?.groupAllow),
  }
}

function normalizeOneBotProvider(value, logger) {
  const provider = String(value ?? 'external').trim().toLowerCase()
  if (['napcat', 'snowluma', 'external', 'go-cqhttp'].includes(provider)) {
    return provider
  }

  logger?.warn?.(`未知的 ONE_BOT_PROVIDER: ${value}，已回退到 external`)
  return 'external'
}

function normalizeErrorNotifyGroupId(value, logger) {
  if (value === undefined) return undefined
  if (typeof value === 'string' && value.length > 0 && !/[^0-9]/.test(value)) return value
  logger?.warn?.('ERROR_NOTIFY_GROUP_ID 必须是数字字符串，已禁用错误群通知')
  return undefined
}

function normalizePositiveNumber(value, fallback, name, logger) {
  if (value === undefined) return fallback

  const number = Number(value)
  if (Number.isFinite(number) && number > 0) return number

  logger?.warn?.(`${name} 必须是正数，已回退到 ${fallback}`)
  return fallback
}

module.exports = {
  normalizeRuntimeConfig,
}
