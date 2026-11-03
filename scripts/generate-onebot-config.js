'use strict'

const fs = require('fs')
const {execFileSync} = require('child_process')
const os = require('os')
const {buildProviderConfigFromRuntime} = require('../src/bots/qq/oneBotProvider')
const {parseArgs, loadConfig, safeCode} = require('./check-onebot')
const fail = (code) => Object.assign(new Error(code), {code})

function writePrivateConfig(outputPath, content) {
  // This suffix is covered by both .gitignore and release-file filtering.
  if (!/\.credentials\.json$/.test(outputPath)) throw fail('ONEBOT_OUTPUT_INVALID')
  let fd
  try {
    fd = fs.openSync(outputPath, 'wx', 0o600)
    if (process.platform === 'win32') {
      execFileSync('icacls.exe', [outputPath, '/inheritance:r', '/grant:r', `${os.userInfo().username}:(F)`],
        {stdio: 'pipe', windowsHide: true})
    } else fs.fchmodSync(fd, 0o600)
    fs.writeFileSync(fd, content, 'utf8')
  } catch {
    if (fd !== undefined) {
      fs.closeSync(fd)
      fd = undefined
      try { fs.unlinkSync(outputPath) } catch { /* Only remove the file created by this invocation. */ }
    }
    throw fail('ONEBOT_OUTPUT_FAILED')
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

function main(args = process.argv.slice(2), dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout
  const stderr = dependencies.stderr ?? process.stderr
  try {
    const options = parseArgs(args, true)
    if (!/\.credentials\.json$/.test(options.outputPath)) throw fail('ONEBOT_OUTPUT_INVALID')
    const config = loadConfig(options, dependencies.readFileSync)
    const generated = buildProviderConfigFromRuntime({config, eventHost: options.eventHost,
      env: dependencies.env, readFileSync: dependencies.readFileSync})
    ;(dependencies.writePrivateConfig ?? writePrivateConfig)(options.outputPath, `${JSON.stringify(generated, null, 2)}\n`)
    stdout.write('ONEBOT_CONFIG_WRITTEN\n')
    return 0
  } catch (error) {
    stderr.write(`${safeCode(error)}\n`)
    return 1
  }
}

if (require.main === module) process.exitCode = main()
module.exports = {main, writePrivateConfig, parseArgs: (args) => parseArgs(args, true)}
