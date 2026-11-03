'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const {createHash} = require('crypto')
const {createPersonaStore} = require('./persona')

const native = {fileName: null, content: '小夜原生\nBuilt-in persona'}
const defaultFile = '大肥鱼女友版.txt'
const hash = (key) => createHash('sha256').update(key).digest('hex')
let root, personaDir, stateFile

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-persona-'))
  personaDir = path.join(root, 'personas')
  stateFile = path.join(root, 'state.json')
  fs.mkdirSync(personaDir)
  put(defaultFile, 'optional girlfriend')
  put('A space 中文.TXT', ' A persona\n ')
  put('z.txt', 'last persona')
})

afterEach(() => {
  jest.restoreAllMocks()
  fs.rmSync(root, {recursive: true, force: true})
})

function put(fileName, content) {
  fs.writeFileSync(path.join(personaDir, fileName), content, 'utf8')
}

function store(options = {}) {
  return createPersonaStore({personaDir, defaultContent: native.content, stateFile, ...options})
}

function state() {
  return JSON.parse(fs.readFileSync(stateFile, 'utf8'))
}

function safeError(action, code) {
  let caught
  try { action() } catch (error) { caught = error }
  expect(caught).toBeInstanceOf(Error)
  expect(caught.code).toBe(code)
  expect(caught.message).toBe(code)
  expect(caught.cause).toBeUndefined()
  expect(JSON.stringify(caught)).toBe(JSON.stringify({code}))
  expect(caught.stack).not.toContain(root)
}

test('native default needs no directory read or state write; mutable return values are isolated', () => {
  const api = store()
  fs.rmSync(personaDir, {recursive: true})
  const value = api.current('qq:private:123')
  expect(value).toEqual(native)
  value.content = 'changed'
  expect(api.current('qq:private:123')).toEqual(native)
  expect(api.reset('qq:private:123')).toEqual(native)
  expect(fs.existsSync(stateFile)).toBe(false)
})

test('list is stable, direct regular .txt files only and never reads any content', () => {
  fs.mkdirSync(path.join(personaDir, 'sub.txt'))
  fs.writeFileSync(path.join(personaDir, 'sub.txt', 'nested.txt'), 'nested', 'utf8')
  put('ignore.md', 'ignored')
  put('empty.txt', '')
  put('large.txt', Buffer.alloc(128 * 1024 + 1))
  const api = store()
  const read = jest.spyOn(fs, 'readSync')
  const result = ['A space 中文.TXT', defaultFile, 'z.txt', 'empty.txt', 'large.txt']
    .sort().map((fileName) => ({fileName}))
  expect(api.list()).toEqual(result)
  expect(api.list()).toEqual(result)
  expect(read).not.toHaveBeenCalled()
})

test('exact name, Chinese/space alias, final suffix only and 1-based index select files', () => {
  const api = store()
  expect(api.select('a', 'A space 中文.TXT')).toEqual({fileName: 'A space 中文.TXT', content: ' A persona\n '})
  expect(api.select('a', 'A space 中文').fileName).toBe('A space 中文.TXT')
  expect(api.select('a', '大肥鱼女友版').fileName).toBe(defaultFile)
  const index = api.list().findIndex(({fileName}) => fileName === 'z.txt') + 1
  expect(api.select('a', String(index))).toEqual({fileName: 'z.txt', content: 'last persona'})
  put('double.txt.txt', 'double suffix')
  expect(api.select('a', 'double.txt').fileName).toBe('double.txt.txt')
  safeError(() => api.select('a', 'double'), 'PERSONA_NOT_FOUND')
})

test('ambiguous aliases fail, exact name wins, matching is case sensitive', () => {
  const api = store()
  const readdir = fs.readdirSync.bind(fs)
  const lstat = fs.lstatSync.bind(fs)
  // Synthetic entries cover case-sensitive filesystems on Windows too.
  jest.spyOn(fs, 'readdirSync').mockImplementation((dir) => dir === personaDir ?
    ['same.txt', 'same.TXT', ...readdir(dir)] : readdir(dir))
  jest.spyOn(fs, 'lstatSync').mockImplementation((file) =>
    ['same.txt', 'same.TXT'].includes(path.basename(file)) ? {isFile: () => true, isSymbolicLink: () => false} : lstat(file))
  safeError(() => api.select('a', 'same'), 'PERSONA_NOT_FOUND')
  safeError(() => api.select('a', 'a SPACE 中文.txt'), 'PERSONA_NOT_FOUND')
})

