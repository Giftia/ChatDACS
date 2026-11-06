'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const {execFileSync} = require('child_process')
const provider = require('./oneBotProvider')
const checker = require('../../../scripts/check-onebot')
const generator = require('../../../scripts/generate-onebot-config')
const napcat = require('./napcat')

const token = 'synthetic-provider-test-credential'
const config = {ONE_BOT_PROVIDER: 'snowluma', ONE_BOT_API_URL: '127.0.0.1:5700',
  WEB_PORT: 8080, ONE_BOT_ANTI_POST_API: '/onebot', ONE_BOT_CONNECT_TIMEOUT_MS: 100}
const env = {CHATDACS_ONEBOT_ACCESS_TOKEN: token}
const version = (name = 'SnowLuma', protocol = 'v11') => ({data: {status: 'ok', retcode: 0,
  data: {app_name: name, app_version: '2.4.0', protocol_version: protocol}}})
const login = (user_id) => ({data: {status: 'ok', data: {user_id, nickname: 'synthetic'}}})
const status = (online = true, good = true) => ({data: {status: 'ok', data: {online, good}}})
const noFiles = () => { throw new Error('unexpected file access') }
const yaml = 'System:\n  ONE_BOT_PROVIDER: snowluma\n  ONE_BOT_API_URL: 127.0.0.1:5700\n  WEB_PORT: 8080\n  ONE_BOT_ANTI_POST_API: /onebot\n'
function deps(extra = {}) {
  return {stdout: {write: jest.fn()}, stderr: {write: jest.fn()}, env,
    readFileSync: jest.fn(() => yaml), writePrivateConfig: jest.fn(), ...extra}
}

