'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const {createHash} = require('crypto')
const {createModelRuntime} = require('./modelRuntime')

const defaultModel = 'native-default'
const hash = (key) => createHash('sha256').update(key).digest('hex')
let root, stateFile, client, time

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-model-runtime-'))
  stateFile = path.join(root, 'models.json')
  client = {listModels: jest.fn().mockResolvedValue(['model-b', 'model-a'])}
  time = 100000
})

afterEach(() => {
  jest.restoreAllMocks()
  fs.rmSync(root, {recursive: true, force: true})
})

function runtime(options = {}) {
  return createModelRuntime({client, defaultModel, stateFile, now: () => time, ...options})
}

function state() {
  return JSON.parse(fs.readFileSync(stateFile, 'utf8'))
}

function checkError(error, code) {
  expect(error).toBeInstanceOf(Error)
  expect(error.message).toBe(code)
  expect(error.code).toBe(code)
  expect(error.cause).toBeUndefined()
  expect(JSON.stringify(error)).toBe(JSON.stringify({code}))
  expect(error.stack).not.toContain(root)
  expect(error.stack).not.toContain('PRIVATE_RESPONSE_BODY')
}

function fails(action, code) {
  let error
  try { action() } catch (caught) { error = caught }
  checkError(error, code)
}

async function rejects(action, code) {
  let error
  try { await action() } catch (caught) { error = caught }
  checkError(error, code)
}

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return {promise, resolve, reject}
}

test('native default/current/reset/select-default never query service or write absent selection', async () => {
  const api = runtime()
  client.listModels.mockRejectedValue(new Error('PRIVATE_RESPONSE_BODY'))
  const write = jest.spyOn(fs, 'writeFileSync')
  expect(api.current('qq:private:123')).toBe(defaultModel)
  expect(api.reset('qq:private:123')).toBe(defaultModel)
  expect(await api.select('qq:private:123', defaultModel)).toBe(defaultModel)
  expect(client.listModels).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
  expect(fs.existsSync(stateFile)).toBe(false)
})

test('stable sorted deduplicated list filters invalid entries and does not invent default', async () => {
  client.listModels.mockResolvedValue(['Z', 'a', 'Z', '模型:1', '', null, 1, {}, [], 'bad model',
    'bad\nmodel', 'bad[model]', 'bad\u0000model', 'x'.repeat(201), 'valid/model-v1:4b', 'a'])
  const api = runtime()
  expect(await api.list()).toEqual({models: ['Z', 'a', 'valid/model-v1:4b', '模型:1'],
    page: 1, totalPages: 1, total: 4, defaultModel})
  const result = await api.list()
  result.models.push('changed')
  expect((await api.list()).models).not.toContain('changed')
  expect(client.listModels).toHaveBeenCalledTimes(1)
})

test('pagination is 10 per page; keyword is case-insensitive substring; empty match has page 1 of 1', async () => {
  const ids = Array.from({length: 23}, (_, i) => `model-${String(i).padStart(2, '0')}`)
  client.listModels.mockResolvedValue([...ids].reverse())
  const api = runtime()
  expect(await api.list()).toEqual({models: ids.slice(0, 10), page: 1, totalPages: 3, total: 23, defaultModel})
  expect(await api.list({page: 2})).toEqual({models: ids.slice(10, 20), page: 2, totalPages: 3, total: 23, defaultModel})
  expect(await api.list({page: 3})).toEqual({models: ids.slice(20), page: 3, totalPages: 3, total: 23, defaultModel})
  expect(await api.list({keyword: 'DEL-1'})).toEqual({models: ids.slice(10, 20), page: 1, totalPages: 1, total: 10, defaultModel})
  expect(await api.list({keyword: 'absent'})).toEqual({models: [], page: 1, totalPages: 1, total: 0, defaultModel})
  await rejects(() => api.list({page: 4}), 'MODEL_PAGE_INVALID')
  await rejects(() => api.list({keyword: 'absent', page: 2}), 'MODEL_PAGE_INVALID')
  expect(client.listModels).toHaveBeenCalledTimes(1)
})

