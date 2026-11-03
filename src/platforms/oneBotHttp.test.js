'use strict'

const http = require('http')
const realAxios = require('axios')
const {readOneBotAccessToken, createOneBotHttpClient} = require('./oneBotHttp')

const secret = 'unit-test-secret'
const missing = () => { throw Object.assign(new Error('private file error'), {code: 'ENOENT'}) }
const config = {ONE_BOT_API_URL: 'http://onebot.invalid:5700/api', ONE_BOT_PROVIDER: 'snowluma'}

function setup(overrides = {}) {
  const response = {status: 200, data: {status: 'ok', retcode: 0}}
  const axios = Object.assign(jest.fn().mockResolvedValue(response), {
    get: jest.fn().mockResolvedValue(response), post: jest.fn().mockResolvedValue(response),
    request: jest.fn().mockResolvedValue(response), marker: {},
  })
  return {axios, response, client: createOneBotHttpClient({
    axios, config, env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}, readFileSync: missing, ...overrides,
  })}
}

describe('OneBot credentials', () => {
  test('environment wins without reading files', () => {
    const readFileSync = jest.fn()
    expect(readOneBotAccessToken({env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}, readFileSync})).toBe(secret)
    expect(readFileSync).not.toHaveBeenCalled()
  })

  test('reads only the supplied/default credentials file', () => {
    const readFileSync = jest.fn(() => Buffer.from(JSON.stringify({accessToken: secret})))
    expect(readOneBotAccessToken({env: {}, readFileSync})).toBe(secret)
    expect(readFileSync).toHaveBeenCalledWith('config/onebot.credentials.json')
    readOneBotAccessToken({config: {ONE_BOT_CREDENTIALS_FILE: 'mock.json'}, env: {}, readFileSync})
    expect(readFileSync).toHaveBeenLastCalledWith('mock.json')
  })

  test('only missing files in legacy mode allow no token', () => {
    expect(readOneBotAccessToken({env: {}, readFileSync: missing})).toBe('')
    expect(() => readOneBotAccessToken({config, env: {}, readFileSync: missing})).toThrow('ONEBOT_AUTH_REQUIRED')
    expect(() => readOneBotAccessToken({env: {}, readFileSync: () => { throw new Error(secret) }}))
      .toThrow('ONEBOT_AUTH_REQUIRED')
  })

  test.each(['', undefined, null, 42, 'bad\r\nkey', 'key\n', 'key\r', 'has space', 'x'.repeat(4097)])('rejects explicit invalid tokens %#', (token) => {
    expect(() => readOneBotAccessToken({env: {CHATDACS_ONEBOT_ACCESS_TOKEN: token}, readFileSync: missing}))
      .toThrow('ONEBOT_AUTH_REQUIRED')
  })

  test.each(['{bad', '{}', JSON.stringify({accessToken: ''}), ' '.repeat(65537)])('rejects invalid credential files %#', (body) => {
    expect(() => readOneBotAccessToken({env: {}, readFileSync: () => Buffer.from(body)})).toThrow('ONEBOT_AUTH_REQUIRED')
  })
})

