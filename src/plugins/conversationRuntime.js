'use strict'

function conversationKey(context) {
  const scope = context.raw?.scope ?? context.scope
  const privateScope = ['private', 'c2c', 'dm'].includes(scope) || context.groupId == null
  return JSON.stringify([context.platform, String(context.selfId ?? ''), privateScope ? 'private' : 'group',
    String(privateScope ? context.userId : context.groupId)])
}

function createConversationRuntime({execute, matchChat, fallback, observe = () => {},
  recordReply = () => {}, send, onMessage = () => {}, logger = console,
  maxPending = 64, maxPerConversation = 8, drainTimeoutMs = 35000}) {
  const queues = new Map()
  let pending = 0
  let stopped = false
  const warn = (code) => { try { logger.warn(code) } catch (_) {} }

  function handle(context) {
    if (stopped) return Promise.resolve({status: 'stopped'})
    if (typeof context?.text !== 'string' || !context.text.trim() || context.text.length > 4000 ||
        String(context.userId) === String(context.selfId)) return Promise.resolve({status: 'ignored'})
    const key = conversationKey(context)
    const entry = queues.get(key) ?? {tail: Promise.resolve(), pending: 0}
    if (pending >= maxPending || entry.pending >= maxPerConversation) {
      warn('CONVERSATION_QUEUE_FULL')
      return Promise.resolve({status: 'busy'})
    }
    pending++
    entry.pending++
    queues.set(key, entry)
    // Notify immediately so an incoming message invalidates an in-flight proactive reply.
    try { onMessage(context) } catch (_) { warn('CONVERSATION_OBSERVER_FAILED') }
    const result = entry.tail.then(async () => {
      if (stopped) return {status: 'stopped'}
      await observe(context)
      if (stopped) return {status: 'stopped'}
      let reply = await execute(context)
      if (stopped) return {status: 'stopped'}
      let source = 'plugin'
      if (!reply?.handled) {
        try { reply = await matchChat(context.text) } catch (_) {
          warn('CONVERSATION_CORPUS_FAILED')
          reply = {handled: false}
        }
        source = 'corpus'
      }
      if (stopped) return {status: 'stopped'}
      if (!reply?.handled) {
        reply = await fallback(context)
        source = 'llm'
      }
      if (stopped) return {status: 'stopped'}
      if (!reply || reply.handled === false || reply.content == null || reply.content === '' ||
          (typeof reply.content === 'string' && !reply.content.trim())) {
        return {status: 'empty', source}
      }
      const sentText = await send(context, reply)
      if (!stopped && !reply.timeout && !reply.safeError && (!reply.type || reply.type === 'text')) {
        const content = typeof sentText === 'string' ? sentText : reply.content
        if (typeof content === 'string') await recordReply(context, content)
      }
      return {status: 'sent', source}
    }).catch(() => {
      warn('CONVERSATION_PROCESS_FAILED')
      return {status: 'error'}
    }).finally(() => {
      pending--
      entry.pending--
      if (!entry.pending && queues.get(key) === entry) queues.delete(key)
    })
    entry.tail = result
    return result
  }

  async function stop() {
    stopped = true
    let timer
    try {
      await Promise.race([Promise.all([...queues.values()].map(entry => entry.tail)),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Object.assign(new Error('CONVERSATION_DRAIN_TIMEOUT'),
            {code: 'CONVERSATION_DRAIN_TIMEOUT'})), drainTimeoutMs)
        })])
    } finally { clearTimeout(timer) }
  }

  return {handle, stop, getPending: () => pending}
}

module.exports = {createConversationRuntime, conversationKey}