test.each([0, -1, 1.1, '1', null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid page %p before network', async (page) => {
  await rejects(() => runtime().list({page}), 'MODEL_PAGE_INVALID')
  expect(client.listModels).not.toHaveBeenCalled()
})

test.each([null, [], 1, 'options', {keyword: null}, {keyword: 1}])('invalid list options %p are safe', async (options) => {
  await rejects(() => runtime().list(options), 'MODEL_INVALID')
  expect(client.listModels).not.toHaveBeenCalled()
})

test('default 60s TTL is measured from response completion and exact expiry refreshes', async () => {
  const pending = deferred()
  client.listModels.mockReturnValueOnce(pending.promise).mockResolvedValue(['new-model'])
  const api = runtime()
  const first = api.list()
  time += 15000
  pending.resolve(['old-model'])
  expect((await first).models).toEqual(['old-model'])
  time += 59999
  expect((await api.list()).models).toEqual(['old-model'])
  expect(client.listModels).toHaveBeenCalledTimes(1)
  time += 1
  expect((await api.list()).models).toEqual(['new-model'])
  expect(client.listModels).toHaveBeenCalledTimes(2)
})

test('concurrent list/select requests single-flight and different contexts both persist', async () => {
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const api = runtime()
  const results = [api.list(), api.list({keyword: 'A'}), api.select('qq:private:123', 'model-a'),
    api.select('qq:group:123', 'model-b')]
  expect(client.listModels).toHaveBeenCalledTimes(1)
  pending.resolve(['model-b', 'model-a'])
  const [all, filtered, a, b] = await Promise.all(results)
  expect(all.models).toEqual(['model-a', 'model-b'])
  expect(filtered.models).toEqual(['model-a'])
  expect([a, b]).toEqual(['model-a', 'model-b'])
  expect(state()).toEqual({version: 1, selections: {
    [hash('qq:private:123')]: 'model-a', [hash('qq:group:123')]: 'model-b',
  }})
  const restarted = runtime()
  expect(restarted.current('qq:private:123')).toBe('model-a')
  expect(restarted.current('qq:group:123')).toBe('model-b')
})

test('newer same-context selection supersedes older selection without cancelling the new token', async () => {
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const api = runtime()
  const a = rejects(() => api.select('same', 'model-a'), 'MODEL_SELECTION_SUPERSEDED')
  const b = api.select('same', 'model-b')
  pending.resolve(['model-a', 'model-b'])
  await Promise.all([a, b])
  expect(api.current('same')).toBe('model-b')
  expect(state().selections[hash('same')]).toBe('model-b')
  expect(await api.select('same', 'model-a')).toBe('model-a')
})

test.each(['reset', 'default'])('pending select followed by %s remains default after catalog resolves', async (operation) => {
  const api = runtime()
  await api.select('a', 'model-a')
  time += 60000
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const old = rejects(() => api.select('a', 'model-b'), 'MODEL_SELECTION_SUPERSEDED')
  const other = api.select('other', 'model-b')
  if (operation === 'reset') expect(api.reset('a')).toBe(defaultModel)
  else expect(await api.select('a', defaultModel)).toBe(defaultModel)
  pending.resolve(['model-a', 'model-b'])
  await old
  expect(await other).toBe('model-b')
  expect(api.current('a')).toBe(defaultModel)
  expect(state().selections).toEqual({[hash('other')]: 'model-b'})
  expect(runtime().current('a')).toBe(defaultModel)
})

test('memory-only reset cancels pending selection even if there was no override to clear', async () => {
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const api = runtime({stateFile: undefined})
  const old = rejects(() => api.select('a', 'model-a'), 'MODEL_SELECTION_SUPERSEDED')
  expect(api.reset('a')).toBe(defaultModel)
  pending.resolve(['model-a'])
  await old
  expect(api.current('a')).toBe(defaultModel)
  expect(fs.existsSync(stateFile)).toBe(false)
})

