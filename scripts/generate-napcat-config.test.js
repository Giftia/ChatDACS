'use strict'

jest.mock('./generate-onebot-config', () => ({writePrivateConfig: jest.fn()}))

const path = require('path')

const {writePrivateConfig} = require('./generate-onebot-config')
const {generateNapCatConfig, parseArgs, main} = require('./generate-napcat-config')

const secret = 'mock-sensitive-token'
const missing = () => { throw Object.assign(new Error('mock missing'), {code: 'ENOENT'}) }
const fixture = ['System:', '  WEB_PORT: 8080', "  ONE_BOT_API_URL: '127.0.0.1:6700'",
  "  ONE_BOT_ANTI_POST_API: '/onebot'"].join('\n')

function generateFixture({yaml = fixture, env = {}} = {}) {
  return generateNapCatConfig({configPath: 'mock.yml', eventHost: 'host.docker.internal', env,
    readFileSync: (file) => file === 'mock.yml' ? yaml : missing()})
}

function setup(generated = generateFixture()) {
  return {generate: jest.fn(() => generated), stdout: {write: jest.fn()}, stderr: {write: jest.fn()},
    mkdirSync: jest.fn(), writeFileSync: jest.fn(), writePrivate: jest.fn()}
}

describe('NapCat config generator', () => {
  beforeEach(() => { jest.clearAllMocks() })

  test('reads ChatDACS YAML and produces a string-format HTTP bridge', () => {
    const config = generateFixture()

    expect(config.network.httpServers[0]).toEqual(
      expect.objectContaining({host: '127.0.0.1', port: 6700, messagePostFormat: 'string'}),
    )
    expect(config.network.httpClients[0].url).toBe('http://host.docker.internal:8080/onebot')
  })

  test('parses supported command line options', () => {
    const options = parseArgs([
      '--config',
      'custom.yml',
      '--event-host',
      'chatdacs',
      '--output',
      'onebot11.json',
    ])

    expect(options).toEqual({
      configPath: path.resolve('custom.yml'),
      eventHost: 'chatdacs',
      outputPath: path.resolve('onebot11.json'),
    })
  })

  test('legacy defaults remain available without reading local configuration', () => {
    expect(parseArgs([])).toEqual({configPath: path.resolve('config/config.yml'), eventHost: '127.0.0.1'})
    const generated = generateFixture({yaml: 'System: {}'})
    expect(generated.network.httpServers[0]).toMatchObject({host: '127.0.0.1', port: 5700, token: ''})
    expect(generated.network.httpClients[0].token).toBe('')
  })

  test('token-bearing helper output cannot go to stdout', () => {
    const generated = generateFixture({env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}})
    const deps = setup(generated)
    expect(main([], deps)).toBe(1)
    expect(deps.stderr.write).toHaveBeenCalledWith('ONEBOT_OUTPUT_REQUIRED\n')
    expect(deps.stdout.write).not.toHaveBeenCalled()
    expect(deps.writePrivate).not.toHaveBeenCalled()
    expect(deps.writeFileSync).not.toHaveBeenCalled()
  })

  test.each(['plain.json', 'private.credentials.json.backup', 'private.credentials.JSON'])
  ('token requires a protected credentials suffix: %s', (output) => {
    const deps = setup(generateFixture({env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}}))
    expect(main(['--output', output], deps)).toBe(1)
    expect(deps.stderr.write).toHaveBeenCalledWith('ONEBOT_OUTPUT_INVALID\n')
    expect(deps.stdout.write).not.toHaveBeenCalled()
    expect(deps.writePrivate).not.toHaveBeenCalled()
    expect(deps.writeFileSync).not.toHaveBeenCalled()
    expect(deps.mkdirSync).not.toHaveBeenCalled()
  })

  test.each(['httpServers', 'httpClients'])('token on either %s side cannot be printed', (key) => {
    const deps = setup({network: {[key]: [{token: secret}]}})
    expect(main([], deps)).toBe(1)
    expect(deps.stderr.write).toHaveBeenCalledWith('ONEBOT_OUTPUT_REQUIRED\n')
    expect(deps.stdout.write).not.toHaveBeenCalled()
  })

  test('private output uses the injected private writer, never the plain file path', () => {
    const generated = generateFixture({env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}})
    const deps = setup(generated)
    expect(main(['--output', 'mock.credentials.json'], deps)).toBe(0)
    expect(deps.writePrivate).toHaveBeenCalledWith(path.resolve('mock.credentials.json'), `${JSON.stringify(generated, null, 2)}\n`)
    expect(deps.writeFileSync).not.toHaveBeenCalled()
    expect(deps.mkdirSync).not.toHaveBeenCalled()
    expect(deps.stdout.write.mock.calls).toEqual([['ONEBOT_CONFIG_WRITTEN\n']])
    expect(deps.stderr.write).not.toHaveBeenCalled()
  })

  test('default private writer is the shared wx/ACL implementation', () => {
    const deps = setup(generateFixture({env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}}))
    delete deps.writePrivate
    expect(main(['--output', 'mock.credentials.json'], deps)).toBe(0)
    expect(writePrivateConfig).toHaveBeenCalledWith(path.resolve('mock.credentials.json'), expect.stringContaining(secret))
    expect(deps.writeFileSync).not.toHaveBeenCalled()
  })

  test('existing private output is refused without retry or plaintext fallback', () => {
    const deps = setup(generateFixture({env: {CHATDACS_ONEBOT_ACCESS_TOKEN: secret}}))
    deps.writePrivate.mockImplementation(() => { throw Object.assign(new Error(`${secret} private/path`), {code: 'EEXIST'}) })
    expect(main(['--output', 'mock.credentials.json'], deps)).toBe(1)
    expect(deps.writePrivate).toHaveBeenCalledTimes(1)
    expect(deps.writeFileSync).not.toHaveBeenCalled()
    expect(deps.stdout.write).not.toHaveBeenCalled()
    expect(deps.stderr.write.mock.calls).toEqual([['ONEBOT_OUTPUT_FAILED\n']])
  })

  test('empty token keeps stdout JSON compatibility', () => {
    const generated = generateFixture()
    const deps = setup(generated)
    expect(main([], deps)).toBe(0)
    expect(deps.stdout.write.mock.calls).toEqual([[`${JSON.stringify(generated, null, 2)}\n`]])
    expect(deps.stderr.write).not.toHaveBeenCalled()
    expect(deps.writePrivate).not.toHaveBeenCalled()
  })

  test('empty token keeps ordinary JSON file output but adds exclusive creation', () => {
    const generated = generateFixture()
    const deps = setup(generated)
    expect(main(['--output', 'ordinary.json'], deps)).toBe(0)
    expect(deps.writeFileSync).toHaveBeenCalledWith(path.resolve('ordinary.json'),
      `${JSON.stringify(generated, null, 2)}\n`, {encoding: 'utf8', flag: 'wx'})
    expect(deps.writePrivate).not.toHaveBeenCalled()
    expect(deps.stdout.write.mock.calls).toEqual([['ONEBOT_CONFIG_WRITTEN\n']])
  })

  test.each(['mkdir', 'existing', 'write'])('plain output failure %s cannot leak details or overwrite', (stage) => {
    const deps = setup()
    const failure = () => { throw Object.assign(new Error(`${secret} C:/private/location`), {code: stage === 'existing' ? 'EEXIST' : 'EACCES'}) }
    if (stage === 'mkdir') deps.mkdirSync.mockImplementation(failure)
    else deps.writeFileSync.mockImplementation(failure)
    expect(main(['--output', 'ordinary.json'], deps)).toBe(1)
    expect(deps.stdout.write).not.toHaveBeenCalled()
    expect(deps.stderr.write.mock.calls).toEqual([['ONEBOT_OUTPUT_FAILED\n']])
    if (stage !== 'mkdir') expect(deps.writeFileSync.mock.calls[0][2].flag).toBe('wx')
  })

  test.each([['--unknown', secret], ['--config'], ['--output', 'private.credentials.json\n'], ['--config', '--output']])
  ('argument errors print only a fixed code %#', (args) => {
    const deps = setup()
    expect(main(args, deps)).toBe(1)
    expect(deps.generate).not.toHaveBeenCalled()
    expect(deps.stdout.write).not.toHaveBeenCalled()
    expect(deps.stderr.write.mock.calls).toEqual([['ONEBOT_ARGUMENT_INVALID\n']])
  })

  test.each(['yaml', 'filesystem', 'arbitrary-code'])('generation failure %s never prints sensitive error fragments', (stage) => {
    const deps = setup()
    deps.generate.mockImplementation(() => {
      if (stage === 'yaml') return generateFixture({yaml: `System: [\n  secret: ${secret}\n broken`})
      throw Object.assign(new Error(`${secret} YAML secret: user-body`), {code: `${secret}_UNSAFE`})
    })
    expect(main([], deps)).toBe(1)
    expect(deps.stdout.write).not.toHaveBeenCalled()
    expect(deps.stderr.write.mock.calls).toEqual([['ONEBOT_CONFIG_INVALID\n']])
    expect(deps.writePrivate).not.toHaveBeenCalled()
    expect(deps.writeFileSync).not.toHaveBeenCalled()
  })

  test('known safe generation error code is retained without its private message', () => {
    const deps = setup()
    deps.generate.mockImplementation(() => { throw Object.assign(new Error(secret), {code: 'ONEBOT_AUTH_REQUIRED'}) })
    expect(main([], deps)).toBe(1)
    expect(deps.stderr.write.mock.calls).toEqual([['ONEBOT_AUTH_REQUIRED\n']])
  })

  test('YAML warnings cannot emit source snippets outside the safe output boundary', () => {
    const warningSpy = jest.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const deps = setup()
      deps.generate.mockImplementation(() => generateFixture({yaml: `System: {}\nextra: !unknown ${secret}\n`}))
      expect(main([], deps)).toBe(0)
      expect(warningSpy).not.toHaveBeenCalled()
      expect(consoleSpy).not.toHaveBeenCalled()
      expect(deps.stderr.write).not.toHaveBeenCalled()
      expect(deps.stdout.write.mock.calls.flat().join('')).not.toContain(secret)
    } finally {
      warningSpy.mockRestore()
      consoleSpy.mockRestore()
    }
  })
})
