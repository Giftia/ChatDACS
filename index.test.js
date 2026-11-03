const {ChatProcess} = require('./src/core/chat.js')
const utils = require('./plugins/system/utils.js')

jest.mock('canvas', () => ({}))
jest.mock('play-sound', () => () => ({play: jest.fn()}))
jest.mock('trayicon', () => ({}))
jest.mock('lib-qqwry', () => () => ({
  searchIP: jest.fn(() => ({Country: '测试'})),
}))
jest.mock('bilibili-live-ws', () => ({KeepLiveTCP: jest.fn()}))
jest.mock('qq-guild-bot', () => ({
  createOpenAPI: jest.fn(),
  createWebsocket: jest.fn(),
}))
jest.mock('node-telegram-bot-api', () => jest.fn())
jest.mock('./plugins/system/utils.js', () => ({
  FullContentSearchAnswer: jest.fn(), FuzzyContentSearchAnswer: jest.fn(), ChatJiebaFuzzy: jest.fn(),
  PerfunctoryAnswer: jest.fn(), ConfigureRuntime: jest.fn(), InitGroupList: jest.fn(async () => true),
  GetGroupPluginStatus: jest.fn(), ToggleGroupPlugin: jest.fn(),
}))
jest.mock('fs', () => ({
  readFile: jest.fn(), readFileSync: jest.fn(() => { throw new Error('Unexpected file access') }),
}))
jest.mock('child_process', () => ({exec: jest.fn(() => { throw new Error('Unexpected process launch') })}))
jest.mock('axios', () => ({default: {
  get: jest.fn(async () => ({status: 200, data: {status: 'ok', retcode: 0, tag_name: 'v4.0.0'}})),
  post: jest.fn(async () => ({status: 200, data: {status: 'ok', retcode: 0}})),
  defaults: {headers: {common: {Accept: 'mock-accept'}}}, interceptors: {request: {use: jest.fn()}},
}}))
jest.mock('request', () => jest.fn(() => { throw new Error('Unexpected request access') }))
jest.mock('nodejs-jieba', () => ({load: jest.fn(), extract: jest.fn()}))
jest.mock('node-schedule', () => ({scheduleJob: jest.fn()}))
jest.mock('wallpaper', () => ({}))
jest.mock('select-random-file', () => jest.fn())
jest.mock('rss-parser', () => jest.fn())
jest.mock('require.all', () => jest.fn())
jest.mock('semver-diff', () => jest.fn())
jest.mock('yaml', () => ({parse: jest.fn()}))
jest.mock('winston', () => ({
  format: Object.fromEntries(['printf', 'combine', 'timestamp', 'errors', 'json', 'colorize'].map((key) => [key, jest.fn()])),
  transports: {Console: jest.fn(), Http: jest.fn(), File: jest.fn()}, addColors: jest.fn(),
  createLogger: jest.fn(() => ({info: jest.fn(), warn: jest.fn(), error: jest.fn()})),
}))
jest.mock('./plugins/danceCube/authorization.json', () => ({authorization: 'mock-auth', baiduGeocodingAk: 'mock-ak'}))
jest.mock('./plugins/system/model/database.js', () => ({sequelize: {close: jest.fn()}}))
jest.mock('./src/core/migrations', () => ({runMigrations: jest.fn(async () => ({applied: [], baselined: []}))}))
jest.mock('./src/config/runtimeConfig', () => ({normalizeRuntimeConfig: jest.fn((config) => config)}))
jest.mock('./src/plugins/conversationState', () => ({createConversationPluginStateStore: jest.fn(() => ({}))}))
jest.mock('./src/plugins/runtime.js', () => ({createPluginRuntime: jest.fn(() => ({load: jest.fn(() => ({})), execute: jest.fn()}))}))
jest.mock('./src/bots/qq', () => ({StartQQBot: jest.fn(), configureQQRuntime: jest.fn(), sendMessageToQQGroup: jest.fn()}))
jest.mock('./src/bots/qqOfficial', () => ({startQQOfficial: jest.fn()}))
jest.mock('./src/bots/qq/oneBotProvider', () => ({verifyOneBotConnection: jest.fn()}))
jest.mock('./src/bots/bilibili', () => ({StartLive: jest.fn()}))
jest.mock('./src/bots/qqGuild', () => ({StartQQGuild: jest.fn(), ProcessGuildMessage: jest.fn()}))
jest.mock('./src/bots/telegram', () => ({StartTelegram: jest.fn()}))
jest.mock('./src/core/processErrors', () => ({registerProcessErrorHandlers: jest.fn()}))
jest.mock('./src/server.js', () => ({
  startServer: jest.fn(), app: {post: jest.fn()}, io: {emit: jest.fn(), close: jest.fn((done) => done())},
  http: {once: jest.fn(), close: jest.fn((done) => done())},
}))
jest.mock('./src/platforms/oneBotHttp', () => {
  const actual = jest.requireActual('./src/platforms/oneBotHttp')
  return {
    ...actual,
    readOneBotAccessToken: jest.fn(() => 'mock-token'),
    createOneBotHttpClient: jest.fn(({axios, config}) => actual.createOneBotHttpClient({
      axios, config, env: {CHATDACS_ONEBOT_ACCESS_TOKEN: 'mock-token'},
      readFileSync: () => { throw new Error('Unexpected credentials access') },
    })),
  }
})

