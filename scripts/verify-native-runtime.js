'use strict'

const assert = require('node:assert/strict')
const {createRequire} = require('node:module')
const path = require('node:path')

async function main() {
  const load = createRequire(path.join(process.cwd(), 'package.json'))
  const canvas = load('canvas')
  const sqlite = load('sqlite3')
  const jieba = load('nodejs-jieba')
  const sharp = load('sharp')
  assert(canvas.createCanvas(2, 2).toBuffer('image/png').length > 0)
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite.Database(':memory:', error => error ? reject(error) : resolve(connection))
  })
  try {
    const row = await new Promise((resolve, reject) => db.get('SELECT 1 AS ok', (error, row) => error ? reject(error) : resolve(row)))
    assert.equal(row.ok, 1)
  } finally {
    await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()))
  }
  assert(jieba.cut('runtime test').length > 0)
  const image = await sharp({create: {width: 2, height: 2, channels: 3, background: 'red'}}).png().toBuffer()
  assert(image.length > 0)
  console.log(JSON.stringify({ok: true, node: process.version, abi: process.versions.modules,
    platform: process.platform, arch: process.arch, modules: ['canvas', 'sqlite3', 'nodejs-jieba', 'sharp']}))
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
module.exports = {main}
