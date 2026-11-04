'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const zlib = require('node:zlib')
const assert = require('node:assert/strict')
const {createRequire} = require('node:module')
const {execFile} = require('node:child_process')

const LIMITS = {entry: 256 * 1024 * 1024, total: 3 * 1024 * 1024 * 1024, entries: 200000}
const owned = new Set()
const fail = code => Object.assign(new Error(code), {code})
const check = (value, code) => { if (!value) throw fail(code) }
const defaultLoad = name => (process.env.ARCHIVER_MODULE_PATH
  ? createRequire(path.join(process.env.ARCHIVER_MODULE_PATH, 'package.json')) : require)(name)
const archiveKey = name => ['win32', 'darwin'].includes(process.platform) ? name.normalize('NFC').toLowerCase() : name

function entryPath(name) {
  check(typeof name === 'string' && name.length > 0 && name.length <= 4096 &&
    !/[\\\x00-\x1f\x7f]/.test(name) && !path.posix.isAbsolute(name) && !path.win32.isAbsolute(name), 'DISTRIBUTION_UNSAFE_PATH')
  const relative = name.endsWith('/') ? name.slice(0, -1) : name
  check(relative.split('/').every(part => part && part !== '.' && part !== '..' &&
    !/[:*?"<>|]/.test(part) && !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),
  'DISTRIBUTION_UNSAFE_PATH')
  return relative
}

function entryKind(entry) {
  const mode = (entry.externalFileAttributes >>> 16) & 0xffff
  const type = mode & 0o170000
  check([0, 0o100000, 0o040000, 0o120000].includes(type) && !(mode & 0o7000), 'DISTRIBUTION_UNSAFE_TYPE')
  const directory = entry.fileName.endsWith('/')
  check(!((type === 0o100000 || type === 0o120000) && directory) &&
    !(type === 0o040000 && !directory) && !((entry.externalFileAttributes & 0x10) && !directory), 'DISTRIBUTION_UNSAFE_TYPE')
  return {type: type === 0o120000 ? 'symlink' : directory ? 'directory' : 'file',
    mode: mode ? mode & 0o777 : directory ? 0o755 : 0o644}
}

function linkTarget(payload) {
  check(payload.length > 0 && payload.length <= 4096, 'DISTRIBUTION_UNSAFE_LINK')
  let target
  try { target = new TextDecoder('utf-8', {fatal: true}).decode(payload) } catch (_) { throw fail('DISTRIBUTION_UNSAFE_LINK') }
  check(!/[\\\x00-\x1f\x7f:*?"<>|]/.test(target) && !path.posix.isAbsolute(target) && !path.win32.isAbsolute(target) &&
    target.split('/').every(part => part && (part === '.' || part === '..' || (!/[. ]$/.test(part) &&
      !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))), 'DISTRIBUTION_UNSAFE_LINK')
  return target
}

function resolveLink(name, target, links) {
  const queue = [...name.split('/').slice(0, -1), ...target.split('/')]
  const parts = []
  let followed = 0
  while (queue.length) {
    const part = queue.shift()
    if (part === '.') continue
    if (part === '..') {
      check(parts.length > 0, 'DISTRIBUTION_UNSAFE_LINK')
      parts.pop()
      continue
    }
    parts.push(part)
    const key = parts.join('/')
    const link = links.get(archiveKey(key))
    if (link !== undefined) {
      check(++followed <= 40, 'DISTRIBUTION_UNSAFE_LINK')
      parts.pop()
      queue.unshift(...link.split('/'))
    }
  }
  return parts.join('/')
}

function decodeEntry(entry, compressed, maxBytes = LIMITS.entry) {
  check(!(entry.generalPurposeBitFlag & 1) && [0, 8].includes(entry.compressionMethod), 'DISTRIBUTION_UNSUPPORTED_COMPRESSION')
  check(Number.isSafeInteger(entry.uncompressedSize) && entry.uncompressedSize >= 0 && entry.uncompressedSize <= maxBytes &&
    Number.isSafeInteger(entry.compressedSize) && entry.compressedSize >= 0 && entry.compressedSize <= maxBytes &&
    compressed.length === entry.compressedSize, 'DISTRIBUTION_ENTRY_LIMIT')
  let payload
  try { payload = entry.compressionMethod === 0 ? compressed : zlib.inflateRawSync(compressed, {maxOutputLength: maxBytes}) }
  catch (_) { throw fail('DISTRIBUTION_INFLATE_FAILED') }
  check(payload.length === entry.uncompressedSize && payload.length <= maxBytes, 'DISTRIBUTION_SIZE_MISMATCH')
  check(zlib.crc32(payload) === (entry.crc32 >>> 0), 'DISTRIBUTION_CRC_MISMATCH')
  return payload
}

async function extractZip({zipFile, destination, load = defaultLoad, timeoutMs = 120000, limits = LIMITS}) {
  const yauzl = load('yauzl')
  const deadline = Date.now() + timeoutMs
  const seen = new Map(), links = new Map(), directories = []
  let bytes = 0, count = 0
  await new Promise((resolve, reject) => {
    let zip, stream, settled = false, ended = false
    const timer = setTimeout(() => finish(fail('DISTRIBUTION_EXTRACT_TIMEOUT')), timeoutMs)
    function finish(error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stream?.destroy()
      zip?.close()
      if (error) reject(/^DISTRIBUTION_[A-Z_]+$/.test(error.code) ? error : fail('DISTRIBUTION_EXTRACT_FAILED'))
      else resolve()
    }
    try { yauzl.open(zipFile, {lazyEntries: true, autoClose: false, strictFileNames: true, validateEntrySizes: true}, (error, opened) => {
      if (settled) { opened?.close(); return }
      if (error) return finish(error)
      zip = opened
      zip.on('error', finish)
      zip.on('close', () => { if (!ended) finish(fail('DISTRIBUTION_PREMATURE_CLOSE')) })
      zip.on('end', () => { ended = true; finish() })
      zip.on('entry', entry => {
        if (settled) return
        let relative, kind, output
        try {
          check(Date.now() < deadline, 'DISTRIBUTION_EXTRACT_TIMEOUT')
          relative = entryPath(entry.fileName)
          kind = entryKind(entry)
          check(!(entry.generalPurposeBitFlag & 1) && [0, 8].includes(entry.compressionMethod), 'DISTRIBUTION_UNSUPPORTED_COMPRESSION')
          const key = archiveKey(relative)
          check(!seen.has(key), 'DISTRIBUTION_DUPLICATE_ENTRY')
          seen.set(key, kind.type)
          check(++count <= limits.entries, 'DISTRIBUTION_ENTRY_COUNT_LIMIT')
          check(entry.uncompressedSize <= limits.entry && entry.compressedSize <= limits.entry &&
            bytes + entry.uncompressedSize <= limits.total, 'DISTRIBUTION_TOTAL_LIMIT')
          bytes += entry.uncompressedSize
          output = path.join(destination, ...relative.split('/'))
          if (kind.type === 'directory') {
            check(entry.uncompressedSize === 0, 'DISTRIBUTION_UNSAFE_TYPE')
            fs.mkdirSync(output, {recursive: true})
            directories.push([output, kind.mode])
            zip.readEntry()
            return
          }
        } catch (error) { finish(error); return }
        try { zip.openReadStream(entry, entry.compressionMethod === 8 ? {decompress: false} : {}, (error, input) => {
          if (settled) { input?.destroy(); return }
          if (error) return finish(error)
          stream = input
          const chunks = []
          let size = 0
          input.on('error', finish)
          input.on('data', chunk => {
            if (settled) return
            size += chunk.length
            if (size > limits.entry || size > entry.compressedSize) finish(fail('DISTRIBUTION_ENTRY_LIMIT'))
            else chunks.push(chunk)
          })
          input.on('end', () => {
            if (settled) return
            try {
              const payload = decodeEntry(entry, Buffer.concat(chunks), limits.entry)
              check(Date.now() < deadline, 'DISTRIBUTION_EXTRACT_TIMEOUT')
              if (kind.type === 'symlink') links.set(relative, linkTarget(payload))
              else {
                fs.mkdirSync(path.dirname(output), {recursive: true})
                fs.writeFileSync(output, payload, {flag: 'wx', mode: kind.mode})
                fs.chmodSync(output, kind.mode)
              }
              zip.readEntry()
            } catch (error) { finish(error) }
          })
        }) } catch (error) { finish(error) }
      })
      zip.readEntry()
    }) } catch (error) { finish(error) }
  })
  // No filesystem links exist while entry payloads are written.
  const linkIndex = new Map([...links].map(([name, target]) => [archiveKey(name), target]))
  for (const key of seen.keys()) {
    check(Date.now() < deadline, 'DISTRIBUTION_EXTRACT_TIMEOUT')
    const parts = key.split('/')
    for (let i = 1; i < parts.length; i++) check(!linkIndex.has(parts.slice(0, i).join('/')), 'DISTRIBUTION_UNSAFE_LINK')
  }
  for (const [name, target] of links) {
    check(Date.now() < deadline, 'DISTRIBUTION_EXTRACT_TIMEOUT')
    const resolved = resolveLink(name, target, linkIndex)
    const type = seen.get(archiveKey(resolved)) === 'directory' ? 'dir' : 'file'
    const output = path.join(destination, ...name.split('/'))
    fs.mkdirSync(path.dirname(output), {recursive: true})
    try { fs.symlinkSync(target, output, type) } catch (error) {
      if (process.platform === 'win32' && error.code === 'EPERM') throw fail('DISTRIBUTION_SYMLINK_UNAVAILABLE')
      throw fail('DISTRIBUTION_SYMLINK_FAILED')
    }
  }
  for (const [directory, mode] of directories.sort((a, b) => b[0].length - a[0].length)) {
    check(Date.now() < deadline, 'DISTRIBUTION_EXTRACT_TIMEOUT')
    fs.chmodSync(directory, mode)
  }
  return {entries: count, bytes, symlinks: links.size}
}

function cleanEnvironment() {
  const env = {...process.env}
  for (const key of Object.keys(env)) {
    if (/TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL|PROXY/i.test(key) || ['NODE_OPTIONS', 'NODE_PATH', 'CHATDACS_DB_PATH'].includes(key)) delete env[key]
  }
  return env
}

function runCommand(file, args, {cwd, timeout, logFile, env = cleanEnvironment()}) {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, {cwd, env, timeout, maxBuffer: 2 * 1024 * 1024,
      shell: false, windowsHide: true, windowsVerbatimArguments: path.basename(file).toLowerCase() === 'cmd.exe',
      encoding: 'utf8'}, (error, stdout, stderr) => {
      try { fs.writeFileSync(logFile, `${stdout ?? ''}\n${stderr ?? ''}`, {mode: 0o600}) }
      catch (_) { reject(fail('DISTRIBUTION_LOG_FAILED')); return }
      if (error) reject(fail(error.killed ? 'DISTRIBUTION_EXEC_TIMEOUT' : 'DISTRIBUTION_EXEC_FAILED'))
      else resolve(stdout)
    })
    child.stdin?.end()
  })
}

