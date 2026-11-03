'use strict'

const exported = require('../../plugins/ollama')
const fs = require('fs')
const os = require('os')
const path = require('path')
const config = {llm: {provider: 'openai', baseUrl: 'https://llm.example/v1', model: 'gpt-6-luna', timeoutMs: 100,
  modelAdminQQs: ['1005056803']}}
const oldKey = process.env.CHATDACS_LLM_API_KEY
let personaDir
beforeEach(() => {
  process.env.CHATDACS_LLM_API_KEY = 'test-secret'
  personaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-llm-personas-'))
  fs.writeFileSync(path.join(personaDir, '大肥鱼女友版.txt'), '测试女友人设', 'utf8')
})
afterEach(() => { fs.rmSync(personaDir, {recursive: true, force: true}) })
afterAll(() => {
  if (oldKey === undefined) delete process.env.CHATDACS_LLM_API_KEY
  else process.env.CHATDACS_LLM_API_KEY = oldKey
})

function setup(settings = config, dependencies = {}) {
  const plugin = {...exported}
  const axios = {post: jest.fn(), get: jest.fn()}
  const logger = {info: jest.fn(), error: jest.fn()}
  plugin.init({config: {...settings, llm: {...settings.llm, personaDir, personaStateFile: path.join(personaDir, 'state.json'),
    modelStateFile: path.join(personaDir, 'models.json')}}, axios, logger, ...dependencies})
  return {plugin, axios, logger}
}

function message(text = '当前消息', overrides = {}) {
  return {text, userId: 'u1', userName: 'Alice', groupId: 'g1', groupName: 'Group',
    platform: 'napcat', selfId: 'bot1', raw: {scope: 'group'}, ...overrides}
}
function fallback(plugin, context) {
  return plugin.executeFallback(context.text, context.userId, context.userName, context.groupId, context.groupName, context)
}
function reply(content) { return {data: {choices: [{message: {content}}]}} }
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return {promise, resolve}
}

test('router observation/delivery produces speaker-aware history without duplicate current users or unsent replies', async () => {
  const {plugin, axios} = setup()
  axios.post.mockResolvedValue(reply('generated but not yet sent'))
  const first = message('first message')
  expect(plugin.observeMessage(first)).toBe(true)
  expect(plugin.observeMessage(first)).toBe(false)
  await fallback(plugin, first)
  expect(plugin.contexts.stats().entries).toBe(1)
  expect(plugin.recordReply(first, 'confirmed corpus plugin reply')).toBe(true)
  expect(plugin.recordReply(first, 'duplicate delivery')).toBe(false)
  const current = message('current message', {userId: 'u2', userName: 'Bob'})
  plugin.observeMessage(current)
  await fallback(plugin, current)
  const messages = axios.post.mock.calls[1][1].messages
  expect(messages.map((item) => item.role)).toEqual(['system', 'user', 'assistant', 'user'])
  expect(messages[1].content).toContain('Alice (u1)')
  expect(messages[2].content).toBe('confirmed corpus plugin reply')
  expect(messages[3].content).toContain('Bob (u2)')
  expect(messages[3].content).toContain('current message')
  expect(messages.filter((item) => item.content.includes('current message'))).toHaveLength(1)
  expect(JSON.stringify(messages)).not.toContain('generated but not yet sent')
  expect(plugin.contexts.stats().entries).toBe(3)
  expect(new RegExp(plugin.指令).test('ordinary unmatched message')).toBe(false)
})

test('legacy unobserved repeated explicit command preserves previously recorded user and assistant', async () => {
  const {plugin, axios} = setup()
  const context = message('小夜 repeat')
  plugin.observeMessage(context)
  plugin.recordReply(context, 'first successful reply')
  axios.post.mockResolvedValue(reply('new reply'))
  await fallback(plugin, context)
  const messages = axios.post.mock.calls[0][1].messages
  expect(messages.map((item) => item.role)).toEqual(['system', 'user', 'assistant', 'user'])
  expect(messages[1].content).toContain('小夜 repeat')
  expect(messages[2].content).toBe('first successful reply')
  expect(messages[3].content).toContain('小夜 repeat')
})

