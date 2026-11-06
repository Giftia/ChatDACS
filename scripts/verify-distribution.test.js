'use strict'

const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const zlib = require('node:zlib')
const {EventEmitter} = require('node:events')
const {Readable} = require('node:stream')
const {verifyDistribution, verifyLauncher, extractedStartup, extractZip, entryPath, entryKind, linkTarget, resolveLink, decodeEntry} = require('./verify-distribution')

const roots = new Set()
function temporary() {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'chatdacs-distribution-test-'))
  roots.add(root)
  return root
}
function remove(root) {
  if (!fs.existsSync(root)) return
  const resolved = fs.realpathSync(root)
  if (!roots.has(root) || path.dirname(resolved) !== fs.realpathSync(os.tmpdir()) ||
      !path.basename(resolved).startsWith('chatdacs-distribution-')) throw new Error('Unowned test directory')
  const restore = file => {
    const stat = fs.lstatSync(file)
    if (stat.isSymbolicLink()) return
    fs.chmodSync(file, stat.isDirectory() ? 0o700 : 0o600)
    if (stat.isDirectory()) for (const name of fs.readdirSync(file)) restore(path.join(file, name))
  }
  restore(root)
  // A copied executable may still be briefly locked on Windows after the probe.
  fs.rmSync(root, {recursive: true, force: true, maxRetries: 6, retryDelay: 100})
}
afterEach(() => { for (const root of roots) remove(root); roots.clear() })

function entry(fileName, content = '', mode = 0o100644, overrides = {}) {
  const payload = Buffer.isBuffer(content) ? content : Buffer.from(content)
  const compressed = zlib.deflateRawSync(payload)
  return {fileName, versionMadeBy: 3 << 8, externalFileAttributes: (mode << 16) >>> 0,
    compressionMethod: 8, compressedSize: compressed.length, uncompressedSize: payload.length,
    crc32: zlib.crc32(payload), generalPurposeBitFlag: 0, compressed, ...overrides}
}

// Entry-stream fixtures deliberately fake only yauzl's I/O boundary, not path/mode/inflate logic.
function fixtureLoad(entries) {
  return name => {
    expect(name).toBe('yauzl')
    return {open(_file, options, done) {
      expect(options).toMatchObject({lazyEntries: true, strictFileNames: true, autoClose: false})
      const zip = new EventEmitter()
      let cursor = 0, closed = false
      zip.close = () => { if (!closed) { closed = true; zip.emit('close') } }
      zip.readEntry = () => queueMicrotask(() => {
        if (!closed) cursor === entries.length ? zip.emit('end') : zip.emit('entry', entries[cursor++])
      })
      zip.openReadStream = (item, readOptions, callback) => {
        expect(readOptions).toEqual(item.compressionMethod === 8 ? {decompress: false} : {})
        callback(null, Readable.from([item.compressed]))
      }
      done(null, zip)
    }}
  }
}

