const {handleQQChatReply} = require('./chatReply')

function makeEvent(overrides = {}) {
  return {
    message: '你好',
    user_id: 10001,
    self_id: 20002,
    ...overrides,
  }
}

describe('QQ chat reply handler', () => {
  let consoleSpy

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  test('repeats group messages when repeat probability hits', async () => {
    const sendGroupMessage = jest.fn()

    await expect(
      handleQQChatReply({
        event: makeEvent(),
        config: {QQBOT_FUDU_PROBABILITY: 100, QQBOT_REPLY_PROBABILITY: 0},
        chatProcess: jest.fn(),
        sendGroupMessage,
        random: () => 0,
      }),
    ).resolves.toBe(true)

    expect(sendGroupMessage).toHaveBeenCalledWith('你好', expect.objectContaining({message: '你好'}))
  })

  test('raises reply probability when bot is mentioned and removes the mention before chat processing', async () => {
    const chatProcess = jest.fn(() => '收到，[name]')
    const sendGroupMessage = jest.fn()

    await expect(
      handleQQChatReply({
        event: makeEvent({message: '[CQ:at,qq=20002] 你好'}),
        config: {QQBOT_FUDU_PROBABILITY: 0, QQBOT_REPLY_PROBABILITY: 0},
        chatProcess,
        sendGroupMessage,
        random: () => 0.5,
      }),
    ).resolves.toBe(true)

    expect(chatProcess).toHaveBeenCalledWith('你好')
    expect(sendGroupMessage).toHaveBeenCalledWith('收到，[CQ:at,qq=10001]', expect.any(Object))
  })

  test('returns false when neither repeat nor reply triggers', async () => {
    await expect(
      handleQQChatReply({
        event: makeEvent(),
        config: {QQBOT_FUDU_PROBABILITY: 0, QQBOT_REPLY_PROBABILITY: 0},
        chatProcess: jest.fn(),
        sendGroupMessage: jest.fn(),
        random: () => 0.99,
      }),
    ).resolves.toBe(false)
  })
})
