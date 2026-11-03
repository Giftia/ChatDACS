'use strict'

const cookie = require('cookie')
const {isUploadOnlyMessage} = require('../../static/uploadMedia')

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
    const uploadOnly = isUploadOnlyMessage(msgIn?.msg)
    const msg = sanitizeWebMessage(msgIn?.msg)

    logger.info('WEB_MESSAGE_RECEIVED')

    utils.AddMessage(CID, msg)
    io.emit('message', {CID, name: socket.username, msg})
    if (uploadOnly) return

    const pluginsReply =
      (await processExecute(msg, CID, socket.username, WEB_GROUP_ID, '', {
        type: 'web',
      })) ?? ''

    const handledByPlugin = Boolean(pluginsReply) && pluginsReply.handled !== false
    if (handledByPlugin) {
      const replyToWeb = utils.PluginAnswerToWebStyle(pluginsReply)
      emitWebBotMessage(io, replyToWeb)
      return
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
