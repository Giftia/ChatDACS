'use strict'

const {textChunks} = require('../qqOfficial/response')

function createGuildDirectMessageHandler({appId, client, processExecute, chatProcess, logger = console}) {
  const seen = new Map()
  const conversations = new Map()
  let pending = 0
  let stopped = false

  async function respond(message) {
    if (stopped) return
    const conversation = JSON.stringify(['qqGuildDirect', appId, message.guild_id, message.author.id])
    const text = message.content.trim()
    if (!text) return
    try {
      const result = await processExecute(text,
        JSON.stringify(['qqGuildDirect', appId, message.author.id]), message.author.username ?? '匿名',
        conversation, '', {type: 'qqGuildDirect', selfId: appId, targetId: conversation})
      if (stopped) return
      const response = result || {type: 'text', content: await chatWithTimeout(text)}
      if (stopped) return
      const content = response.type === 'text' ? response.content : '此回复类型暂不支持频道私信'
      for (const chunk of textChunks(content)) {
        if (stopped) return
        await client.directMessageApi.postDirectMessage(message.guild_id, {content: chunk, msg_id: message.id})
      }
      logger.info('QQ频道私信应答成功')
    } catch (error) {
      const code = error?.response?.data?.code ?? error?.code
      logger.error(`QQ频道私信处理或发送失败${typeof code === 'number' ? ` code=${code}` : ''}`)
    }
  }

  async function chatWithTimeout(text) {
    let timer
    try {
      return await Promise.race([
        Promise.resolve().then(() => chatProcess(text)),
        new Promise((resolve) => { timer = setTimeout(() => resolve('聊天响应超时，请稍后再试'), 12000) }),
      ])
    } finally { clearTimeout(timer) }
  }

  async function handle(event) {
    if (stopped) return
    if (event?.eventType && event.eventType !== 'DIRECT_MESSAGE_CREATE') return
    const message = event?.msg
    if (!message || message.author?.bot || typeof message.content !== 'string' ||
        ![message.id, message.guild_id, message.author?.id].every((value) => typeof value === 'string' && value)) return
    const key = JSON.stringify([appId, message.guild_id, message.author.id])
    const eventKey = JSON.stringify([key, message.id])
    const now = Date.now()
    for (const [id, time] of seen) if (now - time > 300000) seen.delete(id)
    if (seen.has(eventKey)) return
    const state = conversations.get(key) ?? {tail: Promise.resolve(), size: 0}
    if (pending >= 32 || state.size >= 4) {
      logger.warn('QQ频道私信队列已满，未执行消息')
      return
    }
    seen.set(eventKey, now)
    if (seen.size > 1000) seen.delete(seen.keys().next().value)
    conversations.set(key, state)
    pending++
    state.size++
    const operation = state.tail.then(() => respond(message)).finally(() => {
      pending--
      state.size--
      if (state.size === 0) conversations.delete(key)
    })
    state.tail = operation.catch(() => {})
    return operation
  }

  handle.stop = () => { stopped = true; seen.clear() }
  return handle
}

module.exports = {createGuildDirectMessageHandler}
