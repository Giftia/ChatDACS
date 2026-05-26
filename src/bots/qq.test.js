jest.mock('qq-guild-bot', () => ({
  createOpenAPI: jest.fn(),
  createWebsocket: jest.fn(),
}))

const {sendMessageToQQ, sendMessageToQQGroup, _setRuntimeForTest} = require('./qq.js')

describe('QQ adapter message sending', () => {
  const axios = {
    get: jest.fn(),
  }

  beforeEach(() => {
    axios.get.mockClear()
    _setRuntimeForTest({
      config: {
        ONE_BOT_API_URL: '127.0.0.1:5700',
      },
      axios,
    })
  })

  test('should send group messages through OneBot API', async () => {
    await sendMessageToQQGroup('hello world', {group_id: 123})

    expect(axios.get).toHaveBeenCalledWith('http://127.0.0.1:5700/send_group_msg?group_id=123&message=hello%20world')
  })

  test('should send private messages through OneBot API', async () => {
    await sendMessageToQQ('hello world', {user_id: 456})

    expect(axios.get).toHaveBeenCalledWith('http://127.0.0.1:5700/send_private_msg?user_id=456&message=hello%20world')
  })
})
