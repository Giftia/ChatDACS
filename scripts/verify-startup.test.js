'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const {EventEmitter} = require('events')
const {createWorkspace, removeWorkspace, supervise, childEnvironment, parseArgs, request, poll, summarizeLog} = require('./verify-startup')

test('failure summary exposes only bounded counters, never log bodies or arbitrary fields', () => {
  const summary = summarizeLog('SECRET_BODY WEB_MESSAGE_RECEIVED PLUGIN_RUNTIME_ERROR WEB_MESSAGE_RECEIVED')
  expect(summary.WEB_MESSAGE_RECEIVED).toBe(2)
  expect(summary.PLUGIN_RUNTIME_ERROR).toBe(1)
  expect(JSON.stringify(summary)).not.toContain('SECRET_BODY')
  expect(summarizeLog('', {WEB_MESSAGE_RECEIVED: 1e12, PLUGIN_RUNTIME_ERROR: -1, secret: 'SECRET'}))
    .toMatchObject({WEB_MESSAGE_RECEIVED: 1000000, PLUGIN_RUNTIME_ERROR: 0})
})

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

  test('safe HTTP stage and cause survive the child result without raw error details', async () => {
    const pending = supervise(options())
    child.emit('message', {type: 'startup-result', ok: false, graceful: false,
      code: 'STARTUP_HTTP_TIMEOUT', stage: 'SESSION_READY', causeCode: 'HTTP_TIMEOUT',
      message: 'SECRET body and token', cause: new Error('SECRET cause')})
    child.emit('close', 1, null)
    const error = await pending.catch((value) => value)
    expect(error).toMatchObject({code: 'STARTUP_HTTP_TIMEOUT', stage: 'SESSION_READY', causeCode: 'HTTP_TIMEOUT'})
    expect(Object.keys(error).sort()).toEqual(['causeCode', 'code', 'stage'])
    expect(JSON.stringify(error)).not.toContain('SECRET')
    expect(error.cause).toBeUndefined()
  })

  test('unsafe diagnostic metadata from child is not forwarded', async () => {
    const pending = supervise(options())
    child.emit('message', {type: 'startup-result', ok: false, code: 'STARTUP_HTTP_FAILED',
      stage: 'SECRET URL', causeCode: 'SECRET token'})
    child.emit('close', 1, null)
    const error = await pending.catch((value) => value)
    expect(Object.keys(error)).toEqual(['code'])
    expect(JSON.stringify(error)).not.toContain('SECRET')
  })
})

