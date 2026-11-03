'use strict'

const fs = require('fs')
const path = require('path')
const {randomUUID} = require('crypto')

const DEFAULT_FILE = 'config/qq-official.credentials.json'

function validateCredentials(value) {
  if (!value || typeof value.appId !== 'string' || !value.appId.trim() ||
      typeof value.appSecret !== 'string' || !value.appSecret.trim()) {
    throw new Error('QQ官方凭据必须包含 appId 和 appSecret')
  }
  return {appId: value.appId.trim(), appSecret: value.appSecret.trim()}
}

function readCredentials({config = {}, env = process.env} = {}) {
  if (env.QQBOT_APPID !== undefined || env.QQBOT_SECRET !== undefined) {
    return validateCredentials({appId: env.QQBOT_APPID, appSecret: env.QQBOT_SECRET})
  }
  const filePath = path.resolve(config.QQ_OFFICIAL_CREDENTIALS_FILE ?? DEFAULT_FILE)
  let source
  try {
    source = fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw new Error('无法读取QQ官方凭据文件')
  }
  try {
    return validateCredentials(JSON.parse(source))
  } catch {
    throw new Error('QQ官方凭据文件格式错误')
  }
}

function saveCredentials({credentials, filePath = DEFAULT_FILE}) {
  const value = validateCredentials(credentials)
  const destination = path.resolve(filePath)
  fs.mkdirSync(path.dirname(destination), {recursive: true})
  const temporary = `${destination}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, {encoding: 'utf8', mode: 0o600, flag: 'wx'})
    fs.renameSync(temporary, destination)
  } finally {
    fs.rmSync(temporary, {force: true})
  }
  return destination
}

module.exports = {DEFAULT_FILE, readCredentials, saveCredentials}
