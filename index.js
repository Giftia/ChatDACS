#!/usr/bin/env node
'use strict'

/**
 * Author: Giftina: https://github.com/Giftia/
 * 沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)，一个简单的机器人框架，支持接入哔哩哔哩直播，具备完全功能的web网页控制台。
 */

const {exec} = require('child_process')
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')
const request = require('request')
const url = require('url')

const axios = require('axios').default
const canvas = require('canvas')
const colors = require('colors')
const dayjs = require('dayjs')
const jieba = require('nodejs-jieba')
const nodeSchedule = require('node-schedule')
const Parser = require('rss-parser')
const randomFile = require('select-random-file')
const semverDiff = require('semver-diff')
const trayicon = require('trayicon')
const wallpaper = require('wallpaper')
const winston = require('winston')
const yaml = require('yaml')

require.all = require('require.all')

const Constants = require('./config/constants.js')
const danceCubeAuthorization = require('./plugins/danceCube/authorization.json')
const {sequelize} = require('./plugins/system/model/database.js')
const utils = require('./plugins/system/utils.js')
const {StartLive} = require('./src/bots/bilibili')
const {StartQQBot, configureQQRuntime, sendMessageToQQGroup} = require('./src/bots/qq')
const {verifyNapCatConnection} = require('./src/bots/qq/napcat')
const {StartQQGuild} = require('./src/bots/qqGuild')
const {StartTelegram} = require('./src/bots/telegram')
const {normalizeRuntimeConfig} = require('./src/config/runtimeConfig')
const {ChatProcess, ECYWenDa} = require('./src/core/chat.js')
const {runMigrations} = require('./src/core/migrations')
const {registerProcessErrorHandlers} = require('./src/core/processErrors')
const {createPluginRuntime} = require('./src/plugins/runtime.js')

const versionNumber = `v${require('./package.json').version}`
const version = `ChatDACS ${versionNumber}`

colors.setTheme({
  alert: 'inverse',
  on: 'brightMagenta',
  off: 'gray',
  warn: 'brightYellow',
  error: 'brightRed',
  log: 'brightBlue',
})

jieba.load({
  dict: path.join(process.cwd(), 'config', 'jieba.dict.utf8'),
  hmmDict: path.join(process.cwd(), 'config', 'hmm_model.utf8'),
  userDict: path.join(process.cwd(), 'config', 'userDict.txt'),
  idfDict: path.join(process.cwd(), 'config', 'idf.utf8'),
  stopWordDict: path.join(process.cwd(), 'config', 'stopWordDict.txt'),
})

const voicePlayer = require('play-sound')({
  player: path.join(process.cwd(), 'plugins', 'mpg123', 'mpg123.exe'),
})

const {format, transports} = winston
const myFormat = format.printf(({level, message, timestamp}) => `[${level}] [${timestamp}]: ${message}`)

winston.addColors(Constants.LOG_LEVELS.colors)

const logger = winston.createLogger({
  levels: Constants.LOG_LEVELS.levels,
  format: winston.format.combine(
    format.timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
    format.errors({stack: true}),
    format.json(),
  ),
  transports: [
    new transports.Console({
      format: winston.format.combine(winston.format.colorize(), myFormat),
    }),
    new transports.Http({
      level: 'warn',
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'combined.log',
    }),
  ],
})

let globalConfig = {}
let plugins = {}
let pluginRuntime = null

function warnIfRunningInNonAsciiPath() {
  if (!new RegExp('[\u4e00-\u9fa5]').test(process.cwd())) {
    return
  }

  const warnMessage = `因为Unicode字符的兼容性问题，本程序所在路径不能存在非ASCII字符。如有疑问，请加QQ群 157311946 咨询。当前路径含有非ASCII字符: ${process.cwd()}`
  console.log(warnMessage)
  exec(`msg %username% ${warnMessage}`)
}

function printBanner() {
  logger.info('world.execute(me);'.alert)
  console.log('_______________________________________\n'.rainbow)
  console.log(`\n|          ${version}           |`.alert)
  console.log(' Giftina: https://github.com/Giftia/ \n'.alert)
  console.log('_______________________________________\n'.rainbow)
}

