'use strict'

const {createLlmClient} = require('./llmClient')

const baseUrl = 'https://giftina-mbp-m1-max.tail7b4554.ts.net:8443/v1'
const openaiResponse = (content) => ({data: {choices: [{message: {content}}]}})

function setup(llm = {}, overrides = {}) {
  const axios = {post: jest.fn().mockResolvedValue(openaiResponse(' reply '))}
  const readFileSync = jest.fn(() => JSON.stringify({apiKey: 'file-key'}))
  const options = {config: {llm: {provider: 'openai', baseUrl, model: 'gpt-6-luna', ...llm}},
    axios, readFileSync, env: {CHATDACS_LLM_API_KEY: 'test-key'}, ...overrides}
  return {...options, client: createLlmClient(options)}
}

afterEach(() => jest.useRealTimers())

test.each(['openai', 'ollama'])('%s accepts validated user/assistant history with current persona first', async (provider) => {
  const {client, axios} = setup({provider})
  axios.post.mockResolvedValue(provider === 'openai' ? openaiResponse('ok') : {data: {message: {content: 'ok'}}})
  const history = [{role: 'user', content: 'Alice: prior'}, {role: 'assistant', content: 'successful reply'}]
  await client.complete('Bob: current', {systemPrompt: 'current persona', history})
  expect(axios.post.mock.calls[0][1].messages).toEqual([
    {role: 'system', content: 'current persona'}, ...history, {role: 'user', content: 'Bob: current'},
  ])
  expect(history).toHaveLength(2)
})

test.each([null, {}, 'history', new Array(2), [null], [{role: 'system', content: 'override'}],
  [{role: 'tool', content: 'unsupported'}], [{role: 'assistant', content: ''}], [{role: 'user', content: 1}],
  [{role: 'user', content: 'text', name: 'extra'}], Array.from({length: 41}, () => ({role: 'user', content: 'x'})),
  [{role: 'user', content: 'x'.repeat(16000)}]].map((history) => [history]))('invalid history fails before credentials/network: %p', async (history) => {
  const {client, axios, readFileSync} = setup({}, {env: {}})
  await expect(client.complete('current', {history})).rejects.toMatchObject({code: 'LLM_CONFIG_ERROR'})
  expect(axios.post).not.toHaveBeenCalled()
  expect(readFileSync).not.toHaveBeenCalled()
})

test('history plus current prompt has a hard 16000-character budget, not an exact token estimate', async () => {
  const {client, axios} = setup()
  await client.complete('x', {history: [{role: 'user', content: 'h'.repeat(15999)}]})
  await expect(client.complete('xx', {history: [{role: 'user', content: 'h'.repeat(15999)}]}))
    .rejects.toMatchObject({code: 'LLM_CONFIG_ERROR'})
  expect(axios.post).toHaveBeenCalledTimes(1)
})

test('history validation snapshots roles once and never invokes an overridden array iterator', async () => {
  const {client, axios} = setup()
  let reads = 0
  const entry = {get role() { return ++reads === 1 ? 'user' : 'system' }, content: 'validated text'}
  const history = [entry]
  history[Symbol.iterator] = () => { throw new Error('unbounded/custom iterator') }
  await client.complete('current', {history})
  expect(axios.post.mock.calls[0][1].messages).toEqual([
    {role: 'user', content: 'validated text'}, {role: 'user', content: 'current'},
  ])
  expect(reads).toBe(1)
})

test('OpenAI models uses lazy GET, same bearer, normalized URL and bounded response', async () => {
  const {client, axios, readFileSync} = setup({baseUrl: `${baseUrl}///`})
  axios.get = jest.fn().mockResolvedValue({data: {data: [{id: 'a'}, {id: 'b'}, {id: 'a'}]}})
  await expect(client.listModels()).resolves.toEqual(['a', 'b'])
  expect(axios.get).toHaveBeenCalledWith(`${baseUrl}/models`, {
    headers: {Authorization: 'Bearer test-key'}, timeout: 30000, signal: expect.any(AbortSignal),
    maxRedirects: 0, maxContentLength: 2097152,
  })
  expect(axios.post).not.toHaveBeenCalled()
  expect(readFileSync).not.toHaveBeenCalled()
})

