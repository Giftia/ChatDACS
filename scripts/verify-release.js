'use strict'

const fs = require('fs')
const nodeHttp = require('http')
const os = require('os')
const path = require('path')

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-release-'))
process.env.CHATDACS_DB_PATH = path.join(tempDir, 'db.sqlite')

let sequelize
let httpServer
let socketServer
let utils
let originalRandomNickname

async function main() {
  const {normalizeRuntimeConfig} = require('../src/config/runtimeConfig')
  const {runMigrations} = require('../src/core/migrations')
  ;({sequelize} = require('../plugins/system/model/database'))
  utils = require('../plugins/system/utils')
  const {createPluginRuntime} = require('../src/plugins/runtime')
  const {createPluginDependencies} = require('../index')
  const server = require('../src/server')
  httpServer = server.http
  socketServer = server.io

  const logger = createLogger()
  const config = normalizeRuntimeConfig({
    System: {
      CHAT_SWITCH: true,
      CONNECT_ONE_BOT_SWITCH: false,
      GO_CQHTTP_SWITCH: false,
      CONNECT_BILIBILI_LIVE_SWITCH: false,
      CONNECT_QQ_GUILD_SWITCH: false,
      CONNECT_TELEGRAM_SWITCH: false,
      WEB_PORT: 0,
      PLUGIN_TIMEOUT_MS: 3000,
    },
    ApiKey: {},
    qqBot: {},
    Others: {},
  })

  const migrationResult = await runMigrations({
    sequelize,
    migrationsDir: path.join(process.cwd(), 'migrations'),
    logger,
  })
  assert(migrationResult.applied.length === 4, 'fresh database did not apply all migrations')

  originalRandomNickname = utils.RandomNickname
  utils.RandomNickname = async () => 'SmokeUser'

  const dependencies = createPluginDependencies(socketServer, config)
  dependencies.logger = logger
  dependencies.trayicon = createNoopTrayicon()
  const pluginRuntime = createPluginRuntime({
    pluginDir: path.join(process.cwd(), 'plugins'),
    dependencies,
    logger,
    getPluginStatus: async () => true,
    setPluginStatus: async () => true,
    timeoutMs: config.PLUGIN_TIMEOUT_MS,
  })
  pluginRuntime.load()

  const pluginReports = pluginRuntime.list()
  const invalidPlugins = pluginReports.filter((report) => !report.valid || report.initError)
  assert(invalidPlugins.length === 0, `plugin load failures: ${JSON.stringify(invalidPlugins)}`)

  const processExecute = async (text, userId, userName, groupId, groupName, options) => {
    const result = await pluginRuntime.execute({
      text,
      userId,
      userName,
      groupId,
      groupName,
      platform: options?.type,
      raw: options,
    })
    return result.handled ? {type: result.type, content: result.content} : ''
  }

  const listening = waitForListening(httpServer)
  server.startServer({
    version: 'ChatDACS release smoke',
    globalConfig: config,
    logger,
    chatProcess: async (text) => (text === '/ping' ? '' : `小夜收到:${text}`),
    processExecute,
  })
  await listening

  const port = httpServer.address().port
  const smokeId = `release-${Date.now()}`
  const cookie = `ChatdacsID=${smokeId}`
  const page = await request({port, method: 'GET', path: '/', headers: {Cookie: cookie}})
  assert(page.statusCode === 200, `home page status was ${page.statusCode}`)
  assert(page.body.includes('<title>ChatDACS</title>'), 'home page content mismatch')

  const pollingPath = await openSocketSession({port, cookie})
  const sessionFrames = await pollUntil({
    port,
    cookie,
    pollingPath,
    predicate: (frames) => frames.includes('ChatDACS release smoke') && frames.includes('SmokeUser'),
  })
  assert(!sessionFrames.includes('undefined'), 'session emitted undefined')

  await sendSocketEvent({port, cookie, pollingPath, event: 'message', payload: {msg: '/ping'}})
  const pluginFrames = await pollUntil({
    port,
    cookie,
    pollingPath,
    predicate: (frames) => frames.includes('Pong!'),
  })
  assert(pluginFrames.includes(`\"CID\":\"${smokeId}\"`), 'plugin flow did not broadcast the user message')

  await sendSocketEvent({port, cookie, pollingPath, event: 'message', payload: {msg: 'hello <script>'}})
  const chatFrames = await pollUntil({
    port,
    cookie,
    pollingPath,
    predicate: (frames) => frames.includes('hello script') && frames.includes('小夜收到:hello script'),
  })
  assert(!chatFrames.includes('undefined'), 'chat flow emitted undefined')

  console.log(
    JSON.stringify(
      {
        ok: true,
        httpStatus: page.statusCode,
        pluginsLoaded: pluginReports.length,
        migrationsApplied: migrationResult.applied.length,
        socketFlows: ['session', 'plugin', 'chat'],
      },
      null,
      2,
    ),
  )
}

