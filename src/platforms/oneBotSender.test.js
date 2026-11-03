const {buildOneBotUrl, createOneBotSender} = require('./oneBotSender')

describe('oneBot sender', () => {
  test.each([
    ['host.invalid:3000', 'http://host.invalid:3000/send_group_msg'],
    ['http://host.invalid:3000', 'http://host.invalid:3000/send_group_msg'],
    ['https://host.invalid/api/', 'https://host.invalid/api/send_group_msg'],
    ['host.invalid:3000/api/v1/', 'http://host.invalid:3000/api/v1/send_group_msg'],
  ])('supports bare host and HTTP(S) base path: %s', (base, expected) => {
    expect(buildOneBotUrl(base, 'send_group_msg', {message: 'A&B #+中文'}))
      .toBe(`${expected}?message=${encodeURIComponent('A&B #+中文')}`)
  })

  test.each(['https://user:pass@host.invalid/api', 'https://host.invalid/api?q=1',
    'https://host.invalid/api?', 'https://host.invalid/api#', 'ftp://host.invalid',
    '', undefined, 'http://', 'http://host.invalid\\evil', 'http://host.invalid\n'])('rejects unsafe API base %#', (base) => {
    let error
    try { buildOneBotUrl(base, 'get_group_list') } catch (value) { error = value }
    expect(error).toMatchObject({message: 'ONEBOT_REQUEST_FAILED', code: 'ONEBOT_REQUEST_FAILED'})
    expect(Object.keys(error)).toEqual(['code'])
  })

  test('builds OneBot urls with individually encoded query values', () => {
    expect(buildOneBotUrl('127.0.0.1:5700', 'send_group_msg', {group_id: 123, message: 'hello world'})).toBe(
      'http://127.0.0.1:5700/send_group_msg?group_id=123&message=hello%20world',
    )
    expect(buildOneBotUrl('127.0.0.1:5700', 'set_group_card', {group_id: 1, user_id: 2, card: '你妈的'})).toBe(
      'http://127.0.0.1:5700/set_group_card?group_id=1&user_id=2&card=%E4%BD%A0%E5%A6%88%E7%9A%84',
    )
  })

  test.each(['reply&group_id=999', 'reply&user_id=999', 'hello#tail', '[CQ:at,qq=123] A+B=100% &中文']) (
    'preserves message text and recipients for %s', async (message) => {
      const axios = {get: jest.fn()}
      const sender = createOneBotSender({apiUrl: '127.0.0.1:5700', axios})
      await sender.sendGroupMessage(123, message)
      await sender.sendPrivateMessage(456, message)
      await sender.sendGuildChannelMessage(789, 101, message)
      for (const [index, targets] of [[0, {group_id: '123'}], [1, {user_id: '456'}],
        [2, {guild_id: '789', channel_id: '101'}]]) {
        const url = new URL(axios.get.mock.calls[index][0])
        expect(url.hash).toBe('')
        expect(Object.fromEntries(url.searchParams)).toEqual({...targets, message})
        for (const key of Object.keys(targets)) expect(url.searchParams.getAll(key)).toHaveLength(1)
      }
    },
  )

  test('sends common OneBot actions through injected axios', async () => {
    const axios = {get: jest.fn()}
    const sender = createOneBotSender({apiUrl: '127.0.0.1:5700', axios})

    await sender.sendGroupMessage(123, 'hello world')
    await sender.sendPrivateMessage(456, 'private')
    await sender.setGroupBan(123, 456, 60)

    expect(axios.get).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:5700/send_group_msg?group_id=123&message=hello%20world',
    )
    expect(axios.get).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:5700/send_private_msg?user_id=456&message=private',
    )
    expect(axios.get).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:5700/set_group_ban?group_id=123&user_id=456&duration=60',
    )
  })
})