test.each(['reset', 'default'])('failed %s commit preserves pending selection and previous disk state', async (operation) => {
  const api = runtime()
  await api.select('a', 'model-a')
  const original = fs.readFileSync(stateFile, 'utf8')
  time += 60000
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const old = api.select('a', 'model-b')
  jest.spyOn(fs, 'renameSync').mockImplementation(() => { throw new Error('PRIVATE_RESPONSE_BODY') })
  if (operation === 'reset') fails(() => api.reset('a'), 'MODEL_STATE_WRITE_FAILED')
  else await rejects(() => api.select('a', defaultModel), 'MODEL_STATE_WRITE_FAILED')
  expect(api.current('a')).toBe('model-a')
  expect(fs.readFileSync(stateFile, 'utf8')).toBe(original)
  jest.restoreAllMocks()
  pending.resolve(['model-a', 'model-b'])
  expect(await old).toBe('model-b')
  expect(runtime().current('a')).toBe('model-b')
})

test('upfront invalid model does not cancel older valid selection', async () => {
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const api = runtime()
  const old = api.select('a', 'model-a')
  await rejects(() => api.select('a', 'invalid model'), 'MODEL_INVALID')
  pending.resolve(['model-a'])
  expect(await old).toBe('model-a')
})

test('newer unknown model cancels older request but neither reports false success', async () => {
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const api = runtime()
  const old = rejects(() => api.select('a', 'model-a'), 'MODEL_SELECTION_SUPERSEDED')
  const latest = rejects(() => api.select('a', 'unknown'), 'MODEL_NOT_FOUND')
  pending.resolve(['model-a'])
  await Promise.all([old, latest])
  expect(api.current('a')).toBe(defaultModel)
  expect(await api.select('a', 'model-a')).toBe('model-a')
})

test('pending capacity is bounded at 10000 keys and all slots are freed after failure', async () => {
  const api = runtime({stateFile: undefined})
  for (let round = 0; round < 2; round++) {
    const pending = deferred()
    client.listModels.mockReturnValue(pending.promise)
    const selections = Array.from({length: 10000}, (_, i) => api.select(`round:${round}:${i}`, 'model-a'))
    const settled = Promise.allSettled(selections)
    await rejects(() => api.select('overflow', 'model-a'), 'MODEL_STATE_LIMIT')
    pending.reject(new Error('PRIVATE_RESPONSE_BODY'))
    const outcomes = await settled
    expect(outcomes.every((result) => result.status === 'rejected' && result.reason.code === 'MODEL_LIST_FAILED')).toBe(true)
  }
  client.listModels.mockResolvedValue(['model-a'])
  expect(await api.select('recovered', 'model-a')).toBe('model-a')
})

test('reset and default release pending slots immediately without accumulating historical keys', async () => {
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const api = runtime({stateFile: undefined})
  const selections = []
  for (let i = 0; i < 10001; i++) {
    const key = `historical:${i}`
    selections.push(api.select(key, 'model-a'))
    if (i % 2 === 0) api.reset(key)
    else await api.select(key, defaultModel)
  }
  const settled = Promise.allSettled(selections)
  pending.resolve(['model-a'])
  const outcomes = await settled
  expect(outcomes.every((result) => result.status === 'rejected' && result.reason.code === 'MODEL_SELECTION_SUPERSEDED')).toBe(true)
  expect(await api.select('fresh', 'model-a')).toBe('model-a')
})

