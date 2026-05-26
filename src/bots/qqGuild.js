/**
 * QQ频道集成模块
 * 处理QQ频道消息和独立QQ频道机器人
 */

const {createOpenAPI, createWebsocket} = require('qq-guild-bot')
const axios = require('axios').default

const Constants = require('../../config/constants.js')

/**
 * 处理QQ内嵌频道消息
 * @param {Object} event - 频道消息事件
 * @param {Function} ProcessExecute - 插件处理函数
 * @param {Function} ChatProcess - 聊天处理函数
 * @param {Object} config - 配置对象
 * @param {Object} logger - 日志对象
 */
async function ProcessGuildMessage({event, processExecute, chatProcess, config, logger, utils}) {
  const content = event.message
  // qq内嵌频道插件应答器
  const pluginsReply = await processExecute(content, event.user_id, event?.sender?.nickname, event.channel_id, '', {
    type: 'qqInsideGuild',
  })

  let replyToGuild = ''
  if (pluginsReply) {
    replyToGuild = utils.PluginAnswerToGoCqhttpStyle(pluginsReply)
  } else {
    // 交给聊天函数处理
    const replyFlag = Math.floor(Math.random() * 100)
    if (replyFlag < config.QQBOT_REPLY_PROBABILITY) {
      const chatReply = await chatProcess(content)
      if (chatReply) {
        console.log(`对于QQ频道聊天 ${content} ，小夜回复 ${chatReply}`.log)
        replyToGuild = chatReply
      }
    }
  }

  if (replyToGuild) {
    await axios.get(
      `http://${config.ONE_BOT_API_URL}/send_guild_channel_msg?guild_id=${event.guild_id}&channel_id=${
        event.channel_id
      }&message=${encodeURI(replyToGuild)}`,
    )
  }
}

/**
 * 启动QQ频道机器人 (独立机器人)
 * @param {Object} config - 配置对象
 * @param {Function} ProcessExecute - 插件处理函数
 * @param {Object} dependencies - 依赖对象
 */
async function StartQQGuild({config, processExecute, chatProcess, logger, utils}) {
  const testConfig = {
    appID: config.QQ_GUILD_APP_ID,
    token: config.QQ_GUILD_TOKEN,
    intents: ['GUILD_MESSAGES'], // 事件订阅,用于开启可接收的消息类型
    sandbox: true, // 沙箱频道
  }
  const qqGuildClient = createOpenAPI(testConfig)
  const qqGuildWS = createWebsocket(testConfig)

  // 消息监听
  qqGuildWS.on('READY', (data) => {
    console.log('[READY] 事件接收 :', data)
  })
  qqGuildWS.on('ERROR', (data) => {
    console.log('[ERROR] 事件接收 :', data)
  })
  qqGuildWS.on('GUILDS', (data) => {
    console.log('[GUILDS] 事件接收 :', data)
  })
  qqGuildWS.on('GUILD_MEMBERS', (data) => {
    console.log('[GUILD_MEMBERS] 事件接收 :', data)
  })
  qqGuildWS.on('GUILD_MESSAGE_REACTIONS', (data) => {
    console.log('[GUILD_MESSAGE_REACTIONS] 事件接收 :', data)
  })
  qqGuildWS.on('DIRECT_MESSAGE', (data) => {
    console.log('[DIRECT_MESSAGE] 事件接收 :', data)
  })
  qqGuildWS.on('INTERACTION', (data) => {
    console.log('[INTERACTION] 事件接收 :', data)
  })
  qqGuildWS.on('MESSAGE_AUDIT', (data) => {
    console.log('[MESSAGE_AUDIT] 事件接收 :', data)
  })
  qqGuildWS.on('FORUMS_EVENT', (data) => {
    console.log('[FORUMS_EVENT] 事件接收 :', data)
  })
  qqGuildWS.on('AUDIO_ACTION', (data) => {
    console.log('[AUDIO_ACTION] 事件接收 :', data)
  })
  qqGuildWS.on('GUILD_MESSAGES', async (data) => {
    console.log('[GUILD_MESSAGES] 事件接收 :', data)

    // 需要把指令前 <@!1234567890 > 和 [sandbox] 移除
    const content = data.msg.content?.replace(/<@!\d+> /g, '').replace(/\[sandbox\]/g, '')

    // QQ频道端插件应答器
    const pluginsReply = await processExecute(
      content,
      data.msg.author.id,
      data.msg.author.username,
      data.msg.channel_id,
      '',
      {
        type: 'qqGuild',
      },
    )

    const channelID = data.msg.channel_id
    const replyMsgID = data.msg.id

    if (pluginsReply) {
      const replyToQQGuild = utils.PluginAnswerToQQGuildStyle(pluginsReply)

      if (replyToQQGuild?.audio) {
        const message = {
          audio_url: replyToQQGuild.audio,
          msg_id: replyMsgID,
          text: replyToQQGuild.text,
          state: Constants.AUDIO_START,
        }

        qqGuildClient.audioApi
          .postAudio(channelID, message)
          .then((res) => {
            console.log('[GUILD_MESSAGES] 语音应答成功 :', res)
          })
          .catch((err) => {
            console.log('[GUILD_MESSAGES] 语音应答失败 :', err)
          })
      } else {
        const message = {
          content: replyToQQGuild?.text ?? '',
          msg_id: replyMsgID,
          image: replyToQQGuild?.image ?? '',
        }

        qqGuildClient.messageApi
          .postMessage(channelID, message)
          .then((res) => {
            console.log('[GUILD_MESSAGES] 插件应答成功 :', res.data)
          })
          .catch((err) => {
            console.log('[GUILD_MESSAGES] 插件应答失败 :', err)
          })
      }
    } else {
      // 交给聊天函数处理
      const replyFlag = Math.floor(Math.random() * 100)
      if (replyFlag < config.QQBOT_REPLY_PROBABILITY) {
        const chatReply = await chatProcess(content)
        if (chatReply) {
          console.log(`对于QQ频道Bot端聊天 ${content} ，小夜回复 ${chatReply}`.log)
          const message = {
            content: chatReply,
            msg_id: replyMsgID,
          }

          qqGuildClient.messageApi
            .postMessage(channelID, message)
            .then((res) => {
              console.log('[GUILD_MESSAGES] 聊天应答成功 :', res.data)
            })
            .catch((err) => {
              console.log('[GUILD_MESSAGES] 聊天应答失败 :', err)
            })
        }
      }
    }
  })
}

module.exports = {
  ProcessGuildMessage,
  StartQQGuild,
}
