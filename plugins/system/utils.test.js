jest.mock('canvas', () => ({}))
jest.mock('nodejs-jieba', () => ({extract: jest.fn((text) => [{word: text}])}))
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFile: jest.fn((_path, _encoding, callback) => callback(null, '{}')),
  readFileSync: jest.fn(() => { throw Object.assign(new Error('mock missing'), {code: 'ENOENT'}) }),
}))
jest.mock('./model/userModel.js', () => ({}))
jest.mock('./model/messageModel.js', () => ({}))
jest.mock('./model/qqGroupModel.js', () => ({findAll: jest.fn().mockResolvedValue([]), bulkCreate: jest.fn()}))
jest.mock('./model/mineModel.js', () => ({}))
jest.mock('./model/chatModel.js', () => ({}))
jest.mock('./model/perfunctoryModel.js', () => ({}))
jest.mock('./model/handGrenadeModel.js', () => ({}))

const path = require('path')
const fs = require('fs')
const axios = require('axios').default
const {normalizeRuntimeConfig} = require('../../src/config/runtimeConfig')
const utils = require('./utils.js')

// Set the node environment to test
process.env.NODE_ENV = 'test'
const originalToken = process.env.CHATDACS_ONEBOT_ACCESS_TOKEN
beforeEach(() => { delete process.env.CHATDACS_ONEBOT_ACCESS_TOKEN })
afterAll(() => {
  if (originalToken === undefined) delete process.env.CHATDACS_ONEBOT_ACCESS_TOKEN
  else process.env.CHATDACS_ONEBOT_ACCESS_TOKEN = originalToken
})

describe('Utils Module', () => {
  beforeAll(() => {
    utils._setTestConfig({WEB_PORT: 8080, CHAT_JIEBA_LIMIT: 6})
  })

  test('should load without errors', () => {
    expect(utils).not.toBeNull()
  })

  test('sha1 should compute the correct hash', () => {
    const input = 'hello world'
    const expectedHash = '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed'
    expect(utils.sha1(input)).toBe(expectedHash)
  })

  test('ChatJiebaFuzzy should aggregate string answers without producing undefined candidates', async () => {
    const fuzzySpy = jest.spyOn(utils, 'FuzzyContentSearchAnswer').mockResolvedValue('候选回复')

    const candidates = await utils.ChatJiebaFuzzy('回归普通聊天')

    expect(candidates).toEqual(['候选回复'])
    expect(candidates).not.toContain('undefined')
    expect(fuzzySpy).toHaveBeenCalled()

    fuzzySpy.mockRestore()
  })

  test('should use the normalized v3.7 OneBot URL for utility requests', async () => {
    const requestSpy = jest.spyOn(axios, 'get').mockRejectedValue({code: 'OFFLINE'})
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const config = normalizeRuntimeConfig({
      System: {GO_CQHTTP_SERVICE_API_URL: 'legacy-onebot:6700'},
    })

    utils.ConfigureRuntime(config)
    await expect(utils.InitGroupList()).resolves.toBe(false)

    expect(requestSpy).toHaveBeenCalledWith('http://legacy-onebot:6700/get_group_list',
      expect.objectContaining({headers: {}, timeout: 15000, maxRedirects: 0, signal: expect.any(AbortSignal)}))
    requestSpy.mockRestore()
    errorSpy.mockRestore()
  })

  test('should bound the external nickname request', async () => {
    const requestSpy = jest.spyOn(axios, 'get').mockResolvedValue({
      data: {code: 200, newslist: [{naming: '测试昵称'}]},
    })

    await expect(utils.RandomNickname()).resolves.toBe('测试昵称')
    expect(requestSpy).toHaveBeenCalledWith(expect.stringContaining('api.tianapi.com'), {timeout: 3000})
    requestSpy.mockRestore()
  })
})

