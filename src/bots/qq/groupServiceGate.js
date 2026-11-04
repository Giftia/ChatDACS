'use strict'

function colored(message, color) {
  return message[color] || message
}

function isGroupServiceEvent(event) {
  const subTypeCondition = ['ban', 'poke', 'friend_add']
  return event.message_type == 'group' || event.notice_type == 'group_increase' || subTypeCondition.includes(event.sub_type)
}

function normalizeId(id) {
  if (typeof id === 'number') return Number.isSafeInteger(id) && id > 0 ? String(id) : null
  return typeof id === 'string' && /^[1-9][0-9]*$/.test(id) ? id : null
}

function hasGroupIdentity(event) {
  return event.message_type === 'group' && normalizeId(event.group_id) !== null &&
    normalizeId(event.user_id) !== null && normalizeId(event.self_id) !== null
}

async function getServiceAuthority({event, config, oneBotSender}) {
  try {
    const response = await oneBotSender.getGroupMemberInfo(event.group_id, event.user_id)
    const result = response?.data
    const role = result?.data?.role
    if ((result?.status !== undefined && result.status !== 'ok') ||
        (result?.retcode !== undefined && result.retcode !== 0) ||
        !['owner', 'admin', 'member'].includes(role)) return null
    if (role === 'owner' || role === 'admin') return 'admin'
    const admins = config?.QQBOT_ADMIN_LIST
    return Array.isArray(admins) && admins.some((id) => normalizeId(id) === normalizeId(event.user_id))
      ? 'host' : 'member'
  } catch (_) {
    return null
  }
}

async function handleOpenServiceCommand({event, config, constants, logger, utils, oneBotSender}) {
  if (!constants.open_ju_reg.test(event.message) || !constants.has_at_qq_reg.test(event.message)) {
    return false
  }
  if (!hasGroupIdentity(event)) return false

  const who = constants.has_at_qq_reg.exec(event.message)[1]
  if (!constants.is_qq_reg.test(who)) {
    return false
  }

  if (normalizeId(event.self_id) !== who) {
    await oneBotSender.sendGroupMessage(event.group_id, `[CQ:at,qq=${who}] 说你呢，快张菊!`)
    return true
  }

  const authority = await getServiceAuthority({event, config, oneBotSender})
  if (!authority) return true
  if (authority === 'admin') {
    logger.info(colored(`群 ${event.group_id} 启用了小夜服务`, 'log'))
    await utils.EnableGroupService(event.group_id)
    await oneBotSender.sendGroupMessage(
      event.group_id,
      '小夜的菊花被管理员张开了，这只小夜在本群的所有服务已经启用，要停用请发 闭菊',
    )
    return true
  }

  if (authority === 'host') {
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

async function handleCloseServiceCommand({event, config, constants, utils, oneBotSender, logger = console}) {
  if (!hasGroupIdentity(event)) return false
  if (constants.close_ju_reg.test(event.message) && constants.has_at_qq_reg.test(event.message)) {
    const who = constants.has_at_qq_reg.exec(event.message)[1]
    if (!constants.is_qq_reg.test(who)) {
      return false
    }

    if (normalizeId(event.self_id) === who) {
      const authority = await getServiceAuthority({event, config, oneBotSender})
      // A handled close also clears the caller's game; denied closes must return false.
      if (authority !== 'admin' && authority !== 'host') return false
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
    const authority = await getServiceAuthority({event, config, oneBotSender})
    if (authority !== 'admin' && authority !== 'host') return false
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
