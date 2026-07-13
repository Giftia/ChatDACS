'use strict'

const {normalizeRuntimeConfig} = require('./runtimeConfig')

describe('runtime config normalization', () => {
  test('preserves current config keys and plugin-facing values', () => {
    const rawConfig = {
      System: {
        CHAT_SWITCH: false,
        CONNECT_ONE_BOT_SWITCH: true,
        GO_CQHTTP_SWITCH: false,
        CONNECT_BILIBILI_LIVE_SWITCH: true,
        CONNECT_QQ_GUILD_SWITCH: true,
        CONNECT_TELEGRAM_SWITCH: true,
        WEB_PORT: 8080,
        PLUGIN_TIMEOUT_MS: 3000,
        ONE_BOT_ANTI_POST_API: '/onebot',
        ONE_BOT_API_URL: 'onebot.example:5700',
        ONE_BOT_PROVIDER: 'napcat',
        ONE_BOT_CONNECT_TIMEOUT_MS: 1500,
      },
      ApiKey: {
        TIAN_XING_API_KEY: 'tianxing',
        SUMT_API_KEY: 'sumt',
        XIZHI_CHANNEL_KEY: 'xizhi',
        QQ_GUILD_APP_ID: 'guild-id',
        QQ_GUILD_TOKEN: 'guild-token',
        TELEGRAM_BOT_TOKEN: 'telegram-token',
      },
      qqBot: {
        QQBOT_ADMIN_LIST: ['10001'],
        CHAT_BAN_WORDS: ['blocked'],
      },
      Others: {
        BILIBILI_LIVE_ROOM_ID: 12345,
      },
    }

    expect(normalizeRuntimeConfig(rawConfig)).toEqual(
      expect.objectContaining({
        CHAT_SWITCH: false,
        CONNECT_ONE_BOT_SWITCH: true,
        GO_CQHTTP_SWITCH: false,
        CONNECT_BILIBILI_LIVE_SWITCH: true,
        CONNECT_QQ_GUILD_SWITCH: true,
        CONNECT_TELEGRAM_SWITCH: true,
        WEB_PORT: 8080,
        PLUGIN_TIMEOUT_MS: 3000,
        ONE_BOT_ANTI_POST_API: '/onebot',
        ONE_BOT_API_URL: 'onebot.example:5700',
        ONE_BOT_PROVIDER: 'napcat',
        ONE_BOT_CONNECT_TIMEOUT_MS: 1500,
        TIAN_XING_API_KEY: 'tianxing',
        SUMT_API_KEY: 'sumt',
        XIZHI_CHANNEL_KEY: 'xizhi',
        ApiKey: rawConfig.ApiKey,
        QQBOT_ADMIN_LIST: ['10001'],
        CHAT_BAN_WORDS: ['blocked'],
        BILIBILI_LIVE_ROOM_ID: 12345,
      }),
    )
  })

  test('maps v3.7 go-cqhttp keys for in-place replacement', () => {
    const logger = {warn: jest.fn()}
    const config = normalizeRuntimeConfig(
      {
        System: {
          CONNECT_GO_CQHTTP_SWITCH: true,
          GO_CQHTTP_SERVICE_ANTI_POST_API: '/legacy-bot',
          GO_CQHTTP_SERVICE_API_URL: '127.0.0.1:6700',
        },
      },
      {logger},
    )

    expect(config).toEqual(
      expect.objectContaining({
        CONNECT_ONE_BOT_SWITCH: true,
        GO_CQHTTP_SWITCH: true,
        ONE_BOT_ANTI_POST_API: '/legacy-bot',
        ONE_BOT_API_URL: '127.0.0.1:6700',
        ONE_BOT_PROVIDER: 'go-cqhttp',
      }),
    )
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('v3.7'))
  })

  test('current keys take precedence when legacy and current keys coexist', () => {
    const config = normalizeRuntimeConfig({
      System: {
        CONNECT_ONE_BOT_SWITCH: true,
        GO_CQHTTP_SWITCH: false,
        CONNECT_GO_CQHTTP_SWITCH: true,
        ONE_BOT_ANTI_POST_API: '/current',
        GO_CQHTTP_SERVICE_ANTI_POST_API: '/legacy',
        ONE_BOT_API_URL: 'current:5700',
        GO_CQHTTP_SERVICE_API_URL: 'legacy:5700',
      },
    })

    expect(config.GO_CQHTTP_SWITCH).toBe(false)
    expect(config.ONE_BOT_ANTI_POST_API).toBe('/current')
    expect(config.ONE_BOT_API_URL).toBe('current:5700')
  })

  test('normalizes a partial config without throwing', () => {
    expect(normalizeRuntimeConfig({})).toEqual(
      expect.objectContaining({
        CHAT_SWITCH: true,
        CONNECT_ONE_BOT_SWITCH: false,
        GO_CQHTTP_SWITCH: false,
        WEB_PORT: 80,
        PLUGIN_TIMEOUT_MS: 8000,
        ONE_BOT_ANTI_POST_API: '/bot',
        ONE_BOT_API_URL: '127.0.0.1:5700',
        ONE_BOT_PROVIDER: 'external',
        ONE_BOT_CONNECT_TIMEOUT_MS: 3000,
        ApiKey: {},
        QQBOT_ADMIN_LIST: [],
        CHAT_BAN_WORDS: [],
      }),
    )
  })

  test('normalizes provider names and rejects invalid provider settings', () => {
    expect(
      normalizeRuntimeConfig({System: {ONE_BOT_PROVIDER: ' NapCat '}}).ONE_BOT_PROVIDER,
    ).toBe('napcat')

    const logger = {warn: jest.fn()}
    const config = normalizeRuntimeConfig(
      {System: {ONE_BOT_PROVIDER: 'unsupported', ONE_BOT_CONNECT_TIMEOUT_MS: 0}},
      {logger},
    )

    expect(config.ONE_BOT_PROVIDER).toBe('external')
    expect(config.ONE_BOT_CONNECT_TIMEOUT_MS).toBe(3000)
    expect(logger.warn).toHaveBeenCalledTimes(2)
  })
})
