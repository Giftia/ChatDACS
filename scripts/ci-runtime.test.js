'use strict'

const fs = require('node:fs')
const path = require('node:path')
const YAML = require('yaml')
jest.mock('node:child_process', () => ({execFileSync: jest.fn()}))
jest.mock('yauzl', () => ({open: jest.fn()}), {virtual: true})

const {execFileSync} = require('node:child_process')
const {forbiddenEntry, main, metadata, verifyDefinitions, verifyZip} = require('./ci-runtime')
const root = path.resolve(__dirname, '..')

test('release verification ends with the isolated startup smoke', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  expect(pkg.scripts['smoke:startup']).toBe('node scripts/verify-startup.js')
  expect(pkg.scripts['verify:release'].split(' && ').at(-1)).toBe('npm run smoke:startup')
})

test('production verifies native modules, Web, then startup without installing dev tools', async () => {
  execFileSync.mockClear()
  await main('production')
  expect(execFileSync.mock.calls.map(call => call[1])).toEqual([
    ['scripts/verify-native-runtime.js'],
    [expect.any(String), 'run', 'smoke:web'],
    [expect.any(String), 'run', 'smoke:startup'],
  ])
  for (const call of execFileSync.mock.calls) {
    expect(call[0]).toBe(process.execPath)
    expect(call[2]).toEqual({cwd: root, stdio: 'inherit'})
  }
})

test('runtime definitions agree with the active runtime', () => {
  expect(verifyDefinitions()).toBe(fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim())
})

test.each(['config/llm.credentials.json', 'config/qq.credentials.json.backup',
  'config/.credentials', 'config/llm-model-state.json.tmp', 'config/llm-persona-state.json', '../escape'])('rejects private ZIP entry %s', file => {
  expect(forbiddenEntry(file)).toBe(true)
})

test('allows ordinary product files', () => {
  expect(forbiddenEntry('config/config.yml')).toBe(false)
  expect(forbiddenEntry('node_modules/canvas/package.json')).toBe(false)
})

test.each(['CHECKPOINT.md', 'PLATFORM-QUERY.md', 'AUTH-COMPATIBILITY.md'])(
  'rejects private QQ integration document %s with normalized case and separators', (name) => {
    for (const file of [`integrations/qq-official/${name}`, `integrations/qq-official/${name.toLowerCase()}`,
      `INTEGRATIONS/QQ-OFFICIAL/${name.toLowerCase()}`, `integrations\\qq-official\\${name}`,
      `InTeGrAtIoNs\\Qq-OfFiCiAl\\${name.toLowerCase()}`]) {
      expect(forbiddenEntry(file)).toBe(true)
    }
  },
)

test.each(['integrations/qq-official/README.md', 'integrations/qq-official/DESIGN.md',
  'INTEGRATIONS/QQ-OFFICIAL/readme.MD', 'integrations/qq-official/Design.md',
  'integrations/qq-official-other/CHECKPOINT.md'])(
  'keeps public and unrelated integration documentation eligible: %s', (file) => {
    expect(forbiddenEntry(file)).toBe(false)
  },
)

test('retains existing ZIP path rejection instead of relaxing it while normalizing privacy checks', () => {
  expect(forbiddenEntry('integrations\\qq-official\\README.md')).toBe(true)
  expect(forbiddenEntry('integrations/../qq-official/README.md')).toBe(true)
  expect(forbiddenEntry('/integrations/qq-official/README.md')).toBe(true)
})

test('metadata uses Shanghai time independently of runner timezone', () => {
  expect(metadata(new Date('2026-11-02T16:01:02Z')).BUILD_TIME).toBe('20261103000102')
})

test('six release targets use explicit runner and runtime architectures', () => {
  const build = YAML.parse(fs.readFileSync(path.join(root, '.github/workflows/build.yml'), 'utf8'))
  expect(build.jobs.build.strategy.matrix.include.map(({os, runs_on, node_arch}) => [os, runs_on, node_arch])).toEqual([
    ['linux-x64', 'ubuntu-24.04', 'x64'], ['linux-arm64', 'ubuntu-24.04-arm', 'arm64'],
    ['win-x64', 'windows-latest', 'x64'], ['win-arm64', 'windows-11-arm', 'x64'],
    ['macos-x64', 'macos-15-intel', 'x64'], ['macos-arm64', 'macos-15', 'arm64'],
  ])
  for (const file of ['ci.yml', 'build.yml']) {
    const workflow = YAML.parse(fs.readFileSync(path.join(root, '.github/workflows', file), 'utf8'))
    expect(workflow.permissions).toEqual({contents: 'read'})
    expect(Object.values(workflow.jobs).every(job => job.permissions === undefined)).toBe(true)
    const job = Object.values(workflow.jobs)[0]
    const setup = job.steps.find(step => step.uses?.startsWith('actions/setup-node@'))
    expect(setup.with['node-version-file']).toBe('.nvmrc')
    expect(setup.with['node-version']).toBeUndefined()
  }
  expect(build.jobs.build.steps.find(step => step.name === 'Install production dependencies').run).toBe('npm ci --omit=dev')
})

