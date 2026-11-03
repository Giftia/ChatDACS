'use strict'

function colored(message, color) {
  return message[color] || message
}

function getQQChatText(event) {
  if (typeof event?.message !== 'string') return ''
  return event.message.replaceAll(`[CQ:at,qq=${event.self_id}]`, '').trim()
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function formatQQChatReply(text, userId) {
  return text.replace(/\[name\]|&#91;name&#93;/g, `[CQ:at,qq=${userId}]`)
}

async function handleQQChatReply({event, config = {}, chatProcess, matchChat, fallback, sendGroupMessage,
  random = Math.random, legacyMode = false, logger}) {
  if (legacyMode) return handleLegacyQQChatReply({event, config, chatProcess, sendGroupMessage, random})
  const text = getQQChatText(event)
  if (!text || !text.replace(/\[CQ:[^\]]*\]/g, '').trim() ||
    String(event.user_id) === String(event.self_id)) return false
  let reply
  try {
    if (typeof matchChat === 'function') {
      const result = await matchChat(text)
      if (result?.handled === true && hasText(result.content)) reply = result.content
    } else if (typeof fallback !== 'function' && typeof chatProcess === 'function') {
      // Old embedders can still inject only ChatProcess, without the probability gate.
      reply = await chatProcess(text)
    }
    if (!hasText(reply) && typeof fallback === 'function') {
      const result = await fallback(text, event.user_id, event.sender?.nickname, event.group_id, event.group_name ?? '',
        {type: 'qq', platform: 'qq', selfId: event.self_id, scope: event.message_type === 'private' ? 'private' : 'group'})
      if (typeof result === 'string') reply = result
      else if (result?.handled !== false) reply = result?.content
    }
  } catch (_) {
    try { logger?.error?.('QQ_CHAT_REPLY_FAILED') } catch (_) {}
    throw Object.assign(new Error('QQ_CHAT_REPLY_FAILED'), {code: 'QQ_CHAT_REPLY_FAILED'})
  }
  if (!hasText(reply)) return false
  reply = formatQQChatReply(reply, event.user_id)
  await sendGroupMessage(reply, event)
  return true
}

async function handleLegacyQQChatReply({event, config, chatProcess, sendGroupMessage, random}) {
  const couldRepeat = Math.floor(random() * 100) < config.QQBOT_FUDU_PROBABILITY
  if (couldRepeat) {
    console.log(colored(`小夜复读 ${event.message}`, 'log'))
    await sendGroupMessage(event.message, event)
    return true
  }

  let replyFlag = Math.floor(random() * 100)
  let atReplacedMsg = event.message
  if (event.message.includes(`[CQ:at,qq=${event.self_id}]`)) {
    replyFlag -= 80
    atReplacedMsg = event.message.replace(`[CQ:at,qq=${event.self_id}]`, '').trim()
  }

  if (replyFlag < config.QQBOT_REPLY_PROBABILITY) {
    let replyMsg = await chatProcess(atReplacedMsg)

    if (replyMsg.includes('[name]') || replyMsg.includes('&#91;name&#93;')) {
      replyMsg = replyMsg.toString().replace('[name]', `[CQ:at,qq=${event.user_id}]`)
      replyMsg = replyMsg.toString().replace('&#91;name&#93;', `[CQ:at,qq=${event.user_id}]`)
    }

    console.log(colored(`对于QQ聊天 ${atReplacedMsg} ，小夜回复 ${replyMsg}`, 'log'))
    await sendGroupMessage(replyMsg, event)
    return true
  }

  return false
}

module.exports = {
  handleQQChatReply,
  getQQChatText,
  formatQQChatReply,
}