test.each(['raw', 'no-raw'])('unobserved same-text retry preserves a prior failed user without assistant (%s)', async (mode) => {
  const {plugin, axios} = setup()
  const previous = message('小夜 repeated failed question', mode === 'no-raw' ? {raw: undefined} : {})
  plugin.observeMessage(previous)
  axios.post.mockRejectedValueOnce(new Error('synthetic failure')).mockResolvedValueOnce(reply('new reply'))
  expect((await fallback(plugin, previous)).safeError).toBe(true)
  expect(plugin.contexts.stats().entries).toBe(1)
  // Old callers did not observe this second event; equal text is not an event identity.
  const unobserved = {...previous, ...(mode === 'raw' ? {raw: {...previous.raw}} : {})}
  await fallback(plugin, unobserved)
  const messages = axios.post.mock.calls[1][1].messages
  expect(messages.map((entry) => entry.role)).toEqual(['system', 'user', 'user'])
  expect(messages[1].content).toBe(messages[2].content)
  expect(messages[1].content).toContain('repeated failed question')
  expect(plugin.contexts.stats().entries).toBe(1)
})

test.each(['raw', 'no-raw'])('observed current user is excluded only through its actual object identity (%s)', async (mode) => {
  const {plugin, axios} = setup()
  const current = message('current observed question', mode === 'no-raw' ? {raw: undefined} : {})
  plugin.observeMessage(current)
  axios.post.mockResolvedValue(reply('ok'))
  const options = mode === 'raw' ? {platform: current.platform, selfId: current.selfId, raw: current.raw} : current
  await plugin.executeFallback(current.text, current.userId, current.userName, current.groupId, current.groupName, options)
  expect(axios.post.mock.calls[0][1].messages.map((entry) => entry.role)).toEqual(['system', 'user'])
  expect(plugin.contexts.stats().entries).toBe(1)
})

test('a stale observation lease cannot exclude a new persona generation with identical speech', async () => {
  const {plugin, axios} = setup()
  const previous = message('小夜 repeated question')
  plugin.observeMessage(previous)
  await plugin.execute('/更换人设 1', 'u1', 'Alice', 'g1', 'Group', previous)
  const current = message(previous.text)
  plugin.observeMessage(current)
  axios.post.mockResolvedValue(reply('ok'))
  await fallback(plugin, previous)
  expect(axios.post.mock.calls[0][1].messages.map((entry) => entry.role)).toEqual(['system', 'user', 'user'])
})

test.each([
  {platform: 'other'}, {selfId: 'bot2'}, {groupId: 'g2'}, {raw: {scope: 'private'}},
])('memory is isolated by existing platform/self/target/scope key: %j', async (overrides) => {
  const {plugin, axios} = setup()
  axios.post.mockResolvedValue(reply('ok'))
  const first = message('isolated marker')
  plugin.observeMessage(first)
  plugin.recordReply(first, 'isolated reply')
  const next = message('new context', overrides)
  plugin.observeMessage(next)
  await fallback(plugin, next)
  expect(JSON.stringify(axios.post.mock.calls[0][1].messages)).not.toMatch(/isolated marker|isolated reply/)
})

test('private targets isolate users even when group and bot IDs are identical', async () => {
  const {plugin, axios} = setup()
  axios.post.mockResolvedValue(reply('ok'))
  plugin.observeMessage(message('private marker', {raw: {scope: 'private'}}))
  const other = message('private current', {userId: 'u2', raw: {scope: 'private'}})
  plugin.observeMessage(other)
  await fallback(plugin, other)
  expect(JSON.stringify(axios.post.mock.calls[0][1].messages)).not.toContain('private marker')
})

