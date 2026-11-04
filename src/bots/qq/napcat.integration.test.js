'use strict'

const http = require('http')
const axios = require('axios')

const {probeNapCat} = require('./napcat')
const token = 'synthetic-napcat-integration-token'

describe('NapCat HTTP integration', () => {
  let server
  let apiUrl
  let observed

  beforeAll((done) => {
    observed = []
    server = http.createServer((request, response) => {
      observed.push([request.url, request.headers.authorization])
      if (request.headers.authorization !== `Bearer ${token}`) {
        response.writeHead(401).end()
        return
      }
      if (request.url !== '/get_version_info') {
        response.writeHead(404).end()
        return
      }

      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify({
          status: 'ok',
          retcode: 0,
          data: {
            app_name: 'NapCatQQ',
            app_version: 'integration-test',
            protocol_version: 'v11',
          },
        }),
      )
    })
    server.listen(0, '127.0.0.1', () => {
      apiUrl = `127.0.0.1:${server.address().port}`
      done()
    })
  })

  afterAll((done) => { server.close(done) })

  test('probes a real HTTP endpoint using the production axios client', async () => {
    await expect(probeNapCat({apiUrl, axios, timeoutMs: 1000,
      env: {CHATDACS_ONEBOT_ACCESS_TOKEN: token},
      readFileSync: () => { throw new Error('unexpected credential read') }})).resolves.toEqual(
      expect.objectContaining({
        reachable: true,
        compatible: true,
        appName: 'NapCatQQ',
        protocolVersion: 'v11',
      }),
    )
    expect(observed).toEqual([['/get_version_info', `Bearer ${token}`]])
  })
})
