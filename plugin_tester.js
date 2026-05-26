'use strict'
/**
 * Author: Giftina: https://github.com/Giftia/
 * 适合 沙雕Ai聊天系统 ChatDACS 的插件测试器
 */

const path = require('path')
const colors = require('colors')
const readline = require('readline')
const {createPluginRuntime} = require('./src/plugins/runtime')

// 日志染色颜色配置
colors.setTheme({
  alert: 'inverse',
  on: 'brightMagenta',
  off: 'brightGreen',
  warn: 'brightYellow',
  error: 'brightRed',
  log: 'brightBlue',
})

function createTesterRuntime({
  pluginDir = path.join(process.cwd(), 'plugins'),
  dependencies = require('./plugin_dependencies'),
  logger = console,
  timeoutMs = 8000,
} = {}) {
  const runtime = createPluginRuntime({
    pluginDir,
    dependencies,
    logger,
    getPluginStatus: async () => true,
    setPluginStatus: async () => true,
    timeoutMs,
  })
  runtime.load()
  return runtime
}

async function run(msg, runtime) {
  const defaultUserId = 114514,
    defaultUserName = '测试用户',
    defaultGroupId = 1919810,
    defaultGroupName = '测试群组',
    defaultOptions = {type: 'test'}

  const result = await runtime.execute({
    text: msg,
    userId: defaultUserId,
    userName: defaultUserName,
    groupId: defaultGroupId,
    groupName: defaultGroupName,
    platform: defaultOptions.type,
    raw: defaultOptions,
  })

  if (!result.handled) {
    return ''
  }

  return {
    type: result.type,
    content: result.content,
  }
}

function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const runtime = createTesterRuntime()

  console.log('ChatDACS插件测试器 v2.0，用于快速验证插件功能'.alert)
  console.log('插件加载完毕√'.log)
  console.log('现在可以在命令行中输入指令来验证插件功能，按回车提交，按 Ctrl + c 2次退出\n'.warn)

  rl.on('line', async (input) => {
    const result = await run(input, runtime)
    if (result != '') {
      console.log(result)
    }
  })
}

if (require.main === module) {
  main()
}

module.exports = {
  createTesterRuntime,
  run,
  main,
}