describe('OneBot provider config', () => {
  test('matches the v2.4.0 snapshot schema and disables unused transports', () => {
    const result = provider.buildProviderConfigFromRuntime({config, env, readFileSync: noFiles})
    expect(result).toEqual({mode: 'snapshot', networks: {
      httpServers: [{name: 'ChatDACS API', enabled: true, accessToken: token, messageFormat: 'string',
        reportSelfMessage: false, host: '127.0.0.1', port: 5700, path: '/', enableWebSocket: false, enableSse: false}],
      httpClients: [{name: 'ChatDACS Events', enabled: true, accessToken: token, messageFormat: 'string',
        reportSelfMessage: false, url: 'http://127.0.0.1:8080/onebot', timeoutMs: 15000}],
      wsServers: [], wsClients: [],
    }})
  })
  test.each([undefined, '', ' ', 'changeme', 'YOUR_TOKEN', 'bad\nvalue', 'bad value'])('rejects absent/placeholder token %p', (accessToken) => {
    expect(() => provider.createSnowLumaOneBotConfig({apiUrl: config.ONE_BOT_API_URL,
      callbackUrl: 'http://127.0.0.1:8080/bot', accessToken})).toThrow('ONEBOT_AUTH_REQUIRED')
  })
  test.each(['http://user:secret@localhost', 'http://localhost/?', 'http://localhost/#',
    'http://local host', 'ftp://localhost', 'http:\\localhost'])('rejects unsafe URL %s', (apiUrl) => {
    expect(() => provider.normalizeApiBaseUrl(apiUrl)).toThrow('ONEBOT_URL_INVALID')
  })
  test.each([0, 65536, 'abc'])('rejects callback port %p', (WEB_PORT) => {
    expect(() => provider.buildProviderConfigFromRuntime({config: {...config, WEB_PORT}, env})).toThrow('ONEBOT_CALLBACK_PORT_INVALID')
  })
  test.each(['//evil', '/bot?token=secret', '/bot#x', '', null])('rejects callback route %p', (ONE_BOT_ANTI_POST_API) => {
    expect(() => provider.buildProviderConfigFromRuntime({config: {...config, ONE_BOT_ANTI_POST_API}, env})).toThrow('ONEBOT_CALLBACK_INVALID')
  })
  test('supports prefixed API and IPv6 listener without stripping route', () => {
    const result = provider.createSnowLumaOneBotConfig({apiUrl: 'http://[::1]:5700/api',
      callbackUrl: 'http://[::1]:8080/bot', accessToken: token})
    expect(result.networks.httpServers[0]).toMatchObject({host: '::1', path: '/api'})
  })
  test.each([
    ['http://localhost:3000', 'localhost'], ['http://LOCALHOST:3000', 'localhost'],
    ['http://onebot.example:3000/api', 'onebot.example'], ['http://node-1.example.:3000', 'node-1.example.'],
    ['http://127.0.0.1:3000', '127.0.0.1'], ['http://0.0.0.0:3000', '0.0.0.0'],
    ['http://[::1]:3000', '::1'], ['http://[::]:3000', '::'],
    ['http://[2001:db8::1]:3000', '2001:db8::1'],
    [`http://${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}:3000`,
      `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`],
  ])('SnowLuma bind host accepts upstream-compatible %s', (apiUrl, expected) => {
    const result = provider.createSnowLumaOneBotConfig({apiUrl, callbackUrl: 'http://localhost:8080/bot', accessToken: token})
    expect(result.networks.httpServers[0].host).toBe(expected)
  })
  test.each([
    'http://bad_host.invalid:3000', 'http://-bad.invalid:3000', 'http://bad-.invalid:3000',
    'http://bad..invalid:3000', 'http://bad!host.invalid:3000',
    `http://${'a'.repeat(64)}.invalid:3000`,
    `http://${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}:3000`,
    'http://999.0.0.1:3000', 'http://[not-ipv6]:3000', 'http://[::1:3000', 'http://:3000',
    'http://bad host:3000', 'http://bad\\host:3000',
  ])('rejects SnowLuma invalid bind host with a safe fixed error: %s', (apiUrl) => {
    let error
    try { provider.createSnowLumaOneBotConfig({apiUrl, callbackUrl: 'http://localhost:8080/bot', accessToken: token}) }
    catch (value) { error = value }
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('ONEBOT_URL_INVALID')
    expect(error.code).toBe('ONEBOT_URL_INVALID')
    expect(Object.keys(error)).toEqual(['code'])
    expect(error.cause).toBeUndefined()
    expect(error.stack).not.toContain(apiUrl)
    expect(JSON.stringify(error)).not.toContain(token)
  })
  test('SnowLuma bind host validation never resolves DNS or performs HTTP', () => {
    const lookup = jest.spyOn(require('dns'), 'lookup').mockImplementation(() => {throw new Error('unexpected DNS')})
    const request = jest.spyOn(http, 'request').mockImplementation(() => {throw new Error('unexpected HTTP')})
    const httpsRequest = jest.spyOn(require('https'), 'request').mockImplementation(() => {throw new Error('unexpected HTTPS')})
    try {
      provider.createSnowLumaOneBotConfig({apiUrl: 'http://onebot.example:3000',
        callbackUrl: 'http://localhost:8080/bot', accessToken: token})
      expect(() => provider.createSnowLumaOneBotConfig({apiUrl: 'http://bad_host.invalid:3000',
        callbackUrl: 'http://localhost:8080/bot', accessToken: token})).toThrow('ONEBOT_URL_INVALID')
      expect(lookup).not.toHaveBeenCalled()
      expect(request).not.toHaveBeenCalled()
      expect(httpsRequest).not.toHaveBeenCalled()
    } finally {lookup.mockRestore(); request.mockRestore(); httpsRequest.mockRestore()}
  })
  test.each(['http://127.0.0.1:0', 'http://[::1]:0', 'http://localhost:0'])(
    'SnowLuma rejects listener port zero as upstream requires: %s', (apiUrl) => {
      expect(() => provider.createSnowLumaOneBotConfig({apiUrl,
        callbackUrl: 'http://localhost:8080/bot', accessToken: token})).toThrow('ONEBOT_URL_INVALID')
    },
  )
  test.each([['http://localhost:1', 1], ['http://localhost:65535', 65535],
    ['http://localhost', 80], ['http://localhost:80', 80]])(
    'SnowLuma preserves valid listener port %s', (apiUrl, port) => {
      const result = provider.createSnowLumaOneBotConfig({apiUrl,
        callbackUrl: 'http://localhost:8080/bot', accessToken: token})
      expect(result.networks.httpServers[0].port).toBe(port)
    },
  )
})