describe('Utils OneBot scoped authentication', () => {
  let requestSpy
  let errorSpy
  let logSpy
  beforeEach(() => {
    fs.readFileSync.mockClear()
    fs.readFileSync.mockImplementation(() => { throw Object.assign(new Error('mock missing'), {code: 'ENOENT'}) })
    requestSpy = jest.spyOn(axios, 'get').mockResolvedValue({status: 200, data: {status: 'ok', retcode: 0, data: []}})
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    jest.useRealTimers()
    requestSpy.mockRestore()
    errorSpy.mockRestore()
    logSpy.mockRestore()
  })

  test('SnowLuma setup is lazy and sends authenticated HTTPS requests without double protocol', async () => {
    process.env.CHATDACS_ONEBOT_ACCESS_TOKEN = 'mock-env-token'
    utils.ConfigureRuntime(normalizeRuntimeConfig({System: {
      ONE_BOT_PROVIDER: 'snowluma', ONE_BOT_API_URL: 'https://mock.invalid/onebot/', ONE_BOT_REQUEST_TIMEOUT_MS: 4500,
    }}))
    expect(fs.readFileSync).not.toHaveBeenCalled()
    await expect(utils.InitGroupList()).resolves.toBe(true)
    expect(requestSpy).toHaveBeenCalledWith('https://mock.invalid/onebot/get_group_list', expect.objectContaining({
      headers: {Authorization: 'Bearer mock-env-token'}, timeout: 4500, maxRedirects: 0, signal: expect.any(AbortSignal),
    }))
    expect(fs.readFileSync).not.toHaveBeenCalled()
  })

  test('external nickname API retains its original arguments without token or credential reads', async () => {
    process.env.CHATDACS_ONEBOT_ACCESS_TOKEN = 'mock-env-token'
    utils.ConfigureRuntime({System: {ONE_BOT_PROVIDER: 'snowluma'}, ApiKey: {TIAN_XING_API_KEY: 'mock-api-key'}})
    requestSpy.mockResolvedValue({data: {code: 200, newslist: [{naming: 'nickname'}]}})
    await expect(utils.RandomNickname()).resolves.toBe('nickname')
    expect(requestSpy).toHaveBeenCalledWith(expect.stringContaining('api.tianapi.com'), {timeout: 3000})
    expect(requestSpy.mock.calls[0][1].headers).toBeUndefined()
    expect(fs.readFileSync).not.toHaveBeenCalled()
  })

  test('raw nested and flattened configs choose SnowLuma port 3000', async () => {
    process.env.CHATDACS_ONEBOT_ACCESS_TOKEN = 'mock-env-token'
    for (const config of [{System: {ONE_BOT_PROVIDER: ' SnowLuma '}}, {ONE_BOT_PROVIDER: 'snowluma'}]) {
      utils.ConfigureRuntime(config)
      await utils.InitGroupList()
      expect(requestSpy).toHaveBeenLastCalledWith('http://127.0.0.1:3000/get_group_list', expect.objectContaining({
        headers: {Authorization: 'Bearer mock-env-token'}, timeout: 15000, maxRedirects: 0,
      }))
    }
  })

  test('reconfiguration replaces scoped client and credential location without caching secrets', async () => {
    fs.readFileSync.mockImplementation((file) => Buffer.from(JSON.stringify({accessToken: file === 'first.mock' ? 'first-token' : 'second-token'})))
    for (const [file, token] of [['first.mock', 'first-token'], ['second.mock', 'second-token']]) {
      utils.ConfigureRuntime({System: {ONE_BOT_PROVIDER: 'snowluma', ONE_BOT_CREDENTIALS_FILE: file}})
      await utils.InitGroupList()
      expect(fs.readFileSync).toHaveBeenLastCalledWith(file)
      expect(requestSpy).toHaveBeenLastCalledWith('http://127.0.0.1:3000/get_group_list', expect.objectContaining({
        headers: {Authorization: `Bearer ${token}`},
      }))
    }
  })

  test('missing SnowLuma credential blocks transport and logs only the safe code', async () => {
    utils.ConfigureRuntime({System: {ONE_BOT_PROVIDER: 'snowluma'}})
    await expect(utils.InitGroupList()).resolves.toBe(false)
    expect(requestSpy).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('获取群列表失败，错误原因：', 'ONEBOT_AUTH_REQUIRED')
  })

  test.each(['GuGua', 'QunGuGua'])('%s uses safe message and recipient encoding', async (method) => {
    jest.useFakeTimers()
    process.env.CHATDACS_ONEBOT_ACCESS_TOKEN = 'mock-env-token'
    utils.ConfigureRuntime({ONE_BOT_PROVIDER: 'snowluma', ONE_BOT_API_URL: 'https://mock.invalid/api', WEB_PORT: 8080})
    utils[method]('123&message=evil#fragment')
    await jest.runAllTimersAsync()
    expect(requestSpy).toHaveBeenCalledTimes(5)
    for (const [url, options] of requestSpy.mock.calls) {
      const parsed = new URL(url)
      expect(parsed.origin).toBe('https://mock.invalid')
      expect(parsed.pathname).toBe(`/api/${method === 'GuGua' ? 'send_private_msg' : 'send_group_msg'}`)
      expect(parsed.hash).toBe('')
      expect(parsed.searchParams.get(method === 'GuGua' ? 'user_id' : 'group_id')).toBe('123&message=evil#fragment')
      expect(parsed.searchParams.getAll('message')).toHaveLength(1)
      expect(options.headers.Authorization).toBe('Bearer mock-env-token')
    }
  })

  test('automatic group re-enable uses the same authenticated safe URL builder', async () => {
    jest.useFakeTimers()
    process.env.CHATDACS_ONEBOT_ACCESS_TOKEN = 'mock-env-token'
    const groupId = '123&message=other'
    require('./model/qqGroupModel').findAll.mockResolvedValueOnce([{groupId}])
    const enableSpy = jest.spyOn(utils, 'EnableGroupService').mockResolvedValue(undefined)
    try {
      utils.ConfigureRuntime({System: {ONE_BOT_PROVIDER: 'snowluma', ONE_BOT_API_URL: 'https://mock.invalid/api/'}})
      await utils.AutoEnableQQGroupService()
      await jest.runAllTimersAsync()
      const [url, options] = requestSpy.mock.calls[0]
      expect(new URL(url).pathname).toBe('/api/send_group_msg')
      expect(new URL(url).searchParams.get('group_id')).toBe(groupId)
      expect(new URL(url).searchParams.getAll('message')).toEqual(['害害嗨，小夜自动张菊了'])
      expect(options.headers.Authorization).toBe('Bearer mock-env-token')
      expect(enableSpy).toHaveBeenCalledWith(groupId)
    } finally { enableSpy.mockRestore() }
  })

  test('implicit local config reads metadata only, and cannot replace explicit runtime config', async () => {
    let finishRead
    fs.readFile.mockImplementationOnce((_path, _encoding, callback) => { finishRead = callback })
    let isolated
    jest.isolateModules(() => { isolated = require('./utils') })
    expect(fs.readFileSync).not.toHaveBeenCalled()
    isolated.ConfigureRuntime({WEB_PORT: 9876, ONE_BOT_PROVIDER: 'snowluma'})
    finishRead(null, 'System:\n  WEB_PORT: 1234\n  ONE_BOT_PROVIDER: napcat\n')
    await Promise.resolve()
    expect(isolated.PluginAnswerToGoCqhttpStyle({type: 'picture', content: {file: '/mock.png'}}))
      .toBe('[CQ:image,file=http://127.0.0.1:9876/mock.png]')
    expect(fs.readFileSync).not.toHaveBeenCalled()
  })

  test('implicit local SnowLuma config applies without reading credentials', async () => {
    fs.readFile.mockImplementationOnce((_path, _encoding, callback) => callback(null,
      'System:\n  WEB_PORT: 3456\n  ONE_BOT_PROVIDER: snowluma\n  ONE_BOT_CREDENTIALS_FILE: implicit.mock\n'))
    let isolated
    jest.isolateModules(() => { isolated = require('./utils') })
    await Promise.resolve()
    expect(isolated.PluginAnswerToGoCqhttpStyle({type: 'picture', content: {file: '/mock.png'}}))
      .toBe('[CQ:image,file=http://127.0.0.1:3456/mock.png]')
    expect(fs.readFileSync).not.toHaveBeenCalled()
  })
})