test('legacy execution without context or observers still works and does not invent memory', async () => {
  const {plugin, axios} = setup()
  axios.post.mockResolvedValue(reply('ok'))
  await expect(plugin.executeFallback('ordinary text')).resolves.toEqual({type: 'text', content: 'ok'})
  await expect(plugin.execute(undefined, undefined, undefined, undefined, undefined, null)).resolves.toEqual({type: 'text', content: 'ok'})
  expect(plugin.contexts.stats().entries).toBe(0)
  expect(plugin.observeMessage({text: 'missing identity'})).toBe(false)
  expect(plugin.recordReply({}, 'unattributed')).toBe(false)
})

test('successful persona change clears history and invalidates old delivery/generation', async () => {
  const {plugin, axios} = setup()
  const current = message('小夜 old question')
  plugin.observeMessage(current)
  const gate = deferred()
  axios.post.mockReturnValueOnce(gate.promise).mockResolvedValue(reply('new reply'))
  const oldRequest = fallback(plugin, current)
  expect(axios.post).toHaveBeenCalledTimes(1)
  const result = await plugin.execute('/更换人设 1', 'u1', 'Alice', 'g1', 'Group', current)
  expect(result.content).toContain('已切换为')
  gate.resolve(reply('old persona answer'))
  expect((await oldRequest).content).not.toContain('old persona answer')
  expect(plugin.recordReply(current, 'old delivered reply')).toBe(false)
  expect(plugin.contexts.stats().entries).toBe(0)
  const next = message('new question')
  plugin.observeMessage(next)
  await fallback(plugin, next)
  expect(axios.post.mock.calls[1][1].messages[0].content).toContain('测试女友人设')
  expect(JSON.stringify(axios.post.mock.calls[1][1].messages)).not.toContain('old question')
})

test('persona inspection or failed selection does not erase observed conversation', async () => {
  const {plugin} = setup()
  plugin.observeMessage(message('preserved history'))
  await plugin.execute('/更换人设 查看', 'u1', 'Alice', 'g1', 'Group', message())
  await plugin.execute('/更换人设 missing', 'u1', 'Alice', 'g1', 'Group', message())
  expect(plugin.contexts.stats().entries).toBe(1)
})

test('proactive generation uses live persona/model/history and records only after actual delivery', async () => {
  const {plugin, axios} = setup()
  axios.get.mockResolvedValue({data: {data: [{id: 'provider/luna'}]}})
  await plugin.execute('/更换模型 provider/luna', '1005056803', 'Admin', 'g1', 'Group', message())
  await plugin.execute('/更换人设 1', 'u1', 'Alice', 'g1', 'Group', message())
  const prior = message('真实的合成测试历史')
  plugin.observeMessage(prior)
  plugin.recordReply(prior, '已经发送的合成回复')
  const context = message('', {userId: 'proactive'})
  axios.post.mockResolvedValue(reply('{"send":true,"text":"主动问候"}'))
  await expect(plugin.generateProactive(context)).resolves.toEqual({text: '主动问候'})
  const body = axios.post.mock.calls[0][1]
  expect(body.model).toBe('provider/luna')
  expect(body.messages[0].content).toContain('测试女友人设')
  expect(body.messages[1].content).toContain('真实的合成测试历史')
  expect(body.messages[2]).toEqual({role: 'assistant', content: '已经发送的合成回复'})
  expect(plugin.contexts.stats().entries).toBe(2)
  expect(plugin.recordReply(context, '主动问候')).toBe(true)
  expect(plugin.contexts.stats().entries).toBe(3)
  expect(plugin.recordReply(context, '主动问候')).toBe(false)
})

test.each(['{"send":false}', 'not-json', '{"send":true,"text":""}',
  '{"send":true,"text":"hello","extra":true}', '{"send":true,"text":123}'])('proactive invalid or no-send decision never appends history: %s', async (raw) => {
  const {plugin, axios} = setup()
  plugin.observeMessage(message('prior'))
  axios.post.mockResolvedValue(reply(raw))
  const context = message('')
  await expect(plugin.generateProactive(context)).resolves.toBeNull()
  expect(plugin.contexts.stats().entries).toBe(1)
  expect(plugin.recordReply(context, 'not generated')).toBe(false)
})

