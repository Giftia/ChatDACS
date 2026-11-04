const Constants = require('../../../config/constants')
const {
  ensureGroupServiceEnabled,
  handleCloseServiceCommand,
  handleOpenServiceCommand,
  isGroupServiceEvent,
} = require('./groupServiceGate')

function makeContext(overrides = {}) {
  return {
    config: {QQBOT_ADMIN_LIST: [10001]},
    constants: Constants,
    logger: {info: jest.fn()},
    utils: {
      EnableGroupService: jest.fn(),
      DisableGroupService: jest.fn(),
      GetGroupServiceSwitch: jest.fn(() => true),
    },
    oneBotSender: {
      getGroupMemberInfo: jest.fn(() => Promise.resolve({data: {data: {role: 'member'}}})),
      sendGroupMessage: jest.fn(),
    },
    ...overrides,
  }
}

function makeEvent(message, overrides = {}) {
  return {message_type: 'group', message, self_id: 12345, user_id: 999, group_id: 100, ...overrides}
}

const commands = [
  ['open', handleOpenServiceCommand, '张菊[CQ:at,qq=12345]', 'EnableGroupService'],
  ['close', handleCloseServiceCommand, '闭菊', 'DisableGroupService'],
  ['close mention', handleCloseServiceCommand, '闭菊[CQ:at,qq=12345]', 'DisableGroupService'],
]