function createLogger() {
  return {
    info() {},
    warn(message) {
      console.warn(message)
    },
    error(message) {
      console.error(message)
    },
  }
}

function createNoopTrayicon() {
  return {
    async create() {
      return {
        item() {
          return {}
        },
        separator() {
          return {}
        },
        setMenu() {},
        notify() {},
        kill() {},
      }
    },
  }
}

function waitForListening(server) {
  return new Promise((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
}

async function openSocketSession({port, cookie}) {
  const handshake = await request({
    port,
    method: 'GET',
    path: `/socket.io/?EIO=4&transport=polling&t=${Date.now()}`,
    headers: {Cookie: cookie},
  })
  assert(handshake.statusCode === 200 && handshake.body.startsWith('0'), 'Socket.IO handshake failed')
  const sid = JSON.parse(handshake.body.slice(1)).sid
  const pollingPath = `/socket.io/?EIO=4&transport=polling&sid=${encodeURIComponent(sid)}`
  await request({
    port,
    method: 'POST',
    path: pollingPath,
    headers: {Cookie: cookie, 'Content-Type': 'text/plain;charset=UTF-8'},
    body: '40',
  })
  return pollingPath
}

async function sendSocketEvent({port, cookie, pollingPath, event, payload}) {
  const response = await request({
    port,
    method: 'POST',
    path: pollingPath,
    headers: {Cookie: cookie, 'Content-Type': 'text/plain;charset=UTF-8'},
    body: `42${JSON.stringify([event, payload])}`,
  })
  assert(response.statusCode === 200, `Socket.IO event POST failed: ${response.statusCode}`)
}

async function pollUntil({port, cookie, pollingPath, predicate, timeoutMs = 8000}) {
  const startedAt = Date.now()
  const bodies = []
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await request({
        port,
        method: 'GET',
        path: pollingPath,
        headers: {Cookie: cookie},
        timeoutMs: 1500,
      })
      bodies.push(response.body)
      const frames = bodies.join('\n')
      if (predicate(frames)) {
        return frames
      }
    } catch (error) {
      if (!error.message.startsWith('request timeout:')) {
        throw error
      }
    }
  }
  throw new Error(`Socket.IO polling timed out: ${JSON.stringify(bodies)}`)
}

function request({port, method, path: requestPath, headers = {}, body, timeoutMs = 5000}) {
  return new Promise((resolve, reject) => {
    const req = nodeHttp.request(
      {hostname: '127.0.0.1', port, method, path: requestPath, headers},
      (res) => {
        const chunks = []
        res.setEncoding('utf8')
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve({statusCode: res.statusCode, body: chunks.join('')}))
      },
    )
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`request timeout: ${method} ${requestPath}`)))
    req.on('error', reject)
    if (body !== undefined) {
      req.write(body)
    }
    req.end()
  })
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function cleanup() {
  if (utils && originalRandomNickname) {
    utils.RandomNickname = originalRandomNickname
  }
  if (socketServer) {
    socketServer.disconnectSockets(true)
    await Promise.race([new Promise((resolve) => socketServer.close(resolve)), delay(2000)])
  } else if (httpServer?.listening) {
    httpServer.closeAllConnections?.()
    await new Promise((resolve) => httpServer.close(resolve))
  }
  if (sequelize) {
    await sequelize.close()
  }
  fs.rmSync(tempDir, {recursive: true, force: true})
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main()
  .then(async () => {
    await cleanup()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error(error)
    await cleanup()
    process.exit(1)
  })
