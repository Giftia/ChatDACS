'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const {QueryTypes, Sequelize} = require('sequelize')

const {runMigrations} = require('./migrations')

const MIGRATION_NAMES = [
  '20221118060907-init.js',
  '20221201015645-json-default-value.js',
  '20221208034936-chat-teacherType.js',
  '20260710000000-message-cid-non-unique.js',
]

describe('database migration runtime', () => {
  const resources = []

  afterEach(async () => {
    for (const resource of resources) {
      await resource.sequelize.close()
      fs.rmSync(resource.dir, {recursive: true, force: true})
    }
    resources.length = 0
  })

  test('applies all migrations to a fresh database and is idempotent', async () => {
    const {sequelize} = createDatabase()

    const firstRun = await runMigrations({
      sequelize,
      migrationsDir: path.join(process.cwd(), 'migrations'),
    })
    const secondRun = await runMigrations({
      sequelize,
      migrationsDir: path.join(process.cwd(), 'migrations'),
    })

    expect(firstRun).toEqual({applied: MIGRATION_NAMES, baselined: []})
    expect(secondRun).toEqual({applied: [], baselined: []})
    await expect(readMigrationNames(sequelize)).resolves.toEqual(MIGRATION_NAMES)

    const tables = await sequelize.getQueryInterface().showAllTables()
    expect(tables).toEqual(expect.arrayContaining(['users', 'chat', 'messages', 'qqGroups', 'SequelizeMeta']))

    await sequelize.query(
      "INSERT INTO messages (CID, message, createdAt, updatedAt) VALUES ('same-user', 'first', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    await expect(
      sequelize.query(
        "INSERT INTO messages (CID, message, createdAt, updatedAt) VALUES ('same-user', 'second', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      ),
    ).resolves.toBeDefined()
  })

  test('baselines a v3.7 database and applies only later migrations without data loss', async () => {
    const {sequelize} = createDatabase()
    await createLegacySchema(sequelize)
    await sequelize.query(
      "INSERT INTO chat (ask, answer, teacherUserId, teacherGroupId, createdAt, updatedAt) VALUES ('hello', 'world', 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    await sequelize.query(
      "INSERT INTO qqGroups (groupId, pluginsList, createdAt, updatedAt) VALUES (123, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )
    await sequelize.query(
      "INSERT INTO danceCube (id, userId, location, createdAt, updatedAt) VALUES (1, 456, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )

    const result = await runMigrations({
      sequelize,
      migrationsDir: path.join(process.cwd(), 'migrations'),
    })

    expect(result).toEqual({
      applied: MIGRATION_NAMES.slice(1),
      baselined: [MIGRATION_NAMES[0]],
    })
    await expect(readMigrationNames(sequelize)).resolves.toEqual(MIGRATION_NAMES)

    const [chat] = await sequelize.query('SELECT ask, answer, teacherType FROM chat WHERE ask = ?', {
      replacements: ['hello'],
      type: QueryTypes.SELECT,
    })
    const [group] = await sequelize.query('SELECT groupId, pluginsList FROM qqGroups WHERE groupId = 123', {
      type: QueryTypes.SELECT,
    })
    const [danceCube] = await sequelize.query('SELECT userId, location FROM danceCube WHERE userId = 456', {
      type: QueryTypes.SELECT,
    })

    expect(chat).toEqual({ask: 'hello', answer: 'world', teacherType: null})
    expect(group).toEqual({groupId: 123, pluginsList: '{}'})
    expect(danceCube).toEqual({userId: 456, location: '{}'})
  })

  test('rejects an unrecognized partially initialized database', async () => {
    const {sequelize} = createDatabase()
    await sequelize.query('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, CID VARCHAR UNIQUE)')

    await expect(
      runMigrations({
        sequelize,
        migrationsDir: path.join(process.cwd(), 'migrations'),
      }),
    ).rejects.toThrow('无法识别的部分初始化状态')
  })

  test('removes the accidental unique CID constraint from an existing alpha database', async () => {
    const {sequelize} = createDatabase()
    await sequelize.query(
      'CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, CID VARCHAR UNIQUE, message VARCHAR, createdAt DATETIME, updatedAt DATETIME)',
    )
    await sequelize.query('CREATE TABLE SequelizeMeta (name VARCHAR(255) NOT NULL UNIQUE PRIMARY KEY)')
    await sequelize.getQueryInterface().bulkInsert(
      'SequelizeMeta',
      MIGRATION_NAMES.slice(0, 3).map((name) => ({name})),
    )
    await sequelize.query(
      "INSERT INTO messages (CID, message, createdAt, updatedAt) VALUES ('same-user', 'first', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
    )

    const result = await runMigrations({
      sequelize,
      migrationsDir: path.join(process.cwd(), 'migrations'),
    })

    expect(result.applied).toEqual([MIGRATION_NAMES[3]])
    await expect(
      sequelize.query(
        "INSERT INTO messages (CID, message, createdAt, updatedAt) VALUES ('same-user', 'second', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      ),
    ).resolves.toBeDefined()
  })

  function createDatabase() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-migrations-'))
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: path.join(dir, 'db.sqlite'),
      logging: false,
    })
    resources.push({dir, sequelize})
    return {dir, sequelize}
  }
})

async function readMigrationNames(sequelize) {
  const rows = await sequelize.query('SELECT name FROM SequelizeMeta ORDER BY name', {type: QueryTypes.SELECT})
  return rows.map((row) => row.name)
}

async function createLegacySchema(sequelize) {
  const statements = [
    'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, CID INTEGER UNIQUE, nickname VARCHAR, logintimes INTEGER DEFAULT 1, createdAt DATETIME, updatedAt DATETIME)',
    'CREATE TABLE chat (id INTEGER PRIMARY KEY AUTOINCREMENT, ask VARCHAR, answer VARCHAR, teacherUserId INTEGER, teacherGroupId INTEGER, createdAt DATETIME, updatedAt DATETIME)',
    'CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, CID INTEGER, message VARCHAR, createdAt DATETIME, updatedAt DATETIME)',
    'CREATE TABLE qqGroups (id INTEGER PRIMARY KEY AUTOINCREMENT, groupId INTEGER UNIQUE, serviceEnabled BOOLEAN DEFAULT 1, loopBombEnabled BOOLEAN DEFAULT 0, loopBombAnswer VARCHAR, loopBombHolder INTEGER, loopBombStartTime INTEGER, pluginsList VARCHAR, createdAt DATETIME, updatedAt DATETIME)',
    'CREATE TABLE mine (id INTEGER PRIMARY KEY AUTOINCREMENT, groupId INTEGER, owner INTEGER, createdAt DATETIME, updatedAt DATETIME)',
    'CREATE TABLE perfunctory (id INTEGER PRIMARY KEY AUTOINCREMENT, content VARCHAR, createdAt DATETIME, updatedAt DATETIME)',
    'CREATE TABLE handGrenade (id INTEGER PRIMARY KEY, userId INTEGER UNIQUE, times INTEGER, createdAt DATETIME, updatedAt DATETIME)',
    'CREATE TABLE danceCube (id INTEGER PRIMARY KEY, userId INTEGER UNIQUE, playerId INTEGER, playerName VARCHAR, location VARCHAR, createdAt DATETIME, updatedAt DATETIME)',
  ]

  for (const statement of statements) {
    await sequelize.query(statement)
  }
}
