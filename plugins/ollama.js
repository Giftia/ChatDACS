const {createLlmClient} = require('../src/plugins/llmClient')
const {createPersonaStore} = require('../src/plugins/persona')
const {createModelRuntime} = require('../src/plugins/modelRuntime')
const {createChatContext, MAX_CHARS} = require('../src/plugins/chatContext')
const nativePersona = require('../src/plugins/nativePersona')
const path = require('path')
const {parseQQImageMessage} = require('../src/plugins/qqImageMessage')
const {createImageInput} = require('../src/plugins/imageInput')
const {buildOneBotUrl} = require('../src/platforms/oneBotSender')

function conversationKey(userId, groupId, options = {}) {
  options = options ?? {}
  const type = options.platform ?? options.type ?? 'unknown'
  const rawScope = options.scope ?? options.raw?.scope
  const privateScope = ['private', 'c2c', 'dm'].includes(rawScope) ||
    ['web', 'qqGuildDirect'].includes(type) || groupId == null || groupId === ''
  return JSON.stringify([type, options.selfId ?? '', privateScope ? 'private' : 'group',
    String(privateScope ? userId : groupId)])
}

function userPrompt(context) {
  const prefix = `${String(context.userName || '匿名').slice(0, 80)} (${String(context.userId ?? '').slice(0, 80)})说：`
  return prefix + String(context.text ?? '').slice(0, MAX_CHARS - prefix.length)
}

function imageCaption(input) {
  return `[图片] ${input.text || '请描述这张图片。'}`
}

function keyForContext(context) {
  return conversationKey(context.userId, context.groupId, context)
}

function personaPrompt(plugin, key) {
  let persona
  try { persona = plugin.personas.current(key) } catch {
    throw Object.assign(new Error('LLM_PERSONA_ERROR'), {code: 'LLM_PERSONA_ERROR'})
  }
  return `${persona.content}\n当前场景：${JSON.parse(key)[2] === 'private' ? '私聊' : '群聊'}。`
}

