'use strict'

function identity(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null
  return typeof value === 'string' && value.length <= 64 && /^[1-9][0-9]*$/.test(value) ? value : null
}

function messageId(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? String(value) : null
  return typeof value === 'string' && value.length <= 64 && /^(?:0|-?[1-9][0-9]*)$/.test(value) ? value : null
}

function isMessage(event) {
  if (!['group', 'private'].includes(event?.message_type) || event.notice_type != null || event.request_type != null) return false
  if (event.post_type === 'message') return true
  // Legacy embedders omit post_type; do not mistake their poke/ban notices for messages.
  return event.post_type === undefined && typeof event.message === 'string' &&
    [undefined, 'normal', 'friend', 'group'].includes(event.sub_type)
}

function createMessageIngress({now = Date.now, ttlMs = 5 * 60 * 1000, maxEntries = 4096} = {}) {
  const seen = new Map()

  function shouldIgnore(event) {
    if (event?.post_type === 'message_sent') return true
    if (!isMessage(event)) return false
    const self = identity(event.self_id), user = identity(event.user_id)
    if (self !== null && self === user) return true
    const scope = event.message_type
    const target = scope === 'group' ? identity(event.group_id) : user
    const id = messageId(event.message_id)
    if (self === null || user === null || target === null || id === null ||
        (scope === 'private' && event.group_id != null)) return false

    const time = now()
    for (const [key, expires] of seen) {
      if (expires > time) break
      seen.delete(key)
    }
    const key = JSON.stringify([self, scope, target, user, id])
    if (seen.has(key)) return true
    if (seen.size >= maxEntries) seen.delete(seen.keys().next().value)
    // Reserve synchronously and retain failures: a redelivery must not retry side effects.
    seen.set(key, time + ttlMs)
    return false
  }

  return {shouldIgnore, clear: () => seen.clear()}
}

module.exports = {createMessageIngress}
