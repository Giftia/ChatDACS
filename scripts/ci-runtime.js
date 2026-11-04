'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const {createRequire} = require('node:module')
const {execFileSync} = require('node:child_process')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function verifyDefinitions() {
  const version = read('.nvmrc').trim()
  assert.match(version, /^\d+\.\d+\.\d+$/)
  assert.equal(JSON.parse(read('package.json')).engines.node, version)
  assert.equal(JSON.parse(read('package-lock.json')).packages[''].engines.node, version)
  const images = [...read('Dockerfile').matchAll(/^FROM node:([^\s]+)/gm)].map(match => match[1])
  assert.deepEqual(images, [`${version}-bookworm`, `${version}-bookworm`])
  assert.equal(process.version, `v${version}`, 'Use the project runtime from .nvmrc')
  return version
}

function runNode(args, cwd = root, runtime = process.execPath) {
  execFileSync(runtime, args, {cwd, stdio: 'inherit'})
}

function npmCli() {
  return process.env.npm_execpath || (process.platform === 'win32'
    ? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
    : fs.realpathSync(path.join(path.dirname(process.execPath), 'npm')))
}

function metadata(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(part => [part.type, part.value]))
  return {VERSION_NUMBER: `v${JSON.parse(read('package.json')).version}`,
    BUILD_TIME: ['year', 'month', 'day', 'hour', 'minute', 'second'].map(key => parts[key]).join('')}
}

function forbiddenEntry(name) {
  const normalized = name.replaceAll('\\', '/').toLowerCase()
  return /^integrations\/qq-official\/(?:checkpoint|platform-query|auth-compatibility)\.md$/.test(normalized)
    || /(?:^|\/)\.credentials(?:\.|\/|$)/i.test(normalized)
    || /\.credentials\.json(?:\.|$)/i.test(normalized)
    || /(?:^|\/)llm-(?:persona|model)-state\.json(?:\.|$)/i.test(normalized)
    || name.split('/').includes('..') || name.startsWith('/') || name.includes('\\')
}

async function verifyZip(file, manifest, runtimeHash) {
  const load = process.env.ARCHIVER_MODULE_PATH ? createRequire(path.join(process.env.ARCHIVER_MODULE_PATH, 'package.json')) : require
  const yauzl = load('yauzl')
  const zip = await new Promise((resolve, reject) => yauzl.open(file, {lazyEntries: true}, (error, zip) => error ? reject(error) : resolve(zip)))
  const found = new Set()
  let timeout
  try { await new Promise((resolve, reject) => {
    timeout = setTimeout(() => { zip.close(); reject(new Error('ZIP verification timed out')) }, 60000)
    let ended = false
    zip.on('error', reject)
    zip.on('end', () => { ended = true; resolve() })
    zip.on('close', () => { if (!ended) reject(new Error('ZIP closed before verification completed')) })
    zip.on('entry', entry => {
      if (forbiddenEntry(entry.fileName)) {
        zip.close()
        reject(new Error('Forbidden ZIP entry detected'))
        return
      }
      found.add(entry.fileName)
      if (![manifest.runtime, 'release-manifest.json'].includes(entry.fileName)) return zip.readEntry()
      // Bound the two inspected payloads and avoid large inflate-stream stalls on Node 26.
      const maxBytes = 256 * 1024 * 1024
      if (entry.compressedSize > maxBytes || entry.uncompressedSize > maxBytes) return reject(new Error('ZIP verification payload exceeds limit'))
      zip.openReadStream(entry, {decompress: false}, (error, stream) => {
        if (error) return reject(error)
        const chunks = []
        stream.on('error', reject)
        stream.on('data', chunk => chunks.push(chunk))
        stream.on('end', () => {
          try {
            const compressed = Buffer.concat(chunks)
            const payload = entry.compressionMethod === 0 ? compressed : zlib.inflateRawSync(compressed, {maxOutputLength: maxBytes})
            assert.equal(payload.length, entry.uncompressedSize)
            if (entry.fileName === manifest.runtime) assert.equal(crypto.createHash('sha256').update(payload).digest('hex'), runtimeHash)
            else assert.deepEqual(JSON.parse(payload.toString('utf8')), manifest)
            zip.readEntry()
          } catch (error) { zip.close(); reject(error) }
        })
      })
    })
    zip.readEntry()
  }) } finally { clearTimeout(timeout); zip.close() }
  for (const required of ['index.js', 'package.json', 'release-manifest.json', manifest.runtime, manifest.entrypoint,
    'README.md', 'LICENSE', 'config/config.yml', 'config/db.db']) assert(found.has(required), `Missing ZIP entry: ${required}`)
  for (const directory of ['static', 'plugins', 'migrations', 'node_modules']) {
    assert([...found].some((entry) => entry.startsWith(`${directory}/`) && !entry.endsWith('/')),
      `Missing ZIP contents: ${directory}/`)
  }
  return found.size
}

