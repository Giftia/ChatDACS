'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const {generateNapCatConfig, parseArgs} = require('./generate-napcat-config')

describe('NapCat config generator', () => {
  test('reads ChatDACS YAML and produces a string-format HTTP bridge', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-napcat-'))
    const configPath = path.join(directory, 'config.yml')
    fs.writeFileSync(
      configPath,
      [
        'System:',
        '  WEB_PORT: 8080',
        "  ONE_BOT_API_URL: '127.0.0.1:6700'",
        "  ONE_BOT_ANTI_POST_API: '/onebot'",
      ].join('\n'),
      'utf8',
    )

    const config = generateNapCatConfig({configPath, eventHost: 'host.docker.internal'})

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

  test('keeps the shipped example synchronized with the default config', () => {
    const generated = generateNapCatConfig({
      configPath: path.resolve('config/config.yml'),
    })
    const example = JSON.parse(
      fs.readFileSync(path.resolve('integrations/napcat/onebot11.json.example'), 'utf8'),
    )

    expect(generated).toEqual(example)
  })
})
