'use strict'

const fs = require('fs')
const path = require('path')
const {safeDisplayName} = require('../../static/uploadMedia')

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.ico'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogv'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'])

function extension(fileName) {
  const ext = path.extname(fileName)
  return /^\.[a-z0-9]{1,16}$/i.test(ext) ? ext : ''
}

function setUploadHeaders(res, fileName) {
  const ext = path.extname(fileName).toLowerCase()
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "sandbox; script-src 'none'; object-src 'none'; base-uri 'none'")
  if (!IMAGE_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext) && !AUDIO_EXTENSIONS.has(ext)) {
    res.setHeader('Content-Disposition', 'attachment')
    res.setHeader('Content-Type', 'application/octet-stream')
  }
}

function uploadHeaders(req, res, next) {
  setUploadHeaders(res, req.path)
  next()
}

// Also check the resolved file to cover encoded slashes and alternate URL spellings.
function createStaticUploadHeaders(uploadDir = 'static/uploads') {
  const directory = path.resolve(uploadDir)
  return function staticUploadHeaders(res, fileName) {
    const relative = path.relative(directory, path.resolve(fileName))
    if (relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) {
      setUploadHeaders(res, fileName)
    }
  }
}

function replyError(res, status, code) {
  return res.status(status).json({code, msg: code})
}

function registerUploadRoutes({app, upload, logger, rename = fs.promises.rename, remove = fs.promises.unlink}) {
  const receive = upload.single('file')
  function receiveFile(req, res, next) {
    function done(error) {
      if (!error) return next()
      const limited = error.code === 'LIMIT_FILE_SIZE'
      const invalid = error.name === 'MulterError' || /^LIMIT_/.test(error.code || '')
      return replyError(res, limited ? 413 : invalid ? 400 : 500, limited ? 'UPLOAD_TOO_LARGE' : 'UPLOAD_FAILED')
    }
    try { receive(req, res, done) } catch (error) { done(error) }
  }

  async function discard(filePath) {
    try { await remove(filePath) } catch { logger.error('UPLOAD_CLEANUP_FAILED') }
  }

  for (const kind of ['image', 'file']) {
    app.post(`/upload/${kind}`, receiveFile, async (req, res) => {
      if (!req.file) return replyError(res, 400, 'UPLOAD_MISSING_FILE')
      const file = req.file
      const displayName = safeDisplayName(file.originalname)
      const ext = extension(file.originalname)
      const lowerExt = ext.toLowerCase()
      if (kind === 'image' && (!IMAGE_EXTENSIONS.has(lowerExt) ||
          !/^image\//i.test(file.mimetype) || /svg|xml|html/i.test(file.mimetype))) {
        await discard(file.path)
        return replyError(res, 400, 'UPLOAD_IMAGE_INVALID')
      }
      const storedPath = file.path + ext
      const url = `/uploads/${file.filename}${ext}`
      try {
        await rename(file.path, storedPath)
      } catch {
        await discard(file.path)
        logger.error('UPLOAD_SAVE_FAILED')
        return replyError(res, 500, 'UPLOAD_FAILED')
      }
      logger.info(kind === 'image' ? '用户上传图片' : '用户上传文件')
      return res.status(201).json({code: 0, data: {src: url, name: displayName}})
    })
  }
}

module.exports = {registerUploadRoutes, uploadHeaders, createStaticUploadHeaders}
