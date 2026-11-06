jest.mock('axios', () => ({default: {get: jest.fn(() => { throw new Error('Unexpected network access') })}}))
jest.mock('request', () => jest.fn(() => { throw new Error('Unexpected network access') }))
jest.mock('../qqGuild', () => ({ProcessGuildMessage: jest.fn()}))
jest.mock('./webhook', () => ({registerOneBotWebhook: jest.fn()}))

require('colors').setTheme({log: 'green', error: 'red'})

const {StartQQBot, _setRuntimeForTest} = require('../qq')
const {registerOneBotWebhook} = require('./webhook')

const special = '中文 [CQ:at,qq=12345] &group_id=999/#/+/='

async function start(overrides = {}) {
  const calls = []
  const axios = {get: jest.fn(async (url) => {
    const parsed = new URL(url)
    calls.push(parsed)
    const data = parsed.pathname === '/get_group_info' ? {group_name: 'mock group'}
      : parsed.pathname === '/get_group_member_info' ? {role: 'member'}
      : parsed.pathname === '/get_group_member_list' ? [{user_id: 45678}]
      : parsed.pathname === '/get_msg' ? {message: special} : {}
    return {data: {data}}
  })}
  const config = {
    ONE_BOT_API_URL: 'mock.invalid:5700', ONE_BOT_ANTI_POST_API: '/mock',
    QQBOT_ADMIN_LIST: [], QQBOT_FUDU_PROBABILITY: 0, QQBOT_REPLY_PROBABILITY: 100,
    QQ_GROUP_WELCOME_MESSAGE: special, QQ_GROUP_POKE_REPLY_MESSAGE: special,
    QQ_GROUP_POKE_BOOM_REPLY_MESSAGE: special,
  }
  const utils = {
    InitGroupList: jest.fn(async () => true), GetGroupServiceSwitch: jest.fn(async () => true),
    GetGroupMine: jest.fn(async () => null), DeleteGroupMine: jest.fn(), AddNewGroup: jest.fn(),
    PluginAnswerToGoCqhttpStyle: jest.fn((reply) => reply),
    GetGroupLoopBombGameStatus: jest.fn(async () => ({loopBombEnabled: false})),
    StartGroupLoopBombGame: jest.fn(), EndGroupLoopBombGame: jest.fn(),
    GetGroupLoopBomb: jest.fn(async () => ({bombHolder: 12345, bombAnswer: special, bombStartTime: process.hrtime()[0]})),
    UpdateGroupLoopBombGame: jest.fn(),
  }
  const dependencies = {
    config, utils, axios, logger: {info: jest.fn(), error: jest.fn()}, io: {emit: jest.fn()},
    app: {}, plugins: {}, processExecute: jest.fn(async () => ''),
    chatProcess: jest.fn(async () => 'chat reply'), ecYWenDa: jest.fn(async () => ({question: special, answer: special})),
    request: jest.fn(() => { throw new Error('Unexpected request access') }), ...overrides,
  }
  const controller = await StartQQBot(dependencies)
  const {handleEvent} = registerOneBotWebhook.mock.calls.at(-1)[0]
  return { ...dependencies, calls, controller, handle: (event = {}) => handleEvent({
    message_type: 'group', sub_type: 'normal', group_id: 23456, user_id: 12345, self_id: 34567,
    sender: {nickname: 'mock', user_id: 12345}, message: 'ordinary message', ...event,
  })}
}

async function startWithGames(overrides) {
  const bot = await start(overrides)
  const active = new Map()
  bot.utils.GetGroupLoopBombGameStatus.mockImplementation(async (id) => ({
    loopBombEnabled: active.has(String(id)), loopBombStartTime: active.get(String(id)),
  }))
  bot.utils.StartGroupLoopBombGame.mockImplementation(async (id) => active.set(String(id), process.hrtime()[0]))
  bot.utils.EndGroupLoopBombGame.mockImplementation(async (id) => active.delete(String(id)))
  bot.utils.DisableGroupService = jest.fn()
  return bot
}

