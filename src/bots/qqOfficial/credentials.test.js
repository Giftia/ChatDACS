'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const {execFileSync} = require('child_process')
const {readCredentials, saveCredentials} = require('./credentials')
const {run, parseArgs} = require('../../../scripts/bind-qq-official')

describe('QQ official binding', () => {
  test('loads the real connector through its ESM entry without making a binding request', () => {
    const script = `
      const assert = require('node:assert/strict')
      globalThis.fetch = () => { throw new Error('unexpected network request') }
      const {run} = require('./scripts/bind-qq-official')
      assert.rejects(run({signal: AbortSignal.abort()}), /已取消/)
        .then(() => console.log('CONNECTOR_ESM_OK'))
        .catch(() => { process.exitCode = 1 })
    `
    const output = execFileSync(process.execPath, ['-e', script], {
      cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8', timeout: 8000,
    })
    expect(output).toContain('CONNECTOR_ESM_OK')
  })
  let dir, filePath
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-bind-'))
    filePath = path.join(dir, 'bot.credentials.json')
  })
  afterEach(() => fs.rmSync(dir, {recursive: true, force: true}))
  const value = {appId: 'bot', appSecret: 'secret-never-logged'}

  test('atomically saves and reloads credentials, supports env override', () => {
    const config = {QQ_OFFICIAL_CREDENTIALS_FILE: filePath}
    expect(readCredentials({config, env: {}})).toBeNull()
    saveCredentials({credentials: value, filePath})
    expect(readCredentials({config, env: {}})).toEqual(value)
    saveCredentials({credentials: {...value, appId: 'new'}, filePath})
    expect(fs.readdirSync(dir)).toEqual(['bot.credentials.json'])
    expect(readCredentials({config, env: {QQBOT_APPID: 'env', QQBOT_SECRET: 'env-secret'}}).appId).toBe('env')
    if (process.platform !== 'win32') expect(fs.statSync(filePath).mode & 0o777).toBe(0o600)
  })

  test('rejects incomplete env and malformed files without leaking secret payload', () => {
    expect(() => readCredentials({env: {QQBOT_APPID: value.appSecret}})).toThrow('必须包含')
    fs.writeFileSync(filePath, value.appSecret, 'utf8')
    expect(() => readCredentials({config: {QQ_OFFICIAL_CREDENTIALS_FILE: filePath}, env: {}})).toThrow('格式错误')
  })

  test('binds exactly one bot without logging credentials', async () => {
    const logger = {log: jest.fn()}
    const connector = {qrConnect: jest.fn(async () => [value])}
    const signal = new AbortController().signal
    await run({connector, logger, filePath, signal})
    expect(connector.qrConnect).toHaveBeenCalledWith({signal})
    expect(readCredentials({config: {QQ_OFFICIAL_CREDENTIALS_FILE: filePath}, env: {}})).toEqual(value)
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(value.appSecret)
    await expect(run({connector: {qrConnect: async () => [value, value]}, filePath})).rejects.toThrow('仅支持')
    await expect(run({connector: {qrConnect: async () => { throw new Error(value.appSecret) }}, filePath})).rejects.toThrow('已取消')
  })

  test('parses only documented CLI arguments', () => {
    expect(parseArgs(['--file', filePath])).toEqual({filePath})
    expect(() => parseArgs(['--file'])).toThrow('用法')
  })
})
