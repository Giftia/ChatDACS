'use strict'

const HOST_MODULES = new Set(['wallpaper', 'tray', 'chatPush'])
const OFFICIAL_PLATFORMS = new Set(['qqOfficial', 'qqGuildDirect'])

function id(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? String(value) : null
  return typeof value === 'string' && /^[1-9]\d*$/.test(value) ? value : null
}

function trustedIdentity(context) {
  if (!['qq', 'napcat', 'onebot'].includes(context?.platform)) return null
  const raw = context.raw
  // ProcessExecute wraps legacy options in raw; normalized contexts carry raw.event.
  const events = [raw?.event, raw?.raw?.event].filter(value => value != null)
  const event = events[0]
  const scope = context.scope ?? raw?.scope ?? raw?.raw?.scope
  const user = id(context.userId), self = id(context.selfId)
  if (!user || !self || !event || !['group', 'private'].includes(scope)) return null
  for (const candidate of events) {
    if (candidate.message_type !== scope || id(candidate.user_id) !== user || id(candidate.self_id) !== self ||
        candidate.sender?.role !== event.sender?.role) return null
    if (candidate.sender?.user_id != null && id(candidate.sender.user_id) !== user) return null
    if (scope === 'group' ? id(candidate.group_id) !== id(context.groupId) : candidate.group_id != null) return null
  }
  for (const source of [raw, raw?.raw]) {
    if (!source) continue
    if (source.platform != null && source.platform !== context.platform) return null
    if (source.type != null && source.type !== context.platform) return null
    if (source.selfId != null && id(source.selfId) !== self) return null
    if (source.userId != null && id(source.userId) !== user) return null
    if (source.scope != null && source.scope !== scope) return null
  }
  if (scope === 'group') {
    if (!id(context.groupId) || id(context.groupId) !== id(event.group_id)) return null
    if (context.targetId != null && id(context.targetId) !== id(event.group_id)) return null
  } else {
    if (event.group_id != null || (context.groupId != null && context.groupId !== '')) return null
    if (context.targetId != null && id(context.targetId) !== user) return null
  }
  return {user, scope, role: event.sender?.role}
}

function createPluginAuthorization(config) {
  function hostAdmin(identity) {
    return Boolean(identity && Array.isArray(config?.QQBOT_ADMIN_LIST) &&
      config.QQBOT_ADMIN_LIST.some(value => id(value) === identity.user))
  }

  function canExecute(moduleName, context) {
    return !HOST_MODULES.has(moduleName) || hostAdmin(trustedIdentity(context))
  }

  function canToggle(moduleName, context) {
    if (HOST_MODULES.has(moduleName)) return hostAdmin(trustedIdentity(context))
    // Official conversation authorization remains governed by its existing allowlist.
    if (OFFICIAL_PLATFORMS.has(context?.platform)) return true
    const identity = trustedIdentity(context)
    return Boolean(identity && (hostAdmin(identity) || identity.scope === 'private' ||
      ['admin', 'owner'].includes(identity.role)))
  }

  return {canExecute, canToggle}
}

module.exports = {createPluginAuthorization}