describe('ZIP artifact contents', () => {
  const {EventEmitter} = require('node:events')
  const {Readable} = require('node:stream')
  const crypto = require('node:crypto')
  const zlib = require('node:zlib')
  const yauzl = require('yauzl')
  const manifest = {runtime: 'runtime/node', entrypoint: 'chatdacs'}
  const runtimePayload = Buffer.from('mock-runtime-not-an-executable')
  const hash = crypto.createHash('sha256').update(runtimePayload).digest('hex')
  const files = ['index.js', 'package.json', 'release-manifest.json', manifest.runtime, manifest.entrypoint,
    'README.md', 'LICENSE', 'config/config.yml', 'config/db.db',
    'static/index.html', 'plugins/ping.js', 'migrations/fixture.js', 'node_modules/fixture/package.json']
  let originalModulePath
  beforeEach(() => {
    originalModulePath = process.env.ARCHIVER_MODULE_PATH
    delete process.env.ARCHIVER_MODULE_PATH
  })
  afterEach(() => {
    if (originalModulePath === undefined) delete process.env.ARCHIVER_MODULE_PATH
    else process.env.ARCHIVER_MODULE_PATH = originalModulePath
    yauzl.open.mockReset()
  })

  function archive(names, method = 0) {
    const zip = new EventEmitter()
    const entries = names.map((fileName) => {
      const payload = fileName === manifest.runtime ? runtimePayload : fileName === 'release-manifest.json'
        ? Buffer.from(JSON.stringify(manifest)) : Buffer.from('public-fixture')
      const compressed = method === 8 ? zlib.deflateRawSync(payload) : payload
      return {fileName, compressionMethod: method, compressedSize: compressed.length,
        uncompressedSize: payload.length, compressed}
    })
    zip.readEntry = jest.fn(() => queueMicrotask(() => {
      const entry = entries.shift()
      if (entry) zip.emit('entry', entry)
      else zip.emit('end')
    }))
    zip.openReadStream = jest.fn((entry, options, callback) => {
      expect(options).toEqual({decompress: false})
      callback(null, Readable.from([entry.compressed]))
    })
    zip.close = jest.fn(() => zip.emit('close'))
    yauzl.open.mockImplementation((_file, options, callback) => {
      expect(options).toEqual({lazyEntries: true})
      callback(null, zip)
    })
    return zip
  }

  test.each([0, 8])('accepts actual required file entries while retaining payload verification (method %s)', async (method) => {
    const zip = archive(files, method)
    await expect(verifyZip('mock.zip', manifest, hash)).resolves.toBe(files.length)
    expect(zip.openReadStream).toHaveBeenCalledTimes(2)
  })

  test.each(['README.md', 'LICENSE', 'config/config.yml', 'config/db.db'])(
    'rejects an archive missing required artifact file %s', async (missing) => {
      archive(files.filter((file) => file !== missing))
      await expect(verifyZip('mock.zip', manifest, hash)).rejects.toThrow(`Missing ZIP entry: ${missing}`)
    },
  )

  test.each(['static', 'plugins', 'migrations', 'node_modules'])(
    'rejects missing %s contents even if directory entries and similar names exist', async (directory) => {
      archive([...files.filter((file) => !file.startsWith(`${directory}/`)), `${directory}/`, `${directory}-other/fixture`])
      await expect(verifyZip('mock.zip', manifest, hash)).rejects.toThrow(`Missing ZIP contents: ${directory}/`)
    },
  )

  test('still rejects a runtime hash mismatch rather than passing a structurally complete archive', async () => {
    archive(files)
    await expect(verifyZip('mock.zip', manifest, 'incorrect-hash')).rejects.toThrow()
  })
})
