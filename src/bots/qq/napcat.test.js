'use strict'

const {
  buildNapCatConfigFromRuntime,
  checkNapCatReadiness,
  createNapCatOneBotConfig,
  probeNapCat,
  verifyNapCatConnection,
} = require('./napcat')

describe('NapCat OneBot integration', () => {
  test('generates the HTTP API and event push configuration expected by ChatDACS', () => {
    const config = createNapCatOneBotConfig({
      apiUrl: '127.0.0.1:5700',
      callbackUrl: 'http://127.0.0.1:8080/bot',
    })

    expect(config.network.httpServers).toEqual([
      expect.objectContaining({
        enable: true,
        host: '127.0.0.1',
        port: 5700,
        messagePostFormat: 'string',
      }),
    ])
    expect(config.network.httpClients).toEqual([
      expect.objectContaining({
        enable: true,
        url: 'http://127.0.0.1:8080/bot',
        messagePostFormat: 'string',
        reportSelfMessage: false,
      }),
    ])
  })

  test('builds the callback URL from normalized ChatDACS runtime settings', () => {
    const config = buildNapCatConfigFromRuntime({
      config: {
        ONE_BOT_API_URL: '127.0.0.1:5700',
        ONE_BOT_ANTI_POST_API: '/onebot',
        WEB_PORT: 8080,
      },
      eventHost: 'host.docker.internal',
    })

    expect(config.network.httpClients[0].url).toBe('http://host.docker.internal:8080/onebot')
  })

  test('recognizes a compatible NapCat OneBot 11 endpoint', async () => {
    const axios = {
      get: jest.fn().mockResolvedValue({
        data: {
          status: 'ok',
          retcode: 0,
          data: {
            app_name: 'NapCatQQ',
            app_version: '4.18.9',
            protocol_version: 'v11',
          },
        },
      }),
    }

    const result = await probeNapCat({apiUrl: '127.0.0.1:5700', axios, timeoutMs: 1500})

    expect(axios.get).toHaveBeenCalledWith('http://127.0.0.1:5700/get_version_info', {timeout: 1500})
    expect(result).toEqual({
      reachable: true,
      compatible: true,
      appName: 'NapCatQQ',
      appVersion: '4.18.9',
      protocolVersion: 'v11',
    })
  })

  test('reports a reachable but incompatible OneBot implementation', async () => {
    const axios = {
      get: jest.fn().mockResolvedValue({
        data: {
          status: 'ok',
          data: {
            app_name: 'AnotherBot',
            app_version: '1.0.0',
            protocol_version: 'v12',
          },
        },
      }),
    }

    await expect(probeNapCat({apiUrl: 'http://onebot.local:5700/', axios})).resolves.toEqual(
      expect.objectContaining({reachable: true, compatible: false, appName: 'AnotherBot'}),
    )
  })

  test('keeps ChatDACS startable when NapCat is temporarily offline', async () => {
    const logger = {info: jest.fn(), warn: jest.fn()}
    const axios = {get: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))}

    const result = await verifyNapCatConnection({
      config: {ONE_BOT_API_URL: '127.0.0.1:5700', ONE_BOT_CONNECT_TIMEOUT_MS: 3000},
      axios,
      logger,
    })

    expect(result).toEqual(
      expect.objectContaining({reachable: false, compatible: false, error: 'connect ECONNREFUSED'}),
    )
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('NapCat'))
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('重启 ChatDACS'))
  })

  test('checks login state and group visibility without exposing account details', async () => {
    const axios = {
      get: jest
        .fn()
        .mockResolvedValueOnce({
          data: {
            status: 'ok',
            data: {app_name: 'NapCatQQ', app_version: '4.18.9', protocol_version: 'v11'},
          },
        })
        .mockResolvedValueOnce({data: {status: 'ok', data: {user_id: '10001', nickname: 'Bot'}}})
        .mockResolvedValueOnce({data: {status: 'ok', data: [{group_id: '1'}, {group_id: '2'}]}}),
    }

    const result = await checkNapCatReadiness({
      config: {ONE_BOT_API_URL: '127.0.0.1:5700', ONE_BOT_CONNECT_TIMEOUT_MS: 1000},
      axios,
    })

    expect(result).toEqual(
      expect.objectContaining({compatible: true, loggedIn: true, groupCount: 2}),
    )
    expect(result).not.toHaveProperty('userId')
    expect(result).not.toHaveProperty('nickname')
  })
})
