'use strict'

jest.mock('axios', () => ({default: {get: jest.fn()}}))
jest.mock('qq-guild-bot', () => ({createOpenAPI: jest.fn(), createWebsocket: jest.fn()}))

const defaultAxios = require('axios').default
const {ProcessGuildMessage} = require('../qqGuild')
const {handleQQEventPreflight} = require('../qq/eventPreflight')
const {createOneBotHttpClient} = require('../../platforms/oneBotHttp')
const {createOneBotSender} = require('../../platforms/oneBotSender')
const text = '中文 A&B/#/+/% &guild_id=other&channel_id=other'
const secret = 'test-guild-token'
const ok = {status: 200, data: {status: 'ok', retcode: 0, data: {message_id: 1}}}
const missing = () => {throw Object.assign(new Error('mock missing'), {code: 'ENOENT'})}

function setup(overrides = {}) {
  const axios = {get: jest.fn().mockResolvedValue(ok)}
  return {event: {message_type: 'guild', guild_id: 'guild/&#+%', channel_id: 'channel/&#+%',
    user_id: 'user', sender: {nickname: 'nickname'}, message: '/command'},
  config: {ONE_BOT_API_URL: 'https://onebot.invalid/api', ONE_BOT_PROVIDER: 'snowluma', QQBOT_REPLY_PROBABILITY: 100},
  processExecute: jest.fn().mockResolvedValue({type: 'text', content: text}),
  chatProcess: jest.fn().mockResolvedValue(text), utils: {PluginAnswerToGoCqhttpStyle: jest.fn((reply) => reply.content)},
  logger: {info: jest.fn()}, axios, env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}, readFileSync: jest.fn(missing), ...overrides}
}

afterEach(() => {jest.restoreAllMocks(); jest.clearAllMocks()})

test.each(['onebot.invalid:5700', 'http://onebot.invalid:5700/', 'https://onebot.invalid/proxy/api/'])(
  'guild reply preserves all parameters and authenticates secure endpoint %s', async (base) => {
    const options = setup()
    options.config.ONE_BOT_API_URL = base
    await ProcessGuildMessage(options)
    const [url, request] = options.axios.get.mock.calls[0]
    const parsed = new URL(url)
    expect(parsed.pathname).toBe((base.includes('/proxy/') ? '/proxy/api' : '') + '/send_guild_channel_msg')
    expect(parsed.protocol).toBe(base.startsWith('https:') ? 'https:' : 'http:')
    expect(Object.fromEntries(parsed.searchParams)).toEqual({guild_id: options.event.guild_id,
      channel_id: options.event.channel_id, message: text})
    expect([...parsed.searchParams.keys()]).toEqual(['guild_id', 'channel_id', 'message'])
    expect(parsed.hash).toBe('')
    expect(request).toMatchObject({headers: {Authorization: `Bearer ${secret}`}, timeout: 15000, maxRedirects: 0})
    expect(request.signal).toBeInstanceOf(AbortSignal)
    expect(options.axios.get).toHaveBeenCalledTimes(1)
    expect(options.readFileSync).not.toHaveBeenCalled()
    expect(options.chatProcess).not.toHaveBeenCalled()
    expect(options.processExecute).toHaveBeenCalledWith('/command', 'user', 'nickname', options.event.channel_id, '', {type: 'qqInsideGuild'})
  },
)

