jest.mock('axios', () => ({default: {get: jest.fn(() => { throw new Error('Unexpected HTTP') })}}))
jest.mock('../qqGuild', () => ({ProcessGuildMessage: jest.fn()}))
jest.mock('./webhook', () => ({registerOneBotWebhook: jest.fn()}))

require('colors').setTheme({log: 'green', error: 'red'})

const {StartQQBot} = require('../qq')
const {registerOneBotWebhook} = require('./webhook')

async function start() {
  const axios = {get: jest.fn(async () => ({data: {data: {group_name: 'mock group'}}}))}
  const utils = {InitGroupList: jest.fn(async () => true), GetGroupServiceSwitch: jest.fn(async () => true),
    GetGroupMine: jest.fn(async () => null), AddNewGroup: jest.fn(),
    PluginAnswerToGoCqhttpStyle: jest.fn(reply => reply.content ?? reply)}
  const processExecute = jest.fn(async () => '')
  const conversation = {execute: jest.fn(async () => ({handled: false})), observe: jest.fn(), recordReply: jest.fn(),
    matchChat: jest.fn(async () => ({handled: false})), fallback: jest.fn(async () => ({handled: true, content: 'mock reply'}))}
  const io = {emit: jest.fn()}
  const config = {ONE_BOT_API_URL: 'mock.invalid:5700', ONE_BOT_ANTI_POST_API: '/mock', QQBOT_ADMIN_LIST: [],
    QQBOT_PRIVATE_CHAT_SWITCH: true, QQ_GROUP_POKE_REPLY_MESSAGE: 'poke', QQ_GROUP_WELCOME_MESSAGE: 'welcome'}
  const controller = await StartQQBot({axios, utils, config, processExecute, conversation, io,
    logger: {info: jest.fn(), error: jest.fn(), warn: jest.fn()}, app: {}, plugins: {}})
  const {handleEvent} = registerOneBotWebhook.mock.calls.at(-1)[0]
  return {axios, utils, processExecute, conversation, io, controller, handle: (overrides = {}) => handleEvent({
    post_type: 'message', message_type: 'group', sub_type: 'normal', group_id: 30003,
    user_id: 20002, self_id: 10001, sender: {nickname: 'mock', user_id: 20002}, message_id: -42, message: 'hello', ...overrides})}
}

describe('QQ ingress before old plugins, games and conversation', () => {
  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5)
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => { jest.restoreAllMocks(); registerOneBotWebhook.mockClear() })

  test.each([{user_id: '10001'}, {message_type: 'private', sub_type: 'friend', user_id: 10001, group_id: undefined},
    {post_type: 'message_sent'}, {post_type: 'message_sent', message_type: 'private', sub_type: 'friend', group_id: undefined}])(
    'echo %p cannot reach any pipeline work', async (echo) => {
      const bot = await start()
      bot.processExecute.mockResolvedValue('mock plugin reply')
      await bot.handle({...echo, message: '击鼓传雷'})
      expect(bot.processExecute).not.toHaveBeenCalled()
      expect(bot.conversation.execute).not.toHaveBeenCalled()
      expect(bot.conversation.fallback).not.toHaveBeenCalled()
      expect(bot.utils.GetGroupServiceSwitch).not.toHaveBeenCalled()
      expect(bot.axios.get).not.toHaveBeenCalled()
      expect(bot.io.emit).not.toHaveBeenCalled()
      await bot.controller.stop()
    },
  )

  test.each(['group', 'private'])('concurrent duplicate %s messages enter plugins and LLM at most once', async (scope) => {
    const bot = await start()
    const event = scope === 'group' ? {} : {message_type: 'private', sub_type: 'friend', group_id: undefined}
    await Promise.all([bot.handle(event), bot.handle({...event, message_id: '-42'})])
    expect(scope === 'group' ? bot.processExecute : bot.conversation.execute).toHaveBeenCalledTimes(1)
    expect(bot.conversation.fallback).toHaveBeenCalledTimes(1)
    expect(bot.axios.get.mock.calls.filter(([url]) => new URL(url).pathname.startsWith('/send_'))).toHaveLength(1)
    await bot.controller.stop()
  })

  test('failed first processing stays reserved instead of retrying on redelivery', async () => {
    const bot = await start()
    bot.processExecute.mockRejectedValueOnce(new Error('mock failure'))
    await expect(bot.handle()).rejects.toThrow('mock failure')
    await bot.handle()
    expect(bot.processExecute).toHaveBeenCalledTimes(1)
    expect(bot.conversation.fallback).not.toHaveBeenCalled()
    await bot.controller.stop()
  })

  test('messages without IDs are independent, and scopes cannot consume each other', async () => {
    const bot = await start()
    await bot.handle({message_id: undefined, message: 'first'})
    await bot.handle({message_id: undefined, message: 'second'})
    await bot.handle()
    await bot.handle({group_id: 30004})
    await bot.handle({message_type: 'private', sub_type: 'friend', group_id: undefined})
    expect(bot.conversation.fallback).toHaveBeenCalledTimes(5)
    await bot.controller.stop()
  })

  test('repeated notice/poke messages including self notice still follow old paths', async () => {
    const bot = await start()
    const welcome = {post_type: 'notice', notice_type: 'group_increase', sub_type: 'approve', user_id: 10001}
    await bot.handle(welcome); await bot.handle(welcome)
    expect(bot.utils.AddNewGroup).toHaveBeenCalledTimes(2)
    const poke = {post_type: 'notice', notice_type: 'notify', sub_type: 'poke', target_id: 10001}
    await bot.handle(poke); await bot.handle(poke)
    expect(bot.processExecute).toHaveBeenCalledTimes(2)
    await bot.controller.stop()
  })

  test('stop clears the owned cache and ignores further events', async () => {
    const clear = jest.spyOn(Map.prototype, 'clear')
    const bot = await start()
    await bot.handle()
    const clears = clear.mock.calls.length
    await bot.controller.stop()
    expect(clear.mock.calls.length).toBeGreaterThan(clears)
    await bot.handle({message_id: 99})
    expect(bot.processExecute).toHaveBeenCalledTimes(1)
  })
})
