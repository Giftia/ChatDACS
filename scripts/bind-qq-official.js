'use strict'

const {DEFAULT_FILE, saveCredentials} = require('../src/bots/qqOfficial/credentials')

async function run({connector, filePath = DEFAULT_FILE, logger = console, signal} = {}) {
  connector ??= await import('@tencent-connect/qqbot-connector')
  let credentials
  try {
    credentials = await connector.qrConnect({signal})
  } catch {
    throw new Error('QQ官方绑定未完成或已取消')
  }
  if (!Array.isArray(credentials) || credentials.length !== 1) {
    throw new Error('当前仅支持绑定一个QQ官方机器人')
  }
  const destination = saveCredentials({credentials: credentials[0], filePath})
  logger.log('QQ官方机器人凭据已保存；请启用 CONNECT_QQ_OFFICIAL_SWITCH 后启动 ChatDACS')
  return {filePath: destination}
}

function parseArgs(args) {
  if (args.length === 0) return {filePath: DEFAULT_FILE}
  if (args.length === 2 && args[0] === '--file' && args[1] && !args[1].startsWith('--')) {
    return {filePath: args[1]}
  }
  throw new Error('用法: npm run qq:official:bind -- [--file PATH]')
}

if (require.main === module) {
  const abort = new AbortController()
  const cancel = () => abort.abort()
  process.once('SIGINT', cancel)
  process.once('SIGTERM', cancel)
  Promise.resolve().then(() => run({...parseArgs(process.argv.slice(2)), signal: abort.signal}))
    .catch(() => {
      console.error('QQ官方绑定失败，请检查网络、参数与本地凭据目录权限；密钥不会输出到日志')
      process.exitCode = 1
    }).finally(() => {
      process.removeListener('SIGINT', cancel)
      process.removeListener('SIGTERM', cancel)
    })
}

module.exports = {run, parseArgs}