describe('safe bounded startup HTTP and polling', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {jest.clearAllTimers(); jest.useRealTimers()})

  function transport() {
    let receive
    const req = new EventEmitter()
    req.setTimeout = jest.fn()
    req.end = jest.fn()
    req.destroy = jest.fn(() => req.emit('error', new Error('SECRET destroyed request')))
    const httpRequest = jest.fn((_options, callback) => {receive = callback; return req})
    const respond = (body = '', status = 200) => {
      const res = new EventEmitter()
      res.setEncoding = jest.fn()
      res.statusCode = status
      res.complete = true
      receive(res)
      if (body) res.emit('data', body)
      return res
    }
    return {req, httpRequest, respond}
  }

  test('normal requests retain 1500ms timeout, successful content and timer cleanup', async () => {
    const t = transport()
    const pending = request({port: 12345, stage: 'HOME'}, t)
    expect(t.httpRequest).toHaveBeenCalledWith(expect.objectContaining({host: '127.0.0.1', port: 12345}), expect.any(Function))
    expect(t.req.setTimeout).toHaveBeenCalledWith(1500, expect.any(Function))
    t.respond('fixture HTML').emit('end')
    await expect(pending).resolves.toEqual({status: 200, body: 'fixture HTML'})
    expect(jest.getTimerCount()).toBe(0)
    expect(t.req.destroy).not.toHaveBeenCalled()
  })

  test.each([['ECONNREFUSED', 'ECONNREFUSED'], ['ECONNRESET', 'ECONNRESET'],
    ['ETIMEDOUT', 'ETIMEDOUT'], ['SECRET_CODE', 'REQUEST_ERROR']])('request failures preserve fixed cause %s without raw payload', async (code, expected) => {
    const t = transport()
    const pending = request({port: 12345, stage: 'SOCKET_OPEN', cookie: 'SECRET cookie', body: 'SECRET body'}, t)
    t.req.emit('error', Object.assign(new Error('SECRET URL token'), {code, cause: {secret: true}}))
    const error = await pending.catch((value) => value)
    expect(error).toMatchObject({code: 'STARTUP_HTTP_FAILED', stage: 'SOCKET_OPEN', causeCode: expected})
    expect(Object.keys(error).sort()).toEqual(['causeCode', 'code', 'stage'])
    expect(error.cause).toBeUndefined()
    expect(error.stack).not.toContain('SECRET')
    expect(JSON.stringify(error)).not.toContain('SECRET')
    expect(jest.getTimerCount()).toBe(0)
    expect(t.req.destroy).toHaveBeenCalledTimes(1)
  })

  test('ordinary HTTP stall fails at 1500ms with its timeout code, not generic HTTP_FAILED', async () => {
    const t = transport()
    const pending = request({port: 12345, stage: 'HOME'}, t)
    const check = expect(pending).rejects.toMatchObject({code: 'STARTUP_HTTP_TIMEOUT', stage: 'HOME', causeCode: 'HTTP_TIMEOUT'})
    await jest.advanceTimersByTimeAsync(1500)
    await check
    expect(t.req.destroy).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  test('socket inactivity timeout also remains fixed and cancels the absolute timer', async () => {
    const t = transport()
    const pending = request({port: 12345, stage: 'CHAT_SEND'}, t)
    t.req.setTimeout.mock.calls[0][1]()
    await expect(pending).rejects.toMatchObject({code: 'STARTUP_HTTP_TIMEOUT', stage: 'CHAT_SEND', causeCode: 'HTTP_TIMEOUT'})
    expect(jest.getTimerCount()).toBe(0)
  })

  test.each([['aborted', 'RESPONSE_ABORTED'], ['error', 'RESPONSE_ERROR'], ['end', 'RESPONSE_INCOMPLETE']])(
    'response %s cannot pass or expose response contents', async (event, causeCode) => {
      const t = transport()
      const pending = request({port: 12345, stage: 'PLUGIN_REPLY'}, t)
      const res = t.respond('SECRET response')
      res.complete = false
      res.emit(event, new Error('SECRET response error'))
      const error = await pending.catch((value) => value)
      expect(error).toMatchObject({code: 'STARTUP_HTTP_FAILED', stage: 'PLUGIN_REPLY', causeCode})
      expect(JSON.stringify(error)).not.toContain('SECRET')
      expect(jest.getTimerCount()).toBe(0)
    },
  )

  test('response size limit remains enforced with a safe cause', async () => {
    const t = transport()
    const pending = request({port: 12345, stage: 'HOME'}, t)
    t.respond('x'.repeat(2 * 1024 * 1024 + 1))
    await expect(pending).rejects.toMatchObject({code: 'STARTUP_RESPONSE_TOO_LARGE', stage: 'HOME', causeCode: 'RESPONSE_TOO_LARGE'})
    expect(jest.getTimerCount()).toBe(0)
  })

  test('synchronous transport failure is sanitized and leaves no deadline', async () => {
    const httpRequest = jest.fn(() => {throw new Error('SECRET transport')})
    await expect(request({port: 12345, stage: 'HOME'}, {httpRequest})).rejects.toMatchObject({
      code: 'STARTUP_HTTP_FAILED', stage: 'HOME', causeCode: 'REQUEST_ERROR',
    })
    expect(jest.getTimerCount()).toBe(0)
  })

  test('real request/poll composition accepts a 2000ms long-poll response within its 8000ms budget', async () => {
    const t = transport()
    t.req.end.mockImplementation(() => setTimeout(() => t.respond('expected frame').emit('end'), 2000))
    const pending = poll({port: 12345, stage: 'SESSION_READY', predicate: (frames) => frames.includes('expected')}, {
      requestHttp: (options) => request(options, t),
    })
    expect(t.req.setTimeout).toHaveBeenCalledWith(8000, expect.any(Function))
    await jest.advanceTimersByTimeAsync(2000)
    await expect(pending).resolves.toBeUndefined()
    expect(t.req.destroy).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })

  test('long-poll still aborts at its total deadline with fixed stage/cause', async () => {
    const t = transport()
    const pending = poll({port: 12345, stage: 'CHAT_REPLY', predicate: () => false}, {
      requestHttp: (options) => request(options, t),
    })
    const check = expect(pending).rejects.toMatchObject({code: 'STARTUP_HTTP_TIMEOUT', stage: 'CHAT_REPLY', causeCode: 'HTTP_TIMEOUT'})
    await jest.advanceTimersByTimeAsync(8000)
    await check
    expect(t.req.destroy).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  test('multiple poll responses consume one shared deadline rather than restarting the budget', async () => {
    let time = 0
    const requestHttp = jest.fn(async () => {time += 3000; return {status: 200, body: 'unmatched frame'}})
    await expect(poll({stage: 'PLUGIN_REPLY', predicate: () => false}, {requestHttp, now: () => time})).rejects.toMatchObject({
      code: 'STARTUP_POLL_FAILED', stage: 'PLUGIN_REPLY', causeCode: 'POLL_DEADLINE',
    })
    expect(requestHttp.mock.calls.map(([options]) => options.timeoutMs)).toEqual([8000, 5000, 2000])
  })

  test('poll still requires HTTP 200 and the expected frame predicate', async () => {
    const requestHttp = jest.fn().mockResolvedValue({status: 403, body: 'SECRET response'})
    await expect(poll({stage: 'SESSION_READY', predicate: () => true}, {requestHttp})).rejects.toMatchObject({
      code: 'STARTUP_POLL_FAILED', stage: 'SESSION_READY', causeCode: 'POLL_HTTP_STATUS',
    })
  })
})

test('arguments remain separate values instead of shell text', () => {
  expect(parseArgs(['--app-dir', 'space folder', '--node', 'node.exe'])).toEqual({appDir: 'space folder', nodePath: 'node.exe'})
  expect(() => parseArgs(['--unknown', 'SECRET'])).toThrow('STARTUP_ARGUMENT_INVALID')
})
