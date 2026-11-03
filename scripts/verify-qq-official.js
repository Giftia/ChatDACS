'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

async function main() {
  const sdk = await import('@tencent-connect/qqbot-nodejs')
  const {startQQOfficial} = require('../src/bots/qqOfficial')
  const {createPluginRuntime} = require('../src/plugins/runtime')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-qq-official-'))
  let adapter
  try {
    fs.copyFileSync(path.join(__dirname, '../plugins/ping.js'), path.join(dir, 'ping.js'))
    const sent = []
    let bot
    class FakeBot {
      constructor(options) {
        this.appId = options.appId
        this.handlers = {}
        this.middlewares = []
        bot = this
      }
      on(event, handler) { this.handlers[event] = handler }
      use(middleware) { this.middlewares.push(middleware) }
      async start() { this.handlers.ready(); await new Promise((resolve) => { this.finish = resolve }) }
      stop() { this.finish?.() }
      async sendText(target, text) { sent.push({target, text}) }
      async sendImage() { throw new Error('unexpected image send') }
      async receive(message) {
        const abort = new AbortController()
        const ctx = {
          bot: this, message, replyTarget: message.replyTarget, log: logger,
          state: {}, signal: abort.signal, stopped: false, receivedAt: Date.now(),
          stop() { this.stopped = true },
          abort() { abort.abort(); this.stopped = true },
        }
        await sdk.runMiddlewareChain([...this.middlewares, (context) => this.handlers.message(context)], ctx)
      }
    }
    const logger = {info() {}, warn() {}, error(message) { throw new Error(message) }}
    const runtime = createPluginRuntime({pluginDir: dir, logger,
      conversationState: {get: async () => true, toggle: async () => false}})
    runtime.load()
    let fallbackCount = 0
    adapter = await startQQOfficial({
      config: {CONNECT_QQ_OFFICIAL_SWITCH: true}, logger,
      getCredentials: () => ({appId: 'offline-test', appSecret: 'fake-not-a-credential'}),
      loadSdk: async () => ({...sdk, QQBot: FakeBot}),
      execute: (context) => runtime.execute(context),
      chatProcess: async (text) => { fallbackCount++; return `小夜收到:${text}` },
    })
    const message = (overrides = {}) => ({
      rawEventType: 'C2C_MESSAGE_CREATE', kind: 'c2c', senderId: 'user', messageId: 'm1',
      content: '/ping', raw: {}, replyTarget: {scope: 'c2c', targetId: 'user', msgId: 'm1'}, ...overrides,
    })
    await bot.receive(message())
    await bot.receive(message())
    assert.equal(sent.length, 1, 'duplicate event executed twice')
    assert.equal(sent[0].text, 'Pong!')
    assert.equal(fallbackCount, 0)
    await bot.receive(message({messageId: 'm2', content: 'hello', replyTarget: {scope: 'c2c', targetId: 'user', msgId: 'm2'}}))
    assert.equal(sent[1].text, '小夜收到:hello')
    await bot.receive(message({kind: 'group', groupOpenid: 'g', messageId: 'm3',
      rawEventType: 'GROUP_MESSAGE_CREATE', replyTarget: {scope: 'group', targetId: 'g', msgId: 'm3'}}))
    assert.equal(sent.length, 2, 'unmentioned group message was answered')
    await bot.receive(message({kind: 'group', groupOpenid: 'g', messageId: 'm4',
      rawEventType: 'GROUP_AT_MESSAGE_CREATE', replyTarget: {scope: 'group', targetId: 'g', msgId: 'm4'}}))
    assert.deepEqual(sent[2], {target: {scope: 'group', targetId: 'g', msgId: 'm4'}, text: 'Pong!'})
    assert.equal(adapter.getState(), 'ready')
    console.log(JSON.stringify({ok: true, sdk: '1.0.5', network: 'disabled', flows: ['c2c-plugin', 'chat-fallback', 'dedup', 'group-mention']}, null, 2))
  } finally {
    await adapter?.stop()
    fs.rmSync(dir, {recursive: true, force: true})
  }
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1 })
module.exports = {main}
