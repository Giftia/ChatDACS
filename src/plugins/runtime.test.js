const fs = require('fs')
const os = require('os')
const path = require('path')

const {createPluginRuntime, normalizePluginReturn} = require('./runtime')
const {createTesterRuntime, run: runPluginTester} = require('../../plugin_tester')

function makePluginDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-plugins-'))
  for (const [fileName, source] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, fileName), source, 'utf8')
  }
  return dir
}

function makeLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}

describe('plugin runtime', () => {
  let pluginDirs = []

  test('LLM fallback keeps plugin status and explicit command matching separate', async () => {
    const pluginDir = makePluginDir({'ollama.js': `module.exports = {
      插件名: 'LLM', 指令: '^小夜', execute() { return 'explicit' },
      executeFallback() { return 'fallback' }
    }`})
    pluginDirs.push(pluginDir)
    const enabled = createPluginRuntime({pluginDir, logger: makeLogger()})
    enabled.load()
    expect((await enabled.execute({text: 'ordinary', platform: 'napcat'})).handled).toBe(false)
    expect((await enabled.executeFallback({text: 'ordinary', platform: 'napcat'})).content).toBe('fallback')
    const disabled = createPluginRuntime({pluginDir, logger: makeLogger(), getPluginStatus: async () => false})
    disabled.load()
    expect((await disabled.executeFallback({text: 'ordinary', platform: 'napcat'})).content).toContain('已关闭')
    expect((await enabled.executeFallback({text: 'ordinary', platform: 'qqOfficial'})).handled).toBe(false)
  })

  afterEach(() => {
    for (const pluginDir of pluginDirs) {
      fs.rmSync(pluginDir, {recursive: true, force: true})
    }
    pluginDirs = []
    jest.clearAllMocks()
  })

  test('loads valid plugins and reports invalid metadata without blocking init failures', () => {
    const pluginDir = makePluginDir({
      'ping.js': `
        module.exports = {
          插件名: 'Ping',
          指令: '^/ping$',
          版本: '1.0.0',
          作者: 'test',
          描述: 'ping plugin',
          init(deps) { deps.initHits.push('Ping') },
          execute() { return {type: 'text', content: 'pong'} }
        }
      `,
      'broken-init.js': `
        module.exports = {
          插件名: 'BrokenInit',
          指令: '^/broken$',
          版本: '1.0.0',
          init() { throw new Error('init failed') },
          execute() { return {type: 'text', content: 'still loaded'} }
        }
      `,
      'invalid.js': `
        module.exports = { 插件名: 'Invalid' }
      `,
    })
    pluginDirs.push(pluginDir)
    const logger = makeLogger()
    const runtime = createPluginRuntime({
      pluginDir,
      dependencies: {initHits: []},
      logger,
    })

    runtime.load()
    const reports = runtime.list()

    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({pluginName: 'Ping', valid: true, initError: null}),
        expect.objectContaining({pluginName: 'BrokenInit', valid: true, initError: 'PLUGIN_INIT_ERROR'}),
        expect.objectContaining({pluginName: 'Invalid', valid: false}),
      ]),
    )
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('BrokenInit'))
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('元数据不完整'))
  })

  test('executes plugins in load order and continues when a matched plugin returns empty', async () => {
    const pluginDir = makePluginDir({
      'first.js': `
        module.exports = {
          插件名: 'First',
          指令: '',
          execute() { return '' }
        }
      `,
      'second.js': `
        module.exports = {
          插件名: 'Second',
          指令: '^/cmd$',
          execute() { return 'second handled' }
        }
      `,
    })
    pluginDirs.push(pluginDir)
    const runtime = createPluginRuntime({pluginDir, logger: makeLogger()})
    runtime.load()

    const result = await runtime.execute({
      text: '/cmd',
      userId: 'u1',
      userName: 'User',
      groupId: 'g1',
      groupName: 'Group',
      platform: 'test',
    })

    expect(result).toEqual(expect.objectContaining({handled: true, pluginName: 'Second', type: 'text', content: 'second handled'}))
  })

  test('uses status cache and immediately caches the successful toggle result', async () => {
    const pluginDir = makePluginDir({
      'ping.js': `
        module.exports = {
          插件名: 'Ping',
          指令: '^/ping$',
          execute() { return {type: 'text', content: 'pong'} }
        }
      `,
    })
    pluginDirs.push(pluginDir)
    const getPluginStatus = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const setPluginStatus = jest.fn().mockResolvedValue(false)
    const runtime = createPluginRuntime({
      pluginDir,
      logger: makeLogger(),
      getPluginStatus,
      setPluginStatus,
    })
    runtime.load()

    await runtime.execute({text: '/ping', groupId: 'g1', platform: 'test'})
    await runtime.execute({text: '/ping', groupId: 'g1', platform: 'test'})
    expect(getPluginStatus).toHaveBeenCalledTimes(1)

    await runtime.toggle('g1', 'Ping')
    const result = await runtime.execute({text: '/ping', groupId: 'g1', platform: 'test'})

    expect(setPluginStatus).toHaveBeenCalledWith('g1', 'Ping')
    expect(getPluginStatus).toHaveBeenCalledTimes(1)
    expect(result).toEqual(expect.objectContaining({handled: true, content: '群内的 Ping 已关闭，不响应'}))
  })

  test('normalizes empty, string, and object plugin returns', () => {
    expect(normalizePluginReturn('')).toEqual(expect.objectContaining({handled: false, type: 'text', content: ''}))
    expect(normalizePluginReturn('hello')).toEqual(expect.objectContaining({handled: true, type: 'text', content: 'hello'}))
    expect(normalizePluginReturn({type: 'picture', content: {file: '/img.png'}})).toEqual(
      expect.objectContaining({handled: true, type: 'picture', content: {file: '/img.png'}}),
    )
  })

  test.each(['test', 'qqOfficial', 'qqGuildDirect'])('returns only safe error metadata when execution throws on %s', async (platform) => {
    const pluginDir = makePluginDir({
      'boom.js': `
        module.exports = {
          插件名: 'Boom',
          指令: '^/boom$',
          版本: '1.2.3',
          execute() { throw new Error('SECRET_ERROR_TOKEN') }
        }
      `,
    })
    pluginDirs.push(pluginDir)
    const logger = makeLogger()
    const sendMessageToQQGroup = jest.fn()
    const runtime = createPluginRuntime({
      pluginDir,
      dependencies: {sendMessageToQQGroup},
      officialPluginAllowlist: ['boom'],
      conversationState: {get: jest.fn().mockResolvedValue(true)},
      logger,
    })
    runtime.load()

    const result = await runtime.execute({
      text: '/boom',
      userId: 'u1',
      userName: 'SECRET_NICKNAME',
      groupId: 'g1',
      platform,
    })

    expect(result).toEqual(expect.objectContaining({handled: true, type: 'text', pluginName: 'Boom'}))
    expect(result.content).toBe('插件处理失败，请稍后再试')
    expect(result.error).toBeUndefined()
    expect(result.safeError).toEqual({code: 'PLUGIN_EXECUTION_ERROR', pluginName: 'Boom', platform, elapsedMs: expect.any(Number)})
    expect(sendMessageToQQGroup).not.toHaveBeenCalled()
    const serialized = JSON.stringify({result, logs: logger.error.mock.calls})
    for (const secret of ['SECRET_ERROR_TOKEN', 'SECRET_NICKNAME', '/boom']) expect(serialized).not.toContain(secret)
  })

  function statusFixture(options = {}) {
    const pluginDir = makePluginDir({'ping.js': `module.exports = {插件名: 'Ping', 指令: '^/ping$', execute() {return 'pong'}}`})
    pluginDirs.push(pluginDir)
    const runtime = createPluginRuntime({pluginDir, logger: makeLogger(), officialPluginAllowlist: ['ping'], ...options})
    runtime.load()
    runtime.plugins.ping.execute = jest.fn(() => 'pong')
    return runtime
  }

  test.each(['test', 'qqOfficial'])('late enabled read cannot override completed disable or execute plugin on %s', async (platform) => {
    let resolveRead
    const get = jest.fn(() => new Promise((resolve) => {resolveRead = resolve}))
    const toggle = jest.fn().mockResolvedValue(false)
    const runtime = statusFixture({getPluginStatus: get, setPluginStatus: toggle, conversationState: {get, toggle}})
    const context = {text: '/ping', groupId: 'g1', selfId: 'bot', platform}
    const pending = runtime.execute(context)
    await Promise.resolve()
    await runtime.toggle('g1', 'Ping', context)
    resolveRead(true)
    expect(await pending).toMatchObject({content: '群内的 Ping 已关闭，不响应'})
    expect(await runtime.execute(context)).toMatchObject({content: '群内的 Ping 已关闭，不响应'})
    expect(runtime.plugins.ping.execute).not.toHaveBeenCalled()
    expect(get).toHaveBeenCalledTimes(1)
  })

  test('concurrent reads share pending work but not state across groups', async () => {
    let resolveRead
    const get = jest.fn().mockImplementationOnce(() => new Promise((resolve) => {resolveRead = resolve})).mockResolvedValue(false)
    const runtime = statusFixture({getPluginStatus: get})
    const first = runtime.execute({text: '/ping', groupId: 'g1'})
    const second = runtime.execute({text: '/ping', groupId: 'g1'})
    await Promise.resolve()
    expect(get).toHaveBeenCalledTimes(1)
    expect(await runtime.execute({text: '/ping', groupId: 'g2'})).toMatchObject({content: '群内的 Ping 已关闭，不响应'})
    resolveRead(true)
    expect(await first).toMatchObject({content: 'pong'})
    expect(await second).toMatchObject({content: 'pong'})
  })

  test('load invalidates pending read and old enabled result cannot resurrect cache', async () => {
    let resolveRead
    const get = jest.fn().mockImplementationOnce(() => new Promise((resolve) => {resolveRead = resolve})).mockResolvedValue(false)
    const runtime = statusFixture({getPluginStatus: get})
    const pending = runtime.execute({text: '/ping', groupId: 'g1'})
    await Promise.resolve()
    runtime.load()
    resolveRead(true)
    expect(await pending).toMatchObject({content: '群内的 Ping 已关闭，不响应'})
    expect(await runtime.execute({text: '/ping', groupId: 'g1'})).toMatchObject({content: '群内的 Ping 已关闭，不响应'})
    expect(get).toHaveBeenCalledTimes(2)
  })

  test('status read errors are safe and do not poison later retry', async () => {
    const get = jest.fn().mockRejectedValueOnce(new Error('SECRET_STATUS')).mockResolvedValue(false)
    const logger = makeLogger()
    const runtime = statusFixture({getPluginStatus: get, logger})
    const result = await runtime.execute({text: '/ping', userName: 'SECRET_NAME', groupId: 'g1'})
    expect(result).toMatchObject({content: '插件处理失败，请稍后再试', safeError: {code: 'PLUGIN_RUNTIME_ERROR', pluginName: 'Ping'}})
    expect(JSON.stringify({result, logs: logger.error.mock.calls})).not.toContain('SECRET_')
    expect(await runtime.execute({text: '/ping', groupId: 'g1'})).toMatchObject({content: '群内的 Ping 已关闭，不响应'})
  })

  test('explicit notifier receives safe metadata and its failure cannot leak or replace response', async () => {
    const notifyPluginError = jest.fn().mockRejectedValue(new Error('SECRET_NOTIFY'))
    const logger = makeLogger()
    const runtime = statusFixture({notifyPluginError, logger})
    runtime.plugins.ping.execute.mockImplementation(() => {throw new Error('SECRET_PLUGIN')})
    const result = await runtime.execute({text: '/ping', groupId: 'g1', platform: 'test'})
    expect(result).toMatchObject({content: '插件处理失败，请稍后再试'})
    expect(notifyPluginError).toHaveBeenCalledWith({code: 'PLUGIN_EXECUTION_ERROR', pluginName: 'Ping', platform: 'test', elapsedMs: expect.any(Number)})
    expect(JSON.stringify({result, logs: logger.error.mock.calls, notifications: notifyPluginError.mock.calls})).not.toContain('SECRET_')
  })

  test('toggle command rejection is caught and failed toggle preserves cached state', async () => {
    const logger = makeLogger()
    const getPluginStatus = jest.fn().mockResolvedValue(true)
    const runtime = statusFixture({getPluginStatus, logger, setPluginStatus: jest.fn().mockRejectedValue(new Error('SECRET_TOGGLE'))})
    await runtime.execute({text: '/ping', groupId: 'g1'})
    const result = await runtime.execute({text: '插件关 Ping', userName: 'SECRET_NAME', groupId: 'g1'})
    expect(result).toMatchObject({content: '插件处理失败，请稍后再试', safeError: {code: 'PLUGIN_RUNTIME_ERROR'}})
    expect(JSON.stringify({result, logs: logger.error.mock.calls})).not.toContain('SECRET_')
    expect(await runtime.execute({text: '/ping', groupId: 'g1'})).toMatchObject({content: 'pong'})
    expect(getPluginStatus).toHaveBeenCalledTimes(1)
  })

  test('late read rejection after successful disable cannot discard the latest status', async () => {
    let rejectRead
    const getPluginStatus = jest.fn(() => new Promise((resolve, reject) => {rejectRead = reject}))
    const runtime = statusFixture({getPluginStatus, setPluginStatus: jest.fn().mockResolvedValue(false)})
    const pending = runtime.execute({text: '/ping', groupId: 'g1'})
    await Promise.resolve()
    await runtime.toggle('g1', 'Ping')
    rejectRead(new Error('SECRET_OLD_READ'))
    expect(await pending).toMatchObject({content: '群内的 Ping 已关闭，不响应'})
    expect(runtime.plugins.ping.execute).not.toHaveBeenCalled()
  })

  test('disable between cached read and execution prevents stale enabled invocation', async () => {
    const runtime = statusFixture({setPluginStatus: jest.fn().mockResolvedValue(false)})
    await runtime.execute({text: '/ping', groupId: 'g1'})
    runtime.plugins.ping.execute.mockClear()
    const pendingToggle = runtime.toggle('g1', 'Ping')
    const pendingExecute = runtime.execute({text: '/ping', groupId: 'g1'})
    await pendingToggle
    expect(await pendingExecute).toMatchObject({content: '群内的 Ping 已关闭，不响应'})
    expect(runtime.plugins.ping.execute).not.toHaveBeenCalled()
  })

  test('load invalidation also discards rejected old read and uses current status', async () => {
    let rejectRead
    const getPluginStatus = jest.fn().mockImplementationOnce(() => new Promise((resolve, reject) => {rejectRead = reject})).mockResolvedValue(false)
    const runtime = statusFixture({getPluginStatus})
    const pending = runtime.execute({text: '/ping', groupId: 'g1'})
    await Promise.resolve()
    runtime.load()
    rejectRead(new Error('SECRET_OLD_LOAD'))
    expect(await pending).toMatchObject({content: '群内的 Ping 已关闭，不响应'})
    expect(getPluginStatus).toHaveBeenCalledTimes(2)
  })

  test('repeated toggles expose latest completed status without another read', async () => {
    const getPluginStatus = jest.fn().mockResolvedValue(true)
    const runtime = statusFixture({getPluginStatus, setPluginStatus: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(false)})
    for (const status of [false, true, false]) {
      expect(await runtime.toggle('g1', 'Ping')).toMatchObject({status})
      expect((await runtime.execute({text: '/ping', groupId: 'g1'})).content).toBe(status ? 'pong' : '群内的 Ping 已关闭，不响应')
    }
    expect(getPluginStatus).not.toHaveBeenCalled()
  })

  test('late plugin rejection is logged only as metadata after timeout', async () => {
    jest.useFakeTimers()
    try {
      const logger = makeLogger()
      const notifyPluginError = jest.fn()
      const runtime = statusFixture({logger, notifyPluginError, timeoutMs: 5})
      let rejectPlugin
      runtime.plugins.ping.execute.mockImplementation(() => new Promise((resolve, reject) => {rejectPlugin = reject}))
      const pending = runtime.execute({text: '/ping', groupId: 'g1', userName: 'SECRET_NAME', platform: 'test'})
      await jest.advanceTimersByTimeAsync(5)
      const result = await pending
      expect(result).toMatchObject({timeout: true, safeError: {code: 'PLUGIN_TIMEOUT_ERROR', pluginName: 'Ping', platform: 'test'}})
      rejectPlugin(new Error('SECRET_LATE'))
      await jest.advanceTimersByTimeAsync(1)
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('PLUGIN_LATE_ERROR'))
      expect(JSON.stringify({result, logs: logger.error.mock.calls})).not.toContain('SECRET_')
      expect(notifyPluginError).not.toHaveBeenCalled()
    } finally {jest.useRealTimers()}
  })

  test('init and regex failure reports do not retain raw exceptions', () => {
    const pluginDir = makePluginDir({
      'init.js': `module.exports = {插件名: 'Init', 指令: '^init$', init() {throw new Error('SECRET_INIT')}, execute() {return ''}}`,
      'regex.js': `module.exports = {插件名: 'Regex', 指令: '[SECRET_REGEX', execute() {return ''}}`,
    })
    pluginDirs.push(pluginDir)
    const logger = makeLogger()
    const runtime = createPluginRuntime({pluginDir, logger})
    runtime.load()
    expect(runtime.list()).toEqual(expect.arrayContaining([
      expect.objectContaining({pluginName: 'Init', initError: 'PLUGIN_INIT_ERROR'}),
      expect.objectContaining({pluginName: 'Regex', valid: false, errors: ['PLUGIN_PATTERN_ERROR']}),
    ]))
    expect(JSON.stringify([logger.error.mock.calls, logger.warn.mock.calls])).not.toContain('SECRET_')
  })

  test('module timeout overrides do not change the deadline of other plugins', async () => {
    jest.useFakeTimers()
    try {
      const pluginDir = makePluginDir(Object.fromEntries(['llm', 'normal'].map((name) => [`${name}.js`, `
        module.exports = {插件名: '${name}', 指令: '^/${name}$', execute() {
          return new Promise((resolve) => setTimeout(() => resolve('done'), 20))
        }}
      `])))
      pluginDirs.push(pluginDir)
      const runtime = createPluginRuntime({pluginDir, timeoutMs: 5, pluginTimeouts: {llm: 30}, logger: makeLogger()})
      runtime.load()
      const long = runtime.execute({text: '/llm'})
      const normal = runtime.execute({text: '/normal'})
      await jest.advanceTimersByTimeAsync(25)
      expect(await long).toMatchObject({content: 'done', timeout: false})
      expect(await normal).toMatchObject({timeout: true})
    } finally { jest.useRealTimers() }
  })

  test.each([0, -1, NaN, '30000', 125001])('invalid plugin deadline %s falls back to the default', async (override) => {
    jest.useFakeTimers()
    try {
      const pluginDir = makePluginDir({'slow.js': `module.exports = {
        插件名: 'slow', 指令: '^/slow$', execute: () => new Promise(() => {})
      }`})
      pluginDirs.push(pluginDir)
      const runtime = createPluginRuntime({pluginDir, timeoutMs: 5, pluginTimeouts: {slow: override}, logger: makeLogger()})
      runtime.load()
      const result = runtime.execute({text: '/slow'})
      await jest.advanceTimersByTimeAsync(5)
      expect(await result).toMatchObject({timeout: true})
    } finally { jest.useRealTimers() }
  })

  test('soft timeout returns a prompt while the plugin promise keeps running', async () => {
    const pluginDir = makePluginDir({
      'slow.js': `
        module.exports = {
          插件名: 'Slow',
          指令: '^/slow$',
          execute() {
            return new Promise((resolve) => {
              setTimeout(() => {
                global.__chatdacsSlowPluginFinished = true
                resolve({type: 'text', content: 'late'})
              }, 30)
            })
          }
        }
      `,
    })
    pluginDirs.push(pluginDir)
    global.__chatdacsSlowPluginFinished = false
    const logger = makeLogger()
    const runtime = createPluginRuntime({pluginDir, logger, timeoutMs: 5})
    runtime.load()

    const result = await runtime.execute({text: '/slow', groupId: 'g1', platform: 'test'})

    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        type: 'text',
        content: '插件响应超时，请稍后再试',
        pluginName: 'Slow',
        timeout: true,
      }),
    )
    expect(global.__chatdacsSlowPluginFinished).toBe(false)

    await new Promise((resolve) => setTimeout(resolve, 40))
    expect(global.__chatdacsSlowPluginFinished).toBe(true)
    delete global.__chatdacsSlowPluginFinished
  })

  test('plugin_tester runs through the shared runtime', async () => {
    const pluginDir = makePluginDir({
      'ping.js': `
        module.exports = {
          插件名: 'Ping',
          指令: '^/ping$',
          execute(msg, userId, userName, groupId, groupName, options) {
            return {type: 'text', content: options.type + ':pong'}
          }
        }
      `,
    })
    pluginDirs.push(pluginDir)
    const runtime = createTesterRuntime({
      pluginDir,
      dependencies: {},
      logger: makeLogger(),
    })

    await expect(runPluginTester('/ping', runtime)).resolves.toEqual({type: 'text', content: 'test:pong'})
  })
})
