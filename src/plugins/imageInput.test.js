'use strict'

const sharp = require('sharp')
const {createImageInput} = require('./imageInput')

const CDN_URL = 'https://gchat.qpic.cn/test-image?token=not-a-real-secret'
const MiB = 1024 * 1024
let tinyPng

beforeAll(async () => {
  tinyPng = await sharp({create: {width: 2, height: 1, channels: 3, background: '#00ff00'}}).png().toBuffer()
})

function setup(overrides = {}) {
  const axios = {get: jest.fn().mockImplementation(async () => ({status: 200, headers: {}, data: tinyPng}))}
  const lookup = jest.fn((hostname, options, callback) => callback(null, [{address: '1.1.1.1', family: 4}]))
  const resolveImage = jest.fn()
  const options = {axios, lookup, resolveImage, ...overrides}
  return {...options, input: createImageInput(options)}
}

afterEach(() => jest.useRealTimers())

test('downloads an allowed CDN bitmap in memory and returns a metadata-free JPEG data URI', async () => {
  const bitmap = await sharp({create: {width: 1400, height: 700, channels: 3, background: '#00ff00'}})
    .png().withMetadata({orientation: 6}).toBuffer()
  const {input, axios, resolveImage} = setup()
  axios.get.mockResolvedValue({status: 200, headers: {}, data: bitmap})
  const result = await input.prepare([{url: CDN_URL}])
  expect(result).toHaveLength(1)
  expect(result[0]).toMatch(/^data:image\/jpeg;base64,/)
  const jpeg = Buffer.from(result[0].split(',')[1], 'base64')
  const metadata = await sharp(jpeg).metadata()
  expect(metadata).toMatchObject({format: 'jpeg', width: 512, height: 1024})
  expect(metadata.exif).toBeUndefined()
  expect(metadata.icc).toBeUndefined()
  expect(jpeg.length).toBeLessThanOrEqual(MiB)
  expect(resolveImage).not.toHaveBeenCalled()
  expect(axios.get).toHaveBeenCalledWith(CDN_URL, expect.objectContaining({
    responseType: 'arraybuffer', proxy: false, maxRedirects: 0, timeout: 5000,
    maxContentLength: 4 * MiB, signal: expect.any(AbortSignal),
  }))
})

test.each(['gchat.qpic.cn', 'c2cpicdw.qpic.cn', 'a.b.qpic.cn', 'multimedia.nt.qq.com',
  'multimedia.nt.qq.com.cn', 'GCHAT.QPIC.CN'])('accepts only the requested CDN host: %s', async (host) => {
  const {input, axios, resolveImage} = setup()
  await expect(input.prepare([{url: `https://${host}/download?fileid=opaque&rkey=example`, file: 'unused.image'}]))
    .resolves.toEqual([expect.stringMatching(/^data:image\/jpeg;base64,/)])
  expect(axios.get).toHaveBeenCalledTimes(1)
  expect(resolveImage).not.toHaveBeenCalled()
})

test.each(['http://gchat.qpic.cn/x', 'ftp://gchat.qpic.cn/x', 'file:///tmp/image.png', '/tmp/image.png',
  'C:\\images\\test.png', 'data:image/png;base64,AA==', '//gchat.qpic.cn/x', 'https://evil.example/x',
  'https://notqpic.cn/x', 'https://qpic.cn/x', 'https://gchat.qpic.cn.evil.example/x',
  'https://multimedia.nt.qq.com.cn.evil.example/x', 'https://evil.multimedia.nt.qq.com.cn/x',
  'https://qq.com/x', 'https://qq.com.cn/x', 'https://other.qq.com/x', 'https://gchat.qpic.cn:8443/x',
  'https://user:pass@gchat.qpic.cn/x', 'https://@gchat.qpic.cn/x', 'https://gchat.qpic.cn./x',
  'https://gchat..qpic.cn/x', 'https://-bad.qpic.cn/x', 'https://gchat.qpic.cn/x#fragment',
  'https://gchat.qpic.cn/x#', ' https://gchat.qpic.cn/x', 'https://gchat.qpic.cn/\nx',
  'https://gchat.qpic.cn\\@evil.example/x', 'https://127.0.0.1/x', 'https://[::1]/x', '', null, 1])(
  'rejects an existing invalid URL without resolver fallback: %p', async (url) => {
    const {input, axios, resolveImage} = setup()
    await expect(input.prepare([{url, file: 'valid.image'}])).rejects.toMatchObject({code: 'IMAGE_INPUT_INVALID'})
    expect(resolveImage).not.toHaveBeenCalled()
    expect(axios.get).not.toHaveBeenCalled()
  })