test('TTL failure never serves stale cache, never changes selections, shares failure and retries', async () => {
  const api = runtime()
  await api.select('a', 'model-a')
  const original = fs.readFileSync(stateFile, 'utf8')
  time += 60000
  const pending = deferred()
  client.listModels.mockReturnValueOnce(pending.promise).mockResolvedValue(['model-c'])
  const first = rejects(() => api.list(), 'MODEL_LIST_FAILED')
  const second = rejects(() => api.select('a', 'model-b'), 'MODEL_LIST_FAILED')
  expect(client.listModels).toHaveBeenCalledTimes(2)
  pending.reject(Object.assign(new Error('PRIVATE_RESPONSE_BODY'), {response: {data: 'PRIVATE_RESPONSE_BODY'}}))
  await Promise.all([first, second])
  expect(api.current('a')).toBe('model-a')
  expect(fs.readFileSync(stateFile, 'utf8')).toBe(original)
  expect((await api.list()).models).toEqual(['model-c'])
  expect(client.listModels).toHaveBeenCalledTimes(3)
  expect(api.current('a')).toBe('model-a')
  await rejects(() => api.select('a', 'model-a'), 'MODEL_NOT_FOUND')
  expect(api.reset('a')).toBe(defaultModel)
})

test('synchronous service throw is safe and does not poison subsequent requests', async () => {
  client.listModels.mockImplementationOnce(() => { throw new Error('PRIVATE_RESPONSE_BODY') })
    .mockResolvedValue(['recovered'])
  const api = runtime()
  await rejects(() => api.list(), 'MODEL_LIST_FAILED')
  expect((await api.list()).models).toEqual(['recovered'])
  expect(client.listModels).toHaveBeenCalledTimes(2)
})

test.each([
  ['LLM_AUTH_ERROR', 'LLM_AUTH_ERROR'],
  ['LLM_TIMEOUT_ERROR', 'LLM_TIMEOUT_ERROR'],
  ['LLM_REQUEST_ERROR', 'MODEL_LIST_FAILED'],
  ['llm_auth_error', 'MODEL_LIST_FAILED'],
  [undefined, 'MODEL_LIST_FAILED'],
])('remote code %p is rebuilt as %p without raw error fields', async (code, expected) => {
  const api = runtime()
  await api.select('a', 'model-a')
  time += 60000
  const raw = Object.assign(new Error(`PRIVATE_RESPONSE_BODY ${root}`), {
    code, cause: new Error('PRIVATE_RESPONSE_BODY'),
    response: {data: 'PRIVATE_RESPONSE_BODY'}, token: 'PRIVATE_RESPONSE_BODY',
  })
  client.listModels.mockRejectedValue(raw)
  for (const action of [() => api.list(), () => api.select('a', 'model-b')]) {
    let caught
    try { await action() } catch (error) { caught = error }
    checkError(caught, expected)
    expect(caught).not.toBe(raw)
    expect(caught.response).toBeUndefined()
    expect(caught.token).toBeUndefined()
  }
  expect(api.current('a')).toBe('model-a')
  expect(state().selections[hash('a')]).toBe('model-a')
})

test('custom TTL and clock rollback cannot resurrect expired cache', async () => {
  const api = runtime({cacheTtlMs: 10})
  await api.list()
  time += 10
  client.listModels.mockRejectedValueOnce(new Error('PRIVATE_RESPONSE_BODY'))
  await rejects(() => api.list(), 'MODEL_LIST_FAILED')
  time -= 10
  client.listModels.mockResolvedValue(['fresh'])
  expect((await api.list()).models).toEqual(['fresh'])
  expect(client.listModels).toHaveBeenCalledTimes(3)
  time -= 1
  await api.list()
  expect(client.listModels).toHaveBeenCalledTimes(4)
})

test('TTL zero disables reuse but still coalesces in-flight fetches', async () => {
  const api = runtime({cacheTtlMs: 0})
  await Promise.all([api.list(), api.list()])
  expect(client.listModels).toHaveBeenCalledTimes(1)
  await api.list()
  expect(client.listModels).toHaveBeenCalledTimes(2)
})

test.each([null, {}, 'PRIVATE_RESPONSE_BODY', Array(5001).fill('duplicate')])('invalid remote list %# fails safely and is not cached', async (raw) => {
  client.listModels.mockResolvedValueOnce(raw).mockResolvedValue(['valid'])
  const api = runtime()
  await rejects(() => api.list(), 'MODEL_LIST_INVALID')
  expect((await api.list()).models).toEqual(['valid'])
})

