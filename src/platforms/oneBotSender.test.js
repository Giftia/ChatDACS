const {buildOneBotUrl, createOneBotSender} = require('./oneBotSender')

describe('oneBot sender', () => {
  test('builds OneBot urls using the legacy encoding style', () => {
    expect(buildOneBotUrl('127.0.0.1:5700', 'send_group_msg', {group_id: 123, message: 'hello world'})).toBe(
      'http://127.0.0.1:5700/send_group_msg?group_id=123&message=hello%20world',
    )
    expect(buildOneBotUrl('127.0.0.1:5700', 'set_group_card', {group_id: 1, user_id: 2, card: '你妈的'})).toBe(
      'http://127.0.0.1:5700/set_group_card?group_id=1&user_id=2&card=%E4%BD%A0%E5%A6%88%E7%9A%84',
    )
  })

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