test.each(['../escape', 'a/../escape', '/absolute', '//unc/share', 'C:/drive', 'C:drive', 'a\\b',
  'a//b', './a', 'a/./b', 'a\0b', 'a:stream', 'NUL.txt', 'a/COM1', 'a/file.', 'a/file '])('rejects unsafe ZIP path %j', name => {
  expect(() => entryPath(name)).toThrow('DISTRIBUTION_UNSAFE_PATH')
})
test('ordinary paths and directory markers remain unchanged', () => {
  expect(entryPath('node_modules/@scope/package/bin.js')).toBe('node_modules/@scope/package/bin.js')
  expect(entryPath('plugins/')).toBe('plugins')
})
test.each([0o010644, 0o020644, 0o060644, 0o140644, 0o104755])('rejects exceptional/setuid ZIP type %#', mode => {
  expect(() => entryKind(entry('bad', '', mode))).toThrow('DISTRIBUTION_UNSAFE_TYPE')
})
test('inflate is bounded, CRC checked and declared length enforced', () => {
  const item = entry('good', 'payload')
  expect(decodeEntry(item, item.compressed).toString()).toBe('payload')
  expect(() => decodeEntry({...item, crc32: 1}, item.compressed)).toThrow('DISTRIBUTION_CRC_MISMATCH')
  expect(() => decodeEntry({...item, uncompressedSize: 2}, item.compressed)).toThrow('DISTRIBUTION_SIZE_MISMATCH')
  const bomb = entry('bomb', 'x'.repeat(1000), 0o100644, {uncompressedSize: 1})
  expect(() => decodeEntry(bomb, bomb.compressed, 32)).toThrow('DISTRIBUTION_INFLATE_FAILED')
})
test.each(['/outside', '../a\\b', 'C:/outside', 'C:outside', 'name\0bad'])('rejects absolute or platform-ambiguous symlink %j', target => {
  expect(() => linkTarget(Buffer.from(target))).toThrow('DISTRIBUTION_UNSAFE_LINK')
})
test('component-wise link resolution catches traversal through an earlier link and cycles', () => {
  expect(resolveLink('dir/link', '../target', new Map())).toBe('target')
  expect(() => resolveLink('link', '../outside', new Map())).toThrow('DISTRIBUTION_UNSAFE_LINK')
  expect(() => resolveLink('a', 'b', new Map([['a', 'b'], ['b', 'a']]))).toThrow('DISTRIBUTION_UNSAFE_LINK')
  expect(() => resolveLink('link', 'alias/../../outside', new Map([['alias', '.']]))).toThrow('DISTRIBUTION_UNSAFE_LINK')
})
test('fake ZIP extraction preserves payload and requests the recorded Unix modes', async () => {
  const destination = temporary()
  const chmod = jest.spyOn(fs, 'chmodSync')
  try {
    await extractZip({zipFile: 'fixture.zip', destination, load: fixtureLoad([
      entry('bin/', '', 0o040755), entry('bin/tool', 'script', 0o100755), entry('private.txt', 'data', 0o100640),
    ])})
    expect(fs.readFileSync(path.join(destination, 'bin/tool'), 'utf8')).toBe('script')
    expect(chmod).toHaveBeenCalledWith(path.join(destination, 'bin/tool'), 0o755)
    expect(chmod).toHaveBeenCalledWith(path.join(destination, 'private.txt'), 0o640)
    if (process.platform !== 'win32') expect(fs.statSync(path.join(destination, 'bin/tool')).mode & 0o777).toBe(0o755)
  } finally { chmod.mockRestore() }
})

let symlinkTest = test
{
  const probe = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-distribution-link-probe-'))
  try { fs.symlinkSync('target', path.join(probe, 'link'), 'file') } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error
    console.warn('SYMLINK_TEST_SKIPPED: Windows cannot create relative symlinks without privilege/developer mode')
    symlinkTest = test.skip
  } finally { fs.rmSync(probe, {recursive: true, force: true}) }
}
symlinkTest('relative symlinks survive extraction without becoming absolute or changing targets', async () => {
  const destination = temporary()
  await extractZip({zipFile: 'fixture.zip', destination, load: fixtureLoad([
    entry('target', 'target data'), entry('bin/link', '../target', 0o120777),
  ])})
  const target = fs.readlinkSync(path.join(destination, 'bin/link'))
  expect(path.isAbsolute(target)).toBe(false)
  expect(target.replaceAll('\\', '/')).toBe('../target')
  expect(fs.readFileSync(path.join(destination, 'bin/link'), 'utf8')).toBe('target data')
})
test.each([
  [entry('link', '../outside', 0o120777)],
  [entry('link', '.', 0o120777), entry('link/child', 'bad')],
  [entry('a', 'one'), entry('a', 'two')],
  [entry('bad/', '', 0o100644)],
  [entry('bad', '', 0o040755)],
  [entry('encrypted', '', 0o100644, {generalPurposeBitFlag: 1})],
])('malformed ZIP entries reject before unsafe extraction %#', async entries => {
  await expect(extractZip({zipFile: 'fixture.zip', destination: temporary(), load: fixtureLoad(entries)})).rejects.toThrow(/DISTRIBUTION_/)
})
test('total extraction limit is separate from the per-entry bound', async () => {
  await expect(extractZip({zipFile: 'fixture.zip', destination: temporary(),
    load: fixtureLoad([entry('a', '123'), entry('b', '456')]), limits: {entry: 100, total: 5, entries: 10}}))
    .rejects.toThrow('DISTRIBUTION_TOTAL_LIMIT')
})
test('stored ZIP entries use the yauzl stored-stream API without a decompress option', async () => {
  const destination = temporary()
  await extractZip({zipFile: 'stored.zip', destination, load: fixtureLoad([
    entry('stored', 'plain', 0o100644, {compressionMethod: 0, compressed: Buffer.from('plain'), compressedSize: 5}),
  ])})
  expect(fs.readFileSync(path.join(destination, 'stored'), 'utf8')).toBe('plain')
})
test('ZIP open timeout closes a handle delivered after timeout', async () => {
  jest.useFakeTimers()
  let callback
  const pending = extractZip({zipFile: 'fixture.zip', destination: temporary(), timeoutMs: 10,
    load: () => ({open(_file, _options, done) { callback = done }})})
  const checked = expect(pending).rejects.toThrow('DISTRIBUTION_EXTRACT_TIMEOUT')
  await jest.advanceTimersByTimeAsync(10)
  await checked
  const zip = {close: jest.fn()}
  callback(null, zip)
  expect(zip.close).toHaveBeenCalledTimes(1)
  jest.useRealTimers()
})

