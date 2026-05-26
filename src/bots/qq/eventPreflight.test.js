const {buildQQEventNotification, handleQQEventPreflight} = require('./eventPreflight')

function makeContext(overrides = {}) {
  return {
    config: {
      AUTO_APPROVE_QQ_FRIEND_REQUEST_SWITCH: true,
      QQBOT_ADMIN_LIST: [10001],
      ...overrides.config,
    },
    logger: {
      info: jest.fn(),
    },
    io: {
      emit: jest.fn(),
    },
    oneBotSender: {
      setGroupLeave: jest.fn(),
      setGroupCard: jest.fn(),
      setFriendAddRequest: jest.fn(),
      setGroupAddRequest: jest.fn(),
      sendPrivateMessage: jest.fn(),
    },
    processExecute: jest.fn(),
    chatProcess: jest.fn(),
    utils: {},
    processGuildMessage: jest.fn(),
    ...overrides,
  }
}

describe('QQ event preflight', () => {
  test('builds notification text for supported events', () => {
    expect(
      buildQQEventNotification({
        sub_type: 'normal',
        group_id: 123,
        user_id: 456,
        sender: {nickname: 'User'},
        message: 'hello',
      }),
    ).toBe('小夜收到群 123 的 456 (User) 发来的消息: hello')
    expect(buildQQEventNotification({sub_type: 'unknown'})).toBe('')
  })

  test('routes guild messages before group handling', async () => {
    const context = makeContext()
    const event = {
      message_type: 'guild',
      channel_id: 'c1',
      user_id: 'u1',
      sender: {nickname: 'GuildUser'},
      message: 'hello',
    }

    await expect(handleQQEventPreflight({...context, event})).resolves.toBe(true)

    expect(context.processGuildMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        event,
        processExecute: context.processExecute,
        chatProcess: context.chatProcess,
      }),
    )
  })

  test('handles self ban events through oneBot sender', async () => {
    const context = makeContext()

    await expect(
      handleQQEventPreflight({
        ...context,
        event: {sub_type: 'ban', user_id: 99, self_id: 99, group_id: 123, duration: 3600},
      }),
    ).resolves.toBe(true)

    expect(context.oneBotSender.setGroupLeave).toHaveBeenCalledWith(123)
    expect(context.io.emit).toHaveBeenCalledWith('system', '小夜在群 123 被禁言超过1小时，自动退群')
  })

  test('handles friend and group invite requests', async () => {
    const context = makeContext()

    await handleQQEventPreflight({
      ...context,
      event: {request_type: 'friend', user_id: 20001, comment: 'hi', flag: 'friend-flag'},
    })
    await handleQQEventPreflight({
      ...context,
      event: {request_type: 'group', sub_type: 'invite', user_id: 20002, group_id: 30001, comment: 'join', flag: 'group-flag'},
    })

    expect(context.oneBotSender.setFriendAddRequest).toHaveBeenCalledWith('friend-flag', true)
    expect(context.oneBotSender.sendPrivateMessage).toHaveBeenCalledWith(10001, expect.stringContaining('group-flag'))
    expect(context.oneBotSender.sendPrivateMessage).toHaveBeenCalledWith(20002, expect.stringContaining('ChatDACS'))
  })
})