describe('OneBot HTTP proxy', () => {
  test('is lazy and preserves unrelated properties', () => {
    const readFileSync = jest.fn(missing)
    const {client, axios} = setup({env: {}, readFileSync})
    expect(client.marker).toBe(axios.marker)
    expect(readFileSync).not.toHaveBeenCalled()
  })

  test.each(['get', 'post', 'request', 'callable', 'callableUrl'])('authenticates %s without mutating options', async (method) => {
    const {client, axios, response} = setup()
    const options = {headers: {authorization: 'old', Other: 'value'}, timeout: 25, maxRedirects: 8}
    let result
    if (method === 'get') result = await client.get(`${config.ONE_BOT_API_URL}/action`, options)
    if (method === 'post') result = await client.post(`${config.ONE_BOT_API_URL}/action`, {x: 1}, options)
    if (method === 'request') result = await client.request({...options, url: `${config.ONE_BOT_API_URL}/action`})
    if (method === 'callable') result = await client({...options, url: `${config.ONE_BOT_API_URL}/action`})
    if (method === 'callableUrl') result = await client(`${config.ONE_BOT_API_URL}/action`, options)
    expect(result).toBe(response)
    const fn = method.startsWith('callable') ? axios : axios[method]
    const call = fn.mock.calls[0]
    const sent = typeof call[0] === 'object' ? call[0] : call.at(-1)
    expect(sent).toMatchObject({headers: {Authorization: `Bearer ${secret}`, Other: 'value'}, maxRedirects: 0, timeout: 25})
    expect(sent.signal).toBeInstanceOf(AbortSignal)
    expect(options).toEqual({headers: {authorization: 'old', Other: 'value'}, timeout: 25, maxRedirects: 8})
  })

  test('relative requests follow Axios baseURL joining semantics', async () => {
    const {client, axios} = setup()
    await client.get('/action', {baseURL: config.ONE_BOT_API_URL})
    expect(axios.get.mock.calls[0][0]).toBe(`${config.ONE_BOT_API_URL}/action`)
    expect(axios.get.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${secret}`)
    const options = {baseURL: 'http://outside.invalid/api'}
    await client.get('/action', options)
    expect(axios.get).toHaveBeenLastCalledWith('/action', options)
  })

  test('SnowLuma request with missing token never calls Axios', async () => {
    const {client, axios} = setup({env: {}})
    await expect(client.get(`${config.ONE_BOT_API_URL}/action`)).rejects.toMatchObject({code: 'ONEBOT_AUTH_REQUIRED'})
    expect(axios.get).not.toHaveBeenCalled()
  })

  test.each(['http://other.invalid/api/action', 'http://onebot.invalid:5700/api-similar/action',
    'http://onebot.invalid:5700/apis/action', 'http://onebot.invalid:5701/api/action'])('passes external request unchanged: %s', async (url) => {
    const readFileSync = jest.fn(missing)
    const {client, axios} = setup({env: {}, readFileSync})
    const options = {headers: {Other: 'untouched'}}
    await client.get(url, options)
    expect(axios.get).toHaveBeenCalledWith(url, options)
    expect(axios.get.mock.calls[0][1]).toBe(options)
    expect(readFileSync).not.toHaveBeenCalled()
  })

  test.each(['onebot.invalid:5700/api', 'http://onebot.invalid:5700/api', 'https://onebot.invalid/api'])('accepts base %s', async (base) => {
    const {client, axios} = setup({config: {...config, ONE_BOT_API_URL: base}})
    await client.get(`${base.includes('://') ? base : `http://${base}`}/action`)
    expect(axios.get.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${secret}`)
  })

  test.each(['http://user:pass@host/api', 'http://host/api?q=1', 'http://host/api#x', 'ftp://host/api', '', 'http://'])('rejects unsafe base %s', async (base) => {
    const {client, axios} = setup({config: {...config, ONE_BOT_API_URL: base}})
    await expect(client.get('http://other.invalid/action')).rejects.toMatchObject({code: 'ONEBOT_REQUEST_FAILED'})
    expect(axios.get).not.toHaveBeenCalled()
  })

  test.each(['get', 'post', 'request', 'callable', 'callableUrl'])('explicitly disabled invalid OneBot permits unauthenticated absolute external %s', async (method) => {
    const readFileSync = jest.fn(missing)
    const {client, axios, response} = setup({config: {CONNECT_ONE_BOT_SWITCH: false, ONE_BOT_API_URL: ''}, env: {}, readFileSync})
    const url = 'https://external.invalid/service'
    const options = {headers: {Accept: 'application/json'}, timeout: 4321}
    let result
    if (method === 'get') result = await client.get(url, options)
    if (method === 'post') result = await client.post(url, {hello: 'world'}, options)
    if (method === 'request') result = await client.request({...options, url})
    if (method === 'callable') result = await client({...options, url})
    if (method === 'callableUrl') result = await client(url, options)
    expect(result).toBe(response)
    const call = (method.startsWith('callable') ? axios : axios[method]).mock.calls[0]
    if (['get', 'post', 'callableUrl'].includes(method)) {
      expect(call[0]).toBe(url)
      expect(call.at(-1)).toBe(options)
    } else expect(call[0]).toEqual({...options, url})
    expect(readFileSync).not.toHaveBeenCalled()
  })

  test.each([
    {CONNECT_ONE_BOT_SWITCH: true}, {GO_CQHTTP_SWITCH: true},
    {CONNECT_ONE_BOT_SWITCH: false, GO_CQHTTP_SWITCH: true},
    {CONNECT_ONE_BOT_SWITCH: false, CONNECT_GO_CQHTTP_SWITCH: true}, {},
  ])('invalid enabled or unspecified service remains fail-closed: %j', async (switches) => {
    const {client, axios} = setup({config: {...switches, ONE_BOT_API_URL: ''}, env: {}})
    await expect(client.get('https://external.invalid/service')).rejects.toMatchObject({code: 'ONEBOT_REQUEST_FAILED'})
    expect(axios.get).not.toHaveBeenCalled()
  })

  test.each([undefined, '', 'http://', 'ftp://onebot.invalid/api', 'http://onebot.invalid/api?token=old',
    'http://old:secret@onebot.invalid/api'])('disabled invalid base %s does not affect unauthenticated external HTTP', async (base) => {
    const readFileSync = jest.fn(missing)
    const {client, axios} = setup({config: {CONNECT_ONE_BOT_SWITCH: false, ONE_BOT_API_URL: base}, env: {}, readFileSync})
    const options = {params: {q: 'hello'}}
    await client.get('http://external.invalid/search?lang=zh', options)
    expect(axios.get).toHaveBeenCalledWith('http://external.invalid/search?lang=zh', options)
    expect(readFileSync).not.toHaveBeenCalled()
  })

  test('disabled invalid base does not infer an external target from a relative URL and baseURL', async () => {
    const {client, axios} = setup({config: {CONNECT_ONE_BOT_SWITCH: false, ONE_BOT_API_URL: ''}})
    await expect(client.get('/action', {baseURL: 'https://external.invalid'}))
      .rejects.toMatchObject({code: 'ONEBOT_REQUEST_FAILED'})
    expect(axios.get).not.toHaveBeenCalled()
  })

  test.each(['/action', '//unknown.invalid/action', 'ftp://external.invalid/a', 'http://user:pass@unknown.invalid/api',
    ' https://external.invalid/api', 'https://external.invalid/a\\b',
    'http://unknown.invalid/api?access_token=old-secret'])('disabled invalid service rejects ambiguous or credential-bearing URL: %s', async (url) => {
    const {client, axios} = setup({config: {CONNECT_ONE_BOT_SWITCH: false, ONE_BOT_API_URL: ''}})
    await expect(client.get(url)).rejects.toMatchObject({code: 'ONEBOT_REQUEST_FAILED'})
    expect(axios.get).not.toHaveBeenCalled()
  })

  test.each([
    [{headers: {Authorization: 'Bearer old-secret'}}, {}],
    [{headers: {authorization: 'Bearer old-secret'}}, {}],
    [{headers: {'Proxy-Authorization': 'Basic old-secret'}}, {}],
    [{auth: {username: 'old-secret', password: 'old-secret'}}, {}],
    [{params: {access_token: 'old-secret'}}, {}],
    [{}, {headers: {common: {Authorization: 'Bearer old-secret'}}}],
    [{}, {headers: {get: {AUTHORIZATION: 'Bearer old-secret'}}}],
    [{}, {auth: {username: 'old-secret'}}],
    [{}, {params: {access_token: 'old-secret'}}],
    [{params: new URLSearchParams({access_token: 'old-secret'})}, {}],
    [{}, {params: 'access_token=old-secret'}],
  ])('disabled invalid service never forwards ambiguous old auth %#', async (options, defaults) => {
    const readFileSync = jest.fn(missing)
    const {client, axios} = setup({config: {CONNECT_ONE_BOT_SWITCH: false, ONE_BOT_API_URL: ''}, readFileSync})
    axios.defaults = defaults
    const error = await client.get('http://unknown.invalid/api/action', options).catch((error) => error)
    expect(error.message).toBe('ONEBOT_REQUEST_FAILED')
    expect(Object.keys(error)).toEqual(['code'])
    expect(error.cause).toBeUndefined()
    expect(JSON.stringify(error)).not.toContain('old-secret')
    expect(axios.get).not.toHaveBeenCalled()
    expect(readFileSync).not.toHaveBeenCalled()
  })

  test('valid base preserves external per-request auth and keeps OneBot credentials lazy', async () => {
    const readFileSync = jest.fn(missing)
    const {client, axios} = setup({config: {...config, CONNECT_ONE_BOT_SWITCH: false}, env: {}, readFileSync})
    const options = {headers: {Authorization: 'Bearer external-key'}}
    await client.get('https://external.invalid/v1/models', options)
    expect(axios.get).toHaveBeenCalledWith('https://external.invalid/v1/models', options)
    expect(readFileSync).not.toHaveBeenCalled()
  })

  test.each([0, -1, undefined, NaN])('invalid caller timeout %s uses configured/default deadline', async (timeout) => {
    const {client, axios} = setup()
    await client.get(`${config.ONE_BOT_API_URL}/action`, {timeout})
    expect(axios.get.mock.calls[0][1].timeout).toBe(15000)
    const custom = setup({config: {...config, ONE_BOT_REQUEST_TIMEOUT_MS: 1234}})
    await custom.client.get(`${config.ONE_BOT_API_URL}/action`, {timeout})
    expect(custom.axios.get.mock.calls[0][1].timeout).toBe(1234)
  })

  test('total deadline aborts even an adapter that never settles and clears timer', async () => {
    jest.useFakeTimers()
    try {
      const {client, axios} = setup()
      axios.get.mockImplementation(() => new Promise(() => {}))
      const request = client.get(`${config.ONE_BOT_API_URL}/action`, {timeout: 20})
      const check = expect(request).rejects.toMatchObject({code: 'ONEBOT_TIMEOUT'})
      await jest.advanceTimersByTimeAsync(20)
      await check
      expect(axios.get.mock.calls[0][1].signal.aborted).toBe(true)
      expect(jest.getTimerCount()).toBe(0)
    } finally { jest.useRealTimers() }
  })

  test.each([false, true])('combines caller cancellation (already aborted: %s)', async (preabort) => {
    const {client, axios} = setup()
    const controller = new AbortController()
    axios.get.mockImplementation(() => new Promise(() => {}))
    if (preabort) controller.abort()
    const request = client.get(`${config.ONE_BOT_API_URL}/action`, {signal: controller.signal})
    if (!preabort) { await Promise.resolve(); controller.abort() }
    await expect(request).rejects.toMatchObject({code: 'ONEBOT_REQUEST_FAILED'})
    if (!preabort) expect(axios.get.mock.calls[0][1].signal.aborted).toBe(true)
  })

  test.each([
    [{response: {status: 401}}, 'ONEBOT_AUTH_FAILED'],
    [{response: {status: 403}}, 'ONEBOT_AUTH_FAILED'],
    [{code: 'ECONNABORTED'}, 'ONEBOT_TIMEOUT'],
    [{code: 'ETIMEDOUT'}, 'ONEBOT_TIMEOUT'],
    [{code: 'ECONNRESET'}, 'ONEBOT_REQUEST_FAILED'],
  ])('sanitizes rejected errors %#', async (details, code) => {
    const {client, axios} = setup()
    axios.get.mockRejectedValue(Object.assign(new Error(secret), {headers: {secret}, url: secret, cause: secret, ...details}))
    const error = await client.get(`${config.ONE_BOT_API_URL}/action`).catch((value) => value)
    expect(error.message).toBe(code)
    expect(Object.keys(error)).toEqual(['code'])
    expect(JSON.stringify(error)).not.toContain(secret)
  })

  test.each([
    [{status: 401}, 'ONEBOT_AUTH_FAILED'], [{status: 403}, 'ONEBOT_AUTH_FAILED'],
    [{status: 302}, 'ONEBOT_REQUEST_FAILED'],
    [{status: 200, data: {status: 'failed', retcode: 0}}, 'ONEBOT_ACTION_FAILED'],
    [{status: 200, data: {retcode: 100}}, 'ONEBOT_ACTION_FAILED'],
  ])('checks HTTP and action envelopes %#', async (response, code) => {
    const {client, axios} = setup()
    axios.get.mockResolvedValue(response)
    await expect(client.get(`${config.ONE_BOT_API_URL}/action`)).rejects.toMatchObject({code})
  })

  test('legacy missing token works and successful completion clears deadline', async () => {
    jest.useFakeTimers()
    try {
      const {client, axios} = setup({config: {...config, ONE_BOT_PROVIDER: 'napcat'}, env: {}})
      await client.get(`${config.ONE_BOT_API_URL}/action`)
      expect(axios.get.mock.calls[0][1].headers).toEqual({})
      expect(jest.getTimerCount()).toBe(0)
    } finally { jest.useRealTimers() }
  })
})