test.each(['napcat', 'snowluma'])('%s mock credential file supplies the bearer without exposing it in query', async (provider) => {
  const options = setup({env: {}, readFileSync: jest.fn(() => Buffer.from(JSON.stringify({accessToken: secret})))})
  options.config.ONE_BOT_PROVIDER = provider
  await ProcessGuildMessage(options)
  expect(options.readFileSync).toHaveBeenCalledWith('config/onebot.credentials.json')
  expect(options.axios.get.mock.calls[0][0]).not.toContain(secret)
  expect(options.axios.get.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${secret}`)
})

test.each(['napcat', 'snowluma'])('%s missing required credentials rejects safely without a transport call', async (provider) => {
  const options = setup({env: {}})
  options.config.ONE_BOT_PROVIDER = provider
  await expect(ProcessGuildMessage(options)).rejects.toMatchObject({message: 'ONEBOT_AUTH_REQUIRED', code: 'ONEBOT_AUTH_REQUIRED'})
  expect(options.axios.get).not.toHaveBeenCalled()
})

test.each(['', 'bad token', undefined])('NapCat invalid explicit token rejects without credential fallback %#', async (token) => {
  const options = setup({env: {CHATDACS_ONEBOT_ACCESS_TOKEN: token}})
  options.config.ONE_BOT_PROVIDER = 'napcat'
  await expect(ProcessGuildMessage(options)).rejects.toMatchObject({message: 'ONEBOT_AUTH_REQUIRED', code: 'ONEBOT_AUTH_REQUIRED'})
  expect(options.axios.get).not.toHaveBeenCalled()
  expect(options.readFileSync).not.toHaveBeenCalled()
})

test.each(['http://user:password@onebot.invalid', 'http://onebot.invalid/api?token=secret', 'ftp://onebot.invalid'])(
  'unsafe configured endpoint %s never reaches Axios or credentials', async (base) => {
    const options = setup()
    options.config.ONE_BOT_API_URL = base
    await expect(ProcessGuildMessage(options)).rejects.toMatchObject({code: 'ONEBOT_REQUEST_FAILED'})
    expect(options.axios.get).not.toHaveBeenCalled()
    expect(options.readFileSync).not.toHaveBeenCalled()
  },
)

test.each([{status: 'failed', retcode: 0}, {status: 'ok', retcode: 100}])('OneBot action failure %j rejects instead of reporting success', async (body) => {
  const options = setup()
  options.axios.get.mockResolvedValue({status: 200, data: {...body, wording: secret}})
  const error = await ProcessGuildMessage(options).catch((error) => error)
  expect(error.message).toBe('ONEBOT_ACTION_FAILED')
  expect(Object.keys(error)).toEqual(['code'])
  expect(error.cause).toBeUndefined()
  expect(JSON.stringify(error)).not.toContain(secret)
  expect(options.axios.get).toHaveBeenCalledTimes(1)
})

test('transport rejection is sanitized and never retried', async () => {
  const options = setup()
  options.axios.get.mockRejectedValue(Object.assign(new Error(secret), {response: {status: 401}, config: {secret}}))
  const error = await ProcessGuildMessage(options).catch((error) => error)
  expect(error).toMatchObject({message: 'ONEBOT_AUTH_FAILED', code: 'ONEBOT_AUTH_FAILED'})
  expect(Object.keys(error)).toEqual(['code'])
  expect(error.cause).toBeUndefined()
  expect(options.axios.get).toHaveBeenCalledTimes(1)
})

test('old call signature uses module Axios by default and authenticates NapCat', async () => {
  const options = setup({config: {ONE_BOT_API_URL: 'onebot.invalid:5700', ONE_BOT_PROVIDER: 'napcat'}})
  delete options.axios
  defaultAxios.get.mockResolvedValue(ok)
  await ProcessGuildMessage(options)
  expect(defaultAxios.get).toHaveBeenCalledTimes(1)
  expect(defaultAxios.get.mock.calls[0][1].headers).toEqual({Authorization: `Bearer ${secret}`})
  expect(options.readFileSync).not.toHaveBeenCalled()
})

test('chat fallback uses the same secure sender and preserves query text', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(0)
  jest.spyOn(console, 'log').mockImplementation(() => {})
  const options = setup({processExecute: jest.fn().mockResolvedValue('')})
  await ProcessGuildMessage(options)
  expect(options.chatProcess).toHaveBeenCalledWith('/command')
  expect(new URL(options.axios.get.mock.calls[0][0]).searchParams.get('message')).toBe(text)
  expect(options.axios.get.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${secret}`)
})

test('empty reply performs no HTTP or credential reads', async () => {
  const options = setup({processExecute: jest.fn().mockResolvedValue('')})
  options.config.QQBOT_REPLY_PROBABILITY = 0
  await ProcessGuildMessage(options)
  expect(options.axios.get).not.toHaveBeenCalled()
  expect(options.readFileSync).not.toHaveBeenCalled()
})

test('event preflight reuses its shared authenticated sender for guild messages', async () => {
  const options = setup()
  const client = createOneBotHttpClient(options)
  const oneBotSender = createOneBotSender({apiUrl: options.config.ONE_BOT_API_URL, axios: client})
  await expect(handleQQEventPreflight({...options, oneBotSender})).resolves.toBe(true)
  expect(options.axios.get).toHaveBeenCalledTimes(1)
  const [url, request] = options.axios.get.mock.calls[0]
  expect(new URL(url).searchParams.get('message')).toBe(text)
  expect(request.headers.Authorization).toBe(`Bearer ${secret}`)
})