test.each([undefined, null, {}, 'images', new Array(1), [null], [[]], [{}], [{url: undefined}],
  Array.from({length: 4}, () => ({url: CDN_URL}))].map((images) => [images]))(
  'rejects malformed or oversized lists before any side effect: %p', async (images) => {
    const {input, axios, resolveImage} = setup()
    await expect(input.prepare(images)).rejects.toMatchObject({code: 'IMAGE_INPUT_INVALID'})
    expect(axios.get).not.toHaveBeenCalled()
    expect(resolveImage).not.toHaveBeenCalled()
  })

test('empty lists are a no-op; three inputs preserve order and do not mutate caller data', async () => {
  const {input, axios} = setup()
  await expect(input.prepare([])).resolves.toEqual([])
  expect(axios.get).not.toHaveBeenCalled()
  const images = Object.freeze([1, 2, 3].map((id) => Object.freeze({url: `${CDN_URL}&id=${id}`, file: 'unused'})))
  await expect(input.prepare(images)).resolves.toHaveLength(3)
  expect(axios.get.mock.calls.map(([url]) => url)).toEqual(images.map((image) => image.url))
})

test('validates the whole list before contacting a resolver or CDN', async () => {
  const {input, axios, resolveImage} = setup()
  await expect(input.prepare([{file: 'opaque.image'}, {url: 'https://evil.example/image'}]))
    .rejects.toMatchObject({code: 'IMAGE_INPUT_INVALID'})
  expect(resolveImage).not.toHaveBeenCalled()
  expect(axios.get).not.toHaveBeenCalled()
})

test.each(['opaque-File_123.image', 'a'.repeat(256)])('resolves only opaque IDs and downloads only the returned CDN URL: %s', async (file) => {
  const {input, axios, resolveImage} = setup()
  resolveImage.mockResolvedValue({url: CDN_URL, file: 'ignored-local-path'})
  await expect(input.prepare([{file}])).resolves.toHaveLength(1)
  expect(resolveImage).toHaveBeenCalledWith(file)
  expect(axios.get.mock.calls[0][0]).toBe(CDN_URL)
})

test.each(['https://evil.example/image', 'https://gchat.qpic.cn/image', 'file:///tmp/image',
  '/tmp/image', '../image', 'a/b', 'a\\b', 'C:\\image', '', '.', '..', 'a'.repeat(257), 'a b', null, 123])(
  'never passes a path or URL to the resolver: %p', async (file) => {
    const {input, axios, resolveImage} = setup()
    await expect(input.prepare([{file}])).rejects.toMatchObject({code: 'IMAGE_INPUT_INVALID'})
    expect(resolveImage).not.toHaveBeenCalled()
    expect(axios.get).not.toHaveBeenCalled()
  })

test.each([null, {}, {file: '/tmp/local'}, {url: 'http://gchat.qpic.cn/x'}, {url: 'https://evil.example/x'}])(
  'rejects invalid resolver responses instead of reading files or following arbitrary URLs: %p', async (result) => {
    const {input, axios, resolveImage} = setup()
    resolveImage.mockResolvedValue(result)
    await expect(input.prepare([{file: 'opaque.image'}])).rejects.toMatchObject({code: 'IMAGE_INPUT_INVALID'})
    expect(axios.get).not.toHaveBeenCalled()
  })

test('a file-only input requires the optional resolver', async () => {
  const {input, axios} = setup({resolveImage: undefined})
  await expect(input.prepare([{file: 'opaque.image'}])).rejects.toMatchObject({code: 'IMAGE_INPUT_INVALID'})
  expect(axios.get).not.toHaveBeenCalled()
})

