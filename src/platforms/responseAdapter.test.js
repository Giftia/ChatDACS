const path = require('path')

const {
  formatPluginAnswer,
  formatOneBotAnswer,
  formatQQGuildAnswer,
  formatTelegramAnswer,
  formatWebAnswer,
} = require('./responseAdapter')

describe('response adapter', () => {
  test('formats web plugin responses', () => {
    expect(formatWebAnswer({type: 'text', content: 'hello'})).toBe('hello')
    expect(formatWebAnswer({type: 'picture', content: {file: '/img.png'}})).toBe('img[/img.png]')
    expect(formatWebAnswer({type: 'audio', content: {file: '/audio.mp3', filename: 'song.mp3'}})).toBe(
      'audio[/audio.mp3](song.mp3)',
    )
  })

  test('formats OneBot plugin responses', () => {
    expect(formatOneBotAnswer({type: 'text', content: 'hello'}, {webPort: 8080})).toBe('hello')
    expect(formatOneBotAnswer({type: 'picture', content: {file: '/img.png'}}, {webPort: 8080})).toBe(
      '[CQ:image,file=http://127.0.0.1:8080/img.png]',
    )
    expect(formatOneBotAnswer({type: 'picture', content: {file: 'https://example.com/img.png'}}, {webPort: 8080})).toBe(
      '[CQ:image,file=https://example.com/img.png]',
    )
    expect(
      formatOneBotAnswer({type: 'directPicture', content: {file: path.join('static', 'images', 'img.png')}}, {webPort: 8080}),
    ).toMatch(/^\[CQ:image,file=file:\/\/\/.+static\/images\/img\.png\]$/)
  })

  test('formats QQ Guild plugin responses', () => {
    expect(formatQQGuildAnswer({type: 'picture', content: {file: '/img.png'}}, {webPort: 8080})).toEqual({
      image: 'http://127.0.0.1:8080/img.png',
    })
    expect(formatQQGuildAnswer({type: 'audio', content: {file: '/audio.mp3', filename: 'song.mp3'}}, {webPort: 8080})).toEqual({
      text: 'song.mp3',
      audio: 'http://127.0.0.1:8080/audio.mp3',
    })
  })

  test('formats Telegram plugin responses', () => {
    expect(formatTelegramAnswer({type: 'picture', content: {file: '/img.png'}})).toEqual({image: './static/img.png'})
    expect(formatTelegramAnswer({type: 'directPicture', content: {file: '/img.png'}})).toEqual({image: '/img.png'})
    expect(formatTelegramAnswer({type: 'audio', content: {file: '/audio.mp3', filename: 'song.mp3', duration: 120}})).toEqual({
      text: 'song.mp3',
      audio: './static/audio.mp3',
      duration: 120,
    })
  })

  test('routes by platform and rejects unsupported platforms', () => {
    expect(formatPluginAnswer('web', {type: 'text', content: 'hello'})).toBe('hello')
    expect(formatPluginAnswer('qq', {type: 'text', content: 'hello'}, {webPort: 8080})).toBe('hello')
    expect(formatPluginAnswer('qqGuild', {type: 'text', content: 'hello'}, {webPort: 8080})).toEqual({text: 'hello'})
    expect(formatPluginAnswer('telegram', {type: 'text', content: 'hello'})).toEqual({text: 'hello'})
    expect(() => formatPluginAnswer('unknown', {type: 'text', content: 'hello'})).toThrow('Unsupported response platform')
  })
})