test('normal empty-history proactive is silent; explicit demo uses persona and actual Beijing clock without invented speech', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-03T15:00:00Z'))
  try {
    const {plugin, axios} = setup()
    const context = message('')
    await expect(plugin.generateProactive(context)).resolves.toBeNull()
    expect(axios.post).not.toHaveBeenCalled()
    const demo = message('', {raw: {scope: 'group', proactiveDemo: true}})
    axios.post.mockResolvedValue(reply('{"send":true,"text":"上线问候"}'))
    await expect(plugin.generateProactive(demo)).resolves.toEqual({text: '上线问候'})
    const messages = axios.post.mock.calls[0][1].messages
    expect(messages.map((item) => item.role)).toEqual(['system', 'user'])
    expect(messages[1].content).toContain('2026')
    expect(messages[1].content).toContain('23:00:00')
    expect(messages[1].content).toContain('不得虚构用户发言')
    expect(messages[0].content).toContain("名字叫'小夜'")
    expect(plugin.contexts.stats().entries).toBe(0)
    expect(plugin.recordReply(demo, '上线问候')).toBe(true)
    expect(plugin.contexts.stats().entries).toBe(1)
  } finally { jest.useRealTimers() }
})

test('failed proactive request returns null without raw errors or invented memory', async () => {
  const {plugin, axios, logger} = setup()
  plugin.observeMessage(message('prior'))
  axios.post.mockRejectedValue(new Error('test-secret private error'))
  await expect(plugin.generateProactive(message(''))).resolves.toBeNull()
  expect(plugin.contexts.stats().entries).toBe(1)
  expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/test-secret|private error/)
})

test('keeps the old trigger and persona while calling the configured OpenAI model', async () => {
  const {plugin, axios, logger} = setup()
  expect(new RegExp(plugin.指令).test('小夜你好')).toBe(true)
  expect(new RegExp(plugin.指令).test('你好，小夜')).toBe(false)
  axios.post.mockResolvedValue({data: {choices: [{message: {content: '<think>private thought</think>你好喵'}}]}})
  await expect(plugin.execute('小夜你好', 'u', 'User', 'g')).resolves.toEqual({type: 'text', content: '你好喵'})
  const [url, body, options] = axios.post.mock.calls[0]
  expect(url).toBe('https://llm.example/v1/chat/completions')
  expect(body.model).toBe('gpt-6-luna')
  expect(body.messages[0]).toMatchObject({role: 'system', content: expect.stringContaining("名字叫'小夜'")})
  expect(body.messages[1].content).toContain('小夜你好')
  expect(options.headers.Authorization).toBe('Bearer test-secret')
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain('你好喵')
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain('test-secret')
})

test.each([[401, undefined, '模型服务鉴权失败，请检查 API Key'], [undefined, 'ECONNABORTED', '模型响应超时，请稍后再试'],
  [500, undefined, '模型服务暂不可用，请稍后再试']])('returns safe OpenAI failure messages (%s)', async (status, code, content) => {
  const {plugin, axios, logger} = setup()
  axios.post.mockRejectedValue({response: {status}, code, message: 'test-secret private-message'})
  await expect(plugin.execute('小夜你好', 'u', 'User', 'g')).resolves.toEqual({type: 'text', content, safeError: true})
  expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/test-secret|private-message/)
  expect(axios.post).toHaveBeenCalledTimes(1)
})

test('retains legacy Ollama responses and question fallback', async () => {
  const {plugin, axios} = setup({llm: {provider: 'ollama', baseUrl: 'http://127.0.0.1:11434/api/chat', model: 'legacy'}})
  axios.post.mockResolvedValueOnce({data: {message: {content: 'old reply'}}}).mockRejectedValueOnce(new Error('offline'))
  await expect(plugin.execute('小夜你好', 'u', 'User', 'g')).resolves.toEqual({type: 'text', content: 'old reply'})
  await expect(plugin.execute('小夜好吗', 'u', 'User', 'g')).resolves.toEqual({type: 'text', content: '小夜好喵！', safeError: true})
})

