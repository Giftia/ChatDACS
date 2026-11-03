'use strict'

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_SWITCH_REG = /^插件[开关] (.*)/
const TIMEOUT_RESULT = Symbol('plugin-timeout')
const CONVERSATION_PLATFORMS = new Set(['qqOfficial', 'qqGuildDirect'])

function createPluginRuntime({
  pluginDir,
  dependencies = {},
  logger = console,
  getPluginStatus = async () => true,
  setPluginStatus = async () => true,
  conversationState,
  officialPluginAllowlist = ['ping', 'help'],
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pluginTimeouts = {},
  notifyPluginError,
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
          report.initError = 'PLUGIN_INIT_ERROR'
          logError(JSON.stringify({code: 'PLUGIN_INIT_ERROR', pluginName: plugin.插件名}))
        }
      }

      try {
        const compiledReg = new RegExp(plugin.指令)
        pluginNameMap.set(plugin.插件名, plugin)
        commandEntries.push({plugin, compiledReg, moduleName})
      } catch (error) {
        report.valid = false
        report.errors.push('PLUGIN_PATTERN_ERROR')
        logWarn(JSON.stringify({code: 'PLUGIN_PATTERN_ERROR', pluginName: plugin.插件名}))
      }
    }

    return plugins
  }

  async function execute(messageContext) {
    const context = normalizeMessageContext(messageContext)
    const startedAt = Date.now()
    let activePluginName

    try {
      const switchMatch = context.text.match(switchReg)
      if (switchMatch) {
        activePluginName = pluginNameMap.get(switchMatch[1])?.插件名
        return await toggleFromMessage(context, switchMatch[1], startedAt)
      }

      for (const entry of commandEntries) {
        entry.compiledReg.lastIndex = 0
        if (!entry.compiledReg.test(context.text)) {
          continue
        }

        const pluginName = entry.plugin.插件名
        activePluginName = pluginName
        if (!isAllowed(context, entry)) {
          // Catch-all plugins must not hide later, supported commands.
          if (String(entry.plugin.指令) === '') continue
          return response({handled: true, type: 'text', content: '该插件暂不支持官方 QQ 通道', pluginName})
        }
        const pluginStatus = await readPluginStatus(context, pluginName)
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

        const result = await executePlugin(entry.plugin, context, startedAt, entry.moduleName)
        if (result.handled) {
          return result
        }
      }
    } catch (error) {
      const safeError = await reportFailure('PLUGIN_RUNTIME_ERROR', activePluginName, context, startedAt)
      return response({
        handled: true,
        type: 'text',
        content: '插件处理失败，请稍后再试',
        pluginName: activePluginName,
        elapsedMs: safeError.elapsedMs,
        safeError,
      })
    }

    return response({handled: false, type: 'text', content: '', elapsedMs: Date.now() - startedAt})
  }

  async function executeFallback(messageContext) {
    const context = normalizeMessageContext(messageContext)
    const startedAt = Date.now()
    const entry = commandEntries.find(item => item.moduleName === 'ollama')
    if (!entry || typeof entry.plugin.executeFallback !== 'function' || !isAllowed(context, entry)) {
      return response({handled: false, type: 'text', content: ''})
    }
    try {
      if (!await readPluginStatus(context, entry.plugin.插件名)) {
        return response({handled: true, type: 'text', content: '当前会话的模型插件已关闭',
          safeError: {code: 'PLUGIN_DISABLED', pluginName: entry.plugin.插件名}})
      }
      const plugin = Object.create(entry.plugin)
      plugin.execute = entry.plugin.executeFallback.bind(entry.plugin)
      return await executePlugin(plugin, context, startedAt, entry.moduleName)
    } catch (_) {
      const safeError = await reportFailure('PLUGIN_FALLBACK_ERROR', entry.plugin.插件名, context, startedAt)
      return response({handled: true, type: 'text', content: '模型服务暂不可用，请稍后再试', safeError})
    }
  }

  async function isEnabled(moduleName, messageContext) {
    const context = normalizeMessageContext(messageContext)
    const entry = commandEntries.find(item => item.moduleName === moduleName)
    return Boolean(entry && isAllowed(context, entry) && await readPluginStatus(context, entry.plugin.插件名))
  }

  async function toggle(groupId, pluginName, context) {
    const plugin = pluginNameMap.get(pluginName)
    if (!plugin) {
      return {ok: false, status: false, pluginName}
    }

    const entry = commandEntries.find((item) => item.plugin === plugin)
    if (context && !isAllowed(context, entry)) return {ok: false, status: false, pluginName, unsupported: true}
    const cacheKey = contextCacheKey(context ?? {groupId}, pluginName)
    const state = cacheEntry(cacheKey)
    const status = CONVERSATION_PLATFORMS.has(context?.platform)
      ? await requireConversationState().toggle(context, pluginName)
      : await setPluginStatus(groupId, pluginName)
    if (pluginStatusCache.get(cacheKey) === state) {
      state.status = status
      state.hasStatus = true
    }
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
      initError: report.initError,
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

    const result = await toggle(context.groupId, pluginName, context)
    if (result.unsupported) {
      return response({handled: true, type: 'text', content: '该插件暂不支持官方 QQ 通道', pluginName})
    }
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

  async function executePlugin(plugin, context, startedAt, moduleName) {
    const pluginName = plugin.插件名
    const override = pluginTimeouts?.[moduleName]
    const executionTimeout = Number.isInteger(override) && override > 0 && override <= 125000 ? override : timeoutMs
    const pluginPromise = Promise.resolve().then(() => {
      const current = pluginStatusCache.get(contextCacheKey(context, pluginName))
      if (current?.hasStatus && !current.status) return {type: 'text', content: `群内的 ${pluginName} 已关闭，不响应`}
      return plugin.execute(
        context.text,
        context.userId,
        context.userName,
        context.groupId,
        context.groupName,
        {
          ...createLegacyOptions(context),
          ...(CONVERSATION_PLATFORMS.has(context.platform) ? {
            availablePlugins: commandEntries.filter((entry) => isAllowed(context, entry)).map((entry) => entry.plugin),
          } : {}),
        },
      )
    })

    let timeoutId
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve(TIMEOUT_RESULT), executionTimeout)
    })

    let pluginReturn
    try {
      pluginReturn = await Promise.race([pluginPromise, timeoutPromise])
    } catch (error) {
      clearTimeout(timeoutId)
      const safeError = await reportFailure('PLUGIN_EXECUTION_ERROR', pluginName, context, startedAt)
      return response({
        handled: true,
        type: 'text',
        content: '插件处理失败，请稍后再试',
        pluginName,
        elapsedMs: safeError.elapsedMs,
        safeError,
      })
    }

    if (pluginReturn === TIMEOUT_RESULT) {
      pluginPromise
        .then(() => logWarn(`插件 ${pluginName} 超时后完成，已忽略迟到响应`))
        .catch(() => logError(JSON.stringify({code: 'PLUGIN_LATE_ERROR', pluginName, platform: context.platform, elapsedMs: Date.now() - startedAt})))

      const elapsedMs = Date.now() - startedAt
      logWarn(`插件 ${pluginName} 在 ${context.platform} 执行超时，耗时 ${elapsedMs}ms`)
      return response({
        handled: true,
        type: 'text',
        content: '插件响应超时，请稍后再试',
        pluginName,
        elapsedMs,
        timeout: true,
        safeError: {code: 'PLUGIN_TIMEOUT_ERROR', pluginName, platform: context.platform, elapsedMs},
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

  function isAllowed(context, entry) {
    return !CONVERSATION_PLATFORMS.has(context.platform) || officialPluginAllowlist.includes(entry?.moduleName)
  }

  async function reportFailure(code, pluginName, context, startedAt) {
    const metadata = Object.freeze({code, pluginName, platform: context.platform, elapsedMs: Date.now() - startedAt})
    logError(JSON.stringify(metadata))
    if (typeof notifyPluginError === 'function') {
      try {
        await notifyPluginError(metadata)
      } catch {
        logError(JSON.stringify({code: 'PLUGIN_NOTIFICATION_ERROR', pluginName, platform: context.platform}))
      }
    }
    return metadata
  }

  function requireConversationState() {
    if (!conversationState) throw new Error('official conversation state is not configured')
    return conversationState
  }

  function contextCacheKey(context, pluginName) {
    return CONVERSATION_PLATFORMS.has(context.platform)
      ? JSON.stringify([context.platform, context.selfId, context.groupId, pluginName])
      : statusCacheKey(context.groupId, pluginName)
  }

  function cacheEntry(key) {
    if (!pluginStatusCache.has(key)) pluginStatusCache.set(key, {hasStatus: false, pending: null})
    return pluginStatusCache.get(key)
  }

  async function readPluginStatus(context, pluginName) {
    const key = contextCacheKey(context, pluginName)
    while (true) {
      const state = cacheEntry(key)
      if (state.hasStatus) return state.status
      if (!state.pending) {
        state.pending = Promise.resolve().then(() => CONVERSATION_PLATFORMS.has(context.platform)
          ? requireConversationState().get(context, pluginName)
          : getPluginStatus(context.groupId, pluginName))
      }
      try {
        const status = await state.pending
        // Identity guards both reload invalidation and a newer successful toggle.
        if (pluginStatusCache.get(key) !== state) continue
        if (!state.hasStatus) {
          state.status = status
          state.hasStatus = true
        }
        state.pending = null
        return state.status
      } catch (error) {
        if (pluginStatusCache.get(key) !== state) continue
        state.pending = null
        if (state.hasStatus) return state.status
        pluginStatusCache.delete(key)
        throw error
      }
    }
  }

  return {
    load,
    execute,
    executeFallback,
    isEnabled,
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
      safeError: pluginReturn.safeError === true ? {code: 'PLUGIN_RESPONSE_ERROR'} :
        /^[A-Z][A-Z0-9_]{0,79}$/.test(pluginReturn.safeError?.code ?? '')
          ? {code: pluginReturn.safeError.code} : undefined,
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
    safeError: result.safeError,
    timeout: result.timeout ?? false,
    raw: result.raw,
  }
}

function statusCacheKey(groupId, pluginName) {
  return `${groupId}-${pluginName}`
}

function loggerCall(logger, level, message) {
  try {
    const target = typeof logger?.[level] === 'function' ? logger : console
    if (typeof target[level] === 'function') Promise.resolve(target[level](message)).catch(() => {})
  } catch {}
}

module.exports = {
  createPluginRuntime,
  normalizePluginReturn,
  DEFAULT_TIMEOUT_MS,
}
