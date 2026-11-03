'use strict'

const path = require('path')
const {execFileSync} = require('child_process')
const cases = []
let results
function scenario(id, options) { cases.push({id, ...options}); return id }
function result(id) {
  expect(results[id]).toBeDefined()
  expect(results[id].error).toBeUndefined()
  return results[id]
}
function inert(value) {
  expect(value.elements).toBeDefined()
  for (const node of value.elements) {
    expect(['script', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'base', 'meta', 'link']).not.toContain(node.tag)
    for (const [name, text] of Object.entries(node.attributes)) {
      expect(name).not.toMatch(/^on/i)
      expect(['style', 'id', 'name', 'srcdoc', 'autofocus']).not.toContain(name)
      if (['href', 'src', 'data-src'].includes(name)) {
        expect(text.replace(/[\u0000-\u0020]/g, '')).not.toMatch(/^(?:javascript|vbscript):/i)
      }
    }
  }
  return value
}
function element(value, tag) { return value.elements.find((node) => node.tag === tag) }

beforeAll(() => {
  // Native Node handles jsdom30's ESM dependencies; Jest29 only asserts JSON.
  const output = execFileSync(process.execPath, [path.join(__dirname, '__tests__/renderHarness.cjs')], {
    input: JSON.stringify({cases, baseline: process.env.CHATDACS_RENDER_SECURITY_RED === '1'}),
    encoding: 'utf8', timeout: 20000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
  })
  const response = JSON.parse(output)
  results = response.results
  expect(Object.keys(results)).toHaveLength(cases.length)
}, 25000)

const raw = scenario('raw', {op: 'raw', content: '[p onmouseover=window.__xss=1]hover'})
test('raw actual vendored parser reproduces the original vulnerability', () => {
  expect(element(result(raw), 'p').attributes.onmouseover).toBe('window.__xss=1')
})

const payloads = ['[p onmouseover=window.__xss=1]hover', '[div onclick=window.__xss=1]click[/div]',
  'a(javascript:window.__xss=1)[click]', 'file(javascript:window.__xss=1)[download]',
  'a(java&#x73;cript:window.__xss=1)[entity]', '[p style=position:fixed id=overlay name=DOMPurify]text']
for (const [index, content] of payloads.entries()) {
  const id = scenario(`content-${index}`, {op: 'content', content})
  test(`ordinary content is inert after actual parser expansion: ${content}`, () => { inert(result(id)) })
}

const system = scenario('system', {op: 'system', content: '欢迎回来，[p onmouseover=window.__xss=1]hover'})
test('actual system callback and message template sanitize nickname-derived content', () => {
  expect(inert(result(system)).text).toContain('欢迎回来，hover')
})

for (const [index, username] of ['<img src=x onerror=window.__xss=1>', '<svg onload=window.__xss=1>', '张三 <guest> & 李四'].entries()) {
  const id = scenario(`nickname-${index}`, {op: 'message', message: {username, avatar: '/avatar.png', content: '正常正文'}})
  test(`username is literal text in the actual template, not double escaped: ${username}`, () => {
    const value = inert(result(id))
    expect(value.citeText).toBe(username)
    expect(value.unchanged).toBe(true)
    expect(value.returnSame).toBe(true)
  })
}

const avatar = 'https://example.invalid/avatar.png?a=1&b=2'
const avatarGood = scenario('avatar-good', {op: 'message', message: {username: '正常昵称', avatar, content: '正文'}})
const avatarBad = scenario('avatar-bad', {op: 'message', message: {username: '昵称', avatar: 'x" onerror="window.__xss=1', content: '正文'}})
test('actual avatar interpolation preserves URL separators without double escaping', () => { expect(inert(result(avatarGood)).avatar).toBe(avatar) })
test('actual avatar interpolation cannot introduce event attributes', () => { inert(result(avatarBad)) })

const text = scenario('text', {op: 'content', content: '中文第一行\n第二行 face[猫问号]'})
test('Chinese line breaks and face src/alt/title remain available', () => {
  const value = inert(result(text)), image = element(value, 'img')
  expect(value.text).toContain('中文第一行')
  expect(value.elements.filter((node) => node.tag === 'br')).toHaveLength(1)
  expect(image.attributes).toMatchObject({src: '/layim/images/face/1.gif', alt: '[猫问号]', title: '[猫问号]'})
})
const layout = scenario('layout', {op: 'content', content: '[pre]代码示例  x = 1[/pre][table][thead][tr][th]列名[/th][/tr][/thead][tbody][tr][td]中文单元格[/td][/tr][/tbody][/table]'})
test('actual pre/table expansion preserves normal Chinese layout without style', () => {
  const value = inert(result(layout))
  expect(element(value, 'pre').text).toBe('代码示例  x = 1')
  expect(element(value, 'th').text).toBe('列名')
  expect(element(value, 'td').text).toBe('中文单元格')
})
const semantic = scenario('semantic', {op: 'html', html: '<pre><code>const x = 1</code></pre><blockquote>中文引用</blockquote><table><tbody><tr><td>数据</td></tr></tbody></table>'})
test('final HTML boundary preserves code, quote and table tags', () => {
  const value = inert(result(semantic))
  expect(element(value, 'code').text).toBe('const x = 1')
  expect(element(value, 'blockquote').text).toBe('中文引用')
  expect(element(value, 'td').text).toBe('数据')
})

