'use strict'

async function handleQQPluginReply({event, processExecute, oneBotSender, utils}) {
  const groupInfoResponse = await oneBotSender.getGroupInfo(event.group_id)
  const groupName = groupInfoResponse.data.data.group_name
  const pluginsReply = await processExecute(
    event.message,
    event.user_id,
    event?.sender?.nickname,
    event.group_id,
    groupName,
    {
      selfId: event.self_id,
      targetId: event.sub_type == 'poke' ? event.target_id : null,
      type: 'qq',
    },
  )

  if (pluginsReply != '') {
    const replyToQQ = utils.PluginAnswerToGoCqhttpStyle(pluginsReply)
    await oneBotSender.sendGroupMessage(event.group_id, replyToQQ)
  }

  return pluginsReply
}

module.exports = {
  handleQQPluginReply,
}
