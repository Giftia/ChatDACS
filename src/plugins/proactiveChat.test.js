'use strict'

const {createProactiveChat} = require('./proactiveChat')
const wrapperTemplate = require('../../plugins/proactiveChat')
const GROUP = '157311946'
const HOUR = 3600000
const human = (overrides = {}) => ({platform: 'onebot', selfId: 'bot', groupId: GROUP,
  userId: 'human', content: 'real human text', messageType: 'group', ...overrides})
const demoMetadata = (overrides = {}) => ({platform: 'napcat', selfId: 'bot', targetId: GROUP,
  groupId: JSON.stringify({platform: 'napcat', self: 'bot', group: GROUP}), raw: {scope: 'group'}, ...overrides})
function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return {promise, resolve, reject}
}

describe('proactive group chat', () => {
  let deps
  let runtime
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-11-03T04:00:00Z')) // Shanghai noon.
    deps = {generate: jest.fn().mockResolvedValue({text: 'proactive reply'}),
      send: jest.fn().mockResolvedValue(undefined), canSend: jest.fn().mockResolvedValue(true),
      random: jest.fn(() => 0.5), logger: {error: jest.fn()}, groupIds: [GROUP], minDelayMs: 1000, maxDelayMs: 3000}
    runtime = createProactiveChat(deps)
  })
  afterEach(() => { runtime.stop(); jest.clearAllTimers(); jest.useRealTimers() })

  test('constructing and starting without human context never schedules or generates', async () => {
    expect(jest.getTimerCount()).toBe(0)
    expect(runtime.start()).toEqual({status: 'started'})
    await jest.advanceTimersByTimeAsync(HOUR)
    expect(runtime.getStatus().scheduled).toBe(false)
    expect(deps.generate).not.toHaveBeenCalled()
    await expect(runtime.triggerNow(human())).resolves.toEqual({status: 'skipped', reason: 'no-context'})
  })

  test('human activity schedules once, later activity updates context without resetting randomized delay', async () => {
    runtime.start()
    runtime.observe(human())
    const due = runtime.getStatus().nextRunAt
    await jest.advanceTimersByTimeAsync(1000)
    runtime.observe(human({content: 'newest message'}))
    expect(runtime.getStatus().nextRunAt).toBe(due)
    expect(deps.random).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(999)
    expect(deps.generate).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(deps.generate).toHaveBeenCalledTimes(1)
    expect(deps.generate.mock.calls[0][0]).toMatchObject({content: 'newest message', targetId: GROUP})
    expect(deps.send).toHaveBeenCalledWith(deps.generate.mock.calls[0][0], 'proactive reply')
    expect(runtime.getStatus().sentToday).toBe(1)
    expect(runtime.getStatus().scheduled).toBe(true)
  })

  test('observing before explicit start does not create a timer', () => {
    runtime.observe(human())
    expect(jest.getTimerCount()).toBe(0)
    runtime.start(); runtime.start()
    expect(jest.getTimerCount()).toBe(1)
  })

  test.each([
    {groupId: 'other'}, {targetId: 'other'}, {isPrivate: true}, {messageType: 'private'},
    {raw: {scope: 'private'}}, {platform: 'telegram'}, {isBot: true}, {isSelf: true},
    {userId: 'bot'}, {role: 'assistant'}, {userId: undefined}, {userId: ''},
  ])('wrong groups, private messages and bot activity do not schedule %#', (overrides) => {
    runtime.start()
    expect(runtime.observe(human(overrides)).status).toBe('skipped')
    expect(jest.getTimerCount()).toBe(0)
    expect(deps.generate).not.toHaveBeenCalled()
  })

  test('targetId allowlist preserves synthetic DB group and channel isolation metadata', async () => {
    runtime.start()
    const groupId = JSON.stringify({platform: 'onebot', self: 'bot', group: GROUP})
    runtime.observe(human({groupId, targetId: GROUP, raw: {scope: 'group'}, channelKey: 'isolated-channel'}))
    await runtime.triggerNow()
    expect(deps.generate.mock.calls[0][0]).toMatchObject({groupId, targetId: GROUP, selfId: 'bot',
      platform: 'onebot', channelKey: 'isolated-channel'})
    expect(deps.send.mock.calls[0][0].groupId).toBe(groupId)
  })

  test('empty default allowlist fails closed even for the formerly hardcoded group', async () => {
    const {groupIds, ...withoutAllowlist} = deps
    runtime = createProactiveChat(withoutAllowlist)
    runtime.start()
    expect(runtime.observe(human()).status).toBe('skipped')
    expect(runtime.observe(human({groupId: 'other'})).status).toBe('skipped')
    await expect(runtime.triggerNow()).resolves.toMatchObject({status: 'skipped'})
    expect(jest.getTimerCount()).toBe(0)
  })

  test('single-group allowlist actually selects its configured target instead of a hardcoded ID', async () => {
    runtime = createProactiveChat({...deps, groupIds: ['configured-test-group']})
    runtime.start()
    expect(runtime.observe(human()).status).toBe('skipped')
    const groupId = JSON.stringify({platform: 'napcat', self: 'self-2', group: 'configured-test-group'})
    expect(runtime.observe(human({platform: 'napcat', selfId: 'self-2', groupId,
      targetId: 'configured-test-group', raw: {scope: 'group'}}))).toEqual({status: 'observed'})
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'sent'})
    expect(deps.send.mock.calls[0][0]).toMatchObject({platform: 'napcat', selfId: 'self-2', groupId,
      targetId: 'configured-test-group'})
  })

  test('real napcat entry observes, schedules and sends while preserving platform/self/group isolation', async () => {
    runtime.start()
    const groupId = JSON.stringify({platform: 'napcat', self: 'actual-bot', group: GROUP})
    expect(runtime.observe(human({platform: 'napcat', selfId: 'actual-bot', groupId, targetId: GROUP,
      raw: {scope: 'group'}}))).toEqual({status: 'observed'})
    await jest.advanceTimersByTimeAsync(2000)
    expect(deps.generate).toHaveBeenCalledTimes(1)
    expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({platform: 'napcat', selfId: 'actual-bot', groupId,
      targetId: GROUP}), 'proactive reply')
    await expect(runtime.triggerNow({platform: 'qq', groupId, targetId: GROUP})).resolves.toMatchObject({reason: 'wrong-context'})
    await expect(runtime.triggerNow({platform: 'napcat', selfId: 'other-bot', groupId, targetId: GROUP}))
      .resolves.toMatchObject({reason: 'wrong-context'})
  })

  test.each(['', '  ', null, {}, 42])('empty or non-text context never calls a model %#', async (content) => {
    runtime.start()
    expect(runtime.observe(human({content}))).toMatchObject({status: 'skipped'})
    await runtime.triggerNow()
    expect(deps.generate).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
  })

  test.each([-2 * HOUR, 1])('stale or future source timestamp cannot become fresh activity %#', async (offset) => {
    runtime.start()
    expect(runtime.observe(human({timestamp: Date.now() + offset}))).toEqual({status: 'skipped', reason: 'stale-context'})
    await runtime.triggerNow()
    expect(deps.generate).not.toHaveBeenCalled()
  })

  test('no human activity for two hours expires context and cannot be refreshed by bot events', async () => {
    runtime.start(); runtime.observe(human())
    // Freeze wall-clock directly rather than running two hours of unrelated scheduled attempts.
    jest.setSystemTime(new Date(Date.now() + 2 * HOUR))
    runtime.observe(human({isBot: true}))
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'idle'})
    expect(deps.generate).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })

  test.each(['2026-11-03T15:00:00Z', '2026-11-03T23:59:59Z', '2026-11-03T16:00:00Z'])
  ('quiet Shanghai 23:00-08:00 blocks automatic and manual generation at %s', async (time) => {
    jest.setSystemTime(new Date(time))
    runtime.start(); runtime.observe(human())
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'quiet-hours'})
    await jest.advanceTimersByTimeAsync(500)
    expect(deps.generate).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
  })

  test('08:00 Shanghai permits generation but 23:00 reached during generation rejects send', async () => {
    jest.setSystemTime(new Date('2026-11-03T00:00:00Z'))
    runtime.start(); runtime.observe(human())
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'sent'})
    jest.setSystemTime(new Date('2026-11-03T14:59:59Z'))
    runtime.observe(human())
    const wait = deferred()
    deps.generate.mockReturnValueOnce(wait.promise)
    const pending = runtime.triggerNow()
    await jest.advanceTimersByTimeAsync(0)
    jest.setSystemTime(new Date('2026-11-03T15:00:00Z'))
    wait.resolve({text: 'too late'})
    await expect(pending).resolves.toEqual({status: 'skipped', reason: 'quiet-hours'})
    expect(deps.send).toHaveBeenCalledTimes(1)
  })

  test('Shanghai calendar-day limit is 12, persists across restart, and resets only with a new day', async () => {
    runtime.start(); runtime.observe(human())
    for (let i = 0; i < 12; i += 1) await expect(runtime.triggerNow()).resolves.toEqual({status: 'sent'})
    expect(runtime.getStatus().sentToday).toBe(12)
    runtime.stop(); runtime.start(); runtime.observe(human())
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'daily-limit'})
    expect(deps.generate).toHaveBeenCalledTimes(12)
    jest.setSystemTime(new Date('2026-11-04T00:00:00Z'))
    runtime.observe(human())
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'sent'})
    expect(runtime.getStatus()).toMatchObject({day: '2026-11-04', sentToday: 1})
  })

  test('Shanghai day rolls at UTC 16:00, not UTC midnight', async () => {
    jest.setSystemTime(new Date('2026-11-03T14:00:00Z'))
    runtime.start(); runtime.observe(human())
    await runtime.triggerNow()
    expect(runtime.getStatus()).toMatchObject({day: '2026-11-03', sentToday: 1})
    jest.setSystemTime(new Date('2026-11-03T16:00:00Z'))
    expect(runtime.getStatus()).toMatchObject({day: '2026-11-04', sentToday: 0})
  })

  test('old day success entries are deleted rather than accumulating forever', async () => {
    runtime.start(); runtime.observe(human())
    await runtime.triggerNow()
    const deleteSpy = jest.spyOn(Map.prototype, 'delete')
    let quota
    let status
    try {
      jest.setSystemTime(new Date('2026-11-04T04:00:00Z'))
      status = runtime.getStatus()
      const deletion = deleteSpy.mock.calls.findIndex(([key]) => key === '2026-11-03')
      quota = deleteSpy.mock.contexts[deletion]
    } finally { deleteSpy.mockRestore() }
    expect(status.sentToday).toBe(0)
    expect(quota).toBeInstanceOf(Map)
    expect(quota.size).toBe(0)
    runtime.observe(human())
    await runtime.triggerNow()
    expect(quota.size).toBe(1)
    expect([...quota.keys()]).toEqual(['2026-11-04'])
  })

  test.each(['generate', 'send', 'permission'])('failure during %s uses safe code, does not count or retry', async (stage) => {
    const error = new Error('private token and user body')
    if (stage === 'generate') deps.generate.mockRejectedValueOnce(error)
    if (stage === 'send') deps.send.mockRejectedValueOnce(error)
    if (stage === 'permission') deps.canSend.mockRejectedValueOnce(error)
    runtime.start(); runtime.observe(human())
    const code = `PROACTIVE_${stage.toUpperCase()}_FAILED`
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'failed', code})
    expect(runtime.getStatus()).toMatchObject({sentToday: 0, scheduled: false})
    expect(deps.logger.error.mock.calls).toEqual([[code]])
    await jest.advanceTimersByTimeAsync(60000)
    expect(deps.generate).toHaveBeenCalledTimes(stage === 'permission' ? 0 : 1)
    runtime.observe(human({content: 'new human activity'}))
    expect(runtime.getStatus().scheduled).toBe(true)
  })

  test.each([false, {ok: false}, {sent: false}, {status: 'failed'}, {status: 'skipped'}])('failed send result never records success %#', async (outcome) => {
    deps.send.mockResolvedValue(outcome)
    runtime.start(); runtime.observe(human())
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'failed', code: 'PROACTIVE_SEND_FAILED'})
    expect(runtime.getStatus().sentToday).toBe(0)
  })

  test.each([null, {}, {text: ''}, {text: '  '}, {text: {content: 'no'}}, 'not the agreed response'])
  ('null or unsupported generation is not sent or retried %#', async (response) => {
    deps.generate.mockResolvedValue(response)
    runtime.start(); runtime.observe(human())
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'empty-generation'})
    expect(runtime.getStatus().scheduled).toBe(false)
    expect(deps.send).not.toHaveBeenCalled()
  })

  test('new human activity invalidates in-flight generation without parallel model calls', async () => {
    const wait = deferred()
    deps.generate.mockReturnValueOnce(wait.promise)
    runtime.start(); runtime.observe(human())
    const pending = runtime.triggerNow()
    await jest.advanceTimersByTimeAsync(0)
    runtime.observe(human({content: 'new human message'}))
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'busy'})
    expect(deps.generate).toHaveBeenCalledTimes(1)
    wait.resolve({text: 'outdated reply'})
    await expect(pending).resolves.toEqual({status: 'skipped', reason: 'stale-generation'})
    expect(deps.send).not.toHaveBeenCalled()
    expect(runtime.getStatus().scheduled).toBe(true)
    await jest.advanceTimersByTimeAsync(2000)
    expect(deps.generate).toHaveBeenCalledTimes(2)
    expect(deps.send).toHaveBeenCalledTimes(1)
  })

  test('an empty new human event also invalidates a pending generation', async () => {
    const wait = deferred()
    deps.generate.mockReturnValueOnce(wait.promise)
    runtime.start(); runtime.observe(human())
    const pending = runtime.triggerNow()
    await jest.advanceTimersByTimeAsync(0)
    runtime.observe(human({content: ''}))
    wait.resolve({text: 'outdated'})
    await expect(pending).resolves.toMatchObject({status: 'skipped'})
    expect(deps.send).not.toHaveBeenCalled()
  })

  test('stop clears timers and stale callbacks cannot generate', async () => {
    runtime.start(); runtime.observe(human())
    expect(jest.getTimerCount()).toBe(1)
    runtime.stop(); runtime.stop()
    expect(jest.getTimerCount()).toBe(0)
    await jest.advanceTimersByTimeAsync(60000)
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'stopped'})
    expect(deps.generate).not.toHaveBeenCalled()
  })

  test.each([false, true])('stop blocks late generation even after restart: %s', async (restart) => {
    const wait = deferred()
    deps.generate.mockReturnValueOnce(wait.promise)
    runtime.start(); runtime.observe(human())
    const pending = runtime.triggerNow()
    await jest.advanceTimersByTimeAsync(0)
    runtime.stop()
    if (restart) runtime.start()
    wait.resolve({text: 'old lifecycle'})
    await expect(pending).resolves.toEqual({status: 'skipped', reason: 'stopped'})
    expect(deps.send).not.toHaveBeenCalled()
  })

  test('new activity while send is pending does not allow parallel sends; only successful send counts', async () => {
    const wait = deferred()
    deps.send.mockReturnValueOnce(wait.promise)
    runtime.start(); runtime.observe(human())
    const pending = runtime.triggerNow()
    await jest.advanceTimersByTimeAsync(0)
    runtime.observe(human({content: 'new activity while already sending'}))
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'busy'})
    expect(runtime.getStatus().sentToday).toBe(0)
    wait.resolve()
    await expect(pending).resolves.toEqual({status: 'sent'})
    expect(runtime.getStatus().sentToday).toBe(1)
  })

  test.each([{muted: true}, {isMuted: true}, {canSend: false}, {allowProactive: false}])
  ('muted context never generates or sends %#', async (state) => {
    runtime.start(); runtime.observe(human(state))
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'muted'})
    expect(deps.generate).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
  })

  test('dynamic permission is rechecked before sending', async () => {
    deps.canSend.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    runtime.start(); runtime.observe(human())
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'muted'})
    expect(deps.canSend).toHaveBeenCalledTimes(2)
    expect(deps.generate).toHaveBeenCalledTimes(1)
    expect(deps.send).not.toHaveBeenCalled()
    expect(runtime.getStatus().scheduled).toBe(false)
  })

  test.each([1, 2])('hung canSend check %s times out at 5 seconds and releases busy without sending', async (check) => {
    const wait = deferred()
    if (check === 1) deps.canSend.mockReturnValueOnce(wait.promise)
    else deps.canSend.mockResolvedValueOnce(true).mockReturnValueOnce(wait.promise)
    runtime.start(); runtime.observe(human())
    const pending = runtime.triggerNow()
    await jest.advanceTimersByTimeAsync(4999)
    expect(runtime.getStatus().busy).toBe(true)
    await jest.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toEqual({status: 'failed', code: 'PROACTIVE_PERMISSION_FAILED'})
    expect(runtime.getStatus()).toMatchObject({busy: false, scheduled: false, sentToday: 0})
    expect(jest.getTimerCount()).toBe(0)
    wait.resolve(true)
    await jest.advanceTimersByTimeAsync(0)
    expect(deps.send).not.toHaveBeenCalled()
    runtime.observe(human({content: 'fresh activity after timeout'}))
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'sent'})
  })

  test('stop cancels a hung permission deadline immediately and late rejection stays consumed', async () => {
    const wait = deferred()
    deps.canSend.mockReturnValueOnce(wait.promise)
    runtime.start(); runtime.observe(human())
    const pending = runtime.triggerNow()
    await jest.advanceTimersByTimeAsync(0)
    expect(jest.getTimerCount()).toBe(1)
    runtime.stop()
    expect(jest.getTimerCount()).toBe(0)
    await expect(pending).resolves.toEqual({status: 'skipped', reason: 'stopped'})
    expect(runtime.getStatus().busy).toBe(false)
    wait.reject(new Error('private user body'))
    await jest.advanceTimersByTimeAsync(0)
    expect(deps.generate).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
    expect(deps.logger.error).not.toHaveBeenCalled()
  })

  test('new activity during final async permission invalidates generation before send', async () => {
    const wait = deferred()
    deps.canSend.mockResolvedValueOnce(true).mockReturnValueOnce(wait.promise)
    runtime.start(); runtime.observe(human())
    const pending = runtime.triggerNow()
    await jest.advanceTimersByTimeAsync(0)
    runtime.observe(human({content: 'newer message'}))
    wait.resolve(true)
    await expect(pending).resolves.toEqual({status: 'skipped', reason: 'stale-generation'})
    expect(deps.send).not.toHaveBeenCalled()
  })

  test('manual trigger cannot replace observed context or target a private/other group', async () => {
    runtime.start(); runtime.observe(human())
    await expect(runtime.triggerNow({groupId: 'other'})).resolves.toMatchObject({reason: 'wrong-group'})
    await expect(runtime.triggerNow({groupId: GROUP, raw: {scope: 'private'}})).resolves.toMatchObject({reason: 'wrong-group'})
    await runtime.triggerNow(human({content: 'fabricated selector content'}))
    expect(deps.generate.mock.calls[0][0].content).toBe('real human text')
  })

  test('one-shot demonstration uses metadata only, never invents human activity or automatic scheduling', async () => {
    runtime.start()
    const source = demoMetadata({content: 'must not become user input', text: 'must not become user input',
      userId: 'not-a-demo-user', raw: {scope: 'group', text: 'must not be forwarded'}})
    await expect(runtime.demonstrate(source)).resolves.toEqual({status: 'sent'})
    const generatedContext = deps.generate.mock.calls[0][0]
    expect(generatedContext).toMatchObject({platform: 'napcat', selfId: 'bot', groupId: source.groupId,
      targetId: GROUP, raw: {scope: 'group', proactiveDemo: true}})
    expect(generatedContext).not.toHaveProperty('userId')
    expect(generatedContext).not.toHaveProperty('content')
    expect(generatedContext).not.toHaveProperty('text')
    expect(generatedContext.raw).not.toHaveProperty('text')
    expect(deps.send).toHaveBeenCalledWith(generatedContext, 'proactive reply')
    expect(runtime.getStatus()).toMatchObject({lastHumanAt: null, scheduled: false, sentToday: 1})
    expect(jest.getTimerCount()).toBe(0)
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'no-context'})
    await expect(runtime.demonstrate(source)).resolves.toEqual({status: 'skipped', reason: 'demo-used'})
    runtime.stop(); runtime.start()
    await expect(runtime.demonstrate(source)).resolves.toEqual({status: 'skipped', reason: 'demo-used'})
    expect(deps.generate).toHaveBeenCalledTimes(1)
  })

  test('demonstration quiet override applies only to the explicit one-shot, not normal trigger or run', async () => {
    jest.setSystemTime(new Date('2026-11-03T15:10:00Z'))
    runtime.start()
    runtime.observe(human())
    const lastHumanAt = runtime.getStatus().lastHumanAt
    await expect(runtime.demonstrate(demoMetadata())).resolves.toEqual({status: 'skipped', reason: 'quiet-hours'})
    expect(deps.generate).not.toHaveBeenCalled()
    await expect(runtime.demonstrate(demoMetadata(), {allowQuietHours: true})).resolves.toEqual({status: 'sent'})
    expect(runtime.getStatus()).toMatchObject({lastHumanAt, sentToday: 1, scheduled: false})
    await expect(runtime.triggerNow()).resolves.toEqual({status: 'skipped', reason: 'quiet-hours'})
    await jest.advanceTimersByTimeAsync(60000)
    expect(deps.generate).toHaveBeenCalledTimes(1)
  })

  test.each([{targetId: 'other'}, {platform: 'telegram'}, {selfId: undefined}, {selfId: ''},
    {raw: {scope: 'private'}}, {raw: undefined}, {isPrivate: true}])
  ('demonstration rejects wrong target/account/scope metadata %#', async (overrides) => {
    runtime.start()
    await expect(runtime.demonstrate(demoMetadata(overrides), {allowQuietHours: true}))
      .resolves.toEqual({status: 'skipped', reason: 'wrong-context'})
    expect(deps.generate).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })

  test('demonstration honors stop, quota and an empty allowlist despite a quiet override', async () => {
    await expect(runtime.demonstrate(demoMetadata(), {allowQuietHours: true})).resolves.toMatchObject({reason: 'stopped'})
    runtime = createProactiveChat({...deps, dailyLimit: 0})
    runtime.start()
    await expect(runtime.demonstrate(demoMetadata(), {allowQuietHours: true})).resolves.toMatchObject({reason: 'daily-limit'})
    runtime.stop()
    runtime = createProactiveChat({...deps, groupIds: []})
    runtime.start()
    await expect(runtime.demonstrate(demoMetadata(), {allowQuietHours: true})).resolves.toMatchObject({reason: 'wrong-context'})
    expect(deps.generate).not.toHaveBeenCalled()
  })

  test.each(['generate', 'send', 'empty', 'permission'])('demonstration %s failure consumes its attempt and never retries', async (stage) => {
    if (stage === 'generate') deps.generate.mockRejectedValueOnce(new Error('private generation error'))
    if (stage === 'send') deps.send.mockRejectedValueOnce(new Error('private send error'))
    if (stage === 'empty') deps.generate.mockResolvedValueOnce(null)
    if (stage === 'permission') deps.canSend.mockResolvedValueOnce(false)
    runtime.start()
    const result = await runtime.demonstrate(demoMetadata())
    expect(result.status).not.toBe('sent')
    expect(runtime.getStatus()).toMatchObject({sentToday: 0, lastHumanAt: null, scheduled: false})
    await expect(runtime.demonstrate(demoMetadata())).resolves.toEqual({status: 'skipped', reason: 'demo-used'})
    await jest.advanceTimersByTimeAsync(60000)
    expect(deps.generate).toHaveBeenCalledTimes(stage === 'permission' ? 0 : 1)
  })

  test('demonstration uses bounded permission and cannot replay while busy', async () => {
    deps.canSend.mockReturnValueOnce(new Promise(() => {}))
    runtime.start()
    const pending = runtime.demonstrate(demoMetadata())
    await expect(runtime.demonstrate(demoMetadata())).resolves.toEqual({status: 'skipped', reason: 'demo-used'})
    await jest.advanceTimersByTimeAsync(5000)
    await expect(pending).resolves.toEqual({status: 'failed', code: 'PROACTIVE_PERMISSION_FAILED'})
    expect(runtime.getStatus()).toMatchObject({busy: false, sentToday: 0, scheduled: false})
    expect(deps.generate).not.toHaveBeenCalled()
  })

  test('demonstration rechecks mute before sending even when quiet override is approved', async () => {
    jest.setSystemTime(new Date('2026-11-03T15:15:00Z'))
    deps.canSend.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    runtime.start()
    await expect(runtime.demonstrate(demoMetadata(), {allowQuietHours: true})).resolves.toEqual({status: 'skipped', reason: 'muted'})
    expect(deps.generate).toHaveBeenCalledTimes(1)
    expect(deps.send).not.toHaveBeenCalled()
    expect(runtime.getStatus().sentToday).toBe(0)
    await expect(runtime.demonstrate(demoMetadata(), {allowQuietHours: true})).resolves.toMatchObject({reason: 'demo-used'})
  })

  test('new real human activity invalidates demonstration and only that human may schedule normal follow-up', async () => {
    const wait = deferred()
    deps.generate.mockReturnValueOnce(wait.promise)
    runtime.start()
    const pending = runtime.demonstrate(demoMetadata())
    await jest.advanceTimersByTimeAsync(0)
    runtime.observe(human({platform: 'napcat', content: 'new actual message'}))
    const lastHumanAt = runtime.getStatus().lastHumanAt
    wait.resolve({text: 'obsolete demo'})
    await expect(pending).resolves.toEqual({status: 'skipped', reason: 'stale-generation'})
    expect(deps.send).not.toHaveBeenCalled()
    expect(runtime.getStatus()).toMatchObject({lastHumanAt, scheduled: true})
    await jest.advanceTimersByTimeAsync(2000)
    expect(deps.send).toHaveBeenCalledTimes(1)
    expect(deps.send.mock.calls[0][0]).toMatchObject({content: 'new actual message'})
    expect(deps.send.mock.calls[0][0].raw?.proactiveDemo).not.toBe(true)
  })

  test('stop/start prevents a late demonstration result from sending or starting timers', async () => {
    const wait = deferred()
    deps.generate.mockReturnValueOnce(wait.promise)
    runtime.start()
    const pending = runtime.demonstrate(demoMetadata(), {allowQuietHours: true})
    await jest.advanceTimersByTimeAsync(0)
    runtime.stop(); runtime.start()
    wait.resolve({text: 'late demo'})
    await expect(pending).resolves.toMatchObject({reason: 'stopped'})
    expect(deps.send).not.toHaveBeenCalled()
    expect(runtime.getStatus()).toMatchObject({lastHumanAt: null, scheduled: false})
    await expect(runtime.demonstrate(demoMetadata(), {allowQuietHours: true})).resolves.toMatchObject({reason: 'demo-used'})
  })

  test('a demo does not discard a pre-existing automatic timer that becomes due while generation is busy', async () => {
    const wait = deferred()
    deps.generate.mockReturnValueOnce(wait.promise)
    runtime.start(); runtime.observe(human())
    const pending = runtime.demonstrate(demoMetadata())
    await jest.advanceTimersByTimeAsync(2000)
    expect(deps.generate).toHaveBeenCalledTimes(1)
    wait.resolve({text: 'demo greeting'})
    await expect(pending).resolves.toEqual({status: 'sent'})
    expect(runtime.getStatus().scheduled).toBe(true)
  })

  test('timer handles are unrefed so an idle process can exit', () => {
    const unref = jest.fn()
    const clear = jest.fn()
    const set = jest.fn(() => ({unref}))
    runtime = createProactiveChat({...deps, setTimeout: set, clearTimeout: clear})
    runtime.start(); runtime.observe(human())
    expect(set).toHaveBeenCalledWith(expect.any(Function), 2000)
    expect(unref).toHaveBeenCalledTimes(1)
    runtime.stop()
    expect(clear).toHaveBeenCalledWith({unref})
  })

  test('an already queued old timer cannot run early after stop/start or replace the new timer', async () => {
    const set = jest.fn(() => ({unref: jest.fn()}))
    runtime = createProactiveChat({...deps, setTimeout: set, clearTimeout: jest.fn()})
    runtime.start(); runtime.observe(human())
    const oldCallback = set.mock.calls[0][0]
    runtime.stop(); runtime.start()
    const nextRunAt = runtime.getStatus().nextRunAt
    oldCallback()
    await Promise.resolve()
    expect(deps.generate).not.toHaveBeenCalled()
    expect(runtime.getStatus()).toMatchObject({scheduled: true, nextRunAt})
  })

  test('defaults enforce 10-30 minute randomness and do not schedule after 23:00 or expiry', () => {
    runtime = createProactiveChat({generate: deps.generate, send: deps.send, groupIds: [GROUP], random: () => 0})
    runtime.start(); runtime.observe(human())
    expect(runtime.getStatus().nextRunAt - Date.now()).toBe(600000)
    runtime.stop()
    jest.setSystemTime(new Date('2026-11-03T14:55:00Z'))
    runtime.start(); runtime.observe(human())
    expect(runtime.getStatus().scheduled).toBe(false)
  })

  test.each([{dailyLimit: 13}, {dailyLimit: -1}, {maxIdleMs: 3 * HOUR}, {minDelayMs: 0},
    {maxDelayMs: 1}, {generate: undefined}, {send: undefined}, {groupIds: [GROUP, 'other']},
    {groupIds: ['']}, {groupIds: [{}]}])('invalid or expanded safety limits fail closed %#', (settings) => {
    expect(() => createProactiveChat({...deps, ...settings})).toThrow('PROACTIVE_CONFIG_INVALID')
  })
})

