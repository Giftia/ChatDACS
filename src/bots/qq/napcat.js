'use strict'

const provider = require('./oneBotProvider')

function buildNapCatConfigFromRuntime({config, eventHost = '127.0.0.1', accessToken, env, readFileSync}) {
  return provider.buildProviderConfigFromRuntime({config: {...config, ONE_BOT_PROVIDER: 'napcat'},
    eventHost, accessToken, env, readFileSync})
}

function createNapCatOneBotConfig(options) {
  return provider.createNapCatOneBotConfig(options)
}

function probeNapCat({apiUrl, axios, timeoutMs = 3000, config = {}, env, readFileSync}) {
  return provider.probeOneBot({config: {...config, ONE_BOT_PROVIDER: 'napcat',
    ONE_BOT_API_URL: apiUrl, ONE_BOT_CONNECT_TIMEOUT_MS: timeoutMs}, axios, env, readFileSync})
}

function verifyNapCatConnection({config, axios, logger = console, env, readFileSync}) {
  return provider.verifyOneBotConnection({config: {...config, ONE_BOT_PROVIDER: 'napcat'},
    axios, logger, env, readFileSync})
}

function checkNapCatReadiness({config, axios, env, readFileSync}) {
  return provider.checkOneBotReadiness({config: {...config, ONE_BOT_PROVIDER: 'napcat'},
    axios, env, readFileSync})
}

module.exports = {buildNapCatConfigFromRuntime, createNapCatOneBotConfig, probeNapCat,
  verifyNapCatConnection, checkNapCatReadiness, normalizeApiBaseUrl: provider.normalizeApiBaseUrl}