async function main() {
  warnIfRunningInNonAsciiPath()
  printBanner()

  globalConfig = await InitConfig()
  await RunMigration()
  configureQQRuntime({config: globalConfig, logger, utils, axios})
  const {startServer, app, io} = require('./src/server.js')

  registerProcessErrorHandlers({
    io,
    logger,
    notifyAdmin:
      globalConfig.CONNECT_ONE_BOT_SWITCH || globalConfig.GO_CQHTTP_SWITCH
        ? (error) => sendMessageToQQGroup(error, {group_id: 157311946})
        : undefined,
  })

  startServer({
    version,
    globalConfig,
    logger,
    chatProcess: ChatProcess,
    processExecute: ProcessExecute,
  })

  InitPluginSystem(io)
  await StartConfiguredAdapters({app, io})
  CheckUpdate()
}

async function StartConfiguredAdapters({app, io}) {
  const adapterDependencies = {
    app,
    io,
    logger,
    utils,
    axios,
    Constants,
    request,
    plugins,
    voicePlayer,
    chatProcess: ChatProcess,
    processExecute: ProcessExecute,
    ecYWenDa: ECYWenDa,
  }

  if (globalConfig.GO_CQHTTP_SWITCH) {
    startGoCqhttp()
    logger.info(
      `小夜通过go-cqhttp接入QQ，配置: \n  ·对接OneBot协议接口 ${
        globalConfig.ONE_BOT_API_URL
      }\n  ·监听反向post于 127.0.0.1:${globalConfig.WEB_PORT}${globalConfig.ONE_BOT_ANTI_POST_API}\n  ·私聊服务${
        globalConfig.QQBOT_PRIVATE_CHAT_SWITCH ? '开启' : '关闭'
      }`.on,
    )
    await StartQQBot({config: globalConfig, ...adapterDependencies})
  } else if (globalConfig.CONNECT_ONE_BOT_SWITCH) {
    if (globalConfig.ONE_BOT_PROVIDER === 'napcat') {
      await verifyNapCatConnection({config: globalConfig, axios, logger})
    }
    logger.info(
      `小夜通过${globalConfig.ONE_BOT_PROVIDER === 'napcat' ? 'NapCat OneBot 11' : 'OneBot协议'}接入QQ：\n  ·对接OneBot协议接口 ${globalConfig.ONE_BOT_API_URL}\n  ·监听反向post于 127.0.0.1:${
        globalConfig.WEB_PORT
      }${globalConfig.ONE_BOT_ANTI_POST_API}\n  ·私聊服务${globalConfig.QQBOT_PRIVATE_CHAT_SWITCH ? '开启' : '关闭'}`.on,
    )
    await StartQQBot({config: globalConfig, ...adapterDependencies})
  } else {
    logger.info('小夜不启用OneBot协议和go-cqhttp协议'.off)
  }

  if (globalConfig.CONNECT_BILIBILI_LIVE_SWITCH) {
    logger.info(`小夜哔哩哔哩直播接入开启，直播间id为 ${globalConfig.BILIBILI_LIVE_ROOM_ID}`.on)
    StartLive({config: globalConfig, ...adapterDependencies})
  } else {
    logger.info('小夜哔哩哔哩直播接入关闭'.off)
  }

  if (globalConfig.CONNECT_QQ_GUILD_SWITCH) {
    logger.info('小夜QQ频道接入开启'.on)
    StartQQGuild({config: globalConfig, ...adapterDependencies})
  } else {
    logger.info('小夜QQ频道接入关闭'.off)
  }

  if (globalConfig.CONNECT_TELEGRAM_SWITCH) {
    logger.info('小夜Telegram接入开启'.on)
    StartTelegram({config: globalConfig, ...adapterDependencies})
  } else {
    logger.info('小夜Telegram接入关闭'.off)
  }
}

function startGoCqhttp() {
  const autoStartGoCqhttpSystemCondition = ['win32', 'linux']
  const goCqhttpFile = {win32: 'go-cqhttp.bat', linux: './go-cqhttp -faststart'}

  if (!autoStartGoCqhttpSystemCondition.includes(process.platform)) {
    return
  }

  const goCqhttp = exec(
    goCqhttpFile[process.platform],
    {
      cwd: path.join(process.cwd(), 'plugins', 'go-cqhttp'),
      windowsHide: true,
    },
    (error) => {
      if (error) {
        logger.error(`go-cqhttp启动失败，错误原因: ${error}`.error)
        return
      }
      logger.error(
        'go-cqhttp窗口意外退出，qq小夜将无法正常使用，请在右下角托盘区右键小夜头像，选择 重启go-cqhttp'.error,
      )
    },
  )

  if (process.platform === 'linux') {
    goCqhttp.stdout.on('data', (data) => {
      console.log(data.toString())
    })
  }
}