test('snapshots input fields once and does not use an overridden array iterator', async () => {
  let reads = 0
  const images = [{get url() { return ++reads === 1 ? CDN_URL : 'https://evil.example/image' }}]
  images[Symbol.iterator] = () => { throw new Error('custom iterator') }
  const {input, axios} = setup()
  await expect(input.prepare(images)).resolves.toHaveLength(1)
  expect(axios.get.mock.calls[0][0]).toBe(CDN_URL)
  expect(reads).toBe(1)
})

function useDnsTransport(axios, options = {all: true}) {
  axios.get.mockImplementation((url, config) => new Promise((resolve, reject) => {
    config.httpsAgent.options.lookup(new URL(url).hostname, options, (error, addresses, family) => {
      if (error) reject(error)
      else resolve({status: 200, headers: {}, data: tinyPng, addresses, family})
    })
  }))
}

test.each(['1.1.1.1', '8.8.8.8', '101.226.4.6', '2606:4700:4700::1111', '240e:ff:e02c:1::1'])(
  'connect-time DNS accepts a public IP without a second unvalidated lookup: %s', async (address) => {
    const family = address.includes(':') ? 6 : 4
    const {input, axios, lookup} = setup()
    lookup.mockImplementation((host, options, callback) => callback(null, [{address, family}]))
    useDnsTransport(axios)
    await expect(input.prepare([{url: CDN_URL}])).resolves.toHaveLength(1)
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(lookup).toHaveBeenCalledWith('gchat.qpic.cn', expect.objectContaining({all: true}), expect.any(Function))
    const agent = axios.get.mock.calls[0][1].httpsAgent
    expect(agent.options).toMatchObject({keepAlive: false, maxCachedSessions: 0})
  })

test.each(['0.0.0.0', '0.1.2.3', '10.0.0.1', '100.64.0.1', '100.127.255.255', '127.0.0.1',
  '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.0.0.1', '192.0.2.1', '192.88.99.1',
  '192.168.1.1', '198.18.0.1', '198.19.255.255', '198.51.100.1', '203.0.113.1', '224.0.0.1',
  '239.255.255.255', '240.0.0.1', '255.255.255.255', '::', '::1', '::ffff:127.0.0.1',
  '::ffff:192.168.1.1', '::ffff:a00:1', '::ffff:8.8.8.8', '::127.0.0.1', '64:ff9b::7f00:1',
  '64:ff9b:1::1', '100::1', '2001::1', '2001:2::1', '2001:10::1', '2001:20::1', '2001:db8::1',
  '2002:7f00:1::1', '3fff::1', 'fc00::1', 'fd00::1', 'fe80::1', 'ff02::1',
  '240e::1%eth0', '127.1', '0x7f000001', 'not-an-address'])(
  'connect-time DNS rejects non-public, mapped and ambiguous addresses: %s', async (address) => {
    const {input, axios, lookup} = setup()
    lookup.mockImplementation((host, options, callback) => callback(null, [{address, family: address.includes(':') ? 6 : 4}]))
    useDnsTransport(axios)
    await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
  })

test.each([[], [{address: '1.1.1.1', family: 6}], [{address: '::1', family: 4}], [null],
  [{address: '1.1.1.1', family: 4}, {address: '10.0.0.1', family: 4}]].map((records) => [records]))(
  'rejects empty, malformed or mixed public/private DNS answers: %p', async (records) => {
    const {input, axios, lookup} = setup()
    lookup.mockImplementation((host, options, callback) => callback(null, records))
    useDnsTransport(axios)
    await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
  })

test.each([{}, {all: false, family: 4}, 4])('implements the Node single-address lookup contract: %p', async (options) => {
  const {input, axios} = setup()
  let result
  axios.get.mockImplementation((url, config) => new Promise((resolve, reject) => {
    config.httpsAgent.options.lookup('gchat.qpic.cn', options, (error, address, family) => {
      result = {address, family}
      if (error) reject(error)
      else resolve({status: 200, headers: {}, data: tinyPng})
    })
  }))
  await expect(input.prepare([{url: CDN_URL}])).resolves.toHaveLength(1)
  expect(result).toEqual({address: '1.1.1.1', family: 4})
})

