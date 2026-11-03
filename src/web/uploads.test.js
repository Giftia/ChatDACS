'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')

function actualLayimParser() {
  const source = fs.readFileSync(path.resolve('static/layim/lay/modules/mobile.js'), 'utf8')
  const ast = require('@babel/parser').parse(source)
  let content
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'AssignmentExpression' && source.slice(node.left.start, node.left.end) === 'layui.data.content') {
      content = node.right
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit)
      else if (value && typeof value === 'object') visit(value)
    }
  }
  visit(ast)
  if (!content) throw new Error('VENDORED_PARSER_NOT_FOUND')
  return vm.runInNewContext(`(${source.slice(content.start, content.end)})`, {E: {}})
}

let root
beforeEach(() => {
  for (const moduleName of ['express', 'compression', 'multer', 'http', 'socket.io', 'lib-qqwry']) jest.dontMock(moduleName)
  jest.dontMock('./session')
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatdacs-web-uploads-'))
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.resetModules()
  fs.rmSync(root, {recursive: true, force: true})
})

function response() {
  const res = {status: jest.fn(), json: jest.fn(), setHeader: jest.fn()}
  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  return res
}

function serverFixture({handleConnection} = {}) {
  const app = {use: jest.fn(), get: jest.fn(), post: jest.fn()}
  const middleware = (req, res, next) => next()
  const express = Object.assign(jest.fn(() => app), {
    static: jest.fn(() => function staticMiddleware(req, res, next) { next() }),
    json: jest.fn(() => middleware), urlencoded: jest.fn(() => middleware),
  })
  const http = {listen: jest.fn(), on: jest.fn(), close: jest.fn()}
  const io = {on: jest.fn(), emit: jest.fn()}
  const upload = {single: jest.fn(() => middleware)}
  const logger = {info: jest.fn(), error: jest.fn()}
  jest.doMock('express', () => express)
  jest.doMock('compression', () => () => middleware)
  jest.doMock('multer', () => () => upload)
  jest.doMock('http', () => ({Server: () => http}))
  jest.doMock('socket.io', () => () => io)
  jest.doMock('lib-qqwry', () => () => ({searchIP: jest.fn()}))
  jest.doMock('../../plugins/system/utils.js', () => ({}))
  jest.doMock('../../config/constants.js', () => ({WEB_HELP_CONTENT: 'test help'}))
  if (handleConnection) jest.doMock('./session', () => ({createWebSessionRuntime: () => ({handleConnection})}))
  let server
  jest.isolateModules(() => { server = require('../server') })
  server.startServer({version: 'test', globalConfig: {WEB_PORT: 0}, logger,
    chatProcess: jest.fn(), processExecute: jest.fn()})
  return {app, express, http, io, upload, logger}
}

function request(originalname, mimetype = 'application/octet-stream') {
  const filename = 'fixture-upload'
  const filePath = path.join(root, filename)
  fs.writeFileSync(filePath, 'fixture bytes', 'utf8')
  return {file: {path: filePath, filename, originalname, mimetype}}
}

test.each([['image', 'sample.png', 'image/png'], ['file', 'notes.txt', 'text/plain']])(
  'server /upload/%s finishes HTTP response without a duplicate broadcast', async (kind, name, mime) => {
    const {app, io, logger} = serverFixture()
    const handler = app.post.mock.calls.find(([route]) => route === `/upload/${kind}`).at(-1)
    const req = request(name, mime)
    const res = response()
    await handler(req, res)
    expect(io.emit).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({code: 0, data: {src: `/uploads/fixture-upload${path.extname(name)}`, name}})
    expect(logger.info).not.toHaveBeenCalledWith(req.file)
  },
)

