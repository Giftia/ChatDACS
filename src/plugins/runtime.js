'use strict'

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_SWITCH_REG = /^插件[开关] (.*)/
const TIMEOUT_RESULT = Symbol('plugin-timeout')

function createPluginRuntime({
  pluginDir,
  dependencies = {},
  logger = console,
  getPluginStatus = async () => true,
  setPluginStatus = async () => true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  switchReg = DEFAULT_SWITCH_REG,
} = {}) {
  if (!pluginDir) {
    throw new Error('pluginDir is required')
  }

  const requireAll = require('require.all')
  let plugins = {}
  const pluginNameMap = new Map()
  const commandEntries = []
  const pluginStatusCache = new Map()
  const loadReports = []
  const logInfo = (message) => loggerCall(logger, 'info', message)
  const logWarn = (message) => loggerCall(logger, 'warn', message)
  const logError = (message) => loggerCall(logger, 'error', message)

  function load() {
    pluginNameMap.clear()
    commandEntries.length = 0
    pluginStatusCache.clear()
    loadReports.length = 0

    plugins = requireAll({
      dir: pluginDir,
      match: /\.js$/,
      require: /\.js$/,
      recursive: false,
      encoding: 'utf-8',
    })

    dependencies.plugins = plugins

    for (const [moduleName, plugin] of Object.entries(plugins)) {
      const report = createLoadReport(moduleName, plugin)
      loadReports.push(report)

      if (!report.valid) {
        logWarn(`插件 ${moduleName} 元数据不完整，已跳过: ${report.errors.join(', ')}`)
        continue
      }

      if (typeof plugin.init === 'function') {
        try {
          plugin.init(dependencies)
        } catch (error) {
          report.initError = error
          logError(`插件 ${plugin.插件名} 初始化失败: ${formatError(error)}`)
        }
      }

      try {
        const compiledReg = new RegExp(plugin.指令)
        pluginNameMap.set(plugin.插件名, plugin)
        commandEntries.push({plugin, compiledReg})
      } catch (error) {
        report.valid = false
        report.errors.push(`指令正则无效: ${error.message}`)
        logWarn(`插件 ${plugin.插件名} 指令正则无效，已跳过: ${error.message}`)
      }
    }

    return plugins
  }

  async function execute(messageContext) {
    const context = normalizeMessageContext(messageContext)
    const startedAt = Date.now()

    try {
      const switchMatch = context.text.match(switchReg)
      if (switchMatch) {
        return toggleFromMessage(context, switchMatch[1], startedAt)
      }

      for (const entry of commandEntries) {
        entry.compiledReg.lastIndex = 0
        if (!entry.compiledReg.test(context.text)) {
          continue
        }

        const pluginName = entry.plugin.插件名
        const pluginStatus = await readPluginStatus(context.groupId, pluginName)
        if (!pluginStatus) {
          logWarn(`群${context.groupId} 的插件 ${pluginName} 已关闭，不响应`)
          return response({
            handled: true,
            type: 'text',
            content: `群内的 ${pluginName} 已关闭，不响应`,
            pluginName,
            elapsedMs: Date.now() - startedAt,
          })
        }

        const result = await executePlugin(entry.plugin, context, startedAt)
        if (result.handled) {
          return result
        }
      }
    } catch (error) {
      logError(`Error in plugin runtime execute: ${formatError(error)}`)
      return response({
        handled: true,
        type: 'text',
        content: `插件爆炸啦：${formatError(error)}`,
        elapsedMs: Date.now() - startedAt,
        error,
      })
    }

    return response({handled: false, type: 'text', content: '', elapsedMs: Date.now() - startedAt})
  }

  async function toggle(groupId, pluginName) {
    const plugin = pluginNameMap.get(pluginName)
    if (!plugin) {
      return {ok: false, status: false, pluginName}
    }

    const status = await setPluginStatus(groupId, pluginName)
    pluginStatusCache.delete(statusCacheKey(groupId, pluginName))
    logInfo(`群${groupId} 的插件 ${plugin.插件名} 状态切换为 ${status}`)
    return {ok: true, status, pluginName}
  }

  function list() {
    return loadReports.map((report) => ({
      moduleName: report.moduleName,
      pluginName: report.pluginName,
      command: report.command,
      version: report.version,
      author: report.author,
      description: report.description,
      valid: report.valid,
      errors: [...report.errors],
      initError: report.initError ? formatError(report.initError) : null,
    }))
  }

  async function toggleFromMessage(context, pluginName, startedAt) {
    if (!pluginName) {
      return response({
        handled: true,
        type: 'text',
        content: '插件名获取有误',
        elapsedMs: Date.now() - startedAt,
      })
    }

    const result = await toggle(context.groupId, pluginName)
    if (!result.ok) {
      return response({
        handled: false,
        type: 'text',
        content: '',
        pluginName,
        elapsedMs: Date.now() - startedAt,
      })
    }

    return response({
      handled: true,
      type: 'text',
      content: `${pluginName} 已${result.status ? '开启' : '关闭'}`,
      pluginName,
      elapsedMs: Date.now() - startedAt,
    })
  }

  async function executePlugin(plugin, context, startedAt) {
    const pluginName = plugin.插件名
    const pluginPromise = Promise.resolve().then(() =>
      plugin.execute(
        context.text,
        context.userId,
        context.userName,
        context.groupId,
        context.groupName,
        createLegacyOptions(context),
      ),
    )

    let timeoutId
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(TIMEOUT_RESULT), timeoutMs)
    })

    let pluginReturn
    try {
      pluginReturn = await Promise.race([pluginPromise, timeoutPromise])
    } catch (error) {
      clearTimeout(timeoutId)
      const elapsedMs = Date.now() - startedAt
      const errorMessage = `插件 ${plugin.插件名} ${plugin.版本} 处理用户${context.userId}（${context.userName}）的消息"${context.text}"时爆炸啦: ${formatError(error)}`
      logError(errorMessage)
      if (typeof dependencies.sendMessageToQQGroup === 'function') {
        await dependencies.sendMessageToQQGroup(errorMessage, {group_id: 157311946})
      }
      return response({
        handled: true,
        type: 'text',
        content: errorMessage,
        pluginName,
        elapsedMs,
        error,
      })
    }

    if (pluginReturn === TIMEOUT_RESULT) {
      pluginPromise
        .then(() => logWarn(`插件 ${pluginName} 超时后完成，已忽略迟到响应`))
        .catch((error) => logError(`插件 ${pluginName} 超时后失败: ${formatError(error)}`))

      const elapsedMs = Date.now() - startedAt
      logWarn(`插件 ${pluginName} 在 ${context.platform} 执行超时，耗时 ${elapsedMs}ms`)
      return response({
        handled: true,
        type: 'text',
        content: '插件响应超时，请稍后再试',
        pluginName,
        elapsedMs,
        timeout: true,
      })
    }

    clearTimeout(timeoutId)
    const elapsedMs = Date.now() - startedAt
    const normalized = normalizePluginReturn(pluginReturn, {pluginName, elapsedMs})
    if (normalized.handled) {
      logInfo(`插件 ${pluginName} ${plugin.版本 ?? ''} 响应了消息，耗时 ${elapsedMs}ms`)
    }
    return normalized
  }

  async function readPluginStatus(groupId, pluginName) {
    const cacheKey = statusCacheKey(groupId, pluginName)
    if (pluginStatusCache.has(cacheKey)) {
      return pluginStatusCache.get(cacheKey)
    }

    const status = await getPluginStatus(groupId, pluginName)
    pluginStatusCache.set(cacheKey, status)
    return status
  }

  return {
    load,
    execute,
    list,
    toggle,
    get plugins() {
      return plugins
    },
  }
}

