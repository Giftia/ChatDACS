'use strict'

;(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.ChatDacsRenderSecurity = factory()
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const configured = new WeakSet()

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character])
  }

  function normalizeMediaUrl(value) {
    if (typeof value !== 'string' || /[\\\u0000-\u001f\u007f]/.test(value)) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      const parsed = new URL(trimmed, 'https://chatdacs.invalid/')
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null
      // LayIM's video handler builds HTML again after reading data-src. URL-encode
      // delimiters before that second sink, while retaining relative-path semantics.
      return encodeUriDelimiters(trimmed)
    } catch { return null }
  }

  function safeMediaUrl(value) {
    return normalizeMediaUrl(value) !== null
  }

  function encodeUriDelimiters(value) {
    return value.replace(/[ <>"'`]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  }

  function isMediaControl(node) {
    if (node.nodeName !== 'DIV' || !safeMediaUrl(node.getAttribute('data-src'))) return false
    const event = node.getAttribute('layim-event')
    const classes = (node.getAttribute('class') || '').split(/\s+/)
    return event === 'playAudio' && classes.includes('layui-layim-audio') ||
      event === 'playVideo' && classes.includes('layui-layim-video')
  }

  function sanitizeHtml(html, purify) {
    if (!purify || purify.isSupported !== true || typeof purify.sanitize !== 'function' ||
        typeof purify.addHook !== 'function') return escapeHtml(html)
    try {
      if (!configured.has(purify)) {
        purify.addHook('uponSanitizeAttribute', (node, data) => {
          if (['layim-event', 'data-src'].includes(data.attrName)) data.keepAttr = isMediaControl(node)
          if (data.keepAttr && data.attrName === 'data-src') data.attrValue = normalizeMediaUrl(data.attrValue)
          if (['src', 'href', 'poster'].includes(data.attrName)) {
            data.attrValue = encodeUriDelimiters(data.attrValue)
          }
          if (data.attrName === 'target' && data.attrValue === '_blank') {
            node.setAttribute('rel', 'noopener noreferrer')
          }
        })
        configured.add(purify)
      }
      // Sanitize after LayIM expansion; cleaning the input would be undone by its parser.
      return purify.sanitize(String(html ?? ''), {
        USE_PROFILES: {html: true},
        ADD_ATTR: ['layim-event', 'target'],
        FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'iframe',
          'object', 'embed', 'base', 'link', 'meta'],
        FORBID_ATTR: ['style', 'id', 'name', 'srcdoc', 'autofocus'],
      })
    } catch { return escapeHtml(html) }
  }

  function install(layui, {purify, layim} = {}) {
    const original = layui.data.content
    if (!original.__chatdacsRenderSecurity) {
      function content(...args) {
        return sanitizeHtml(original.apply(this, args), purify)
      }
      content.__chatdacsRenderSecurity = true
      layui.data.content = content
    }
    if (layim && !layim.getMessage.__chatdacsRenderSecurity) {
      const getMessage = layim.getMessage
      function receive(message) {
        const safe = {...message}
        if (safe.username != null) safe.username = escapeHtml(safe.username)
        if (safe.avatar != null) safe.avatar = escapeHtml(normalizeMediaUrl(safe.avatar) ?? '')
        return getMessage.call(this, safe)
      }
      receive.__chatdacsRenderSecurity = true
      layim.getMessage = receive
    }
  }

  return {escapeHtml, safeMediaUrl, normalizeMediaUrl, sanitizeHtml, install}
})