test('missing axios.get is checked only when listing', async () => {
  const {client, axios, readFileSync} = setup()
  await expect(client.complete('hi')).resolves.toBe('reply')
  await expect(client.listModels()).rejects.toMatchObject({code: 'LLM_CONFIG_ERROR'})
  expect(axios.post).toHaveBeenCalledTimes(1)
  expect(readFileSync).not.toHaveBeenCalled()
})

test.each([
  [{}, 'http://192.168.18.113:11435/api/tags'],
  [{llamaUrl: 'http://localhost:11434/proxy/api/chat'}, 'http://localhost:11434/proxy/api/tags'],
  [{llamaUrl: 'http://localhost:11434/proxy/api/chat/'}, 'http://localhost:11434/proxy/api/tags'],
  [{llamaUrl: 'http://localhost:11434/custom/chat'}, 'http://localhost:11434/api/tags'],
  [{llamaUrl: 'http://localhost:11434/api/chat/'}, 'http://localhost:11434/api/tags'],
  [{llm: {provider: 'ollama', baseUrl: 'http://localhost:11434/proxy', model: 'qwen'}}, 'http://localhost:11434/proxy/api/tags'],
  [{llm: {provider: 'ollama', baseUrl: 'http://localhost:11434/api/chat/', model: 'qwen'}}, 'http://localhost:11434/api/tags'],
])('Ollama models endpoint for %j', async (config, expected) => {
  const {client, axios, readFileSync} = setup({}, {config, env: {}})
  axios.get = jest.fn().mockResolvedValue({data: {models: [{name: 'qwen:latest'}, {name: 'qwen:latest'}, {name: 'other'}]}})
  await expect(client.listModels()).resolves.toEqual(['qwen:latest', 'other'])
  expect(axios.get).toHaveBeenCalledWith(expected, expect.objectContaining({headers: {}, maxRedirects: 0, maxContentLength: 2097152}))
  expect(readFileSync).not.toHaveBeenCalled()
})

test('model list filters unsafe IDs, preserves order and accepts length boundaries', async () => {
  const {client, axios} = setup()
  const ids = ['a', 'x'.repeat(200), 'x'.repeat(201), '', null, 123, 'with space', 'tab\tid', 'line\nid',
    'zero\x00id', 'del\x7fid', 'c1\x85id', '[CQ:test]', 'a[b', 'a]b', 'unicode\u00a0space', 'a', 'safe/model:tag']
  axios.get = jest.fn().mockResolvedValue({data: {data: ids.map((id) => ({id})).concat([null, {}])}})
  await expect(client.listModels()).resolves.toEqual(['a', 'x'.repeat(200), 'safe/model:tag'])
})

test('model list caps unique valid results at 5000', async () => {
  const {client, axios} = setup()
  const data = [{id: 'bad id'}, {id: 'm0'}, ...Array.from({length: 5002}, (_, i) => ({id: `m${i}`}))]
  axios.get = jest.fn().mockResolvedValue({data: {data}})
  const result = await client.listModels()
  expect(result).toHaveLength(5000)
  expect(result[0]).toBe('m0')
  expect(result.at(-1)).toBe('m4999')
})

test.each(['openai', 'ollama'])('%s accepts empty model arrays and rejects unexpected shapes', async (provider) => {
  const {client, axios} = setup({provider})
  const field = provider === 'openai' ? 'data' : 'models'
  axios.get = jest.fn().mockResolvedValue({data: {[field]: []}})
  await expect(client.listModels()).resolves.toEqual([])
  for (const response of [undefined, null, {}, {data: {}}, {data: {[field]: {}}}, {data: {[field]: null}}]) {
    axios.get.mockResolvedValue(response)
    const error = await client.listModels().catch((error) => error)
    expect(error.message).toBe('LLM_MODELS_ERROR')
    expect(Object.keys(error)).toEqual(['code'])
    expect(error.cause).toBeUndefined()
  }
})

