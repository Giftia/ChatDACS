'use strict'

const fail = (code) => Object.assign(new Error(code), {code})
const MAX_ENTRIES = 40
const MAX_CHARS = 16000 // UTF-16 characters, not an exact model-token count.
const TTL_MS = 2 * 60 * 60 * 1000

function createChatContext({maxEntries = MAX_ENTRIES, maxChars = MAX_CHARS, ttlMs = TTL_MS,
  maxSessions = 500, maxConcurrent = 4, maxPendingPerSession = 8, maxPending = 64,
  queueTimeoutMs = 15000, now = Date.now} = {}) {
  const settings = [maxEntries, maxChars, ttlMs, maxSessions, maxConcurrent,
    maxPendingPerSession, maxPending, queueTimeoutMs]
  if (settings.some((value) => !Number.isSafeInteger(value) || value < 1) ||
      maxEntries > MAX_ENTRIES || maxChars > MAX_CHARS || ttlMs > TTL_MS ||
      typeof now !== 'function') throw fail('CHAT_CONTEXT_CONFIG_INVALID')
  const sessions = new Map()
  const ready = []
  let active = 0, pending = 0

  function invalidate(state) {
    state.entries = []
    state.chars = 0
    state.generation++
  }

  function prune(state, time) {
    while (state.entries.length && state.entries[0].at <= time - ttlMs) {
      state.chars -= state.entries.shift().content.length
    }
  }

  function sweep(time) {
    for (const [key, state] of sessions) {
      prune(state, time)
      if (state.touchedAt <= time - ttlMs) {
        invalidate(state)
        if (!state.pending) sessions.delete(key)
        else state.touchedAt = time
      }
    }
  }

  function stateFor(key) {
    if (typeof key !== 'string' || !key || key.length > 4096) throw fail('CHAT_CONTEXT_INVALID')
    const time = now()
    sweep(time)
    let state = sessions.get(key)
    if (!state) {
      if (sessions.size >= maxSessions) {
        const victim = [...sessions.values()].find((item) => !item.pending)
        if (!victim) throw fail('CHAT_CONTEXT_BUSY')
        invalidate(victim)
        sessions.delete(victim.key)
      }
      state = {key, entries: [], chars: 0, generation: 0, touchedAt: time,
        jobs: [], pending: 0, running: false, ready: false}
    }
    state.touchedAt = time
    sessions.delete(key)
    sessions.set(key, state)
    return state
  }

  function capture(key) {
    const state = stateFor(key)
    return {state, generation: state.generation}
  }

  function isCurrent(lease) {
    if (!lease?.state) return false
    sweep(now())
    return sessions.get(lease.state.key) === lease.state && lease.generation === lease.state.generation
  }

  function append(lease, role, content) {
    if (!['user', 'assistant'].includes(role) || typeof content !== 'string' || !content.trim()) return false
    if (!isCurrent(lease)) return false
    const state = lease.state
    const bounded = content.slice(0, maxChars)
    state.entries.push({role, content: bounded, at: now()})
    state.chars += bounded.length
    state.touchedAt = now()
    while (state.entries.length > maxEntries || state.chars > maxChars) {
      state.chars -= state.entries.shift().content.length
    }
    return true
  }

  function history(key, {beforeUser, budget = maxChars, limit = maxEntries} = {}) {
    const state = stateFor(key)
    let entries = state.entries
    const last = entries.at(-1)
    if (beforeUser !== undefined && last?.role === 'user' && last.content === beforeUser) entries = entries.slice(0, -1)
    const result = []
    let chars = 0
    for (let index = entries.length - 1; index >= 0 && result.length < limit; index--) {
      if (chars + entries[index].content.length > budget) break
      chars += entries[index].content.length
      result.unshift({role: entries[index].role, content: entries[index].content})
    }
    return result
  }

  function clear(key) { invalidate(stateFor(key)) }

  function enqueue(state) {
    if (!state.ready && !state.running && state.jobs.length) {
      state.ready = true
      ready.push(state)
    }
  }

  function drain() {
    while (active < maxConcurrent && ready.length) {
      const state = ready.shift()
      state.ready = false
      const job = state.jobs.shift()
      if (!job) continue
      clearTimeout(job.timer)
      state.running = true
      active++
      void (async () => {
        try {
          if (!isCurrent(job.lease)) throw fail('CHAT_CONTEXT_CHANGED')
          const result = await job.operation(job.lease)
          if (!isCurrent(job.lease)) throw fail('CHAT_CONTEXT_CHANGED')
          job.resolve(result)
        } catch (error) { job.reject(error) } finally {
          state.running = false
          state.pending--
          pending--
          active--
          enqueue(state)
          drain()
        }
      })()
    }
  }

  function run(key, operation) {
    if (typeof operation !== 'function') return Promise.reject(fail('CHAT_CONTEXT_INVALID'))
    let lease
    try {
      if (pending >= maxPending) throw fail('CHAT_CONTEXT_BUSY')
      lease = capture(key)
      if (lease.state.pending >= maxPendingPerSession) throw fail('CHAT_CONTEXT_BUSY')
    } catch (error) { return Promise.reject(error) }
    const state = lease.state
    return new Promise((resolve, reject) => {
      const job = {lease, operation, resolve, reject}
      job.timer = setTimeout(() => {
        const index = state.jobs.indexOf(job)
        if (index === -1) return
        state.jobs.splice(index, 1)
        state.pending--
        pending--
        if (!state.jobs.length && state.ready) {
          ready.splice(ready.indexOf(state), 1)
          state.ready = false
        }
        reject(fail('CHAT_CONTEXT_BUSY'))
      }, queueTimeoutMs)
      state.pending++
      pending++
      state.jobs.push(job)
      enqueue(state)
      drain()
    })
  }

  function stats() {
    sweep(now())
    return {sessions: sessions.size, active, pending,
      entries: [...sessions.values()].reduce((sum, state) => sum + state.entries.length, 0)}
  }

  return {capture, isCurrent, append, history, clear, run, stats}
}

module.exports = {createChatContext, MAX_ENTRIES, MAX_CHARS, TTL_MS}
