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
  telegramClient.on('message', async (data) => {
    const chatId = data.chat.id
    const content = data.text
    const userName = data.from.username
    logger.info(`[Telegram] 收到用户 ${userName} 的消息: ${content}`)

    // Telegram插件应答器
    const pluginsReply = await processExecute(content, data.from.id, userName, chatId, '', {
      type: 'telegram',
    })

    if (pluginsReply) {
      const replyToTelegram = utils.PluginAnswerToTelegramStyle(pluginsReply)
      if (pluginsReply.type == 'text') {
        telegramClient.sendMessage(chatId, replyToTelegram.text)
      } else if (pluginsReply.type == 'picture' || pluginsReply.type == 'directPicture') {
        telegramClient.sendPhoto(
          chatId,
          replyToTelegram.image,
          {},
          {
            contentType: 'image/jpeg',
          },
        )
      } else if (pluginsReply.type == 'audio') {
        telegramClient.sendAudio(
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
        if (chatReply) {
          console.log(`对于Telegram端聊天 ${content} ，小夜回复 ${chatReply}`.log)
          telegramClient.sendMessage(chatId, chatReply)
        }
      }
    }
  })
}

module.exports = {
  StartTelegram,
}
