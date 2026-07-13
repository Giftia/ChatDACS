'use strict'

function normalizeRuntimeConfig(rawConfig = {}, {logger} = {}) {
  const system = rawConfig.System ?? {}
  const apiKey = rawConfig.ApiKey ?? {}
  const qqBot = rawConfig.qqBot ?? {}
  const others = rawConfig.Others ?? {}
  const legacyGoCqhttpSwitch = system.CONNECT_GO_CQHTTP_SWITCH
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
    WEB_PORT: system.WEB_PORT ?? 80,
    PLUGIN_TIMEOUT_MS: system.PLUGIN_TIMEOUT_MS ?? 8000,
    ONE_BOT_ANTI_POST_API:
      system.ONE_BOT_ANTI_POST_API ?? system.GO_CQHTTP_SERVICE_ANTI_POST_API ?? '/bot',
    ONE_BOT_API_URL: system.ONE_BOT_API_URL ?? system.GO_CQHTTP_SERVICE_API_URL ?? '127.0.0.1:5700',
    ONE_BOT_PROVIDER: oneBotProvider,
    ONE_BOT_CONNECT_TIMEOUT_MS: oneBotConnectTimeoutMs,
    TIAN_XING_API_KEY: apiKey.TIAN_XING_API_KEY ?? '',
    SUMT_API_KEY: apiKey.SUMT_API_KEY ?? '',
    XIZHI_CHANNEL_KEY: apiKey.XIZHI_CHANNEL_KEY ?? '',
    QQ_GUILD_APP_ID: apiKey.QQ_GUILD_APP_ID ?? '',
    QQ_GUILD_TOKEN: apiKey.QQ_GUILD_TOKEN ?? '',
    TELEGRAM_BOT_TOKEN: apiKey.TELEGRAM_BOT_TOKEN ?? '',
    QQBOT_ADMIN_LIST: qqBot.QQBOT_ADMIN_LIST ?? [],
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

function normalizeOneBotProvider(value, logger) {
  const provider = String(value ?? 'external').trim().toLowerCase()
  if (['napcat', 'external', 'go-cqhttp'].includes(provider)) {
    return provider
  }

  logger?.warn?.(`未知的 ONE_BOT_PROVIDER: ${value}，已回退到 external`)
  return 'external'
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
