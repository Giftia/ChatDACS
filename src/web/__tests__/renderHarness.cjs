'use strict'

const fs = require('fs')
const path = require('path')
const vm = require('vm')
const {parse} = require('@babel/parser')
const {JSDOM} = require('jsdom')
const createDOMPurify = require('dompurify')
const security = require('../../../static/renderSecurity')
const uploadMedia = require('../../../static/uploadMedia')
const source = fs.readFileSync(path.resolve(__dirname, '../../../static/layim/lay/modules/mobile.js'), 'utf8')
const index = fs.readFileSync(path.resolve(__dirname, '../../../static/index.html'), 'utf8')
const nodes = []
function collect(node, result) {
  if (!node || typeof node !== 'object') return
  result.push(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => collect(item, result))
    else if (value && typeof value === 'object') collect(value, result)
  }
}
collect(parse(source), nodes)
const contentNode = nodes.find((node) => node.type === 'AssignmentExpression' &&
  source.slice(node.left.start, node.left.end) === 'layui.data.content').right
const templateNode = nodes.find((node) => node.type === 'VariableDeclarator' && node.id.name === 'w' && node.start > 40000).init
const laytplDefinition = nodes.filter((node) => node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' && node.callee.object.name === 'layui' &&
  node.callee.property.name === 'define')[1].arguments[0]
const callbacks = {}
for (const match of index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
  let ast
  try { ast = parse(match[1]) } catch { continue }
  const inlineNodes = []
  collect(ast, inlineNodes)
  for (const node of inlineNodes) {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
        node.callee.object.name === 'socket' && node.callee.property.name === 'on' &&
        node.arguments[0]?.type === 'StringLiteral') {
      const callback = node.arguments[1]
      callbacks[node.arguments[0].value] = match[1].slice(callback.start, callback.end)
    }
  }
}

