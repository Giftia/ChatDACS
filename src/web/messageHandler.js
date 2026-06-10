'use strict'

const cookie = require('cookie')

const WEB_GROUP_ID = '1145141919810'

function createWebMessageHandler({io, utils, logger, chatProcess, processExecute, globalConfig}) {
  if (!io) {
    throw new Error('io is required')
  }
  if (!utils) {
    throw new Error('utils is required')
  }
  if (!logger) {
    throw new Error('logger is required')
  }
  if (typeof chatProcess !== 'function') {
    throw new Error('chatProcess is required')
  }
  if (typeof processExecute !== 'function') {
    throw new Error('processExecute is required')
  }

  return async function handleWebMessage({socket, msgIn}) {
    const CID = getChatdacsId(socket)
    const msg = sanitizeWebMessage(msgIn?.msg)

    logger.info(`web端用户 ${socket.username}(${CID}) 发送了消息: ${msg}`.warn)

    utils.AddMessage(CID, msg)
    io.emit('message', {CID, name: socket.username, msg})

    const pluginsReply =
      (await processExecute(msg, CID, socket.username, WEB_GROUP_ID, '', {
        type: 'web',
      })) ?? ''

    if (pluginsReply) {
      const replyToWeb = utils.PluginAnswerToWebStyle(pluginsReply)
      emitWebBotMessage(io, replyToWeb)
    }

    if (globalConfig.CHAT_SWITCH) {
      const chatReply = await chatProcess(msg)
      emitWebBotMessage(io, chatReply)
    }
  }
}

function getChatdacsId(socket) {
  return cookie.parse(socket?.request?.headers?.cookie || '').ChatdacsID ?? 0
}

function sanitizeWebMessage(message) {
  return String(message ?? '').replace(/['<>]/g, '')
}

function emitWebBotMessage(io, msg) {
  if (typeof msg !== 'string' || msg === '') {
    return false
  }

  io.emit('message', {CID: '0', msg})
  return true
}

module.exports = {
  WEB_GROUP_ID,
  createWebMessageHandler,
  emitWebBotMessage,
  getChatdacsId,
  sanitizeWebMessage,
}
