'use strict'

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const {parse} = require('@babel/parser')
const helper = require('../../static/uploadMedia')
const {registerUploadRoutes} = require('./uploads')
const {createWebMessageHandler} = require('./messageHandler')
const hash = '0123456789abcdef0123456789abcdef'
const source = fs.readFileSync(path.resolve('static/layim/lay/modules/mobile.js'), 'utf8')
const nodes = []
function visit(node, results = nodes) {
  if (!node || typeof node !== 'object') return
  results.push(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => visit(item, results))
    else if (value && typeof value === 'object') visit(value, results)
  }
}
visit(parse(source))
const contentNode = nodes.find((node) => node.type === 'AssignmentExpression' &&
  source.slice(node.left.start, node.left.end) === 'layui.data.content').right
function evaluate(node, context) { return vm.runInContext(`(${source.slice(node.start, node.end)})`, context) }
function renderer() {
  const context = vm.createContext({E: {}})
  const layui = {data: {content: evaluate(contentNode, context)}}
  helper.install(layui)
  return layui.data.content
}

test.each([['wav', 'playAudio'], ['MP3', 'playAudio'], ['mp4', 'playVideo'], ['webm', 'playVideo']])(
  'actual vendored renderer preserves local %s playback', (ext, event) => {
    const input = `file(/uploads/${hash}.${ext})[中英 Song.${ext}]`
    expect(renderer()(input)).toContain(`layim-event="${event}" data-src="/uploads/${hash}.${ext}"`)
  },
)

test.each([
  'file(https://example.invalid/song.wav)[song.wav]',
  'file(/uploads/not-a-hash.wav)[song.wav]',
  `file(/uploads/${hash}.wav?x=1)[song.wav]`,
  `file(/uploads/${hash}.txt)[notes.txt]`,
  `file(/uploads/${hash}.wav)[bad[name]]`,
])('does not rewrite remote, invalid or non-media files: %s', (input) => {
  expect(helper.rewriteUploadMedia(input)).toBe(input)
})

test.each([
  ['', false], ['hello', false],
  [`img[/uploads/${hash}.PNG]`, true],
  [`file(/uploads/${hash}.zip)[archive.zip]`, true],
  [`file(/uploads/${hash})[file]`, true],
  [`img[/uploads/${hash}.png] file(/uploads/${hash}.wav)[song.wav]`, true],
  [`text file(/uploads/${hash}.wav)[song.wav]`, false],
  [`file(https://example.invalid/${hash}.wav)[song.wav]`, false],
  [`file(/uploads/${hash}.wav)[a'b.wav]`, false],
  [`img[/uploads/${hash}.txt]`, false],
])('upload-only classification is strict: %s', (input, expected) => {
  expect(helper.isUploadOnlyMessage(input)).toBe(expected)
})

test('UMD loads without side effects and install preserves context and is idempotent', () => {
  const context = vm.createContext({})
  vm.runInContext(fs.readFileSync(path.resolve('static/uploadMedia.js'), 'utf8'), context)
  expect(context.ChatDacsUploadMedia.isUploadOnlyMessage(`img[/uploads/${hash}.png]`)).toBe(true)
  const original = jest.fn(function () { return this })
  const layui = {data: {content: original}}
  helper.install(layui)
  const wrapped = layui.data.content
  helper.install(layui)
  expect(layui.data.content).toBe(wrapped)
  expect(wrapped.call(context, `file(/uploads/${hash}.wav)[song.wav]`, 'extra')).toBe(context)
  expect(original).toHaveBeenCalledWith(`audio[/uploads/${hash}.wav](song.wav)`, 'extra')
})

const html = fs.readFileSync(path.resolve('static/index.html'), 'utf8')
const frontend = {}
for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  let ast
  try { ast = parse(match[1]) } catch { continue }
  const inlineNodes = []
  visit(ast, inlineNodes)
  for (const node of inlineNodes) {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
        node.callee.property.name === 'on' && ['socket', 'layim'].includes(node.callee.object.name) &&
        node.arguments[0]?.type === 'StringLiteral') {
      const callback = node.arguments[1]
      frontend[`${node.callee.object.name}:${node.arguments[0].value}`] = match[1].slice(callback.start, callback.end)
    }
  }
}

test('application installs wrapper after mobile loads and before chat configuration', () => {
  expect(html.indexOf('src="/uploadMedia.js"')).toBeLessThan(html.indexOf('ChatDacsUploadMedia.install(layui)'))
  expect(html.indexOf('.use(["mobile"')).toBeLessThan(html.indexOf('ChatDacsUploadMedia.install(layui)'))
  expect(html.indexOf('ChatDacsUploadMedia.install(layui)')).toBeLessThan(html.indexOf('layim.config('))
  expect(frontend['socket:audio']).toBeDefined()
  expect(frontend['socket:video']).toBeDefined()
})

