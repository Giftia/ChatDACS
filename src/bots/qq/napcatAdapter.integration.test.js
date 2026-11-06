'use strict'

const http = require('http')
const {createHmac} = require('crypto')
const axios = require('axios')
const express = require('express')

const {StartQQBot} = require('../qq')
const {createOneBotHttpClient} = require('../../platforms/oneBotHttp')
const {captureOneBotRawBody} = require('./webhook')

describe.each(['legacy OneBot', 'snowluma'])('%s to ChatDACS QQ adapter integration', (provider) => {
  const snowluma = provider === 'snowluma'
  const token = 'synthetic-onebot-integration-token'
  const originalToken = process.env.CHATDACS_ONEBOT_ACCESS_TOKEN
  const apiPath = snowluma ? '/api' : ''
  let controller
  let napCatServer
  let chatdacsServer
  let napCatApiUrl
  let chatdacsPort
  const actions = []

  beforeAll(async () => {
    if (snowluma) process.env.CHATDACS_ONEBOT_ACCESS_TOKEN = token
    else delete process.env.CHATDACS_ONEBOT_ACCESS_TOKEN
    napCatServer = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1')
      if (snowluma && (request.headers.authorization !== `Bearer ${token}` || !url.pathname.startsWith('/api/'))) {
        response.writeHead(401).end()
        return
      }
      const action = url.pathname.slice(apiPath.length + 1)
      actions.push({action, params: Object.fromEntries(url.searchParams)})
      response.setHeader('content-type', 'application/json')

      if (action === 'get_login_info') {
        response.end(JSON.stringify({status: 'ok', retcode: 0, data: {user_id: 10000}}))
        return
      }
      if (action === 'get_status') {
        response.end(JSON.stringify({status: 'ok', retcode: 0, data: {online: true, good: true}}))
        return
      }
      if (action === 'get_group_info') {
        response.end(JSON.stringify({status: 'ok', data: {group_name: 'Integration Group'}}))
        return
      }

      response.end(JSON.stringify({status: 'ok', retcode: 0, data: {message_id: 1}}))
    })
    await listen(napCatServer)
    napCatApiUrl = `127.0.0.1:${napCatServer.address().port}${apiPath}`

    const app = express()
    app.use(express.json({verify: captureOneBotRawBody}))
    const utils = {
      InitGroupList: jest.fn().mockResolvedValue(true),
      GetGroupServiceSwitch: jest.fn().mockResolvedValue(true),
      PluginAnswerToGoCqhttpStyle: jest.fn((answer) => answer.content),
    }

    const config = {
        ONE_BOT_API_URL: napCatApiUrl,
        ONE_BOT_ANTI_POST_API: '/bot',
        QQBOT_ADMIN_LIST: [],
        QQBOT_PRIVATE_CHAT_SWITCH: snowluma,
        QQBOT_FUDU_PROBABILITY: 0,
        QQBOT_REPLY_PROBABILITY: 0,
        QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH: false,
        ...(snowluma ? {ONE_BOT_PROVIDER: 'snowluma', ONE_BOT_SELF_ID: '10000'} : {}),
    }
    controller = await StartQQBot({
      config,
      ...(snowluma ? {conversation: {execute: async () => ({handled: true, type: 'text', content: 'Pong!'})}} : {}),
      ecYWenDa: jest.fn(),
      processExecute: jest.fn().mockResolvedValue({type: 'text', content: 'Pong!'}),
      chatProcess: jest.fn().mockResolvedValue('unused'),
      logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
      utils,
      app,
      io: {emit: jest.fn()},
      plugins: {},
      axios: createOneBotHttpClient({config, axios}),
      request: jest.fn(),
    })

    chatdacsServer = http.createServer(app)
    await listen(chatdacsServer)
    chatdacsPort = chatdacsServer.address().port
  })

  afterAll(async () => {
    if (originalToken === undefined) delete process.env.CHATDACS_ONEBOT_ACCESS_TOKEN
    else process.env.CHATDACS_ONEBOT_ACCESS_TOKEN = originalToken
    await controller?.stop()
    await Promise.all([close(chatdacsServer), close(napCatServer)])
  })

  function post(event) {
    const body = JSON.stringify(event)
    const headers = {'Content-Type': 'application/json'}
    if (snowluma) headers['X-Signature'] = `sha1=${createHmac('sha1', token).update(body).digest('hex')}`
    return axios.post(`http://127.0.0.1:${chatdacsPort}/bot`, body, {headers, validateStatus: () => true})
  }

  test('acknowledges a group event and sends the plugin reply through OneBot HTTP', async () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.99)
    try {
      const response = await post({
          post_type: 'message',
          message_type: 'group',
          sub_type: 'normal',
          self_id: 10000,
          user_id: 20000,
          group_id: 30000,
          message: '/ping',
          sender: {nickname: 'Tester'},
      })

      expect(response.status).toBe(204)
      await waitFor(() => actions.some((item) => item.action === 'send_group_msg'))
      expect(actions).toEqual(
        expect.arrayContaining([
          {action: 'get_group_info', params: {group_id: '30000', no_cache: '1'}},
          {action: 'send_group_msg', params: {group_id: '30000', message: 'Pong!'}},
        ]),
      )
    } finally {
      random.mockRestore()
    }
  })

  if (snowluma) test('acks a signed private event and sends through the authenticated API prefix', async () => {
    const response = await post({post_type: 'message', message_type: 'private', sub_type: 'friend',
      self_id: 10000, user_id: 20000, message_id: 5, message: '/ping', sender: {nickname: 'Tester'}})
    expect(response.status).toBe(204)
    await waitFor(() => actions.some((item) => item.action === 'send_private_msg'))
    expect(actions).toContainEqual({action: 'send_private_msg', params: {user_id: '20000', message: 'Pong!'}})
  })
})

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
}

function close(server) {
  if (!server?.listening) return Promise.resolve()
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

async function waitFor(predicate, timeoutMs = 1000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('Timed out waiting for OneBot action')
}
