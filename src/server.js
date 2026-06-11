'use strict'

const compression = require('compression') // 用于gzip压缩
const express = require('express') // 轻巧的express框架
const app = require('express')()
app.use(compression()) // 对express所有路由启用gzip
app.use(express.static('static')) // 静态文件引入
app.use(express.json()) // 解析post
app.use(express.urlencoded({extended: false})) // 解析post
const multer = require('multer') // 用于文件上传
const upload = multer({dest: './static/uploads/'}) // 用户上传目录
const http = require('http').Server(app)
const io = require('socket.io')(http)
const path = require('path')
const fs = require('fs')

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
    if (!connected) {
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

  app.post('/upload/image', upload.single('file'), function (req) {
    logger.info('用户上传图片'.log)
    logger.info(req.file)
    const oldname = req.file.path
    const newname = req.file.path + path.parse(req.file.originalname).ext
    fs.renameSync(oldname, newname)
    io.emit('picture', {
      type: 'picture',
      content: `/uploads/${req.file.filename}${path.parse(req.file.originalname).ext}`,
    })
  })

  app.post('/upload/file', upload.single('file'), function (req) {
    logger.info('用户上传文件'.log)
    logger.info(req.file)
    const oldname = req.file.path
    const newname = req.file.path + path.parse(req.file.originalname).ext
    fs.renameSync(oldname, newname)
    const isVideo = new RegExp('^video*')
    const isAudio = new RegExp('^audio*')
    const file = {
      file: `/uploads/${req.file.filename}${path.parse(req.file.originalname).ext}`,
      filename: req.file.originalname,
    }
    if (isVideo.test(req.file.mimetype)) {
      io.emit('video', {type: 'video', content: file})
    } else if (isAudio.test(req.file.mimetype)) {
      io.emit('audio', {type: 'audio', content: file})
    } else {
      io.emit('file', {type: 'file', content: file})
    }
  })

  function startHttpServer() {
    http.listen(globalConfig.WEB_PORT, () => {
      logger.info(`HTTP服务启动完毕，访问 127.0.0.1:${globalConfig.WEB_PORT} 即可进入本地web端√`.log)
    })
  }

  http.on('error', (err) => {
    http.close()
    logger.error(
      `本机${globalConfig.WEB_PORT}端口被其他应用程序占用，请尝试关闭占用${globalConfig.WEB_PORT}端口的其他程序 或 修改配置文件的 WEB_PORT 配置项。错误代码：${err.code}`
        .error,
    )
    setTimeout(() => startHttpServer(), 10000)
  })

  startHttpServer()
}

module.exports = {
  startServer,
  app,
  http,
  io,
}
