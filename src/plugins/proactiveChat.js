'use strict'

const HOUR = 60 * 60 * 1000
const PERMISSION_TIMEOUT_MS = 5000
const SHANGHAI_OFFSET = 8 * HOUR
const fail = () => Object.assign(new Error('PROACTIVE_CONFIG_INVALID'), {code: 'PROACTIVE_CONFIG_INVALID'})
const skipped = (reason) => ({status: 'skipped', reason})

function createProactiveChat({generate, send, canSend = () => true, now = Date.now, random = Math.random,
  setTimeout: setTimer = globalThis.setTimeout, clearTimeout: clearTimer = globalThis.clearTimeout,
  logger = console, groupIds = [], minDelayMs = 600000, maxDelayMs = 1800000,
  dailyLimit = 12, maxIdleMs = 2 * HOUR} = {}) {
  if ([generate, send, canSend, now, random, setTimer, clearTimer].some((value) => typeof value !== 'function') ||
      !Array.isArray(groupIds) || !Number.isSafeInteger(minDelayMs) || minDelayMs <= 0 ||
      !Number.isSafeInteger(maxDelayMs) || maxDelayMs < minDelayMs || maxDelayMs > 2147483647 ||
      !Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 12 ||
      !Number.isSafeInteger(maxIdleMs) || maxIdleMs <= 0 || maxIdleMs > 2 * HOUR) throw fail()

  if (groupIds.some((id) => !['string', 'number'].includes(typeof id) || !String(id).trim())) throw fail()
  const allowedGroups = new Set(groupIds.map((id) => String(id)))
  if (allowedGroups.size > 1) throw fail()
  const enabled = allowedGroups.size === 1
  const successes = new Map()
  let running = false
  let busy = false
  let timer = null
  let timerVersion = 0
  let nextRunAt = null
  let latest = null
  let revision = 0
  let lifecycle = 0
  let pausedRevision = null
  let cancelPermission = null
  let demonstrationAttempted = false
  let automaticPending = false

  function clock() {
    const time = Number(now())
    if (!Number.isFinite(time)) throw fail()
    const day = localTime(time).day
    for (const key of successes.keys()) if (key !== day) successes.delete(key)
    return time
  }

  function localTime(time) {
    const date = new Date(time + SHANGHAI_OFFSET)
    return {day: date.toISOString().slice(0, 10), hour: date.getUTCHours(), date}
  }

  function quietEnd(time) {
    const {hour, date} = localTime(time)
    if (hour >= 8 && hour < 23) return time
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + (hour >= 23 ? 1 : 0), 8) - SHANGHAI_OFFSET
  }

  function log(code) {
    try { logger?.error?.(code) } catch { /* Logging must not leak an async rejection. */ }
  }

  function cancelTimer() {
    timerVersion += 1
    if (timer !== null) clearTimer(timer)
    timer = null
    nextRunAt = null
  }

  function eligible(time, version = revision, epoch = lifecycle, context = latest,
    {demo = false, allowQuietHours = false} = {}) {
    if (!running || epoch !== lifecycle) return 'stopped'
    if (!enabled) return 'wrong-group'
    if (!context) return 'no-context'
    if (version !== revision) return 'stale-generation'
    if (!demo && (time < context.observedAt || time - context.observedAt >= maxIdleMs)) return 'idle'
    if (!(demo && allowQuietHours) && quietEnd(time) !== time) return 'quiet-hours'
    if ((successes.get(localTime(time).day) ?? 0) >= dailyLimit) return 'daily-limit'
    if (context.muted === true || context.isMuted === true || context.canSend === false ||
        context.allowProactive === false) return 'muted'
    return null
  }

  function schedule() {
    if (busy) { if (latest) automaticPending = true; return }
    if (!running || timer !== null || !latest || !enabled || pausedRevision === revision) return
    const time = clock()
    if (time < latest.observedAt || time - latest.observedAt >= maxIdleMs || dailyLimit === 0) return
    const sample = Number(random())
    const fraction = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0
    const due = quietEnd(time + minDelayMs + Math.floor(fraction * (maxDelayMs - minDelayMs)))
    if ((successes.get(localTime(due).day) ?? 0) >= dailyLimit) return
    if (due - latest.observedAt >= maxIdleMs) return
    const scheduledVersion = ++timerVersion
    nextRunAt = due
    timer = setTimer(() => {
      if (!running || scheduledVersion !== timerVersion) return
      timer = null
      nextRunAt = null
      if (busy) { automaticPending = Boolean(latest); return }
      void run().catch(() => log('PROACTIVE_SCHEDULE_FAILED'))
    }, due - time)
    timer?.unref?.()
  }

  async function permission(context, version, epoch, policy) {
    const reason = eligible(clock(), version, epoch, context, policy)
    if (reason) return reason
    let deadline
    let cancel
    const bounded = new Promise((resolve, reject) => {
      cancel = () => { clearTimer(deadline); resolve('stopped') }
      deadline = setTimer(() => reject(new Error('PROACTIVE_PERMISSION_FAILED')), PERMISSION_TIMEOUT_MS)
      deadline?.unref?.()
      cancelPermission = cancel
    })
    try {
      const denied = await Promise.race([bounded,
        Promise.resolve().then(() => canSend(context)).then((allowed) => allowed ? null : 'muted')])
      return denied ?? eligible(clock(), version, epoch, context, policy)
    } finally {
      clearTimer(deadline)
      if (cancelPermission === cancel) cancelPermission = null
    }
  }

  async function run({context = latest, demo = false, allowQuietHours = false} = {}) {
    if (busy) return skipped('busy')
    const version = revision
    const epoch = lifecycle
    const policy = {demo, allowQuietHours}
    const check = () => eligible(clock(), version, epoch, context, policy)
    const reason = check()
    if (reason) { if (!demo) schedule(); return skipped(reason) }
    busy = true
    let stage = 'permission'
    let result
    try {
      let denied = await permission(context, version, epoch, policy)
      denied = denied ?? check()
      if (denied) {
        result = skipped(denied)
      } else {
        stage = 'generate'
        const generated = await generate(context)
        denied = check()
        if (denied) result = skipped(denied)
        else if (!generated || typeof generated.text !== 'string' || !generated.text.trim()) {
          if (!demo) pausedRevision = version
          result = skipped('empty-generation')
        } else {
          stage = 'permission'
          denied = await permission(context, version, epoch, policy)
          denied = denied ?? check()
          if (denied) result = skipped(denied)
          else {
            stage = 'send'
            const outcome = await send(context, generated.text)
            if (outcome === false || outcome?.ok === false || outcome?.sent === false ||
                ['failed', 'skipped'].includes(outcome?.status)) throw new Error()
            const day = localTime(clock()).day
            successes.set(day, (successes.get(day) ?? 0) + 1)
            result = {status: 'sent'}
          }
        }
      }
      if (!demo && result.status === 'skipped' && result.reason === 'muted') pausedRevision = version
    } catch {
      const code = stage === 'send' ? 'PROACTIVE_SEND_FAILED' :
        stage === 'generate' ? 'PROACTIVE_GENERATE_FAILED' : 'PROACTIVE_PERMISSION_FAILED'
      log(code)
      if (!demo) pausedRevision = version
      result = {status: 'failed', code}
    } finally {
      busy = false
      if (running && (!demo || automaticPending || revision !== version)) {
        automaticPending = false
        schedule()
      }
    }
    return result
  }

  function observe(context) {
    const targetId = String(context?.targetId ?? context?.groupId ?? '')
    if (!context || !allowedGroups.has(targetId) || context.isPrivate === true ||
        (context.messageType !== undefined && context.messageType !== 'group') ||
        (context.raw?.scope !== undefined && context.raw.scope !== 'group') ||
        (context.platform !== undefined && !['onebot', 'qq', 'napcat'].includes(context.platform))) return skipped('wrong-group')
    if (context.userId == null || String(context.userId) === '' || context.isBot === true || context.isSelf === true ||
        ['assistant', 'bot', 'system'].includes(context.role) ||
        (context.selfId != null && String(context.userId) === String(context.selfId))) return skipped('not-human')
    const time = clock()
    const observedAt = context.timestamp === undefined ? time : Number(context.timestamp)
    if (!Number.isFinite(observedAt) || observedAt > time || time - observedAt >= maxIdleMs) return skipped('stale-context')
    revision += 1
    const content = context.content ?? context.text
    if (typeof content !== 'string' || !content.trim()) {
      latest = null
      return skipped('empty-context')
    }
    latest = Object.freeze({...context, groupId: context.groupId ?? targetId, targetId, userId: String(context.userId),
      content, text: content, observedAt})
    schedule()
    return {status: 'observed'}
  }

  return {
    observe,
    start() {
      if (!running) { running = true; lifecycle += 1; schedule() }
      return {status: 'started'}
    },
    stop() {
      running = false
      lifecycle += 1
      cancelTimer()
      cancelPermission?.()
      automaticPending = false
      return {status: 'stopped'}
    },
    async triggerNow(context) {
      if (!latest) return skipped('no-context')
      if (context && (!allowedGroups.has(String(context.targetId ?? context.groupId ?? '')) || context.isPrivate === true ||
          (context.messageType !== undefined && context.messageType !== 'group') ||
          (context.raw?.scope !== undefined && context.raw.scope !== 'group'))) return skipped('wrong-group')
      if (context && ['platform', 'selfId', 'groupId'].some((key) => context[key] !== undefined &&
          latest[key] !== undefined && String(context[key]) !== String(latest[key]))) return skipped('wrong-context')
      if (busy) return skipped('busy')
      cancelTimer()
      return run()
    },
    async demonstrate(context, {allowQuietHours = false} = {}) {
      if (demonstrationAttempted) return skipped('demo-used')
      const targetId = String(context?.targetId ?? context?.groupId ?? '')
      if (!context || !allowedGroups.has(targetId) || context.raw?.scope !== 'group' ||
          context.isPrivate === true || (context.messageType !== undefined && context.messageType !== 'group') ||
          !['napcat', 'onebot', 'qq'].includes(context.platform) ||
          context.selfId == null || !String(context.selfId).trim()) return skipped('wrong-context')
      if (busy) return skipped('busy')
      const metadata = Object.freeze({platform: context.platform, selfId: context.selfId,
        groupId: context.groupId ?? targetId, targetId, channelKey: context.channelKey,
        muted: context.muted, isMuted: context.isMuted, canSend: context.canSend, allowProactive: context.allowProactive,
        raw: Object.freeze({scope: 'group', proactiveDemo: true})})
      const policy = {demo: true, allowQuietHours: allowQuietHours === true}
      const reason = eligible(clock(), revision, lifecycle, metadata, policy)
      if (reason) return skipped(reason)
      demonstrationAttempted = true
      return run({context: metadata, ...policy})
    },
    getStatus() {
      const time = clock()
      const day = localTime(time).day
      return {running, busy, scheduled: timer !== null, nextRunAt, lastHumanAt: latest?.observedAt ?? null,
        day, sentToday: successes.get(day) ?? 0}
    },
  }
}

module.exports = {createProactiveChat}
