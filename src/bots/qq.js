/**
 * QQ机器人集成模块 (OneBot协议)
 * 处理QQ群聊和私聊消息
 */

const axios = require('axios').default

const Constants = require('../../config/constants.js')
const {createOneBotSender, buildOneBotUrl} = require('../platforms/oneBotSender')
const {handleQQChatReply, getQQChatText, formatQQChatReply} = require('./qq/chatReply')
const {createConversationRuntime} = require('../plugins/conversationRuntime')
const {handleQQEventPreflight} = require('./qq/eventPreflight')
const {
  ensureGroupServiceEnabled,
  handleCloseServiceCommand,
  handleOpenServiceCommand,
  isGroupServiceEvent,
} = require('./qq/groupServiceGate')
const {handleQQMediaBridge} = require('./qq/mediaBridge')
const {handleQQPluginReply} = require('./qq/pluginBridge')
const {registerOneBotWebhook} = require('./qq/webhook')
const {createMessageIngress} = require('./qq/messageIngress')
const {ProcessGuildMessage} = require('./qqGuild')

const runtime = {
  config: {},
  logger: console,
  utils: null,
  axios,
  oneBotSender: createOneBotSender({apiUrl: '127.0.0.1:5700', axios}),
  c1cCount: 0,
}

function configureQQRuntime({config, logger, utils, axios: injectedAxios}) {
  if (config) runtime.config = config
  if (logger) runtime.logger = logger
  if (utils) runtime.utils = utils
  if (injectedAxios) runtime.axios = injectedAxios
  runtime.oneBotSender = createOneBotSender({
    apiUrl: runtime.config.ONE_BOT_API_URL ?? '127.0.0.1:5700',
    axios: runtime.axios,
  })
}

/**
 * 发送QQ群消息
 * @param {string} message - 要发送的消息
 * @param {Object} event - 事件对象，包含group_id
 */
async function sendMessageToQQGroup(message, event) {
  await runtime.oneBotSender.sendGroupMessage(event.group_id, message)
}

/**
 * 发送QQ私聊消息
 * @param {string} message - 要发送的消息
 * @param {Object} event - 事件对象，包含user_id
 */
async function sendMessageToQQ(message, event) {
  await runtime.oneBotSender.sendPrivateMessage(event.user_id, message)
}

/**
 * 发送插件回复到QQ
 * @param {Object} pluginsReply - 插件回复对象
 * @param {Object} event - 事件对象
 */
async function sendPluginsReplyToQQ(pluginsReply, event) {
  const replyToQQ = runtime.utils.PluginAnswerToGoCqhttpStyle(pluginsReply)
  await runtime.oneBotSender.sendGroupMessage(event.group_id, replyToQQ)
}

/**
 * 处理戳一戳事件
 * @param {Object} event - 戳一戳事件对象
 */
async function poked(event) {
  runtime.logger.info('小夜被戳了'.log)
  runtime.c1cCount++

  if (runtime.c1cCount > 2) {
    runtime.logger.info(`小夜被戳坏了，${event.user_id} 被禁言10s`.error)
    runtime.c1cCount = 0
    await runtime.axios.get(
      buildOneBotUrl(runtime.config.ONE_BOT_API_URL, 'send_group_msg', {
        group_id: event.group_id, message: runtime.config.QQ_GROUP_POKE_BOOM_REPLY_MESSAGE,
      }),
    )
    await runtime.axios.get(
      buildOneBotUrl(runtime.config.ONE_BOT_API_URL, 'set_group_ban', {
        group_id: event.group_id, user_id: event.user_id, duration: 10,
      }),
    )
  } else {
    // 被戳的回复
    await runtime.axios.get(
      buildOneBotUrl(runtime.config.ONE_BOT_API_URL, 'send_group_msg', {
        group_id: event.group_id, message: runtime.config.QQ_GROUP_POKE_REPLY_MESSAGE,
      }),
    )
  }
}

/**
 * 启动QQ机器人 (OneBot协议)
 * @param {Object} config - 配置对象
 * @param {Function} ECYWenDa - 问答功能
 * @param {Function} ProcessExecute - 插件处理函数
 * @param {Object} dependencies - 依赖对象，包含logger, utils, axios等
 */
