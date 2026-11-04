const {createPluginAuthorization} = require('./authorization')

function qq(overrides = {}, eventOverrides = {}) {
  return {platform: 'qq', userId: 123, selfId: 456, groupId: 789,
    raw: {scope: 'group', event: {message_type: 'group', user_id: 123, self_id: 456,
      group_id: 789, sender: {user_id: 123, role: 'member'}, ...eventOverrides}}, ...overrides}
}

describe('host authorization', () => {
  const policy = createPluginAuthorization({QQBOT_ADMIN_LIST: ['123']})

  test.each(['wallpaper', 'tray', 'chatPush'])('%s requires a verified host administrator', (moduleName) => {
    expect(policy.canExecute(moduleName, qq())).toBe(true)
    expect(policy.canToggle(moduleName, qq())).toBe(true)
    const ordinary = qq({userId: 999}, {user_id: 999, sender: {role: 'owner', user_id: 999}})
    expect(policy.canExecute(moduleName, ordinary)).toBe(false)
    expect(policy.canToggle(moduleName, ordinary)).toBe(false)
  })

  test.each(['qq', 'napcat', 'onebot'])('supports authenticated %s and string/number IDs', platform => {
    const context = qq({platform, userId: '123', selfId: '456', groupId: '789'})
    expect(policy.canExecute('tray', context)).toBe(true)
    expect(createPluginAuthorization({QQBOT_ADMIN_LIST: [123]}).canExecute('tray', context)).toBe(true)
  })

  test.each([
    {platform: 'web'}, {platform: 'Web'}, {platform: 'QQ'}, {platform: 'unknown'}, {platform: ''},
    {platform: undefined}, {userId: ''}, {userId: undefined}, {selfId: ''}, {selfId: undefined},
    {groupId: 790}, {targetId: 790}, {userId: true}, {userId: '0123'}, {userId: '123 '},
    {userId: {}}, {userId: 9007199254740992}, {raw: null}, {raw: {type: 'qq', selfId: 456}},
    {raw: {scope: 'private', event: qq().raw.event}},
    {raw: {...qq().raw, platform: 'web'}}, {raw: {...qq().raw, type: 'web'}},
    {raw: {...qq().raw, selfId: 457}}, {raw: {...qq().raw, userId: 999}},
  ])('fails closed for missing or conflicting identity %#', overrides => {
    expect(policy.canExecute('tray', qq(overrides))).toBe(false)
    expect(policy.canToggle('tray', qq(overrides))).toBe(false)
  })

  test.each([{user_id: 999}, {self_id: 457}, {group_id: 790}, {message_type: 'private'},
    {sender: {user_id: 999, role: 'owner'}}])('rejects conflicting real event %#', event => {
    expect(policy.canExecute('tray', qq({}, event))).toBe(false)
    expect(policy.canToggle('ping', qq({}, event))).toBe(false)
  })

  test('accepts legacy options wrapping normalized raw without trusting options-only roles', () => {
    const context = qq()
    context.raw = {type: 'qq', selfId: 456, raw: context.raw}
    expect(policy.canExecute('tray', context)).toBe(true)
    expect(policy.canToggle('ping', qq({userId: 999, raw: {scope: 'group', role: 'owner', sender: {role: 'admin'}}}))).toBe(false)
  })

  test.each([{user_id: 999}, {self_id: 457}, {group_id: 790},
    {sender: {user_id: 123, role: 'admin'}}])('conflicting outer and inner events cannot shadow real identity %#', fields => {
    const context = qq()
    context.raw = {...context.raw, raw: {scope: 'group', event: {...context.raw.event, ...fields}}}
    expect(policy.canExecute('tray', context)).toBe(false)
    expect(policy.canToggle('ping', context)).toBe(false)
  })

  test.each(['admin', 'owner', 'member', 'ADMIN', undefined])('group toggle uses only event role %s', role => {
    const context = qq({userId: 999}, {user_id: 999, sender: {user_id: 999, role}})
    expect(policy.canToggle('ping', context)).toBe(['admin', 'owner'].includes(role))
    expect(policy.canExecute('ping', context)).toBe(true)
    expect(policy.canToggle('tray', context)).toBe(false)
  })

  test('private ordinary toggles are limited to their own conversation and never host capabilities', () => {
    const context = qq({userId: 999, groupId: undefined, targetId: 999,
      raw: {scope: 'private', event: {message_type: 'private', user_id: 999, self_id: 456}}})
    expect(policy.canToggle('ping', context)).toBe(true)
    expect(policy.canToggle('tray', context)).toBe(false)
    expect(policy.canToggle('ping', {...context, targetId: 123})).toBe(false)
    expect(policy.canToggle('ping', {...context, groupId: 789})).toBe(false)
  })

  test('public legacy execution remains unrestricted; missing config denies host execution', () => {
    for (const context of [{}, {platform: 'web'}, qq({userId: 999})]) {
      for (const name of ['ping', 'ollama', 'publicGame']) expect(policy.canExecute(name, context)).toBe(true)
    }
    expect(createPluginAuthorization().canExecute('tray', qq())).toBe(false)
    expect(createPluginAuthorization({QQBOT_ADMIN_LIST: '123'}).canExecute('tray', qq())).toBe(false)
  })
})