test('a later connection is revalidated and cannot reuse a prior public DNS decision', async () => {
  const {input, axios, lookup} = setup()
  lookup.mockImplementationOnce((host, options, callback) => callback(null, [{address: '1.1.1.1', family: 4}]))
    .mockImplementationOnce((host, options, callback) => callback(null, [{address: '127.0.0.1', family: 4}]))
  useDnsTransport(axios)
  await expect(input.prepare([{url: CDN_URL}])).resolves.toHaveLength(1)
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
  expect(lookup).toHaveBeenCalledTimes(2)
  expect(axios.get.mock.calls[0][1].httpsAgent).not.toBe(axios.get.mock.calls[1][1].httpsAgent)
})

test('the HTTPS lookup refuses an unexpected hostname before asking DNS', async () => {
  const {input, axios, lookup} = setup()
  axios.get.mockImplementation((url, config) => new Promise((resolve, reject) => {
    config.httpsAgent.options.lookup('evil.example', {}, (error) => reject(error))
  }))
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
  expect(lookup).not.toHaveBeenCalled()
})

function fakeDecoder(metadata = {format: 'png', width: 2, height: 1}, output = Buffer.from('encoded-jpeg')) {
  const pipeline = {
    metadata: jest.fn().mockResolvedValue(metadata), toBuffer: jest.fn().mockResolvedValue(output),
    rotate: jest.fn(), resize: jest.fn(), jpeg: jest.fn(), timeout: jest.fn(), destroy: jest.fn(),
  }
  for (const method of ['rotate', 'resize', 'jpeg', 'timeout']) pipeline[method].mockReturnValue(pipeline)
  return {sharp: jest.fn(() => pipeline), pipeline}
}

test.each([4 * MiB + 1, 9 * MiB])('rejects a downloaded body over 4 MiB before decoding: %s bytes', async (size) => {
  const decoder = fakeDecoder()
  const {input, axios} = setup(decoder)
  axios.get.mockResolvedValue({status: 200, headers: {}, data: Buffer.alloc(size)})
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_TOO_LARGE'})
  expect(decoder.sharp).not.toHaveBeenCalled()
})

test('enforces the remaining 8 MiB budget in the next transport request and rejects excess before decode', async () => {
  const decoder = fakeDecoder()
  const {input, axios} = setup(decoder)
  const padded = Buffer.concat([tinyPng, Buffer.alloc(3 * MiB - tinyPng.length)])
  axios.get.mockResolvedValue({status: 200, headers: {}, data: padded})
  await expect(input.prepare([{url: CDN_URL}, {url: CDN_URL}, {url: CDN_URL}]))
    .rejects.toMatchObject({code: 'IMAGE_TOO_LARGE'})
  expect(axios.get.mock.calls.map(([, options]) => options.maxContentLength)).toEqual([4 * MiB, 4 * MiB, 2 * MiB])
  expect(decoder.sharp).toHaveBeenCalledTimes(2)
})

test('accepts exactly 4 MiB per image and 8 MiB total, with no budget shared across calls', async () => {
  const decoder = fakeDecoder()
  const {input, axios} = setup(decoder)
  const data = Buffer.concat([tinyPng, Buffer.alloc(4 * MiB - tinyPng.length)])
  axios.get.mockResolvedValue({status: 200, headers: {}, data})
  await expect(input.prepare([{url: CDN_URL}, {url: CDN_URL}])).resolves.toHaveLength(2)
  await expect(input.prepare([{url: CDN_URL}])).resolves.toHaveLength(1)
})

test('rejects an oversized declared Content-Length even if a fake transport returns a small body', async () => {
  const {input, axios} = setup()
  axios.get.mockResolvedValue({status: 200, headers: {'content-length': String(4 * MiB + 1)}, data: tinyPng})
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_TOO_LARGE'})
})

test.each([undefined, null, '', 'not bytes', {}, [], Buffer.alloc(0)])('rejects a non-binary or empty body: %p', async (data) => {
  const {input, axios} = setup()
  axios.get.mockResolvedValue({status: 200, headers: {}, data})
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_FORMAT_UNSUPPORTED'})
})

