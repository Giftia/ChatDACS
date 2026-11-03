'use strict'

const compression = require('compression') // 用于gzip压缩
const express = require('express') // 轻巧的express框架
const {registerUploadRoutes, uploadHeaders, createStaticUploadHeaders} = require('./web/uploads')
const app = require('express')()
app.use(compression()) // 对express所有路由启用gzip
app.use('/uploads', uploadHeaders)
app.get('/vendor/purify.min.js', (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.sendFile(require.resolve('dompurify/purify.min.js'))
})
app.use(express.static('static', {setHeaders: createStaticUploadHeaders()})) // 静态文件引入
app.use(express.json({
  verify(req, res, buffer) {
    req.rawBody = Buffer.from(buffer)
  },
})) // 解析post并保留签名校验所需的原始字节
app.use(express.urlencoded({extended: false})) // 解析post
const multer = require('multer') // 用于文件上传
const upload = multer({dest: './static/uploads/'}) // 用户上传目录
const http = require('http').Server(app)
const io = require('socket.io')(http)

const utils = require('../plugins/system/utils.js') // 载入系统通用模块
const Constants = require('../config/constants.js') // 系统常量
const ipTranslator = require('lib-qqwry')(true)
const {createWebMessageHandler} = require('./web/messageHandler')
const {createWebSessionRuntime} = require('./web/session')

function startServer({version, globalConfig, logger, chatProcess, processExecute}) {
  const webSessionRuntime = createWebSessionRuntime({
    io,
    utils,
    logger,
    constants: Constants,
    version,
    ipTranslator,
  })
  const handleWebMessage = createWebMessageHandler({
    io,
    utils,
    logger,
    chatProcess,
    processExecute,
    globalConfig,
  })

  io.on('connection', async (socket) => {
    const connected = await webSessionRuntime.handleConnection(socket)
    if (!connected || socket.disconnected === true) {
      return 0
    }

    // web端最核心代码，聊天处理
    socket.on('message', async (msgIn) => {
      await handleWebMessage({socket, msgIn})
    })
  })

  app.get('/profile', async (req, res) => {
    await utils.UpdateNickname(req.query.CID, req.query.name)
    res.sendFile(process.cwd() + Constants.HTML_PATH)
  })

  registerUploadRoutes({app, upload, io, logger})

  let retryTimer
  let closed = false
  function cancelRetry() {
    if (retryTimer !== undefined) clearTimeout(retryTimer)
    retryTimer = undefined
  }

  function handleHttpError(error) {
    if (closed) return
    if (error?.code !== 'EADDRINUSE') {
      cancelRetry()
      logger.error(error?.code === 'EACCES' ? 'HTTP_LISTEN_FORBIDDEN' : 'HTTP_LISTEN_FAILED')
      return
    }
    logger.error('HTTP_ADDRESS_IN_USE')
    if (retryTimer === undefined) {
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        startHttpServer()
      }, 10000)
    }
  }

  function startHttpServer() {
    if (closed || http.listening === true) return
    try {
      if (globalConfig.WEB_HOST === undefined) http.listen(globalConfig.WEB_PORT)
      else http.listen(globalConfig.WEB_PORT, globalConfig.WEB_HOST)
    } catch (error) { handleHttpError(error) }
  }

  http.on('error', handleHttpError)
  http.on('listening', () => {
    if (closed) return
    cancelRetry()
    const message = `HTTP服务启动完毕，访问 127.0.0.1:${globalConfig.WEB_PORT} 即可进入本地web端√`
    logger.info(message.log || message)
  })
  http.on('close', () => {
    // Only an explicit final close should reach index's adapter/process-handler cleanup.
    closed = true
    cancelRetry()
  })

  startHttpServer()
}

module.exports = {
  startServer,
  app,
  http,
  io,
}
