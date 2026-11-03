'use strict'

const fs = require('fs')
const path = require('path')
const {createHash, randomUUID} = require('crypto')
const {TextDecoder} = require('util')

const PERSONA_LIMIT = 128 * 1024
const STATE_LIMIT = 2 * 1024 * 1024
const ENTRY_LIMIT = 10000
const fail = (code) => Object.assign(new Error(code), {code})
const safeName = (name) => typeof name === 'string' && name.length > 0 &&
  !/[\x00-\x1f\x7f\x85\u2028\u2029/\\:]/.test(name) && name !== '.' && name !== '..' &&
  !path.posix.isAbsolute(name) && !path.win32.isAbsolute(name)
const personaName = (name) => safeName(name) && /\.txt$/i.test(name)

// Bound allocation even when a file grows between stat and read; never follow a leaf symlink.
function readBounded(file, limit) {
  let fd
  try {
    const before = fs.lstatSync(file)
    if (!before.isFile() || before.isSymbolicLink() || before.size > limit) throw new Error()
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0))
    const opened = fs.fstatSync(fd)
    if (!opened.isFile() || opened.size > limit || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error()
    }
    const buffer = Buffer.alloc(limit + 1)
    let length = 0
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null)
      if (!count) break
      length += count
    }
    if (length > limit) throw new Error()
    return new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(buffer.subarray(0, length))
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

function createPersonaStore(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw fail('PERSONA_INVALID')
  const {personaDir, defaultPersona = null, defaultContent, stateFile} = options
  if (typeof personaDir !== 'string' || !personaDir ||
      (defaultPersona !== null && !personaName(defaultPersona)) ||
      (defaultPersona === null && (typeof defaultContent !== 'string' || !defaultContent.trim())) ||
      (stateFile !== undefined && (typeof stateFile !== 'string' || !stateFile))) {
    throw fail('PERSONA_INVALID')
  }
  const directory = path.resolve(personaDir)
  const statePath = stateFile === undefined ? null : path.resolve(stateFile)
  let selections = Object.create(null)

  if (statePath !== null) {
    try {
      let exists = true
      try { fs.lstatSync(statePath) } catch (error) {
        if (error.code !== 'ENOENT') throw error
        exists = false
      }
      if (exists) {
        const state = JSON.parse(readBounded(statePath, STATE_LIMIT))
        if (!state || Array.isArray(state) || state.version !== 1 ||
            Object.keys(state).sort().join(',') !== 'selections,version' ||
            !state.selections || typeof state.selections !== 'object' || Array.isArray(state.selections)) {
          throw new Error()
        }
        const entries = Object.entries(state.selections)
        if (entries.length > ENTRY_LIMIT || entries.some(([key, value]) =>
          !/^[a-f0-9]{64}$/.test(key) || !personaName(value))) throw new Error()
        selections = Object.assign(Object.create(null), state.selections)
      }
    } catch {
      throw fail('PERSONA_STATE_INVALID')
    }
  }

  function keyFor(contextKey) {
    if (typeof contextKey !== 'string' || !contextKey) throw fail('PERSONA_INVALID')
    return createHash('sha256').update(contextKey, 'utf8').digest('hex')
  }

  function list() {
    try {
      const stat = fs.lstatSync(directory)
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error()
      return fs.readdirSync(directory).filter((name) => {
        if (!personaName(name)) return false
        try {
          const entry = fs.lstatSync(path.join(directory, name))
          return entry.isFile() && !entry.isSymbolicLink()
        } catch { return false }
      }).sort().map((fileName) => ({fileName}))
    } catch {
      throw fail('PERSONA_UNAVAILABLE')
    }
  }

  function readPersona(fileName) {
    try {
      if (!list().some((entry) => entry.fileName === fileName)) throw new Error()
      const content = readBounded(path.join(directory, fileName), PERSONA_LIMIT)
      if (!content.trim()) throw new Error()
      return {fileName, content}
    } catch {
      throw fail('PERSONA_UNAVAILABLE')
    }
  }

  function defaultValue() {
    return defaultPersona === null ? {fileName: null, content: defaultContent} : readPersona(defaultPersona)
  }

  function commit(key, fileName) {
    if (fileName === undefined ? !Object.hasOwn(selections, key) : selections[key] === fileName) return
    const next = Object.assign(Object.create(null), selections)
    if (fileName === undefined) delete next[key]
    else next[key] = fileName
    if (Object.keys(next).length > ENTRY_LIMIT) throw fail('PERSONA_STATE_LIMIT')
    if (statePath !== null) {
      let temp
      try {
        const data = JSON.stringify({version: 1, selections: next})
        if (Buffer.byteLength(data, 'utf8') > STATE_LIMIT) throw fail('PERSONA_STATE_LIMIT')
        // Exclusive creation and a same-directory rename keep the previous JSON intact on failure.
        temp = `${statePath}.${randomUUID()}.tmp`
        fs.writeFileSync(temp, data, {encoding: 'utf8', flag: 'wx', mode: 0o600})
        fs.renameSync(temp, statePath)
      } catch (error) {
        if (temp) {
          try { fs.unlinkSync(temp) } catch { /* The temp file may not have been created. */ }
        }
        throw fail(error.code === 'PERSONA_STATE_LIMIT' ? 'PERSONA_STATE_LIMIT' : 'PERSONA_STATE_WRITE_FAILED')
      }
    }
    selections = next
  }

  function current(contextKey) {
    const key = keyFor(contextKey)
    if (!Object.hasOwn(selections, key)) return defaultValue()
    try {
      return readPersona(selections[key])
    } catch {
      const value = defaultValue()
      commit(key, undefined)
      return value
    }
  }

  function select(contextKey, input) {
    const key = keyFor(contextKey)
    if (typeof input !== 'string' || !safeName(input)) throw fail('PERSONA_INVALID')
    const names = list().map(({fileName}) => fileName)
    let fileName = names.find((name) => name === input)
    if (fileName === undefined) {
      const aliases = names.filter((name) => name.replace(/\.txt$/i, '') === input)
      if (aliases.length > 1) throw fail('PERSONA_NOT_FOUND')
      fileName = aliases[0]
    }
    if (fileName === undefined && /^[1-9]\d*$/.test(input)) {
      const number = Number(input)
      if (Number.isSafeInteger(number)) fileName = names[number - 1]
    }
    if (fileName === undefined) throw fail('PERSONA_NOT_FOUND')
    const value = readPersona(fileName)
    commit(key, fileName)
    return value
  }

  function reset(contextKey) {
    const key = keyFor(contextKey)
    const value = defaultValue()
    commit(key, undefined)
    return value
  }

  return {list, current, select, reset}
}

module.exports = {createPersonaStore}
