'use strict'

// Keep request cancellation local to DMs; do not change the SDK's global HTTP defaults.
function createGuildDirectTransport(api, {timeoutMs = 10000} = {}) {
  const requests = new Set()
  let stopped = false
  const transport = Object.create(api)
  transport.request = async function(options) {
    if (stopped) throw new Error('DM transport stopped')
    const controller = new AbortController()
    requests.add(controller)
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await api.request.call(api, {...options, timeout: timeoutMs, signal: controller.signal})
    } finally {
      clearTimeout(timer)
      requests.delete(controller)
    }
  }
  transport.stop = () => {
    stopped = true
    for (const controller of requests) controller.abort()
  }
  return transport
}

module.exports = {createGuildDirectTransport}
