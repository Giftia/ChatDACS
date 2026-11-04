'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const {spawn} = require('child_process')
const {randomUUID} = require('crypto')

const failure = (code) => Object.assign(new Error(code), {code})
const assert = (condition, code) => { if (!condition) throw failure(code) }
const workspaces = new Set()
const httpStages = new Set(['HTTP', 'POLL', 'HOME', 'SOCKET_OPEN', 'SOCKET_CONNECT',
  'SESSION_READY', 'PLUGIN_SEND', 'PLUGIN_REPLY', 'CHAT_SEND', 'CHAT_REPLY'])
const httpCauses = new Set(['HTTP_TIMEOUT', 'ECONNREFUSED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT',
  'ABORT_ERR', 'ERR_STREAM_PREMATURE_CLOSE', 'REQUEST_ERROR', 'RESPONSE_ERROR', 'RESPONSE_ABORTED',
  'RESPONSE_INCOMPLETE', 'RESPONSE_TOO_LARGE', 'POLL_HTTP_STATUS', 'POLL_DEADLINE'])

function diagnostics(error) {
  return {...(httpStages.has(error?.stage) ? {stage: error.stage} : {}),
    ...(httpCauses.has(error?.causeCode) ? {causeCode: error.causeCode} : {})}
}

function httpFailure(code, stage, causeCode) {
  return Object.assign(failure(code), diagnostics({stage, causeCode}))
}

function removeWorkspace(root) {
  const resolved = path.resolve(root)
  assert(path.dirname(resolved) === fs.realpathSync(os.tmpdir()) &&
    path.basename(resolved).startsWith('chatdacs-startup-') && workspaces.has(resolved), 'STARTUP_CLEANUP_REFUSED')
  fs.rmSync(resolved, {recursive: true, force: true})
  workspaces.delete(resolved)
}

function createWorkspace(appDir, dependenciesDir = path.join(appDir, 'node_modules')) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'chatdacs-startup-'))
  workspaces.add(root)
  try {
    const copy = (name) => fs.cpSync(path.join(appDir, name), path.join(root, name), {
      recursive: true,
      filter(source) {
        const stat = fs.lstatSync(source)
        if (stat.isSymbolicLink()) return false
        if (stat.isDirectory()) {
          if (['uploads', 'logs', 'node_modules', '.git', 'go-cqhttp', 'mpg123', '__tests__', 'harness', '__tests__harness']
            .includes(path.basename(source))) return false
          if (source === path.join(appDir, 'plugins', 'persona')) return false
          // The startup smoke fetches the real HTML, not the Live2D/media asset libraries.
          if (name === 'static' && source !== path.join(appDir, 'static')) return false
          return true
        }
        const file = path.basename(source)
        return !/\.test\.js$|(?:credentials?|authorization|state).*\.json$|\.(?:db|sqlite)(?:-.*)?$|\.log$|\.ya?ml$|^\.env/i.test(file)
      },
    })
    for (const name of ['index.js', 'package.json', 'src', 'migrations', 'plugins', 'static']) copy(name)
    fs.mkdirSync(path.join(root, 'config'))
    for (const file of ['constants.js', 'jieba.dict.utf8', 'hmm_model.utf8', 'userDict.txt', 'idf.utf8', 'stopWordDict.txt']) {
      fs.copyFileSync(path.join(appDir, 'config', file), path.join(root, 'config', file))
    }
    fs.mkdirSync(path.join(root, 'plugins', 'danceCube'), {recursive: true})
    fs.writeFileSync(path.join(root, 'plugins', 'danceCube', 'authorization.json'), '{}', 'utf8')
    fs.symlinkSync(fs.realpathSync(dependenciesDir), path.join(root, 'node_modules'), 'junction')
    const state = path.join(root, 'startup-state')
    fs.mkdirSync(state)
    const config = {
      System: {WEB_PORT: 0, WEB_HOST: '127.0.0.1', CHAT_SWITCH: true, CONNECT_ONE_BOT_SWITCH: false,
        GO_CQHTTP_SWITCH: false, CONNECT_QQ_OFFICIAL_SWITCH: false, CONNECT_QQ_GUILD_SWITCH: false,
        CONNECT_BILIBILI_LIVE_SWITCH: false, CONNECT_TELEGRAM_SWITCH: false,
        ONE_BOT_API_URL: '127.0.0.1:1'},
      ApiKey: {}, qqBot: {}, Others: {},
      llm: {provider: 'openai', baseUrl: 'https://127.0.0.1:1/v1', model: 'startup-fixture',
        apiKeyFile: path.join(state, 'llm.credentials.json'),
        personaStateFile: path.join(state, 'persona.json'), modelStateFile: path.join(state, 'model.json')},
    }
    fs.writeFileSync(path.join(state, 'llm.credentials.json'), JSON.stringify({apiKey: 'startup-fixture'}), 'utf8')
    const configPath = path.join(state, 'shadow.yml')
    fs.writeFileSync(configPath, JSON.stringify(config), 'utf8')
    return {root, configPath, dbPath: path.join(state, 'chat.sqlite')}
  } catch (_) {
    removeWorkspace(root)
    throw failure('STARTUP_WORKSPACE_FAILED')
  }
}

