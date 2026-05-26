const {handleQQPluginReply} = require('./pluginBridge')

describe('QQ plugin bridge', () => {
  test('executes plugins with QQ message context and sends normalized reply', async () => {
    const event = {
      message: '/ping',
      user_id: 10001,
      group_id: 20002,
      self_id: 30003,
      sender: {nickname: 'tester'},
    }
    const processExecute = jest.fn(() => ({type: 'text', content: 'pong'}))
    const oneBotSender = {
      getGroupInfo: jest.fn(() => Promise.resolve({data: {data: {group_name: 'test group'}}})),
      sendGroupMessage: jest.fn(),
    }
    const utils = {
      PluginAnswerToGoCqhttpStyle: jest.fn(() => 'pong'),
    }

    await expect(handleQQPluginReply({event, processExecute, oneBotSender, utils})).resolves.toEqual({
      type: 'text',
      content: 'pong',
    })

    expect(oneBotSender.getGroupInfo).toHaveBeenCalledWith(20002)
    expect(processExecute).toHaveBeenCalledWith('/ping', 10001, 'tester', 20002, 'test group', {
      selfId: 30003,
      targetId: null,
      type: 'qq',
    })
    expect(utils.PluginAnswerToGoCqhttpStyle).toHaveBeenCalledWith({type: 'text', content: 'pong'})
    expect(oneBotSender.sendGroupMessage).toHaveBeenCalledWith(20002, 'pong')
  })

  test('keeps empty plugin replies silent', async () => {
    const event = {
      message: '/unknown',
      user_id: 10001,
      group_id: 20002,
      self_id: 30003,
      sender: {nickname: 'tester'},
    }
    const processExecute = jest.fn(() => '')
    const oneBotSender = {
      getGroupInfo: jest.fn(() => Promise.resolve({data: {data: {group_name: 'test group'}}})),
      sendGroupMessage: jest.fn(),
    }
    const utils = {
      PluginAnswerToGoCqhttpStyle: jest.fn(),
    }

    await expect(handleQQPluginReply({event, processExecute, oneBotSender, utils})).resolves.toBe('')

    expect(utils.PluginAnswerToGoCqhttpStyle).not.toHaveBeenCalled()
    expect(oneBotSender.sendGroupMessage).not.toHaveBeenCalled()
  })
})
