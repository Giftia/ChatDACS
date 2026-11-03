'use strict'

const {
  WEB_GROUP_ID,
  createWebMessageHandler,
  emitWebBotMessage,
  getChatdacsId,
  sanitizeWebMessage,
} = require('./messageHandler')

function makeSocket(overrides = {}) {
  return {
    username: '测试用户',
    request: {
      headers: {
        cookie: 'ChatdacsID=test-cid',
      },
    },
    ...overrides,
  }
}

function makeContext(overrides = {}) {
  return {
    io: {
      emit: jest.fn(),
    },
    utils: {
      AddMessage: jest.fn(),
      PluginAnswerToWebStyle: jest.fn((reply) => reply.content ?? reply),
    },
    logger: {
      info: jest.fn(),
    },
    chatProcess: jest.fn(() => ''),
    processExecute: jest.fn(() => ''),
    globalConfig: {
      CHAT_SWITCH: true,
    },
    ...overrides,
  }
}

describe('web message handler', () => {
  const hash = '0123456789abcdef0123456789abcdef'
  test.each([
    `img[/uploads/${hash}.PNG]`,
    `file(/uploads/${hash}.wav)[中英 Song.wav]`,
    `file(/uploads/${hash}.mp4)[movie.mp4]`,
    `file(/uploads/${hash}.txt)[notes.txt]`,
    ` img[/uploads/${hash}.png]\nfile(/uploads/${hash}.zip)[archive.zip] `,
  ])('upload-only message is recorded and broadcast exactly once without plugin or model requests: %s', async (msg) => {
    const context = makeContext()
    await createWebMessageHandler(context)({socket: makeSocket(), msgIn: {msg}})
    expect(context.utils.AddMessage).toHaveBeenCalledWith('test-cid', msg)
    expect(context.io.emit).toHaveBeenCalledTimes(1)
    expect(context.io.emit).toHaveBeenCalledWith('message', {CID: 'test-cid', name: '测试用户', msg})
    expect(context.processExecute).not.toHaveBeenCalled()
    expect(context.chatProcess).not.toHaveBeenCalled()
  })

  test.each([
    `请分析 file(/uploads/${hash}.wav)[song.wav]`,
    `file(https://example.invalid/${hash}.wav)[song.wav]`,
    'file(/uploads/not-a-generated-id.wav)[song.wav]',
    `file(/uploads/${hash}.wav?x=1)[song.wav]`,
    `file(/uploads/${hash}.wav)[name(with markup).wav]`,
    `img[/uploads/${hash}.txt]`,
    `audio[/uploads/${hash}.wav]`,
  ])('mixed, remote or noncanonical markup retains normal plugin/chat behavior: %s', async (msg) => {
    const context = makeContext()
    await createWebMessageHandler(context)({socket: makeSocket(), msgIn: {msg}})
    expect(context.processExecute).toHaveBeenCalledTimes(1)
    expect(context.chatProcess).toHaveBeenCalledWith(msg)
  })
  test('sanitizes web message text before persistence and broadcast', async () => {
    const context = makeContext()
    const handleMessage = createWebMessageHandler(context)

    await handleMessage({
      socket: makeSocket(),
      msgIn: {msg: "清洗 <script>alert('x')</script> end"},
    })

    const sanitized = '清洗 scriptalert(x)/script end'

    expect(sanitizeWebMessage("清洗 <script>alert('x')</script> end")).toBe(sanitized)
    expect(context.utils.AddMessage).toHaveBeenCalledWith('test-cid', sanitized)
    expect(context.logger.info.mock.calls).toEqual([['WEB_MESSAGE_RECEIVED']])
    expect(context.io.emit).toHaveBeenCalledWith('message', {
      CID: 'test-cid',
      name: '测试用户',
      msg: sanitized,
    })
  })

  test('keeps legacy processExecute arguments for web plugin execution', async () => {
    const context = makeContext()
    const handleMessage = createWebMessageHandler(context)

    await handleMessage({
      socket: makeSocket(),
      msgIn: {msg: '/ping'},
    })

    expect(context.processExecute).toHaveBeenCalledWith('/ping', 'test-cid', '测试用户', WEB_GROUP_ID, '', {
      type: 'web',
    })
  })

  test('formats and emits plugin replies through the existing web adapter', async () => {
    const pluginReply = {type: 'text', content: 'Pong!'}
    const context = makeContext({
      processExecute: jest.fn(() => pluginReply),
      utils: {
        AddMessage: jest.fn(),
        PluginAnswerToWebStyle: jest.fn(() => 'Pong!'),
      },
    })
    const handleMessage = createWebMessageHandler(context)

    await handleMessage({
      socket: makeSocket(),
      msgIn: {msg: '/ping'},
    })

    expect(context.utils.PluginAnswerToWebStyle).toHaveBeenCalledWith(pluginReply)
    expect(context.io.emit).toHaveBeenCalledWith('message', {
      CID: '0',
      msg: 'Pong!',
    })
    expect(context.chatProcess).not.toHaveBeenCalled()
  })

  test.each([{handled: true, type: 'text', content: ''}, {type: 'text', content: ''}])(
    'handled silent plugin reply prevents chat fallback: %p', async (pluginReply) => {
      const context = makeContext({processExecute: jest.fn(() => pluginReply)})
      await createWebMessageHandler(context)({socket: makeSocket(), msgIn: {msg: '/silent'}})
      expect(context.chatProcess).not.toHaveBeenCalled()
      expect(context.io.emit).toHaveBeenCalledTimes(1)
    },
  )

  test('explicit unhandled result falls through without emitting plugin content', async () => {
    const context = makeContext({processExecute: jest.fn(() => ({handled: false, content: 'not a reply'})),
      chatProcess: jest.fn(() => 'fallback')})
    await createWebMessageHandler(context)({socket: makeSocket(), msgIn: {msg: 'hello'}})
    expect(context.utils.PluginAnswerToWebStyle).not.toHaveBeenCalled()
    expect(context.chatProcess).toHaveBeenCalledWith('hello')
    expect(context.io.emit).toHaveBeenCalledTimes(2)
  })

  test('falls through to chatProcess when plugins do not handle the message', async () => {
    const context = makeContext({
      processExecute: jest.fn(() => ''),
      chatProcess: jest.fn(() => '聊天回复'),
    })
    const handleMessage = createWebMessageHandler(context)

    await handleMessage({
      socket: makeSocket(),
      msgIn: {msg: '你好'},
    })

    expect(context.chatProcess).toHaveBeenCalledWith('你好')
    expect(context.io.emit).toHaveBeenCalledWith('message', {
      CID: '0',
      msg: '聊天回复',
    })
  })

  test.each([undefined, null, '', {type: 'text', content: '对象不是聊天回复'}])(
    'does not emit invalid chat replies as robot messages: %p',
    async (chatReply) => {
      const context = makeContext({
        chatProcess: jest.fn(() => chatReply),
      })
      const handleMessage = createWebMessageHandler(context)

      await handleMessage({
        socket: makeSocket(),
        msgIn: {msg: '随便聊聊'},
      })

      expect(context.io.emit).toHaveBeenCalledTimes(1)
      expect(context.io.emit).not.toHaveBeenCalledWith('message', {
        CID: '0',
        msg: expect.anything(),
      })
    },
  )

  test('skips chatProcess when chat switch is disabled', async () => {
    const context = makeContext({
      globalConfig: {
        CHAT_SWITCH: false,
      },
    })
    const handleMessage = createWebMessageHandler(context)

    await handleMessage({
      socket: makeSocket(),
      msgIn: {msg: '你好'},
    })

    expect(context.chatProcess).not.toHaveBeenCalled()
  })

  test('reads ChatDACS id from socket cookie and falls back to zero', () => {
    expect(getChatdacsId(makeSocket())).toBe('test-cid')
    expect(getChatdacsId(makeSocket({request: {headers: {}}}))).toBe(0)
  })

  test('emits only non-empty string bot messages', () => {
    const io = {emit: jest.fn()}

    expect(emitWebBotMessage(io, undefined)).toBe(false)
    expect(emitWebBotMessage(io, null)).toBe(false)
    expect(emitWebBotMessage(io, '')).toBe(false)
    expect(emitWebBotMessage(io, {type: 'text', content: 'not web text'})).toBe(false)
    expect(emitWebBotMessage(io, 'ok')).toBe(true)

    expect(io.emit).toHaveBeenCalledTimes(1)
    expect(io.emit).toHaveBeenCalledWith('message', {CID: '0', msg: 'ok'})
  })
})
