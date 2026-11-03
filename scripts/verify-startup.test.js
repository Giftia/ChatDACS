'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const {EventEmitter} = require('events')
const {createWorkspace, removeWorkspace, supervise, childEnvironment, parseArgs} = require('./verify-startup')

test('workspace snapshots code but never copies original config, database, credentials or upload data', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'startup-test-source-'))
  let workspace
  try {
    for (const name of ['src/__tests__', 'src/harness', 'src/__tests__harness', 'migrations',
      'plugins/danceCube', 'plugins/persona', 'static/uploads', 'config', 'node_modules']) {
      fs.mkdirSync(path.join(source, name), {recursive: true})
    }
    for (const name of ['index.js', 'package.json', 'src/real.js', 'plugins/ping.js', 'static/index.html',
      'config/constants.js', 'config/jieba.dict.utf8', 'config/hmm_model.utf8', 'config/userDict.txt',
      'config/idf.utf8', 'config/stopWordDict.txt']) fs.writeFileSync(path.join(source, name), '{}')
    for (const name of ['config/config.yml', 'config/db.db', 'plugins/danceCube/authorization.json',
      'static/uploads/private.txt', 'plugins/private.credentials.json', 'plugins/private.sqlite', 'plugins/.env',
      'plugins/persona/private.md', 'src/__tests__/fixture.js', 'src/harness/fixture.js', 'src/__tests__harness/fixture.js']) {
      fs.writeFileSync(path.join(source, name), 'SECRET')
    }
    workspace = createWorkspace(source)
    expect(fs.readFileSync(path.join(workspace.root, 'plugins/danceCube/authorization.json'), 'utf8')).toBe('{}')
    for (const name of ['config/config.yml', 'config/db.db', 'static/uploads/private.txt',
      'plugins/private.credentials.json', 'plugins/private.sqlite', 'plugins/.env', 'plugins/persona',
      'src/__tests__', 'src/harness', 'src/__tests__harness']) {
      expect(fs.existsSync(path.join(workspace.root, name))).toBe(false)
    }
    const config = JSON.parse(fs.readFileSync(workspace.configPath, 'utf8'))
    expect(config.System).toMatchObject({WEB_PORT: 0, WEB_HOST: '127.0.0.1', CONNECT_ONE_BOT_SWITCH: false,
      CONNECT_QQ_OFFICIAL_SWITCH: false, CONNECT_QQ_GUILD_SWITCH: false, CONNECT_TELEGRAM_SWITCH: false})
    expect(config.llm.personaStateFile.startsWith(workspace.root + path.sep)).toBe(true)
    expect(config.llm.modelStateFile.startsWith(workspace.root + path.sep)).toBe(true)
    expect(config.llm.baseUrl).toBe('https://127.0.0.1:1/v1')
    expect(fs.realpathSync(path.join(workspace.root, 'node_modules'))).toBe(fs.realpathSync(path.join(source, 'node_modules')))
    const env = childEnvironment(workspace)
    expect(env.CHATDACS_DB_PATH).toBe(workspace.dbPath)
    expect(env.NODE_OPTIONS).toBeUndefined()
    expect(env.CHATDACS_LLM_API_KEY).toBeUndefined()
    removeWorkspace(workspace.root)
    workspace = null
    expect(fs.existsSync(path.join(source, 'node_modules'))).toBe(true)
    expect(fs.readFileSync(path.join(source, 'config/db.db'), 'utf8')).toBe('SECRET')
  } finally {
    if (workspace) removeWorkspace(workspace.root)
    fs.rmSync(source, {recursive: true, force: true})
  }
})

test('workspace cleanup refuses arbitrary paths', () => {
  expect(() => removeWorkspace(process.cwd())).toThrow('STARTUP_CLEANUP_REFUSED')
  expect(() => removeWorkspace(path.join(fs.realpathSync(os.tmpdir()), 'chatdacs-startup-not-owned')))
    .toThrow('STARTUP_CLEANUP_REFUSED')
})

describe('bounded exact-child supervision', () => {
  let child, spawnChild
  beforeEach(() => {
    jest.useFakeTimers()
    child = new EventEmitter()
    child.stdout = {resume: jest.fn()}
    child.stderr = {resume: jest.fn()}
    child.kill = jest.fn(() => child.emit('close', null, 'SIGTERM'))
    spawnChild = jest.fn(() => child)
  })
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers() })
  const options = () => ({nodePath: 'mock node.exe', cwd: 'mock cwd', env: {}, deadlineMs: 100, spawnChild})

  test('only a natural zero exit with a graceful result passes; no shell or inherited output', async () => {
    const pending = supervise(options())
    expect(spawnChild).toHaveBeenCalledWith('mock node.exe', [expect.any(String), '--child'],
      expect.objectContaining({cwd: 'mock cwd', shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc']}))
    const result = {type: 'startup-result', ok: true, graceful: true}
    child.emit('message', result)
    child.emit('close', 0, null)
    await expect(pending).resolves.toBe(result)
    expect(child.kill).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })

  test('deadline kills only the owned child and never counts a kill as graceful', async () => {
    const pending = supervise(options())
    child.emit('message', {type: 'startup-result', ok: true, graceful: true})
    const verdict = expect(pending).rejects.toThrow('STARTUP_DEADLINE')
    await jest.advanceTimersByTimeAsync(100)
    await verdict
    expect(child.kill).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  test.each([null, {type: 'startup-result', ok: true, graceful: false},
    {type: 'startup-result', ok: false, code: 'SECRET URL'}])('missing or unsafe result %p fails without leaking it', async (result) => {
    const pending = supervise(options())
    if (result) child.emit('message', result)
    child.emit('close', 0, null)
    await expect(pending).rejects.toThrow('STARTUP_VERIFICATION_FAILED')
  })

  test('failed spawn reports only a fixed code', async () => {
    spawnChild.mockImplementation(() => { throw new Error('SECRET spawn path') })
    await expect(supervise(options())).rejects.toThrow('STARTUP_CHILD_FAILED')
    expect(jest.getTimerCount()).toBe(0)
  })
})

test('arguments remain separate values instead of shell text', () => {
  expect(parseArgs(['--app-dir', 'space folder', '--node', 'node.exe'])).toEqual({appDir: 'space folder', nodePath: 'node.exe'})
  expect(() => parseArgs(['--unknown', 'SECRET'])).toThrow('STARTUP_ARGUMENT_INVALID')
})