test('5000 raw entries allowed; empty/fully filtered list stays empty', async () => {
  const api = runtime({cacheTtlMs: 0})
  client.listModels.mockResolvedValueOnce(Array(5000).fill('valid')).mockResolvedValueOnce([])
    .mockResolvedValueOnce([null, 'bad model'])
  expect((await api.list()).models).toEqual(['valid'])
  for (let i = 0; i < 2; i++) expect(await api.list()).toEqual({models: [], page: 1, totalPages: 1, total: 0, defaultModel})
})

test.each(['', 'with space', 'with\nnewline', '[model]', 'model]', '\0model', 'x'.repeat(201),
  '\u007fmodel', '\u0085model', '\u200bmodel', '\u2028model', '\u2029model', null, {}, 12])('invalid model %p never queries or mutates', async (id) => {
  const api = runtime()
  await rejects(() => api.select('a', id), 'MODEL_INVALID')
  expect(api.current('a')).toBe(defaultModel)
  expect(client.listModels).not.toHaveBeenCalled()
})

test('200-character id is accepted but unknown/case-mismatched ids fail', async () => {
  const long = 'x'.repeat(200)
  client.listModels.mockResolvedValue([long, 'Known'])
  const api = runtime()
  expect(await api.select('a', long)).toBe(long)
  await rejects(() => api.select('a', 'unknown'), 'MODEL_NOT_FOUND')
  await rejects(() => api.select('a', 'known'), 'MODEL_NOT_FOUND')
  expect(api.current('a')).toBe(long)
})

test('context hashing, private/group/platform isolation, restart, reset and select-default remove overrides', async () => {
  const api = runtime()
  await api.select('qq:private:987654321', 'model-a')
  await api.select('qq:group:987654321', 'model-b')
  const raw = fs.readFileSync(stateFile, 'utf8')
  expect(raw).not.toContain('987654321')
  const restarted = runtime()
  client.listModels.mockRejectedValue(new Error('PRIVATE_RESPONSE_BODY'))
  expect(restarted.current('qq:private:987654321')).toBe('model-a')
  expect(restarted.current('qq:group:987654321')).toBe('model-b')
  expect(restarted.current('other:group:987654321')).toBe(defaultModel)
  const calls = client.listModels.mock.calls.length
  expect(restarted.reset('qq:private:987654321')).toBe(defaultModel)
  expect(await restarted.select('qq:group:987654321', defaultModel)).toBe(defaultModel)
  expect(client.listModels).toHaveBeenCalledTimes(calls)
  expect(state()).toEqual({version: 1, selections: {}})
  expect(runtime().current('qq:group:987654321')).toBe(defaultModel)
})

test('no stateFile means memory only; current and unchanged selects do not write', async () => {
  const api = runtime({stateFile: undefined})
  const write = jest.spyOn(fs, 'writeFileSync')
  await api.select('a', 'model-a')
  expect(api.current('a')).toBe('model-a')
  expect(api.reset('a')).toBe(defaultModel)
  expect(write).not.toHaveBeenCalled()
  const persistent = runtime()
  await persistent.select('a', 'model-a')
  write.mockClear()
  await persistent.select('a', 'model-a')
  persistent.current('a')
  persistent.current('b')
  expect(write).not.toHaveBeenCalled()
})

test.each([undefined, null, '', 123, {}])('invalid context %p is safe and never queries', async (context) => {
  const api = runtime()
  fails(() => api.current(context), 'MODEL_INVALID')
  fails(() => api.reset(context), 'MODEL_INVALID')
  await rejects(() => api.select(context, 'model-a'), 'MODEL_INVALID')
  expect(client.listModels).not.toHaveBeenCalled()
})