test('restart persistence hashes full contexts and isolates private/group/platform selections', () => {
  const api = store()
  const contexts = ['qq:private:123456', 'qq:group:123456', 'other:private:123456']
  api.select(contexts[0], 'z')
  api.select(contexts[1], defaultFile)
  const raw = fs.readFileSync(stateFile, 'utf8')
  expect(raw).not.toContain('123456')
  expect(state()).toEqual({version: 1, selections: {[hash(contexts[0])]: 'z.txt', [hash(contexts[1])]: defaultFile}})
  const restarted = store()
  expect(restarted.current(contexts[0]).fileName).toBe('z.txt')
  expect(restarted.current(contexts[1]).fileName).toBe(defaultFile)
  expect(restarted.current(contexts[2])).toEqual(native)
  const write = jest.spyOn(fs, 'writeFileSync')
  restarted.current(contexts[0])
  restarted.select(contexts[0], 'z')
  expect(write).not.toHaveBeenCalled()
  expect(restarted.reset(contexts[0])).toEqual(native)
  expect(state().selections).toEqual({[hash(contexts[1])]: defaultFile})
  expect(store().current(contexts[0])).toEqual(native)
})

test('memory-only mode never writes state', () => {
  const api = store({stateFile: undefined})
  const write = jest.spyOn(fs, 'writeFileSync')
  api.select('a', 'z')
  expect(api.current('a').fileName).toBe('z.txt')
  expect(api.reset('a')).toEqual(native)
  expect(write).not.toHaveBeenCalled()
})

test.each(['../z.txt', '..\\z.txt', '/z.txt', 'C:\\z.txt', 'C:z.txt', '\\\\host\\z.txt',
  'z.txt\n', 'z\r.txt', 'z\0.txt', 'z\u0085.txt', 'z\u2028.txt', 'z\u2029.txt',
  '.', '..', '', 'z\t.txt', null, 1, {}])('rejects unsafe input %p without leaking', (input) => {
  const api = store()
  safeError(() => api.select('a', input), 'PERSONA_INVALID')
  expect(fs.existsSync(stateFile)).toBe(false)
})

test.each(['0', '-1', '01', '9999999999999999999999', 'missing', 'z.TXT'])('unmatched input %p is not found', (input) => {
  safeError(() => store().select('a', input), 'PERSONA_NOT_FOUND')
})

test.each([undefined, null, '', 123])('invalid context %p fails safely for every context operation', (context) => {
  const api = store()
  for (const operation of [() => api.current(context), () => api.reset(context), () => api.select(context, 'z')]) {
    safeError(operation, 'PERSONA_INVALID')
  }
})

test.each([undefined, null, '', ' \n ', 12])('invalid native content %p fails safely', (defaultContent) => {
  safeError(() => store({defaultContent}), 'PERSONA_INVALID')
})

test.each([undefined, null, [], '', 1, {}, {personaDir: 1}, {personaDir: 'x', defaultPersona: '../x.txt'}])(
  'invalid configuration %p fails with safe error', (options) => {
    safeError(() => createPersonaStore(options), 'PERSONA_INVALID')
  })

test('native content only requires nonempty string, preserves text and has no file size limit', () => {
  const content = ' x\n' + 'a'.repeat(128 * 1024)
  expect(store({defaultContent: content}).current('a')).toEqual({fileName: null, content})
})

test.each(['', ' \r\n ', Buffer.alloc(128 * 1024 + 1, 97), Buffer.from([0xff])])('rejects invalid selected content %# without changing selection', (content) => {
  const api = store()
  api.select('a', 'z')
  put('bad.txt', content)
  safeError(() => api.select('a', 'bad'), 'PERSONA_UNAVAILABLE')
  expect(api.current('a').fileName).toBe('z.txt')
  expect(state().selections[hash('a')]).toBe('z.txt')
})

test('128 KiB byte boundary is accepted, UTF-8 multibyte bytes count toward limit', () => {
  const api = store()
  put('limit.txt', 'a'.repeat(128 * 1024))
  expect(api.select('a', 'limit').content.length).toBe(128 * 1024)
  put('limit.txt', '中'.repeat(44000))
  expect(api.current('a')).toEqual(native)
  expect(state().selections).toEqual({})
})

test.each(['delete', 'empty', 'directory'])('selected file becoming %s falls back, clears state and survives restart', (mode) => {
  const api = store()
  api.select('a', 'z')
  if (mode === 'empty') put('z.txt', '')
  else {
    fs.unlinkSync(path.join(personaDir, 'z.txt'))
    if (mode === 'directory') fs.mkdirSync(path.join(personaDir, 'z.txt'))
  }
  expect(api.current('a')).toEqual(native)
  expect(state()).toEqual({version: 1, selections: {}})
  expect(store().current('a')).toEqual(native)
  const write = jest.spyOn(fs, 'writeFileSync')
  api.current('a')
  api.reset('a')
  expect(write).not.toHaveBeenCalled()
})

