const source = require('../../plugins/chatPush')

function fixture() {
  const plugin = {...source}
  const axios = {get: jest.fn().mockResolvedValue({data: 'SECRET_RESPONSE'})}
  const logger = {info: jest.fn(), warn: jest.fn(), error: jest.fn()}
  plugin.init({axios, logger, config: {ApiKey: {XIZHI_CHANNEL_KEY: 'MOCK_KEY'}}})
  return {plugin, axios, logger}
}

test('chatPush encodes the entire title and bounds the mocked request', async () => {
  const {plugin, axios, logger} = fixture()
  const text = '推送我 &title=other?#中文'
  const result = await plugin.execute(text, 123, 'A&B', 789, 'group', {})
  expect(axios.get).toHaveBeenCalledWith(
    `https://xizhi.qqoq.net/MOCK_KEY.channel?title=${encodeURIComponent('来自 A&B 的消息：' + text)}`,
    {timeout: 5000})
  expect(result.content).toContain('已经推送')
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain('SECRET_RESPONSE')
})

test.each(['network', 'timeout'])('chatPush %s failure never exposes provider errors, URL or key', async () => {
  const {plugin, axios, logger} = fixture()
  axios.get.mockRejectedValue(Object.assign(new Error('SECRET https://xizhi.qqoq.net/MOCK_KEY.channel'),
    {code: 'ECONNABORTED', config: {url: 'SECRET_URL'}}))
  expect(await plugin.execute('推送我', 123, 'name', 789, 'group', {}))
    .toEqual({type: 'text', content: '推送消息失败，请稍后再试。'})
  expect(logger.error).toHaveBeenCalledWith('CHAT_PUSH_FAILED')
  expect(JSON.stringify([logger.error.mock.calls, logger.info.mock.calls])).not.toMatch(/SECRET|MOCK_KEY|https:/)
})

test('missing key never requests a provider', async () => {
  const {plugin, axios} = fixture()
  plugin.config = {}
  expect((await plugin.execute('推送我', 123, '', 789, '', {})).content).toContain('接口密钥未配置')
  expect(axios.get).not.toHaveBeenCalled()
})