describe('ChatProcess', () => {
  let logSpy

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
    logSpy.mockRestore()
  })

  test('should return full content search answer if found', async () => {
    const mockAnswer = 'this is a full match'
    utils.FullContentSearchAnswer.mockResolvedValue(mockAnswer)

    const result = await ChatProcess('test ask')
    expect(result).toBe(mockAnswer)
    expect(utils.FullContentSearchAnswer).toHaveBeenCalledWith('test ask')
    expect(utils.FuzzyContentSearchAnswer).not.toHaveBeenCalled()
  })

  test('should return fuzzy content search answer if full search fails', async () => {
    const mockAnswer = 'this is a fuzzy match'
    utils.FullContentSearchAnswer.mockResolvedValue(null)
    utils.FuzzyContentSearchAnswer.mockResolvedValue(mockAnswer)

    const result = await ChatProcess('test ask')
    expect(result).toBe(mockAnswer)
    expect(utils.FullContentSearchAnswer).toHaveBeenCalledWith('test ask')
    expect(utils.FuzzyContentSearchAnswer).toHaveBeenCalledWith('test ask')
  })

  test('should return perfunctory answer as a last resort', async () => {
    const mockAnswer = 'this is a perfunctory answer'
    utils.FullContentSearchAnswer.mockResolvedValue(null)
    utils.FuzzyContentSearchAnswer.mockResolvedValue(null)
    utils.ChatJiebaFuzzy.mockResolvedValue([])
    utils.PerfunctoryAnswer.mockResolvedValue(mockAnswer)

    const result = await ChatProcess('unmatched phrase')
    expect(result).toBe(mockAnswer)
    expect(utils.PerfunctoryAnswer).toHaveBeenCalled()
  })

  test('should return a jieba fuzzy candidate before perfunctory fallback', async () => {
    const mockAnswer = 'this is a jieba fuzzy candidate'
    utils.FullContentSearchAnswer.mockResolvedValue(null)
    utils.FuzzyContentSearchAnswer.mockResolvedValue(null)
    utils.ChatJiebaFuzzy.mockResolvedValue([mockAnswer])

    const result = await ChatProcess('partially matched phrase')
    expect(result).toBe(mockAnswer)
    expect(utils.PerfunctoryAnswer).not.toHaveBeenCalled()
  })
})

describe('index module startup guard', () => {
  // Capture import-time construction before other tests clear mock call history.
  require('./index')
  const winston = require('winston')
  const transportSetup = {
    httpCount: winston.transports.Http.mock.calls.length,
    consoleCount: winston.transports.Console.mock.calls.length,
    files: winston.transports.File.mock.calls.map(([options]) => ({...options})),
    count: winston.createLogger.mock.calls.at(-1)[0].transports.length,
  }
  test('default logger has only Console and local files, never an unconfigured HTTP sink', () => {
    expect(transportSetup.httpCount).toBe(0)
    expect(transportSetup.consoleCount).toBe(1)
    expect(transportSetup.files).toEqual([{filename: 'error.log', level: 'error'}, {filename: 'combined.log'}])
    expect(transportSetup.count).toBe(3)
  })

  test('should export startup functions without starting the app when required', () => {
    const indexModule = require('./index.js')

    expect(indexModule.main).toEqual(expect.any(Function))
    expect(indexModule.InitConfig).toEqual(expect.any(Function))
    expect(indexModule.ProcessExecute).toEqual(expect.any(Function))
    expect(indexModule.RunMigration).toEqual(expect.any(Function))
    expect(require('fs').readFile).not.toHaveBeenCalled()
    expect(require('fs').readFileSync).not.toHaveBeenCalled()
    expect(require('./src/server').startServer).not.toHaveBeenCalled()
    expect(require('./src/core/migrations').runMigrations).not.toHaveBeenCalled()
    expect(require('./src/bots/qq').StartQQBot).not.toHaveBeenCalled()
    expect(require('./src/bots/qqOfficial').startQQOfficial).not.toHaveBeenCalled()
    expect(require('child_process').exec).not.toHaveBeenCalled()
    expect(require('axios').default.get).not.toHaveBeenCalled()
  })

  test('should expose DanceCube credentials through plugin dependencies', () => {
    const indexModule = require('./index.js')
    const dependencies = indexModule.createPluginDependencies({emit: jest.fn()})

    expect(typeof dependencies.authorization).toBe('string')
    expect(typeof dependencies.baiduGeocodingAk).toBe('string')
  })

  test('should use an explicitly provided runtime config for plugin dependencies', () => {
    const indexModule = require('./index.js')
    const runtimeConfig = {WEB_PORT: 18080, TIAN_XING_API_KEY: 'test-key'}

    const dependencies = indexModule.createPluginDependencies({emit: jest.fn()}, runtimeConfig)

    expect(dependencies.config).toBe(runtimeConfig)
  })
})

