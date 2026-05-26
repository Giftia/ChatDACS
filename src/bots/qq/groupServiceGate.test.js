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
    const event = {
      message: '闭菊',
      self_id: 12345,
      group_id: 100,
    }

    await expect(handleCloseServiceCommand({...context, event})).resolves.toBe(true)

    expect(context.utils.DisableGroupService).toHaveBeenCalledWith(100)
    expect(context.oneBotSender.sendGroupMessage).toHaveBeenCalledWith(100, expect.stringContaining('菊花闭上了'))
  })
})