test.each([undefined, null, [], {}, {client: {}}, {defaultModel: 'bad model'}, {cacheTtlMs: -1},
  {cacheTtlMs: NaN}, {cacheTtlMs: Infinity}, {cacheTtlMs: '60'}, {now: null}, {stateFile: ''},
  {stateFile: null}, {stateFile: 'bad\0path'}])('invalid configuration %# fails safely', (options) => {
  if (options === undefined || options === null || Array.isArray(options)) {
    fails(() => createModelRuntime(options), 'MODEL_INVALID')
  } else if (Object.keys(options).length === 0 || Object.hasOwn(options, 'client')) {
    fails(() => createModelRuntime(options), 'MODEL_INVALID')
  } else fails(() => runtime(options), 'MODEL_INVALID')
})

test.each([() => NaN, () => '100', () => { throw new Error('PRIVATE_RESPONSE_BODY') }])('invalid/throwing clock %# is safe', async (now) => {
  await rejects(() => runtime({now}).list(), 'MODEL_LIST_FAILED')
})

test.each(['not json', '{}', '{"version":2,"selections":{}}', '{"version":1,"selections":null}',
  '{"version":1,"selections":[]}', '{"version":1,"selections":{"raw-qq-id":"model-a"}}',
  JSON.stringify({version: 1, selections: {[hash('a')]: null}}),
  JSON.stringify({version: 1, selections: {[hash('a')]: 'bad model'}}),
  JSON.stringify({version: 1, selections: {}, extra: true}),
  ' '.repeat(2 * 1024 * 1024 + 1), Buffer.from([0xff])])('corrupt state %# fails closed without overwriting', (raw) => {
  fs.writeFileSync(stateFile, raw, 'utf8')
  const original = fs.readFileSync(stateFile)
  fails(() => runtime(), 'MODEL_STATE_INVALID')
  expect(fs.readFileSync(stateFile).equals(original)).toBe(true)
  expect(client.listModels).not.toHaveBeenCalled()
})

test('non-file state rejected; state parent must exist before selecting', async () => {
  fs.mkdirSync(stateFile)
  fails(() => runtime(), 'MODEL_STATE_INVALID')
  const api = runtime({stateFile: path.join(root, 'missing', 'models.json')})
  await rejects(() => api.select('a', 'model-a'), 'MODEL_STATE_WRITE_FAILED')
  expect(api.current('a')).toBe(defaultModel)
})

test.each(['writeFileSync', 'renameSync'])('%s failure preserves old disk and memory; temp cleaned', async (method) => {
  const api = runtime()
  await api.select('a', 'model-a')
  const original = fs.readFileSync(stateFile, 'utf8')
  jest.spyOn(fs, method).mockImplementation(() => { throw new Error(`PRIVATE_RESPONSE_BODY ${root}`) })
  await rejects(() => api.select('a', 'model-b'), 'MODEL_STATE_WRITE_FAILED')
  fails(() => api.reset('a'), 'MODEL_STATE_WRITE_FAILED')
  await rejects(() => api.select('a', defaultModel), 'MODEL_STATE_WRITE_FAILED')
  expect(api.current('a')).toBe('model-a')
  expect(fs.readFileSync(stateFile, 'utf8')).toBe(original)
  expect(fs.readdirSync(root).filter((name) => name.endsWith('.tmp'))).toEqual([])
  jest.restoreAllMocks()
  expect(runtime().current('a')).toBe('model-a')
})

test('atomic write is exclusive private temp in same directory followed by rename', async () => {
  const api = runtime()
  const write = jest.spyOn(fs, 'writeFileSync')
  const rename = jest.spyOn(fs, 'renameSync')
  await api.select('a', 'model-a')
  const [temp, data, options] = write.mock.calls[0]
  expect(path.dirname(temp)).toBe(path.dirname(stateFile))
  expect(options).toEqual({encoding: 'utf8', flag: 'wx', mode: 0o600})
  expect(rename).toHaveBeenCalledWith(temp, stateFile)
  expect(JSON.parse(data)).toEqual({version: 1, selections: {[hash('a')]: 'model-a'}})
})

