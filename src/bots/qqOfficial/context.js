'use strict'

function toMessageContext(message, appId) {
  if (!message || !['c2c', 'group'].includes(message.kind)) return null
  const scope = message.kind
  const targetId = scope === 'group' ? message.groupOpenid : message.senderId
  if (![appId, targetId, message.senderId, message.messageId].every((value) => typeof value === 'string' && value.length > 0)) {
    return null
  }
  const groupId = JSON.stringify(['qqOfficial', appId, scope, targetId])
  return {
    text: String(message.content ?? '').trim(),
    platform: 'qqOfficial',
    selfId: appId,
    targetId: groupId,
    groupId,
    groupName: '',
    userId: JSON.stringify(['qqOfficial', appId, scope, targetId, message.senderId]),
    userName: message.senderName || '匿名',
    raw: {
      scope,
      messageId: message.messageId,
      replyTarget: {scope, targetId, msgId: message.messageId},
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
    },
  }
}

module.exports = {toMessageContext}