async function verifyBundle() {
  const version = verifyDefinitions()
  const {assertBuildTarget, getHostTarget} = require('./build-release')
  const target = process.env.RELEASE_TARGET || getHostTarget()
  assertBuildTarget(target)
  const name = `ChatDACS-v${JSON.parse(read('package.json')).version}_${target}`
  const stage = path.join(root, '.release/stage', name)
  const manifest = JSON.parse(fs.readFileSync(path.join(stage, 'release-manifest.json'), 'utf8'))
  assert.equal(manifest.target, target)
  assert.equal(manifest.nodeVersion, `v${version}`)
  assert.equal(manifest.runtimeArch, process.arch)
  const compatibility = target === 'win-arm64' && process.arch === 'x64' ? 'x64-emulation' : 'native'
  assert.equal(manifest.compatibility, compatibility)
  const runtime = path.join(stage, process.platform === 'win32' ? 'runtime/node.exe' : 'runtime/node')
  assert.equal(manifest.runtime, path.relative(stage, runtime).replaceAll('\\', '/'))
  const actual = JSON.parse(execFileSync(runtime, ['-p', 'JSON.stringify({version:process.version,arch:process.arch,abi:process.versions.modules})'], {encoding: 'utf8'}))
  assert.equal(actual.version, `v${version}`)
  assert.equal(actual.arch, manifest.runtimeArch)
  runNode(['--check', 'index.js'], stage, runtime)
  runNode([path.join(__dirname, 'verify-native-runtime.js')], stage, runtime)
  runNode(['scripts/verify-startup.js'], stage, runtime)
  const hash = crypto.createHash('sha256').update(fs.readFileSync(runtime)).digest('hex')
  const zipFile = path.join(root, '.release', name + '.zip')
  const entries = await verifyZip(zipFile, manifest, hash)
  const {verifyDistribution} = require('./verify-distribution')
  const distribution = await verifyDistribution({zipFile, manifest})
  assert.equal(distribution.ok, true)
  const {auditNativeLinks} = require('./verify-native-links')
  const dependencies = auditNativeLinks({root: stage})
  fs.writeFileSync(path.join(root, '.release', `native-dependencies-${target}.json`),
    JSON.stringify(dependencies, null, 2) + '\n', 'utf8')
  console.log(JSON.stringify({dependencyAudit: dependencies.status,
    requiresExternalLibraries: dependencies.requiresExternalLibraries, missingLibraries: dependencies.missing.length}))
  console.log(JSON.stringify({ok: true, target, compatibility, ...actual, zipEntries: entries,
    extractedStartup: distribution.startup, launcher: distribution.launcher}))
}

async function main(command = process.argv[2]) {
  verifyDefinitions()
  if (command === 'verify' || command === 'production') {
    runNode(['scripts/verify-native-runtime.js'])
    runNode([npmCli(), 'run', command === 'verify' ? 'verify:release' : 'smoke:web'])
    if (command === 'production') runNode([npmCli(), 'run', 'smoke:startup'])
  } else if (command === 'tools') {
    assert(process.env.RUNNER_TEMP && process.env.GITHUB_ENV)
    const toolRoot = path.join(process.env.RUNNER_TEMP, 'chatdacs-build-tools')
    runNode([npmCli(), 'install', '--prefix', toolRoot, '--no-save', '--package-lock=false', '--no-audit', '--no-fund', 'archiver@7.0.1', 'yauzl@3.2.0'])
    fs.appendFileSync(process.env.GITHUB_ENV, `ARCHIVER_MODULE_PATH=${path.join(toolRoot, 'node_modules/archiver')}\n`, 'utf8')
  } else if (command === 'bundle') await verifyBundle()
  else if (command === 'metadata') {
    assert(process.env.GITHUB_ENV)
    fs.appendFileSync(process.env.GITHUB_ENV, Object.entries(metadata()).map(([key, value]) => `${key}=${value}\n`).join(''), 'utf8')
  } else throw new Error(`Unknown CI command: ${command}`)
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
module.exports = {forbiddenEntry, main, metadata, verifyDefinitions, verifyZip}