describe('index adapter and scoped-client integration', () => {
  const indexModule = require('./index')
  const axios = require('axios').default
  const qq = require('./src/bots/qq')
  const official = require('./src/bots/qqOfficial')
  const legacy = [
    ['bilibili', require('./src/bots/bilibili').StartLive, 'CONNECT_BILIBILI_LIVE_SWITCH'],
    ['guild', require('./src/bots/qqGuild').StartQQGuild, 'CONNECT_QQ_GUILD_SWITCH'],
    ['telegram', require('./src/bots/telegram').StartTelegram, 'CONNECT_TELEGRAM_SWITCH'],
  ]
  const allAdapters = {CONNECT_QQ_OFFICIAL_SWITCH: true, CONNECT_BILIBILI_LIVE_SWITCH: true,
    CONNECT_QQ_GUILD_SWITCH: true, CONNECT_TELEGRAM_SWITCH: true}
  let legacyStops
  let qqStop, officialStop, dispose, logSpy

  async function configure(overrides = {}) {
    const config = {ONE_BOT_API_URL: 'mock.invalid:5700', ONE_BOT_ANTI_POST_API: '/mock',
      ONE_BOT_PROVIDER: 'generic', CONNECT_ONE_BOT_SWITCH: true, ...overrides}
    require('fs').readFile.mockImplementation((_path, _encoding, callback) => callback(null, 'mock-config'))
    require('yaml').parse.mockReturnValue(config)
    return indexModule.InitConfig()
  }

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    qqStop = jest.fn(async () => {})
    officialStop = jest.fn(async () => {})
    dispose = jest.fn()
    qq.StartQQBot.mockResolvedValue({stop: qqStop})
    official.startQQOfficial.mockResolvedValue({stop: officialStop})
    legacyStops = Object.fromEntries(legacy.map(([name, start]) => {
      const stop = jest.fn(async () => {})
      start.mockReset().mockResolvedValue({stop})
      return [name, stop]
    }))
    require('./src/bots/qq/oneBotProvider').verifyOneBotConnection.mockReset()
    require('./src/core/processErrors').registerProcessErrorHandlers.mockReturnValue({dispose})
  })

  afterEach(() => {
    expect(require('fs').readFileSync).not.toHaveBeenCalled()
    expect(require('child_process').exec).not.toHaveBeenCalled()
    logSpy.mockRestore()
    jest.useRealTimers()
  })

  test('plugin dependencies use an isolated client without mutating axios or request options', async () => {
    const config = await configure()
    const get = axios.get
    const defaults = JSON.stringify(axios.defaults)
    const dependencies = indexModule.createPluginDependencies({emit: jest.fn()}, config)
    const options = {headers: {'X-Mock': 'unchanged'}}
    expect(dependencies.axios).not.toBe(axios)
    expect(dependencies.config).toBe(config)
    await dependencies.axios.get('http://mock.invalid:5700/get_login_info', options)
    expect(get).toHaveBeenLastCalledWith('http://mock.invalid:5700/get_login_info', expect.objectContaining({
      headers: {'X-Mock': 'unchanged', Authorization: 'Bearer mock-token'}, maxRedirects: 0,
    }))
    expect(options).toEqual({headers: {'X-Mock': 'unchanged'}})
    expect(axios.get).toBe(get)
    expect(JSON.stringify(axios.defaults)).toBe(defaults)
    expect(axios.interceptors.request.use).not.toHaveBeenCalled()
    await axios.get('http://mock.invalid:5700/get_login_info')
    expect(get.mock.calls.at(-1)).toEqual(['http://mock.invalid:5700/get_login_info'])
    const other = indexModule.createPluginDependencies({}, {...config, ONE_BOT_API_URL: 'other.invalid:5700'})
    await other.axios.get('http://mock.invalid:5700/get_login_info', options)
    expect(get.mock.calls.at(-1)).toEqual(['http://mock.invalid:5700/get_login_info', options])
    expect(jest.getTimerCount()).toBe(0)
  })

  test('configured adapters receive the scoped client and stop both QQ and official', async () => {
    const config = await configure()
    const controller = await indexModule.StartConfiguredAdapters({app: {}, io: {}, config})
    const args = qq.StartQQBot.mock.calls[0][0]
    expect(args.config).toBe(config)
    expect(args.axios).not.toBe(axios)
    await args.axios.post('http://mock.invalid:5700/send_group_forward_msg', {mock: true})
    expect(axios.post).toHaveBeenCalledWith(expect.any(String), {mock: true}, expect.objectContaining({
      headers: {Authorization: 'Bearer mock-token'},
    }))
    const probe = require('./src/bots/qq/oneBotProvider').verifyOneBotConnection
    expect(probe).toHaveBeenCalledWith({config, axios, logger: expect.any(Object)})
    expect(qq.StartQQBot.mock.invocationCallOrder[0]).toBeLessThan(probe.mock.invocationCallOrder[0])
    await controller.stop()
    expect(qqStop).toHaveBeenCalledTimes(1)
    expect(officialStop).toHaveBeenCalledTimes(1)
  })

  test('official still stops when QQ stop rejects', async () => {
    const config = await configure()
    const controller = await indexModule.StartConfiguredAdapters({app: {}, io: {}, config})
    qqStop.mockRejectedValueOnce(new Error('mock QQ stop failure'))
    await expect(controller.stop()).rejects.toThrow('ADAPTER_STOP_FAILED')
    expect(officialStop).toHaveBeenCalledTimes(1)
  })

  test('official stops when the QQ adapter is disabled', async () => {
    const config = await configure({CONNECT_ONE_BOT_SWITCH: false})
    const controller = await indexModule.StartConfiguredAdapters({app: {}, io: {}, config})
    expect(qq.StartQQBot).not.toHaveBeenCalled()
    await controller.stop()
    expect(officialStop).toHaveBeenCalledTimes(1)
  })

  test.each(['snowluma', 'napcat'])('configured %s probes after QQ startup', async (provider) => {
    const config = await configure({ONE_BOT_PROVIDER: provider})
    const probe = require('./src/bots/qq/oneBotProvider').verifyOneBotConnection
    const controller = await indexModule.StartConfiguredAdapters({app: {}, io: {}, config})
    expect(probe).toHaveBeenCalledWith({config, axios, logger: expect.any(Object)})
    expect(qq.StartQQBot.mock.invocationCallOrder[0]).toBeLessThan(probe.mock.invocationCallOrder[0])
    await controller.stop()
  })

  test.each([
    [{ERROR_NOTIFY_GROUP_ID: '123456'}, true],
    [{ERROR_NOTIFY_GROUP_ID: 'not-a-group'}, false],
    [{ERROR_NOTIFY_GROUP_ID: '123456', CONNECT_ONE_BOT_SWITCH: false}, false],
  ])('main wires mock server close and configured error notification (%j)', async (overrides, notify) => {
    await configure(overrides)
    await indexModule.main()
    const server = require('./src/server')
    expect(server.startServer).toHaveBeenCalledTimes(1)
    const options = require('./src/core/processErrors').registerProcessErrorHandlers.mock.calls[0][0]
    expect(typeof options.notifyAdmin === 'function').toBe(notify)
    if (notify) {
      await options.notifyAdmin({code: 'MOCK_ERROR'})
      expect(qq.sendMessageToQQGroup).toHaveBeenCalledWith('系统处理失败 (MOCK_ERROR)', {group_id: '123456'})
    }
    expect(server.http.once).toHaveBeenCalledWith('close', expect.any(Function))
    server.http.once.mock.calls[0][1]()
    await jest.advanceTimersByTimeAsync(0)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(officialStop).toHaveBeenCalledTimes(1)
    expect(qqStop).toHaveBeenCalledTimes(overrides.CONNECT_ONE_BOT_SWITCH === false ? 0 : 1)
  })

  test('real QQ stop keeps its webhook route but blocks queued and subsequent business dispatch', async () => {
    const {StartQQBot} = jest.requireActual('./src/bots/qq')
    const app = {post: jest.fn()}
    const logger = {info: jest.fn(), error: jest.fn()}
    const io = {emit: jest.fn()}
    const processExecute = jest.fn()
    const chatProcess = jest.fn()
    const controller = await StartQQBot({config: {ONE_BOT_API_URL: 'mock.invalid:5700', ONE_BOT_ANTI_POST_API: '/mock'},
      app, logger, io, utils, processExecute, chatProcess, axios})
    const route = app.post.mock.calls[0][1]
    const req = {headers: {authorization: 'Bearer mock-token'}, body: {message_type: 'group', sub_type: 'normal'}}
    const res = {status: jest.fn().mockReturnThis(), end: jest.fn()}
    route(req, res)
    controller.stop()
    route(req, res)
    await jest.advanceTimersByTimeAsync(0)
    expect(app.post).toHaveBeenCalledTimes(1)
    expect(res.status.mock.calls).toEqual([[204], [503]])
    expect(processExecute).not.toHaveBeenCalled()
    expect(chatProcess).not.toHaveBeenCalled()
    expect(io.emit).not.toHaveBeenCalled()
    expect(axios.get).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith('ONEBOT_NOT_READY')
    expect(jest.getTimerCount()).toBe(0)
  })

  test('probe failure is observable without losing the adapter controller or Web startup', async () => {
    await configure()
    require('./src/bots/qq/oneBotProvider').verifyOneBotConnection.mockRejectedValueOnce(new Error('SECRET url'))
    await expect(indexModule.main()).resolves.toMatchObject({stop: expect.any(Function)})
    const server = require('./src/server')
    expect(server.startServer).toHaveBeenCalledTimes(1)
    const logger = qq.StartQQBot.mock.calls[0][0].logger
    expect(logger.warn).toHaveBeenCalledWith('ONEBOT_PROBE_FAILED')
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('SECRET')
    server.http.once.mock.calls[0][1]()
    await jest.advanceTimersByTimeAsync(0)
    expect(qqStop).toHaveBeenCalledTimes(1)
    expect(officialStop).toHaveBeenCalledTimes(1)
  })

  test('main close catches stop rejection after disposing handlers without logging the original error', async () => {
    await configure()
    await indexModule.main()
    qqStop.mockRejectedValueOnce(new Error('SECRET shutdown transport payload'))
    require('./src/server').http.once.mock.calls[0][1]()
    expect(dispose).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(0)
    expect(qqStop).toHaveBeenCalledTimes(1)
    expect(officialStop).toHaveBeenCalledTimes(1)
    const logger = qq.StartQQBot.mock.calls[0][0].logger
    expect(logger.error).toHaveBeenCalledWith('ADAPTER_STOP_FAILED')
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('SECRET')
    expect(dispose.mock.invocationCallOrder[0]).toBeLessThan(qqStop.mock.invocationCallOrder[0])
  })

  test.each(['success', 'false', 'reject'])('QQ webhook exists during initialization and handles %s readiness', async (result) => {
    const {StartQQBot} = jest.requireActual('./src/bots/qq')
    const app = {post: jest.fn()}
    const logger = {info: jest.fn(), error: jest.fn()}
    const processExecute = jest.fn()
    const chatProcess = jest.fn()
    let resolve, reject
    const init = new Promise((yes, no) => { resolve = yes; reject = no })
    const localUtils = {InitGroupList: jest.fn(() => init)}
    const pending = StartQQBot({config: {ONE_BOT_API_URL: 'mock.invalid:5700', ONE_BOT_ANTI_POST_API: '/mock'},
      app, logger, io: {emit: jest.fn()}, utils: localUtils, processExecute, chatProcess, axios})
    expect(app.post).toHaveBeenCalledWith('/mock', expect.any(Function))
    const route = app.post.mock.calls[0][1]
    const req = {headers: {authorization: 'Bearer mock-token'}, body: {sub_type: 'ignored'}}
    const response = () => ({status: jest.fn().mockReturnThis(), end: jest.fn()})
    const early = response()
    route(req, early)
    expect(early.status).toHaveBeenCalledWith(503)
    if (result === 'reject') reject(new Error('SECRET init payload'))
    else resolve(result === 'success')
    const controller = await pending
    const settled = response()
    route(req, settled)
    expect(settled.status).toHaveBeenCalledWith(result === 'success' ? 204 : 503)
    controller.stop()
    const stopped = response()
    route(req, stopped)
    expect(stopped.status).toHaveBeenCalledWith(503)
    await jest.advanceTimersByTimeAsync(0)
    expect(processExecute).not.toHaveBeenCalled()
    expect(chatProcess).not.toHaveBeenCalled()
    expect(axios.get).not.toHaveBeenCalled()
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('SECRET')
  })

  test('main optional DI isolates config, merges plugin overrides and suppresses only opted-out update checks', async () => {
    await configure()
    const trayicon = {create: jest.fn()}
    const controller = await indexModule.main({configPath: 'fixture/shadow.yml',
      pluginDependencyOverrides: {trayicon}, checkUpdates: false})
    expect(require('fs').readFile).toHaveBeenLastCalledWith('fixture/shadow.yml', 'utf8', expect.any(Function))
    const dependencies = require('./src/plugins/runtime').createPluginRuntime.mock.calls.at(-1)[0].dependencies
    expect(dependencies.trayicon).toBe(trayicon)
    expect(dependencies.utils).toBe(utils)
    expect(dependencies.axios).not.toBe(axios)
    expect(axios.get).not.toHaveBeenCalled()
    const first = controller.stop()
    expect(controller.stop()).toBe(first)
    await first
    expect(qqStop).toHaveBeenCalledTimes(1)
    expect(officialStop).toHaveBeenCalledTimes(1)
    expect(require('./src/server').io.close).toHaveBeenCalledTimes(1)
    expect(require('./src/server').http.close).toHaveBeenCalledTimes(1)
    expect(require('./plugins/system/model/database').sequelize.close).toHaveBeenCalledTimes(1)
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  test.each(['adapter', 'official', 'socket', 'http', 'handlers', 'database'])('stop cleans remaining resources after %s failure and returns only safe errors', async (phase) => {
    await configure()
    const controller = await indexModule.main({checkUpdates: false})
    const server = require('./src/server')
    const db = require('./plugins/system/model/database').sequelize
    const error = new Error('SECRET cleanup URL')
    if (phase === 'adapter') qqStop.mockRejectedValueOnce(error)
    if (phase === 'official') officialStop.mockRejectedValueOnce(error)
    if (phase === 'socket') server.io.close.mockImplementationOnce(() => { throw error })
    if (phase === 'http') server.http.close.mockImplementationOnce((done) => done(error))
    if (phase === 'handlers') dispose.mockImplementationOnce(() => { throw error })
    if (phase === 'database') db.close.mockRejectedValueOnce(error)
    await expect(controller.stop()).rejects.toThrow('APP_STOP_FAILED')
    expect(officialStop).toHaveBeenCalledTimes(1)
    expect(server.io.close).toHaveBeenCalledTimes(1)
    expect(server.http.close).toHaveBeenCalledTimes(1)
    expect(db.close).toHaveBeenCalledTimes(1)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(qq.StartQQBot.mock.calls[0][0].logger.error.mock.calls)).not.toContain('SECRET')
  })

  test('startup failure closes the owned database and does not leak its original error', async () => {
    await configure()
    require('./src/plugins/runtime').createPluginRuntime.mockImplementationOnce(() => { throw new Error('SECRET init') })
    await expect(indexModule.main({checkUpdates: false})).rejects.toThrow('APP_START_FAILED')
    expect(require('./src/server').io.close).toHaveBeenCalledTimes(1)
    expect(require('./plugins/system/model/database').sequelize.close).toHaveBeenCalledTimes(1)
  })

  test('QQ startup failure degrades without closing Web or an already created official controller', async () => {
    await configure()
    qq.StartQQBot.mockRejectedValueOnce(new Error('SECRET startup URL'))
    const controller = await indexModule.main({checkUpdates: false})
    expect(officialStop).not.toHaveBeenCalled()
    expect(require('./src/server').http.close).not.toHaveBeenCalled()
    await controller.stop()
    expect(officialStop).toHaveBeenCalledTimes(1)
    expect(require('./src/server').io.close).toHaveBeenCalledTimes(1)
    expect(require('./src/server').http.close).toHaveBeenCalledTimes(1)
    expect(require('./plugins/system/model/database').sequelize.close).toHaveBeenCalledTimes(1)
  })

  test('default main still checks updates and tolerates already-closed Socket/HTTP servers', async () => {
    await configure()
    const controller = await indexModule.main()
    expect(axios.get).toHaveBeenCalledWith('https://api.github.com/repos/Giftia/ChatDACS/releases/latest', {timeout: 8000})
    const closed = Object.assign(new Error('closed'), {code: 'ERR_SERVER_NOT_RUNNING'})
    controller.io.close.mockImplementationOnce((done) => done(closed))
    controller.http.close.mockImplementationOnce((done) => done(closed))
    await expect(controller.stop()).resolves.toBeUndefined()
  })

  test('ReadConfig accepts a path without initializing global runtime state', async () => {
    await configure()
    utils.ConfigureRuntime.mockClear()
    await indexModule.ReadConfig('fixture/only-read.yml')
    expect(require('fs').readFile).toHaveBeenLastCalledWith('fixture/only-read.yml', 'utf8', expect.any(Function))
    expect(utils.ConfigureRuntime).not.toHaveBeenCalled()
  })

  test('close during adapter startup waits for and stops the late controller before closing its database', async () => {
    await configure()
    let release
    qq.StartQQBot.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const starting = indexModule.main({checkUpdates: false})
    await jest.advanceTimersByTimeAsync(0)
    expect(release).toEqual(expect.any(Function))
    require('./src/server').http.once.mock.calls[0][1]()
    await jest.advanceTimersByTimeAsync(0)
    const db = require('./plugins/system/model/database').sequelize
    expect(db.close).not.toHaveBeenCalled()
    release({stop: qqStop})
    const controller = await starting
    await controller.stop()
    expect(qqStop).toHaveBeenCalledTimes(1)
    expect(officialStop).toHaveBeenCalledTimes(1)
    expect(db.close).toHaveBeenCalledTimes(1)
  })

  test('main tracks every enabled adapter and stops each controller exactly once', async () => {
    const config = await configure(allAdapters)
    const controller = await indexModule.main({checkUpdates: false})
    for (const [, start] of legacy) {
      expect(start).toHaveBeenCalledWith(expect.objectContaining({config}))
    }
    const pending = controller.stop()
    expect(controller.stop()).toBe(pending)
    await pending
    for (const stop of [qqStop, officialStop, ...Object.values(legacyStops)]) expect(stop).toHaveBeenCalledTimes(1)
    expect(require('./src/server').io.close).toHaveBeenCalledTimes(1)
    expect(require('./plugins/system/model/database').sequelize.close).toHaveBeenCalledTimes(1)
  })

  test.each(['bilibili', 'guild', 'telegram'])('awaits %s startup before returning the aggregate controller', async (name) => {
    const config = await configure(allAdapters)
    const [, start] = legacy.find(([key]) => key === name)
    let release, returned = false
    start.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const starting = indexModule.StartConfiguredAdapters({app: {}, io: {}, config}).then((controller) => {
      returned = true
      return controller
    })
    await jest.advanceTimersByTimeAsync(0)
    expect(release).toEqual(expect.any(Function))
    expect(returned).toBe(false)
    release({stop: legacyStops[name]})
    const controller = await starting
    await controller.stop()
    expect(legacyStops[name]).toHaveBeenCalledTimes(1)
  })

  test.each(['official', 'qq', 'bilibili', 'guild', 'telegram'])('%s startup rejection preserves Web and continues starting other adapters', async (name) => {
    await configure(allAdapters)
    const start = name === 'official' ? official.startQQOfficial :
      name === 'qq' ? qq.StartQQBot : legacy.find(([key]) => key === name)[1]
    start.mockRejectedValueOnce(new Error('SECRET startup transport token=PRIVATE'))
    const controller = await indexModule.main({checkUpdates: false})
    const stops = {official: officialStop, qq: qqStop, ...legacyStops}
    expect(require('./src/server').startServer).toHaveBeenCalledTimes(1)
    expect(controller.http).toBe(require('./src/server').http)
    expect(require('./src/server').http.close).not.toHaveBeenCalled()
    expect(require('./plugins/system/model/database').sequelize.close).not.toHaveBeenCalled()
    for (const stop of Object.values(stops)) expect(stop).not.toHaveBeenCalled()
    for (const [, factory] of legacy) expect(factory).toHaveBeenCalledTimes(1)
    expect(official.startQQOfficial).toHaveBeenCalledTimes(1)
    expect(qq.StartQQBot).toHaveBeenCalledTimes(1)
    const codes = {official: 'QQ_OFFICIAL_START_FAILED', qq: 'QQ_START_FAILED', bilibili: 'BILIBILI_START_FAILED',
      guild: 'QQ_GUILD_START_FAILED', telegram: 'TELEGRAM_START_FAILED'}
    const logger = qq.StartQQBot.mock.calls[0][0].logger
    expect(logger.error).toHaveBeenCalledWith(codes[name])
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/SECRET|PRIVATE/)
    await controller.stop()
    for (const [key, stop] of Object.entries(stops)) expect(stop).toHaveBeenCalledTimes(key === name ? 0 : 1)
    expect(require('./src/server').io.close).toHaveBeenCalledTimes(1)
    expect(require('./src/server').http.close).toHaveBeenCalledTimes(1)
    expect(require('./plugins/system/model/database').sequelize.close).toHaveBeenCalledTimes(1)
  })

  test.each(['official', 'qq', 'bilibili', 'guild', 'telegram'])('%s stop failure cannot skip another controller or main cleanup', async (name) => {
    await configure(allAdapters)
    const controller = await indexModule.main({checkUpdates: false})
    const stops = {official: officialStop, qq: qqStop, ...legacyStops}
    stops[name].mockRejectedValueOnce(new Error('SECRET stop body'))
    const pending = controller.stop()
    expect(controller.stop()).toBe(pending)
    await expect(pending).rejects.toThrow('APP_STOP_FAILED')
    for (const stop of Object.values(stops)) expect(stop).toHaveBeenCalledTimes(1)
    expect(require('./src/server').io.close).toHaveBeenCalledTimes(1)
    expect(require('./src/server').http.close).toHaveBeenCalledTimes(1)
    expect(require('./plugins/system/model/database').sequelize.close).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(qq.StartQQBot.mock.calls[0][0].logger.error.mock.calls)).not.toContain('SECRET')
  })

  test('aggregate stop is idempotent, awaits async stops and cleans controllers in reverse startup order', async () => {
    const config = await configure(allAdapters)
    const controller = await indexModule.StartConfiguredAdapters({app: {}, io: {}, config})
    let release
    legacyStops.telegram.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const pending = controller.stop()
    expect(controller.stop()).toBe(pending)
    await jest.advanceTimersByTimeAsync(0)
    expect(legacyStops.guild).not.toHaveBeenCalled()
    release()
    await pending
    expect(controller.stop()).toBe(pending)
    const ordered = [legacyStops.telegram, legacyStops.guild, legacyStops.bilibili, qqStop, officialStop]
    for (let i = 0; i < ordered.length; i++) {
      expect(ordered[i]).toHaveBeenCalledTimes(1)
      if (i) expect(ordered[i - 1].mock.invocationCallOrder[0]).toBeLessThan(ordered[i].mock.invocationCallOrder[0])
    }
  })

  test('partial startup cleanup continues even if one already-started controller fails to stop', async () => {
    await configure(allAdapters)
    legacy[2][1].mockResolvedValueOnce(undefined)
    legacyStops.guild.mockRejectedValueOnce(new Error('SECRET guild stop'))
    await expect(indexModule.main({checkUpdates: false})).rejects.toThrow('APP_START_FAILED')
    for (const stop of [officialStop, qqStop, legacyStops.bilibili, legacyStops.guild]) {
      expect(stop).toHaveBeenCalledTimes(1)
    }
    expect(legacyStops.telegram).not.toHaveBeenCalled()
    expect(require('./plugins/system/model/database').sequelize.close).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(qq.StartQQBot.mock.calls[0][0].logger.error.mock.calls)).not.toContain('SECRET')
  })

  test('an enabled adapter without a stop controller fails explicitly instead of reporting complete ownership', async () => {
    await configure(allAdapters)
    legacy[0][1].mockResolvedValueOnce(undefined)
    await expect(indexModule.main({checkUpdates: false})).rejects.toThrow('APP_START_FAILED')
    expect(qqStop).toHaveBeenCalledTimes(1)
    expect(officialStop).toHaveBeenCalledTimes(1)
    expect(legacy[1][1]).not.toHaveBeenCalled()
    expect(legacy[2][1]).not.toHaveBeenCalled()
  })

  test('synchronous platform constructor failure also degrades without hiding later adapters', async () => {
    await configure(allAdapters)
    legacy[0][1].mockImplementationOnce(() => { throw new Error('SECRET constructor') })
    const controller = await indexModule.main({checkUpdates: false})
    expect(legacy[1][1]).toHaveBeenCalledTimes(1)
    expect(legacy[2][1]).toHaveBeenCalledTimes(1)
    expect(require('./src/server').http.close).not.toHaveBeenCalled()
    await controller.stop()
    expect(legacyStops.bilibili).not.toHaveBeenCalled()
    expect(legacyStops.telegram).toHaveBeenCalledTimes(1)
  })

  test('internal orchestration errors remain fail-fast and clean acquired controllers', async () => {
    const config = await configure(allAdapters)
    Object.defineProperty(config, 'CONNECT_QQ_GUILD_SWITCH', {get() { throw new Error('SECRET internal error') }})
    await expect(indexModule.main({checkUpdates: false})).rejects.toThrow('APP_START_FAILED')
    for (const stop of [officialStop, qqStop, legacyStops.bilibili]) expect(stop).toHaveBeenCalledTimes(1)
    expect(legacy[1][1]).not.toHaveBeenCalled()
    expect(legacy[2][1]).not.toHaveBeenCalled()
    expect(require('./plugins/system/model/database').sequelize.close).toHaveBeenCalledTimes(1)
  })
})
