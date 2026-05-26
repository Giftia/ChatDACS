'use strict'

function createOneBotSender({apiUrl, axios}) {
  if (!apiUrl) {
    throw new Error('apiUrl is required')
  }
  if (!axios?.get) {
    throw new Error('axios.get is required')
  }

  const call = (action, params = {}) => axios.get(buildOneBotUrl(apiUrl, action, params))

  return {
    sendGroupMessage(groupId, message) {
      return call('send_group_msg', {group_id: groupId, message})
    },
    sendPrivateMessage(userId, message) {
      return call('send_private_msg', {user_id: userId, message})
    },
    sendGuildChannelMessage(guildId, channelId, message) {
      return call('send_guild_channel_msg', {guild_id: guildId, channel_id: channelId, message})
    },
    setGroupLeave(groupId) {
      return call('set_group_leave', {group_id: groupId})
    },
    setGroupBan(groupId, userId, duration) {
      return call('set_group_ban', {group_id: groupId, user_id: userId, duration})
    },
    setGroupWholeBan(groupId, enable) {
      return call('set_group_whole_ban', {group_id: groupId, enable: enable ? 1 : 0})
    },
    setGroupCard(groupId, userId, card = '') {
      return call('set_group_card', {group_id: groupId, user_id: userId, card})
    },
    setFriendAddRequest(flag, approve) {
      return call('set_friend_add_request', {flag, approve})
    },
    setGroupAddRequest(flag, type, approve) {
      return call('set_group_add_request', {flag, type, approve})
    },
    getGroupInfo(groupId, noCache = 1) {
      return call('get_group_info', {group_id: groupId, no_cache: noCache})
    },
    getGroupMemberInfo(groupId, userId, noCache) {
      return call('get_group_member_info', {group_id: groupId, user_id: userId, no_cache: noCache})
    },
    getFriendList() {
      return call('get_friend_list')
    },
    getMessage(messageId) {
      return call('get_msg', {message_id: messageId})
    },
  }
}

function buildOneBotUrl(apiUrl, action, params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${encodeURI(String(value))}`)
    .join('&')

  return `http://${apiUrl}/${action}${query ? `?${query}` : ''}`
}

module.exports = {
  createOneBotSender,
  buildOneBotUrl,
}