function supervise({nodePath, cwd, env, deadlineMs = 45000, spawnChild = spawn}) {
  return new Promise((resolve, reject) => {
    let child, result, timedOut = false, spawnError = false, hardKill, abandoned, settled = false
    const kill = (signal) => { try { child?.kill(signal) } catch (_) {} }
    const timer = setTimeout(() => {
      timedOut = true
      hardKill = setTimeout(() => kill('SIGKILL'), 2000)
      abandoned = setTimeout(() => finish(failure('STARTUP_CHILD_STILL_RUNNING')), 5000)
      kill()
    }, deadlineMs)
    function finish(error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      clearTimeout(hardKill)
      clearTimeout(abandoned)
      if (error) reject(error)
      else resolve(result)
    }
    try {
      child = spawnChild(nodePath, [__filename, '--child'], {cwd, env, shell: false, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']})
      // Application/native output can include paths or fixture messages; never forward it.
      child.stdout?.resume()
      child.stderr?.resume()
      child.on('message', (message) => {
        if (message?.type === 'startup-result') result = message
      })
      child.once('error', () => { spawnError = true })
      child.once('close', (code, signal) => {
        if (timedOut) finish(failure('STARTUP_DEADLINE'))
        else if (spawnError) finish(failure('STARTUP_CHILD_FAILED'))
        else if (code !== 0 || signal || result?.ok !== true || result?.graceful !== true) {
          finish(Object.assign(failure(/^STARTUP_[A-Z_]+$/.test(result?.code) ? result.code : 'STARTUP_VERIFICATION_FAILED'),
            diagnostics(result)))
        } else finish()
      })
    } catch (_) { finish(failure('STARTUP_CHILD_FAILED')) }
  })
}

function childEnvironment(workspace) {
  const env = {...process.env}
  for (const key of Object.keys(env)) {
    if (/TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|PROXY/i.test(key) || ['NODE_OPTIONS', 'NODE_PATH'].includes(key)) delete env[key]
  }
  env.CHATDACS_DB_PATH = workspace.dbPath
  env.CHATDACS_STARTUP_CONFIG = workspace.configPath
  return env
}

async function verifyStartup({appDir = path.resolve(__dirname, '..'), dependenciesDir, nodePath = process.execPath,
  deadlineMs = 45000} = {}) {
  assert(Number.isInteger(deadlineMs) && deadlineMs >= 100 && deadlineMs <= 120000, 'STARTUP_DEADLINE_INVALID')
  const workspace = createWorkspace(path.resolve(appDir), dependenciesDir)
  let keep = false
  try {
    return await supervise({nodePath, cwd: workspace.root, env: childEnvironment(workspace), deadlineMs})
  } catch (error) {
    keep = error.code === 'STARTUP_CHILD_STILL_RUNNING'
    throw error
  } finally {
    if (!keep) removeWorkspace(workspace.root)
  }
}

function noopTrayicon() {
  return {async create() { return {item() { return {} }, separator() { return {} }, setMenu() {}, notify() {}, kill() {}} }}
}

function request({port, method = 'GET', requestPath = '/', cookie, body, stage = 'HTTP', timeoutMs = 1500},
  {httpRequest = http.request} = {}) {
  return new Promise((resolve, reject) => {
    let req, timer, settled = false
    const finish = (error, result) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolve(result)
    }
    const abort = (code, causeCode) => {
      if (settled) return
      finish(httpFailure(code, stage, causeCode))
      try { req?.destroy() } catch (_) {}
    }
    try {
      req = httpRequest({host: '127.0.0.1', port, method, path: requestPath,
        headers: {...(cookie ? {Cookie: cookie} : {}), ...(body === undefined ? {} : {'Content-Type': 'text/plain;charset=UTF-8'})}},
      (res) => {
        let content = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          content += chunk
          if (content.length > 2 * 1024 * 1024) abort('STARTUP_RESPONSE_TOO_LARGE', 'RESPONSE_TOO_LARGE')
        })
        res.on('aborted', () => abort('STARTUP_HTTP_FAILED', 'RESPONSE_ABORTED'))
        res.on('error', (error) => abort('STARTUP_HTTP_FAILED', httpCauses.has(error?.code) ? error.code : 'RESPONSE_ERROR'))
        res.on('end', () => {
          if (res.complete === false) abort('STARTUP_HTTP_FAILED', 'RESPONSE_INCOMPLETE')
          else finish(null, {status: res.statusCode, body: content})
        })
      })
      const timeout = () => abort('STARTUP_HTTP_TIMEOUT', 'HTTP_TIMEOUT')
      // The absolute deadline also bounds a connection that keeps producing data.
      timer = setTimeout(timeout, timeoutMs)
      req.setTimeout(timeoutMs, timeout)
      req.on('error', (error) => abort('STARTUP_HTTP_FAILED', httpCauses.has(error?.code) ? error.code : 'REQUEST_ERROR'))
      req.end(body)
    } catch (error) {
      abort('STARTUP_HTTP_FAILED', httpCauses.has(error?.code) ? error.code : 'REQUEST_ERROR')
    }
  })
}

