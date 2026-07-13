'use strict'

const http = require('http')
const axios = require('axios')
const express = require('express')

const {StartQQBot} = require('../qq')

describe('NapCat to ChatDACS QQ adapter integration', () => {
  let napCatServer
  let chatdacsServer
  let napCatApiUrl
  let chatdacsPort
  const actions = []

  beforeAll(async () => {
    napCatServer = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1')
      actions.push({action: url.pathname.slice(1), params: Object.fromEntries(url.searchParams)})
      response.setHeader('content-type', 'application/json')

      if (url.pathname === '/get_group_info') {
        response.end(JSON.stringify({status: 'ok', data: {group_name: 'Integration Group'}}))
        return
      }

      response.end(JSON.stringify({status: 'ok', retcode: 0, data: {message_id: 1}}))
    })
    await listen(napCatServer)
    napCatApiUrl = `127.0.0.1:${napCatServer.address().port}`

    const app = express()
    app.use(express.json())
    const utils = {
      InitGroupList: jest.fn().mockResolvedValue(true),
      GetGroupServiceSwitch: jest.fn().mockResolvedValue(true),
      PluginAnswerToGoCqhttpStyle: jest.fn((answer) => answer.content),
    }

    await StartQQBot({
      config: {
        ONE_BOT_API_URL: napCatApiUrl,
        ONE_BOT_ANTI_POST_API: '/bot',
        QQBOT_ADMIN_LIST: [],
        QQBOT_PRIVATE_CHAT_SWITCH: false,
        QQBOT_FUDU_PROBABILITY: 0,
        QQBOT_REPLY_PROBABILITY: 0,
        QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH: false,
      },
      ecYWenDa: jest.fn(),
      processExecute: jest.fn().mockResolvedValue({type: 'text', content: 'Pong!'}),
      chatProcess: jest.fn().mockResolvedValue('unused'),
      logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
      utils,
      app,
      io: {emit: jest.fn()},
      plugins: {},
      axios,
      request: jest.fn(),
    })

    chatdacsServer = http.createServer(app)
    await listen(chatdacsServer)
    chatdacsPort = chatdacsServer.address().port
  })

  afterAll(async () => {
    await Promise.all([close(chatdacsServer), close(napCatServer)])
  })

  test('acknowledges a group event and sends the plugin reply through OneBot HTTP', async () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.99)
    try {
      const response = await axios.post(
        `http://127.0.0.1:${chatdacsPort}/bot`,
        {
          post_type: 'message',
          message_type: 'group',
          sub_type: 'normal',
          self_id: 10000,
          user_id: 20000,
          group_id: 30000,
          message: '/ping',
          sender: {nickname: 'Tester'},
        },
        {validateStatus: () => true},
      )

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