const manifest = {target: `${{win32: 'win', linux: 'linux', darwin: 'macos'}[process.platform]}-${process.arch}`,
  runtime: process.platform === 'win32' ? 'runtime/node.exe' : 'runtime/node',
  entrypoint: process.platform === 'win32' ? 'ChatDACS.cmd' : 'chatdacs', nodeVersion: process.version,
  runtimeArch: process.arch, compatibility: 'native'}
function packageEntries() {
  return [entry('release-manifest.json', JSON.stringify(manifest)), entry('index.js', 'DELIVERED_APP_NOT_EXECUTED'),
    entry('package.json', JSON.stringify({engines: {node: process.versions.node}})), entry(manifest.runtime, 'runtime payload', 0o100755),
    entry(manifest.entrypoint, require('./build-release').createLauncherFiles(manifest.target)[0].content, 0o100755),
    entry('scripts/verify-startup.js', 'guard payload')]
}
function fakeRun() {
  return jest.fn(async (file, args, options) => {
    if (args[0] === '-p') return JSON.stringify({version: process.version, arch: process.arch, platform: process.platform})
    if (args[0] === '-e') return JSON.stringify({ok: true, modules: ['canvas', 'sqlite3', 'nodejs-jieba', 'sharp']})
    const root = path.dirname(options.cwd)
    return JSON.stringify({argv: ['distribution-probe', 'argument with spaces', 'literal&value'],
      cwd: path.join(root, 'launcher fixture with spaces'), execPath: path.join(root, 'launcher fixture with spaces', manifest.runtime),
      version: process.version, arch: process.arch})
  })
}
test('all probes use extracted artifact paths; delivered index stays untouched and success is cleaned', async () => {
  const run = fakeRun()
  let extracted
  const startup = jest.fn(async ({appDir, runtime}) => {
    extracted = appDir
    expect(fs.readFileSync(path.join(appDir, 'index.js'), 'utf8')).toBe('DELIVERED_APP_NOT_EXECUTED')
    expect(runtime).toBe(path.join(appDir, manifest.runtime))
    return {ok: true, graceful: true, httpStatus: 200, ping: true, chatProcess: true, databaseIsolated: true, externalActivity: 0}
  })
  await expect(verifyDistribution({zipFile: 'built.zip', manifest, load: fixtureLoad(packageEntries()), run, startup})).resolves.toMatchObject({ok: true, native: ['canvas', 'sqlite3', 'nodejs-jieba', 'sharp'], launcher: true})
  expect(run.mock.calls[0][0]).toBe(path.join(extracted, manifest.runtime))
  expect(run.mock.calls[1][2].cwd).toBe(extracted)
  expect(startup).toHaveBeenCalledTimes(1)
  expect(fs.existsSync(path.dirname(extracted))).toBe(false)
})
test('runtime mismatch fails before startup and preserves logs but removes extracted applications', async () => {
  const run = fakeRun().mockResolvedValueOnce(JSON.stringify({version: 'v0.0.0', arch: process.arch, platform: process.platform}))
  let caught
  try { await verifyDistribution({zipFile: 'built.zip', manifest, load: fixtureLoad(packageEntries()), run}) }
  catch (error) { caught = error }
  expect(caught.code).toBe('DISTRIBUTION_RUNTIME_MISMATCH')
  const root = path.dirname(caught.logDirectory)
  roots.add(root)
  expect(fs.existsSync(path.join(root, 'extracted'))).toBe(false)
  expect(fs.existsSync(path.join(caught.logDirectory, 'failure.json'))).toBe(true)
})

