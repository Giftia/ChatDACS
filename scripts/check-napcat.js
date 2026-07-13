'use strict'

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')
const axiosModule = require('axios')

const {checkNapCatReadiness} = require('../src/bots/qq/napcat')
const {normalizeRuntimeConfig} = require('../src/config/runtimeConfig')

async function main() {
  const configPath = path.resolve(process.argv[2] ?? 'config/config.yml')
  const rawConfig = YAML.parse(fs.readFileSync(configPath, 'utf8'))
  const config = normalizeRuntimeConfig(rawConfig)
  const result = await checkNapCatReadiness({
    config,
    axios: axiosModule.default ?? axiosModule,
  })
  const report = {
    compatible: result.compatible,
    appName: result.appName ?? '',
    appVersion: result.appVersion ?? '',
    protocolVersion: result.protocolVersion ?? '',
    loggedIn: result.loggedIn,
    groupCount: result.groupCount,
    error: result.error ?? '',
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.compatible || !report.loggedIn) process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`)
    process.exitCode = 1
  })
}

module.exports = {main}