test('initialization failure stays safe when the runtime still registers the plugin', async () => {
  const fs = require('fs')
  const path = require('path')
  const os = require('os')
  const {createPluginRuntime} = require('./runtime')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-llm-init-'))
  try {
    fs.writeFileSync(path.join(dir, 'ollama.js'), `module.exports = {...require(${JSON.stringify(require.resolve('../../plugins/ollama'))})}`)
    const notify = jest.fn()
    const logger = {info: jest.fn(), error: jest.fn(), warn: jest.fn()}
    const runtime = createPluginRuntime({pluginDir: dir, logger,
      dependencies: {logger, axios: {post: jest.fn()}, config: {llm: {provider: 'invalid', personaDir,
        personaStateFile: path.join(personaDir, 'state.json')}}, sendMessageToQQGroup: notify}})
    runtime.load()
    expect(runtime.list()[0].initError).toBe('PLUGIN_INIT_ERROR')
    const result = await runtime.execute({text: '小夜 private-message', userName: 'private-name', platform: 'qq'})
    expect(result).toMatchObject({handled: true, content: '模型服务配置不完整，请联系管理员'})
    expect(notify).not.toHaveBeenCalled()
    expect(result.error).toBeUndefined()
    expect(JSON.stringify({report: runtime.list(), result, logs: logger.error.mock.calls}))
      .not.toMatch(/LLM_CONFIG_ERROR|private-message|private-name|test-secret|\bat (?:Object\.|createLlmClient)/)
  } finally { fs.rmSync(dir, {recursive: true, force: true}) }
})

test('lists, persists and resets personas per group and per private conversation without calling the model', async () => {
  const {plugin, axios} = setup()
  const group = {type: 'napcat', selfId: 'bot', scope: 'group'}
  const privateChat = {...group, scope: 'private'}
  const execute = (msg, user = 'u1', room = 'g1', options = group) => plugin.execute(msg, user, 'User', room, '', options)
  expect(new RegExp(plugin.指令).test('/更换人设 查看')).toBe(true)
  expect((await execute('/更换人设')).content).toContain('0. 小夜原生（默认）')
  expect((await execute('/更换人设')).content).toContain('大肥鱼女友版.txt')
  expect((await execute('/更换人设 查看')).content).toContain('小夜原生')
  expect((await execute('/更换人设 大肥鱼女友版.txt')).content).toContain('已切换为：大肥鱼女友版.txt')
  expect((await execute('/更换人设 查看', 'u2')).content).toContain('大肥鱼女友版.txt')
  expect((await execute('/更换人设 查看', 'u1', 'g2')).content).toContain('小夜原生')
  expect((await execute('/更换人设 查看', 'u1', 'g1', privateChat)).content).toContain('小夜原生')
  expect((await execute('/更换人设 1', 'u1', 'g1', privateChat)).content).toContain('大肥鱼女友版.txt')
  expect((await execute('/更换人设 查看', 'u2', 'g1', privateChat)).content).toContain('小夜原生')
  const reloaded = setup().plugin
  expect((await reloaded.execute('/更换人设 查看', 'u1', '', 'g1', '', group)).content).toContain('大肥鱼女友版.txt')
  expect((await execute('/更换人设 重置')).content).toContain('小夜原生')
  expect((await execute('/更换人设 ../secret')).content).toContain('失败')
  expect(axios.post).not.toHaveBeenCalled()
})