describe('provider readiness without real accounts', () => {
  test('uses authenticated bounded requests and returns only account aggregates', async () => {
    const axios = {get: jest.fn().mockResolvedValueOnce(version())
      .mockResolvedValueOnce(login(123)).mockResolvedValueOnce(status())
      .mockResolvedValueOnce({data: {status: 'ok', data: [{group_id: 42}]}})}
    const result = await provider.checkOneBotReadiness({config: {...config, ONE_BOT_SELF_ID: '123'}, axios, env, readFileSync: noFiles})
    expect(result).toMatchObject({compatible: true, loggedIn: true, groupCount: 1})
    expect(JSON.stringify(result)).not.toMatch(/synthetic|user_id|group_id/)
    expect(axios.get.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/get_version_info', '/get_login_info', '/get_status', '/get_group_list',
    ])
    expect(axios.get.mock.calls[0][1]).toMatchObject({headers: {Authorization: `Bearer ${token}`}, maxRedirects: 0, timeout: 100})
  })
  test.each([
    [login(0), undefined, 'ONEBOT_LOGIN_INVALID', 2],
    [login(456), undefined, 'ONEBOT_SELF_ID_MISMATCH', 2],
    [login(123), status(false, false), 'ONEBOT_OFFLINE', 3],
    [login(123), status(true, false), 'ONEBOT_UNHEALTHY', 3],
    [login(123), status('true', true), 'ONEBOT_STATUS_INVALID', 3],
  ])('stops the readiness check before fetching groups: %s %s %s', async (identity, health, code, calls) => {
    const axios = {get: jest.fn().mockResolvedValueOnce(version()).mockResolvedValueOnce(identity)
      .mockResolvedValueOnce(health)}
    const context = deps({axios, readFileSync: () => `${yaml}  ONE_BOT_SELF_ID: '123'\n`})
    expect(await checker.main(['--config', 'synthetic.yml'], context)).toBe(1)
    expect(axios.get).toHaveBeenCalledTimes(calls)
    expect(JSON.parse(context.stdout.write.mock.calls[0][0])).toEqual({provider: 'snowluma', compatible: true,
      loggedIn: false, groupCount: 0, code})
  })
  test.each([['NapCatQQ', 'v11'], ['SnowLuma', 'v12']])('rejects identity/protocol mismatch %s %s', async (name, protocol) => {
    const axios = {get: jest.fn().mockResolvedValue(version(name, protocol))}
    const result = await provider.checkOneBotReadiness({config, axios, env, readFileSync: noFiles})
    expect(result).toMatchObject({compatible: false, loggedIn: false})
    expect(axios.get).toHaveBeenCalledTimes(1)
  })
  test('sanitizes errors and bounds an uncooperative transport', async () => {
    const axios = {get: jest.fn().mockRejectedValue(new Error(token))}
    expect(await provider.probeOneBot({config, axios, env})).toMatchObject({error: 'ONEBOT_REQUEST_FAILED'})
    axios.get.mockImplementation(() => new Promise(() => {}))
    expect(await provider.probeOneBot({config: {...config, ONE_BOT_CONNECT_TIMEOUT_MS: 10}, axios, env}))
      .toMatchObject({error: 'ONEBOT_TIMEOUT'})
  })
  test('rejects invalid group payload even after login succeeds', async () => {
    const axios = {get: jest.fn().mockResolvedValueOnce(version())
      .mockResolvedValueOnce(login(1)).mockResolvedValueOnce(status())
      .mockResolvedValueOnce({data: {status: 'ok', data: 'not-an-array'}})}
    expect(await provider.checkOneBotReadiness({config, axios, env})).toMatchObject({error: 'ONEBOT_GROUP_LIST_INVALID', groupCount: 0})
  })
  test('loopback server receives Bearer and no token in URL', async () => {
    const observed = []
    const server = http.createServer((req, res) => {
      observed.push([req.url, req.headers.authorization])
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(version().data))
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const result = await provider.probeOneBot({config: {...config, ONE_BOT_API_URL: `127.0.0.1:${server.address().port}`,
        ONE_BOT_CONNECT_TIMEOUT_MS: 1000}, axios: require('axios'), env, readFileSync: noFiles})
      expect(result.compatible).toBe(true)
      expect(observed).toEqual([['/get_version_info', `Bearer ${token}`]])
    } finally { await new Promise((resolve) => server.close(resolve)) }
  })
})

