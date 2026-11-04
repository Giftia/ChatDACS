jest.mock('canvas', () => ({}))
jest.mock('sharp', () => jest.fn())
jest.mock('nodejs-jieba', () => ({}))
jest.mock('fs', () => ({...jest.requireActual('fs'),
  readFile: jest.fn((_file, _encoding, done) => done(null, '{}'))}))

const fs = jest.requireActual('fs')
const os = require('os')
const path = require('path')
const {Sequelize, DataTypes} = require('sequelize')

function deferred() {
  let resolve
  const promise = new Promise(done => {resolve = done})
  return {promise, resolve}
}

function safe(error) {
  return {name: error?.name, code: error?.original?.code ?? error?.parent?.code ?? error?.code}
}

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-plugin-state-'))
  const sequelize = new Sequelize({dialect: 'sqlite', storage: path.join(dir, 'state.sqlite'),
    logging: false, retry: {max: 0}})
  let utils, groups, users, messages
  jest.isolateModules(() => {
    jest.doMock('./model/database', () => ({sequelize, DataTypes}))
    groups = require('./model/qqGroupModel')
    users = require('./model/userModel')
    messages = require('./model/messageModel')
    for (const file of ['mineModel', 'chatModel', 'perfunctoryModel', 'handGrenadeModel']) {
      jest.doMock(`./model/${file}`, () => ({}))
    }
    utils = require('./utils')
  })
  await sequelize.sync()
  await sequelize.query('PRAGMA journal_mode=WAL')
  await users.create({CID: 'fixture', nickname: 'fixture'})
  return {utils, sequelize, groups, users, messages,
    async close() {
      await sequelize.close()
      fs.rmSync(dir, {recursive: true, force: true})
    },
  }
}

describe('real SQLite plugin state concurrency', () => {
  let state
  let log
  beforeEach(async () => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {})
    state = await fixture()
  })
  afterEach(async () => {
    await state?.close()
    log.mockRestore()
  })

  async function concurrentWrites(operation, journal) {
    await state.sequelize.query(`PRAGMA journal_mode=${journal}`)
    const read = deferred(), release = deferred(), messageWritten = deferred(), loginWritten = deferred()
    const writeStarted = deferred()
    let paused = false
    state.groups.addHook('afterFind', 'read-barrier', async () => {
      if (paused) return
      paused = true
      read.resolve()
      await release.promise
    })
    state.messages.addHook('afterCreate', () => messageWritten.resolve())
    state.users.addHook('afterUpdate', () => loginWritten.resolve())
    state.sequelize.addHook('beforeQuery', options => {
      if (options.model === state.messages && options.type === 'INSERT') writeStarted.resolve()
    })
    const pending = operation().then(
      value => ({value}), error => ({error: safe(error)}))
    await read.promise
    state.utils.AddMessage('fixture', 'fixture')
    state.utils.UpdateLoginTimes('fixture')
    if (journal === 'WAL') await Promise.all([messageWritten.promise, loginWritten.promise])
    else {
      await writeStarted.promise
      await new Promise(resolve => setImmediate(resolve))
    }
    release.resolve()
    const result = await pending
    await Promise.all([messageWritten.promise, loginWritten.promise])
    return result
  }

  test('control: original findOrCreate transaction conflicts with intervening WAL writes', async () => {
    const result = await concurrentWrites(async () => {
      await state.groups.findOrCreate({where: {groupId: 789}})
      return true
    }, 'WAL')
    expect(result).toEqual({error: {name: 'SequelizeTimeoutError', code: 'SQLITE_BUSY'}})
  })

  test.each(['WAL', 'DELETE'])('plugin initialization survives AddMessage and UpdateLoginTimes with %s journal', async journal => {
    const result = await concurrentWrites(() => state.utils.GetGroupPluginStatus(789, 'ping'), journal)
    // Never print ORM errors: they contain SQL and request values.
    expect(result).toEqual({value: true})
    expect(await state.groups.count()).toBe(1)
    expect(await state.messages.count()).toBe(1)
    expect((await state.users.findOne()).logintimes).toBe(2)
    expect((await state.groups.findOne()).pluginsList).toEqual({ping: true})
  })

  test.each(['WAL', 'DELETE'])('parallel state updates preserve disabled entries and toggle parity with %s journal', async journal => {
    await state.sequelize.query(`PRAGMA journal_mode=${journal}`)
    await state.groups.create({groupId: 789, pluginsList: {disabled: false}})
    const outcomes = await Promise.all([
      state.utils.GetGroupPluginStatus(789, 'disabled'),
      state.utils.GetGroupPluginStatus('789', 'ping'),
      state.utils.GetGroupPluginStatus(789, 'llm'),
      state.utils.ToggleGroupPlugin('789', 'ping'),
      state.utils.ToggleGroupPlugin(789, 'ping'),
    ].map(promise => promise.then(value => ({value}), error => ({error: safe(error)}))))
    expect(outcomes).toEqual([false, true, true, false, true].map(value => ({value})))
    expect((await state.groups.findOne()).pluginsList).toEqual({disabled: false, ping: true, llm: true})
    expect(await state.groups.count()).toBe(1)
  })

  test.each([789, '789', '', 'legacy-scope'])('retains legacy group ID behavior %#', async groupId => {
    const outcomes = []
    for (const operation of [() => state.utils.GetGroupPluginStatus(groupId, 'ping'),
      () => state.utils.ToggleGroupPlugin(groupId, 'ping'),
      () => state.utils.GetGroupPluginStatus(groupId, 'ping')]) {
      outcomes.push(await operation().then(value => ({value}), error => ({error: safe(error)})))
    }
    expect(outcomes).toEqual([{value: true}, {value: false}, {value: false}])
    expect(await state.groups.count()).toBe(1)
  })

  test('a failed state operation does not poison the per-group queue', async () => {
    const spy = jest.spyOn(state.groups, 'findCreateFind').mockRejectedValueOnce(
      Object.assign(new Error('fixture'), {code: 'FIXTURE_FAILURE'}))
    try {
      const result = await state.utils.GetGroupPluginStatus(789, 'ping').then(
        value => ({value}), error => ({error: safe(error)}))
      expect(result).toEqual({error: {name: 'Error', code: 'FIXTURE_FAILURE'}})
      expect(await state.utils.GetGroupPluginStatus(789, 'ping')).toBe(true)
      expect(await state.groups.count()).toBe(1)
    } finally { spy.mockRestore() }
  })
})