async function nativeProbe() {
  const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
  const root = fs.realpathSync(process.cwd())
  const load = require('node:module').createRequire(path.join(root, 'package.json'))
  const modules = ['canvas', 'sqlite3', 'nodejs-jieba', 'sharp']
  for (const name of modules) {
    const relative = path.relative(root, fs.realpathSync(load.resolve(name)))
    assert(!relative.startsWith('..') && !path.isAbsolute(relative))
  }
  assert(load('canvas').createCanvas(2, 2).toBuffer('image/png').length > 0)
  const sqlite = load('sqlite3')
  const db = await new Promise((resolve, reject) => {
    const db = new sqlite.Database(':memory:', error => error ? reject(error) : resolve(db))
  })
  try {
    const row = await new Promise((resolve, reject) => db.get('SELECT 1 AS ok', (error, row) => error ? reject(error) : resolve(row)))
    assert.equal(row.ok, 1)
  } finally { await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve())) }
  assert(load('nodejs-jieba').cut('distribution probe').length > 0)
  assert((await load('sharp')({create: {width: 2, height: 2, channels: 3, background: 'red'}}).png().toBuffer()).length > 0)
  console.log(JSON.stringify({ok: true, modules}))
}

function jsonOutput(output) {
  try { return JSON.parse(String(output).trim().split(/\r?\n/).at(-1)) }
  catch (_) { throw fail('DISTRIBUTION_PROBE_OUTPUT_INVALID') }
}

