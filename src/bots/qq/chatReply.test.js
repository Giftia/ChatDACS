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
        legacyMode: true,
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
        legacyMode: true,
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
        legacyMode: true,
        chatProcess: jest.fn(),
        sendGroupMessage: jest.fn(),
        random: () => 0.99,
      }),
    ).resolves.toBe(false)
  })

  test('does not boost reply probability for a different bot with a matching QQ prefix', async () => {
    const chatProcess = jest.fn(() => 'reply')
    const sendGroupMessage = jest.fn()
    await expect(handleQQChatReply({
      event: makeEvent({message: '[CQ:at,qq=200023] 你好'}),
      config: {QQBOT_FUDU_PROBABILITY: 0, QQBOT_REPLY_PROBABILITY: 0},
      legacyMode: true,
      chatProcess, sendGroupMessage, random: () => 0.5,
    })).resolves.toBe(false)
    expect(chatProcess).not.toHaveBeenCalled()
    expect(sendGroupMessage).not.toHaveBeenCalled()
  })

  test.each([
    ['[name] hello', '[CQ:at,qq=10001] hello'],
    ['&#91;name&#93; hello', '[CQ:at,qq=10001] hello'],
    ['plain reply', 'plain reply'],
    ['[name] &#91;name&#93;', '[CQ:at,qq=10001] [CQ:at,qq=10001]'],
  ])('preserves name substitution for %s', async (reply, expected) => {
    const sendGroupMessage = jest.fn()
    await handleQQChatReply({
      event: makeEvent(),
      config: {QQBOT_FUDU_PROBABILITY: 0, QQBOT_REPLY_PROBABILITY: 100},
      chatProcess: jest.fn(async () => reply), sendGroupMessage, random: () => 0.5,
    })
    expect(sendGroupMessage).toHaveBeenCalledWith(expected, expect.any(Object))
  })

  test('defaults to every effective text without @, random repeat or reply probability gates', async () => {
    const random = jest.fn(() => { throw new Error('Probability gates must not run') })
    const matchChat = jest.fn(async () => ({handled: true, content: 'corpus reply', matchType: 'full'}))
    const sendGroupMessage = jest.fn()
    for (let i = 0; i < 20; i++) {
      await expect(handleQQChatReply({event: makeEvent({message: `ordinary ${i}`}),
        config: {QQBOT_FUDU_PROBABILITY: 100, QQBOT_REPLY_PROBABILITY: 0}, matchChat,
        fallback: jest.fn(), sendGroupMessage, random})).resolves.toBe(true)
    }
    expect(sendGroupMessage).toHaveBeenCalledTimes(20)
    expect(random).not.toHaveBeenCalled()
  })

  test('a real corpus miss reaches the signature-compatible LLM fallback and sends its full reply', async () => {
    const content = 'complete model reply '.repeat(1000)
    const fallback = jest.fn(async () => ({handled: true, type: 'text', content}))
    const chatProcess = jest.fn(async () => 'random old fallback')
    const sendGroupMessage = jest.fn()
    await handleQQChatReply({event: makeEvent({group_id: 30003, sender: {nickname: 'fixture user'}}),
      matchChat: jest.fn(async () => ({handled: false, content: '', matchType: null})),
      fallback, chatProcess, sendGroupMessage})
    expect(fallback).toHaveBeenCalledWith('你好', 10001, 'fixture user', 30003, '',
      expect.objectContaining({type: 'qq', selfId: 20002, scope: 'group'}))
    expect(chatProcess).not.toHaveBeenCalled()
    expect(sendGroupMessage).toHaveBeenCalledWith(content, expect.any(Object))
  })

  test.each(['', ' ', null, '[CQ:at,qq=20002]', '[CQ:image,file=x]'])('non-text input is ignored %#', async (message) => {
    const matchChat = jest.fn()
    const fallback = jest.fn()
    const sendGroupMessage = jest.fn()
    await expect(handleQQChatReply({event: makeEvent({message}), matchChat, fallback, sendGroupMessage})).resolves.toBe(false)
    expect(matchChat).not.toHaveBeenCalled()
    expect(fallback).not.toHaveBeenCalled()
    expect(sendGroupMessage).not.toHaveBeenCalled()
  })

  test('empty claimed corpus hits do not block a nonempty fallback', async () => {
    const sendGroupMessage = jest.fn()
    const fallback = jest.fn(async () => ({type: 'text', content: 'fallback'}))
    await handleQQChatReply({event: makeEvent(), matchChat: async () => ({handled: true, content: ' '}), fallback, sendGroupMessage})
    expect(fallback).toHaveBeenCalledTimes(1)
    expect(sendGroupMessage).toHaveBeenCalledWith('fallback', expect.any(Object))
  })

  test.each(['match', 'fallback'])('%s failure produces a safe explicit error and no bogus reply', async (phase) => {
    const matchChat = jest.fn(async () => ({handled: false}))
    const fallback = jest.fn(async () => ({handled: false}))
    ;(phase === 'match' ? matchChat : fallback).mockRejectedValueOnce(new Error('SECRET failure URL'))
    const sendGroupMessage = jest.fn()
    await expect(handleQQChatReply({event: makeEvent(), matchChat, fallback, sendGroupMessage}))
      .rejects.toMatchObject({message: 'QQ_CHAT_REPLY_FAILED', code: 'QQ_CHAT_REPLY_FAILED'})
    expect(sendGroupMessage).not.toHaveBeenCalled()
    if (phase === 'match') expect(fallback).not.toHaveBeenCalled()
  })
})