function ReadConfig() {
  return new Promise((resolve, reject) => {
    logger.info('开始加载配置……'.log)
    fs.readFile(path.join(process.cwd(), 'config', 'config.yml'), 'utf-8', (err, data) => {
      if (!err) {
        logger.info('配置加载完毕√'.log)
        resolve(yaml.parse(data))
      } else {
        reject('读取配置文件错误，尝试以默认配置启动。错误原因: ' + err)
      }
    })
  })
}

async function InitConfig() {
  const config = await ReadConfig()
  const newConfig = normalizeRuntimeConfig(config, {logger})
  utils.ConfigureRuntime(newConfig)

  logger.info(newConfig.CHAT_SWITCH ? '小夜web端自动聊天开启'.on : '小夜web端自动聊天关闭'.off)
  return newConfig
}

function InitPluginSystem(io) {
  logger.info('开始加载插件……'.log)
  pluginRuntime = createPluginRuntime({
    pluginDir: path.join(process.cwd(), 'plugins'),
    dependencies: createPluginDependencies(io, globalConfig),
    logger,
    getPluginStatus: utils.GetGroupPluginStatus,
    setPluginStatus: utils.ToggleGroupPlugin,
    timeoutMs: globalConfig.PLUGIN_TIMEOUT_MS ?? 8000,
    switchReg: Constants.plugins_switch_reg,
  })

  plugins = pluginRuntime.load()
  console.log(['当前安装的插件列表：', ...Object.values(plugins).map((plugin) => plugin.插件名)])
  logger.info('插件加载完毕√'.log)
}

function createPluginDependencies(io, runtimeConfig = globalConfig) {
  return {
    axios,
    logger,
    config: runtimeConfig,
    utils,
    fs,
    path,
    request,
    url,
    io,
    plugins,
    os,
    exec,
    schedule: nodeSchedule,
    dayjs,
    jieba,
    yaml,
    winston,
    Parser,
    randomFile,
    wallpaper,
    canvas,
    trayicon,
    Constants,
    constants: Constants,
    voicePlayer,
    sendMessageToQQGroup,
    authorization: danceCubeAuthorization.authorization ?? '',
    baiduGeocodingAk: danceCubeAuthorization.baiduGeocodingAk ?? '',
  }
}

function CheckUpdate() {
  axios
    .get('https://api.github.com/repos/Giftia/ChatDACS/releases/latest', {
      httpsAgent: new https.Agent({rejectUnauthorized: false}),
    })
    .then((res) => {
      if (semverDiff(versionNumber, res.data.tag_name) !== undefined) {
        logger.info(
          `当前小夜版本 ${versionNumber}，检测到小夜最新发行版本是 ${res.data.tag_name}，请前往 https://github.com/Giftia/ChatDACS/releases 更新小夜吧
${res.data.tag_name}更新日志：
${res.data.body}`.alert,
        )
      } else {
        logger.info(`当前小夜已经是最新发行版本 ${versionNumber}`.log)
      }
    })
    .catch((err) => {
      logger.error(`检查小夜更新失败，错误原因: ${err}，可能是网络原因`.error)
    })
}

async function RunMigration({sequelizeInstance = sequelize, migrationsDir = path.join(process.cwd(), 'migrations')} = {}) {
  logger.info('正在检查数据库迁移'.log)
  const result = await runMigrations({
    sequelize: sequelizeInstance,
    migrationsDir,
    logger,
  })

  if (result.applied.length === 0 && result.baselined.length === 0) {
    logger.info('数据库迁移检查完毕，无需迁移√'.log)
  } else {
    logger.info('数据库迁移检查完毕，迁移完毕√'.log)
  }

  return result
}

async function ProcessExecute(msg, userId, userName, groupId, groupName, options) {
  if (!pluginRuntime) {
    logger.warn('插件运行时尚未初始化，不执行插件'.warn)
    return ''
  }

  const result = await pluginRuntime.execute({
    text: msg,
    userId,
    userName,
    groupId,
    groupName,
    platform: options?.type,
    selfId: options?.selfId,
    targetId: options?.targetId,
    raw: options,
  })

  if (!result.handled) {
    return ''
  }

  return {
    type: result.type,
    content: result.content,
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(`ChatDACS 启动失败: ${error?.stack ?? error}`)
    process.exitCode = 1
  })
}

module.exports = {
  InitConfig,
  InitPluginSystem,
  ProcessExecute,
  RunMigration,
  StartConfiguredAdapters,
  createPluginDependencies,
  main,
}