module.exports = {
  插件名: 'ollama大语言模型客户端插件',
  指令: '^(?:[/!]?小夜[\\s\\S]*|/(?:更换人设|查询模型|更换模型)(?:\\s+[\\s\\S]*)?)$',
  版本: '0.4', // 升级版本号
  作者: 'Giftina',
  描述: '连接 Ollama 或 OpenAI 兼容服务，使用大语言模型的能力。',
  使用示例: '小夜和我结婚吧',
  预期返回: '好啊，我也挺想尝试一下当新娘的滋味呢～',

  // 初始化方法，用于依赖注入
  init({logger, axios, config = {}, chatContext, imageInput}) {
    this.logger = logger
    this.client = null
    this.models = null
    this.contexts = chatContext ?? createChatContext()
    this.observations = new WeakMap()
    this.rawObservations = new WeakMap()
    this.imageInput = imageInput ?? {prepare: images => createImageInput({axios, resolveImage: async file => {
      if (!config.ONE_BOT_API_URL) throw Object.assign(new Error('IMAGE_DOWNLOAD_FAILED'), {code: 'IMAGE_DOWNLOAD_FAILED'})
      return (await axios.get(buildOneBotUrl(config.ONE_BOT_API_URL, 'get_image', {file})))?.data?.data
    }}).prepare(images)}
    this.proactiveReplies = new WeakMap()
    this.modelAdmins = new Set((Array.isArray(config.llm?.modelAdminQQs) ? config.llm.modelAdminQQs : []).map(String))
    this.personas = null
    this.personas = createPersonaStore({
      personaDir: config.llm?.personaDir ?? path.join(__dirname, 'persona'),
      defaultContent: nativePersona,
      stateFile: config.llm?.personaStateFile ?? 'config/llm-persona-state.json',
    })
    try {
      this.client = createLlmClient({config, axios})
      this.models = createModelRuntime({client: this.client, defaultModel: this.client.defaultModel,
        stateFile: config.llm?.modelStateFile ?? 'config/llm-model-state.json'})
    } catch (error) {
      this.client = null
      throw error
    }
  },

  // The router owns observation and delivery acknowledgement; generation is read-only.
  observeMessage(context) {
    if (!context || typeof context !== 'object' || typeof context.text !== 'string' || !context.text.trim() || !this.contexts) return false
    if (typeof (context.platform ?? context.type) !== 'string' || !(context.platform ?? context.type) ||
        context.userId == null || String(context.userId) === '') return false
    const previous = this.observations.get(context)
    if (previous && this.contexts.isCurrent(previous.lease)) return false
    try {
      const key = keyForContext(context)
      const lease = this.contexts.capture(key)
      const imageMessage = parseQQImageMessage(context.text)
      const prompt = userPrompt({...context, text: imageMessage.images.length ? imageCaption(imageMessage) : context.text})
      if (!this.contexts.append(lease, 'user', prompt)) return false
      this.proactiveReplies.delete(context)
      this.observations.set(context, {lease, replied: false})
      const source = context.raw && typeof context.raw === 'object' ? context.raw : context
      this.rawObservations.set(source, {key, lease, prompt})
      if (source.event && typeof source.event === 'object') this.rawObservations.set(source.event, {key, lease, prompt})
      return true
    } catch { return false }
  },

  recordReply(context, text) {
    if (!context || typeof context !== 'object' || typeof text !== 'string' || !text.trim() || !this.contexts) return false
    const receipt = this.proactiveReplies.get(context) ?? this.observations.get(context)
    if (!receipt || receipt.replied) return false
    const imageMessage = parseQQImageMessage(text)
    const content = imageMessage.images.length ? `[图片] ${imageMessage.text}`.trim() : text
    if (!this.contexts.append(receipt.lease, 'assistant', content)) return false
    receipt.replied = true
    return true
  },

  executeFallback(msg, userId, userName, groupId, groupName, options) {
    return this.execute(msg, userId, userName, groupId, groupName, options)
  },

  async generateProactive(context) {
    if (!context || typeof context !== 'object' || !this.client || !this.contexts) return null
    this.proactiveReplies.delete(context)
    try {
      const key = keyForContext(context)
      return await this.contexts.run(key, async (lease) => {
        const demo = context.raw?.proactiveDemo === true
        const time = new Intl.DateTimeFormat('zh-CN', {timeZone: 'Asia/Shanghai',
          dateStyle: 'full', timeStyle: 'long'}).format(new Date())
        const prompt = `当前北京时间：${time}。${demo ? '当前是上线展示；若无历史，只基于人设问候，不得虚构用户发言或声称发生过对话。' :
          '根据已有真实对话决定是否适合主动说一句。'}只输出JSON：不发送为 {"send":false}，发送为 {"send":true,"text":"一句话"}。`
        const history = this.contexts.history(key, {budget: MAX_CHARS - prompt.length, limit: 39})
        if (!history.length && !demo) return null
        const raw = await this.client.complete(prompt, {history, systemPrompt: personaPrompt(this, key), model: this.models.current(key)})
        if (raw.length > MAX_CHARS) return null
        let decision
        try { decision = JSON.parse(raw) } catch { return null }
        if (!decision || Array.isArray(decision) || decision.send !== true ||
            Object.keys(decision).sort().join(',') !== 'send,text' || typeof decision.text !== 'string' ||
            !decision.text.trim() || decision.text.length > 2000 || !this.contexts.isCurrent(lease)) return null
        this.proactiveReplies.set(context, {lease, replied: false})
        return {text: decision.text.trim()}
      })
    } catch { return null }
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    msg = typeof msg === 'string' ? msg : String(msg ?? '')
    const imageMessage = parseQQImageMessage(msg)
    if (imageMessage.images.length) msg = imageCaption(imageMessage)
    const key = conversationKey(userId, groupId, options)
    if (/^\/(?:查询模型|更换模型)(?:\s|$)/.test(msg)) {
      try {
        if (!this.models) return {type: 'text', content: '模型服务配置不完整，请联系管理员', safeError: true}
        if (/^\/查询模型(?:\s|$)/.test(msg)) {
          const parts = msg.slice('/查询模型'.length).trim().split(/\s+/).filter(Boolean)
          const page = /^\d+$/.test(parts.at(-1) ?? '') ? Number(parts.pop()) : 1
          const keyword = parts.join(' ')
          if (keyword.length > 200) return {type: 'text', content: '模型查询关键词过长'}
          const result = await this.models.list({keyword, page})
          return {type: 'text', content: [`可用模型：第 ${result.page}/${result.totalPages} 页，共 ${result.total} 个`,
            `默认配置模型：${result.defaultModel}`, ...(result.models.length ? result.models : ['没有匹配的模型']),
            '筛选与翻页：/查询模型 luna 2', '切换：/更换模型 完整模型ID'].join('\n')}
        }
        const input = msg.slice('/更换模型'.length).trim()
        if (!input || ['查看', '当前'].includes(input)) {
          return {type: 'text', content: `当前模型：${this.models.current(key)}\n默认模型：${this.client.defaultModel}`}
        }
        const platform = options?.platform ?? options?.type
        if (!['qq', 'napcat'].includes(platform) || !this.modelAdmins.has(String(userId))) {
          return {type: 'text', content: '只有配置的 QQ 模型管理员可以更换模型'}
        }
        const model = ['重置', '默认'].includes(input) ? this.models.reset(key) : await this.models.select(key, input)
        return {type: 'text', content: `当前会话模型已切换为：${model}`}
      } catch (error) {
        const messages = {LLM_AUTH_ERROR: '模型服务鉴权失败，请检查 API Key',
          LLM_TIMEOUT_ERROR: '模型查询超时，请稍后再试', MODEL_NOT_FOUND: '该模型不在可用列表，请先使用 /查询模型',
          MODEL_PAGE_INVALID: '模型列表页码无效，请检查页码', MODEL_STATE_WRITE_FAILED: '模型选择保存失败，原选择未改变',
          MODEL_SELECTION_SUPERSEDED: '该模型选择已被较新的切换或重置操作取消'}
        return {type: 'text', content: messages[error?.code] ?? '模型查询或切换失败，原选择未改变', safeError: true}
      }
    }
    if (/^\/更换人设(?:\s|$)/.test(msg)) {
      try {
        const input = msg.slice('/更换人设'.length).trim()
        if (!input || input === '列表') {
          const entries = this.personas.list()
          return {type: 'text', content: ['可选人设：', '0. 小夜原生（默认）',
            ...entries.map((item, index) => `${index + 1}. ${item.fileName}`),
            '切换：/更换人设 文件名或序号', '当前：/更换人设 查看；恢复：/更换人设 重置'].join('\n')}
        }
        const current = ['重置', '默认', '小夜原生', '原生', '0'].includes(input) ? this.personas.reset(key) :
          ['查看', '当前'].includes(input) ? this.personas.current(key) : this.personas.select(key, input)
        if (!['查看', '当前'].includes(input)) this.contexts.clear(key)
        return {type: 'text', content: `${['查看', '当前'].includes(input) ? '当前人设' : '人设已切换为'}：${current.fileName ?? '小夜原生'}`}
      } catch {
        return {type: 'text', content: '人设切换或读取失败，请使用 /更换人设 查看可用列表', safeError: true}
      }
    }
    if (!this.client) return {type: 'text', content: '模型服务配置不完整，请联系管理员', safeError: true}
    const prompt = userPrompt({text: msg, userId, userName})
    const source = options?.raw && typeof options.raw === 'object' ? options.raw : options
    const observed = source && typeof source === 'object'
      ? this.rawObservations?.get(source) ?? this.rawObservations?.get(source.event ?? source.raw?.event) : undefined
    const beforeUser = observed?.key === key && observed.prompt === prompt &&
      this.contexts.isCurrent(observed.lease) ? prompt : undefined

    try {
      const replyText = await this.contexts.run(key, async () => this.client.complete(prompt, {
        systemPrompt: personaPrompt(this, key), model: this.models.current(key),
        history: this.contexts.history(key, {beforeUser, budget: MAX_CHARS - prompt.length, limit: 39}),
        ...(imageMessage.images.length ? {images: await this.imageInput.prepare(imageMessage.images)} : {}),
      }))
      this.logger.info(`LLM 回复成功 provider=${this.client.provider}`)
      return {type: 'text', content: replyText}
    } catch (err) {
      this.logger.error(`LLM 请求失败 provider=${this.client.provider}`)
      const contextMessages = {CHAT_CONTEXT_BUSY: '对话请求过多，请稍后再试',
        CHAT_CONTEXT_CHANGED: '会话人设已更新，请重新发送消息', LLM_PERSONA_ERROR: '人设读取失败，请检查人设配置'}
      if (contextMessages[err?.code]) return {type: 'text', content: contextMessages[err.code], safeError: true}
      if (imageMessage.images.length) {
        const visionMessages = {
          IMAGE_TOO_LARGE: '图片过大，请缩小后重新发送',
          IMAGE_FORMAT_UNSUPPORTED: '暂不支持这种图片格式，请发送 JPG、PNG 或 WebP 图片',
          IMAGE_INPUT_INVALID: '图片数量或来源不受支持，请发送最多 3 张 QQ 图片',
          LLM_VISION_UNSUPPORTED: '当前模型或服务暂不支持图片识别，请更换支持视觉的模型或补充文字描述',
          LLM_TIMEOUT_ERROR: '图片识别超时，请稍后再试或补充文字描述',
        }
        return {type: 'text', content: visionMessages[err?.code] ?? '这张图片暂时无法识别，请重新发送或补充文字描述', safeError: true}
      }
      if (this.client.provider === 'openai') {
        const messages = {
          LLM_AUTH_ERROR: '模型服务鉴权失败，请检查 API Key',
          LLM_TIMEOUT_ERROR: '模型响应超时，请稍后再试',
          LLM_CONFIG_ERROR: '模型服务配置不完整，请联系管理员',
        }
        return {type: 'text', content: messages[err?.code] ?? '模型服务暂不可用，请稍后再试', safeError: true}
      }

      // 检查 msg 是否以疑问语气词结尾
      const questionEndings = ['吗', '呢', '吧', '？', '?']
      if (questionEndings.some((ending) => msg.trim().endsWith(ending))) {
        return {
          type: 'text',
          content: msg.trim().replace(/[吗呢吧？?]$/, '喵！'),
          safeError: true,
        }
      }

      return {type: 'text', content: '草', safeError: true}
    }
  },
}