test('listing reads mock file credentials lazily and rejects missing key before GET', async () => {
  const {client, axios, readFileSync} = setup({}, {env: {}})
  axios.get = jest.fn().mockResolvedValue({data: {data: []}})
  expect(readFileSync).not.toHaveBeenCalled()
  await client.listModels()
  expect(axios.get.mock.calls[0][1].headers.Authorization).toBe('Bearer file-key')
  readFileSync.mockImplementation(() => {throw new Error('private filename')})
  await expect(client.listModels()).rejects.toMatchObject({message: 'LLM_AUTH_ERROR', code: 'LLM_AUTH_ERROR'})
  expect(axios.get).toHaveBeenCalledTimes(1)
})

test.each([[401, undefined, 'LLM_AUTH_ERROR'], [403, undefined, 'LLM_AUTH_ERROR'],
  [302, undefined, 'LLM_REQUEST_ERROR'], [500, undefined, 'LLM_REQUEST_ERROR'],
  [undefined, 'ECONNABORTED', 'LLM_TIMEOUT_ERROR'], [undefined, 'ERR_CANCELED', 'LLM_TIMEOUT_ERROR'],
  [undefined, 'ERR_BAD_RESPONSE', 'LLM_REQUEST_ERROR']])('listing sanitizes transport failures: %s %s', async (status, code, expected) => {
  jest.useFakeTimers()
  const {client, axios} = setup()
  axios.get = jest.fn().mockRejectedValue(Object.assign(new Error('private key body'), {code, response: {status, data: 'private'}}))
  const error = await client.listModels().catch((error) => error)
  expect(error.message).toBe(expected)
  expect(Object.keys(error)).toEqual(['code'])
  expect(error.code).toBe(expected)
  expect(error.cause).toBeUndefined()
  expect(error.stack).not.toContain('private')
  expect(axios.get).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

test('listing rejects resolved redirects without accepting their data', async () => {
  const {client, axios} = setup()
  axios.get = jest.fn().mockResolvedValue({status: 302, data: {data: [{id: 'bad'}]}})
  await expect(client.listModels()).rejects.toMatchObject({code: 'LLM_REQUEST_ERROR'})
})

test('listing total deadline cancels stalled transport and clears timer', async () => {
  jest.useFakeTimers()
  const {client, axios} = setup({timeoutMs: 100})
  axios.get = jest.fn(() => new Promise(() => {}))
  const assertion = expect(client.listModels()).rejects.toMatchObject({code: 'LLM_TIMEOUT_ERROR'})
  const signal = axios.get.mock.calls[0][1].signal
  await jest.advanceTimersByTimeAsync(100)
  await assertion
  expect(signal.aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
})

test('successful listing clears timer', async () => {
  jest.useFakeTimers()
  const {client, axios} = setup()
  axios.get = jest.fn().mockResolvedValue({data: {data: []}})
  await client.listModels()
  expect(jest.getTimerCount()).toBe(0)
  expect(axios.get.mock.calls[0][1].signal.aborted).toBe(false)
})

test.each(['openai', 'ollama'])('%s supports one-call model override without changing default', async (provider) => {
  const {client, axios} = setup({provider})
  axios.post.mockResolvedValue(provider === 'openai' ? openaiResponse('ok') : {data: {message: {content: 'ok'}}})
  await client.complete('hi', {model: 'not-in-model-list', systemPrompt: 'persona'})
  expect(axios.post.mock.calls[0][1]).toEqual({model: 'not-in-model-list', messages: [
    {role: 'system', content: 'persona'}, {role: 'user', content: 'hi'},
  ], stream: false})
  await client.complete('hi', {model: undefined})
  expect(axios.post.mock.calls[1][1].model).toBe('gpt-6-luna')
  expect(client.defaultModel).toBe('gpt-6-luna')
})

test('invalid model overrides fail before credentials or network access', async () => {
  const {client, axios, readFileSync} = setup({}, {env: {}})
  for (const model of ['', ' ', 'model name', 'a\tb', 'a\nb', 'a\x00b', 'a\x7fb', 'a\x85b', null, false, 123, {}, []]) {
    await expect(client.complete('hi', {model})).rejects.toMatchObject({code: 'LLM_CONFIG_ERROR'})
  }
  expect(axios.post).not.toHaveBeenCalled()
  expect(readFileSync).not.toHaveBeenCalled()
})

test('OpenAI API shape, URL, body, header, default timeout and no redirects', async () => {
  const {client, axios, readFileSync} = setup({baseUrl: `${baseUrl}///`})
  expect(Object.keys(client).sort()).toEqual(['complete', 'defaultModel', 'listModels', 'provider'])
  expect(client.defaultModel).toBe('gpt-6-luna')
  expect(client.provider).toBe('openai')
  await expect(client.complete('hello')).resolves.toBe('reply')
  expect(axios.post).toHaveBeenCalledWith(`${baseUrl}/chat/completions`, {
    model: 'gpt-6-luna', messages: [{role: 'user', content: 'hello'}], stream: false,
  }, {headers: {Authorization: 'Bearer test-key'}, timeout: 30000, signal: expect.any(AbortSignal), maxRedirects: 0})
  expect(readFileSync).not.toHaveBeenCalled()
})

test.each(['openai', 'ollama'])('%s prepends optional system prompt without changing its text', async (provider) => {
  const {client, axios} = setup({provider})
  axios.post.mockResolvedValue(provider === 'openai' ? openaiResponse('ok') : {data: {message: {content: 'ok'}}})
  await expect(client.complete('hello', {systemPrompt: ' persona\ntext '})).resolves.toBe('ok')
  expect(axios.post.mock.calls[0][1]).toEqual({
    model: 'gpt-6-luna', messages: [{role: 'system', content: ' persona\ntext '}, {role: 'user', content: 'hello'}], stream: false,
  })
})

test('empty or undefined system prompt preserves user-only body', async () => {
  const {client, axios} = setup()
  for (const options of [undefined, {}, {systemPrompt: undefined}, {systemPrompt: ''}]) {
    await client.complete('hello', options)
    expect(axios.post.mock.calls.at(-1)[1].messages).toEqual([{role: 'user', content: 'hello'}])
  }
})

test('invalid system prompt fails before credentials or network access', async () => {
  const {client, axios, readFileSync} = setup({}, {env: {}})
  for (const systemPrompt of [null, 123, false, {}, []]) {
    await expect(client.complete('hello', {systemPrompt})).rejects.toMatchObject({code: 'LLM_CONFIG_ERROR'})
  }
  expect(axios.post).not.toHaveBeenCalled()
  expect(readFileSync).not.toHaveBeenCalled()
})

test.each(['http://localhost:8000/v1', 'http://127.0.0.1/v1', 'http://[::1]/v1', baseUrl])('accepts safe URL %s', (url) => {
  expect(setup({baseUrl: url}).client.provider).toBe('openai')
})

test.each(['http://example.com/v1', '/v1', 'ftp://example.com', 'https://key@example.com/v1',
  `${baseUrl}?key=secret`, `${baseUrl}#secret`, `${baseUrl}?`, `${baseUrl}#`, 'not a URL'])('rejects unsafe URL %s', (url) => {
  expect(() => setup({baseUrl: url})).toThrow('LLM_CONFIG_ERROR')
})

test.each([99, 120001, 100.5, '30000', null, NaN])('rejects invalid timeout %s', (timeoutMs) => {
  expect(() => setup({timeoutMs})).toThrow('LLM_CONFIG_ERROR')
})

test.each([100, 120000])('accepts timeout boundary %s', (timeoutMs) => {
  expect(setup({timeoutMs}).client.provider).toBe('openai')
})

test.each([null, [], {}, {provider: 'unknown'}, {provider: 'openai', baseUrl}])('explicit invalid config never falls back: %j', (llm) => {
  expect(() => setup({}, {config: {llm}})).toThrow('LLM_CONFIG_ERROR')
})

test('legacy Ollama defaults and old configured endpoint/model remain compatible', async () => {
  for (const config of [{}, {llamaUrl: 'http://localhost:11434/api/chat', model: 'old-model'}]) {
    const {client, axios, readFileSync} = setup({}, {config})
    axios.post.mockResolvedValue({data: {message: {content: '<think>private</think> old reply '}}})
    expect(client.provider).toBe('ollama')
    await expect(client.complete('hi')).resolves.toBe('old reply')
    expect(axios.post).toHaveBeenCalledWith(config.llamaUrl || 'http://192.168.18.113:11435/api/chat',
      {model: config.model || 'qwen2.5:3b', messages: [{role: 'user', content: 'hi'}], stream: false},
      expect.objectContaining({headers: {}, timeout: 30000, maxRedirects: 0}))
    expect(readFileSync).not.toHaveBeenCalled()
  }
})

test.each(['http://localhost:11434/custom/chat', 'http://localhost:11434/custom/chat/',
  'http://localhost:11434', 'http://localhost:11434/api/chat/'])('legacy endpoint preserves url.href: %s', async (llamaUrl) => {
  const {client, axios, readFileSync} = setup({}, {config: {llamaUrl}})
  axios.post.mockResolvedValue({data: {message: {content: 'ok'}}})
  await expect(client.complete('hi')).resolves.toBe('ok')
  expect(axios.post.mock.calls[0][0]).toBe(new URL(llamaUrl).href)
  expect(readFileSync).not.toHaveBeenCalled()
})

test('explicit Ollama appends /api/chat only once and never reads keys', async () => {
  for (const baseUrl of ['http://localhost:11434', 'http://localhost:11434/api/chat/']) {
    const {client, axios, readFileSync} = setup({provider: 'ollama', baseUrl, model: 'qwen'}, {env: {}})
    axios.post.mockResolvedValue({data: {message: {content: 'ok'}}})
    await expect(client.complete('hi')).resolves.toBe('ok')
    expect(axios.post.mock.calls[0][0]).toBe('http://localhost:11434/api/chat')
    expect(readFileSync).not.toHaveBeenCalled()
  }
})

test('credentials are lazy, use default/custom file and are re-read on complete', async () => {
  for (const apiKeyFile of [undefined, 'test/credentials.json']) {
    const {client, axios, readFileSync} = setup({apiKeyFile}, {env: {}})
    expect(readFileSync).not.toHaveBeenCalled()
    await client.complete('hi')
    await client.complete('again')
    expect(readFileSync).toHaveBeenCalledTimes(2)
    expect(readFileSync).toHaveBeenCalledWith(apiKeyFile || 'config/llm.credentials.json', 'utf8')
    expect(axios.post.mock.calls[0][2].headers.Authorization).toBe('Bearer file-key')
  }
})

test.each(['', ' ', null, 'key\r\nheader'])('invalid env key fails closed: %j', async (key) => {
  const {client, axios, readFileSync} = setup({}, {env: {CHATDACS_LLM_API_KEY: key}})
  await expect(client.complete('hi')).rejects.toMatchObject({code: 'LLM_AUTH_ERROR'})
  expect(axios.post).not.toHaveBeenCalled()
  expect(readFileSync).not.toHaveBeenCalled()
})

test.each(['{}', '{bad json', 'null', '{"apiKey":""}', '{"apiKey":123}', new Error('secret filename')])('missing/malformed credentials fail safely: %s', async (value) => {
  const readFileSync = jest.fn(() => {if (value instanceof Error) throw value; return value})
  const {client, axios} = setup({}, {env: {}, readFileSync})
  await expect(client.complete('hi')).rejects.toMatchObject({code: 'LLM_AUTH_ERROR', message: 'LLM_AUTH_ERROR'})
  expect(axios.post).not.toHaveBeenCalled()
})

test.each([undefined, null, {}, {data: {}}, openaiResponse([]), openaiResponse(' '), openaiResponse('<think>secret</think>')])('invalid/empty response is safe', async (response) => {
  const {client, axios} = setup()
  axios.post.mockResolvedValue(response)
  await expect(client.complete('hi')).rejects.toMatchObject({code: 'LLM_EMPTY_RESPONSE'})
})

test('removes all complete think blocks but preserves unclosed text', async () => {
  const {client, axios} = setup()
  axios.post.mockResolvedValue(openaiResponse('<think>a\nb</think> yes <think>c</think><think>unfinished'))
  await expect(client.complete('hi')).resolves.toBe('yes <think>unfinished')
})

test.each([[401, undefined, 'LLM_AUTH_ERROR'], [403, undefined, 'LLM_AUTH_ERROR'],
  [500, undefined, 'LLM_REQUEST_ERROR'], [302, undefined, 'LLM_REQUEST_ERROR'],
  [undefined, 'ECONNABORTED', 'LLM_TIMEOUT_ERROR'], [undefined, 'ETIMEDOUT', 'LLM_TIMEOUT_ERROR'],
  [undefined, 'ERR_CANCELED', 'LLM_TIMEOUT_ERROR'], [undefined, 'ERR_NETWORK', 'LLM_REQUEST_ERROR']])('request error is sanitized: %s %s', async (status, code, expected) => {
  const {client, axios} = setup()
  const original = Object.assign(new Error('secret key body response'), {code, response: {status, data: 'secret'}, config: {secret: true}})
  axios.post.mockRejectedValue(original)
  const error = await client.complete('hi').catch((error) => error)
  expect(error).toBeInstanceOf(Error)
  expect(error.message).toBe(expected)
  expect(Object.keys(error)).toEqual(['code'])
  expect(error.code).toBe(expected)
  expect(error.cause).toBeUndefined()
  expect(error.stack).not.toContain('secret')
  expect(axios.post).toHaveBeenCalledTimes(1)
})

test('non-success resolved HTTP response cannot be accepted', async () => {
  const {client, axios} = setup()
  axios.post.mockResolvedValue({...openaiResponse('bad'), status: 401})
  await expect(client.complete('hi')).rejects.toMatchObject({code: 'LLM_AUTH_ERROR'})
})

test('total deadline aborts even an unsettled transport and clears the timer', async () => {
  jest.useFakeTimers()
  const {client, axios} = setup({timeoutMs: 100})
  axios.post.mockImplementation(() => new Promise(() => {}))
  const assertion = expect(client.complete('hi')).rejects.toMatchObject({code: 'LLM_TIMEOUT_ERROR'})
  const signal = axios.post.mock.calls[0][2].signal
  expect(signal.aborted).toBe(false)
  await jest.advanceTimersByTimeAsync(100)
  await assertion
  expect(signal.aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
})

test.each([false, true])('clears deadline on success/failure: %s', async (reject) => {
  jest.useFakeTimers()
  const {client, axios} = setup()
  if (reject) axios.post.mockRejectedValue(new Error('secret'))
  await client.complete('hi').catch(() => {})
  expect(jest.getTimerCount()).toBe(0)
  expect(axios.post.mock.calls[0][2].signal.aborted).toBe(false)
})

test.each([undefined, 123, ' ', '<think>hidden</think>'])('Ollama rejects invalid or empty content: %j', async (content) => {
  const {client, axios} = setup({}, {config: {}})
  axios.post.mockResolvedValue({data: {message: {content}}})
  await expect(client.complete('hi')).rejects.toMatchObject({code: 'LLM_EMPTY_RESPONSE'})
})

test('synchronous transport errors are sanitized and clear the deadline', async () => {
  jest.useFakeTimers()
  const {client, axios} = setup()
  axios.post.mockImplementation(() => {throw new Error('private transport details')})
  await expect(client.complete('hi')).rejects.toMatchObject({code: 'LLM_REQUEST_ERROR', message: 'LLM_REQUEST_ERROR'})
  expect(jest.getTimerCount()).toBe(0)
})
