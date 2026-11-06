'use strict'

const fs = require('fs')
const path = require('path')
const YAML = require('yaml')
const {checkOneBotReadiness} = require('../src/bots/qq/oneBotProvider')
const {normalizeRuntimeConfig} = require('../src/config/runtimeConfig')
const fail = (code) => Object.assign(new Error(code), {code})
const SAFE_CODES = new Set(['ONEBOT_ARGUMENT_INVALID', 'ONEBOT_CONFIG_INVALID', 'ONEBOT_URL_INVALID',
  'ONEBOT_CALLBACK_INVALID', 'ONEBOT_CALLBACK_PORT_INVALID', 'ONEBOT_PROVIDER_CONFIG_UNSUPPORTED',
  'ONEBOT_LISTENER_HTTP_REQUIRED', 'ONEBOT_AUTH_REQUIRED', 'ONEBOT_OUTPUT_REQUIRED',
  'ONEBOT_OUTPUT_INVALID', 'ONEBOT_OUTPUT_FAILED', 'ONEBOT_AUTH_FAILED', 'ONEBOT_TIMEOUT',
  'ONEBOT_REQUEST_FAILED', 'ONEBOT_ACTION_FAILED', 'ONEBOT_PROVIDER_INVALID',
  'ONEBOT_GROUP_LIST_INVALID', 'ONEBOT_PROBE_FAILED', 'ONEBOT_READINESS_FAILED', 'ONEBOT_LOGIN_INVALID',
  'ONEBOT_SELF_ID_MISMATCH', 'ONEBOT_STATUS_INVALID', 'ONEBOT_OFFLINE', 'ONEBOT_UNHEALTHY'])

function safeCode(error) {
  return SAFE_CODES.has(error?.code) ? error.code : 'ONEBOT_CONFIG_INVALID'
}

function parseArgs(args, generate = false) {
  const options = {}
  const keys = {'--config': 'configPath', '--provider': 'provider',
    ...(generate ? {'--event-host': 'eventHost', '--output': 'outputPath'} : {})}
  for (let i = 0; i < args.length; i += 2) {
    const key = Object.hasOwn(keys, args[i]) ? keys[args[i]] : undefined, value = args[i + 1]
    if (!key || Object.hasOwn(options, key) || typeof value !== 'string' || !value.trim() ||
        value.startsWith('--') || /[\x00-\x1f]/.test(value)) throw fail('ONEBOT_ARGUMENT_INVALID')
    options[key] = key.endsWith('Path') ? path.resolve(value) : value
  }
  if (!options.configPath || (options.provider && !['napcat', 'snowluma', 'external'].includes(options.provider))) {
    throw fail('ONEBOT_ARGUMENT_INVALID')
  }
  if (generate && !options.outputPath) throw fail('ONEBOT_OUTPUT_REQUIRED')
  return options
}

function loadConfig(options, readFileSync = fs.readFileSync) {
  try {
    const raw = YAML.parse(readFileSync(options.configPath, 'utf8'))
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !raw.System || typeof raw.System !== 'object') throw new Error()
    const provider = options.provider ?? raw.System.ONE_BOT_PROVIDER ?? 'external'
    if (!['napcat', 'snowluma', 'external'].includes(provider)) throw new Error()
    const config = normalizeRuntimeConfig({...raw, System: {...raw.System, ONE_BOT_PROVIDER: provider}})
    if (typeof config.ONE_BOT_CREDENTIALS_FILE !== 'string' || !config.ONE_BOT_CREDENTIALS_FILE) throw new Error()
    return config
  } catch { throw fail('ONEBOT_CONFIG_INVALID') }
}

async function main(args = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout
  const stderr = dependencies.stderr ?? process.stderr
  try {
    const options = parseArgs(args)
    const config = loadConfig(options, dependencies.readFileSync)
    const axios = dependencies.axios ?? require('axios')
    const result = await checkOneBotReadiness({config, axios, env: dependencies.env,
      readFileSync: dependencies.readFileSync})
    // Provider strings and remote errors are untrusted; never echo them.
    stdout.write(`${JSON.stringify({provider: config.ONE_BOT_PROVIDER, compatible: result.compatible,
      loggedIn: result.loggedIn, groupCount: result.groupCount,
      code: result.error ? safeCode({code: result.error}) : result.compatible ? 'ONEBOT_OK' : 'ONEBOT_PROVIDER_MISMATCH'})}\n`)
    return result.compatible && result.loggedIn && !result.error ? 0 : 1
  } catch (error) {
    stderr.write(`${safeCode(error)}\n`)
    return 1
  }
}

if (require.main === module) main().then((code) => { process.exitCode = code })
module.exports = {main, parseArgs, loadConfig, safeCode}
