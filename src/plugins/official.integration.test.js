'use strict'

const path = require('path')
const {Sequelize} = require('sequelize')
const {runMigrations} = require('../core/migrations')
const {createPluginRuntime} = require('./runtime')
const {createConversationPluginStateStore} = require('./conversationState')
const {toMessageContext} = require('../bots/qqOfficial/context')
jest.mock('require.all', () => jest.fn())

describe('official plugin policy and conversation state', () => {
  let db, runtime, legacyGet, legacySet, notify, forbidden
  const logger = {info() {}, warn() {}, error() {}}
  const context = (senderId = 'openid') => toMessageContext({
    kind: 'c2c', senderId, messageId: 'm', content: '/ping',
  }, 'bot')

  beforeEach(async () => {
    db = new Sequelize({dialect: 'sqlite', storage: ':memory:', logging: false})
    await runMigrations({sequelize: db, migrationsDir: path.join(process.cwd(), 'migrations'), logger})
    legacyGet = jest.fn(async () => true)
    legacySet = jest.fn(async () => false)
    notify = jest.fn()
    forbidden = jest.fn()
    require('require.all').mockReturnValue({
      ping: require('../../plugins/ping'), help: require('../../plugins/help'),
      forbidden: {插件名: '禁言', 指令: '^/ban$', execute: forbidden},
      explode: {插件名: 'Error', 指令: '^/explode$', execute: () => { throw new Error('internal-secret') }},
    })
    runtime = createPluginRuntime({
      pluginDir: path.join(process.cwd(), 'plugins'),
      logger,
      dependencies: {logger, config: {}, sendMessageToQQGroup: notify},
      getPluginStatus: legacyGet, setPluginStatus: legacySet,
      conversationState: createConversationPluginStateStore({sequelize: db}),
      officialPluginAllowlist: ['ping', 'help', 'explode'],
    })
    runtime.load()
  })
  afterEach(async () => { jest.restoreAllMocks(); await db.close() })

  test('persists isolated switches without touching the legacy numeric group model', async () => {
    const store = createConversationPluginStateStore({sequelize: db})
    const first = context('a')
    const second = context('b')
    expect(await store.get(first, 'ping')).toBe(true)
    expect(await store.toggle(first, 'ping')).toBe(false)
    expect(await createConversationPluginStateStore({sequelize: db}).get(first, 'ping')).toBe(false)
    expect(await store.get(second, 'ping')).toBe(true)
    const [rows] = await db.query('SELECT * FROM qqGroups')
    expect(rows).toHaveLength(0)
  })

  test('real ping, plugin toggles and help run without touching legacy state', async () => {
    expect(await runtime.execute(context('a'))).toMatchObject({handled: true, content: 'Pong!'})
    await runtime.execute({...context('a'), text: '插件关 连通性测试插件'})
    expect(await runtime.execute(context('a'))).toMatchObject({handled: true, content: expect.stringContaining('已关闭')})
    expect(await runtime.execute(context('b'))).toMatchObject({content: 'Pong!'})
    const help = await runtime.execute({...context(), text: '/help'})
    expect(help.content).toContain('连通性测试插件')
    expect(help.content).not.toContain('QQ群专有功能')
    expect(legacyGet).not.toHaveBeenCalled()
    expect(legacySet).not.toHaveBeenCalled()
  })

  test('blocked plugin commands and toggles never execute or call OneBot', async () => {
    expect(await runtime.execute({...context(), text: '/ban'})).toMatchObject({handled: true, content: '该插件暂不支持官方 QQ 通道'})
    expect(await runtime.execute({...context(), text: '插件开 禁言'})).toMatchObject({handled: true, content: '该插件暂不支持官方 QQ 通道'})
    expect(forbidden).not.toHaveBeenCalled()
    expect(legacyGet).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  test('official plugin errors stay in this channel with no legacy admin notification', async () => {
    expect(await runtime.execute({...context(), text: '/explode'})).toMatchObject({handled: true, content: '插件处理失败，请稍后再试'})
    expect(notify).not.toHaveBeenCalled()
  })

  test('guild DMs share the restricted runtime without sharing official or legacy state', async () => {
    const dm = {...context('same-user'), platform: 'qqGuildDirect'}
    expect(await runtime.execute(dm)).toMatchObject({content: 'Pong!'})
    await runtime.execute({...dm, text: '插件关 连通性测试插件'})
    expect(await runtime.execute(dm)).toMatchObject({content: expect.stringContaining('已关闭')})
    expect(await runtime.execute(context('same-user'))).toMatchObject({content: 'Pong!'})
    expect(await runtime.execute({...dm, text: '/ban'})).toMatchObject({content: '该插件暂不支持官方 QQ 通道'})
    expect(legacyGet).not.toHaveBeenCalled()
    expect(legacySet).not.toHaveBeenCalled()
    expect(forbidden).not.toHaveBeenCalled()
  })
})