describe('safe OneBot CLI', () => {
  test('uses SnowLuma defaults and cwd-relative credentials even with an external YAML path', () => {
    const configPath = path.resolve('elsewhere', 'config', 'custom.yml')
    const load = (extra = '') => checker.loadConfig({configPath}, () =>
      `System:\n  ONE_BOT_PROVIDER: snowluma\n${extra}`)
    expect(load()).toMatchObject({ONE_BOT_API_URL: '127.0.0.1:3000',
      ONE_BOT_CREDENTIALS_FILE: 'config/onebot.credentials.json'})
    expect(load('  ONE_BOT_CREDENTIALS_FILE: private/custom.credentials.json\n').ONE_BOT_CREDENTIALS_FILE)
      .toBe('private/custom.credentials.json')
    const reads = []
    const context = deps({env: {}, readFileSync: (file) => {
      reads.push(file)
      return file === configPath ? 'System:\n  ONE_BOT_PROVIDER: snowluma\n' : JSON.stringify({accessToken: token})
    }})
    expect(generator.main(['--config', configPath, '--output', 'snow.credentials.json'], context)).toBe(0)
    expect(reads).toEqual([configPath, 'config/onebot.credentials.json'])
    expect(JSON.parse(context.writePrivateConfig.mock.calls[0][1]).networks.httpServers[0].port).toBe(3000)
  })
  test('require has no config reads or network side effects', () => {
    const read = jest.spyOn(fs, 'readFileSync')
    const get = jest.spyOn(require('axios'), 'get')
    try {
      jest.isolateModules(() => {
        require('../../../scripts/check-onebot')
        require('../../../scripts/generate-onebot-config')
      })
      expect(read.mock.calls.filter(([file]) => /\.(?:yml|credentials\.json)$/.test(String(file)))).toEqual([])
      expect(get).not.toHaveBeenCalled()
    } finally { read.mockRestore(); get.mockRestore() }
  })
  test.each([[], ['--config'], ['--config', '--output'], ['--wat', token],
    ['--config', 'a', '--config', 'b'], ['--config', 'a', '--provider', 'unknown']].map((args) => [args]))('validates arguments %p', (args) => {
    expect(() => checker.parseArgs(args)).toThrow('ONEBOT_ARGUMENT_INVALID')
  })
  test('requires explicit output and protected suffix before reading config', () => {
    const context = deps()
    expect(generator.main(['--config', 'synthetic.yml'], context)).toBe(1)
    expect(generator.main(['--config', 'synthetic.yml', '--output', 'public.json'], context)).toBe(1)
    expect(context.readFileSync).not.toHaveBeenCalled()
  })
  test('generates with injected token but never prints it or output path', () => {
    const context = deps()
    expect(generator.main(['--config', 'synthetic.yml', '--output', 'private.credentials.json'], context)).toBe(0)
    expect(context.writePrivateConfig.mock.calls[0][1]).toContain(token)
    expect(context.stdout.write).toHaveBeenCalledWith('ONEBOT_CONFIG_WRITTEN\n')
    expect(context.stderr.write).not.toHaveBeenCalled()
  })
  test.each(['bad_host.invalid:3000', '127.0.0.1:0', '[::1]:0'])('invalid SnowLuma listener %s fails before private output is written', (listener) => {
    const context = deps({readFileSync: jest.fn(() => yaml.replace('127.0.0.1:5700', JSON.stringify(listener)))})
    expect(generator.main(['--config', 'synthetic.yml', '--output', 'private.credentials.json'], context)).toBe(1)
    expect(context.stderr.write).toHaveBeenCalledWith('ONEBOT_URL_INVALID\n')
    expect(context.stdout.write).not.toHaveBeenCalled()
    expect(context.writePrivateConfig).not.toHaveBeenCalled()
  })
  test('missing token fails closed and never writes output', () => {
    const context = deps({env: {}, readFileSync: (file) => {
      if (String(file).endsWith('.yml')) return yaml
      throw Object.assign(new Error(token), {code: 'ENOENT'})
    }})
    expect(generator.main(['--config', 'synthetic.yml', '--output', 'private.credentials.json'], context)).toBe(1)
    expect(context.stderr.write).toHaveBeenCalledWith('ONEBOT_AUTH_REQUIRED\n')
    expect(context.writePrivateConfig).not.toHaveBeenCalled()
  })
  test('sanitizes config parser failures and remote strings', async () => {
    const broken = deps({readFileSync: () => { throw new Error(token) }})
    expect(await checker.main(['--config', 'synthetic.yml'], broken)).toBe(1)
    expect(broken.stderr.write).toHaveBeenCalledWith('ONEBOT_CONFIG_INVALID\n')
    const context = deps({axios: {get: jest.fn().mockResolvedValue(version(token))}})
    expect(await checker.main(['--config', 'synthetic.yml'], context)).toBe(1)
    expect(context.stdout.write.mock.calls[0][0]).not.toContain(token)
  })
  test('writes private output, excludes git/package, and refuses overwrite', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-provider-'))
    const file = path.join(dir, 'snowluma.credentials.json')
    try {
      generator.writePrivateConfig(file, token)
      expect(fs.readFileSync(file, 'utf8')).toBe(token)
      expect(() => generator.writePrivateConfig(file, 'replacement')).toThrow('ONEBOT_OUTPUT_FAILED')
      expect(fs.readFileSync(file, 'utf8')).toBe(token)
      if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600)
      else {
        const acl = execFileSync('icacls.exe', [file], {encoding: 'utf8', windowsHide: true})
        expect(acl).not.toContain('(I)')
      }
      const ignored = execFileSync('git', ['check-ignore', '--no-index', 'config/snowluma.credentials.json'], {encoding: 'utf8'})
      expect(ignored.trim()).toBe('config/snowluma.credentials.json')
      const {selectProjectFiles} = require('../../../scripts/build-release')
      expect(selectProjectFiles(['config/snowluma.credentials.json'], 'win-x64')).toEqual([])
    } finally { fs.rmSync(dir, {recursive: true, force: true}) }
  })
  test('cleans up only its newly created output when writing fails', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-provider-'))
    const file = path.join(dir, 'failed.credentials.json')
    const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw new Error(token) })
    try {
      expect(() => generator.writePrivateConfig(file, token)).toThrow('ONEBOT_OUTPUT_FAILED')
      expect(fs.existsSync(file)).toBe(false)
    } finally { write.mockRestore(); fs.rmSync(dir, {recursive: true, force: true}) }
  })
})