describe('legacy proactive plugin wrapper', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers() })

  test('require/init never start timing, and explicit lifecycle delegates to injected runtime', async () => {
    const runtime = {observe: jest.fn(), start: jest.fn(), stop: jest.fn(), triggerNow: jest.fn().mockResolvedValue({status: 'sent'}),
      demonstrate: jest.fn().mockResolvedValue({status: 'sent'})}
    const plugin = {...wrapperTemplate}
    plugin.init({proactiveChat: runtime})
    expect(plugin.插件名).toBe('主动聊天插件')
    expect(typeof plugin.指令).toBe('string')
    expect(jest.getTimerCount()).toBe(0)
    expect(runtime.start).not.toHaveBeenCalled()
    await expect(plugin.execute('human message', 'user', 'name', GROUP, 'group', {type: 'qq', selfId: 'self'}))
      .resolves.toBeUndefined()
    expect(runtime.observe).toHaveBeenCalledWith(expect.objectContaining({content: 'human message', userId: 'user',
      groupId: GROUP, platform: 'qq', messageType: 'group', selfId: 'self'}))
    plugin.start(); plugin.stop()
    expect(runtime.start).toHaveBeenCalledTimes(1)
    expect(runtime.stop).toHaveBeenCalledTimes(1)
    await expect(plugin.triggerNow()).resolves.toEqual({status: 'sent'})
    const metadata = demoMetadata()
    await expect(plugin.demonstrate(metadata, {allowQuietHours: true})).resolves.toEqual({status: 'sent'})
    expect(runtime.demonstrate).toHaveBeenCalledWith(metadata, {allowQuietHours: true})
  })

  test('dependency-backed wrapper remains disabled until explicit start', () => {
    const plugin = {...wrapperTemplate}
    plugin.init({generateProactive: jest.fn(), sendProactive: jest.fn()})
    plugin.observe(human())
    expect(jest.getTimerCount()).toBe(0)
    plugin.stop()
  })

  test('unconfigured wrapper is inert and does not invent user activity', async () => {
    const plugin = {...wrapperTemplate}
    plugin.init({})
    await expect(plugin.execute('text', 'user', 'name', GROUP, 'group')).resolves.toBeUndefined()
    expect(plugin.start()).toEqual({status: 'skipped', reason: 'not-configured'})
    await expect(plugin.triggerNow(human())).resolves.toEqual({status: 'skipped', reason: 'no-context'})
    expect(jest.getTimerCount()).toBe(0)
  })
})
