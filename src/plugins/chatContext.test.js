'use strict'

const {createChatContext, MAX_CHARS, TTL_MS} = require('./chatContext')
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return {promise, resolve}
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
afterEach(() => jest.useRealTimers())

test('history has at most 40 entries and a 16000-character budget, with defensive copies', () => {
  const context = createChatContext()
  const lease = context.capture('a')
  for (let index = 0; index < 45; index++) context.append(lease, index % 2 ? 'assistant' : 'user', `entry-${index}`)
  const history = context.history('a')
  expect(history).toHaveLength(40)
  expect(history[0].content).toBe('entry-5')
  history[0].content = 'mutated'
  expect(context.history('a')[0].content).toBe('entry-5')
  context.append(lease, 'user', 'x'.repeat(MAX_CHARS + 50))
  expect(context.history('a')).toEqual([{role: 'user', content: 'x'.repeat(MAX_CHARS)}])
  expect(context.append(lease, 'system', 'not allowed')).toBe(false)
})

test('per-entry TTL expires old speech even if the conversation is still active', () => {
  let time = 0
  const context = createChatContext({ttlMs: 100, now: () => time})
  context.append(context.capture('a'), 'user', 'old')
  time = 50
  context.append(context.capture('a'), 'assistant', 'new')
  time = 100
  expect(context.history('a')).toEqual([{role: 'assistant', content: 'new'}])
  time = 151
  expect(context.history('a')).toEqual([])
  time = 252
  expect(context.stats()).toMatchObject({sessions: 0, entries: 0})
  expect(TTL_MS).toBe(7200000)
})

test('global session cap evicts idle state and invalidates stale delivery leases', () => {
  const context = createChatContext({maxSessions: 2})
  const old = context.capture('a')
  context.append(old, 'user', 'private-a')
  context.append(context.capture('b'), 'user', 'private-b')
  context.capture('c')
  expect(context.stats().sessions).toBe(2)
  expect(context.isCurrent(old)).toBe(false)
  expect(context.append(old, 'assistant', 'late')).toBe(false)
  expect(old.state.entries).toEqual([])
})

test('snapshot excludes the observed current user and respects remaining request budget', () => {
  const context = createChatContext()
  const lease = context.capture('a')
  context.append(lease, 'user', 'first')
  context.append(lease, 'assistant', 'reply')
  context.append(lease, 'user', 'current')
  expect(context.history('a', {beforeUser: 'current', budget: 5})).toEqual([{role: 'assistant', content: 'reply'}])
  expect(context.history('a', {beforeUser: 'current', budget: 10})).toHaveLength(2)
})

test('a repeated but unobserved prompt does not truncate an older matching user and its replies', () => {
  const context = createChatContext()
  const lease = context.capture('a')
  context.append(lease, 'user', 'repeat')
  context.append(lease, 'assistant', 'first reply')
  context.append(lease, 'user', 'later topic')
  context.append(lease, 'assistant', 'latest reply')
  expect(context.history('a', {beforeUser: 'repeat'})).toEqual([
    {role: 'user', content: 'repeat'}, {role: 'assistant', content: 'first reply'},
    {role: 'user', content: 'later topic'}, {role: 'assistant', content: 'latest reply'},
  ])
})

test('same-key jobs serialize while independent conversations use a bounded shared pool', async () => {
  const context = createChatContext({maxConcurrent: 2})
  const gateA = deferred(), gateB = deferred(), gateC = deferred()
  const started = []
  const a = context.run('a', async () => { started.push('a1'); await gateA.promise; return 'a1' })
  const a2 = context.run('a', async () => { started.push('a2'); return 'a2' })
  const b = context.run('b', async () => { started.push('b'); await gateB.promise })
  const c = context.run('c', async () => { started.push('c'); await gateC.promise })
  expect(started).toEqual(['a1', 'b'])
  expect(context.stats()).toMatchObject({active: 2, pending: 4})
  gateA.resolve()
  await a
  await flush()
  expect(started).toEqual(['a1', 'b', 'c'])
  gateB.resolve()
  await b
  await a2
  expect(started).toEqual(['a1', 'b', 'c', 'a2'])
  gateC.resolve()
  await c
  expect(context.stats()).toMatchObject({active: 0, pending: 0})
})

test('bounded queues reject overload and expire waiting jobs without leaking timers', async () => {
  jest.useFakeTimers()
  const context = createChatContext({maxPendingPerSession: 2, maxPending: 2, queueTimeoutMs: 100})
  const gate = deferred()
  const first = context.run('a', () => gate.promise)
  const second = expect(context.run('a', () => 'never')).rejects.toMatchObject({code: 'CHAT_CONTEXT_BUSY'})
  await expect(context.run('a', () => 'excess')).rejects.toMatchObject({code: 'CHAT_CONTEXT_BUSY'})
  await expect(context.run('b', () => 'global excess')).rejects.toMatchObject({code: 'CHAT_CONTEXT_BUSY'})
  await jest.advanceTimersByTimeAsync(100)
  await second
  expect(context.stats()).toMatchObject({active: 1, pending: 1})
  gate.resolve('done')
  await first
  expect(jest.getTimerCount()).toBe(0)
})

test('active sessions cannot be evicted to bypass concurrency or memory limits', async () => {
  const context = createChatContext({maxSessions: 1})
  const gate = deferred()
  const first = context.run('a', () => gate.promise)
  await expect(context.run('b', () => 'excess')).rejects.toMatchObject({code: 'CHAT_CONTEXT_BUSY'})
  expect(context.stats().sessions).toBe(1)
  gate.resolve()
  await first
})

test('clear rejects old active/queued generations and blocks late history writes', async () => {
  const context = createChatContext()
  const lease = context.capture('a'), gate = deferred(), queued = jest.fn()
  const first = expect(context.run('a', () => gate.promise)).rejects.toMatchObject({code: 'CHAT_CONTEXT_CHANGED'})
  const second = expect(context.run('a', queued)).rejects.toMatchObject({code: 'CHAT_CONTEXT_CHANGED'})
  context.append(lease, 'user', 'old persona')
  context.clear('a')
  gate.resolve('late result')
  await Promise.all([first, second])
  expect(queued).not.toHaveBeenCalled()
  expect(context.append(lease, 'assistant', 'late')).toBe(false)
  expect(context.history('a')).toEqual([])
  await expect(context.run('a', () => 'new')).resolves.toBe('new')
})