test.each(['hardcoded entry', 'extra byte'])('rejects launcher template mismatch before execution: %s', async change => {
  const appDir = temporary()
  const template = require('./build-release').createLauncherFiles(manifest.target)[0]
  const content = change === 'hardcoded entry'
    ? template.content.replace(process.platform === 'win32' ? '%~dp0index.js' : '$SCRIPT_DIR/index.js',
      path.join(appDir, 'original-index.js'))
    : template.content + '\n'
  expect(content).not.toBe(template.content)
  fs.writeFileSync(path.join(appDir, manifest.entrypoint), content)
  const run = jest.fn()
  await expect(verifyLauncher({appDir, manifest, workDir: path.join(appDir, 'work'), run}))
    .rejects.toThrow('DISTRIBUTION_LAUNCHER_TEMPLATE_MISMATCH')
  expect(run).not.toHaveBeenCalled()
  expect(fs.existsSync(path.join(appDir, 'work'))).toBe(false)
})

test('startup uses the checkout guard without loading extracted top-level code', async () => {
  const appDir = temporary()
  const marker = path.join(appDir, 'untrusted-guard-executed')
  fs.mkdirSync(path.join(appDir, 'scripts'))
  fs.writeFileSync(path.join(appDir, 'scripts', 'verify-startup.js'),
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed'); throw new Error('UNTRUSTED_GUARD')`)
  const guard = jest.spyOn(require('./verify-startup'), 'verifyStartup').mockResolvedValue({ok: true})
  try {
    const runtime = path.join(appDir, manifest.runtime)
    await expect(extractedStartup({appDir, runtime, timeoutMs: 60000})).resolves.toEqual({ok: true})
    expect(guard).toHaveBeenCalledWith({appDir, nodePath: runtime, deadlineMs: 45000})
    expect(fs.existsSync(marker)).toBe(false)
    expect(require.cache[path.join(appDir, 'scripts', 'verify-startup.js')]).toBeUndefined()
  } finally { guard.mockRestore() }
})

test('real producer launcher runs a probe from a spaced external cwd using its copied runtime', async () => {
  const root = temporary()
  const appDir = path.join(root, 'source artifact')
  const workDir = path.join(root, 'verification')
  fs.mkdirSync(path.join(appDir, 'runtime'), {recursive: true})
  fs.mkdirSync(path.join(workDir, 'logs'), {recursive: true})
  const {createLauncherFiles} = require('./build-release')
  const launcher = createLauncherFiles(manifest.target)[0]
  fs.writeFileSync(path.join(appDir, launcher.name), launcher.content, {mode: launcher.mode})
  fs.chmodSync(path.join(appDir, launcher.name), launcher.mode)
  fs.copyFileSync(process.execPath, path.join(appDir, manifest.runtime))
  fs.chmodSync(path.join(appDir, manifest.runtime), 0o755)
  fs.writeFileSync(path.join(appDir, 'index.js'), 'process.exit(99)')
  await expect(verifyLauncher({appDir, manifest, workDir})).resolves.toMatchObject({ok: true, argv: true, cwd: true, builtinRuntime: true})
  expect(fs.readFileSync(path.join(appDir, 'index.js'), 'utf8')).toBe('process.exit(99)')
}, 20000)
