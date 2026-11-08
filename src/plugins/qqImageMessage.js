'use strict'

const decode = value => String(value).replace(/&#44;/g, ',').replace(/&#91;/g, '[').replace(/&#93;/g, ']').replace(/&amp;/g, '&')
const escape = value => String(value).replace(/&/g, '&amp;').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/,/g, '&#44;')

function toCQMessage(message) {
  if (!Array.isArray(message)) return typeof message === 'string' ? message : ''
  return message.slice(0, 256).map(segment => {
    if (segment?.type === 'text') return String(segment.data?.text ?? '').replace(/&/g, '&amp;').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;')
    if (!/^[a-z_]+$/.test(segment?.type ?? '') || !segment.data || typeof segment.data !== 'object') return ''
    const args = Object.entries(segment.data).filter(([key, value]) => /^[a-z_]+$/.test(key) && ['string', 'number'].includes(typeof value))
      .map(([key, value]) => `${key}=${escape(value)}`).join(',')
    return `[CQ:${segment.type}${args ? ',' + args : ''}]`
  }).join('')
}

function parseQQImageMessage(message) {
  const source = toCQMessage(message)
  const images = []
  const text = source.replace(/\[CQ:image,([^\]]*)\]/g, (_match, attributes) => {
    const data = Object.create(null)
    for (const pair of attributes.split(',')) {
      const equals = pair.indexOf('=')
      if (equals > 0) data[pair.slice(0, equals)] = decode(pair.slice(equals + 1))
    }
    // Keep the fourth descriptor so the plugin can reject excess images explicitly.
    if (images.length < 4) images.push({...(data.url ? {url: data.url} : {}), ...(data.file ? {file: data.file} : {})})
    return ''
  }).trim()
  return {text, images}
}

module.exports = {parseQQImageMessage, toCQMessage}
