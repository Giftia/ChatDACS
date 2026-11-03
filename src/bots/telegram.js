/**
 * Telegram机器人集成模块
 * 处理Telegram机器人消息
 */

const TelegramBot = require('node-telegram-bot-api')

/**
 * 启动Telegram机器人
 * @param {Object} config - 配置对象
 * @param {Function} ProcessExecute - 插件处理函数
 * @param {Object} dependencies - 依赖对象
 */
async function StartTelegram({config, processExecute, chatProcess, logger, utils}) {
  const telegramClient = new TelegramBot(config.TELEGRAM_BOT_TOKEN, {polling: true})
  let stopped = false
  let stopPromise
  const polling = telegramClient._polling
  if (typeof polling?._polling === 'function') {
    const poll = polling._polling
    // This SDK's cancel branch may still queue polling from its finally handler.
    polling._polling = function (...args) {
      if (!stopped) return poll.apply(this, args)
    }
  }
  // Consume late SDK polling failures too, rather than its raw console fallback.
  telegramClient.on('polling_error', () => {
    if (!stopped) logger.error('TELEGRAM_POLLING_FAILED')
  })
  const onMessage = async (data) => {
    if (stopped || typeof data?.text !== 'string' || data?.chat?.id == null) return
    try {
      const chatId = data.chat.id
      const content = data.text
      const userName = data.from?.username ?? ''
      logger.info(`[Telegram] 收到用户 ${userName} 的消息: ${content}`)

      // Telegram插件应答器
      const pluginsReply = await processExecute(content, data.from?.id ?? '', userName, chatId, '', {
        type: 'telegram',
      })
      if (stopped) return

      if (pluginsReply) {
        const replyToTelegram = utils.PluginAnswerToTelegramStyle(pluginsReply)
        if (stopped) return
        if (pluginsReply.type == 'text') {
          await telegramClient.sendMessage(chatId, replyToTelegram.text)
        } else if (pluginsReply.type == 'picture' || pluginsReply.type == 'directPicture') {
          await telegramClient.sendPhoto(
            chatId,
            replyToTelegram.image,
            {},
            {
              contentType: 'image/jpeg',
            },
          )
        } else if (pluginsReply.type == 'audio') {
          await telegramClient.sendAudio(
            chatId,
            replyToTelegram.audio,
            {
              title: replyToTelegram.text,
              duration: replyToTelegram.duration,
            },
            {
              contentType: 'audio/mpeg',
            },
          )
        }
      } else {
        // 交给聊天函数处理
        const replyFlag = Math.floor(Math.random() * 100)
        if (replyFlag < config.QQBOT_REPLY_PROBABILITY) {
          const chatReply = await chatProcess(content)
          if (stopped) return
          if (chatReply) {
            console.log(`对于Telegram端聊天 ${content} ，小夜回复 ${chatReply}`.log)
            await telegramClient.sendMessage(chatId, chatReply)
          }
        }
      }
    } catch {
      if (!stopped) logger.error('TELEGRAM_MESSAGE_FAILED')
    }
  }
  telegramClient.on('message', onMessage)
  return {
    stop() {
      if (stopped) return stopPromise
      stopped = true
      telegramClient.removeListener('message', onMessage)
      if (polling) {
        polling._abort = true
        clearTimeout(polling._pollingTimeout)
      }
      stopPromise = Promise.resolve().then(() => telegramClient.stopPolling({cancel: true})).catch(() => {
        logger.error('TELEGRAM_STOP_FAILED')
        throw Object.assign(new Error('TELEGRAM_STOP_FAILED'), {code: 'TELEGRAM_STOP_FAILED'})
      })
      return stopPromise
    },
  }
}

module.exports = {
  StartTelegram,
}
