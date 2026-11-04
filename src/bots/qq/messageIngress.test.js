const {createMessageIngress} = require('./messageIngress')

const message = (overrides = {}) => ({post_type: 'message', message_type: 'group', sub_type: 'normal',
  self_id: 10001, user_id: 20002, group_id: 30003, message_id: -42, message: 'hello', ...overrides})

describe('QQ message ingress', () => {
  test.each(['group', 'private'])('ignores %s self messages with numeric/string identity', (message_type) => {
    const ingress = createMessageIngress()
    expect(ingress.shouldIgnore(message({message_type, user_id: '10001'}))).toBe(true)
    expect(ingress.shouldIgnore(message({post_type: 'message_sent', user_id: 20002, message_type}))).toBe(true)
  })

  test('records before processing, does not refresh duplicates and expires at TTL', () => {
    let time = 0
    const ingress = createMessageIngress({now: () => time, ttlMs: 100})
    expect(ingress.shouldIgnore(message())).toBe(false)
    time = 99
    expect(ingress.shouldIgnore(message({message_id: '-42', self_id: '10001'}))).toBe(true)
    time = 100
    expect(ingress.shouldIgnore(message())).toBe(false)
  })

  test('bounds capacity by evicting the oldest entry', () => {
    const ingress = createMessageIngress({maxEntries: 2})
    for (const message_id of [1, 2, 3]) expect(ingress.shouldIgnore(message({message_id}))).toBe(false)
    expect(ingress.shouldIgnore(message({message_id: 2}))).toBe(true)
    expect(ingress.shouldIgnore(message({message_id: 3}))).toBe(true)
    expect(ingress.shouldIgnore(message({message_id: 1}))).toBe(false)
  })

  test('scopes keys by self, group/private, peer and sender', () => {
    const ingress = createMessageIngress()
    const variants = [{}, {self_id: 10002}, {group_id: 30004}, {user_id: 20003},
      {message_type: 'private', group_id: undefined}, {message_type: 'private', group_id: undefined, user_id: 20003}]
    for (const variant of variants) expect(ingress.shouldIgnore(message(variant))).toBe(false)
    for (const variant of variants) expect(ingress.shouldIgnore(message(variant))).toBe(true)
  })

  test.each([undefined, null, '', ' ', '1.5', {}, [], true, NaN, Infinity, 9007199254740992])(
    'never deduplicates invalid message ID %p', (message_id) => {
      const ingress = createMessageIngress()
      expect(ingress.shouldIgnore(message({message_id}))).toBe(false)
      expect(ingress.shouldIgnore(message({message_id}))).toBe(false)
    },
  )

  test.each([{self_id: undefined}, {user_id: undefined}, {group_id: undefined}, {self_id: false},
    {user_id: {}}, {group_id: 0}, {self_id: 9007199254740992}, {message_type: 'private', group_id: 30003}])(
    'does not reserve keys for incomplete or invalid identity %p', (identity) => {
      const ingress = createMessageIngress()
      expect(ingress.shouldIgnore(message(identity))).toBe(false)
      expect(ingress.shouldIgnore(message(identity))).toBe(false)
    },
  )

  test.each([{post_type: 'notice', notice_type: 'notify', sub_type: 'poke', user_id: 10001},
    {post_type: 'notice', notice_type: 'group_increase', sub_type: 'approve'},
    {post_type: undefined, sub_type: 'poke'}, {post_type: undefined, notice_type: 'group_increase'},
    {post_type: 'request', request_type: 'group'}])('never filters or deduplicates non-message %p', (notice) => {
    const ingress = createMessageIngress()
    expect(ingress.shouldIgnore(message(notice))).toBe(false)
    expect(ingress.shouldIgnore(message(notice))).toBe(false)
  })

  test.each(['normal', 'friend', 'group'])('supports legacy %s messages without post_type', (sub_type) => {
    const ingress = createMessageIngress()
    expect(ingress.shouldIgnore(message({post_type: undefined, sub_type}))).toBe(false)
    expect(ingress.shouldIgnore(message({post_type: undefined, sub_type}))).toBe(true)
  })

  test('clear releases all identities and instances do not share state', () => {
    const first = createMessageIngress(), second = createMessageIngress()
    expect(first.shouldIgnore(message())).toBe(false)
    expect(second.shouldIgnore(message())).toBe(false)
    expect(first.shouldIgnore(message())).toBe(true)
    first.clear()
    expect(first.shouldIgnore(message())).toBe(false)
    expect(second.shouldIgnore(message())).toBe(true)
  })
})