describe('QQ group service gate', () => {
  test('detects events that should pass through group service gate', () => {
    expect(isGroupServiceEvent({message_type: 'group'})).toBe(true)
    expect(isGroupServiceEvent({notice_type: 'group_increase'})).toBe(true)
    expect(isGroupServiceEvent({sub_type: 'poke'})).toBe(true)
    expect(isGroupServiceEvent({message_type: 'private'})).toBe(false)
  })

  test('opens service for group admins', async () => {
    const context = makeContext({
      oneBotSender: {
        getGroupMemberInfo: jest.fn(() => Promise.resolve({data: {data: {role: 'admin'}}})),
        sendGroupMessage: jest.fn(),
      },
    })
    const event = {
      message_type: 'group',
      message: '张菊[CQ:at,qq=12345]',
      self_id: 12345,
      user_id: 999,
      group_id: 100,
    }

    await expect(handleOpenServiceCommand({...context, event})).resolves.toBe(true)

    expect(context.utils.EnableGroupService).toHaveBeenCalledWith(100)
    expect(context.oneBotSender.sendGroupMessage).toHaveBeenCalledWith(100, expect.stringContaining('管理员张开了'))
  })

  test('blocks disabled groups before main handling', async () => {
    const context = makeContext({
      utils: {
        GetGroupServiceSwitch: jest.fn(() => false),
      },
    })

    await expect(ensureGroupServiceEnabled({...context, event: {group_id: 100}})).resolves.toBe(false)
    expect(context.logger.info).toHaveBeenCalledWith(expect.stringContaining('服务已停用'))
  })

  test('closes service for close commands', async () => {
    const context = makeContext()
    context.oneBotSender.getGroupMemberInfo.mockResolvedValue({data: {data: {role: 'admin'}}})
    const event = makeEvent('闭菊')

    await expect(handleCloseServiceCommand({...context, event})).resolves.toBe(true)

    expect(context.utils.DisableGroupService).toHaveBeenCalledWith(100)
    expect(context.oneBotSender.sendGroupMessage).toHaveBeenCalledWith(100, expect.stringContaining('菊花闭上了'))
  })

  describe.each(commands)('%s authorization', (_name, handle, message, write) => {
    test('ordinary members cannot change service even with a forged sender role', async () => {
      const context = makeContext()
      await handle({...context, event: makeEvent(message, {sender: {role: 'owner', user_id: 10001}})})
      expect(context.oneBotSender.getGroupMemberInfo).toHaveBeenCalledWith(100, 999)
      expect(context.utils.EnableGroupService).not.toHaveBeenCalled()
      expect(context.utils.DisableGroupService).not.toHaveBeenCalled()
    })

    test.each(['admin', 'owner'])('allows verified group %s', async (role) => {
      const context = makeContext()
      context.oneBotSender.getGroupMemberInfo.mockResolvedValue({data: {data: {role}}})
      await expect(handle({...context, event: makeEvent(message)})).resolves.toBe(true)
      expect(context.utils[write]).toHaveBeenCalledWith(100)
      expect(context.oneBotSender.getGroupMemberInfo.mock.invocationCallOrder[0])
        .toBeLessThan(context.utils[write].mock.invocationCallOrder[0])
      expect(context.utils[write].mock.invocationCallOrder[0])
        .toBeLessThan(context.oneBotSender.sendGroupMessage.mock.invocationCallOrder[0])
    })

    test.each([[10001, '10001'], ['10001', 10001]])('allows host admin %s matching event %s', async (admin, user_id) => {
      const context = makeContext({config: {QQBOT_ADMIN_LIST: [admin]}})
      await expect(handle({...context, event: makeEvent(message, {user_id})})).resolves.toBe(true)
      expect(context.utils[write]).toHaveBeenCalledWith(100)
      expect(context.oneBotSender.getGroupMemberInfo).toHaveBeenCalledWith(100, user_id)
    })

    test.each(['10001', [true], [{}], [10001.5], ['1e4'], ['010001'], [9007199254740992]])(
      'does not coerce malformed admin list %j into authority', async (admins) => {
        const context = makeContext({config: {QQBOT_ADMIN_LIST: admins}})
        await handle({...context, event: makeEvent(message, {user_id: 10001})})
        expect(context.utils[write]).not.toHaveBeenCalled()
      },
    )

    test.each([
      {message_type: 'private'}, {message_type: undefined},
      {group_id: undefined}, {user_id: undefined}, {self_id: undefined},
      {group_id: null}, {user_id: ''}, {self_id: 0}, {user_id: true},
      {user_id: {}}, {user_id: 9007199254740992}, {group_id: '100&user_id=10001'},
    ])('rejects untrusted event metadata %j before lookup or send', async (overrides) => {
      const context = makeContext({config: {QQBOT_ADMIN_LIST: [999]}})
      await handle({...context, event: makeEvent(message, overrides)})
      expect(context.oneBotSender.getGroupMemberInfo).not.toHaveBeenCalled()
      expect(context.oneBotSender.sendGroupMessage).not.toHaveBeenCalled()
      expect(context.utils[write]).not.toHaveBeenCalled()
    })

    test.each([
      undefined, {}, {data: {data: null}}, {data: {data: {}}},
      {data: {status: 'failed', retcode: 100, data: {role: 'admin'}}},
      {data: {data: {role: 'unexpected'}}},
    ])('lookup failure %j never grants even host admin access', async (response) => {
      const context = makeContext({config: {QQBOT_ADMIN_LIST: [999]}})
      context.oneBotSender.getGroupMemberInfo.mockResolvedValue(response)
      await handle({...context, event: makeEvent(message)})
      expect(context.utils[write]).not.toHaveBeenCalled()
      expect(context.oneBotSender.sendGroupMessage).not.toHaveBeenCalled()
    })

    test('rejected lookup is contained without writing or sending', async () => {
      const context = makeContext({config: {QQBOT_ADMIN_LIST: [999]}})
      context.oneBotSender.getGroupMemberInfo.mockRejectedValue(new Error('mock lookup failure'))
      await expect(handle({...context, event: makeEvent(message)})).resolves.toBeDefined()
      expect(context.utils[write]).not.toHaveBeenCalled()
      expect(context.oneBotSender.sendGroupMessage).not.toHaveBeenCalled()
    })

    test('waits for role lookup before any write or send', async () => {
      const context = makeContext({config: {QQBOT_ADMIN_LIST: [999]}})
      let release
      context.oneBotSender.getGroupMemberInfo.mockImplementation(() => new Promise((resolve) => { release = resolve }))
      const handling = handle({...context, event: makeEvent(message)})
      expect(context.utils[write]).not.toHaveBeenCalled()
      expect(context.oneBotSender.sendGroupMessage).not.toHaveBeenCalled()
      release({data: {data: {role: 'member'}}})
      await handling
      expect(context.utils[write]).toHaveBeenCalledWith(100)
    })
  })

  test.each([
    [handleOpenServiceCommand, '张菊', '张菊'],
    [handleCloseServiceCommand, '闭菊', '闭菊'],
  ])('commands aimed at another bot only send the original prompt', async (handle, command, verb) => {
    const context = makeContext()
    await expect(handle({...context, event: makeEvent(`${command}[CQ:at,qq=54321]`)})).resolves.toBe(true)
    expect(context.oneBotSender.sendGroupMessage).toHaveBeenCalledWith(100, `[CQ:at,qq=54321] 说你呢，快${verb}!`)
    expect(context.oneBotSender.getGroupMemberInfo).not.toHaveBeenCalled()
    expect(context.utils.EnableGroupService).not.toHaveBeenCalled()
    expect(context.utils.DisableGroupService).not.toHaveBeenCalled()
  })

  test.each(['闭菊', '闭菊[CQ:at,qq=12345]'])('denied close %s must not trigger caller game cleanup', async (message) => {
    const context = makeContext()
    await expect(handleCloseServiceCommand({...context, event: makeEvent(message)})).resolves.toBe(false)
    expect(context.oneBotSender.sendGroupMessage).not.toHaveBeenCalled()
  })
})
