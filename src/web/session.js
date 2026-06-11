'use strict'

const cookie = require('cookie')

const DEFAULT_LOCATION = '未知归属地'
const DEFAULT_NICKNAME_FALLBACK = '匿名'

function createWebSessionRuntime({
  io,
  utils,
  logger,
  constants,
  version,
  ipTranslator,
  nicknameFallback = DEFAULT_NICKNAME_FALLBACK,
}) {
  if (!io) {
    throw new Error('io is required')
  }
  if (!utils) {
    throw new Error('utils is required')
  }
  if (!logger) {
    throw new Error('logger is required')
  }
  if (!constants) {
    throw new Error('constants is required')
  }

  let onlineUsers = 0

  async function handleConnection(socket) {
    socket.emit('getCookie')
    const CID = getChatdacsId(socket)
    if (CID == undefined) {
      socket.emit('getCookie')
      return false
    }

    const location = resolveLocation({socket, ipTranslator, logger})
    socket.emit('version', version)
    io.emit('onlineUsers', ++onlineUsers)

    const user = await getUserData(utils, CID, logger)
    if (user?.updatedAt) {
      initializeExistingUser({socket, CID, user, location, io, utils, logger})
    } else {
      await initializeNewUser({socket, CID, location, io, utils, logger, constants, nicknameFallback})
    }

    registerBasicSocketEvents({socket, CID, io, logger, getOnlineUsers: () => onlineUsers, setOnlineUsers: setCount})
    return true
  }

  function setCount(count) {
    onlineUsers = count
  }

  function getOnlineUsers() {
    return onlineUsers
  }

  return {
    handleConnection,
    getOnlineUsers,
  }
}

function getChatdacsId(socket) {
  return cookie.parse(socket?.request?.headers?.cookie || '').ChatdacsID
}

function resolveLocation({socket, ipTranslator, logger}) {
  const ip = socket.handshake.headers['x-forwarded-for']
    ? socket.handshake.headers['x-forwarded-for']?.split('::ffff:')[1]
    : socket.handshake.address.split('::ffff:')[1] ?? socket.handshake.address

  try {
    return ipTranslator.searchIP(ip).Country
  } catch (error) {
    logger.error(`获取地理位置失败: ${error}`)
    return DEFAULT_LOCATION
  }
}

async function getUserData(utils, CID, logger) {
  try {
    return await utils.GetUserData(CID)
  } catch (error) {
    logger.error(`获取web端用户数据失败: ${error}`)
    return null
  }
}

function initializeExistingUser({socket, CID, user, location, io, utils, logger}) {
  const {nickname, loginTimes, updatedAt} = user
  socket.username = `${nickname}[来自${location}]`

  logger.info(`web端用户 ${nickname}(${CID}) 已经连接，登录次数 ${loginTimes + 1}，上次登录时间 ${updatedAt}`.log)
  utils.UpdateLoginTimes(CID)

  io.emit('system', `欢迎回来，${socket.username}(${CID}) 。这是你第${loginTimes + 1}次访问。上次访问时间: ${updatedAt}`)
}

async function initializeNewUser({socket, CID, location, io, utils, logger, constants, nicknameFallback}) {
  const randomNickname = await resolveNickname({utils, logger, nicknameFallback})
  socket.username = `${randomNickname}[来自${location}]`

  logger.info(`web端用户 ${socket.username}(${CID}) 第一次访问，新增该用户`.log)
  utils.AddUser(CID, randomNickname)

  io.emit(
    'system',
    `新用户 ${socket.username}(${CID}) 已连接。小夜帮你取了一个随机昵称: ${socket.username}，请前往 更多-设置 来更改昵称`,
  )

  socket.emit('message', {
    CID: '0',
    msg: constants.WEB_HELP_CONTENT,
  })
}

async function resolveNickname({utils, logger, nicknameFallback}) {
  try {
    const nickname = await utils.RandomNickname()
    return nickname || nicknameFallback
  } catch (error) {
    logger.error(`获取随机昵称失败: ${error}`)
    return nicknameFallback
  }
}

function registerBasicSocketEvents({socket, CID, io, logger, getOnlineUsers, setOnlineUsers}) {
  socket.on('disconnect', () => {
    const onlineUsers = getOnlineUsers() - 1
    setOnlineUsers(onlineUsers)
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

  socket.on('getSettings', () => {
    socket.emit('settings', {CID: CID, name: socket.username})
  })
}

module.exports = {
  createWebSessionRuntime,
  getChatdacsId,
  resolveLocation,
}
