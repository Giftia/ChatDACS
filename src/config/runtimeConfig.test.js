'use strict'

const {normalizeRuntimeConfig} = require('./runtimeConfig')

describe('runtime config normalization', () => {
  test('preserves an optional Web listen host without changing the legacy default', () => {
    expect(normalizeRuntimeConfig({}).WEB_HOST).toBeUndefined()
    expect(normalizeRuntimeConfig({System: {WEB_HOST: '127.0.0.1'}}).WEB_HOST).toBe('127.0.0.1')
  })
  test('error group notifications are disabled by default and accept only digit strings', () => {
    expect(normalizeRuntimeConfig({}).ERROR_NOTIFY_GROUP_ID).toBeUndefined()
    expect(normalizeRuntimeConfig({System: {ERROR_NOTIFY_GROUP_ID: '123456'}}).ERROR_NOTIFY_GROUP_ID).toBe('123456')
    const logger = {warn: jest.fn()}
    for (const value of [null, '', 123456, ' 123 ', '123\n', '123&message=other', {}, true]) {
      expect(normalizeRuntimeConfig({System: {ERROR_NOTIFY_GROUP_ID: value}}, {logger}).ERROR_NOTIFY_GROUP_ID)
        .toBeUndefined()
    }
    expect(logger.warn).toHaveBeenCalledTimes(8)
    expect(logger.warn).toHaveBeenCalledWith('ERROR_NOTIFY_GROUP_ID 必须是数字字符串，已禁用错误群通知')
  })

  test.each([undefined, null, '', '   '])('normalized empty self ID accepts legacy webhook events %#', async (selfId) => {
    const {registerOneBotWebhook} = require('../bots/qq/webhook')
    let handler
    const event = {post_type: 'message', self_id: 123}
    const handleEvent = jest.fn()
    const response = {status: jest.fn().mockReturnThis(), end: jest.fn()}
    registerOneBotWebhook({app: {post: (_path, callback) => { handler = callback }}, path: '/bot',
      config: normalizeRuntimeConfig({System: {ONE_BOT_SELF_ID: selfId}}), env: {},
      readFileSync: () => { throw Object.assign(new Error('mock missing'), {code: 'ENOENT'}) }, handleEvent})
    handler({headers: {}, body: event}, response)
    await Promise.resolve()
    expect(response.status).toHaveBeenCalledWith(204)
    expect(handleEvent).toHaveBeenCalledWith(event)
  })

  test('SnowLuma gets its own API default and credential metadata only', () => {
    const readSpy = jest.spyOn(require('fs'), 'readFileSync')
    try {
      const config = normalizeRuntimeConfig({System: {ONE_BOT_PROVIDER: ' SnowLuma '}})
      expect(config).toMatchObject({ONE_BOT_PROVIDER: 'snowluma', ONE_BOT_API_URL: '127.0.0.1:3000',
        ONE_BOT_CREDENTIALS_FILE: 'config/onebot.credentials.json', ONE_BOT_REQUEST_TIMEOUT_MS: 15000})
      expect(config.ONE_BOT_SELF_ID).toBeUndefined()
      expect(readSpy).not.toHaveBeenCalled()
    } finally { readSpy.mockRestore() }
  })

  test.each(['napcat', 'external', 'go-cqhttp'])('%s retains port 5700 by default', (provider) => {
    expect(normalizeRuntimeConfig({System: {ONE_BOT_PROVIDER: provider}}).ONE_BOT_API_URL).toBe('127.0.0.1:5700')
  })

  test('preserves explicit API and credential path, normalizes optional self ID and deadline', () => {
    expect(normalizeRuntimeConfig({System: {
      ONE_BOT_PROVIDER: 'snowluma', ONE_BOT_API_URL: 'https://mock.invalid/api',
      ONE_BOT_CREDENTIALS_FILE: 'mock.credentials.json', ONE_BOT_SELF_ID: 12345,
      ONE_BOT_REQUEST_TIMEOUT_MS: '4200',
    }})).toMatchObject({ONE_BOT_API_URL: 'https://mock.invalid/api',
      ONE_BOT_CREDENTIALS_FILE: 'mock.credentials.json', ONE_BOT_SELF_ID: '12345', ONE_BOT_REQUEST_TIMEOUT_MS: 4200})
  })

  test.each([undefined, null, '', '   '])('empty self ID remains optional %#', (value) => {
    expect(normalizeRuntimeConfig({System: {ONE_BOT_SELF_ID: value}}).ONE_BOT_SELF_ID).toBeUndefined()
  })

  test.each([0, -5, '', 'invalid', Infinity, null])('invalid OneBot request timeout falls back %#', (value) => {
    const logger = {warn: jest.fn()}
    expect(normalizeRuntimeConfig({System: {ONE_BOT_REQUEST_TIMEOUT_MS: value}}, {logger})
      .ONE_BOT_REQUEST_TIMEOUT_MS).toBe(15000)
    expect(logger.warn).toHaveBeenCalledWith('ONE_BOT_REQUEST_TIMEOUT_MS 必须是正数，已回退到 15000')
  })

  test('preserves optional module deadlines and LLM configuration without changing defaults', () => {
    expect(normalizeRuntimeConfig({}).PLUGIN_TIMEOUTS).toEqual({})
    const llm = {provider: 'openai', model: 'gpt-6-luna'}
    expect(normalizeRuntimeConfig({System: {PLUGIN_TIMEOUTS: {ollama: 31000}}, llm})).toMatchObject({
      PLUGIN_TIMEOUT_MS: 8000, PLUGIN_TIMEOUTS: {ollama: 31000}, llm,
    })
  })
  test('official QQ stays opt-in and access configuration fails closed on invalid values', () => {
    expect(normalizeRuntimeConfig({}).QQ_GUILD_DIRECT_MESSAGE_SWITCH).toBe(false)
    expect(normalizeRuntimeConfig({qqBot: {QQ_GUILD_DIRECT_MESSAGE_SWITCH: true}}).QQ_GUILD_DIRECT_MESSAGE_SWITCH).toBe(true)
    expect(normalizeRuntimeConfig({qqBot: {QQ_GUILD_DIRECT_MESSAGE_SWITCH: 'true'}}).QQ_GUILD_DIRECT_MESSAGE_SWITCH).toBe(false)
    expect(normalizeRuntimeConfig({}).CONNECT_QQ_OFFICIAL_SWITCH).toBe(false)
    const config = normalizeRuntimeConfig({System: {CONNECT_QQ_OFFICIAL_SWITCH: true}, qqOfficial: {
      pluginAllowlist: [' ping ', 123, ''], access: {c2cMode: 'typo', groupMode: 'allowlist', groupAllow: [' group ']},
    }})
    expect(config.CONNECT_QQ_OFFICIAL_SWITCH).toBe(true)
    expect(config.QQ_OFFICIAL_PLUGIN_ALLOWLIST).toEqual(['ping'])
    expect(config.QQ_OFFICIAL_ACCESS).toMatchObject({c2cMode: 'disabled', groupMode: 'allowlist', groupAllow: ['group']})
    expect(normalizeRuntimeConfig({qqOfficial: {access: null}}).QQ_OFFICIAL_ACCESS.c2cMode).toBe('disabled')
    expect(normalizeRuntimeConfig({System: {CONNECT_QQ_OFFICIAL_SWITCH: 'false'}}).CONNECT_QQ_OFFICIAL_SWITCH).toBe(false)
  })
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
