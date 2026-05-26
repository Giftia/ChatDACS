'use strict'

function colored(message, color) {
  return message[color] || message
}

function isGroupServiceEvent(event) {
  const subTypeCondition = ['ban', 'poke', 'friend_add']
  return event.message_type == 'group' || event.notice_type == 'group_increase' || subTypeCondition.includes(event.sub_type)
}

async function handleOpenServiceCommand({event, config, constants, logger, utils, oneBotSender}) {
  if (!constants.open_ju_reg.test(event.message) || !constants.has_at_qq_reg.test(event.message)) {
    return false
  }

  const who = constants.has_at_qq_reg.exec(event.message)[1]
  if (!constants.is_qq_reg.test(who)) {
    return false
  }

  if (event.self_id != who) {
    await oneBotSender.sendGroupMessage(event.group_id, `[CQ:at,qq=${who}] 说你呢，快张菊!`)
    return true
  }

  const response = await oneBotSender.getGroupMemberInfo(event.group_id, event.user_id)
  const role = response.data.data.role
  if (role === 'owner' || role === 'admin') {
    logger.info(colored(`群 ${event.group_id} 启用了小夜服务`, 'log'))
    await utils.EnableGroupService(event.group_id)
    await oneBotSender.sendGroupMessage(
      event.group_id,
      '小夜的菊花被管理员张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊',
    )
    return true
  }

  if (config.QQBOT_ADMIN_LIST.includes(event.user_id)) {
    logger.info(colored(`群 ${event.group_id} 启用了小夜服务`, 'log'))
    await utils.EnableGroupService(event.group_id)
    await oneBotSender.sendGroupMessage(
      event.group_id,
      '小夜的菊花被主人张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊',
    )
    return true
  }

  await oneBotSender.sendGroupMessage(event.group_id, '你不是群管理呢，小夜不张，张菊需要让管理员来帮忙张噢')
  return true
}

async function ensureGroupServiceEnabled({event, utils, logger}) {
  const groupServiceSwitch = await utils.GetGroupServiceSwitch(event.group_id)
  if (!groupServiceSwitch) {
    logger.info(colored(`群 ${event.group_id} 服务已停用，无视群所有消息`, 'error'))
    return false
  }
  return true
}

async function handleCloseServiceCommand({event, constants, utils, oneBotSender, logger = console}) {
  if (constants.close_ju_reg.test(event.message) && constants.has_at_qq_reg.test(event.message)) {
    const who = constants.has_at_qq_reg.exec(event.message)[1]
    if (!constants.is_qq_reg.test(who)) {
      return false
    }

    if (event.self_id == who) {
      logger.info(colored(`群 ${event.group_id} 停止了小夜服务`, 'error'))
      await utils.DisableGroupService(event.group_id)
      await oneBotSender.sendGroupMessage(
        event.group_id,
        `小夜的菊花闭上了，这只小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${event.self_id}]`,
      )
    } else {
      await oneBotSender.sendGroupMessage(event.group_id, `[CQ:at,qq=${who}] 说你呢，快闭菊!`)
    }
    return true
  }

  if (event.message === '闭菊') {
    logger.info(colored(`群 ${event.group_id} 停止了小夜服务`, 'error'))
    await utils.DisableGroupService(event.group_id)
    await oneBotSender.sendGroupMessage(
      event.group_id,
      `小夜的菊花闭上了，小夜在本群的所有服务已经停用，取消请发 张菊[CQ:at,qq=${event.self_id}]`,
    )
    return true
  }

  return false
}

module.exports = {
  isGroupServiceEvent,
  handleOpenServiceCommand,
  ensureGroupServiceEnabled,
  handleCloseServiceCommand,
}
