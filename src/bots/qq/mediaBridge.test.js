const {handleQQMediaBridge} = require('./mediaBridge')

function makeContext(overrides = {}) {
  return {
    event: {message: 'hello'},
    config: {QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH: true},
    constants: {
      isImage_reg: /\[CQ:image,file/,
      img_url_reg: /https(.*term=3)/,
      isVideo_reg: /\[CQ:video,file:/,
      video_url_reg: /http(.*term:unknow)/,
    },
    utils: {
      SaveQQimg: jest.fn(() => Promise.resolve('/saved.png')),
    },
    io: {
      emit: jest.fn(),
    },
    logger: {
      error: jest.fn(),
    },
    ...overrides,
  }
}

describe('QQ media bridge', () => {
  test('forwards QQ images to web when enabled', async () => {
    const context = makeContext({
      event: {message: '[CQ:image,file=1,url=https://example.com/a.png?term=3]'},
    })

    expect(handleQQMediaBridge(context)).toBe(true)
    await Promise.resolve()

    expect(context.utils.SaveQQimg).toHaveBeenCalled()
    expect(context.io.emit).toHaveBeenCalledWith('qqImage', '/saved.png')
  })

  test('forwards QQ videos to web', () => {
    const context = makeContext({
      event: {message: '[CQ:video,file:1,url=http://example.com/a.mp4?term:unknow]'},
    })

    expect(handleQQMediaBridge(context)).toBe(true)
    expect(context.io.emit).toHaveBeenCalledWith('qqVideo', {
      file: 'http://example.com/a.mp4?term:unknow',
      filename: 'qq视频',
    })
  })

  test('ignores non-media messages', () => {
    const context = makeContext()

    expect(handleQQMediaBridge(context)).toBe(false)
    expect(context.io.emit).not.toHaveBeenCalled()
  })
})