async function extractedStartup({appDir, runtime, timeoutMs}) {
  const {verifyStartup} = require('./verify-startup')
  return verifyStartup({appDir, nodePath: runtime, deadlineMs: Math.min(45000, timeoutMs)})
}

async function verifyLauncher({appDir, manifest, workDir, run = runCommand, timeoutMs = 15000}) {
  const launcher = path.join(appDir, manifest.entrypoint)
  const template = require('./build-release').createLauncherFiles(manifest.target)
    .find(file => file.name === manifest.entrypoint)
  check(template && fs.readFileSync(launcher).equals(Buffer.from(template.content, 'utf8')),
    'DISTRIBUTION_LAUNCHER_TEMPLATE_MISMATCH')
  const fixture = path.join(workDir, 'launcher fixture with spaces')
  const caller = path.join(workDir, 'external caller with spaces')
  fs.mkdirSync(path.join(fixture, 'runtime'), {recursive: true})
  fs.mkdirSync(caller, {recursive: true})
  const runtime = path.join(appDir, manifest.runtime)
  const fixtureRuntime = path.join(fixture, manifest.runtime), fixtureLauncher = path.join(fixture, manifest.entrypoint)
  fs.copyFileSync(runtime, fixtureRuntime)
  fs.copyFileSync(launcher, fixtureLauncher)
  fs.chmodSync(fixtureRuntime, fs.statSync(runtime).mode & 0o777)
  fs.chmodSync(fixtureLauncher, fs.statSync(launcher).mode & 0o777)
  if (process.platform !== 'win32') check((fs.statSync(fixtureLauncher).mode & 0o111) !== 0, 'DISTRIBUTION_EXECUTABLE_MODE')
  fs.writeFileSync(path.join(fixture, 'index.js'), "console.log(JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd(),execPath:process.execPath,version:process.version,arch:process.arch}))\n")
  const argv = ['distribution-probe', 'argument with spaces', 'literal&value']
  const command = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe') : fixtureLauncher
  const args = process.platform === 'win32' ? ['/d', '/v:off', '/s', '/c', `""${fixtureLauncher}" ${argv.map(arg => `"${arg}"`).join(' ')}"`] : argv
  const probe = jsonOutput(await run(command, args, {cwd: caller, timeout: timeoutMs,
    logFile: path.join(workDir, 'logs', 'launcher.log'), env: cleanEnvironment()}))
  assert.deepEqual(probe.argv, argv)
  check(fs.realpathSync(probe.cwd) === fs.realpathSync(fixture), 'DISTRIBUTION_LAUNCHER_CWD')
  check(fs.realpathSync(probe.execPath) === fs.realpathSync(fixtureRuntime) && probe.version === manifest.nodeVersion &&
    probe.arch === manifest.runtimeArch, 'DISTRIBUTION_LAUNCHER_RUNTIME')
  return {ok: true, argv: true, cwd: true, builtinRuntime: true, executable: process.platform !== 'win32' ? true : null}
}