test('accepts an ArrayBuffer returned by an injected transport', async () => {
  const {input, axios} = setup()
  axios.get.mockResolvedValue({status: 200, data: Uint8Array.from(tinyPng).buffer})
  await expect(input.prepare([{url: CDN_URL}])).resolves.toHaveLength(1)
})

test.each(['jpeg', 'png', 'webp'])('decodes a real %s bitmap regardless of URL extension or MIME claims', async (format) => {
  const data = await sharp(tinyPng).toFormat(format).toBuffer()
  const {input, axios} = setup()
  axios.get.mockResolvedValue({status: 200, headers: {'content-type': 'text/plain'}, data})
  const [result] = await input.prepare([{url: `${CDN_URL}&filename=unknown.bin`}])
  const metadata = await sharp(Buffer.from(result.split(',')[1], 'base64')).metadata()
  expect(metadata).toMatchObject({format: 'jpeg', width: 2, height: 1})
})

test.each([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
  Buffer.from('GIF89a'), Buffer.from('II*\x00'), Buffer.from('private chat or HTML'),
  Buffer.from([0xff, 0xd8, 0xff, 0x00])])('rejects unsupported or corrupt input without leaking decoder diagnostics: %p', async (data) => {
  const {input, axios} = setup()
  axios.get.mockResolvedValue({status: 200, headers: {'content-type': 'image/jpeg'}, data})
  const error = await input.prepare([{url: CDN_URL}]).catch((error) => error)
  expect(error).toMatchObject({code: 'IMAGE_FORMAT_UNSUPPORTED', message: 'IMAGE_FORMAT_UNSUPPORTED'})
  expect(Object.keys(error)).toEqual(['code'])
  expect(error.cause).toBeUndefined()
})

test('rejects unsupported formats before invoking any decoder', async () => {
  const decoder = fakeDecoder()
  const {input, axios} = setup(decoder)
  axios.get.mockResolvedValue({status: 200, data: Buffer.from('<svg/>')})
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_FORMAT_UNSUPPORTED'})
  expect(decoder.sharp).not.toHaveBeenCalled()
})

test('rejects a real decompression bomb above 20 MP without relying on compressed byte size', async () => {
  const data = await sharp({create: {width: 5000, height: 4001, channels: 3, background: 'green'}}).png().toBuffer()
  const {input, axios} = setup()
  axios.get.mockResolvedValue({status: 200, data})
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_TOO_LARGE'})
})

test.each([[{format: 'png', width: 5000, height: 4000}, null],
  [{format: 'png', width: 5000, height: 4001}, 'IMAGE_TOO_LARGE'],
  [{format: 'svg', width: 2, height: 1}, 'IMAGE_FORMAT_UNSUPPORTED'],
  [{format: 'png', width: 0, height: 1}, 'IMAGE_FORMAT_UNSUPPORTED']])(
  'checks decoded metadata and the 20 MP boundary: %p', async (metadata, expected) => {
    const decoder = fakeDecoder(metadata)
    const {input} = setup(decoder)
    if (expected) await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: expected})
    else await expect(input.prepare([{url: CDN_URL}])).resolves.toHaveLength(1)
    expect(decoder.sharp).toHaveBeenCalledWith(tinyPng, expect.objectContaining({limitInputPixels: 20000000, pages: 1}))
  })

test.each([[MiB, null], [MiB + 1, 'IMAGE_TOO_LARGE']])('enforces the JPEG output byte boundary: %s', async (bytes, expected) => {
  const decoder = fakeDecoder(undefined, Buffer.alloc(bytes))
  const {input} = setup(decoder)
  if (expected) await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: expected})
  else {
    const [uri] = await input.prepare([{url: CDN_URL}])
    expect(Buffer.from(uri.split(',')[1], 'base64')).toHaveLength(MiB)
  }
})

test.each([301, 302, 307, 308, 400, 500])('does not accept a redirect or failed HTTP response: %s', async (status) => {
  const {input, axios} = setup()
  axios.get.mockResolvedValue({status, headers: {location: 'https://evil.example/x'}, data: tinyPng})
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
  expect(axios.get).toHaveBeenCalledTimes(1)
})