async function poll({port, cookie, pollingPath, predicate, stage = 'POLL'},
  {requestHttp = request, now = Date.now} = {}) {
  const until = now() + 8000
  let frames = ''
  while (now() < until) {
    // Engine.IO polling legitimately waits for an event. Use the remaining poll
    // budget, not the ordinary HTTP request's shorter inactivity timeout.
    const response = await requestHttp({port, cookie, requestPath: pollingPath, stage, timeoutMs: until - now()})
    if (now() >= until) break
    if (response.status !== 200) throw httpFailure('STARTUP_POLL_FAILED', stage, 'POLL_HTTP_STATUS')
    frames += response.body
    if (predicate(frames)) return
  }
  throw httpFailure('STARTUP_POLL_FAILED', stage, 'POLL_DEADLINE')
}

async function childMain() {
  assert(typeof process.send === 'function', 'STARTUP_CHILD_ONLY')
  // Only this disposable child is guarded; the real application and platform are unchanged.
  for (const method of ['log', 'info', 'warn', 'error']) console[method] = () => {}
  const net = require('net')
  const originalConnect = net.Socket.prototype.connect
  let port, blocked = 0, unexpected = 0
  net.Socket.prototype.connect = function (...args) {
    const options = Array.isArray(args[0]) ? args[0][0] : args[0]
    if (!options || typeof options !== 'object' || options.host !== '127.0.0.1' || Number(options.port) !== port) {
      blocked++
      process.nextTick(() => this.destroy(failure('STARTUP_NETWORK_BLOCKED')))
      return this
    }
    return originalConnect.apply(this, args)
  }
  const childProcess = require('child_process')
  for (const method of ['exec', 'execFile', 'spawn', 'fork']) {
    childProcess[method] = () => { blocked++; throw failure('STARTUP_PROCESS_BLOCKED') }
  }
  const onUnexpected = () => { unexpected++ }
  process.on('unhandledRejection', onUnexpected)
  process.on('uncaughtException', onUnexpected)
  const before = ['unhandledRejection', 'uncaughtException'].map((name) => process.listenerCount(name))
  const root = process.cwd()
  const packageJson = require(path.join(root, 'package.json'))
  assert(process.versions.node === packageJson.engines.node, 'STARTUP_NODE_VERSION_MISMATCH')
  assert(process.env.CHATDACS_DB_PATH === path.join(root, 'startup-state', 'chat.sqlite') &&
    process.env.CHATDACS_STARTUP_CONFIG === path.join(root, 'startup-state', 'shadow.yml'), 'STARTUP_ISOLATION_INVALID')
  const {main} = require(path.join(root, 'index.js'))
  let controller
  try {
    controller = await main({configPath: process.env.CHATDACS_STARTUP_CONFIG,
      pluginDependencyOverrides: {trayicon: noopTrayicon()}, checkUpdates: false})
    assert(!fs.existsSync(path.join(root, 'plugins', 'persona')), 'STARTUP_PERSONA_NOT_ISOLATED')
    const llmPlugin = require(path.join(root, 'plugins', 'ollama'))
    const persona = llmPlugin.personas?.current('startup-default')
    assert(persona?.fileName === null && persona.content === require(path.join(root, 'src/plugins/nativePersona')) &&
      typeof llmPlugin.client?.complete === 'function', 'STARTUP_NATIVE_PERSONA_FAILED')
    if (!controller.http.listening) {
      await new Promise((resolve, reject) => {
        controller.http.once('listening', resolve)
        controller.http.once('error', () => reject(failure('STARTUP_LISTEN_FAILED')))
      })
    }
    const address = controller.http.address()
    assert(address.address === '127.0.0.1', 'STARTUP_NOT_LOOPBACK')
    port = address.port
    const {sequelize} = require(path.join(root, 'plugins/system/model/database'))
    assert(sequelize.options.storage === process.env.CHATDACS_DB_PATH, 'STARTUP_DATABASE_NOT_ISOLATED')
    const utils = require(path.join(root, 'plugins/system/utils'))
    const id = `startup-${randomUUID()}`
    utils.AddUser(id, 'StartupUser')
    const until = Date.now() + 3000
    while (!(await utils.GetUserData(id))?.updatedAt && Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert((await utils.GetUserData(id))?.updatedAt, 'STARTUP_USER_NOT_READY')
    const ask = `startupchat${randomUUID().replaceAll('-', '')}`
    const answer = `startupanswer${randomUUID().replaceAll('-', '')}`
    const now = new Date()
    await sequelize.getQueryInterface().bulkInsert('chat', [{ask, answer, createdAt: now, updatedAt: now}])
    const cookie = `ChatdacsID=${id}`
    assert((await request({port, cookie, stage: 'HOME'})).status === 200, 'STARTUP_HOME_FAILED')
    const hello = await request({port, cookie, stage: 'SOCKET_OPEN', requestPath: '/socket.io/?EIO=4&transport=polling'})
    assert(hello.status === 200 && hello.body.startsWith('0'), 'STARTUP_SOCKET_FAILED')
    const pollingPath = `/socket.io/?EIO=4&transport=polling&sid=${encodeURIComponent(JSON.parse(hello.body.slice(1)).sid)}`
    assert((await request({port, cookie, stage: 'SOCKET_CONNECT', method: 'POST', requestPath: pollingPath, body: '40'})).status === 200, 'STARTUP_SOCKET_FAILED')
    await poll({port, cookie, pollingPath, stage: 'SESSION_READY', predicate: (frames) => frames.includes('StartupUser')})
    for (const [msg, expected, sendStage, replyStage] of [['/ping', 'Pong!', 'PLUGIN_SEND', 'PLUGIN_REPLY'],
      [ask, answer, 'CHAT_SEND', 'CHAT_REPLY']]) {
      assert((await request({port, cookie, stage: sendStage, method: 'POST', requestPath: pollingPath,
        body: `42${JSON.stringify(['message', {msg}])}`})).status === 200, 'STARTUP_MESSAGE_FAILED')
      await poll({port, cookie, pollingPath, stage: replyStage,
        predicate: (frames) => frames.includes(expected) && frames.includes('"CID":"0"')})
    }
    const stopping = controller.stop()
    assert(controller.stop() === stopping, 'STARTUP_STOP_NOT_IDEMPOTENT')
    await stopping
    assert(controller.http.listening === false, 'STARTUP_HTTP_NOT_STOPPED')
    let closed = false
    try { await sequelize.query('SELECT 1') } catch { closed = true }
    assert(closed, 'STARTUP_DATABASE_NOT_STOPPED')
    assert(before.every((count, i) => count === process.listenerCount(['unhandledRejection', 'uncaughtException'][i])), 'STARTUP_HANDLERS_NOT_STOPPED')
    assert(blocked === 0 && unexpected === 0, 'STARTUP_UNEXPECTED_ACTIVITY')
    return {type: 'startup-result', ok: true, graceful: true, httpStatus: 200, ping: true, chatProcess: true,
      loopback: true, databaseIsolated: true, externalActivity: 0, platform: process.platform, node: process.versions.node}
  } finally {
    if (controller) await controller.stop()
  }
}

function parseArgs(args) {
  const options = {}
  const keys = {'--app-dir': 'appDir', '--dependencies-dir': 'dependenciesDir', '--node': 'nodePath'}
  for (let i = 0; i < args.length; i += 2) {
    assert(keys[args[i]] && args[i + 1] && !args[i + 1].startsWith('--'), 'STARTUP_ARGUMENT_INVALID')
    options[keys[args[i]]] = args[i + 1]
  }
  return options
}

if (require.main === module) {
  if (process.argv[2] === '--child') {
    childMain().then((result) => process.send(result, () => process.disconnect())).catch((error) => {
      process.exitCode = 1
      if (process.connected) process.send({type: 'startup-result', ok: false, graceful: false,
        code: /^STARTUP_[A-Z_]+$/.test(error?.code) ? error.code : 'STARTUP_VERIFICATION_FAILED',
        ...diagnostics(error)}, () => process.disconnect())
    })
  } else {
    Promise.resolve().then(() => verifyStartup(parseArgs(process.argv.slice(2)))).then((result) => {
      console.log(JSON.stringify(result))
    }).catch((error) => {
      console.error(JSON.stringify({code: /^STARTUP_[A-Z_]+$/.test(error?.code) ? error.code : 'STARTUP_VERIFICATION_FAILED',
        ...diagnostics(error)}))
      process.exitCode = 1
    })
  }
}

module.exports = {createWorkspace, removeWorkspace, supervise, childEnvironment, verifyStartup, parseArgs, request, poll}