test.each([
  'safe][p onmouseover=window.__xss=1]hover.txt',
  'safe][div onclick=window.__xss=1]click.txt',
  'safe]a(javascript:window.__xss=1)[click].txt',
  '<img src=x onerror=window.__xss=1>.txt',
  'face[bad] audio[bad] video[bad] (x).txt',
  'control\u0000\r\n\t\u007f\u202e\u2028.txt',
])('upload display name is inert in the actual vendored parser: %p', async (name) => {
  const {app} = serverFixture()
  const handler = app.post.mock.calls.find(([route]) => route === '/upload/file').at(-1)
  const res = response()
  await handler(request(name), res)
  const {src, name: safeName} = res.json.mock.calls[0][0].data
  expect(safeName).not.toMatch(/[\[\]()<>"'&@\\/\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u)
  const rendered = actualLayimParser()(`file(${src})[${safeName}]`)
  expect(rendered).toBe(`<a class="layui-layim-file" href="${src}" download target="_blank"><i class="layui-icon">&#xe61e;</i><cite>${safeName}</cite></a>`)
})

test('the unmodified vendored parser reproduces the original filename vulnerability', () => {
  expect(actualLayimParser()('file(/uploads/test.txt)[safe][p onmouseover=window.__xss=1]hover.txt]'))
    .toContain('<p  onmouseover=window.__xss=1>')
})

test.each(['normal-file.txt', 'English Song.WAV', '中文报告.pdf', '中英混合 Movie.MP4'])('preserves normal display name and extension: %s', async (name) => {
  const {app, io} = serverFixture()
  const handler = app.post.mock.calls.find(([route]) => route === '/upload/file').at(-1)
  const res = response()
  await handler(request(name), res)
  expect(res.json.mock.calls[0][0].data.name).toBe(name)
  expect(io.emit).not.toHaveBeenCalled()
})

test('server installs upload protection before static files, including resolved-path fallback', () => {
  const {app, express} = serverFixture()
  const protectedIndex = app.use.mock.calls.findIndex(([mount]) => mount === '/uploads')
  const staticMiddleware = express.static.mock.results[0].value
  const staticIndex = app.use.mock.calls.findIndex(([middleware]) => middleware === staticMiddleware)
  expect(protectedIndex).toBeGreaterThanOrEqual(0)
  expect(protectedIndex).toBeLessThan(staticIndex)
  const setHeaders = express.static.mock.calls[0][1].setHeaders
  const res = response()
  setHeaders(res, path.resolve('static/uploads/executable.html'))
  expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment')
  expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
  const other = response()
  setHeaders(other, path.resolve('static/index.html'))
  expect(other.setHeader).not.toHaveBeenCalled()
})

test('server does not register late message handler if disconnect follows completed initialization', async () => {
  let resolve
  const pending = new Promise((done) => { resolve = done })
  const {io} = serverFixture({handleConnection: () => pending})
  const connectionHandler = io.on.mock.calls.find(([event]) => event === 'connection')[1]
  const socket = {on: jest.fn(), disconnected: false}
  const connecting = connectionHandler(socket)
  socket.disconnected = true
  resolve(true)
  await connecting
  expect(socket.on).not.toHaveBeenCalled()
})

describe('isolated loopback uploads', () => {
  let server, port, uploadDir, io, logger

  async function start({jsonOptions, ...options} = {}) {
    const express = require('express')
    const multer = require('multer')
    const http = require('http')
    const {registerUploadRoutes, uploadHeaders, createStaticUploadHeaders} = require('./uploads')
    uploadDir = path.join(root, 'uploads')
    fs.mkdirSync(uploadDir)
    io = {emit: jest.fn()}
    logger = {info: jest.fn(), error: jest.fn()}
    const app = express()
    if (jsonOptions) {
      app.use(express.json(jsonOptions))
      app.post('/json-probe', (req, res) => res.json({body: req.body, raw: req.rawBody.toString('hex'),
        isBuffer: Buffer.isBuffer(req.rawBody)}))
    }
    app.use('/uploads', uploadHeaders)
    app.use(express.static(root, {setHeaders: createStaticUploadHeaders(uploadDir)}))
    registerUploadRoutes({app, io, logger, upload: multer({dest: uploadDir}), ...options})
    server = http.createServer(app)
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    port = server.address().port
  }

  afterEach(async () => {
    if (server) {
      const closing = new Promise((resolve) => server.close(resolve))
      server.closeAllConnections()
      await closing
      server = null
    }
  })

  function httpRequest(url, {method = 'GET', headers = {}, body} = {}) {
    const http = require('http')
    return new Promise((resolve, reject) => {
      const req = http.request({host: '127.0.0.1', port, path: url, method, headers}, (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve({status: res.statusCode, headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8')}))
        res.on('error', reject)
      })
      req.setTimeout(2000, () => req.destroy(new Error('LOOPBACK_RESPONSE_TIMEOUT')))
      req.on('error', reject)
      req.end(body)
    })
  }

  function post(kind, {filename = 'sample.png', mime = 'image/png', field = 'file', content = 'fixture bytes'} = {}) {
    const boundary = 'chatdacs-test-boundary'
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--\r\n`
    return httpRequest(`/upload/${kind}`, {method: 'POST', headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': Buffer.byteLength(body),
    }, body})
  }

  test.each([
    ['image', 'photo.PNG', 'image/png', 'picture'],
    ['file', 'notes.txt', 'text/plain', 'file'],
    ['file', 'movie.mp4', 'video/mp4', 'video'],
    ['file', 'song.ogg', 'audio/ogg', 'audio'],
  ])('real multipart %s returns 201 JSON and saves %s without media broadcasts', async (kind, filename, mime, event) => {
    await start()
    const result = await post(kind, {filename, mime})
    expect(result.status).toBe(201)
    expect(result.headers['content-type']).toMatch(/application\/json/)
    const payload = JSON.parse(result.body)
    expect(payload).toEqual({code: 0, data: {src: expect.stringMatching(/^\/uploads\/[a-f0-9]+\./), name: filename}})
    expect(fs.readFileSync(path.join(root, payload.data.src), 'utf8')).toBe('fixture bytes')
    expect(io.emit).not.toHaveBeenCalled()
    expect(logger.info.mock.calls).toEqual([[kind === 'image' ? '用户上传图片' : '用户上传文件']])
    const fetched = await httpRequest(payload.data.src)
    expect(fetched.status).toBe(200)
    expect(fetched.headers['x-content-type-options']).toBe('nosniff')
    expect(fetched.headers['content-security-policy']).toContain('sandbox')
    if (event === 'file') expect(fetched.headers['content-disposition']).toBe('attachment')
    else expect(fetched.headers['content-disposition']).toBeUndefined()
  })

  test('real multipart payload returns a sanitized name rendered as only one safe file anchor', async () => {
    await start()
    const filename = 'safe][p onmouseover=window.__xss=1]hover.txt'
    const result = await post('file', {filename, mime: 'text/plain'})
    expect(result.status).toBe(201)
    const {src, name} = JSON.parse(result.body).data
    expect(name).toBe('safe__p onmouseover=window.__xss=1_hover.txt')
    expect(actualLayimParser()(`file(${src})[${name}]`)).toBe(
      `<a class="layui-layim-file" href="${src}" download target="_blank"><i class="layui-icon">&#xe61e;</i><cite>${name}</cite></a>`)
    expect(io.emit).not.toHaveBeenCalled()
  })

  test.each(['image', 'file'])('%s with no file ends with safe 400 and no broadcast', async (kind) => {
    await start()
    const result = await httpRequest(`/upload/${kind}`, {method: 'POST'})
    expect(result.status).toBe(400)
    expect(JSON.parse(result.body).code).toBe('UPLOAD_MISSING_FILE')
    expect(io.emit).not.toHaveBeenCalled()
  })

  test('unexpected multipart field ends with 400 instead of exposing multer error', async () => {
    await start()
    const result = await post('file', {field: 'PRIVATE_FIELD'})
    expect(result.status).toBe(400)
    expect(JSON.parse(result.body).code).toBe('UPLOAD_FAILED')
    expect(result.body).not.toContain('PRIVATE_FIELD')
    expect(io.emit).not.toHaveBeenCalled()
  })

  test.each([['script.svg', 'image/svg+xml'], ['script.html', 'text/html'], ['fake.png', 'image/svg+xml'],
    ['fake.svg', 'image/png'], ['script.xml', 'image/xml']])('image interface rejects executable %s and removes temp', async (filename, mime) => {
    await start()
    const result = await post('image', {filename, mime, content: '<script>PRIVATE_USER_PAYLOAD</script>'})
    expect(result.status).toBe(400)
    expect(JSON.parse(result.body).code).toBe('UPLOAD_IMAGE_INVALID')
    expect(result.body).not.toContain('PRIVATE_USER_PAYLOAD')
    expect(fs.readdirSync(uploadDir)).toEqual([])
    expect(io.emit).not.toHaveBeenCalled()
  })

  test.each([['page.html', 'text/html'], ['vector.svg', 'image/svg+xml'], ['code.js', 'application/javascript'],
    ['data.xml', 'text/xml']])('ordinary file %s remains downloadable but never inline active content', async (filename, mime) => {
    await start()
    const result = await post('file', {filename, mime, content: '<script>PRIVATE_USER_PAYLOAD</script>'})
    expect(result.status).toBe(201)
    const url = JSON.parse(result.body).data.src
    for (const downloadUrl of [url, url.replace('/uploads/', '/uploads%2f')]) {
      const fetched = await httpRequest(downloadUrl)
      expect(fetched.status).toBe(200)
      expect(fetched.headers['content-disposition']).toBe('attachment')
      expect(fetched.headers['content-type']).toBe('application/octet-stream')
      expect(fetched.headers['x-content-type-options']).toBe('nosniff')
      expect(fetched.headers['content-security-policy']).toContain("script-src 'none'")
    }
    expect(io.emit).not.toHaveBeenCalled()
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('PRIVATE_USER_PAYLOAD')
  })

  test('async rename rejection ends with safe 500, no event and no leaked temp', async () => {
    const rename = jest.fn().mockRejectedValue(new Error(`PRIVATE_STORAGE_ERROR ${root}`))
    await start({rename})
    const result = await post('file')
    expect(result.status).toBe(500)
    expect(JSON.parse(result.body).code).toBe('UPLOAD_FAILED')
    expect(result.body).not.toContain(root)
    expect(result.body).not.toContain('PRIVATE_STORAGE_ERROR')
    expect(fs.readdirSync(uploadDir)).toEqual([])
    expect(io.emit).not.toHaveBeenCalled()
    expect(logger.error.mock.calls).toEqual([['UPLOAD_SAVE_FAILED']])
  })

  test('configured multer size error returns 413 without changing production limits', async () => {
    const upload = {single: () => (req, res, next) => next({name: 'MulterError', code: 'LIMIT_FILE_SIZE', message: 'PRIVATE'})}
    await start({upload})
    const result = await post('file')
    expect(result.status).toBe(413)
    expect(JSON.parse(result.body).code).toBe('UPLOAD_TOO_LARGE')
    expect(result.body).not.toContain('PRIVATE')
  })

  test('unexpected receive failure is a safe 500 rather than an HTML error body', async () => {
    const upload = {single: () => () => { throw new Error(`PRIVATE_RECEIVE_ERROR ${root}`) }}
    await start({upload})
    const result = await post('file')
    expect(result.status).toBe(500)
    expect(JSON.parse(result.body).code).toBe('UPLOAD_FAILED')
    expect(result.body).not.toContain('PRIVATE_RECEIVE_ERROR')
    expect(result.body).not.toContain(root)
  })

  test('upload does not depend on the removed independent media publisher', async () => {
    await start()
    io.emit.mockImplementation(() => { throw new Error(`PRIVATE_PUBLISH_ERROR ${root}`) })
    const result = await post('file')
    expect(result.status).toBe(201)
    expect(JSON.parse(result.body).code).toBe(0)
    expect(result.body).not.toContain('PRIVATE_PUBLISH_ERROR')
    expect(fs.readdirSync(uploadDir)).toHaveLength(1)
    expect(io.emit).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  test('spoofing media MIME on an HTML extension still yields a file attachment', async () => {
    await start()
    const result = await post('file', {filename: 'page.html', mime: 'video/mp4'})
    expect(result.status).toBe(201)
    expect(io.emit).not.toHaveBeenCalled()
    const fetched = await httpRequest(JSON.parse(result.body).data.src)
    expect(fetched.headers['content-disposition']).toBe('attachment')
    expect(fetched.headers['content-type']).toBe('application/octet-stream')
  })

  test('server JSON verify preserves exact bytes in a separate Buffer without changing parsed body or default limits', async () => {
    const {express} = serverFixture()
    const options = express.json.mock.calls[0][0]
    expect(Object.keys(options)).toEqual(['verify'])
    const source = Buffer.from('{ "x": 1 }')
    const req = {body: {existing: true}}
    options.verify(req, {}, source)
    expect(Buffer.isBuffer(req.rawBody)).toBe(true)
    expect(req.rawBody).not.toBe(source)
    source.fill(0)
    expect(req.rawBody.toString()).toBe('{ "x": 1 }')
    expect(req.body).toEqual({existing: true})
    jest.resetModules()
    for (const name of ['express', 'http', 'multer']) jest.dontMock(name)
    await start({jsonOptions: options})
    const raw = Buffer.from(' { "message": "中文\\nline", "number" : 1 } \n', 'utf8')
    const result = await httpRequest('/json-probe', {method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': raw.length,
    }, body: raw})
    expect(result.status).toBe(200)
    expect(JSON.parse(result.body)).toEqual({body: JSON.parse(raw.toString('utf8')), raw: raw.toString('hex'), isBuffer: true})
    expect(logger.info).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })
})
