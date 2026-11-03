'use strict'

const {readCredentials} = require('./credentials')
const {toMessageContext} = require('./context')
const {sendResponse} = require('./response')

async function startQQOfficial({
  config,
  logger = console,
  execute,
  chatProcess,
  loadSdk = () => import('@tencent-connect/qqbot-nodejs'),
  getCredentials = readCredentials,
}) {
  let state = 'disabled'
  let bot
  let stopped = false
  let lifetime
  const controller = {
    getState: () => state,
    async stop() {
      stopped = true
      state = 'stopped'
      if (bot) {
        await bot.stop()
        await lifetime
      }
    },
  }
  if (!config.CONNECT_QQ_OFFICIAL_SWITCH) return controller
  try {
    const credentials = getCredentials({config})
    if (!credentials) {
      state = 'unbound'
      logger.warn('QQ官方机器人未绑定，请运行 npm run qq:official:bind')
      return controller
    }
    const sdk = await loadSdk()
    // SDK diagnostics must not copy credentials or raw API payloads into shared logs.
    const sdkLogger = {
      info() {}, debug() {},
      warn: () => logger.warn('QQ官方 SDK 警告'),
      error: () => logger.error('QQ官方 SDK 错误'),
    }
    bot = new sdk.QQBot({
      ...credentials, transport: 'websocket', logger: sdkLogger,
      baseUrl: 'https://api.bot.qq.com', tokenBaseUrl: 'https://api.bot.qq.com',
    })
    const access = config.QQ_OFFICIAL_ACCESS ?? {}
    bot.use(sdk.accessPolicy({
      c2c: {mode: access.c2cMode ?? 'open', allow: access.c2cAllow ?? []},
      group: {mode: access.groupMode ?? 'open', allow: access.groupAllow ?? []},
      guild: {mode: 'disabled'},
    }))
    bot.use(sdk.messageFilter({skipSelfEcho: true, dedup: {windowMs: 120000}}))
    bot.use(sdk.mentionGate({requireMentionInGroup: true}))
    bot.use(sdk.contentSanitizer({stripBotMention: true}))
    bot.use(sdk.rateLimiter({
      perSender: {max: 12, windowMs: 60000},
      perGroup: {max: 30, windowMs: 60000},
      global: {max: 60, windowMs: 60000},
      onLimit: () => logger.warn('QQ官方消息已限流'),
    }))
    let pending = 0
    bot.use(async (ctx, next) => {
      if (stopped || pending >= 64) {
        ctx.stop('qqOfficial:busy')
        return
      }
      pending++
      try { await next() } finally { pending-- }
    })
    bot.use(sdk.concurrencyGuard({strategy: 'queue', maxQueue: 3}))
    bot.on('message', async (ctx) => {
      if (stopped || ctx.signal?.aborted) return
      const context = toMessageContext(ctx.message, credentials.appId)
      if (!context) return
      const startedAt = Date.now()
      try {
        if (!context.text) {
          await sendResponse({bot, target: context.raw.replyTarget, response: {type: 'text', content: '请发送文字消息'}})
          return
        }
        const response = await execute(context)
        const reply = response.handled === false
          ? {type: 'text', content: await withTimeout(chatProcess(context.text), 12000)}
          : response
        if (stopped || ctx.signal?.aborted) return
        await sendResponse({bot, target: context.raw.replyTarget, response: reply})
        logger.info(`QQ官方消息已处理 platform=qqOfficial elapsedMs=${Date.now() - startedAt}`)
      } catch {
        // A failed/unknown send must not cause a second message or replay plugin side effects.
        logger.error(`QQ官方消息处理或发送失败 elapsedMs=${Date.now() - startedAt}`)
      }
    })
    bot.on('ready', () => {
      if (stopped) return
      state = 'ready'
      logger.info('QQ官方机器人已连接')
    })
    bot.on('resumed', () => { if (!stopped) state = 'ready' })
    bot.on('disconnected', (event) => {
      if (stopped) return
      state = event.willReconnect ? 'reconnecting' : 'blocked'
      logger.warn(`QQ官方连接断开 code=${Number(event.code) || 0} state=${state}`)
    })
    bot.on('error', () => logger.error('QQ官方连接错误，请检查网络及机器人授权'))
    state = 'connecting'
    lifetime = Promise.resolve().then(() => bot.start()).catch(() => {
      if (!stopped) {
        state = 'blocked'
        logger.error('QQ官方启动失败，请检查凭据、网络及机器人授权')
      }
    })
  } catch {
    state = 'blocked'
    logger.error('QQ官方初始化失败，请检查凭据文件和运行环境')
    if (bot) {
      try { await bot.stop() } catch { logger.error('QQ官方初始化清理失败') }
    }
  }
  return controller
}

async function withTimeout(promise, timeoutMs) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => { timer = setTimeout(() => resolve('聊天响应超时，请稍后再试'), timeoutMs) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

module.exports = {startQQOfficial}
