#!/usr/bin/env node
'use strict'

/**
 * Author: Giftina: https://github.com/Giftia/
 * 沙雕Ai聊天系统 ChatDACS (Chatbot : shaDiao Ai Chat System)，一个简单的机器人框架，支持接入哔哩哔哩直播，具备完全功能的web网页控制台。
 */

const {exec, execFile} = require('child_process')
const fs = require('fs')
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
const {verifyOneBotConnection} = require('./src/bots/qq/oneBotProvider')
const {createOneBotHttpClient} = require('./src/platforms/oneBotHttp')
const {StartQQGuild} = require('./src/bots/qqGuild')
const {StartTelegram} = require('./src/bots/telegram')
const {normalizeRuntimeConfig} = require('./src/config/runtimeConfig')
const {readConfig} = require('./src/config/readConfig')
const {ChatProcess, ECYWenDa, matchChat} = require('./src/core/chat.js')
const {runMigrations} = require('./src/core/migrations')
const {registerProcessErrorHandlers} = require('./src/core/processErrors')
const {createPluginRuntime} = require('./src/plugins/runtime.js')
const {createConversationPluginStateStore} = require('./src/plugins/conversationState')
const {createProactiveChat} = require('./src/plugins/proactiveChat')
const {createOneBotSender} = require('./src/platforms/oneBotSender')
const {textChunks} = require('./src/bots/qqOfficial/response')
const {startQQOfficial} = require('./src/bots/qqOfficial')

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

function oneBotHttp(runtimeConfig = globalConfig) {
  return createOneBotHttpClient({axios, config: runtimeConfig})
}

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

async function main({configPath, pluginDependencyOverrides, checkUpdates = true} = {}) {
  let http, io, errorHandlers, adapters, adapterStartup, stopping
  const report = (code) => { try { logger.error(code) } catch (_) {} }
  const stop = () => {
    if (stopping) return stopping
    let failed = false
    const attempt = async (action, code) => {
      try { await action() } catch (_) { failed = true; report(code) }
    }
    stopping = Promise.resolve().then(async () => {
      try {
        await attempt(async () => {
          const initialized = adapters ?? await adapterStartup?.catch(() => undefined)
          await initialized?.stop()
        }, 'ADAPTER_STOP_FAILED')
      } finally {
        try {
          await attempt(() => io && new Promise((resolve, reject) => {
            io.close((error) => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve())
          }), 'SOCKET_STOP_FAILED')
        } finally {
          try {
            await attempt(() => http && new Promise((resolve, reject) => {
              http.close((error) => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve())
            }), 'HTTP_STOP_FAILED')
          } finally {
            await attempt(() => sequelize.close(), 'DATABASE_STOP_FAILED')
          }
        }
      }
      if (failed) throw Object.assign(new Error('APP_STOP_FAILED'), {code: 'APP_STOP_FAILED'})
    })
    try { errorHandlers?.dispose() } catch (_) { failed = true; report('PROCESS_HANDLER_STOP_FAILED') }
    return stopping
  }
  try {
    warnIfRunningInNonAsciiPath()
    printBanner()

    globalConfig = await InitConfig(configPath)
    await RunMigration()
    configureQQRuntime({config: globalConfig, logger, utils, axios: oneBotHttp()})
    const server = require('./src/server.js')
    ;({io, http} = server)
    const {startServer, app} = server

    errorHandlers = registerProcessErrorHandlers({
      io,
      logger,
      notifyAdmin:
        (globalConfig.CONNECT_ONE_BOT_SWITCH || globalConfig.GO_CQHTTP_SWITCH) &&
        /^\d+$/.test(String(globalConfig.ERROR_NOTIFY_GROUP_ID ?? ''))
          ? ({code}) => sendMessageToQQGroup(`系统处理失败 (${code})`, {group_id: globalConfig.ERROR_NOTIFY_GROUP_ID})
          : undefined,
    })

    http.once('close', () => { void stop().catch(() => {}) })
    startServer({
      version,
      globalConfig,
      logger,
      chatProcess: ChatProcess,
      processExecute: ProcessExecute,
    })

    InitPluginSystem(io, {dependencies: pluginDependencyOverrides})
    adapterStartup = StartConfiguredAdapters({app, io})
    adapters = await adapterStartup
    if (stopping) await stopping
    else if (checkUpdates) CheckUpdate()
    return {http, io, stop}
  } catch (error) {
    await stop().catch(() => {})
    const code = ['CONFIG_READ_FAILED', 'CONFIG_INVALID'].includes(error?.code) ? error.code : 'APP_START_FAILED'
    throw Object.assign(new Error(code), {code})
  }
}

