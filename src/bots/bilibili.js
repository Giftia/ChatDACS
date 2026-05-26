/**
 * Bilibili直播集成模块
 * 处理Bilibili直播间弹幕和直播事件
 */

const {KeepLiveTCP} = require('bilibili-live-ws')
const fs = require('fs')
const Constants = require('../../config/constants.js')

/**
 * 启动Bilibili直播监听
 * @param {Object} config - 配置对象
 * @param {Function} ProcessExecute - 插件处理函数
 * @param {Object} dependencies - 依赖对象
 */
async function StartLive({config, processExecute, chatProcess, logger, voicePlayer, plugins}) {
  const live = new KeepLiveTCP(config.BILIBILI_LIVE_ROOM_ID)
  live.on('open', () => logger.info(`哔哩哔哩直播间 ${config.BILIBILI_LIVE_ROOM_ID} 连接成功`.log))

  live.on('live', () => {
    live.on('heartbeat', (online) => logger.info(`直播间在线人数: ${online}`.log))

    live.on('DANMU_MSG', async (data) => {
      const danmu = {
        content: data.info[1],
        userId: data.info[2][0],
        userName: data.info[2][1],
      }

      console.log(`${danmu.userName} 说: ${danmu.content}`.log)

      // 哔哩哔哩端插件应答器
      const pluginsReply =
        (await processExecute(danmu.content, danmu.userId, danmu.userName, '', '', {
          type: 'bilibili',
        })) ?? ''
      let replyToBiliBili = ''
      if (pluginsReply) {
        // 插件响应弹幕
        replyToBiliBili = pluginsReply
      } else {
        // 交给聊天函数处理
        const chatReply = await chatProcess(danmu.content)
        if (chatReply) {
          replyToBiliBili = chatReply
        }
      }

      fs.writeFileSync(Constants.TTS_FILE_RECV_PATH, `@${danmu.userName} ${replyToBiliBili}`)
      const chatReplyToTTS = await plugins.tts.execute(`吠 ${replyToBiliBili}`)

      // 如果语音合成成功的话，直接播放
      if (chatReplyToTTS.content.file) {
        const ttsFile = `${process.cwd()}/static${chatReplyToTTS.content.file}`
        voicePlayer.play(ttsFile, function (err) {
          if (err) {
            console.log('播放失败：', err)
          }
        })
      }
    })

    live.on('SEND_GIFT', (data) => {
      const gift = data.data
      console.log(`${gift.uname}送了 ${gift.num} 个 ${gift.giftName}`.log)
    })

    live.on('WELCOME', (data) => {
      const welcome = data.data
      console.log(`${welcome.uname} 进入直播间`.log)
    })

    live.on('WELCOME_GUARD', (data) => {
      const welcome = data.data
      console.log(`${welcome.uname} 进入直播间`.log)
    })
  })
}

module.exports = {
  StartLive,
}
