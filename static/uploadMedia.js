'use strict'

;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.ChatDacsUploadMedia = factory()
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const FILE = /file\((\/uploads\/[a-f0-9]{32}(?:\.[a-zA-Z0-9]{1,16})?)\)\[([^\[\]()<>"'&@\\/\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+)\]/gu
  const IMAGE = /img\[(\/uploads\/[a-f0-9]{32}\.[a-zA-Z0-9]{1,16})\]/gu
  const IMAGE_EXTENSION = /\.(?:png|jpe?g|gif|webp|avif|bmp|ico)$/i
  const AUDIO_EXTENSION = /\.(?:mp3|wav|ogg|m4a|aac|flac|opus)$/i
  const VIDEO_EXTENSION = /\.(?:mp4|webm|mov|m4v|ogv)$/i

  function safeDisplayName(name) {
    // LayIM expands its own markup after HTML escaping, including mentions.
    return String(name ?? '').replace(/[\[\]()<>"'&@\\/\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '_').trim() || 'file'
  }

  function rewriteUploadMedia(message) {
    if (typeof message !== 'string') return message
    return message.replace(FILE, (original, url, name) => {
      const type = AUDIO_EXTENSION.test(url) ? 'audio' : VIDEO_EXTENSION.test(url) ? 'video' : null
      return type ? `${type}[${url}](${name})` : original
    })
  }

  function isUploadOnlyMessage(message) {
    if (typeof message !== 'string' || !message.trim()) return false
    return message.replace(FILE, '').replace(IMAGE, (original, url) =>
      IMAGE_EXTENSION.test(url) ? '' : original).trim() === ''
  }

  function install(layui) {
    const original = layui.data.content
    if (original.__chatdacsUploadMedia) return
    function content(...args) {
      args[0] = rewriteUploadMedia(args[0])
      return original.apply(this, args)
    }
    content.__chatdacsUploadMedia = true
    layui.data.content = content
  }

  return {safeDisplayName, rewriteUploadMedia, isUploadOnlyMessage, install}
})