test('10000-entry limit rejects growth, permits update/reset, and rejects oversized loaded count', async () => {
  const selections = Object.fromEntries(Array.from({length: 10000}, (_, i) => [hash(`key:${i}`), 'model-a']))
  fs.writeFileSync(stateFile, JSON.stringify({version: 1, selections}), 'utf8')
  const api = runtime()
  await rejects(() => api.select('extra', 'model-b'), 'MODEL_STATE_LIMIT')
  expect(api.current('extra')).toBe(defaultModel)
  await api.select('key:0', 'model-b')
  api.reset('key:1')
  await api.select('extra', 'model-b')
  expect(Object.keys(state().selections)).toHaveLength(10000)
  selections[hash('overflow')] = 'model-a'
  const raw = JSON.stringify({version: 1, selections})
  fs.writeFileSync(stateFile, raw, 'utf8')
  fails(() => runtime(), 'MODEL_STATE_INVALID')
  expect(fs.readFileSync(stateFile, 'utf8')).toBe(raw)
})

test('2 MiB serialized state cap rejects commit and preserves previous selections', async () => {
  const id = '中'.repeat(200)
  const baseBytes = Buffer.byteLength(JSON.stringify({version: 1, selections: {}}))
  const entryBytes = Buffer.byteLength(JSON.stringify({[hash('sample')]: id})) - 1
  const count = Math.floor((2 * 1024 * 1024 - baseBytes + 1) / entryBytes)
  const selections = Object.fromEntries(Array.from({length: count}, (_, i) => [hash(`old:${i}`), id]))
  const raw = JSON.stringify({version: 1, selections})
  fs.writeFileSync(stateFile, raw, 'utf8')
  client.listModels.mockResolvedValue([id])
  const api = runtime()
  await rejects(() => api.select('extra', id), 'MODEL_STATE_LIMIT')
  expect(api.current('extra')).toBe(defaultModel)
  expect(fs.readFileSync(stateFile, 'utf8')).toBe(raw)
})

test('current is immediate and reset/default select stay local while refresh is pending', async () => {
  const api = runtime()
  await api.select('a', 'model-a')
  time += 60000
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const listing = api.list()
  expect(api.current('a')).toBe('model-a')
  expect(api.current('other')).toBe(defaultModel)
  expect(api.reset('a')).toBe(defaultModel)
  expect(await api.select('b', defaultModel)).toBe(defaultModel)
  expect(client.listModels).toHaveBeenCalledTimes(2)
  pending.resolve(['model-b'])
  await listing
  expect(state()).toEqual({version: 1, selections: {}})
})

test('refresh failure with thrown non-Error body is sanitized for every waiter', async () => {
  const pending = deferred()
  client.listModels.mockReturnValue(pending.promise)
  const api = runtime()
  const all = [rejects(() => api.list(), 'MODEL_LIST_FAILED'), rejects(() => api.list(), 'MODEL_LIST_FAILED')]
  pending.reject({body: 'PRIVATE_RESPONSE_BODY', code: 'PRIVATE_RESPONSE_BODY'})
  await Promise.all(all)
  expect(api.current('a')).toBe(defaultModel)
})

test('invalid list getters cannot expose remote body through an exception', async () => {
  const raw = []
  Object.defineProperty(raw, 0, {get() { throw new Error('PRIVATE_RESPONSE_BODY') }, enumerable: true})
  client.listModels.mockResolvedValue(raw)
  await rejects(() => runtime().list(), 'MODEL_LIST_INVALID')
})

test('read failures are sanitized and leave original state unchanged', async () => {
  await runtime().select('a', 'model-a')
  const original = fs.readFileSync(stateFile, 'utf8')
  jest.spyOn(fs, 'readSync').mockImplementation(() => { throw new Error(`PRIVATE_RESPONSE_BODY ${root}`) })
  fails(() => runtime(), 'MODEL_STATE_INVALID')
  expect(fs.readFileSync(stateFile, 'utf8')).toBe(original)
})