test.each(['axios', 'resolver', 'lookup', 'sharp'])('sanitizes %s failure without URL, chat, response, config or cause', async (stage) => {
  const original = Object.assign(new Error(`private-chat ${CDN_URL}`), {config: {url: CDN_URL}, response: {data: 'private-chat'}})
  const decoder = fakeDecoder()
  const {input, axios, resolveImage, lookup} = setup(decoder)
  let images = [{url: CDN_URL}]
  if (stage === 'axios') axios.get.mockRejectedValue(original)
  if (stage === 'resolver') { resolveImage.mockRejectedValue(original); images = [{file: 'opaque.image'}] }
  if (stage === 'lookup') { useDnsTransport(axios); lookup.mockImplementation((host, options, callback) => callback(original)) }
  if (stage === 'sharp') decoder.pipeline.toBuffer.mockRejectedValue(original)
  const expected = stage === 'sharp' ? 'IMAGE_FORMAT_UNSUPPORTED' : 'IMAGE_DOWNLOAD_FAILED'
  const error = await input.prepare(images).catch((error) => error)
  expect(error).toMatchObject({code: expected, message: expected})
  expect(Object.keys(error)).toEqual(['code'])
  expect(error.cause).toBeUndefined()
  expect(error.stack).not.toContain('private-chat')
  expect(error.stack).not.toContain('qpic.cn')
})

test('maps Axios maxContentLength failures to the fixed size error', async () => {
  const {input, axios} = setup()
  axios.get.mockRejectedValue(Object.assign(new Error('maxContentLength size of 4194304 exceeded'), {code: 'ERR_BAD_RESPONSE'}))
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_TOO_LARGE'})
})

test('CDN requests explicitly remove inherited API credentials and disable proxies', async () => {
  const {input, axios} = setup()
  await input.prepare([{url: CDN_URL}])
  expect(axios.get.mock.calls[0][1]).toMatchObject({
    auth: null, proxy: false, headers: null,
  })
})

test('real Axios merging cannot forward any inherited credential header, basic auth or query params', async () => {
  let sent
  const axios = require('axios').create({
    auth: {username: 'not-real', password: 'private-password'}, params: {token: 'private-query'},
    headers: {common: {aUtHoRiZaTiOn: 'private-bearer', cOoKiE: 'private-cookie'}, get: {'pRoXy-AuThOrIzAtIoN': 'private-proxy'}},
    adapter: async (config) => { sent = config; return {status: 200, data: tinyPng, headers: {}, config} },
  })
  await createImageInput({axios}).prepare([{url: CDN_URL}])
  expect(sent.auth).toBeNull()
  expect(sent.params).toBeNull()
  expect(Object.keys(sent.headers).map((name) => name.toLowerCase()))
    .not.toEqual(expect.arrayContaining(['authorization', 'cookie', 'proxy-authorization']))
  expect(JSON.stringify(sent.headers)).not.toContain('private-')
  expect(axios.defaults.headers.common.aUtHoRiZaTiOn).toBe('private-bearer')
})

test.each([undefined, null, NaN, 0, 199, 300, '200', {}, 200.5])('rejects malformed or non-2xx status: %p', async (status) => {
  const {input, axios} = setup()
  axios.get.mockResolvedValue({status, data: tinyPng})
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
})

