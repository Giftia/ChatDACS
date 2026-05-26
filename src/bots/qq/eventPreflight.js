'use strict'

const {ProcessGuildMessage} = require('../qqGuild')
const Constants = require('../../../config/constants.js')

async function handleQQEventPreflight({
  event,
  config,
  logger,
  io,
  oneBotSender,
  processExecute,
  chatProcess,
  utils,
  processGuildMessage = ProcessGuildMessage,
}) {
  if (event.message_type == 'guild') {
    logger.info(
      `小夜收到频道 ${event.channel_id} 的 ${event.user_id} (${event.sender.nickname}) 发来的消息: ${event.message}`,
    )
    await processGuildMessage({event, processExecute, chatProcess, config, logger, utils})
    return true
  }

  if (event.sub_type == 'ban' && event.user_id == event.self_id) {
    if (event.duration >= 3599) {
      await oneBotSender.setGroupLeave(event.group_id)
      logger.info(`小夜在群 ${event.group_id} 被禁言超过1小时，自动退群`.error)
      io.emit('system', `小夜在群 ${event.group_id} 被禁言超过1小时，自动退群`)
    } else {
      await oneBotSender.setGroupCard(event.group_id, event.self_id, '你妈的，为什么 禁言我')
      logger.info(`小夜在群 ${event.group_id} 被禁言，自动改名为 你妈的，为什么 禁言我`.log)
    }
    return true
  }

  if (event.request_type == 'friend') {
    logger.info(`小夜收到好友请求，请求人：${event.user_id}，请求内容：${event.comment}，按配置自动处理`.log)
    await oneBotSender.setFriendAddRequest(event.flag, config.AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH)
    return true
  }

  if (event.request_type == 'group' && event.sub_type == 'invite') {
    const message = `用户 ${event.user_id} 邀请小夜加入群 ${event.group_id}，批准请发送
批准 ${event.flag}`
    logger.info(`小夜收到加群请求，请求人：${event.user_id}，请求内容：${event.comment}，发送小夜管理员审核`.log)
    await oneBotSender.sendPrivateMessage(config.QQBOT_ADMIN_LIST[0], message)

    const inviteReplyContent = `你好呀，谢谢你邀请小夜，请联系这只小夜的主人 ${config.QQBOT_ADMIN_LIST[0]} 来批准入群邀请噢。小夜开源于 https://github.com/Giftia/ChatDACS ，开发组欢迎你的加入！`
    await oneBotSender.sendPrivateMessage(event.user_id, inviteReplyContent)
    return true
  }

  if (
    event.message_type == 'private' &&
    event.user_id == config.QQBOT_ADMIN_LIST[0] &&
    Constants.approve_group_invite_reg.test(event.message)
  ) {
    const flag = event.message.match(Constants.approve_group_invite_reg)[1]
    await oneBotSender.setGroupAddRequest(flag, 'invite', 1)
    logger.info(`管理员批准了群邀请请求 ${flag}`.log)
    await oneBotSender.sendPrivateMessage(event.user_id, '已批准')
    return true
  }

  const notify = buildQQEventNotification(event)
  if (!notify) {
    return true
  }

  logger.info(notify)
  io.emit('system', notify)
  return false
}

function buildQQEventNotification(event) {
  switch (event.sub_type) {
    case 'friend':
    case 'group':
      return `小夜收到好友 ${event.user_id} (${event.sender.nickname}) 发来的消息: ${event.message}`
    case 'normal':
      return `小夜收到群 ${event.group_id} 的 ${event.user_id} (${event.sender.nickname}) 发来的消息: ${event.message}`
    case 'approve':
      return `${event.user_id} 加入了群 ${event.group_id}`.log
    case 'ban':
      return `${event.user_id} 在群 ${event.group_id} 被禁言 ${event.duration} 秒`.error
    case 'poke':
      return `${event.user_id} 戳了一下 ${event.target_id}`.log
    default:
      return ''
  }
}

module.exports = {
  handleQQEventPreflight,
  buildQQEventNotification,
}
