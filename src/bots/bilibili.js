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
  const configuredRoomId = config?.BILIBILI_LIVE_ROOM_ID
  const roomId = ['number', 'string'].includes(typeof configuredRoomId) ? Number(configuredRoomId) : NaN
  if (!Number.isSafeInteger(roomId) || roomId <= 0) {
    throw Object.assign(new Error('BILIBILI_CONFIG_INVALID'), {code: 'BILIBILI_CONFIG_INVALID'})
  }
  const live = new KeepLiveTCP(roomId)
  let stopped = false
  let ready = false
  let stopPromise
  const handlers = []
  const connect = live.connect
  // Keep the guard on this owned instance: the SDK may have queued this.connect().
  live.connect = function (...args) {
    if (!stopped) return connect.apply(this, args)
  }
  function listen(event, handler, needsReady = true) {
    const guarded = (...args) => {
      if (stopped || (needsReady && !ready)) return
      return handler(...args)
    }
    handlers.push([event, guarded])
    live.on(event, guarded)
  }
  listen('open', () => logger.info(`哔哩哔哩直播间 ${config.BILIBILI_LIVE_ROOM_ID} 连接成功`.log), false)
  listen('e', () => logger.error('BILIBILI_CONNECTION_FAILED'), false)
  listen('live', () => { ready = true }, false)

  listen('heartbeat', (online) => logger.info(`直播间在线人数: ${online}`.log))

  listen('DANMU_MSG', async (data) => {
    try {
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
      if (stopped) return
      let reply = pluginsReply
      if (!reply) {
        // 交给聊天函数处理
        reply = await chatProcess(danmu.content)
        if (stopped) return
      }
      const replyToBiliBili = typeof reply === 'string' ? reply :
        reply?.type === 'text' && typeof reply.content === 'string' ? reply.content : ''

      if (stopped || !replyToBiliBili.trim()) return
      fs.writeFileSync(Constants.TTS_FILE_RECV_PATH, `@${danmu.userName} ${replyToBiliBili}`)
      if (stopped) return
      const chatReplyToTTS = await plugins.tts.execute(`吠 ${replyToBiliBili}`)
      if (stopped) return

      // 如果语音合成成功的话，直接播放
      if (typeof chatReplyToTTS?.content?.file === 'string' && chatReplyToTTS.content.file) {
        const ttsFile = `${process.cwd()}/static${chatReplyToTTS.content.file}`
        voicePlayer.play(ttsFile, function (err) {
          if (err && !stopped) {
            logger.error('BILIBILI_PLAY_FAILED')
          }
        })
      }
    } catch {
      if (!stopped) logger.error('BILIBILI_EVENT_FAILED')
    }
  })

  listen('SEND_GIFT', (data) => {
    const gift = data.data
    console.log(`${gift.uname}送了 ${gift.num} 个 ${gift.giftName}`.log)
  })

  listen('WELCOME', (data) => {
    const welcome = data.data
    console.log(`${welcome.uname} 进入直播间`.log)
  })

  listen('WELCOME_GUARD', (data) => {
    const welcome = data.data
    console.log(`${welcome.uname} 进入直播间`.log)
  })
  return {
    stop() {
      if (stopped) return stopPromise
      stopped = true
      stopPromise = (async () => {
        for (const [event, handler] of handlers) live.removeListener(event, handler)
        const connection = live.connection
        let failed = false
        try { live.close() } catch { failed = true }
        try { connection?.socket?.destroy() } catch { failed = true }
        if (failed) {
          logger.error('BILIBILI_STOP_FAILED')
          throw Object.assign(new Error('BILIBILI_STOP_FAILED'), {code: 'BILIBILI_STOP_FAILED'})
        }
      })()
      return stopPromise
    },
  }
}

module.exports = {
  StartLive,
}
