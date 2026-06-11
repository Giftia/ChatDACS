'use strict'

const {createWebSessionRuntime} = require('./session')

function makeSocket(overrides = {}) {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    username: '',
    request: {
      headers: {
        cookie: 'ChatdacsID=test-cid',
      },
    },
    handshake: {
      headers: {},
      address: '::ffff:127.0.0.1',
    },
    ...overrides,
  }
}

function makeRuntime(overrides = {}) {
  const context = {
    io: {
      emit: jest.fn(),
    },
    utils: {
      GetUserData: jest.fn(() => ({
        nickname: '老用户',
        loginTimes: 2,
        updatedAt: '2026-06-11 00:00:00',
      })),
      UpdateLoginTimes: jest.fn(),
      RandomNickname: jest.fn(() => '新用户'),
      AddUser: jest.fn(),
    },
    logger: {
      info: jest.fn(),
      error: jest.fn(),
    },
    constants: {
      WEB_HELP_CONTENT: '帮助内容',
    },
    version: 'ChatDACS smoke',
    ipTranslator: {
      searchIP: jest.fn(() => ({Country: '本机地址'})),
    },
    ...overrides,
  }

  return {
    context,
    runtime: createWebSessionRuntime(context),
  }
}

describe('web session runtime', () => {
  test('requests cookie and stops initialization when ChatdacsID is missing', async () => {
    const {context, runtime} = makeRuntime()
    const socket = makeSocket({request: {headers: {}}})

    const connected = await runtime.handleConnection(socket)

    expect(connected).toBe(false)
    expect(socket.emit).toHaveBeenCalledWith('getCookie')
    expect(socket.emit).toHaveBeenCalledTimes(2)
    expect(context.utils.GetUserData).not.toHaveBeenCalled()
    expect(socket.on).not.toHaveBeenCalled()
    expect(runtime.getOnlineUsers()).toBe(0)
  })

  test('initializes an existing user session and basic socket events', async () => {
    const {context, runtime} = makeRuntime()
    const socket = makeSocket()

    const connected = await runtime.handleConnection(socket)

    expect(connected).toBe(true)
    expect(socket.username).toBe('老用户[来自本机地址]')
    expect(socket.emit).toHaveBeenCalledWith('getCookie')
    expect(socket.emit).toHaveBeenCalledWith('version', 'ChatDACS smoke')
    expect(context.io.emit).toHaveBeenCalledWith('onlineUsers', 1)
    expect(context.utils.GetUserData).toHaveBeenCalledWith('test-cid')
    expect(context.utils.UpdateLoginTimes).toHaveBeenCalledWith('test-cid')
    expect(context.io.emit).toHaveBeenCalledWith(
      'system',
      '欢迎回来，老用户[来自本机地址](test-cid) 。这是你第3次访问。上次访问时间: 2026-06-11 00:00:00',
    )
    expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('typing', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('typingOver', expect.any(Function))
    expect(socket.on).toHaveBeenCalledWith('getSettings', expect.any(Function))
    expect(socket.on).not.toHaveBeenCalledWith('message', expect.any(Function))
    expect(runtime.getOnlineUsers()).toBe(1)
  })

  test('creates a new user and sends web help content', async () => {
    const {context, runtime} = makeRuntime({
      utils: {
        GetUserData: jest.fn(() => ({
          nickname: null,
          loginTimes: null,
          updatedAt: null,
        })),
        UpdateLoginTimes: jest.fn(),
        RandomNickname: jest.fn(() => '随机昵称'),
        AddUser: jest.fn(),
      },
    })
    const socket = makeSocket()

    const connected = await runtime.handleConnection(socket)

    expect(connected).toBe(true)
    expect(socket.username).toBe('随机昵称[来自本机地址]')
    expect(context.utils.RandomNickname).toHaveBeenCalled()
    expect(context.utils.AddUser).toHaveBeenCalledWith('test-cid', '随机昵称')
    expect(context.io.emit).toHaveBeenCalledWith(
      'system',
      '新用户 随机昵称[来自本机地址](test-cid) 已连接。小夜帮你取了一个随机昵称: 随机昵称[来自本机地址]，请前往 更多-设置 来更改昵称',
    )
    expect(socket.emit).toHaveBeenCalledWith('message', {
      CID: '0',
      msg: '帮助内容',
    })
  })

  test.each([new Error('network down'), '', null])(
    'falls back to anonymous nickname when RandomNickname fails or returns empty: %p',
    async (nicknameResult) => {
      const randomNickname =
        nicknameResult instanceof Error ? jest.fn(() => Promise.reject(nicknameResult)) : jest.fn(() => nicknameResult)
      const {context, runtime} = makeRuntime({
        utils: {
          GetUserData: jest.fn(() => ({
            nickname: null,
            loginTimes: null,
            updatedAt: null,
          })),
          UpdateLoginTimes: jest.fn(),
          RandomNickname: randomNickname,
          AddUser: jest.fn(),
        },
      })
      const socket = makeSocket()

      const connected = await runtime.handleConnection(socket)

      expect(connected).toBe(true)
      expect(socket.username).toBe('匿名[来自本机地址]')
      expect(context.utils.AddUser).toHaveBeenCalledWith('test-cid', '匿名')
    },
  )

  test('uses unknown location when IP lookup fails', async () => {
    const {context, runtime} = makeRuntime({
      ipTranslator: {
        searchIP: jest.fn(() => {
          throw new Error('bad ip')
        }),
      },
    })
    const socket = makeSocket()

    await runtime.handleConnection(socket)

    expect(socket.username).toBe('老用户[来自未知归属地]')
    expect(context.logger.error).toHaveBeenCalledWith(expect.stringContaining('获取地理位置失败'))
  })

  test('disconnect decreases online users and broadcasts system message', async () => {
    const {context, runtime} = makeRuntime()
    const socket = makeSocket()

    await runtime.handleConnection(socket)
    const disconnectHandler = socket.on.mock.calls.find(([event]) => event === 'disconnect')[1]
    disconnectHandler()

    expect(runtime.getOnlineUsers()).toBe(0)
    expect(context.io.emit).toHaveBeenCalledWith('onlineUsers', 0)
    expect(context.io.emit).toHaveBeenCalledWith('system', '用户 老用户[来自本机地址] 已断开连接')
  })

  test('typing and settings socket events keep legacy payloads', async () => {
    const {context, runtime} = makeRuntime()
    const socket = makeSocket()

    await runtime.handleConnection(socket)
    const typingHandler = socket.on.mock.calls.find(([event]) => event === 'typing')[1]
    const typingOverHandler = socket.on.mock.calls.find(([event]) => event === 'typingOver')[1]
    const getSettingsHandler = socket.on.mock.calls.find(([event]) => event === 'getSettings')[1]

    typingHandler()
    typingOverHandler()
    getSettingsHandler()

    expect(context.io.emit).toHaveBeenCalledWith('typing', '老用户[来自本机地址] 正在输入...')
    expect(context.io.emit).toHaveBeenCalledWith('typing', '')
    expect(socket.emit).toHaveBeenCalledWith('settings', {
      CID: 'test-cid',
      name: '老用户[来自本机地址]',
    })
  })
})