test.each([
  ['image', 'photo.PNG', 'image/png', 'layui-layim-photos'],
  ['file', 'notes.txt', 'text/plain', 'layui-layim-file'],
  ['file', 'song.wav', 'audio/wav', 'playAudio'],
  ['file', 'movie.mp4', 'video/mp4', 'playVideo'],
  ['file', 'safe][p onmouseover=window.__xss=1]hover.txt', 'text/plain', 'layui-layim-file'],
])('actual mobile upload/send callbacks render %s %s once per client without model requests', async (kind, name, mime, expected) => {
  const local = [], received = [], broadcasts = [], pending = [], clients = []
  const render = renderer()
  const io = {emit: jest.fn((event, data) => {
    broadcasts.push(event)
    for (const client of clients) client[event]?.(data)
  })}
  const processExecute = jest.fn(), chatProcess = jest.fn()
  const addMessage = jest.fn()
  const handler = createWebMessageHandler({io, utils: {AddMessage: addMessage}, logger: {info() {}},
    processExecute, chatProcess, globalConfig: {CHAT_SWITCH: true}})
  let sendCallback
  for (const cid of ['sender', 'observer']) {
    const context = vm.createContext({myCID: cid, username: '',
      layim: {getMessage: (data) => received.push({cid, html: render(data.content)})},
      socket: {emit: (event, data) => pending.push(handler({socket: {username: 'synthetic',
        request: {headers: {cookie: 'ChatdacsID=sender'}}}, msgIn: data}))}})
    const client = {}
    for (const event of ['message', 'picture', 'file', 'audio', 'video']) {
      client[event] = vm.runInContext(`(${frontend[`socket:${event}`]})`, context)
    }
    clients.push(client)
    if (cid === 'sender') sendCallback = vm.runInContext(`(${frontend['layim:sendMessage']})`, context)
  }
  const routes = []
  registerUploadRoutes({app: {post: (...args) => routes.push(args)}, upload: {single: () => () => {}},
    io, logger: {info() {}, error() {}}, rename: jest.fn().mockResolvedValue(), remove: jest.fn()})
  let payload
  const res = {status: jest.fn().mockReturnThis(), json: (data) => { payload = data }}
  await routes.find(([route]) => route === `/upload/${kind}`).at(-1)({file: {
    filename: hash, path: 'synthetic', originalname: name, mimetype: mime,
  }}, res)
  expect(io.emit).not.toHaveBeenCalled()

  let uploadOptions
  const textarea = {value: '', selectionStart: 0, selectionEnd: 0, focus() {}}
  const input = Object.assign([textarea], {val(value) {
    if (value === undefined) return textarea.value
    textarea.value = value
    return this
  }, next: () => ({addClass() {}})})
  const context = vm.createContext({E: {}, document: {}, layui: {data: {date: () => ''}, cache: {dir: ''},
    each: (items, fn) => Object.entries(items).forEach(([key, value]) => fn(key, value))},
  C: {mine: {username: 'synthetic', id: 'sender'}, base: {uploadImage: {}, uploadFile: {}}},
  A: () => ({textarea: input, data: {id: '101', type: 'group'}, elem: {find: () => ({append(value) {
    if (!value.startsWith('<li class="layim-chat-system"')) local.push(value)
  }})}}), l: (options) => { uploadOptions = options }, n: {msg() {}},
  t: () => ({render: (data) => render(data.content)}), w: '', F() {}, H() {}, J() {}, r: {sendMessage: [sendCallback]}})
  for (const name of ['R', 'q']) {
    const node = nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === name && node.start > 40000)
    context[name] = evaluate(node.init, context)
  }
  const image = nodes.find((node) => node.type === 'ObjectProperty' && node.key.name === 'image' && node.start > 60000)
  evaluate(image.value, context)({data: () => kind === 'image' ? 'images' : 'file', find: () => [{}]})
  uploadOptions.success(payload)
  await Promise.all(pending)
  expect(local).toHaveLength(1)
  expect(received.map(({cid}) => cid)).toEqual(['observer'])
  expect(received[0].html).toBe(local[0])
  expect(local[0]).toContain(expected)
  expect(local[0]).not.toMatch(/<p\s|<div\s+on|href="javascript:/)
  expect(broadcasts).toEqual(['message'])
  expect(addMessage).toHaveBeenCalledTimes(1)
  expect(processExecute).not.toHaveBeenCalled()
  expect(chatProcess).not.toHaveBeenCalled()
})