test('selected persona reaches the system role and reset restores native Xiaoye', async () => {
  const {plugin, axios} = setup()
  axios.post.mockResolvedValue({data: {choices: [{message: {content: 'reply'}}]}})
  await plugin.execute('/更换人设 1', 'u', 'User', 'g')
  await plugin.execute('小夜你好', 'u', 'User', 'g')
  expect(axios.post.mock.calls[0][1].messages[0].content).toContain('测试女友人设')
  expect(axios.post.mock.calls[0][1].messages[0].content).not.toContain("名字叫'小夜'")
  await plugin.execute('/更换人设 重置', 'u', 'User', 'g')
  await plugin.execute('小夜你好', 'u', 'User', 'g')
  expect(axios.post.mock.calls[1][1].messages[0].content).toContain("名字叫'小夜'")
})

test('all users can query models, but only configured QQ admins can mutate the current conversation', async () => {
  const {plugin, axios} = setup()
  axios.get.mockResolvedValue({data: {data: [{id: 'provider/luna'}, {id: 'provider/other'}]}})
  const group = {type: 'napcat', selfId: 'bot', scope: 'group'}
  const command = (msg, user = '1005056803', room = 'g1', options = group) => plugin.execute(msg, user, 'User', room, '', options)
  expect(new RegExp(plugin.指令).test('/查询模型 luna')).toBe(true)
  expect(new RegExp(plugin.指令).test('/更换模型 provider/luna')).toBe(true)
  expect((await command('/更换模型 查看', 'other')).content).toContain('gpt-6-luna')
  expect((await command('/更换模型 provider/luna', 'other')).content).toContain('管理员')
  expect((await command('/更换模型 重置', 'other')).content).toContain('管理员')
  expect((await command('/更换模型 provider/luna', '1005056803', 'g1', {...group, type: 'web'})).content).toContain('管理员')
  expect(axios.get).not.toHaveBeenCalled()
  const list = await command('/查询模型 luna', 'other')
  expect(list.content).toContain('provider/luna')
  expect(list.content).not.toContain('provider/other')
  expect((await command('/更换模型 provider/luna')).content).toContain('已切换为：provider/luna')
  expect((await command('/更换模型 查看', 'other')).content).toContain('当前模型：provider/luna')
  expect((await command('/更换模型 查看', 'other', 'g2')).content).toContain('当前模型：gpt-6-luna')
  const privateChat = {...group, scope: 'private'}
  expect((await command('/更换模型 查看', '1005056803', 'g1', privateChat)).content).toContain('当前模型：gpt-6-luna')
  const reloaded = setup().plugin
  expect((await reloaded.execute('/更换模型 查看', 'other', '', 'g1', '', group)).content).toContain('当前模型：provider/luna')
  expect((await command('/更换模型 重置')).content).toContain('已切换为：gpt-6-luna')
  expect((await command('/更换模型 unknown')).content).toContain('可用列表')
  expect(axios.post).not.toHaveBeenCalled()
})

test('selected model is used by requests without changing persona or default model', async () => {
  const {plugin, axios} = setup()
  axios.get.mockResolvedValue({data: {data: [{id: 'provider/luna'}]}})
  axios.post.mockResolvedValue({data: {choices: [{message: {content: 'reply'}}]}})
  const group = {type: 'napcat', selfId: 'bot', scope: 'group'}
  await plugin.execute('/更换模型 provider/luna', '1005056803', '', 'g1', '', group)
  await plugin.execute('小夜你好', 'other', 'User', 'g1', '', group)
  await plugin.execute('小夜你好', 'other', 'User', 'g2', '', group)
  expect(axios.post.mock.calls[0][1].model).toBe('provider/luna')
  expect(axios.post.mock.calls[1][1].model).toBe('gpt-6-luna')
  expect(axios.post.mock.calls[0][1].messages[0].content).toContain("名字叫'小夜'")
})

test('model query failures expose no key or raw service errors and do not invoke generation', async () => {
  const {plugin, axios, logger} = setup()
  axios.get.mockRejectedValue({response: {status: 401}, message: 'test-secret private-message'})
  const result = await plugin.execute('/查询模型', 'other', '', 'g1')
  expect(result.content).toBe('模型服务鉴权失败，请检查 API Key')
  expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/test-secret|private-message/)
  expect(axios.post).not.toHaveBeenCalled()
})