describe('OneBot HTTP loopback only', () => {
  let server
  let base
  let requests
  beforeEach(async () => {
    requests = []
    server = http.createServer((req, res) => {
      requests.push({url: req.url, auth: req.headers.authorization})
      if (req.url === '/api/redirect') { res.writeHead(302, {Location: '/external'}); res.end(); return }
      if (req.url === '/api/hang') return
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({status: 'ok', retcode: 0}))
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${server.address().port}`
  })
  afterEach(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })
  function client() {
    return createOneBotHttpClient({axios: realAxios, config: {...config, ONE_BOT_API_URL: `${base}/api`},
      env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}, readFileSync: missing})
  }
  test('Bearer stays in exact API base path; redirects are not followed', async () => {
    const api = client()
    await api.get(`${base}/api/ok`, {proxy: false})
    await api.get(`${base}/api-similar/ok`, {proxy: false})
    await expect(api.get(`${base}/api/redirect`, {proxy: false})).rejects.toMatchObject({code: 'ONEBOT_REQUEST_FAILED'})
    expect(requests).toEqual([
      {url: '/api/ok', auth: `Bearer ${secret}`}, {url: '/api-similar/ok', auth: undefined},
      {url: '/api/redirect', auth: `Bearer ${secret}`},
    ])
  })
  test('real hanging connection times out', async () => {
    await expect(client().get(`${base}/api/hang`, {proxy: false, timeout: 30}))
      .rejects.toMatchObject({code: 'ONEBOT_TIMEOUT'})
  })
})