function runCase(request, baseline) {
  // Only the synthetic event-proof cases enable inline handlers; resources stay disabled.
  const dom = new JSDOM('', {url: 'https://offline.invalid/', ...(request.proof ? {runScripts: 'dangerously'} : {})})
  dom.window.__renderProof = 0
  const purify = createDOMPurify(dom.window)
  const install = baseline ? () => {} : security.install
  const sanitize = baseline ? (html) => html : security.sanitizeHtml
  const context = vm.createContext({window: {}, console, E: {'[猫问号]': '/layim/images/face/1.gif'},
    layui: {data: {}, cache: {dir: '/layim/'}}})
  const evaluate = (node) => vm.runInContext(`(${source.slice(node.start, node.end)})`, context)
  evaluate(laytplDefinition)((name, value) => { context.layui[name] = value })
  const layui = context.layui
  layui.data.content = evaluate(contentNode)
  const template = vm.runInContext(source.slice(templateNode.start, templateNode.end), context)
  const output = []
  const layim = {getMessage(message) {
    output.push(layui.laytpl(template).render(message))
    return this
  }}
  const selectedPurify = request.fallback === 'missing' ? undefined : request.fallback === 'unsupported'
    ? {isSupported: false} : request.fallback === 'throw'
      ? {isSupported: true, addHook() {}, sanitize() { throw new Error('synthetic') }} : purify
  uploadMedia.install(layui)
  if (request.op !== 'raw') install(layui, {purify: selectedPurify, layim})
  function inspect(html) {
    const root = dom.window.document.createElement('div')
    root.innerHTML = html
    const elements = [...root.querySelectorAll('*')].map((node) => ({
      tag: node.tagName.toLowerCase(), text: node.textContent,
      attributes: Object.fromEntries([...node.attributes].map((attr) => [attr.name, attr.value])),
    }))
    return {html, text: root.textContent, elements,
      citeText: root.querySelector('cite')?.textContent,
      avatar: root.querySelector('.layim-chat-user img')?.getAttribute('src')}
  }
  try {
    if (request.op === 'attribute-reparse') {
      const html = request.html === undefined ? layui.data.content(request.content) : sanitize(request.html, purify)
      const first = dom.window.document.createElement('div')
      first.innerHTML = html
      const node = first.querySelector(request.tag)
      const url = node?.getAttribute(request.attribute)
      if (url == null) return {...inspect(html), missingUrl: true}
      const second = dom.window.document.createElement('div')
      second.innerHTML = `<${request.tag} ${request.attribute}="${url}">synthetic</${request.tag}>`
      dom.window.document.body.append(second)
      for (const image of second.querySelectorAll('img')) image.dispatchEvent(new dom.window.Event('error'))
      return {...inspect(second.innerHTML), normalizedUrl: url, proofFlag: dom.window.__renderProof,
        imageCount: second.querySelectorAll('img').length, elementCount: second.querySelectorAll('*').length}
    }
    if (request.op === 'event-proof-control') {
      const root = dom.window.document.createElement('div')
      root.innerHTML = '<img src="/synthetic-error" onerror="window.__renderProof=1">'
      root.querySelector('img').dispatchEvent(new dom.window.Event('error'))
      return {flag: dom.window.__renderProof}
    }
    if (request.op === 'html') return inspect(sanitize(request.html, purify))
    if (request.op === 'message') {
      const message = {...request.message}
      const returned = layim.getMessage(message)
      return {...inspect(output[0]), returnSame: returned === layim,
        unchanged: JSON.stringify(message) === JSON.stringify(request.message)}
    }
    if (request.op === 'system') {
      if (!callbacks.system) throw new Error('ACTUAL_SYSTEM_CALLBACK_MISSING')
      vm.runInNewContext(`(${callbacks.system})`, {layim})(request.content)
      return inspect(output[0])
    }
    if (request.op === 'idempotence') {
      const first = layui.data.content, receive = layim.getMessage
      install(layui, {purify, layim})
      layim.getMessage({username: '张三 & 李四', avatar: '/avatar.png', content: '正文'})
      return {...inspect(output[0]), contentSame: first === layui.data.content,
        receiveSame: receive === layim.getMessage}
    }
    if (request.op === 'typing' || request.op === 'online') {
      dom.window.document.body.innerHTML = '<div class="layim-chat-status"></div><div class="layim-chat-status"></div><input><button></button>'
      const status = dom.window.document.getElementsByClassName('layim-chat-status')[request.op === 'online' ? 0 : 1]
      const callback = callbacks[request.op === 'online' ? 'onlineUsers' : 'typing']
      if (!callback) throw new Error('ACTUAL_STATUS_CALLBACK_MISSING')
      vm.runInNewContext(`(${callback})`, {document: dom.window.document, text: {}, typing_status: status})(request.content)
      return {text: status.textContent, html: status.innerHTML, childElements: status.children.length}
    }
    if (request.op === 'settings') {
      if (!callbacks.settings) throw new Error('ACTUAL_SETTINGS_CALLBACK_MISSING')
      let panel
      vm.runInNewContext(`(${callbacks.settings})`, {
        layim: {panel: (options) => { panel = options }}, ChatDacsRenderSecurity: security,
      })(request.data)
      const html = layui.laytpl(panel.tpl).render({data: panel.data})
      const root = dom.window.document.createElement('div')
      root.innerHTML = html
      const inputs = [...root.querySelectorAll('input')]
      return {html, inputCount: inputs.length, imageCount: root.querySelectorAll('img,svg,iframe,script').length,
        onAttributes: [...root.querySelectorAll('*')].flatMap((node) => [...node.attributes].filter((a) => /^on/i.test(a.name)).map((a) => a.name)),
        name: root.querySelector('input[name="name"]')?.value,
        CID: root.querySelector('input[name="CID"]')?.value,
        placeholder: root.querySelector('input[name="CID"]')?.getAttribute('placeholder')}
    }
    const rendered = layui.data.content(request.content)
    if (request.op === 'photos') {
      const root = dom.window.document.createElement('div')
      root.id = 'synthetic-photo-source'
      root.innerHTML = rendered
      dom.window.document.body.append(root)
      const image = root.querySelector('img')
      if (!image) return {missingImage: true}
      const previews = []
      let sourceAttributeReads = 0, doubleClicks = 0
      function jquery(value) {
        const selected = typeof value === 'string' ? [...dom.window.document.querySelectorAll(value)] :
          Array.isArray(value) ? value : [value]
        return {find(selector) { return jquery(selected.flatMap((node) => [...node.querySelectorAll(selector)])) },
          each(callback) { selected.forEach((node, index) => callback.call(node, index)); return this },
          attr(name, value) {
            if (arguments.length === 2) { selected.forEach((node) => node.setAttribute(name, value)); return this }
            if (name === 'src') sourceAttributeReads++
            return selected[0]?.getAttribute(name)
          }, width: () => 1024, height: () => 768}
      }
      jquery.extend = Object.assign
      const layer = {load: () => 1, close() {}, msg() { throw new Error('SYNTHETIC_PHOTO_LOAD_FAILED') },
        open(options) {
          const popup = dom.window.document.createElement('div')
          popup.innerHTML = options.content
          dom.window.document.body.append(popup)
          for (const img of popup.querySelectorAll('img')) img.dispatchEvent(new dom.window.Event('error'))
          previews.push({imageCount: popup.querySelectorAll('img').length,
            src: popup.querySelector('img')?.getAttribute('src'),
            handlers: [...popup.querySelectorAll('*')].flatMap((node) => [...node.attributes]
              .filter((attr) => /^on/i.test(attr.name)).map((attr) => attr.name)),
            proofFlag: dom.window.__renderProof})
          return 1
        }}
      const photoSource = fs.readFileSync(path.resolve(__dirname, '../../../static/layim/lay/modules/layer.js'), 'utf8')
      const photoNodes = []
      collect(parse(photoSource), photoNodes)
      const photosNode = photoNodes.find((node) => node.type === 'AssignmentExpression' &&
        photoSource.slice(node.left.start, node.left.end) === 'r.photos').right
      const desktopSource = fs.readFileSync(path.resolve(__dirname, '../../../static/layim/lay/modules/layim.js'), 'utf8')
      const desktopNodes = []
      collect(parse(desktopSource), desktopNodes)
      const doubleClickNode = desktopNodes.find((node) => node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' && node.callee.property.name === 'on' &&
        node.arguments[0]?.value === 'dblclick' && node.arguments[1]?.value === '.layui-layim-photos').arguments[2]
      const photoContext = vm.createContext({i: jquery, r: layer, t: layer, e: dom.window, z: {}, c: () => '',
        Image: function () { this.complete = true; this.width = 1; this.height = 1 }})
      layer.photos = vm.runInContext(`(${photoSource.slice(photosNode.start, photosNode.end)})`, photoContext)
      const doubleClick = vm.runInContext(`(${desktopSource.slice(doubleClickNode.start, doubleClickNode.end)})`, photoContext)
      image.addEventListener('dblclick', function () { doubleClicks++; doubleClick.call(this) })
      image.dispatchEvent(new dom.window.MouseEvent('dblclick', {bubbles: true}))
      // Exercise the separate stock selector branch, which reads attr('src'), not this.src.
      layer.photos({photos: '#synthetic-photo-source', full: true}, true)
      return {doubleClicks, sourceAttributeReads, previews, normalizedSource: image.getAttribute('src')}
    }
    if (request.op !== 'interaction') return inspect(rendered)
    const root = dom.window.document.createElement('div')
    root.innerHTML = rendered
    const type = request.media, event = type === 'audio' ? 'playAudio' : 'playVideo'
    const control = root.querySelector(`div.layui-layim-${type}`)
    if (!control) return {...inspect(rendered), missingControl: true}
    let plays = 0, opened, audio, popup, clicks = 0
    const interactionContext = vm.createContext({document: {createElement(tag) {
      const media = dom.window.document.createElement(tag)
      media.play = () => { plays++ }
      media.pause = () => {}
      if (tag === 'audio') audio = media
      return media
    }}, n: {close() {}, open(options) {
      opened = options.content
      popup = dom.window.document.createElement('div')
      popup.innerHTML = opened
      dom.window.document.body.append(popup)
      for (const img of popup.querySelectorAll('img')) img.dispatchEvent(new dom.window.Event('error'))
      return 1
    }, msg() {}}, U: {playVideo: {}}})
    const node = nodes.find((n) => n.type === 'ObjectProperty' && n.key.name === event && n.start > 60000).value
    const play = vm.runInContext(`(${source.slice(node.start, node.end)})`, interactionContext)
    const state = {}
    const target = {data(key, value) {
      if (arguments.length === 2) state[key] = value
      return key === 'src' ? control.getAttribute('data-src') : state[key]
    }, attr() {}, removeAttr() {}, find: () => ({html() {}})}
    control.addEventListener('click', () => { clicks++; play(target) })
    control.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}))
    const video = popup?.querySelector('video')
    return {...inspect(rendered), plays, clicks, audioSrc: audio?.src, audioRawSrc: audio?.getAttribute('src'), opened,
      proofFlag: dom.window.__renderProof, extraImages: popup?.querySelectorAll('img').length,
      popupHandlers: popup ? [...popup.querySelectorAll('*')].flatMap((node) =>
        [...node.attributes].filter((attr) => /^on/i.test(attr.name)).map((attr) => attr.name)) : [],
      videoCount: popup?.querySelectorAll('video').length, videoRawSrc: video?.getAttribute('src'), videoSrc: video?.src}
  } finally { dom.window.close() }
}

function main() {
  const {cases, baseline = false} = JSON.parse(fs.readFileSync(0, 'utf8'))
  const results = Object.fromEntries(cases.map((request) => {
    try { return [request.id, runCase(request, baseline)] }
    catch (error) { return [request.id, {error: error.stack}] }
  }))
  process.stdout.write(JSON.stringify({node: process.version, results}))
}

if (require.main === module) main()
