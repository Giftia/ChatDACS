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
const cookie = require('cookie')
const http = require('http').Server(app)
const io = require('socket.io')(http)
const path = require('path')
const fs = require('fs')

const utils = require('../plugins/system/utils.js') // 载入系统通用模块
const Constants = require('../config/constants.js') // 系统常量
const ipTranslator = require('lib-qqwry')(true)
const {createWebMessageHandler} = require('./web/messageHandler')

let onlineUsers = 0

function startServer({version, globalConfig, logger, chatProcess, processExecute}) {
  const handleWebMessage = createWebMessageHandler({
    io,
    utils,
    logger,
    chatProcess,
    processExecute,
    globalConfig,
  })

  io.on('connection', async (socket) => {
    socket.emit('getCookie')
    const CID = cookie.parse(socket.request.headers.cookie || '').ChatdacsID
    if (CID == undefined) {
      socket.emit('getCookie')
      return 0
    }

    // 获取 ip 与 地理位置
    const ip = socket.handshake.headers['x-forwarded-for']
      ? socket.handshake.headers['x-forwarded-for']?.split('::ffff:')[1]
      : socket.handshake.address.split('::ffff:')[1] ?? socket.handshake.address
    let location = '未知归属地'
    try {
      location = ipTranslator.searchIP(ip).Country
    } catch (error) {
      logger.error(`获取地理位置失败: ${error}`)
    }

    socket.emit('version', version)
    io.emit('onlineUsers', ++onlineUsers)

    // 开始获取用户信息并处理
    const {nickname, loginTimes, updatedAt} = await utils.GetUserData(CID)

    if (updatedAt) {
      socket.username = `${nickname}[来自${location}]`

      logger.info(`web端用户 ${nickname}(${CID}) 已经连接，登录次数 ${loginTimes + 1}，上次登录时间 ${updatedAt}`.log)

      // 更新登录次数
      utils.UpdateLoginTimes(CID)

      io.emit(
        'system',
        `欢迎回来，${socket.username}(${CID}) 。这是你第${loginTimes + 1}次访问。上次访问时间: ${updatedAt}`,
      )
    } else {
      // 若无法获取该用户信息，则应该是其第一次访问，接下来是新增用户操作:
      const CID = cookie.parse(socket.request.headers.cookie || '').ChatdacsID
      const randomNickname = await utils.RandomNickname()
      socket.username = `${randomNickname}[来自${location}]`

      logger.info(`web端用户 ${socket.username}(${CID}) 第一次访问，新增该用户`.log)

      // 新增用户
      utils.AddUser(CID, randomNickname)

      io.emit(
        'system',
        `新用户 ${socket.username}(${CID}) 已连接。小夜帮你取了一个随机昵称: ${socket.username}，请前往 更多-设置 来更改昵称`,
      )

      socket.emit('message', {
        CID: '0',
        msg: Constants.WEB_HELP_CONTENT,
      })
    }

    socket.on('disconnect', () => {
      onlineUsers--
      io.emit('onlineUsers', onlineUsers)
      logger.info(`web端用户 ${socket.username}(${CID}) 已经断开连接`.log)
      io.emit('system', '用户 ' + socket.username + ' 已断开连接')
    })

    socket.on('typing', () => {
      io.emit('typing', `${socket.username} 正在输入...`)
    })

    socket.on('typingOver', () => {
      io.emit('typing', '')
    })

    // 用户设置
    socket.on('getSettings', () => {
      const CID = cookie.parse(socket.request.headers.cookie || '').ChatdacsID
      socket.emit('settings', {CID: CID, name: socket.username})
    })

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