describe('PluginAnswerToWebStyle', () => {
  test('should format a text answer', () => {
    const answer = {type: 'text', content: 'hello'}
    expect(utils.PluginAnswerToWebStyle(answer)).toBe('hello')
  })

  test('should format a picture answer', () => {
    const answer = {type: 'picture', content: {file: '/img.png'}}
    expect(utils.PluginAnswerToWebStyle(answer)).toBe('img[/img.png]')
  })

  test('should format an audio answer', () => {
    const answer = {type: 'audio', content: {file: '/audio.mp3', filename: 'song.mp3'}}
    expect(utils.PluginAnswerToWebStyle(answer)).toBe('audio[/audio.mp3](song.mp3)')
  })

  test('should format a video answer', () => {
    const answer = {type: 'video', content: {file: '/video.mp4', filename: 'movie.mp4'}}
    expect(utils.PluginAnswerToWebStyle(answer)).toBe('video[/video.mp4](movie.mp4)')
  })

  test('should format a file answer', () => {
    const answer = {type: 'file', content: {file: '/file.zip', filename: 'archive.zip'}}
    expect(utils.PluginAnswerToWebStyle(answer)).toBe('file(/file.zip)[archive.zip]')
  })
})

describe('PluginAnswerToGoCqhttpStyle', () => {
  beforeAll(() => {
    utils._setTestConfig({WEB_PORT: 8080})
  })

  test('should format a text answer', () => {
    const answer = {type: 'text', content: 'hello'}
    expect(utils.PluginAnswerToGoCqhttpStyle(answer)).toBe('hello')
  })

  test('should format a local picture answer', () => {
    const answer = {type: 'picture', content: {file: '/img.png'}}
    expect(utils.PluginAnswerToGoCqhttpStyle(answer)).toBe('[CQ:image,file=http://127.0.0.1:8080/img.png]')
  })

  test('should format a remote picture answer', () => {
    const answer = {type: 'picture', content: {file: 'http://example.com/img.png'}}
    expect(utils.PluginAnswerToGoCqhttpStyle(answer)).toBe('[CQ:image,file=http://example.com/img.png]')
  })

  test('should format a direct picture answer', () => {
    const answer = {type: 'directPicture', content: {file: path.join('static', 'images', 'img.png')}}
    expect(utils.PluginAnswerToGoCqhttpStyle(answer)).toMatch(/^\[CQ:image,file=file:\/\/\/.+static\/images\/img\.png\]$/)
  })

  test('should format an audio answer', () => {
    const answer = {type: 'audio', content: {file: '/audio.mp3'}}
    expect(utils.PluginAnswerToGoCqhttpStyle(answer)).toBe('[CQ:record,file=http://127.0.0.1:8080/audio.mp3]')
  })
})

