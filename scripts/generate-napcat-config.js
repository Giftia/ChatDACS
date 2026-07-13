'use strict'

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')

const {buildNapCatConfigFromRuntime} = require('../src/bots/qq/napcat')
const {normalizeRuntimeConfig} = require('../src/config/runtimeConfig')

function generateNapCatConfig({configPath, eventHost = '127.0.0.1'}) {
  const rawConfig = YAML.parse(fs.readFileSync(configPath, 'utf8'))
  const config = normalizeRuntimeConfig(rawConfig)
  return buildNapCatConfigFromRuntime({config, eventHost})
}

function parseArgs(args) {
  const options = {
    configPath: path.resolve('config/config.yml'),
    eventHost: '127.0.0.1',
  }

  for (let index = 0; index < args.length; index += 1) {
    const name = args[index]
    const value = args[index + 1]
    if (!['--config', '--event-host', '--output'].includes(name) || !value) {
      throw new Error(`Unknown or incomplete argument: ${name}`)
    }

    if (name === '--config') options.configPath = path.resolve(value)
    if (name === '--event-host') options.eventHost = value
    if (name === '--output') options.outputPath = path.resolve(value)
    index += 1
  }

  return options
}

function main(args = process.argv.slice(2)) {
  const options = parseArgs(args)
  const output = `${JSON.stringify(generateNapCatConfig(options), null, 2)}\n`

  if (!options.outputPath) {
    process.stdout.write(output)
    return
  }

  fs.mkdirSync(path.dirname(options.outputPath), {recursive: true})
  fs.writeFileSync(options.outputPath, output, 'utf8')
  process.stdout.write(`NapCat config written to ${options.outputPath}\n`)
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}

module.exports = {
  generateNapCatConfig,
  main,
  parseArgs,
}
