'use strict'

const fs = require('fs')
const path = require('path')
const {createHash, randomUUID} = require('crypto')
const {TextDecoder} = require('util')

const STATE_LIMIT = 2 * 1024 * 1024
const ENTRY_LIMIT = 10000
const MODEL_LIMIT = 5000
const PAGE_SIZE = 10
const fail = (code) => Object.assign(new Error(code), {code})
const validModel = (id) => typeof id === 'string' && id.length > 0 && id.length <= 200 &&
  !/[\s\p{Cc}\p{Cf}\[\]]/u.test(id)

function readState(file) {
  let fd
  try {
    let before
    try { before = fs.lstatSync(file) } catch (error) {
      if (error.code === 'ENOENT') return Object.create(null)
      throw error
    }
    if (!before.isFile() || before.isSymbolicLink() || before.size > STATE_LIMIT) throw new Error()
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0))
    const opened = fs.fstatSync(fd)
    if (!opened.isFile() || opened.size > STATE_LIMIT || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error()
    }
    const buffer = Buffer.alloc(STATE_LIMIT + 1)
    let length = 0
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null)
      if (!count) break
      length += count
    }
    if (length > STATE_LIMIT) throw new Error()
    const raw = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(buffer.subarray(0, length))
    const state = JSON.parse(raw)
    if (!state || Array.isArray(state) || state.version !== 1 ||
        Object.keys(state).sort().join(',') !== 'selections,version' ||
        !state.selections || typeof state.selections !== 'object' || Array.isArray(state.selections)) {
      throw new Error()
    }
    const entries = Object.entries(state.selections)
    if (entries.length > ENTRY_LIMIT || entries.some(([key, value]) =>
      !/^[a-f0-9]{64}$/.test(key) || !validModel(value))) throw new Error()
    return Object.assign(Object.create(null), state.selections)
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

// Each stateFile must have one owning runtime instance/process; this is not a multi-writer store.
function createModelRuntime(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw fail('MODEL_INVALID')
  const {client, defaultModel, stateFile, cacheTtlMs = 60000, now = Date.now} = options
  if (!client || typeof client.listModels !== 'function' || !validModel(defaultModel) ||
      typeof cacheTtlMs !== 'number' || !Number.isFinite(cacheTtlMs) || cacheTtlMs < 0 ||
      typeof now !== 'function' ||
      (stateFile !== undefined && (typeof stateFile !== 'string' || !stateFile || stateFile.includes('\0')))) {
    throw fail('MODEL_INVALID')
  }
  const statePath = stateFile === undefined ? null : path.resolve(stateFile)
  let selections = Object.create(null)
  if (statePath !== null) {
    try { selections = readState(statePath) } catch { throw fail('MODEL_STATE_INVALID') }
  }
  let cache = null
  let inFlight = null
  const pendingSelections = new Map()

  function clock() {
    try {
      const time = now()
      if (typeof time !== 'number' || !Number.isFinite(time)) throw new Error()
      return time
    } catch { throw fail('MODEL_LIST_FAILED') }
  }

  async function models() {
    const time = clock()
    if (cache && time >= cache.loadedAt && time - cache.loadedAt < cacheTtlMs) return cache.models
    if (inFlight) return inFlight
    cache = null
    inFlight = (async () => {
      let raw
      try { raw = await client.listModels() } catch (error) {
        const allowed = ['LLM_AUTH_ERROR', 'LLM_TIMEOUT_ERROR']
        throw fail(allowed.includes(error?.code) ? error.code : 'MODEL_LIST_FAILED')
      }
      let result
      try {
        if (!Array.isArray(raw) || raw.length > MODEL_LIMIT) throw new Error()
        result = [...new Set(raw.filter(validModel))].sort()
      } catch { throw fail('MODEL_LIST_INVALID') }
      cache = {models: result, loadedAt: clock()}
      return result
    })()
    try { return await inFlight } finally { inFlight = null }
  }

  function keyFor(contextKey) {
    if (typeof contextKey !== 'string' || !contextKey) throw fail('MODEL_INVALID')
    return createHash('sha256').update(contextKey, 'utf8').digest('hex')
  }

  function commit(key, modelId) {
    if (modelId === undefined ? !Object.hasOwn(selections, key) : selections[key] === modelId) return
    // Snapshot only at commit time, after any awaited catalog request has completed.
    const next = Object.assign(Object.create(null), selections)
    if (modelId === undefined) delete next[key]
    else next[key] = modelId
    if (Object.keys(next).length > ENTRY_LIMIT) throw fail('MODEL_STATE_LIMIT')
    const data = JSON.stringify({version: 1, selections: next})
    if (Buffer.byteLength(data, 'utf8') > STATE_LIMIT) throw fail('MODEL_STATE_LIMIT')
    if (statePath !== null) {
      let temp
      try {
        temp = `${statePath}.${randomUUID()}.tmp`
        fs.writeFileSync(temp, data, {encoding: 'utf8', flag: 'wx', mode: 0o600})
        fs.renameSync(temp, statePath)
      } catch {
        if (temp) {
          try { fs.unlinkSync(temp) } catch { /* Creation may have failed before a temp existed. */ }
        }
        throw fail('MODEL_STATE_WRITE_FAILED')
      }
    }
    selections = next
  }

  async function list(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw fail('MODEL_INVALID')
    const {keyword = '', page = 1} = options
    if (!Number.isSafeInteger(page) || page < 1) throw fail('MODEL_PAGE_INVALID')
    if (typeof keyword !== 'string') throw fail('MODEL_INVALID')
    const needle = keyword.toLowerCase()
    const filtered = (await models()).filter((id) => id.toLowerCase().includes(needle))
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page > totalPages) throw fail('MODEL_PAGE_INVALID')
    return {models: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, totalPages, total, defaultModel}
  }

  function current(contextKey) {
    return selections[keyFor(contextKey)] ?? defaultModel
  }

  async function select(contextKey, modelId) {
    const key = keyFor(contextKey)
    if (!validModel(modelId)) throw fail('MODEL_INVALID')
    if (modelId === defaultModel) {
      commit(key, undefined)
      pendingSelections.delete(key)
      return defaultModel
    }
    if (!pendingSelections.has(key) && pendingSelections.size >= ENTRY_LIMIT) throw fail('MODEL_STATE_LIMIT')
    const token = Symbol()
    pendingSelections.set(key, token)
    try {
      const available = await models()
      if (pendingSelections.get(key) !== token) throw fail('MODEL_SELECTION_SUPERSEDED')
      if (!available.includes(modelId)) throw fail('MODEL_NOT_FOUND')
      commit(key, modelId)
      return modelId
    } finally {
      if (pendingSelections.get(key) === token) pendingSelections.delete(key)
    }
  }

  function reset(contextKey) {
    const key = keyFor(contextKey)
    commit(key, undefined)
    pendingSelections.delete(key)
    return defaultModel
  }

  return {list, current, select, reset}
}

module.exports = {createModelRuntime}
