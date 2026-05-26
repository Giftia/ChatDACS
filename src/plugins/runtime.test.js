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
        expect.objectContaining({pluginName: 'BrokenInit', valid: true, initError: expect.stringContaining('init failed')}),
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

  test('uses status cache and invalidates it after toggle', async () => {
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
    expect(getPluginStatus).toHaveBeenCalledTimes(2)
    expect(result).toEqual(expect.objectContaining({handled: true, content: '群内的 Ping 已关闭，不响应'}))
  })

  test('normalizes empty, string, and object plugin returns', () => {
    expect(normalizePluginReturn('')).toEqual(expect.objectContaining({handled: false, type: 'text', content: ''}))
    expect(normalizePluginReturn('hello')).toEqual(expect.objectContaining({handled: true, type: 'text', content: 'hello'}))
    expect(normalizePluginReturn({type: 'picture', content: {file: '/img.png'}})).toEqual(
      expect.objectContaining({handled: true, type: 'picture', content: {file: '/img.png'}}),
    )
  })

  test('returns a compatible error message when plugin execution throws', async () => {
    const pluginDir = makePluginDir({
      'boom.js': `
        module.exports = {
          插件名: 'Boom',
          指令: '^/boom$',
          版本: '1.2.3',
          execute() { throw new Error('boom') }
        }
      `,
    })
    pluginDirs.push(pluginDir)
    const logger = makeLogger()
    const sendMessageToQQGroup = jest.fn()
    const runtime = createPluginRuntime({
      pluginDir,
      dependencies: {sendMessageToQQGroup},
      logger,
    })
    runtime.load()

    const result = await runtime.execute({
      text: '/boom',
      userId: 'u1',
      userName: 'User',
      groupId: 'g1',
      platform: 'test',
    })

    expect(result).toEqual(expect.objectContaining({handled: true, type: 'text', pluginName: 'Boom'}))
    expect(result.content).toContain('插件 Boom 1.2.3')
    expect(result.content).toContain('boom')
    expect(sendMessageToQQGroup).toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('插件 Boom'))
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
