'use strict'

function colored(message, color) {
  return message[color] || message
}

async function handleQQChatReply({event, config, chatProcess, sendGroupMessage, random = Math.random}) {
  const couldRepeat = Math.floor(random() * 100) < config.QQBOT_FUDU_PROBABILITY
  if (couldRepeat) {
    console.log(colored(`小夜复读 ${event.message}`, 'log'))
    await sendGroupMessage(event.message, event)
    return true
  }

  let replyFlag = Math.floor(random() * 100)
  let atReplacedMsg = event.message
  if (new RegExp(`\\[CQ:at,qq=${event.self_id}`).test(event.message)) {
    replyFlag -= 80
    atReplacedMsg = event.message.replace(`[CQ:at,qq=${event.self_id}]`, '').trim()
  }

  if (replyFlag < config.QQBOT_REPLY_PROBABILITY) {
    let replyMsg = await chatProcess(atReplacedMsg)

    if (replyMsg.indexOf('[name]') || replyMsg.indexOf('&#91;name&#93;')) {
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
}
