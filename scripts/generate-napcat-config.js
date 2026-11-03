'use strict'

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')

const {buildNapCatConfigFromRuntime} = require('../src/bots/qq/napcat')
const {normalizeRuntimeConfig} = require('../src/config/runtimeConfig')
const {writePrivateConfig} = require('./generate-onebot-config')
const {safeCode} = require('./check-onebot')
const fail = (code) => Object.assign(new Error(code), {code})

function generateNapCatConfig({configPath, eventHost = '127.0.0.1', env, readFileSync = fs.readFileSync}) {
  // YAML warnings can include source snippets; only let errors reach the safe CLI boundary.
  const rawConfig = YAML.parse(readFileSync(configPath, 'utf8'), {logLevel: 'error'})
  const config = normalizeRuntimeConfig(rawConfig)
  return buildNapCatConfigFromRuntime({config, eventHost, env, readFileSync})
}

function parseArgs(args) {
  const options = {
    configPath: path.resolve('config/config.yml'),
    eventHost: '127.0.0.1',
  }

  for (let index = 0; index < args.length; index += 1) {
    const name = args[index]
    const value = args[index + 1]
    if (!['--config', '--event-host', '--output'].includes(name) || typeof value !== 'string' ||
        !value.trim() || value.startsWith('--') || /[\x00-\x1f]/.test(value)) {
      throw fail('ONEBOT_ARGUMENT_INVALID')
    }

    if (name === '--config') options.configPath = path.resolve(value)
    if (name === '--event-host') options.eventHost = value
    if (name === '--output') options.outputPath = path.resolve(value)
    index += 1
  }

  return options
}

function main(args = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout
  const stderr = dependencies.stderr ?? process.stderr
  try {
    const options = parseArgs(args)
    const generated = (dependencies.generate ?? generateNapCatConfig)(options)
    const hasToken = ['httpServers', 'httpClients'].some((key) =>
      generated?.network?.[key]?.some((entry) => entry?.token != null && entry.token !== ''))
    if (hasToken && !options.outputPath) throw fail('ONEBOT_OUTPUT_REQUIRED')
    if (hasToken && !/\.credentials\.json$/.test(options.outputPath)) throw fail('ONEBOT_OUTPUT_INVALID')
    const output = `${JSON.stringify(generated, null, 2)}\n`

    if (!options.outputPath) {
      stdout.write(output)
      return 0
    }

    if (hasToken) {
      try {
        ;(dependencies.writePrivate ?? writePrivateConfig)(options.outputPath, output)
      } catch { throw fail('ONEBOT_OUTPUT_FAILED') }
    } else {
      try {
        ;(dependencies.mkdirSync ?? fs.mkdirSync)(path.dirname(options.outputPath), {recursive: true})
        ;(dependencies.writeFileSync ?? fs.writeFileSync)(options.outputPath, output, {encoding: 'utf8', flag: 'wx'})
      } catch { throw fail('ONEBOT_OUTPUT_FAILED') }
    }
    stdout.write('ONEBOT_CONFIG_WRITTEN\n')
    return 0
  } catch (error) {
    stderr.write(`${safeCode(error)}\n`)
    return 1
  }
}

if (require.main === module) process.exitCode = main()

module.exports = {
  generateNapCatConfig,
  main,
  parseArgs,
}
