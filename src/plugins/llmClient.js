'use strict'

const fs = require('fs')

const fail = (code) => Object.assign(new Error(code), {code})
const legacyUrl = 'http://192.168.18.113:11435/api/chat'

function createLlmClient({config = {}, axios, env = process.env, readFileSync = fs.readFileSync}) {
  const explicit = config.llm !== undefined
  const llm = explicit ? config.llm : {}
  if (!llm || typeof llm !== 'object' || Array.isArray(llm)) throw fail('LLM_CONFIG_ERROR')
  const provider = explicit ? llm.provider : 'ollama'
  const timeoutMs = llm.timeoutMs === undefined ? 30000 : llm.timeoutMs
  const model = explicit ? llm.model : (config.model || 'qwen2.5:3b')
  if (!['openai', 'ollama'].includes(provider) || !Number.isInteger(timeoutMs) ||
      timeoutMs < 100 || timeoutMs > 120000 || typeof model !== 'string' || !model.trim() ||
      !axios || typeof axios.post !== 'function') throw fail('LLM_CONFIG_ERROR')

  let endpoint
  let modelsEndpoint
  try {
    const raw = explicit ? llm.baseUrl : (config.llamaUrl || legacyUrl)
    if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw) || raw !== raw.trim()) throw new Error()
    const url = new URL(raw)
    const loopback = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
    if (url.username || url.password || raw.includes('?') || raw.includes('#') ||
        (provider === 'openai' && url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) throw new Error()
    const base = url.href.replace(/\/+$/, '')
    endpoint = !explicit ? url.href : provider === 'openai' ? `${base}/chat/completions` :
      (base.endsWith('/api/chat') ? base : `${base}/api/chat`)
    modelsEndpoint = provider === 'openai' ? `${base}/models` :
      (explicit || /\/api\/chat\/?$/.test(url.pathname) ? endpoint.replace(/\/api\/chat\/?$/, '/api/tags') : `${url.origin}/api/tags`)
  } catch {
    throw fail('LLM_CONFIG_ERROR')
  }

  function readKey() {
    let key
    try {
      key = env.CHATDACS_LLM_API_KEY
      if (key === undefined) {
        const file = llm.apiKeyFile === undefined ? 'config/llm.credentials.json' : llm.apiKeyFile
        if (typeof file !== 'string' || !file.trim()) throw new Error()
        key = JSON.parse(readFileSync(file, 'utf8')).apiKey
      }
      if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) throw new Error()
      return key.trim()
    } catch {
      throw fail('LLM_AUTH_ERROR')
    }
  }

  async function request(method, url, body) {
    if (typeof axios[method] !== 'function') throw fail('LLM_CONFIG_ERROR')
    const headers = provider === 'openai' ? {Authorization: `Bearer ${readKey()}`} : {}
    const controller = new AbortController()
    let timer
    let response
    try {
      // Race also bounds transports that fail to settle after cancellation.
      const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(fail('LLM_TIMEOUT_ERROR'))
        }, timeoutMs)
      })
      const options = {headers, timeout: timeoutMs, signal: controller.signal, maxRedirects: 0}
      if (method === 'get') options.maxContentLength = 2 * 1024 * 1024
      response = await Promise.race([
        method === 'get' ? axios.get(url, options) : axios.post(url, body, options),
        deadline,
      ])
      if (response && response.status !== undefined && (response.status < 200 || response.status >= 300)) {
        throw {response: {status: response.status}}
      }
    } catch (error) {
      const status = error && error.response && error.response.status
      const code = controller.signal.aborted || (error && ['ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED'].includes(error.code)) ?
        'LLM_TIMEOUT_ERROR' : (status === 401 || status === 403 ? 'LLM_AUTH_ERROR' : 'LLM_REQUEST_ERROR')
      throw fail(code)
    } finally {
      clearTimeout(timer)
    }
    return response
  }

  async function complete(prompt, {systemPrompt, model: override, history = []} = {}) {
    if (typeof prompt !== 'string' || (systemPrompt !== undefined && typeof systemPrompt !== 'string') ||
        (override !== undefined && (typeof override !== 'string' || !override || /[\s\x00-\x1f\x7f-\x9f]/.test(override)))) {
      throw fail('LLM_CONFIG_ERROR')
    }
    let historyChars = 0
    let previous
    try {
      if (!Array.isArray(history) || history.length > 40 || prompt.length > 16000) throw new Error()
      const length = history.length
      previous = []
      for (let index = 0; index < length; index++) {
        const entry = history[index]
        if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
            Object.keys(entry).sort().join(',') !== 'content,role') throw new Error()
        const {role, content} = entry
        if (!['user', 'assistant'].includes(role) || typeof content !== 'string' || !content.trim()) throw new Error()
        historyChars += content.length
        if (historyChars + prompt.length > 16000) throw new Error()
        previous.push({role, content})
      }
    } catch { throw fail('LLM_CONFIG_ERROR') }
    const messages = [...previous, {role: 'user', content: prompt}]
    if (systemPrompt) messages.unshift({role: 'system', content: systemPrompt})
    const response = await request('post', endpoint, {model: override === undefined ? model : override, messages, stream: false})
    const content = provider === 'openai' ? response?.data?.choices?.[0]?.message?.content : response?.data?.message?.content
    if (typeof content !== 'string') throw fail('LLM_EMPTY_RESPONSE')
    const text = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    if (!text) throw fail('LLM_EMPTY_RESPONSE')
    return text
  }

  async function listModels() {
    const response = await request('get', modelsEndpoint)
    const entries = provider === 'openai' ? response?.data?.data : response?.data?.models
    if (!Array.isArray(entries)) throw fail('LLM_MODELS_ERROR')
    const ids = new Set()
    for (const entry of entries) {
      const id = provider === 'openai' ? entry?.id : entry?.name
      if (typeof id === 'string' && id.length >= 1 && id.length <= 200 && !/[\s\x00-\x1f\x7f-\x9f\[\]]/.test(id)) ids.add(id)
      if (ids.size === 5000) break
    }
    return [...ids]
  }

  return {provider, defaultModel: model, complete, listModels}
}

module.exports = {createLlmClient}