describe('StartQQBot real event pipeline with isolated dependencies', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(Math, 'random').mockReturnValue(0.5)
    _setRuntimeForTest({c1cCount: 0})
  })
  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
    registerOneBotWebhook.mockClear()
  })

  test.each([
    ['snowluma', 12345, {online: false, good: false}],
    ['snowluma', 12345, {online: true, good: false}],
    ['napcat', 67890, {online: true, good: true}],
  ])('does not start QQ group services for an unready %s session', async (provider, userId, health) => {
    const axios = {get: jest.fn(async (url) => ({data: {status: 'ok', data:
      url.endsWith('/get_login_info') ? {user_id: userId} : health}}))}
    const utils = {InitGroupList: jest.fn()}
    const conversation = {createProactive: jest.fn()}
    const bot = await start({config: {ONE_BOT_PROVIDER: provider, ONE_BOT_SELF_ID: '12345',
      ONE_BOT_API_URL: 'mock.invalid:5700', ONE_BOT_ANTI_POST_API: '/mock'}, axios, utils, conversation})
    expect(utils.InitGroupList).not.toHaveBeenCalled()
    expect(conversation.createProactive).not.toHaveBeenCalled()
    expect(registerOneBotWebhook.mock.calls.at(-1)[0].isReady()).toBe(false)
    expect(bot.logger.error).toHaveBeenCalledWith('ONEBOT_SESSION_NOT_READY')
    await bot.controller.stop()
  })

  test('a random mine hit without a mine still reaches normal chat', async () => {
    Math.random.mockReturnValue(0)
    const bot = await start()
    await bot.handle()
    expect(bot.utils.GetGroupMine).toHaveBeenCalledWith(23456)
    expect(bot.processExecute).toHaveBeenCalledTimes(1)
    expect(bot.chatProcess).toHaveBeenCalledWith('ordinary message')
    expect(bot.calls.at(-1).searchParams.get('message')).toBe('chat reply')
  })

  test.each([0, 0.5])('a plugin reply ends handling without duplicate chat (random=%s)', async (random) => {
    Math.random.mockReturnValue(random)
    const bot = await start({processExecute: jest.fn(async () => 'plugin reply')})
    await bot.handle()
    expect(bot.processExecute).toHaveBeenCalledTimes(1)
    expect(bot.chatProcess).not.toHaveBeenCalled()
    expect(bot.calls.filter((call) => call.pathname === '/send_group_msg')).toHaveLength(1)
    expect(bot.calls.at(-1).searchParams.get('message')).toBe('plugin reply')
  })

  test.each([
    ['dumb', [0, 0], null],
    ['holy', [0, 0.5, 0], '/set_group_whole_ban'],
    ['normal', [0, 0.5, 0.5, 0.5], '/set_group_ban'],
  ])('preserves %s mine behavior and consumes only a real mine', async (_kind, randoms, action) => {
    randoms.forEach((value) => Math.random.mockReturnValueOnce(value))
    const bot = await start()
    bot.utils.GetGroupMine.mockResolvedValue({id: 1, groupId: 23456, owner: 45678})
    await bot.handle()
    expect(bot.utils.DeleteGroupMine).toHaveBeenCalledWith(1)
    expect(bot.processExecute).not.toHaveBeenCalled()
    expect(bot.chatProcess).not.toHaveBeenCalled()
    expect(bot.calls.filter((call) => call.pathname === '/send_group_msg')).toHaveLength(1)
    if (action) {
      const call = bot.calls.find((entry) => entry.pathname === action)
      expect(call.searchParams.get('group_id')).toBe('23456')
      if (action === '/set_group_ban') {
        expect(call.searchParams.get('user_id')).toBe('12345')
        expect(call.searchParams.get('duration')).toBe('60')
      } else expect(call.searchParams.get('enable')).toBe('1')
    } else expect(bot.calls).toHaveLength(1)
  })

  test('welcome query preserves all message characters and the destination', async () => {
    const bot = await start()
    await bot.handle({notice_type: 'group_increase', sub_type: 'approve'})
    expect(bot.calls[0].searchParams.getAll('group_id')).toEqual(['23456'])
    expect(bot.calls[0].searchParams.get('message')).toBe(special)
    expect(bot.calls[0].hash).toBe('')
    expect(bot.utils.AddNewGroup).toHaveBeenCalledWith(23456)
  })

  test('poke replies preserve characters and third poke still bans for 10 seconds', async () => {
    const bot = await start()
    for (let i = 0; i < 3; i++) {
      await bot.handle({sub_type: 'poke', target_id: 34567})
    }
    const replies = bot.calls.filter((call) => call.pathname === '/send_group_msg')
    expect(replies).toHaveLength(3)
    for (const reply of replies) {
      expect(reply.searchParams.get('message')).toBe(special)
      expect(reply.searchParams.getAll('group_id')).toEqual(['23456'])
      expect(reply.hash).toBe('')
    }
    const ban = bot.calls.find((call) => call.pathname === '/set_group_ban')
    expect(Object.fromEntries(ban.searchParams)).toEqual({group_id: '23456', user_id: '12345', duration: '10'})
  })

  test('loop bomb card, delayed question and game over preserve query text and actions', async () => {
    jest.useFakeTimers()
    const bot = await start()
    await bot.handle({message: '击鼓传雷'})
    expect(bot.chatProcess).not.toHaveBeenCalled()
    const card = bot.calls.find((call) => call.pathname === '/set_group_card')
    expect(card.searchParams.get('card')).toBe(special)
    expect(Object.fromEntries(card.searchParams)).toEqual({group_id: '23456', user_id: '12345', card: special})
    await jest.advanceTimersByTimeAsync(1000)
    const question = bot.calls.at(-1)
    expect(question.searchParams.get('message')).toContain(special)
    expect(question.searchParams.getAll('group_id')).toEqual(['23456'])
    await jest.advanceTimersByTimeAsync(59000)
    expect(bot.utils.EndGroupLoopBombGame).toHaveBeenCalledWith(23456)
    expect(bot.calls.at(-1).searchParams.get('message')).toContain(special)
    expect(bot.calls.at(-1).hash).toBe('')
    expect(bot.calls.find((call) => call.pathname === '/set_group_ban').searchParams.get('duration')).toBe('150')
    expect(bot.calls.filter((call) => call.pathname === '/set_group_card').at(-1).searchParams.get('card')).toBe('')
  })

  test.each([true, false])('loop bomb answer (correct=%s) preserves reply text without normal chat', async (correct) => {
    jest.useFakeTimers()
    const bot = await start()
    bot.utils.GetGroupLoopBombGameStatus.mockResolvedValue({loopBombEnabled: true, loopBombStartTime: process.hrtime()[0]})
    await bot.handle({message: `击鼓传雷 ${correct ? special : 'wrong'}`})
    expect(bot.chatProcess).not.toHaveBeenCalled()
    expect(bot.calls.find((call) => call.pathname === '/send_group_msg').searchParams.get('message')).toContain(special)
    if (correct) {
      await jest.advanceTimersByTimeAsync(1500)
      expect(bot.utils.UpdateGroupLoopBombGame).toHaveBeenCalledWith(23456, special, 45678)
      const card = bot.calls.filter((call) => call.pathname === '/set_group_card').at(-1)
      expect(Object.fromEntries(card.searchParams)).toEqual({group_id: '23456', user_id: '12345', card: special})
      expect(bot.calls.at(-1).searchParams.get('message')).toContain(special)
    } else expect(bot.utils.EndGroupLoopBombGame).toHaveBeenCalledWith(23456)
    for (const call of bot.calls) {
      expect(call.searchParams.getAll('group_id')).toEqual(['23456'])
      expect(call.hash).toBe('')
    }
  })

  test('manual repeat safely encodes the complete message id', async () => {
    const bot = await start()
    const messageId = '-123&group_id=999/#/+/='
    await bot.handle({message: `[CQ:reply,id=${messageId}] 复读`})
    const lookup = bot.calls.find((call) => call.pathname === '/get_msg')
    expect(Object.fromEntries(lookup.searchParams)).toEqual({message_id: messageId})
    expect(lookup.hash).toBe('')
    expect(bot.calls.at(-1).searchParams.get('message')).toBe(special)
    expect(bot.chatProcess).not.toHaveBeenCalled()
  })

  test('poke send failure propagates to the event handler rather than escaping it', async () => {
    const bot = await start()
    bot.axios.get.mockImplementation(async (url) => {
      if (new URL(url).pathname === '/send_group_msg') throw new Error('mock send failure')
      return {data: {data: {group_name: 'mock group'}}}
    })
    await expect(bot.handle({sub_type: 'poke', target_id: 34567})).rejects.toThrow('mock send failure')
  })

  test.each(['wrong answer', 'close service'])('interleaved groups keep separate timers after %s', async (ending) => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    bot.config.QQBOT_ADMIN_LIST = ['12345']
    await bot.handle({group_id: 111, message: '击鼓传雷'})
    await jest.advanceTimersByTimeAsync(100)
    await bot.handle({group_id: 222, message: '击鼓传雷'})
    await bot.handle({group_id: '111', message: ending === 'wrong answer' ? '击鼓传雷 wrong' : '闭菊'})
    await jest.advanceTimersByTimeAsync(61000)
    expect(bot.utils.EndGroupLoopBombGame.mock.calls.filter(([id]) => String(id) === '222')).toHaveLength(1)
    const afterEnd = bot.calls.filter((call) => call.pathname === '/send_group_msg' && call.searchParams.get('group_id') === '111')
    expect(afterEnd.some((call) => call.searchParams.get('message').includes('时间到了'))).toBe(false)
    expect(afterEnd.some((call) => call.searchParams.get('message').includes('请听题'))).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
  })

  test('stop is idempotent, clears only its own timers and ignores new events', async () => {
    jest.useFakeTimers()
    const unrelated = jest.fn()
    setTimeout(unrelated, 1000)
    const bot = await startWithGames()
    await bot.handle({message: '击鼓传雷'})
    expect(bot.controller).toEqual({stop: expect.any(Function)})
    bot.controller.stop()
    bot.controller.stop()
    const calls = bot.calls.length
    await bot.handle({message: '击鼓传雷'})
    await jest.advanceTimersByTimeAsync(61000)
    expect(bot.calls).toHaveLength(calls)
    expect(bot.utils.EndGroupLoopBombGame).not.toHaveBeenCalled()
    expect(unrelated).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  test.each(['stop', 'end', 'restart'])('late next-round lookup cannot act after %s', async (action) => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    await bot.handle({message: '击鼓传雷'})
    await bot.handle({message: `击鼓传雷 ${special}`})
    let release
    const originalGet = bot.axios.get.getMockImplementation()
    bot.axios.get.mockImplementation((url) => new URL(url).pathname === '/get_group_member_list'
      ? new Promise((resolve) => { release = resolve }) : originalGet(url))
    await jest.advanceTimersByTimeAsync(500)
    expect(release).toEqual(expect.any(Function))
    if (action === 'stop') bot.controller.stop()
    else {
      await bot.handle({message: '击鼓传雷 wrong'})
      if (action === 'restart') await bot.handle({message: '击鼓传雷'})
    }
    const calls = bot.calls.length
    release({data: {data: [{user_id: 45678}]}})
    await jest.advanceTimersByTimeAsync(0)
    expect(bot.utils.UpdateGroupLoopBombGame).not.toHaveBeenCalled()
    expect(bot.calls).toHaveLength(calls)
    if (bot.controller) bot.controller.stop()
  })

  test('stop during initial quiz lookup prevents late writes and timers', async () => {
    jest.useFakeTimers()
    let release
    const bot = await startWithGames({ecYWenDa: jest.fn(() => new Promise((resolve) => { release = resolve }))})
    const handling = bot.handle({message: '击鼓传雷'})
    await jest.advanceTimersByTimeAsync(0)
    bot.controller.stop()
    const calls = bot.calls.length
    release({question: special, answer: special})
    await handling
    expect(bot.utils.StartGroupLoopBombGame).not.toHaveBeenCalled()
    expect(bot.calls).toHaveLength(calls)
    expect(jest.getTimerCount()).toBe(0)
  })

  test.each(['question', 'timeout', 'next round'])('catches %s timer rejection without logging payloads', async (phase) => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    await bot.handle({message: '击鼓传雷'})
    if (phase === 'next round') await bot.handle({message: `击鼓传雷 ${special}`})
    const error = new Error('SECRET payload http://mock.invalid?access_token=SECRET')
    if (phase === 'timeout') bot.utils.GetGroupLoopBomb.mockRejectedValue(error)
    else bot.axios.get.mockRejectedValue(error)
    await jest.advanceTimersByTimeAsync(phase === 'timeout' ? 60000 : 1000)
    expect(bot.logger.error).toHaveBeenCalled()
    expect(JSON.stringify(bot.logger.error.mock.calls)).not.toContain('SECRET')
    bot.controller.stop()
    expect(jest.getTimerCount()).toBe(0)
  })

  test('stop does not cancel timers belonging to another StartQQBot instance', async () => {
    jest.useFakeTimers()
    const first = await startWithGames()
    await first.handle({group_id: 111, message: '击鼓传雷'})
    const second = await startWithGames()
    await second.handle({group_id: 222, message: '击鼓传雷'})
    first.controller.stop()
    const calls = first.calls.length
    await jest.advanceTimersByTimeAsync(60000)
    expect(first.calls).toHaveLength(calls)
    expect(first.utils.EndGroupLoopBombGame).not.toHaveBeenCalled()
    expect(second.utils.EndGroupLoopBombGame).toHaveBeenCalledWith(222)
    expect(jest.getTimerCount()).toBe(0)
  })

  test.each(['private', 'tts'])('late %s completion is ignored after stop', async (kind) => {
    jest.useFakeTimers()
    let release
    const bot = await startWithGames({chatProcess: jest.fn(() => new Promise((resolve) => { release = resolve }))})
    bot.config.QQBOT_PRIVATE_CHAT_SWITCH = true
    bot.plugins.tts = {execute: jest.fn(async () => ({file: '/mock.mp3'}))}
    const pending = bot.handle(kind === 'private'
      ? {message_type: 'private', sub_type: 'friend'} : {message: '嘴臭 test'})
    await jest.advanceTimersByTimeAsync(0)
    bot.controller.stop()
    const calls = bot.calls.length
    const broadcasts = bot.io.emit.mock.calls.length
    release('late reply')
    await pending
    expect(bot.calls).toHaveLength(calls)
    expect(bot.io.emit).toHaveBeenCalledTimes(broadcasts)
    expect(bot.plugins.tts.execute).not.toHaveBeenCalled()
  })

  test.each(['private', 'tts'])('catches %s async failure with a safe diagnostic', async (kind) => {
    jest.useFakeTimers()
    const bot = await startWithGames({chatProcess: jest.fn(async () => { throw new Error('SECRET body') })})
    bot.config.QQBOT_PRIVATE_CHAT_SWITCH = true
    await bot.handle(kind === 'private'
      ? {message_type: 'private', sub_type: 'friend'} : {message: '嘴臭 test'})
    expect(bot.logger.error).toHaveBeenCalledWith('QQ 异步任务失败')
    expect(JSON.stringify(bot.logger.error.mock.calls)).not.toContain('SECRET')
    bot.controller.stop()
  })

  test.each([true, false])('forward uses injected axios and preserves nickname fallback (lookup=%s)', async (success) => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    const originalGet = bot.axios.get.getMockImplementation()
    bot.axios.get.mockImplementation((url) => {
      if (new URL(url).pathname !== '/get_group_member_info') return originalGet(url)
      return success ? Promise.resolve({data: {data: {nickname: special}}}) : Promise.reject(new Error('SECRET'))
    })
    bot.axios.post = jest.fn(async () => ({status: 200, data: {status: 'ok'}}))
    await bot.handle({message: '强制迫害'})
    const [url, body, options] = bot.axios.post.mock.calls[0]
    expect(new URL(url).pathname).toBe('/send_group_forward_msg')
    expect(options).toEqual({headers: {'content-type': 'application/json'}})
    expect(body.group_id).toBe(23456)
    expect(body.messages[0]).toEqual({type: 'node', data: {name: success ? special : 'mock', uin: 12345, content: '我是群友专用RBQ'}})
    expect(body.messages[1].data.uin).toBe('1648468212')
    expect(body.messages[1].data.content).toContain('[CQ:image,')
    expect(bot.request).not.toHaveBeenCalled()
    bot.controller.stop()
  })

  test('forward ignores late lookup and handles post rejection safely', async () => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    let release
    const originalGet = bot.axios.get.getMockImplementation()
    bot.axios.get.mockImplementation((url) => new URL(url).pathname === '/get_group_member_info'
      ? new Promise((resolve) => { release = resolve }) : originalGet(url))
    bot.axios.post = jest.fn(async () => { throw new Error('SECRET post body') })
    const pending = bot.handle({message: '强制迫害'})
    await jest.advanceTimersByTimeAsync(0)
    bot.controller.stop()
    release({data: {data: {nickname: 'mock'}}})
    await pending
    expect(bot.axios.post).not.toHaveBeenCalled()
    const other = await startWithGames()
    other.axios.post = bot.axios.post
    await other.handle({message: '强制迫害'})
    expect(other.logger.error).toHaveBeenCalledWith('QQ 异步任务失败')
    expect(JSON.stringify(other.logger.error.mock.calls)).not.toContain('SECRET')
    other.controller.stop()
    expect(JSON.stringify(bot.logger.error.mock.calls)).not.toContain('SECRET')
  })

  test('passes the same config object to webhook registration', async () => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    expect(registerOneBotWebhook.mock.calls.at(-1)[0].config).toBe(bot.config)
    bot.controller.stop()
  })

  test('closing a group clears its stored game so reopening starts a fresh countdown', async () => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    bot.config.QQBOT_ADMIN_LIST = ['12345']
    await bot.handle({message: '击鼓传雷'})
    await bot.handle({message: '闭菊'})
    expect(bot.utils.EndGroupLoopBombGame).toHaveBeenCalledWith(23456)
    expect(jest.getTimerCount()).toBe(0)
    await bot.handle({message: '击鼓传雷'})
    expect(bot.utils.StartGroupLoopBombGame).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(60000)
    expect(bot.utils.EndGroupLoopBombGame).toHaveBeenCalledTimes(2)
    expect(jest.getTimerCount()).toBe(0)
  })

  test('late timeout lookup cannot send or end a game after stop', async () => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    await bot.handle({message: '击鼓传雷'})
    let release
    bot.utils.GetGroupLoopBomb.mockImplementation(() => new Promise((resolve) => { release = resolve }))
    await jest.advanceTimersByTimeAsync(60000)
    bot.controller.stop()
    const calls = bot.calls.length
    release({bombHolder: 12345, bombAnswer: special})
    await jest.advanceTimersByTimeAsync(0)
    expect(bot.calls).toHaveLength(calls)
    expect(bot.utils.EndGroupLoopBombGame).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })

  test('a close command aimed at another bot does not cancel this bot game', async () => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    await bot.handle({message: '击鼓传雷'})
    await bot.handle({message: '闭菊[CQ:at,qq=45678]'})
    expect(bot.utils.DisableGroupService).not.toHaveBeenCalled()
    expect(bot.calls.some((call) => call.pathname === '/get_group_member_info')).toBe(false)
    expect(bot.calls.at(-1).searchParams.get('message')).toBe('[CQ:at,qq=45678] 说你呢，快闭菊!')
    expect(bot.utils.EndGroupLoopBombGame).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(2)
    await jest.advanceTimersByTimeAsync(60000)
    expect(bot.utils.EndGroupLoopBombGame).toHaveBeenCalledTimes(1)
  })

  test.each(['闭菊', '闭菊[CQ:at,qq=34567]'])('unauthorized %s neither disables service nor cancels a public game', async (message) => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    await bot.handle({message: '击鼓传雷'})
    await bot.handle({message, sender: {nickname: 'mock', user_id: 12345, role: 'owner'}})
    expect(bot.utils.DisableGroupService).not.toHaveBeenCalled()
    expect(bot.utils.EndGroupLoopBombGame).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(2)
    const lookup = bot.calls.find((call) => call.pathname === '/get_group_member_info')
    expect(Object.fromEntries(lookup.searchParams)).toEqual({group_id: '23456', user_id: '12345'})
    await jest.advanceTimersByTimeAsync(60000)
    expect(bot.utils.EndGroupLoopBombGame).toHaveBeenCalledTimes(1)
    await bot.controller.stop()
  })

  test.each(['admin', 'owner', 'host'])('verified %s can close service through the event pipeline', async (role) => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    if (role === 'host') bot.config.QQBOT_ADMIN_LIST = ['12345']
    const get = bot.axios.get.getMockImplementation()
    bot.axios.get.mockImplementation((url) => new URL(url).pathname === '/get_group_member_info'
      ? Promise.resolve({data: {data: {role: role === 'host' ? 'member' : role}}}) : get(url))
    await bot.handle({message: '击鼓传雷'})
    await bot.handle({message: '闭菊[CQ:at,qq=34567]'})
    expect(bot.utils.DisableGroupService).toHaveBeenCalledWith(23456)
    expect(bot.utils.EndGroupLoopBombGame).toHaveBeenCalledWith(23456)
    expect(jest.getTimerCount()).toBe(0)
    await bot.controller.stop()
  })

  test('failed service role lookup cannot disable service or cancel a game even for a host admin', async () => {
    jest.useFakeTimers()
    const bot = await startWithGames()
    bot.config.QQBOT_ADMIN_LIST = ['12345']
    const get = bot.axios.get.getMockImplementation()
    bot.axios.get.mockImplementation((url) => new URL(url).pathname === '/get_group_member_info'
      ? Promise.reject(new Error('mock lookup failure')) : get(url))
    await bot.handle({message: '击鼓传雷'})
    await bot.handle({message: '闭菊'})
    expect(bot.utils.DisableGroupService).not.toHaveBeenCalled()
    expect(bot.utils.EndGroupLoopBombGame).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(2)
    await bot.controller.stop()
    const calls = bot.calls.length
    await bot.handle({message: '闭菊'})
    await jest.advanceTimersByTimeAsync(60000)
    expect(bot.calls).toHaveLength(calls)
    expect(bot.utils.DisableGroupService).not.toHaveBeenCalled()
    expect(bot.utils.EndGroupLoopBombGame).not.toHaveBeenCalled()
  })

  test('group conversation preserves one legacy plugin pass, then corpus/LLM, full send and successful history', async () => {
    const order = []
    const content = 'full conversation reply '.repeat(1000)
    const conversation = {
      onMessage: jest.fn(() => order.push('onMessage')),
      execute: jest.fn(async () => ({handled: false})),
      observe: jest.fn(async () => order.push('observe')),
      matchChat: jest.fn(async () => { order.push('match'); return {handled: false} }),
      fallback: jest.fn(async () => { order.push('fallback'); return {handled: true, type: 'text', content} }),
      recordReply: jest.fn(async () => order.push('record')),
    }
    const bot = await start({conversation, processExecute: jest.fn(async () => { order.push('plugin'); return '' })})
    bot.config.QQBOT_REPLY_PROBABILITY = 0
    bot.config.QQBOT_FUDU_PROBABILITY = 100
    const get = bot.axios.get.getMockImplementation()
    bot.axios.get.mockImplementation((url) => {
      if (new URL(url).pathname === '/send_group_msg') order.push('send')
      return get(url)
    })
    await bot.handle()
    expect(order).toEqual(['onMessage', 'plugin', 'observe', 'match', 'fallback', 'send', 'record'])
    expect(bot.processExecute).toHaveBeenCalledTimes(1)
    expect(conversation.execute).not.toHaveBeenCalled()
    expect(bot.chatProcess).not.toHaveBeenCalled()
    expect(bot.calls.at(-1).searchParams.get('message')).toBe(content)
    expect(conversation.fallback).toHaveBeenCalledWith(expect.objectContaining({platform: 'qq', targetId: 23456,
      userId: 12345, selfId: 34567, groupId: 23456, groupName: 'mock group', text: 'ordinary message'}))
    await bot.controller.stop()
  })

  test.each(['text', 'picture'])('legacy %s plugin replies stay ahead of corpus/LLM and record only text', async (type) => {
    const conversation = {onMessage: jest.fn(), execute: jest.fn(), observe: jest.fn(), matchChat: jest.fn(),
      fallback: jest.fn(), recordReply: jest.fn()}
    const reply = {type, content: type === 'text' ? 'plugin text' : {file: '/fixture.png'}}
    const bot = await start({conversation, processExecute: jest.fn(async () => reply)})
    bot.utils.PluginAnswerToGoCqhttpStyle.mockReturnValue(type === 'text' ? reply.content : '[CQ:image,file=fixture.png]')
    await bot.handle()
    expect(conversation.onMessage).toHaveBeenCalledTimes(1)
    expect(conversation.onMessage.mock.invocationCallOrder[0]).toBeLessThan(bot.processExecute.mock.invocationCallOrder[0])
    expect(conversation.observe).toHaveBeenCalledTimes(1)
    expect(conversation.execute).not.toHaveBeenCalled()
    expect(conversation.matchChat).not.toHaveBeenCalled()
    expect(conversation.fallback).not.toHaveBeenCalled()
    expect(conversation.recordReply).toHaveBeenCalledTimes(type === 'text' ? 1 : 0)
    await bot.controller.stop()
  })

  test('conversation routing does not swallow existing loop bomb commands', async () => {
    jest.useFakeTimers()
    const conversation = {onMessage: jest.fn(), execute: jest.fn(), observe: jest.fn(), matchChat: jest.fn(),
      fallback: jest.fn(), recordReply: jest.fn()}
    const bot = await start({conversation})
    await bot.handle({message: '击鼓传雷'})
    expect(bot.utils.StartGroupLoopBombGame).toHaveBeenCalledTimes(1)
    expect(conversation.onMessage).toHaveBeenCalledTimes(1)
    expect(conversation.matchChat).not.toHaveBeenCalled()
    expect(conversation.fallback).not.toHaveBeenCalled()
    await bot.controller.stop()
    expect(jest.getTimerCount()).toBe(0)
  })

  test.each(['text', 'picture', 'audio'])('private router sends %s using the OneBot formatter, never object coercion', async (type) => {
    const content = type === 'text' ? 'private [name]' : {file: '/fixture.media'}
    const conversation = {execute: jest.fn(async () => ({handled: true, type, content})), observe: jest.fn(),
      matchChat: jest.fn(), fallback: jest.fn(), recordReply: jest.fn()}
    const bot = await start({conversation})
    bot.config.QQBOT_PRIVATE_CHAT_SWITCH = true
    const {formatPluginAnswer} = require('../../platforms/responseAdapter')
    bot.utils.PluginAnswerToGoCqhttpStyle.mockImplementation((reply) => formatPluginAnswer('onebot', reply, {webPort: 18080}))
    await bot.handle({message_type: 'private', sub_type: 'friend', group_id: undefined})
    const sent = bot.calls.at(-1)
    expect(sent.pathname).toBe('/send_private_msg')
    expect(sent.searchParams.get('user_id')).toBe('12345')
    const expected = type === 'text' ? 'private [CQ:at,qq=12345]' :
      type === 'picture' ? '[CQ:image,file=http://127.0.0.1:18080/fixture.media]' : '[CQ:record,file=http://127.0.0.1:18080/fixture.media]'
    expect(sent.searchParams.get('message')).toBe(expected)
    expect(sent.searchParams.get('message')).not.toContain('[object Object]')
    expect(conversation.recordReply).toHaveBeenCalledTimes(type === 'text' ? 1 : 0)
    if (type === 'text') expect(conversation.recordReply).toHaveBeenCalledWith(expect.any(Object), expected)
    expect(conversation.matchChat).not.toHaveBeenCalled()
    expect(bot.processExecute).not.toHaveBeenCalled()
    await bot.controller.stop()
  })

  test('failed router send does not record a reply or try an extra fallback', async () => {
    const conversation = {execute: jest.fn(), observe: jest.fn(), matchChat: jest.fn(async () => ({handled: true, content: 'corpus'})),
      fallback: jest.fn(), recordReply: jest.fn()}
    const bot = await start({conversation})
    const get = bot.axios.get.getMockImplementation()
    bot.axios.get.mockImplementation((url) => new URL(url).pathname === '/send_group_msg'
      ? Promise.reject(new Error('SECRET transport')) : get(url))
    await bot.handle()
    expect(conversation.recordReply).not.toHaveBeenCalled()
    expect(conversation.fallback).not.toHaveBeenCalled()
    await bot.controller.stop()
  })

  test('stop ignores a late conversation reply and drains the owned routers', async () => {
    jest.useFakeTimers()
    let release
    const conversation = {execute: jest.fn(), observe: jest.fn(), matchChat: jest.fn(async () => ({handled: false})),
      fallback: jest.fn(() => new Promise((resolve) => { release = resolve })), recordReply: jest.fn()}
    const bot = await start({conversation})
    const pending = bot.handle()
    await jest.advanceTimersByTimeAsync(0)
    expect(release).toEqual(expect.any(Function))
    const stopping = bot.controller.stop()
    expect(bot.controller.stop()).toBe(stopping)
    release({handled: true, type: 'text', content: 'late reply'})
    await Promise.all([pending, stopping])
    expect(bot.calls.filter((call) => call.pathname === '/send_group_msg')).toHaveLength(0)
    expect(conversation.recordReply).not.toHaveBeenCalled()
  })

  test('owns proactive start/stop and observes each group input before plugins without double notification', async () => {
    const proactive = {start: jest.fn(), stop: jest.fn(), observe: jest.fn()}
    const conversation = {createProactive: jest.fn(() => proactive), onMessage: jest.fn(), execute: jest.fn(),
      observe: jest.fn(), matchChat: jest.fn(async () => ({handled: true, content: 'corpus'})),
      fallback: jest.fn(), recordReply: jest.fn()}
    const bot = await start({conversation})
    expect(proactive.start).toHaveBeenCalledTimes(1)
    bot.processExecute.mockResolvedValueOnce('plugin reply')
    await bot.handle({message: 'plugin command'})
    await bot.handle({message: 'ordinary text'})
    expect(proactive.observe).toHaveBeenCalledTimes(2)
    expect(conversation.onMessage).toHaveBeenCalledTimes(2)
    for (let i = 0; i < 2; i++) {
      expect(proactive.observe.mock.invocationCallOrder[i]).toBeLessThan(bot.processExecute.mock.invocationCallOrder[i])
    }
    bot.config.QQBOT_PRIVATE_CHAT_SWITCH = true
    await bot.handle({message_type: 'private', sub_type: 'friend', group_id: undefined})
    expect(proactive.observe).toHaveBeenCalledTimes(2)
    const {send} = conversation.createProactive.mock.calls[0][0]
    await send({targetId: 23456}, special)
    expect(bot.calls.at(-1).searchParams.get('message')).toBe(special)
    const stopping = bot.controller.stop()
    expect(bot.controller.stop()).toBe(stopping)
    await stopping
    expect(proactive.stop).toHaveBeenCalledTimes(1)
    const calls = bot.calls.length
    await expect(send({targetId: 23456}, 'late proactive')).rejects.toBeDefined()
    expect(bot.calls).toHaveLength(calls)
  })

  test('a disabled factory returning null never starts a proactive task', async () => {
    const conversation = {createProactive: jest.fn(() => null)}
    const bot = await start({conversation})
    expect(conversation.createProactive).toHaveBeenCalledTimes(1)
    await bot.controller.stop()
    expect(bot.calls).toHaveLength(0)
  })

  test('failed QQ initialization does not create or start proactive generation', async () => {
    const conversation = {createProactive: jest.fn()}
    const bot = await start({conversation, utils: {InitGroupList: jest.fn(async () => false)}})
    expect(conversation.createProactive).not.toHaveBeenCalled()
    await bot.controller.stop()
  })

  test('a real mine early return still invalidates proactive work without entering chat or plugins', async () => {
    Math.random.mockReturnValue(0)
    const proactive = {start: jest.fn(), stop: jest.fn(), observe: jest.fn()}
    const conversation = {createProactive: () => proactive, execute: jest.fn(), matchChat: jest.fn(), fallback: jest.fn()}
    const bot = await start({conversation})
    bot.utils.GetGroupMine.mockResolvedValue({id: 1, groupId: 23456, owner: 45678})
    await bot.handle()
    expect(proactive.observe).toHaveBeenCalledTimes(1)
    expect(bot.processExecute).not.toHaveBeenCalled()
    expect(conversation.matchChat).not.toHaveBeenCalled()
    expect(conversation.fallback).not.toHaveBeenCalled()
    await bot.controller.stop()
  })

  test('optional proactive start failure degrades safely without blocking ordinary replies', async () => {
    const proactive = {start: jest.fn(() => { throw new Error('SECRET start') }), stop: jest.fn(), observe: jest.fn()}
    const conversation = {createProactive: () => proactive, execute: jest.fn(),
      matchChat: async () => ({handled: true, content: 'corpus'}), fallback: jest.fn()}
    const bot = await start({conversation})
    await bot.handle()
    expect(bot.calls.at(-1).searchParams.get('message')).toBe('corpus')
    expect(bot.logger.error).toHaveBeenCalledWith('QQ_PROACTIVE_START_FAILED')
    expect(JSON.stringify(bot.logger.error.mock.calls)).not.toContain('SECRET')
    await bot.controller.stop()
    expect(proactive.stop).toHaveBeenCalledTimes(1)
  })

  test('a throwing proactive stop still stops/drains routers and returns only a safe error', async () => {
    jest.useFakeTimers()
    let release
    const proactive = {start: jest.fn(), stop: jest.fn(() => { throw new Error('SECRET stop') }), observe: jest.fn()}
    const conversation = {createProactive: () => proactive, execute: jest.fn(),
      matchChat: async () => ({handled: false}), fallback: () => new Promise((resolve) => { release = resolve }), recordReply: jest.fn()}
    const bot = await start({conversation})
    const handling = bot.handle()
    await jest.advanceTimersByTimeAsync(0)
    const stopping = bot.controller.stop()
    const checked = expect(stopping).rejects.toMatchObject({message: 'QQ_STOP_FAILED', code: 'QQ_STOP_FAILED'})
    release({handled: true, type: 'text', content: 'late'})
    await handling
    await checked
    expect(proactive.stop).toHaveBeenCalledTimes(1)
    expect(bot.calls.filter((call) => call.pathname === '/send_group_msg')).toHaveLength(0)
    expect(conversation.recordReply).not.toHaveBeenCalled()
    expect(JSON.stringify(bot.logger.error.mock.calls)).not.toContain('SECRET')
  })

  test('legacy plugin history is not recorded when the actual send fails', async () => {
    const conversation = {execute: jest.fn(), observe: jest.fn(), matchChat: jest.fn(), fallback: jest.fn(), recordReply: jest.fn()}
    const bot = await start({conversation, processExecute: jest.fn(async () => ({type: 'text', content: 'reply'}))})
    bot.utils.PluginAnswerToGoCqhttpStyle.mockReturnValue('reply')
    const get = bot.axios.get.getMockImplementation()
    bot.axios.get.mockImplementation((url) => new URL(url).pathname === '/send_group_msg'
      ? Promise.reject(new Error('mock send failed')) : get(url))
    await expect(bot.handle()).rejects.toThrow('mock send failed')
    expect(conversation.observe).toHaveBeenCalledTimes(1)
    expect(conversation.recordReply).not.toHaveBeenCalled()
    expect(conversation.fallback).not.toHaveBeenCalled()
    await bot.controller.stop()
  })

  test('structured match/fallback injection is wired without a router and legacy reply mode stays opt-in', async () => {
    const matchChat = jest.fn(async () => ({handled: false, content: '', matchType: null}))
    const executeFallback = jest.fn(async () => ({type: 'text', content: 'full fallback'}))
    const bot = await start({matchChat, executeFallback})
    bot.config.QQBOT_REPLY_PROBABILITY = 0
    await bot.handle()
    expect(bot.calls.at(-1).searchParams.get('message')).toBe('full fallback')
    expect(bot.chatProcess).not.toHaveBeenCalled()
    await bot.controller.stop()
    matchChat.mockClear()
    executeFallback.mockClear()
    const legacy = await start({matchChat, executeFallback, legacyReplyMode: true})
    legacy.config.QQBOT_REPLY_PROBABILITY = 0
    await legacy.handle()
    expect(matchChat).not.toHaveBeenCalled()
    expect(executeFallback).not.toHaveBeenCalled()
    expect(legacy.calls.filter((call) => call.pathname === '/send_group_msg')).toHaveLength(0)
    await legacy.controller.stop()
  })
})