test('optional file default is supported; unavailable default fails safely without clearing selection', () => {
  const api = store({defaultPersona: defaultFile, defaultContent: undefined})
  expect(api.current('a')).toEqual({fileName: defaultFile, content: 'optional girlfriend'})
  expect(fs.existsSync(stateFile)).toBe(false)
  api.select('a', 'z')
  expect(api.reset('a').fileName).toBe(defaultFile)
  expect(state().selections).toEqual({})
  api.select('a', 'z')
  fs.unlinkSync(path.join(personaDir, 'z.txt'))
  put(defaultFile, '')
  safeError(() => api.current('a'), 'PERSONA_UNAVAILABLE')
  safeError(() => api.reset('a'), 'PERSONA_UNAVAILABLE')
  expect(state().selections[hash('a')]).toBe('z.txt')
})

test('real directory symlink is rejected without reading its contents', () => {
  const link = path.join(root, 'linked')
  fs.symlinkSync(personaDir, link, process.platform === 'win32' ? 'junction' : 'dir')
  const api = store({personaDir: link})
  safeError(() => api.list(), 'PERSONA_UNAVAILABLE')
  expect(api.current('a')).toEqual(native)
})

test('leaf symlinks are excluded; replacing selected file with a symlink falls back', () => {
  const api = store()
  api.select('a', 'z')
  const target = path.join(root, 'outside.txt')
  fs.writeFileSync(target, 'private outside text', 'utf8')
  fs.unlinkSync(path.join(personaDir, 'z.txt'))
  try {
    fs.symlinkSync(target, path.join(personaDir, 'z.txt'), 'file')
  } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'EPERM') throw error
    // Windows without symlink privilege: emulate lstat's symlink result.
    const original = fs.lstatSync.bind(fs)
    jest.spyOn(fs, 'lstatSync').mockImplementation((file) => file === path.join(personaDir, 'z.txt') ?
      {isFile: () => false, isSymbolicLink: () => true} : original(file))
    const readdir = fs.readdirSync.bind(fs)
    jest.spyOn(fs, 'readdirSync').mockImplementation((dir) => dir === personaDir ? [...readdir(dir), 'z.txt'] : readdir(dir))
  }
  expect(api.list().some(({fileName}) => fileName === 'z.txt')).toBe(false)
  safeError(() => api.select('a', 'z'), 'PERSONA_NOT_FOUND')
  expect(api.current('a')).toEqual(native)
  expect(fs.readFileSync(target, 'utf8')).toBe('private outside text')
})

test.each(['not json', '{}', '{"version":2,"selections":{}}', '{"version":1,"selections":null}',
  '{"version":1,"selections":[]}', '{"version":1,"selections":{"plaintext-QQid":"z.txt"}}',
  JSON.stringify({version: 1, selections: {[hash('a')]: '../z.txt'}}),
  JSON.stringify({version: 1, selections: {[hash('a')]: null}}),
  JSON.stringify({version: 1, selections: {}, extra: true}), ' '.repeat(2 * 1024 * 1024 + 1)])(
  'corrupt or oversized state %# fails closed without overwriting', (raw) => {
    fs.writeFileSync(stateFile, raw, 'utf8')
    safeError(() => store(), 'PERSONA_STATE_INVALID')
    expect(fs.readFileSync(stateFile, 'utf8')).toBe(raw)
  })

test('10000-entry limit rejects growth but allows updates and removals', () => {
  const selections = Object.fromEntries(Array.from({length: 10000}, (_, i) => [hash(`key:${i}`), 'z.txt']))
  fs.writeFileSync(stateFile, JSON.stringify({version: 1, selections}), 'utf8')
  const api = store()
  safeError(() => api.select('extra', defaultFile), 'PERSONA_STATE_LIMIT')
  expect(api.current('extra')).toEqual(native)
  expect(Object.keys(state().selections)).toHaveLength(10000)
  api.select('key:0', defaultFile)
  api.reset('key:1')
  api.select('extra', 'z')
  expect(Object.keys(state().selections)).toHaveLength(10000)
  selections[hash('overflow')] = 'z.txt'
  fs.writeFileSync(stateFile, JSON.stringify({version: 1, selections}), 'utf8')
  safeError(() => store(), 'PERSONA_STATE_INVALID')
})

