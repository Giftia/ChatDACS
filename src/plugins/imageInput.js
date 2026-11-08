'use strict'

const defaultSharp = require('sharp')
const dns = require('node:dns')
const https = require('node:https')
const {BlockList, isIP} = require('node:net')

const MiB = 1024 * 1024
const fail = (code) => Object.assign(new Error(code), {code})
const blocked = new BlockList()
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) {
  blocked.addSubnet(address, prefix, 'ipv4')
}
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) {
  blocked.addSubnet(address, prefix, 'ipv6')
}
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')

function publicAddress(address, family) {
  if (typeof address !== 'string' || address.includes('%') || ![4, 6].includes(family) || isIP(address) !== family) return false
  if (family === 4) return !blocked.check(address, 'ipv4')
  // Only global unicast, excluding special assignments and all IPv4 transition/mapped forms.
  return globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
}

function bitmapFormat(data) {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpeg'
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png'
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  throw fail('IMAGE_FORMAT_UNSUPPORTED')
}

function cdnUrl(raw) {
  try {
    if (typeof raw !== 'string' || !/^https:\/\//i.test(raw) || /[\s\x00-\x1f\x7f\\]/.test(raw)) throw new Error()
    const url = new URL(raw)
    const host = url.hostname
    if (url.protocol !== 'https:' || url.port || url.username || url.password || raw.includes('#') ||
        raw.slice(raw.indexOf('//') + 2).split('/')[0].includes('@') || host.length > 253 ||
        !host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
        !(host.endsWith('.qpic.cn') || host === 'multimedia.nt.qq.com' || host === 'multimedia.nt.qq.com.cn')) {
      throw new Error()
    }
    return url.href
  } catch {
    throw fail('IMAGE_INPUT_INVALID')
  }
}

function createImageInput({axios, resolveImage, sharp = defaultSharp, lookup = dns.lookup} = {}) {
  if (!axios || typeof axios.get !== 'function' || typeof sharp !== 'function' || typeof lookup !== 'function') {
    throw fail('IMAGE_INPUT_INVALID')
  }

  function connectionLookup(expectedHost, signal) {
    return (hostname, options, callback) => {
      if (typeof options === 'function') { callback = options; options = {} }
      const settings = typeof options === 'number' ? {family: options} : (options || {})
      let settled = false
      const done = (...args) => {
        if (settled) return
        settled = true
        callback(...args)
      }
      if (signal.aborted || hostname !== expectedHost) return done(fail('IMAGE_DOWNLOAD_FAILED'))
      try {
        // Validate every answer at connection time and return those exact addresses to TLS.
        lookup(hostname, {...settings, all: true}, (error, records) => {
          let addresses
          try {
            if (signal.aborted || error || !Array.isArray(records) || !records.length) throw new Error()
            addresses = records.map((record) => {
              const {address, family} = record
              if (!publicAddress(address, family)) throw new Error()
              return {address, family}
            })
          } catch {
            return done(fail('IMAGE_DOWNLOAD_FAILED'))
          }
          if (settings.all) done(null, addresses)
          else done(null, addresses[0].address, addresses[0].family)
        })
      } catch {
        done(fail('IMAGE_DOWNLOAD_FAILED'))
      }
    }
  }

  async function prepare(images) {
    let sources
    try {
      if (!Array.isArray(images) || images.length > 3) throw new Error()
      sources = []
      const length = images.length
      for (let index = 0; index < length; index++) {
        const image = images[index]
        if (!image || typeof image !== 'object' || Array.isArray(image)) throw new Error()
        const {url} = image
        if (url !== undefined) sources.push({url: cdnUrl(url)})
        else {
          const {file} = image
          if (typeof file !== 'string' || !/^[A-Za-z0-9._-]{1,256}$/.test(file) ||
              file === '.' || file === '..' || typeof resolveImage !== 'function') throw new Error()
          sources.push({file})
        }
      }
    } catch {
      throw fail('IMAGE_INPUT_INVALID')
    }
    if (!sources.length) return []
    const controller = new AbortController()
    let activeAgent
    let activePipeline
    let timer
    const checkActive = () => { if (controller.signal.aborted) throw fail('IMAGE_DOWNLOAD_FAILED') }

    async function processImages() {
      const output = []
      let totalBytes = 0
      for (const image of sources) {
        checkActive()
        let url = image.url
        if (url === undefined) {
          let resolved
          try { resolved = await resolveImage(image.file) } catch { throw fail('IMAGE_DOWNLOAD_FAILED') }
          checkActive()
          url = cdnUrl(resolved?.url)
        }
        const maxBytes = Math.min(4 * MiB, 8 * MiB - totalBytes)
        if (maxBytes === 0) throw fail('IMAGE_TOO_LARGE')
        activeAgent = new https.Agent({lookup: connectionLookup(new URL(url).hostname, controller.signal), keepAlive: false, maxCachedSessions: 0})
        let response
        try {
          response = await axios.get(url, {
            responseType: 'arraybuffer', proxy: false, maxRedirects: 0, httpsAgent: activeAgent,
            headers: null, auth: null, params: null, socketPath: null,
            maxContentLength: maxBytes, timeout: 5000, signal: controller.signal,
          })
        } catch (error) {
          const oversized = error?.code === 'ERR_BAD_RESPONSE' && /^maxContentLength size of \d+ exceeded$/.test(error.message)
          throw fail(oversized ? 'IMAGE_TOO_LARGE' : 'IMAGE_DOWNLOAD_FAILED')
        } finally {
          activeAgent.destroy()
          activeAgent = undefined
        }
        checkActive()
        if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status >= 300) {
          throw fail('IMAGE_DOWNLOAD_FAILED')
        }
        const contentLength = response.headers?.['content-length']
        if (contentLength !== undefined) {
          if (!['string', 'number'].includes(typeof contentLength) || !/^\d+$/.test(String(contentLength)) ||
              !Number.isSafeInteger(Number(contentLength))) throw fail('IMAGE_DOWNLOAD_FAILED')
          if (Number(contentLength) > maxBytes) throw fail('IMAGE_TOO_LARGE')
        }
        let data = response.data
        if (data instanceof ArrayBuffer) data = Buffer.from(data)
        else if (data instanceof Uint8Array) data = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
        if (!Buffer.isBuffer(data) || !data.length) throw fail('IMAGE_FORMAT_UNSUPPORTED')
        if (data.length > maxBytes) throw fail('IMAGE_TOO_LARGE')
        totalBytes += data.length
        const format = bitmapFormat(data)
        let metadata
        let jpeg
        try {
          activePipeline = sharp(data, {limitInputPixels: 20000000, failOn: 'warning', pages: 1}).timeout({seconds: 5})
          metadata = await activePipeline.metadata()
          checkActive()
          if (!metadata || metadata.format !== format || !Number.isSafeInteger(metadata.width) ||
              !Number.isSafeInteger(metadata.height) || metadata.width < 1 || metadata.height < 1) throw new Error()
        } catch (error) {
          throw fail(error?.message === 'Input image exceeds pixel limit' ? 'IMAGE_TOO_LARGE' : 'IMAGE_FORMAT_UNSUPPORTED')
        }
        if (metadata.width * metadata.height > 20000000) throw fail('IMAGE_TOO_LARGE')
        try {
          jpeg = await activePipeline.rotate().resize({width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true})
            .jpeg({quality: 80}).toBuffer()
        } catch {
          throw fail('IMAGE_FORMAT_UNSUPPORTED')
        }
        checkActive()
        activePipeline.destroy()
        activePipeline = undefined
        if (!Buffer.isBuffer(jpeg) || !jpeg.length) throw fail('IMAGE_FORMAT_UNSUPPORTED')
        if (jpeg.length > MiB) throw fail('IMAGE_TOO_LARGE')
        output.push(`data:image/jpeg;base64,${jpeg.toString('base64')}`)
      }
      return output
    }

    try {
      // Bound the entire batch, even if a resolver/transport ignores cancellation.
      const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(fail('IMAGE_DOWNLOAD_FAILED'))
        }, 5000)
      })
      return await Promise.race([processImages(), deadline])
    } catch (error) {
      const code = !controller.signal.aborted && ['IMAGE_INPUT_INVALID', 'IMAGE_TOO_LARGE',
        'IMAGE_FORMAT_UNSUPPORTED', 'IMAGE_DOWNLOAD_FAILED'].includes(error?.code) ? error.code : 'IMAGE_DOWNLOAD_FAILED'
      throw fail(code)
    } finally {
      clearTimeout(timer)
      activeAgent?.destroy()
      activePipeline?.destroy()
    }
  }

  return {prepare}
}

module.exports = {createImageInput}