describe('legacy NapCat wrappers use the secured provider', () => {
  const options = {apiUrl: config.ONE_BOT_API_URL, config: {...config, ONE_BOT_PROVIDER: 'napcat'},
    env, readFileSync: noFiles}
  test('probe sanitizes errors and enforces abort deadline', async () => {
    const axios = {get: jest.fn().mockRejectedValue(new Error(token))}
    expect(await napcat.probeNapCat({...options, axios})).toMatchObject({error: 'ONEBOT_REQUEST_FAILED'})
    axios.get.mockImplementation(() => new Promise(() => {}))
    expect(await napcat.probeNapCat({...options, axios, timeoutMs: 10})).toMatchObject({error: 'ONEBOT_TIMEOUT'})
    expect(axios.get.mock.calls[1][1].signal.aborted).toBe(true)
  })
  test('check forwards credential injection for every request and hides raw errors', async () => {
    const readFileSync = jest.fn(() => JSON.stringify({accessToken: token}))
    const axios = {get: jest.fn().mockResolvedValueOnce(version('NapCatQQ'))
      .mockResolvedValueOnce({data: {status: 'ok', data: {user_id: 1}}})
      .mockRejectedValueOnce(new Error(token))}
    const result = await napcat.checkNapCatReadiness({...options, axios, env: {}, readFileSync})
    expect(result).toMatchObject({loggedIn: false, error: 'ONEBOT_REQUEST_FAILED'})
    expect(readFileSync).toHaveBeenCalledTimes(3)
    for (const [, request] of axios.get.mock.calls) {
      expect(request).toMatchObject({headers: {Authorization: `Bearer ${token}`}, maxRedirects: 0})
    }
    expect(JSON.stringify(result)).not.toContain(token)
  })
  test('verify forwards injection and returns safe auth errors', async () => {
    const axios = {get: jest.fn().mockRejectedValue({response: {status: 401}, message: token})}
    const logger = {info: jest.fn(), warn: jest.fn()}
    const result = await napcat.verifyNapCatConnection({...options, axios, logger})
    expect(result.error).toBe('ONEBOT_AUTH_FAILED')
    expect(logger.warn.mock.calls.flat().join(' ')).not.toContain(token)
    expect(axios.get.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`)
  })
})