function createLoadReport(moduleName, plugin) {
  const errors = []
  if (!plugin || typeof plugin !== 'object') {
    errors.push('插件导出必须是对象')
  }
  if (!plugin?.插件名) {
    errors.push('缺少 插件名')
  }
  if (!Object.prototype.hasOwnProperty.call(plugin ?? {}, '指令') || plugin.指令 === null || plugin.指令 === undefined) {
    errors.push('缺少 指令')
  }
  if (typeof plugin?.execute !== 'function') {
    errors.push('缺少 execute')
  }

  return {
    moduleName,
    pluginName: plugin?.插件名,
    command: plugin?.指令,
    version: plugin?.版本,
    author: plugin?.作者,
    description: plugin?.描述,
    valid: errors.length === 0,
    errors,
    initError: null,
  }
}

function normalizeMessageContext(messageContext) {
  if (typeof messageContext === 'string') {
    return {
      text: messageContext,
      userId: '',
      userName: '',
      groupId: '',
      groupName: '',
      platform: 'unknown',
      raw: null,
    }
  }

  return {
    text: String(messageContext?.text ?? ''),
    userId: messageContext?.userId ?? '',
    userName: messageContext?.userName ?? '',
    groupId: messageContext?.groupId ?? '',
    groupName: messageContext?.groupName ?? '',
    platform: messageContext?.platform ?? messageContext?.raw?.type ?? 'unknown',
    selfId: messageContext?.selfId,
    targetId: messageContext?.targetId,
    raw: messageContext?.raw ?? null,
  }
}

function createLegacyOptions(context) {
  return {
    ...(context.raw ?? {}),
    type: context.platform,
    platform: context.platform,
    selfId: context.selfId,
    targetId: context.targetId,
    raw: context.raw,
  }
}

function normalizePluginReturn(pluginReturn, metadata = {}) {
  const elapsedMs = metadata.elapsedMs ?? 0
  if (pluginReturn === '' || pluginReturn === null || pluginReturn === undefined || pluginReturn === false || pluginReturn === 0) {
    return response({
      handled: false,
      type: 'text',
      content: '',
      pluginName: metadata.pluginName,
      elapsedMs,
    })
  }

  if (typeof pluginReturn === 'string') {
    return response({
      handled: true,
      type: 'text',
      content: pluginReturn,
      pluginName: metadata.pluginName,
      elapsedMs,
    })
  }

  if (typeof pluginReturn === 'object') {
    return response({
      handled: true,
      type: pluginReturn.type ?? 'text',
      content: pluginReturn.content ?? '',
      pluginName: metadata.pluginName,
      elapsedMs,
      raw: pluginReturn,
    })
  }

  return response({
    handled: true,
    type: 'text',
    content: String(pluginReturn),
    pluginName: metadata.pluginName,
    elapsedMs,
  })
}

function response(result) {
  return {
    handled: Boolean(result.handled),
    type: result.type ?? 'text',
    content: result.content ?? '',
    pluginName: result.pluginName,
    elapsedMs: result.elapsedMs ?? 0,
    error: result.error,
    timeout: result.timeout ?? false,
    raw: result.raw,
  }
}

function statusCacheKey(groupId, pluginName) {
  return `${groupId}-${pluginName}`
}

function formatError(error) {
  return error?.stack ?? error?.message ?? String(error)
}

function loggerCall(logger, level, message) {
  if (logger?.[level]) {
    logger[level](message)
    return
  }
  if (console[level]) {
    console[level](message)
  }
}

module.exports = {
  createPluginRuntime,
  normalizePluginReturn,
  DEFAULT_TIMEOUT_MS,
}
