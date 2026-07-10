jest.mock('canvas', () => ({}))

const path = require('path')
const axios = require('axios').default
const {normalizeRuntimeConfig} = require('../../src/config/runtimeConfig')
const utils = require('./utils.js')

// Set the node environment to test
process.env.NODE_ENV = 'test'

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

    expect(requestSpy).toHaveBeenCalledWith('http://legacy-onebot:6700/get_group_list')
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