const links = scenario('links', {op: 'content', content: 'img[/uploads/photo.png] file(/uploads/notes.txt)[中文文件]'})
test('actual images and downloads retain rendering attributes with safe blank targets', () => {
  const value = inert(result(links))
  expect(element(value, 'img').attributes).toMatchObject({src: '/uploads/photo.png', class: 'layui-layim-photos'})
  expect(element(value, 'a').attributes).toMatchObject({href: '/uploads/notes.txt', download: '', target: '_blank'})
  expect(element(value, 'a').attributes.rel.split(/\s+/)).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
})
for (const [media, event, ext] of [['audio', 'playAudio', 'wav'], ['video', 'playVideo', 'mp4']]) {
  const url = `https://example.invalid/synthetic.${ext}`
  const id = scenario(`media-${media}`, {op: 'interaction', media, content: `${media}[${url}]`})
  test(`actual ${event} vendor handler still consumes sanitized data-src`, () => {
    const value = inert(result(id))
    expect(value.missingControl).not.toBe(true)
    const control = value.elements.find((node) => node.attributes['layim-event'] === event)
    expect(control.attributes).toMatchObject({'data-src': url, 'layim-event': event})
    if (media === 'audio') { expect(value.audioSrc).toBe(url); expect(value.plays).toBe(1) }
    else expect(value.opened).toContain(`src="${url}"`)
  })
}
for (const [index, html] of [
  '<div class="layui-layim-audio" layim-event="playAudio" data-src="javascript:window.__xss=1">bad</div>',
  '<div class="layui-layim-video" layim-event="playVideo" data-src="data:text/html,synthetic">bad</div>',
  '<div class="layui-layim-audio" layim-event="closeChat" data-src="/audio.wav">bad</div>',
  '<a class="layui-layim-audio" layim-event="playAudio" data-src="/audio.wav">bad</a>',
].entries()) {
  const id = scenario(`forged-${index}`, {op: 'html', html})
  test(`forged media controller ${index} loses both interaction attributes`, () => {
    const value = inert(result(id))
    for (const node of value.elements) {
      expect(node.attributes['layim-event']).toBeUndefined()
      expect(node.attributes['data-src']).toBeUndefined()
    }
  })
}

const eventControl = scenario('event-proof-control', {op: 'event-proof-control', proof: true})
test('native DOM proof fixture really executes a synthetic image error handler', () => {
  expect(result(eventControl).flag).toBe(1)
})
const videoProof = scenario('video-secondary-proof', {op: 'interaction', media: 'video', proof: true,
  content: 'video[https://media.invalid/"><img/src=\'x\'/onerror=\'window.__renderProof=1\'>]'})
test('clicking actual playVideo cannot create injected images or execute error handlers at its second HTML sink', () => {
  const value = inert(result(videoProof))
  expect(value.missingControl).not.toBe(true)
  expect(value.clicks).toBe(1)
  expect(value.videoCount).toBe(1)
  expect(value.extraImages).toBe(0)
  expect(value.popupHandlers).toEqual([])
  expect(value.proofFlag).toBe(0)
  expect(value.videoRawSrc).toBe('https://media.invalid/%22%3E%3Cimg/src=%27x%27/onerror=%27window.__renderProof=1%27%3E')
})

const quoteUrl = 'https://media.invalid/"><img/src=\'x\'/onerror=\'window.__renderProof=1\'>'
const quoteCases = [
  {tag: 'img', attribute: 'src', content: `img[${quoteUrl}]`},
  {tag: 'a', attribute: 'href', content: `a(${quoteUrl})[open]`},
  {tag: 'video', attribute: 'poster', html: '<video poster="https://media.invalid/&quot;&gt;&lt;img/src=&#39;x&#39;/onerror=&#39;window.__renderProof=1&#39;&gt;"></video>'},
]
for (const request of quoteCases) {
  const id = scenario(`quote-${request.attribute}`, {op: 'attribute-reparse', proof: true, ...request})
  test(`stock ${request.attribute} DOM value remains safe when reused in a second HTML interpolation`, () => {
    const value = inert(result(id))
    expect(value.missingUrl).not.toBe(true)
    expect(value.elementCount).toBe(1)
    expect(value.imageCount).toBe(request.tag === 'img' ? 1 : 0)
    expect(value.proofFlag).toBe(0)
    expect(value.normalizedUrl).toBe('https://media.invalid/%22%3E%3Cimg/src=%27x%27/onerror=%27window.__renderProof=1%27%3E')
    expect(element(value, request.tag).attributes[request.attribute]).toBe(value.normalizedUrl)
  })
}

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0XcAAAAASUVORK5CYII='
const pngCase = scenario('plugin-base64-png', {op: 'content', content: `img[${png}]`})
test('actual parser and boundary retain the base64 PNG src used by existing image plugins', () => {
  const value = inert(result(pngCase))
  expect(value.elements.filter((node) => node.tag === 'img')).toHaveLength(1)
  expect(element(value, 'img').attributes.src).toBe(png)
})