async function StartQQBot({
  config,
  ecYWenDa: ECYWenDa,
  processExecute: ProcessExecute,
  chatProcess: ChatProcess,
  matchChat,
  fallback: injectedFallback,
  executeFallback,
  conversation,
  legacyReplyMode = false,
  logger,
  utils,
  app,
  io,
  plugins,
  axios: injectedAxios = axios,
}) {
  configureQQRuntime({config, logger, utils, axios: injectedAxios})
  const axios = injectedAxios
  const oneBotSender = runtime.oneBotSender
  const games = new Map()
  const messageIngress = createMessageIngress()
  const cancelled = Symbol('QQ runtime stopped or game replaced')
  let stopped = false
  let ready = false
  let stopping
  let groupConversation, privateConversation, proactive
  const fallback = injectedFallback ?? executeFallback

  const isCurrent = (game) => !stopped && (!game || games.get(game.groupId) === game)
  const step = async (game, action) => {
    if (!isCurrent(game)) throw cancelled
    const result = await action()
    if (!isCurrent(game)) throw cancelled
    return result
  }
  const clearGame = (groupId) => {
    const key = String(groupId)
    const game = games.get(key)
    if (!game) return
    games.delete(key)
    for (const timer of game.timers) clearTimeout(timer)
    game.timers.clear()
    return game
  }
  const getGame = (groupId) => {
    const key = String(groupId)
    if (!games.has(key)) games.set(key, {groupId: key, timers: new Set()})
    return games.get(key)
  }
  const reportAsyncError = (code = 'QQ 异步任务失败') => {
    // Transport errors may contain tokens, URLs or message bodies.
    try { logger.error(code) } catch (_) { /* Logging must not reject a detached task. */ }
  }
  const schedule = (game, action, delay, final = false) => {
    if (!isCurrent(game)) return
    const timer = setTimeout(async () => {
      game.timers.delete(timer)
      if (!isCurrent(game)) return
      try {
        await action()
      } catch (error) {
        if (error !== cancelled && isCurrent(game)) reportAsyncError()
      } finally {
        if (final && isCurrent(game)) clearGame(game.groupId)
      }
    }, delay)
    game.timers.add(timer)
  }
  const stop = () => {
    stopped = true
    messageIngress.clear()
    for (const groupId of games.keys()) clearGame(groupId)
    if (!stopping) {
      stopping = Promise.allSettled([() => proactive?.stop(), () => groupConversation?.stop(), () => privateConversation?.stop()]
        .map((close) => Promise.resolve().then(close))).then((results) => {
        if (results.some((result) => result.status === 'rejected')) {
          reportAsyncError('QQ_STOP_FAILED')
          throw Object.assign(new Error('QQ_STOP_FAILED'), {code: 'QQ_STOP_FAILED'})
        }
      })
    }
    return stopping
  }
  const sendMessageToQQGroup = (message, event) => step(null, () => oneBotSender.sendGroupMessage(event.group_id, message))
  const sendMessageToQQ = (message, event) => step(null, () => oneBotSender.sendPrivateMessage(event.user_id, message))

  const conversationContext = (event) => {
    const text = getQQChatText(event)
    if (!text.replace(/\[CQ:[^\]]*\]/g, '').trim() || String(event.user_id) === String(event.self_id)) return null
    const group = event.message_type === 'group'
    return {text, platform: 'qq', selfId: event.self_id, userId: event.user_id, userName: event.sender?.nickname ?? '',
      groupId: group ? event.group_id : undefined, groupName: event.group_name ?? '',
      targetId: group ? event.group_id : event.user_id, raw: {scope: group ? 'group' : 'private', event}}
  }
  const updateHistory = async (action) => {
    try { await step(null, action) } catch (error) {
      if (error !== cancelled && !stopped) reportAsyncError()
    }
  }
  const notifyMessage = (context) => {
    if (context.raw?.scope === 'group') {
      try { proactive?.observe(context) } catch (_) { reportAsyncError('QQ_PROACTIVE_OBSERVE_FAILED') }
    }
    return conversation.onMessage?.(context)
  }
  if (conversation) {
    const options = {...conversation, logger, onMessage: notifyMessage,
      send: async (context, reply) => {
        const content = (!reply.type || reply.type === 'text') && typeof reply.content === 'string'
          ? formatQQChatReply(reply.content, context.userId) : utils.PluginAnswerToGoCqhttpStyle(reply)
        if (typeof content !== 'string') throw new Error('QQ_RESPONSE_FORMAT_INVALID')
        await step(null, () => context.groupId == null ? oneBotSender.sendPrivateMessage(context.targetId, content) :
          oneBotSender.sendGroupMessage(context.targetId, content))
        return content
      },
    }
    // Group plugins already ran before built-in games; do not execute them twice.
    groupConversation = createConversationRuntime({...options, onMessage: () => {}, execute: async () => ({handled: false})})
    privateConversation = createConversationRuntime(options)
  }

  const handleEvent = async (event) => {
    if (!ready || stopped) return 0
    if (messageIngress.shouldIgnore(event)) return 0
    try {
      return await processEvent(event)
    } catch (error) {
      if (error !== cancelled) throw error
      return 0
    }
  }

  registerOneBotWebhook({
    app,
    config,
    path: config.ONE_BOT_ANTI_POST_API,
    handleEvent,
    isReady: () => ready && !stopped,
    logger,
  })

  const processEvent = async (event) => {
    const handledByPreflight = await handleQQEventPreflight({
      event,
      config,
      logger,
      io,
      oneBotSender,
      processExecute: ProcessExecute,
      chatProcess: ChatProcess,
      utils,
      processGuildMessage: ProcessGuildMessage,
    })
    if (handledByPreflight) {
      return 0
    }
    if (stopped) return 0

    const handledByMediaBridge = handleQQMediaBridge({
      event,
      config,
      constants: Constants,
      utils,
      io,
      logger,
    })
    if (handledByMediaBridge) {
      return 0
    }

    // 群服务开关判断
    if (isGroupServiceEvent(event)) {
      const handledOpenServiceCommand = await handleOpenServiceCommand({
        event,
        config,
        constants: Constants,
        logger,
        utils,
        oneBotSender,
      })
      if (handledOpenServiceCommand) {
        return 0
      }

      const groupServiceEnabled = await ensureGroupServiceEnabled({event, utils, logger})
      if (stopped) return 0
      if (!groupServiceEnabled) {
        if (clearGame(event.group_id)) await step(null, () => utils.EndGroupLoopBombGame(event.group_id))
        return 0
      }

      // 服务启用了，允许进入后续的指令系统
      const groupContext = conversation ? conversationContext(event) : null
      if (groupContext) await updateHistory(() => notifyMessage(groupContext))

          // 群欢迎
          if (event.notice_type === 'group_increase') {
            console.log(`${event.user_id} 加入了群 ${event.group_id}，小夜欢迎了ta`.log)
            const welcomeMessage = config.QQ_GROUP_WELCOME_MESSAGE.replace(/@新人/g, `[CQ:at,qq=${event.user_id}]`)
            await axios.get(
              buildOneBotUrl(config.ONE_BOT_API_URL, 'send_group_msg', {
                group_id: event.group_id, message: welcomeMessage,
              }),
            )
            // 在小夜加入新群后，将新群写入群服务表
            await utils.AddNewGroup(event.group_id)
            return 0
          }

          // 地雷爆炸判断，先判断这条消息是否引爆，再从数据库取来群地雷数组，引爆后删除地雷，原先的地雷是用随机数生成被炸前最大回复作为引信，现在换一种思路，用更简单的随机数引爆
          const boom = Math.floor(Math.random() * 100) < 10 // 踩中地雷的概率为10%
          // 如果判定踩中，检查该群是否有雷
          if (boom) {
            const mine = await utils.GetGroupMine(event.group_id)

            if (mine) {
              // 先把地雷排掉
              await utils.DeleteGroupMine(mine.id)

              // 判断是否哑雷
              const isDumb = Math.floor(Math.random() * 100) < 30 // 哑雷的概率为30%
              if (isDumb) {
                console.log(`${mine.owner} 在群 ${mine.groupId} 埋的地雷被踩中，但这是一颗哑雷`.log)
                await sendMessageToQQGroup(
                  `[CQ:at,qq=${event.user_id}]恭喜你躲过一劫，[CQ:at,qq=${mine.owner}]埋的地雷掺了沙子，是哑雷，炸了，但没有完全炸`,
                  event,
                )
              }
              // 判断是否神圣地雷
              else {
                const isHollyMine = Math.floor(Math.random() * 100) < 1 // 神圣地雷的概率为1%
                if (isHollyMine) {
                  await axios.get(
                    buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_whole_ban', {group_id: event.group_id, enable: 1}),
                  )
                  console.log(`${mine.owner} 在群 ${mine.groupId} 触发了神圣地雷`.error)
                  await sendMessageToQQGroup(
                    '噢，该死，我的上帝啊，真是不敢相信，瞧瞧我发现了什么，我发誓我没有看错，这竟然是一颗出现率为千分之一的神圣地雷！我是说，这是一颗毁天灭地的神圣地雷啊！哈利路亚！麻烦管理员解除一下',
                    event,
                  )
                }
                // 是常规地雷
                else {
                  const boomTime = Math.floor(Math.random() * 60 * 2) // 造成伤害时间，2分钟内
                  console.log(`${mine.owner} 在群 ${mine.groupId} 埋的地雷被引爆，伤害时间${boomTime}秒`.log)
                  await axios.get(
                    buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_ban', {
                      group_id: mine.groupId, user_id: event.user_id, duration: boomTime,
                    }),
                  )
                  await sendMessageToQQGroup(
                    `[CQ:at,qq=${event.user_id}]恭喜你，被[CQ:at,qq=${mine.owner}]所埋地雷炸伤，休养生息${boomTime}秒!`,
                    event,
                  )
                }
              }
              return 0 // 踩中实际存在的地雷后不再处理消息
            }
          }

          // 服务停用开关
          const handledCloseServiceCommand = await handleCloseServiceCommand({
            event,
            config,
            constants: Constants,
            utils,
            oneBotSender,
            logger,
          })
          if (handledCloseServiceCommand) {
            const closesThisBot = event.message === '闭菊' || Constants.has_at_qq_reg.exec(event.message)?.[1] == event.self_id
            if (closesThisBot && clearGame(event.group_id)) {
              await step(null, () => utils.EndGroupLoopBombGame(event.group_id))
            }
            return 0
          }

          // qq端插件应答器
          let pluginResult
          const pluginSender = groupContext ? {...oneBotSender,
            getGroupInfo: async (...args) => {
              const response = await step(null, () => oneBotSender.getGroupInfo(...args))
              groupContext.groupName = response.data.data.group_name
              return response
            },
            sendGroupMessage: async (groupId, content) => {
              await updateHistory(() => conversation.observe?.(groupContext))
              await step(null, () => oneBotSender.sendGroupMessage(groupId, content))
              if ((!pluginResult?.type || pluginResult.type === 'text') && !pluginResult?.timeout && !pluginResult?.safeError &&
                typeof content === 'string') {
                await updateHistory(() => conversation.recordReply?.(groupContext, content))
              }
            },
          } : oneBotSender
          const pluginsReply = await handleQQPluginReply({
            event,
            processExecute: groupContext ? async (...args) => {
              pluginResult = await step(null, () => ProcessExecute(...args))
              return pluginResult
            } : ProcessExecute,
            oneBotSender: pluginSender,
            utils,
          })
          if (pluginsReply != '') {
            return 0
          }

          // 戳一戳
          if (event.sub_type === 'poke' && event.target_id == event.self_id) {
            await poked(event)
            return 0
          }

          // 嘴臭，小夜的回复转化为语音
          if (Constants.come_yap_reg.test(event.message)) {
            const message = event.message.match(Constants.come_yap_reg)[1]
            const syslog = `群 ${event.group_id} 的 ${event.user_id} (${event.sender.nickname}) 对线说: ${message}`
            logger.info(syslog.log)
            io.emit('system', syslog)
            try {
              const reply = await step(null, () => ChatProcess(message))
              const resolve = await step(null, () => plugins.tts.execute(`吠 ${reply}`))
              const tts_file = `[CQ:record,file=http://127.0.0.1:${config.WEB_PORT}${resolve.file},url=http://127.0.0.1:${config.WEB_PORT}${resolve.file}]`
              await sendMessageToQQGroup(tts_file, event)
            } catch (error) {
              if (error !== cancelled && !stopped) reportAsyncError()
            }
            return 0
          }

          // 伪造转发
          if (Constants.fake_forward_reg.test(event.message)) {
            let who,
              name = event.sender.nickname,
              text,
              xiaoye_say,
              requestData
            if (event.message == '强制迫害') {
              who = event.sender.user_id // 如果没有要求迫害谁，那就是迫害自己
            } else {
              let msg = event.message + ' ' // 结尾加一个空格防爆

              msg = msg.substr(4).split(' ')
              who = msg[1].trim() // 谁
              text = msg[2].trim() // 说啥
              xiaoye_say = msg[3].trim() // 小夜说啥
              who = event.message.match(Constants.fake_forward_reg)[1]
              who = who.replace('[CQ:at,qq=', '').replace(']', '').trim()
              if (Constants.is_qq_reg.test(who)) {
                console.log(`群 ${event.group_id} 的 群员 ${event.user_id} 强制迫害 ${who}`.log)
              } else {
                // 目标不是qq号
                who = event.sender.user_id // 如果没有要求迫害谁，那就是迫害自己
              }
            }

            if (!name) {
              name = event.sender.nickname
            }

            if (!text) {
              text = '我是群友专用RBQ'
            }

            if (!xiaoye_say) {
              xiaoye_say =
                '[CQ:image,file=1ea870ec3656585d4a81e13648d66db5.image,url=https://gchat.qpic.cn/gchatpic_new/1277161008/2063243247-2238741340-1EA870EC3656585D4A81E13648D66DB5/0?term=3]'
            }

            try {
              try {
                const response = await step(null, () => axios.get(
                  buildOneBotUrl(config.ONE_BOT_API_URL, 'get_group_member_info', {
                    group_id: event.group_id, user_id: who, no_cache: 0,
                  }),
                ))
                name = response.data.data.nickname
              } catch (error) {
                if (error === cancelled) throw error
                // Preserve the original nickname fallback when lookup fails.
              }
              requestData = {
                group_id: event.group_id,
                messages: [
                  {type: 'node', data: {name, uin: who, content: text}},
                  {type: 'node', data: {name: '星野夜蝶Official', uin: '1648468212', content: xiaoye_say}},
                ],
              }
              const response = await step(null, () => axios.post(
                buildOneBotUrl(config.ONE_BOT_API_URL, 'send_group_forward_msg'), requestData,
                {headers: {'content-type': 'application/json'}},
              ))
              if (response.status === 200) console.log(response.data)
            } catch (error) {
              if (error !== cancelled && !stopped) reportAsyncError()
            }
            return 0
          }

          // 埋地雷
          if (Constants.mine_reg.test(event.message)) {
            // 搜索地雷库中现有地雷
            const mines = await utils.GetGroupAllMines(event.group_id)

            // 该群是否已经达到最大共存地雷数
            if (mines.length < config.QQBOT_MAX_MINE_AT_MOST) {
              // 地雷还没满，增加群地雷
              await utils.AddOneGroupMine(event.group_id, event.user_id)

              console.log(`${event.user_id} 在群 ${event.group_id} 埋了一颗地雷`.log)
              await sendMessageToQQGroup(`大伙注意啦![CQ:at,qq=${event.user_id}]埋雷干坏事啦!`, event)
            }
            // 雷满了，不能埋了
            else {
              console.log(`群 ${event.group_id} 的地雷满了`.log)
              await sendMessageToQQGroup(
                `[CQ:at,qq=${event.user_id}] 这个群的地雷已经塞满啦，等有幸运群友踩中地雷之后再来埋吧`,
                event,
              )
            }

            return 0
          }

          // 踩地雷
          if (Constants.fuck_mine_reg.test(event.message)) {
            // 搜索地雷库中现有地雷
            const mine = await utils.GetGroupMine(event.group_id)

            if (mine) {
              // 先把地雷排掉
              await utils.DeleteGroupMine(mine.id)

              // 有雷，直接炸
              const boomTime = Math.floor(Math.random() * 60 * 3) + 60 // 造成伤害时间，随机在60-180秒内
              console.log(`${mine.owner} 在群 ${mine.groupId} 埋的地雷被排爆`.log)
              await axios.get(
                buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_ban', {
                  group_id: mine.groupId, user_id: event.user_id, duration: boomTime,
                }),
              )
              await sendMessageToQQGroup(
                `[CQ:at,qq=${event.user_id}] 踩了一脚地雷，为什么要想不开呢，被[CQ:at,qq=${mine.owner}]所埋地雷炸成重伤，休养生息${boomTime}秒!`,
                event,
              )
            } else {
              // 没有雷
              await sendMessageToQQGroup(
                `[CQ:at,qq=${event.user_id}] 这个雷区里的雷似乎已经被勇士们排干净了，不如趁现在埋一个吧!`,
                event,
              )
            }

            return 0
          }

          // 希望的花
          if (Constants.hope_flower_reg.test(event.message)) {
            let who
            let boomTime = Math.floor(Math.random() * 30) // 造成0-30伤害时间
            if (event.message === '希望的花') {
              console.log(`群 ${event.group_id} 的群员 ${event.user_id} 朝自己丢出一朵希望的花`.log)
              await sendMessageToQQGroup('团长，你在做什么啊！团长！希望的花，不要乱丢啊啊啊啊', event)
              return 0
            } else {
              who = Constants.has_at_qq_reg.exec(event.message)[1]
              if (Constants.is_qq_reg.test(who)) {
                console.log(`群 ${event.group_id} 的 群员 ${event.user_id} 向 ${who} 丢出一朵希望的花`.log)
              } else {
                // 目标不是qq号
                await sendMessageToQQGroup(
                  `团长，你在做什么啊！团长！希望的花目标不可以是${who}，不要乱丢啊啊啊啊`,
                  event,
                )
                return 0
              }
            }

            // 先救活目标
            await axios.get(
              buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_ban', {
                group_id: event.group_id, user_id: who, duration: 0,
              }),
            )
            console.log(`群 ${event.group_id} 的 群员 ${event.user_id} 救活了 ${who}`.log)
            await sendMessageToQQGroup(
              `团长，团长你在做什么啊团长，团长！为什么要救他啊，哼，呃，啊啊啊啊啊啊啊啊啊啊啊啊啊啊啊！！！团长救下了[CQ:at,qq=${who}]，但自己被炸飞了，休养生息${boomTime}秒！不要停下来啊！`,
              event,
            )

            // 再禁言团长
            await axios.get(
              buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_ban', {
                group_id: event.group_id, user_id: event.user_id, duration: boomTime,
              }),
            )
            console.log(`${event.user_id} 团长自己被炸伤${boomTime}秒`.log)
            return 0
          }

          // 击鼓传雷
          if (Constants.loop_bomb_reg.test(event.message)) {
            // 先检查群有没有开始游戏
            const loopBombGame = await step(null, () => utils.GetGroupLoopBombGameStatus(event.group_id))

            // 判断游戏开关，没有开始的话就开始游戏，如果游戏已经超时结束了的话就重新开始
            if (!loopBombGame.loopBombEnabled || 60 - process.hrtime([loopBombGame.loopBombStartTime, 0])[0] < 0) {
              clearGame(event.group_id)
              const game = getGame(event.group_id)
              // 游戏开始
              const text = '击鼓传雷游戏开始啦，这是一个只有死亡才能结束的游戏，做好准备了吗'
              await step(game, () => axios.get(
                buildOneBotUrl(config.ONE_BOT_API_URL, 'send_group_msg', {group_id: event.group_id, message: text}),
              ))
              console.log(`群 ${event.group_id} 开始了击鼓传雷`.log)

              // 给发起人出题，等待ta回答
              const wenDa = await step(game, () => ECYWenDa(config))

              const question = `那么[CQ:at,qq=${event.user_id}]请听题：${wenDa.question} 请按如下格式告诉小夜：击鼓传雷 你的答案，时间剩余59秒`

              // 把答案、持有人、开始时间存入数据库
              await step(game, () => utils.StartGroupLoopBombGame(event.group_id, wenDa.answer, event.user_id, process.hrtime()[0]))

              // 金手指
              await step(game, () => axios.get(
                buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_card', {
                  group_id: event.group_id, user_id: event.user_id, card: wenDa.answer,
                }),
              ))

              // 丢出问题
              schedule(game, async () => {
                await step(game, () => axios.get(
                  buildOneBotUrl(config.ONE_BOT_API_URL, 'send_group_msg', {
                    group_id: event.group_id, message: question,
                  }),
                ))
              }, 1000)

              // 开始倒计时，倒计时结束宣布游戏结束
              schedule(game, async () => {
                console.log(`群 ${event.group_id} 的击鼓传雷到达时间，炸了`.log)
                const boomTime = Math.floor(Math.random() * 60 * 3) + 60 // 造成伤害时间，随机在60-180秒内

                // 获取这个雷现在是谁手上，炸ta
                const {bombHolder, bombAnswer} = await step(game, () => utils.GetGroupLoopBomb(event.group_id))

                await step(game, () => axios.get(
                  buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_ban', {
                    group_id: event.group_id, user_id: bombHolder, duration: boomTime,
                  }),
                ))
                console.log(`${bombHolder} 在群 ${event.group_id} 回答超时，被炸伤${boomTime}秒`.log)

                // 金手指关闭
                await step(game, () => axios.get(
                  buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_card', {
                    group_id: event.group_id, user_id: bombHolder, card: '',
                  }),
                ))

                const gameOverContent = `时间到了，pia，雷在[CQ:at,qq=${bombHolder}]手上炸了，你被炸成重伤了，休养生息${boomTime}秒！游戏结束！下次加油噢，那么答案公布：${bombAnswer}`

                await step(game, () => axios.get(
                  buildOneBotUrl(config.ONE_BOT_API_URL, 'send_group_msg', {
                    group_id: event.group_id, message: gameOverContent,
                  }),
                ))

                // 游戏结束，清空数据
                await step(game, () => utils.EndGroupLoopBombGame(event.group_id))

                return 0
              }, 1000 * 60, true)
            }
            // 已经开始游戏了，判断答案对不对
            else {
              const game = getGame(event.group_id)
              let playerAnswer = event.message
              playerAnswer = playerAnswer.replace('击鼓传雷 ', '')
              playerAnswer = playerAnswer.replace('击鼓传雷', '')
              playerAnswer = playerAnswer.trim()

              // 从数据库里取答案判断
              const {bombHolder, bombAnswer} = await step(game, () => utils.GetGroupLoopBomb(event.group_id))

              // 判断答案 loop_bomb_answer
              if (bombAnswer == playerAnswer) {
                let reply = ''

                // 答对了
                if (bombHolder != event.user_id) {
                  // 不是本人回答，是来抢答的，无论对错都惩罚
                  console.log(`抢答了，${event.user_id} 被禁言`.log)
                  reply = `[CQ:at,qq=${event.user_id}] 抢答正确！答案确实是 ${bombAnswer} ！但因为抢答了别人的题目所以被惩罚了！`

                  // 金手指关闭
                  await step(game, () => axios.get(
                    buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_card', {
                      group_id: event.group_id, user_id: bombHolder, card: '',
                    }),
                  ))

                  // 禁言这个游戏周期
                  await step(game, () => axios.get(
                    buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_ban', {
                      group_id: event.group_id, user_id: event.user_id, duration: 60,
                    }),
                  ))
                }
                // 回答正确
                else {
                  console.log(`${bombHolder} 回答正确`.log)
                  reply = `[CQ:at,qq=${event.user_id}] 回答正确！答案确实是 ${bombAnswer} ！`

                  // 金手指关闭
                  await step(game, () => axios.get(
                    buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_card', {
                      group_id: event.group_id, user_id: bombHolder, card: '',
                    }),
                  ))
                }

                // 答题成功，返回消息
                await step(game, () => axios.get(
                  buildOneBotUrl(config.ONE_BOT_API_URL, 'send_group_msg', {
                    group_id: event.group_id, message: reply,
                  }),
                ))

                // 把雷传给随机幸运群友，进入下一题
                schedule(game, async () => {
                  // 随机选一位幸运群友
                  const response = await step(game, () => axios.get(
                    buildOneBotUrl(config.ONE_BOT_API_URL, 'get_group_member_list', {group_id: event.group_id}),
                  ))
                  const members = response.data.data
                  const randomMember = members[Math.floor(Math.random() * members.length)].user_id
                  console.log(`随机选取一个群友 ${randomMember} 给他下一题`.log)

                  // 开始下一轮游戏，，给幸运群友出题，等待ta回答

                  console.log(`群 ${event.group_id} 开始了下一轮击鼓传雷`.log)

                  //获取剩余时间
                  const {bombStartTime} = await step(game, () => utils.GetGroupLoopBomb(event.group_id))
                  const diff = 60 - process.hrtime([bombStartTime, 0])[0] // 剩余时间

                  const wenDa = await step(game, () => ECYWenDa(config))

                  const question = `抽到了幸运群友[CQ:at,qq=${randomMember}]！请听题：${wenDa.question} 请按如下格式告诉小夜：击鼓传雷 你的答案，时间还剩余${diff}秒`

                  // 把答案、持有人存入数据库
                  await step(game, () => utils.UpdateGroupLoopBombGame(event.group_id, wenDa.answer, randomMember))

                  // 金手指
                  await step(game, () => axios.get(
                    buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_card', {
                      group_id: event.group_id, user_id: event.user_id, card: wenDa.answer,
                    }),
                  ))

                  // 丢出问题
                  schedule(game, async () => {
                    await step(game, () => axios.get(
                      buildOneBotUrl(config.ONE_BOT_API_URL, 'send_group_msg', {
                        group_id: event.group_id, message: question,
                      }),
                    ))
                  }, 1000)

                  return 0
                }, 500)
              }
              // 答错了，游戏结束
              else {
                clearGame(event.group_id)
                const boomTime = Math.floor(Math.random() * 60 * 3) + 60 // 造成伤害时间
                const endGameContent = `[CQ:at,qq=${event.user_id}] 回答错误，好可惜，你被炸成重伤了，休养生息${boomTime}秒！游戏结束！下次加油噢，那么答案公布：${bombAnswer}`

                console.log(`${event.user_id} 回答错误，被炸伤${boomTime}秒`.log)

                // 禁言
                await axios.get(
                  buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_ban', {
                    group_id: event.group_id, user_id: event.user_id, duration: boomTime,
                  }),
                )

                await axios.get(
                  buildOneBotUrl(config.ONE_BOT_API_URL, 'send_group_msg', {
                    group_id: event.group_id, message: endGameContent,
                  }),
                )

                // 游戏结束，删掉游戏记录
                await utils.EndGroupLoopBombGame(event.group_id)

                // 金手指关闭
                await axios.get(
                  buildOneBotUrl(config.ONE_BOT_API_URL, 'set_group_card', {
                    group_id: event.group_id, user_id: bombHolder, card: '',
                  }),
                )
                return 0
              }
            }
            return 0
          }

          // 孤寡
          if (Constants.gu_gua_reg.test(event.message)) {
            if (event.message == '孤寡') {
              await sendMessageToQQGroup('小夜收到了你的孤寡订单，现在就开始孤寡你了噢孤寡~', event)
              utils.GuGua(event.user_id)
              return 0
            }

            const who = Constants.has_at_qq_reg.exec(event.message)[1]
            console.log(`孤寡对象：${who}`.log)
            if (Constants.is_qq_reg.test(who)) {
              await axios.get(buildOneBotUrl(config.ONE_BOT_API_URL, 'get_friend_list')).then(async (response) => {
                if (response.length != 0) {
                  // 判断 who 是否在 response.data.data 数组里
                  const userExist = response.data.data.some((item) => {
                    return item.user_id == who
                  })

                  if (userExist) {
                    console.log(`群 ${event.group_id} 的 群员 ${event.user_id} 孤寡了 ${who}`.log)
                    await sendMessageToQQGroup(
                      `小夜收到了你的孤寡订单，现在就开始孤寡[CQ:at,qq=${who}]了噢孤寡~`,
                      event,
                    )
                    await sendMessageToQQ(
                      `您好，我是孤寡小夜，您的好友 ${event.user_id} 给您点了一份孤寡套餐，请查收`,
                      {
                        user_id: who,
                      },
                    )
                    utils.GuGua(who)
                    return 0
                  }
                  // 没有加好友，不能私聊孤寡
                  else {
                    await sendMessageToQQGroup(
                      `小夜没有加[CQ:at,qq=${who}]为好友，没有办法孤寡ta呢，请先让ta加小夜为好友吧，为了补偿，小夜就在群里孤寡大家吧`,
                      event,
                    )
                    utils.QunGuGua(event.group_id)
                    return 0
                  }
                }
              })
            } else {
              // 目标不是qq号
              console.log('孤寡对象目标不是qq号')
              await sendMessageToQQGroup(`你想孤寡谁啊，目标不可以是${who}，不要乱孤寡，小心孤寡你一辈子啊`, event)
            }
            return 0
          }

          // 手动复读，复读回复中指定的消息
          if (Constants.reply_reg.test(event.message)) {
            // 从 [CQ:reply,id=-1982767585][CQ:at,qq=1005056803] 复读 消息里获取id
            const msgID = event.message.match(/\[CQ:reply,id=([^\]]+)\]/)[1].trim()
            logger.info(`收到手动复读指令，消息id: ${msgID}`.log)

            const historyMessage = (await axios.get(buildOneBotUrl(config.ONE_BOT_API_URL, 'get_msg', {message_id: msgID})))
              .data.data.message
            logger.info(`复读历史消息: ${historyMessage}`.log)
            await sendMessageToQQGroup(historyMessage, event)
            return 0
          }

          // 管理员功能: 修改聊天回复率
          if (Constants.change_reply_probability_reg.test(event.message)) {
            if (config.QQBOT_ADMIN_LIST.includes(event.user_id)) {
              const replyPercentage = event.message.match(Constants.change_reply_probability_reg)[1]
              config.QQBOT_REPLY_PROBABILITY = replyPercentage
              await sendMessageToQQGroup(`小夜回复率已修改为${replyPercentage}%`, event)
              return 0
            }
            await sendMessageToQQGroup('你不是狗管理噢，不能让小夜这样那样的', event)
            return 0
          }

          // 管理员功能: 修改聊天随机复读率
          if (Constants.change_fudu_probability_reg.test(event.message)) {
            if (config.QQBOT_ADMIN_LIST.includes(event.user_id)) {
              const fuduPercentage = event.message.match(Constants.change_fudu_probability_reg)[1]
              config.QQBOT_FUDU_PROBABILITY = fuduPercentage
              await sendMessageToQQGroup(`小夜复读率已修改为${fuduPercentage}%`, event)
              return 0
            }
            await sendMessageToQQGroup('你不是狗管理噢，不能让小夜这样那样的', event)
            return 0
          }

          if (groupConversation && groupContext && !legacyReplyMode) {
            await groupConversation.handle(groupContext)
            return 0
          }
          const handledChatReply = await handleQQChatReply({
            event,
            config,
            chatProcess: ChatProcess,
            matchChat,
            fallback,
            legacyMode: legacyReplyMode,
            logger,
            sendGroupMessage: sendMessageToQQGroup,
          })
          if (handledChatReply) {
            return 0
          }
      }

    if (event.message_type == 'private' && config.QQBOT_PRIVATE_CHAT_SWITCH == true) {
      if (privateConversation) {
        const context = conversationContext(event)
        if (context) await privateConversation.handle(context)
        return 0
      }
      if (matchChat || fallback) {
        await handleQQChatReply({event, config, chatProcess: ChatProcess, matchChat, fallback, logger,
          sendGroupMessage: sendMessageToQQ})
        return 0
      }
      // 私聊回复
      try {
        const resolve = await step(null, () => ChatProcess(event.message))
        logger.info(`小夜回复 ${resolve}`.log)
        io.emit('system', `QQ用户 ${event.user_id} 私聊: ${event.message}，小夜回复: ${resolve}`)
        await sendMessageToQQ(resolve, event)
      } catch (error) {
        if (error !== cancelled && !stopped) reportAsyncError()
      }
      return 0
    }
    return 0
  }

  logger.info('正在进行群服务初始化……'.log)
  try {
    if (await utils.InitGroupList()) {
      ready = !stopped
      logger.info('群服务初始化完成'.log)
      if (ready && typeof conversation?.createProactive === 'function') {
        try {
          proactive = conversation.createProactive({send: (context, text) => step(null,
            () => oneBotSender.sendGroupMessage(context.targetId, text))})
          if (proactive) await step(null, () => proactive.start())
        } catch (error) {
          if (error !== cancelled && !stopped) reportAsyncError('QQ_PROACTIVE_START_FAILED')
        }
      }
    } else {
      logger.error('连接QQ协议失败了，请确保协议已经启动后再启动ChatDACS'.error)
    }
  } catch {
    logger.error('ONEBOT_GROUP_INIT_FAILED')
  }
  return {stop}
}

module.exports = {
  StartQQBot,
  configureQQRuntime,
  sendMessageToQQGroup,
  sendMessageToQQ,
  _setRuntimeForTest(config) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('_setRuntimeForTest can only be called in test environment')
    }
    Object.assign(runtime, config)
    if (config.config || config.axios) {
      runtime.oneBotSender = createOneBotSender({
        apiUrl: runtime.config.ONE_BOT_API_URL ?? '127.0.0.1:5700',
        axios: runtime.axios,
      })
    }
  },
}