async function StartConfiguredAdapters({app, io, config = globalConfig}) {
  const controllers = []
  let stopping
  const fail = (code) => Object.assign(new Error(code), {code})
  const track = (controller) => {
    if (typeof controller?.stop !== 'function') throw fail('ADAPTER_CONTROLLER_INVALID')
    controllers.push(controller)
  }
  const startPlatform = async (start, code) => {
    let controller
    try { controller = await start() } catch (_) {
      try { logger.error(code) } catch (_) {}
      return
    }
    // Contract validation belongs to orchestration, not platform degradation.
    track(controller)
  }
  const stop = () => {
    if (!stopping) {
      stopping = Promise.resolve().then(async () => {
        let failed = false
        for (const controller of [...controllers].reverse()) {
          try { await controller.stop() } catch (_) {
            failed = true
            try { logger.error('ADAPTER_STOP_FAILED') } catch (_) {}
          }
        }
        if (failed) throw fail('ADAPTER_STOP_FAILED')
      })
    }
    return stopping
  }
  try {
    await startPlatform(() => startQQOfficial({
      config,
      logger,
      execute: (context) => pluginRuntime.execute(context),
      chatProcess: ChatProcess,
    }), 'QQ_OFFICIAL_START_FAILED')
    const adapterDependencies = {
      app,
      io,
      logger,
      utils,
      axios: oneBotHttp(config),
      Constants,
      request,
      plugins,
      voicePlayer,
      chatProcess: ChatProcess,
      processExecute: ProcessExecute,
      ecYWenDa: ECYWenDa,
      conversation: {
        execute: context => pluginRuntime.execute(context),
        matchChat,
        fallback: context => pluginRuntime.executeFallback(context),
        observe: context => plugins.ollama?.observeMessage?.(context),
        recordReply: (context, text) => plugins.ollama?.recordReply?.(context, text),
        createProactive: ({send}) => {
          const options = config.llm?.proactive
          if (options?.enabled !== true) return null
          const sender = createOneBotSender({apiUrl: config.ONE_BOT_API_URL, axios: oneBotHttp(config)})
          return createProactiveChat({
            ...options, groupIds: Array.isArray(options.groupIds) ? options.groupIds : [], logger,
            generate: context => plugins.ollama?.generateProactive?.(context),
            canSend: async context => {
              if (!await pluginRuntime.isEnabled('ollama', context) ||
                  !await pluginRuntime.isEnabled('proactiveChat', context)) return false
              const member = (await sender.getGroupMemberInfo(context.targetId, context.selfId, 1))?.data?.data
              if (!member || !Number.isFinite(Number(member.shut_up_timestamp)) ||
                  Number(member.shut_up_timestamp) > Date.now() / 1000) return false
              const group = (await sender.getGroupInfo(context.targetId, 1))?.data?.data
              return Boolean(group && (Number(group.group_all_shut) === 0 || ['owner', 'admin'].includes(member.role)))
            },
            send: async (context, text) => {
              const chunks = textChunks(text)
              for (const chunk of chunks) await send(context, chunk)
              plugins.ollama?.recordReply?.(context, chunks.join('\n'))
            },
          })
        },
      },
    }

    if (config.GO_CQHTTP_SWITCH) {
      startGoCqhttp()
      logger.info(
        `小夜通过go-cqhttp接入QQ，配置: \n  ·对接OneBot协议接口 ${
          config.ONE_BOT_API_URL
        }\n  ·监听反向post于 127.0.0.1:${config.WEB_PORT}${config.ONE_BOT_ANTI_POST_API}\n  ·私聊服务${
          config.QQBOT_PRIVATE_CHAT_SWITCH ? '开启' : '关闭'
        }`.on,
      )
      await startPlatform(() => StartQQBot({config, ...adapterDependencies}), 'QQ_START_FAILED')
    } else if (config.CONNECT_ONE_BOT_SWITCH) {
      logger.info(
        `小夜通过${config.ONE_BOT_PROVIDER === 'napcat' ? 'NapCat OneBot 11' : 'OneBot协议'}接入QQ：\n  ·对接OneBot协议接口 ${config.ONE_BOT_API_URL}\n  ·监听反向post于 127.0.0.1:${
          config.WEB_PORT
        }${config.ONE_BOT_ANTI_POST_API}\n  ·私聊服务${config.QQBOT_PRIVATE_CHAT_SWITCH ? '开启' : '关闭'}`.on,
      )
      await startPlatform(() => StartQQBot({config, ...adapterDependencies}), 'QQ_START_FAILED')
      try {
        await verifyOneBotConnection({config, axios, logger})
      } catch {
        logger.warn('ONEBOT_PROBE_FAILED')
      }
    } else {
      logger.info('小夜不启用OneBot协议和go-cqhttp协议'.off)
    }

    if (config.CONNECT_BILIBILI_LIVE_SWITCH) {
      logger.info(`小夜哔哩哔哩直播接入开启，直播间id为 ${config.BILIBILI_LIVE_ROOM_ID}`.on)
      await startPlatform(() => StartLive({config, ...adapterDependencies}), 'BILIBILI_START_FAILED')
    } else {
      logger.info('小夜哔哩哔哩直播接入关闭'.off)
    }

    if (config.CONNECT_QQ_GUILD_SWITCH) {
      logger.info('小夜QQ频道接入开启'.on)
      await startPlatform(() => StartQQGuild({config, ...adapterDependencies}), 'QQ_GUILD_START_FAILED')
    } else {
      logger.info('小夜QQ频道接入关闭'.off)
    }

    if (config.CONNECT_TELEGRAM_SWITCH) {
      logger.info('小夜Telegram接入开启'.on)
      await startPlatform(() => StartTelegram({config, ...adapterDependencies}), 'TELEGRAM_START_FAILED')
    } else {
      logger.info('小夜Telegram接入关闭'.off)
    }
    return {stop}
  } catch (error) {
    await stop().catch(() => {})
    throw fail(error?.code === 'ADAPTER_CONTROLLER_INVALID' ? error.code : 'ADAPTER_START_FAILED')
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

async function ReadConfig(configPath = path.join(process.cwd(), 'config', 'config.yml')) {
  logger.info('开始加载配置……'.log)
  const config = await readConfig(configPath)
  logger.info('配置加载完毕√'.log)
  return config
}

async function InitConfig(configPath) {
  const config = await ReadConfig(configPath)
  const newConfig = normalizeRuntimeConfig(config, {logger})
  utils.ConfigureRuntime(newConfig)

  logger.info(newConfig.CHAT_SWITCH ? '小夜web端自动聊天开启'.on : '小夜web端自动聊天关闭'.off)
  return newConfig
}

function InitPluginSystem(io, {dependencies = {}} = {}) {
  logger.info('开始加载插件……'.log)
  pluginRuntime = createPluginRuntime({
    pluginDir: path.join(process.cwd(), 'plugins'),
    dependencies: {...createPluginDependencies(io, globalConfig), ...dependencies},
    logger,
    getPluginStatus: utils.GetGroupPluginStatus,
    setPluginStatus: utils.ToggleGroupPlugin,
    timeoutMs: globalConfig.PLUGIN_TIMEOUT_MS ?? 8000,
    pluginTimeouts: globalConfig.PLUGIN_TIMEOUTS,
    switchReg: Constants.plugins_switch_reg,
    conversationState: createConversationPluginStateStore({sequelize}),
    officialPluginAllowlist: globalConfig.QQ_OFFICIAL_PLUGIN_ALLOWLIST,
  })

  plugins = pluginRuntime.load()
  console.log(['当前安装的插件列表：', ...Object.values(plugins).map((plugin) => plugin.插件名)])
  logger.info('插件加载完毕√'.log)
}

function createPluginDependencies(io, runtimeConfig = globalConfig) {
  return {
    axios: oneBotHttp(runtimeConfig),
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
    execFile,
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
      timeout: 8000,
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
    ...(result.safeError ? {safeError: result.safeError} : {}),
    ...(result.timeout ? {timeout: true} : {}),
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
  ReadConfig,
  StartConfiguredAdapters,
  createPluginDependencies,
  main,
}