describe('PluginAnswerToQQGuildStyle', () => {
  beforeAll(() => {
    utils._setTestConfig({WEB_PORT: 8080})
  })

  test('should format a picture answer', () => {
    const answer = {type: 'picture', content: {file: '/img.png'}}
    expect(utils.PluginAnswerToQQGuildStyle(answer)).toEqual({image: 'http://127.0.0.1:8080/img.png'})
  })

  test('should format a direct picture answer', () => {
    const answer = {type: 'directPicture', content: {file: './static/img.png'}}
    expect(utils.PluginAnswerToQQGuildStyle(answer)).toEqual({image: 'http://127.0.0.1:8080/img.png'})
  })

  test('should format an audio answer', () => {
    const answer = {type: 'audio', content: {file: '/audio.mp3', filename: 'song.mp3'}}
    expect(utils.PluginAnswerToQQGuildStyle(answer)).toEqual({
      text: 'song.mp3',
      audio: 'http://127.0.0.1:8080/audio.mp3',
    })
  })

  test('should format a text answer', () => {
    const answer = {type: 'text', content: 'hello'}
    expect(utils.PluginAnswerToQQGuildStyle(answer)).toEqual({text: 'hello'})
  })
})

describe('PluginAnswerToTelegramStyle', () => {
  test('should format a picture answer', () => {
    const answer = {type: 'picture', content: {file: '/img.png'}}
    expect(utils.PluginAnswerToTelegramStyle(answer)).toEqual({image: './static/img.png'})
  })

  test('should format a direct picture answer', () => {
    const answer = {type: 'directPicture', content: {file: '/img.png'}}
    expect(utils.PluginAnswerToTelegramStyle(answer)).toEqual({image: '/img.png'})
  })

  test('should format an audio answer', () => {
    const answer = {type: 'audio', content: {file: '/audio.mp3', filename: 'song.mp3', duration: 120}}
    expect(utils.PluginAnswerToTelegramStyle(answer)).toEqual({
      text: 'song.mp3',
      audio: './static/audio.mp3',
      duration: 120,
    })
  })

  test('should format a text answer', () => {
    const answer = {type: 'text', content: 'hello'}
    expect(utils.PluginAnswerToTelegramStyle(answer)).toEqual({text: 'hello'})
  })
})