test.each(['-1', 'invalid', '12.5', '', ['20'], '9007199254740992'])('rejects malformed Content-Length: %p', async (length) => {
  const {input, axios} = setup()
  axios.get.mockResolvedValue({status: 200, headers: {'content-length': length}, data: tinyPng})
  await expect(input.prepare([{url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
})

test.each(['resolver', 'lookup', 'axios', 'metadata', 'encode'])('a 5-second total deadline closes a permanently pending %s', async (stage) => {
  jest.useFakeTimers()
  const decoder = fakeDecoder()
  const {input, axios, resolveImage, lookup} = setup(decoder)
  let images = [{url: CDN_URL}, {url: CDN_URL}]
  if (stage === 'resolver') { images = [{file: 'opaque.image'}]; resolveImage.mockReturnValue(new Promise(() => {})) }
  if (stage === 'lookup') { useDnsTransport(axios); lookup.mockImplementation(() => {}) }
  if (stage === 'axios') axios.get.mockReturnValue(new Promise(() => {}))
  if (stage === 'metadata') decoder.pipeline.metadata.mockReturnValue(new Promise(() => {}))
  if (stage === 'encode') decoder.pipeline.toBuffer.mockReturnValue(new Promise(() => {}))
  const assertion = expect(input.prepare(images)).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED', message: 'IMAGE_DOWNLOAD_FAILED'})
  await jest.advanceTimersByTimeAsync(4999)
  const request = axios.get.mock.calls[0]?.[1]
  if (request) expect(request.signal.aborted).toBe(false)
  await jest.advanceTimersByTimeAsync(1)
  await assertion
  if (request) expect(request.signal.aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
  expect(axios.get.mock.calls.length).toBeLessThanOrEqual(1)
  if (stage === 'metadata' || stage === 'encode') expect(decoder.pipeline.destroy).toHaveBeenCalled()
})

test('resolver and download share a single deadline rather than receiving five seconds each', async () => {
  jest.useFakeTimers()
  const {input, axios, resolveImage} = setup()
  let finishResolver
  resolveImage.mockReturnValue(new Promise((resolve) => { finishResolver = resolve }))
  axios.get.mockReturnValue(new Promise(() => {}))
  const assertion = expect(input.prepare([{file: 'opaque.image'}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
  await jest.advanceTimersByTimeAsync(4000)
  finishResolver({url: CDN_URL})
  await jest.advanceTimersByTimeAsync(0)
  expect(axios.get).toHaveBeenCalledTimes(1)
  await jest.advanceTimersByTimeAsync(1000)
  await assertion
  expect(axios.get.mock.calls[0][1].signal.aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
})

test('late resolver completion after a timeout never starts a CDN request', async () => {
  jest.useFakeTimers()
  const {input, axios, resolveImage} = setup()
  let finishResolver
  resolveImage.mockReturnValue(new Promise((resolve) => { finishResolver = resolve }))
  const assertion = expect(input.prepare([{file: 'opaque.image'}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
  await jest.advanceTimersByTimeAsync(5000)
  await assertion
  finishResolver({url: CDN_URL})
  await jest.advanceTimersByTimeAsync(0)
  expect(axios.get).not.toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})

test('late axios completion after a timeout neither decodes nor downloads subsequent images', async () => {
  jest.useFakeTimers()
  const decoder = fakeDecoder()
  const {input, axios} = setup(decoder)
  let finishDownload
  axios.get.mockReturnValue(new Promise((resolve) => { finishDownload = resolve }))
  const assertion = expect(input.prepare([{url: CDN_URL}, {url: CDN_URL}])).rejects.toMatchObject({code: 'IMAGE_DOWNLOAD_FAILED'})
  await jest.advanceTimersByTimeAsync(5000)
  await assertion
  finishDownload({status: 200, data: tinyPng})
  await jest.advanceTimersByTimeAsync(0)
  expect(axios.get).toHaveBeenCalledTimes(1)
  expect(decoder.sharp).not.toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})

test.each(['success', 'download-failure', 'decode-failure', 'sync-failure'])('clears all timers on %s and always destroys the agent', async (mode) => {
  jest.useFakeTimers()
  const decoder = fakeDecoder()
  const {input, axios} = setup(decoder)
  let destroy
  axios.get.mockImplementation((url, options) => {
    destroy = jest.spyOn(options.httpsAgent, 'destroy')
    if (mode === 'download-failure') return Promise.reject(new Error('private transport error'))
    if (mode === 'sync-failure') throw new Error('private synchronous transport error')
    return Promise.resolve({status: 200, data: tinyPng})
  })
  if (mode === 'decode-failure') decoder.pipeline.toBuffer.mockRejectedValue(new Error('private decoder error'))
  await input.prepare([{url: CDN_URL}]).catch(() => {})
  expect(jest.getTimerCount()).toBe(0)
  expect(destroy).toHaveBeenCalled()
  if (mode === 'success') expect(decoder.pipeline.timeout).toHaveBeenCalledWith({seconds: 5})
})
