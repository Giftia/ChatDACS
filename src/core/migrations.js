'use strict'

const fs = require('fs')
const path = require('path')
const SequelizeLibrary = require('sequelize')

const META_TABLE = 'SequelizeMeta'
const INITIAL_MIGRATION = '20221118060907-init.js'
const LEGACY_TABLES = ['users', 'chat', 'messages', 'qqGroups', 'mine', 'perfunctory', 'handGrenade', 'danceCube']

async function runMigrations({sequelize, migrationsDir, logger = console}) {
  if (!sequelize) {
    throw new Error('sequelize is required')
  }
  if (!migrationsDir) {
    throw new Error('migrationsDir is required')
  }

  const migrationNames = listMigrationNames(migrationsDir)
  const queryInterface = sequelize.getQueryInterface()
  const existingTables = normalizeTableNames(await queryInterface.showAllTables())
  const hasMetaTable = existingTables.includes(META_TABLE)
  const businessTables = existingTables.filter((tableName) => tableName !== META_TABLE && tableName !== 'sqlite_sequence')
  const baselined = []

  if (!hasMetaTable) {
    const isFreshDatabase = businessTables.length === 0
    const isLegacyDatabase = LEGACY_TABLES.every((tableName) => businessTables.includes(tableName))

    if (!isFreshDatabase && !isLegacyDatabase) {
      throw new Error(`数据库处于无法识别的部分初始化状态，已有表: ${businessTables.join(', ')}`)
    }

    await createMetaTable(queryInterface)
    if (isLegacyDatabase && migrationNames.includes(INITIAL_MIGRATION)) {
      await markMigrationApplied(queryInterface, INITIAL_MIGRATION)
      baselined.push(INITIAL_MIGRATION)
      loggerCall(logger, 'info', '检测到 v3.7 数据库，已建立迁移基线并保留现有数据')
    }
  }

  const appliedNames = new Set(await readAppliedMigrations(sequelize))
  const applied = []

  for (const migrationName of migrationNames) {
    if (appliedNames.has(migrationName)) {
      continue
    }

    const migrationPath = path.join(migrationsDir, migrationName)
    const migration = require(migrationPath)
    if (typeof migration?.up !== 'function') {
      throw new Error(`迁移文件缺少 up(): ${migrationName}`)
    }

    await migration.up(queryInterface, SequelizeLibrary)
    await markMigrationApplied(queryInterface, migrationName)
    applied.push(migrationName)
    loggerCall(logger, 'info', `数据库迁移已应用: ${migrationName}`)
  }

  return {applied, baselined}
}

function listMigrationNames(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`迁移目录不存在: ${migrationsDir}`)
  }

  return fs
    .readdirSync(migrationsDir, {withFileTypes: true})
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)
    .sort()
}

function normalizeTableNames(tables) {
  return tables.map((table) => (typeof table === 'string' ? table : table.tableName ?? table.name)).filter(Boolean)
}

async function createMetaTable(queryInterface) {
  await queryInterface.createTable(META_TABLE, {
    name: {
      type: SequelizeLibrary.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true,
    },
  })
}

async function readAppliedMigrations(sequelize) {
  const rows = await sequelize.query(`SELECT name FROM ${META_TABLE} ORDER BY name`, {
    type: SequelizeLibrary.QueryTypes.SELECT,
  })
  return rows.map((row) => row.name)
}

async function markMigrationApplied(queryInterface, migrationName) {
  await queryInterface.bulkInsert(META_TABLE, [{name: migrationName}])
}

function loggerCall(logger, level, message) {
  if (typeof logger?.[level] === 'function') {
    logger[level](message)
  }
}

module.exports = {
  INITIAL_MIGRATION,
  LEGACY_TABLES,
  runMigrations,
}