test.each(['writeFileSync', 'renameSync'])('%s failure preserves disk and memory and cleans temps', (method) => {
  const api = store()
  api.select('a', 'z')
  const original = fs.readFileSync(stateFile, 'utf8')
  jest.spyOn(fs, method).mockImplementation(() => { throw new Error(`secret ${root}`) })
  safeError(() => api.select('a', defaultFile), 'PERSONA_STATE_WRITE_FAILED')
  expect(api.current('a').fileName).toBe('z.txt')
  safeError(() => api.reset('a'), 'PERSONA_STATE_WRITE_FAILED')
  expect(api.current('a').fileName).toBe('z.txt')
  expect(fs.readFileSync(stateFile, 'utf8')).toBe(original)
  expect(fs.readdirSync(root).filter((file) => file.endsWith('.tmp'))).toEqual([])
  jest.restoreAllMocks()
  expect(store().current('a').fileName).toBe('z.txt')
})

test('failed fallback write keeps selection for retry rather than forgetting it', () => {
  const api = store()
  api.select('a', 'z')
  fs.unlinkSync(path.join(personaDir, 'z.txt'))
  jest.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('private error') })
  safeError(() => api.current('a'), 'PERSONA_STATE_WRITE_FAILED')
  expect(state().selections[hash('a')]).toBe('z.txt')
  jest.restoreAllMocks()
  put('z.txt', 'restored')
  expect(api.current('a')).toEqual({fileName: 'z.txt', content: 'restored'})
})

test('missing state parent fails safely without changing memory selection', () => {
  const api = store({stateFile: path.join(root, 'missing', 'state.json')})
  safeError(() => api.select('a', 'z'), 'PERSONA_STATE_WRITE_FAILED')
  expect(api.current('a')).toEqual(native)
})

test('state writes use exclusive same-directory temp plus rename, with no persona bodies', () => {
  const api = store()
  const write = jest.spyOn(fs, 'writeFileSync')
  const rename = jest.spyOn(fs, 'renameSync')
  api.select('a', 'z')
  const [temp, data, options] = write.mock.calls[0]
  expect(path.dirname(temp)).toBe(path.dirname(stateFile))
  expect(options).toEqual({encoding: 'utf8', flag: 'wx', mode: 0o600})
  expect(rename).toHaveBeenCalledWith(temp, stateFile)
  expect(data).not.toContain('last persona')
  expect(data).not.toContain(native.content)
  expect(state()).toEqual({version: 1, selections: {[hash('a')]: 'z.txt'}})
})

test('select/current open only the chosen persona, never other persona contents', () => {
  const api = store()
  const open = jest.spyOn(fs, 'openSync')
  api.select('a', 'z')
  api.current('a')
  const openedPersonas = open.mock.calls.map(([file]) => file)
    .filter((file) => path.dirname(file) === personaDir)
  expect(openedPersonas).toEqual([path.join(personaDir, 'z.txt'), path.join(personaDir, 'z.txt')])
})

test('file replacement between lstat/open is rejected before reading content', () => {
  const api = store()
  const fstat = fs.fstatSync.bind(fs)
  jest.spyOn(fs, 'fstatSync').mockImplementation((fd) => {
    const actual = fstat(fd)
    actual.ino = -1
    return actual
  })
  const read = jest.spyOn(fs, 'readSync')
  safeError(() => api.select('a', 'z'), 'PERSONA_UNAVAILABLE')
  expect(read).not.toHaveBeenCalled()
  expect(api.current('a')).toEqual(native)
})

test('state serialization exceeding 2 MiB leaves previous choices intact', () => {
  const selections = {}
  const longName = 'a'.repeat(230) + '.txt'
  // Populate a valid state just below the byte cap with stale but safe names.
  const baseBytes = Buffer.byteLength(JSON.stringify({version: 1, selections: {}}))
  const entryBytes = Buffer.byteLength(JSON.stringify({[hash('sample')]: longName})) - 1
  const count = Math.floor((2 * 1024 * 1024 - baseBytes + 1) / entryBytes)
  for (let i = 0; i < count; i++) selections[hash(`old:${i}`)] = longName
  fs.writeFileSync(stateFile, JSON.stringify({version: 1, selections}), 'utf8')
  const api = store()
  put(longName, 'long named persona')
  safeError(() => api.select('new', longName), 'PERSONA_STATE_LIMIT')
  expect(api.current('new')).toEqual(native)
  expect(state().selections).toEqual(selections)
})