function removeOwned(directory) {
  check(owned.has(directory) && path.dirname(directory) === fs.realpathSync(os.tmpdir()) &&
    path.basename(directory).startsWith('chatdacs-distribution-'), 'DISTRIBUTION_CLEANUP_REFUSED')
  const prepare = item => {
    const stat = fs.lstatSync(item)
    if (stat.isSymbolicLink()) return
    fs.chmodSync(item, stat.isDirectory() ? 0o700 : 0o600)
    if (stat.isDirectory()) for (const name of fs.readdirSync(item)) prepare(path.join(item, name))
  }
  prepare(directory)
  fs.rmSync(directory, {recursive: true, force: true})
  owned.delete(directory)
}

async function verifyDistribution({zipFile, manifest, load = defaultLoad, run = runCommand, startup = extractedStartup,
  timeoutMs = 300000}) {
  check(Number.isInteger(timeoutMs) && timeoutMs >= 100 && timeoutMs <= 600000, 'DISTRIBUTION_TIMEOUT_INVALID')
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'chatdacs-distribution-'))
  owned.add(root)
  const appDir = path.join(root, 'extracted'), fixture = path.join(root, 'launcher fixture with spaces')
  const caller = path.join(root, 'external caller with spaces'), logs = path.join(root, 'logs')
  for (const directory of [appDir, fixture, caller, logs]) fs.mkdirSync(directory, {mode: 0o700})
  const deadline = Date.now() + timeoutMs
  const budget = cap => { const time = Math.min(cap, deadline - Date.now()); check(time >= 100, 'DISTRIBUTION_TIMEOUT'); return time }
  let success = false, keepApplication = false
  try {
    const windows = process.platform === 'win32'
    const platform = {win32: 'win', linux: 'linux', darwin: 'macos'}[process.platform]
    check(manifest && new RegExp(`^${platform}-(?:x64|arm64)$`).test(manifest.target) && /^v\d+\.\d+\.\d+$/.test(manifest.nodeVersion) &&
      ['x64', 'arm64'].includes(manifest.runtimeArch), 'DISTRIBUTION_MANIFEST_INVALID')
    const expectedCompatibility = manifest.target.endsWith(`-${manifest.runtimeArch}`) ? 'native' :
      manifest.target === 'win-arm64' && manifest.runtimeArch === 'x64' ? 'x64-emulation' : null
    check(expectedCompatibility && manifest.compatibility === expectedCompatibility, 'DISTRIBUTION_MANIFEST_INVALID')
    check(manifest.runtime === (windows ? 'runtime/node.exe' : 'runtime/node') &&
      manifest.entrypoint === (windows ? 'ChatDACS.cmd' : 'chatdacs'), 'DISTRIBUTION_MANIFEST_INVALID')
    const extracted = await extractZip({zipFile, destination: appDir, load, timeoutMs: budget(120000)})
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(appDir, 'release-manifest.json'), 'utf8')), manifest)
    const runtime = path.join(appDir, manifest.runtime)
    const launcher = path.join(appDir, manifest.entrypoint)
    if (!windows) check((fs.statSync(runtime).mode & 0o111) && (fs.statSync(launcher).mode & 0o111), 'DISTRIBUTION_EXECUTABLE_MODE')
    const execute = (file, args, stage, cwd = appDir, cap = 60000) => run(file, args,
      {cwd, timeout: budget(cap), logFile: path.join(logs, `${stage}.log`), env: cleanEnvironment()})
    const actual = jsonOutput(await execute(runtime, ['-p', 'JSON.stringify({version:process.version,arch:process.arch,platform:process.platform})'], 'runtime'))
    check(actual.version === manifest.nodeVersion && actual.arch === manifest.runtimeArch && actual.platform === process.platform,
      'DISTRIBUTION_RUNTIME_MISMATCH')
    const native = jsonOutput(await execute(runtime, ['-e', `(${nativeProbe.toString()})().catch(()=>process.exitCode=1)`], 'native'))
    check(native.ok === true && ['canvas', 'sqlite3', 'nodejs-jieba', 'sharp'].every(name => native.modules?.includes(name)), 'DISTRIBUTION_NATIVE_FAILED')
    check(fs.statSync(path.join(appDir, 'scripts/verify-startup.js')).isFile(), 'DISTRIBUTION_STARTUP_MISSING')
    const started = await startup({appDir, runtime, timeoutMs: budget(60000)})
    fs.writeFileSync(path.join(logs, 'startup.log'), JSON.stringify(started), {mode: 0o600})
    check(started?.ok === true && started.graceful === true && started.httpStatus === 200 && started.ping === true &&
      started.chatProcess === true && started.databaseIsolated === true && started.externalActivity === 0, 'DISTRIBUTION_STARTUP_FAILED')
    budget(60000)
    await verifyLauncher({appDir, manifest, workDir: root, run, timeoutMs: budget(15000)})
    success = true
    return {ok: true, ...extracted, runtime: actual, native: native.modules, startup: true, launcher: true}
  } catch (error) {
    keepApplication = error?.code === 'STARTUP_CHILD_STILL_RUNNING'
    const code = keepApplication ? 'DISTRIBUTION_STARTUP_CHILD_STILL_RUNNING' :
      /^DISTRIBUTION_[A-Z_]+$/.test(error?.code) ? error.code : 'DISTRIBUTION_VERIFICATION_FAILED'
    fs.writeFileSync(path.join(logs, 'failure.json'), JSON.stringify({code}), {mode: 0o600})
    throw Object.assign(fail(code), {logDirectory: logs})
  } finally {
    if (success) {
      try { removeOwned(root) } catch (_) { throw Object.assign(fail('DISTRIBUTION_CLEANUP_FAILED'), {logDirectory: logs}) }
    } else if (keepApplication) owned.delete(root)
    else {
      // Preserve only bounded diagnostic logs on failure, never an application copy.
      try { for (const directory of [appDir, fixture, caller]) {
        const restore = item => {
          const stat = fs.lstatSync(item)
          if (stat.isSymbolicLink()) return
          fs.chmodSync(item, stat.isDirectory() ? 0o700 : 0o600)
          if (stat.isDirectory()) for (const name of fs.readdirSync(item)) restore(path.join(item, name))
        }
        restore(directory)
        fs.rmSync(directory, {recursive: true, force: true})
      } } catch (_) {
        try { fs.writeFileSync(path.join(logs, 'cleanup-failure.json'), JSON.stringify({code: 'DISTRIBUTION_CLEANUP_FAILED'}), {mode: 0o600}) } catch (_) {}
      }
      owned.delete(root)
    }
  }
}

module.exports = {verifyDistribution, verifyLauncher, extractedStartup, runCommand, extractZip, entryPath, entryKind, linkTarget, resolveLink, decodeEntry, LIMITS}
