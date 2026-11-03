'use strict'

const {createProactiveChat} = require('../src/plugins/proactiveChat')

module.exports = {
  插件名: '主动聊天插件',
  指令: '',
  版本: '1.0',
  作者: 'Giftina',
  描述: '观察目标群上下文，主动调度由宿主显式启动和停止。',
  使用示例: '由宿主启用主动聊天',
  预期返回: '',

  init({proactiveChat, generateProactive, sendProactive, canSendProactive, logger, groupIds = []} = {}) {
    this.runtime?.stop()
    this.runtime = proactiveChat ?? (typeof generateProactive === 'function' && typeof sendProactive === 'function'
      ? createProactiveChat({generate: generateProactive, send: sendProactive, canSend: canSendProactive, logger, groupIds}) : null)
  },

  async execute(msg, userId, userName, groupId, groupName, options = {}) {
    this.runtime?.observe({groupId, userId, userName, groupName, content: msg, targetId: options.targetId, raw: options.raw,
      platform: options.platform ?? options.type ?? 'onebot', messageType: options.messageType ?? (groupId ? 'group' : 'private'),
      isBot: options.isBot, isSelf: options.isSelf, selfId: options.selfId ?? options.self_id,
      muted: options.muted, isMuted: options.isMuted, canSend: options.canSend, allowProactive: options.allowProactive,
      role: options.role, timestamp: options.timestamp})
    return undefined
  },

  start() { return this.runtime?.start() ?? {status: 'skipped', reason: 'not-configured'} },
  stop() { return this.runtime?.stop() ?? {status: 'stopped'} },
  observe(context) { return this.runtime?.observe(context) ?? {status: 'skipped', reason: 'not-configured'} },
  triggerNow(context) { return this.runtime?.triggerNow(context) ?? Promise.resolve({status: 'skipped', reason: 'no-context'}) },
  demonstrate(context, options) {
    return this.runtime?.demonstrate(context, options) ?? Promise.resolve({status: 'skipped', reason: 'not-configured'})
  },
}
