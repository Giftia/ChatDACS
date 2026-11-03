'use strict'

const path = require('path')

const trayPlugin = require('../../plugins/tray')

describe('tray plugin notification safety', () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  const originalUsername = process.env.USERNAME
  let plugin
  let logger
  let exec
  let execFile
  let os

  beforeEach(() => {
    Object.defineProperty(process, 'platform', {...platformDescriptor, value: 'win32'})
    process.env.USERNAME = 'mock-user'
    logger = {error: jest.fn(), info: jest.fn()}
    exec = jest.fn(() => { throw new Error('shell must never run') })
    execFile = jest.fn((_file, _args, _options, callback) => callback(null, 'ignored stdout', 'ignored stderr'))
    os = {userInfo: jest.fn(() => ({username: 'fallback-user'}))}
    plugin = {...trayPlugin, logger, exec, execFile, os, tray: {notify: jest.fn().mockResolvedValue(undefined)}}
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', platformDescriptor)
    if (originalUsername === undefined) delete process.env.USERNAME
    else process.env.USERNAME = originalUsername
    expect(exec).not.toHaveBeenCalled()
  })

  test('logs only a fixed code when asynchronous tray startup fails', async () => {
    const trayicon = {create: jest.fn().mockRejectedValue(new Error('private startup error & user body'))}

    plugin.init({logger, trayicon, path, fs: {readFileSync: jest.fn(() => Buffer.from('mock-icon'))}, os, exec, execFile})
    await new Promise((resolve) => setImmediate(resolve))

    expect(plugin.tray).toBeNull()
    expect(logger.error.mock.calls).toEqual([['TRAY_START_FAILED']])
  })

  test.each(['ordinary notification', 'A&B', 'A|B', 'A^B', 'A%B', 'A"B',
    'hello & whoami | more ^ %USERNAME% "quoted"', '" & start calc.exe & "',
    '/server:remote', '/server:remote /w /time:999 中文消息', '中文消息 & 保留原文'])
  ('passes prefixed notification text as one argument without shell: %s', async (text) => {
    const result = await plugin.execute(`弹窗 ${text}`, 'user-id', 'user-name', 'group-id', 'group-name', {})
    expect(execFile).toHaveBeenCalledTimes(1)
    expect(execFile).toHaveBeenCalledWith('msg.exe', ['mock-user', `ChatDACS: ${text}`],
      {windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024}, expect.any(Function))
    expect(execFile.mock.calls[0][1]).toHaveLength(2)
    expect(execFile.mock.calls[0][1][1].slice('ChatDACS: '.length)).toBe(text)
    expect(execFile.mock.calls[0][1][1]).not.toMatch(/^\//)
    expect(execFile.mock.calls[0][2]).not.toHaveProperty('shell')
    expect(plugin.tray.notify).toHaveBeenCalledWith('来自user-id(user-name)的消息', text)
    expect(os.userInfo).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
    expect(result).toEqual({type: 'text', content: '已经在宿主桌面弹出了一个消息通知，请查收'})
  })

  test.each([undefined, ''])('uses injected userInfo when USERNAME is absent or empty %#', async (username) => {
    if (username === undefined) delete process.env.USERNAME
    else process.env.USERNAME = username
    await plugin.execute('弹窗 fallback', 'id', 'name')
    expect(os.userInfo).toHaveBeenCalledTimes(1)
    expect(execFile).toHaveBeenCalledWith('msg.exe', ['fallback-user', 'ChatDACS: fallback'],
      {windowsHide: true, timeout: 5000, maxBuffer: 64 * 1024}, expect.any(Function))
  })

  test('does not claim success before the execFile callback completes', async () => {
    let callback
    execFile.mockImplementation((_file, _args, _options, done) => { callback = done })
    let settled = false
    const pending = plugin.execute('弹窗 waiting', 'id', 'name').then((result) => { settled = true; return result })
    await new Promise((resolve) => setImmediate(resolve))
    expect(settled).toBe(false)
    callback(null)
    await expect(pending).resolves.toMatchObject({content: '已经在宿主桌面弹出了一个消息通知，请查收'})
  })

  test.each(['reject', 'throw'])('notify can %s while the independent system message still succeeds', async (mode) => {
    const error = new Error('private notification body & whoami')
    if (mode === 'reject') plugin.tray.notify.mockRejectedValue(error)
    else plugin.tray.notify.mockImplementation(() => { throw error })
    await expect(plugin.execute('弹窗 test', 'id', 'name')).resolves.toEqual({type: 'text', content: '系统消息已发送，托盘通知未完成'})
    expect(execFile).toHaveBeenCalledTimes(1)
    expect(logger.error.mock.calls).toEqual([['TRAY_NOTIFY_FAILED']])
  })

  test.each(['callback', 'throw', 'missing'])('execFile failure %s is reported without fallback or raw errors', async (mode) => {
    const error = new Error('private command & payload')
    if (mode === 'callback') execFile.mockImplementation((_file, _args, _options, callback) => callback(error, error.message, error.message))
    if (mode === 'throw') execFile.mockImplementation(() => { throw error })
    if (mode === 'missing') plugin.execFile = undefined
    await expect(plugin.execute('弹窗 test', 'id', 'name')).resolves.toEqual({type: 'text', content: '托盘通知已发送，系统消息发送失败'})
    expect(logger.error.mock.calls).toEqual([['TRAY_MESSAGE_FAILED']])
  })

  test.each([null, undefined, {}])('tray not ready %# does not throw and retains system-message outcome', async (tray) => {
    plugin.tray = tray
    await expect(plugin.execute('弹窗 not ready', 'id', 'name')).resolves.toEqual({type: 'text', content: '系统消息已发送，托盘通知未完成'})
    expect(logger.error.mock.calls).toEqual([['TRAY_NOT_READY']])
    expect(execFile).toHaveBeenCalledTimes(1)
  })

  test.each([true, false])('process timeout is reported safely (tray available: %s)', async (trayAvailable) => {
    if (!trayAvailable) plugin.tray = null
    execFile.mockImplementation((_file, _args, options, callback) => {
      expect(options).toEqual({windowsHide: true, timeout: 5000, maxBuffer: 65536})
      callback(Object.assign(new Error('private timeout body /server:remote & 中文'), {
        killed: true, signal: 'SIGTERM', code: null,
      }), 'private stdout', 'private stderr')
    })
    await expect(plugin.execute('弹窗 /server:remote 中文 & | ^ % "', 'id', 'name')).resolves.toEqual({
      type: 'text', content: trayAvailable ? '托盘通知已发送，系统消息发送失败' : '宿主通知发送失败，请稍后重试',
    })
    expect(execFile).toHaveBeenCalledWith('msg.exe', ['mock-user', 'ChatDACS: /server:remote 中文 & | ^ % "'],
      {windowsHide: true, timeout: 5000, maxBuffer: 65536}, expect.any(Function))
    expect(logger.error.mock.calls).toEqual(trayAvailable
      ? [['TRAY_MESSAGE_FAILED']] : [['TRAY_NOT_READY'], ['TRAY_MESSAGE_FAILED']])
  })

  test('both delivery channels failing returns failure, never a success claim', async () => {
    plugin.tray.notify.mockRejectedValue(new Error('private body'))
    execFile.mockImplementation((_file, _args, _options, callback) => callback(new Error('private body')))
    await expect(plugin.execute('弹窗 test', 'id', 'name')).resolves.toEqual({type: 'text', content: '宿主通知发送失败，请稍后重试'})
    expect(logger.error.mock.calls).toEqual([['TRAY_NOTIFY_FAILED'], ['TRAY_MESSAGE_FAILED']])
  })

  test('pre-init invocation with no tray or injected dependencies returns failure safely', async () => {
    const uninitialized = {...trayPlugin}
    await expect(uninitialized.execute('弹窗 before init', 'id', 'name'))
      .resolves.toEqual({type: 'text', content: '宿主通知发送失败，请稍后重试'})
  })

  test('injected userInfo failure is sanitized and cannot trigger shell fallback', async () => {
    delete process.env.USERNAME
    os.userInfo.mockImplementation(() => { throw new Error('private os detail') })
    await expect(plugin.execute('弹窗 test', 'id', 'name')).resolves.toMatchObject({content: '托盘通知已发送，系统消息发送失败'})
    expect(execFile).not.toHaveBeenCalled()
    expect(logger.error.mock.calls).toEqual([['TRAY_MESSAGE_FAILED']])
  })

  test('unsupported platform does not call platform APIs or claim notification success', async () => {
    Object.defineProperty(process, 'platform', {...platformDescriptor, value: 'linux'})
    await expect(plugin.execute('弹窗 test', 'id', 'name')).resolves.toMatchObject({content: '当前平台不支持宿主通知'})
    expect(plugin.tray.notify).not.toHaveBeenCalled()
    expect(execFile).not.toHaveBeenCalled()
    expect(os.userInfo).not.toHaveBeenCalled()
  })

  test('nonmatching command does not call notification or process APIs', async () => {
    await expect(plugin.execute('not a command', 'id', 'name')).resolves.toMatchObject({content: '通知指令格式不正确'})
    expect(plugin.tray.notify).not.toHaveBeenCalled()
    expect(execFile).not.toHaveBeenCalled()
  })
})