for (const [label, url, expected] of [
  ['quote URL', quoteUrl, 'https://media.invalid/%22%3E%3Cimg/src=%27x%27/onerror=%27window.__renderProof=1%27%3E'],
  ['base64 PNG', png, png],
]) {
  const id = scenario(`photos-${label}`, {op: 'photos', proof: true, content: `img[${url}]`})
  test(`actual image double-click and layer.photos selector src branch preserve safe ${label}`, () => {
    const value = result(id)
    expect(value.missingImage).not.toBe(true)
    expect(value.doubleClicks).toBe(1)
    expect(value.sourceAttributeReads).toBeGreaterThanOrEqual(2)
    expect(value.normalizedSource).toBe(expected)
    expect(value.previews).toHaveLength(2)
    for (const preview of value.previews) {
      expect(preview.imageCount).toBe(1)
      expect(preview.src).toBe(expected)
      expect(preview.handlers).toEqual([])
      expect(preview.proofFlag).toBe(0)
    }
  })
}
for (const [media, url, resolved] of [
  ['audio', 'song.mp3', 'https://offline.invalid/song.mp3'],
  ['audio', './song.mp3', 'https://offline.invalid/song.mp3'],
  ['video', '../movie.mp4', 'https://offline.invalid/movie.mp4'],
  ['audio', '//media.invalid/song.mp3', 'https://media.invalid/song.mp3'],
]) {
  const id = scenario(`relative-${media}-${url}`, {op: 'interaction', media, content: `${media}[${url}]`})
  test(`actual ${media} click preserves usable relative/protocol-relative URL ${url}`, () => {
    const value = inert(result(id))
    expect(value.missingControl).not.toBe(true)
    expect(value.clicks).toBe(1)
    const event = media === 'audio' ? 'playAudio' : 'playVideo'
    expect(value.elements.find((node) => node.attributes['layim-event'] === event).attributes['data-src']).toBe(url)
    if (media === 'audio') {
      expect(value.plays).toBe(1)
      expect(value.audioRawSrc).toBe(url)
      expect(value.audioSrc).toBe(resolved)
    } else {
      expect(value.videoRawSrc).toBe(url)
      expect(value.videoSrc).toBe(resolved)
      expect(value.videoCount).toBe(1)
    }
  })
}

for (const fallback of ['missing', 'unsupported', 'throw']) {
  const id = scenario(`fallback-${fallback}`, {op: 'content', fallback, content: '[p onmouseover=window.__xss=1]hover'})
  test(`purify ${fallback} fails closed without blocking text`, () => {
    const value = result(id)
    expect(value.elements).toEqual([])
    expect(value.text).toContain('onmouseover=window.__xss=1')
  })
}
const idempotence = scenario('idempotence', {op: 'idempotence'})
test('install is idempotent and does not double escape nickname text', () => {
  const value = result(idempotence)
  expect(value.contentSame).toBe(true)
  expect(value.receiveSame).toBe(true)
  expect(value.citeText).toBe('张三 & 李四')
})

const sinkPayload = '<img src=x onerror=window.__xss=1>'
for (const op of ['typing', 'online']) {
  const id = scenario(op, {op, content: sinkPayload})
  test(`actual ${op} inline callback renders only plain text`, () => {
    const value = result(id)
    expect(value.childElements).toBe(0)
    expect(value.text).toBe((op === 'online' ? '当前在线:' : '') + sinkPayload)
  })
}
const settingsData = {name: '"><img src=x onerror=window.__xss=1>', CID: '" onmouseover="window.__xss=1'}
const settings = scenario('settings', {op: 'settings', data: settingsData})
test('actual settings callback and laytpl keep malicious CID/name inside quoted values', () => {
  const value = result(settings)
  expect(value.inputCount).toBe(2)
  expect(value.imageCount).toBe(0)
  expect(value.onAttributes).toEqual([])
  expect(value.name).toBe(settingsData.name)
  expect(value.CID).toBe(settingsData.CID)
  expect(value.placeholder).toBe(settingsData.CID)
})
