'use strict'

function textChunks(content, limit = 1500, maxChunks = 2) {
  const text = (typeof content === 'string' ? content : '').replace(/\[CQ:[^\]]*\]/g, '[此消息段暂不支持]')
  if (!text) return []
  const points = Array.from(text)
  const chunks = []
  for (let offset = 0; offset < points.length && chunks.length < maxChunks; offset += limit) {
    chunks.push(points.slice(offset, offset + limit).join(''))
  }
  if (points.length > limit * maxChunks) chunks[chunks.length - 1] += '\n（内容过长，已截断）'
  return chunks
}

async function sendResponse({bot, target, response}) {
  if (!response || response.handled === false) return
  if (response.type === 'picture') {
    let image
    try {
      image = new URL(response.content)
    } catch {
      await bot.sendText(target, '此图片格式暂不支持')
      return
    }
    if (image.protocol !== 'https:') {
      await bot.sendText(target, '此图片格式暂不支持')
      return
    }
    await bot.sendImage(target, {url: image.toString()})
    return
  }
  const content = response.type === 'text' ? response.content : '此回复类型暂不支持'
  for (const chunk of textChunks(content)) await bot.sendText(target, chunk)
}

module.exports = {sendResponse, textChunks}
