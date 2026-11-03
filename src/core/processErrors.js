'use strict'

function registerProcessErrorHandlers({processLike = process, io, logger = console, notifyAdmin} = {}) {
  const report = async (prefix) => {
    const code = prefix === '@未捕获的异常' ? 'PROCESS_UNCAUGHT_EXCEPTION' :
      prefix === '@未捕获的promise异常' ? 'PROCESS_UNHANDLED_REJECTION' : 'PROCESS_ERROR'
    const metadata = Object.freeze({code})
    try {
      io?.emit?.('system', '系统处理失败，请稍后再试')
    } catch {
      loggerCall(logger, 'error', 'PROCESS_BROADCAST_ERROR')
    }
    loggerCall(logger, 'error', code)

    if (typeof notifyAdmin !== 'function') {
      return
    }

    try {
      await notifyAdmin(metadata)
    } catch {
      loggerCall(logger, 'error', 'PROCESS_NOTIFICATION_ERROR')
    }
  }

  const uncaughtExceptionHandler = (error) => report('@未捕获的异常', error)
  const unhandledRejectionHandler = (error) => report('@未捕获的promise异常', error)

  processLike.on('uncaughtException', uncaughtExceptionHandler)
  processLike.on('unhandledRejection', unhandledRejectionHandler)

  return {
    report,
    dispose() {
      removeListener(processLike, 'uncaughtException', uncaughtExceptionHandler)
      removeListener(processLike, 'unhandledRejection', unhandledRejectionHandler)
    },
  }
}

function removeListener(processLike, event, handler) {
  if (typeof processLike.off === 'function') {
    processLike.off(event, handler)
  } else if (typeof processLike.removeListener === 'function') {
    processLike.removeListener(event, handler)
  }
}

function loggerCall(logger, level, message) {
  try {
    if (typeof logger?.[level] === 'function') Promise.resolve(logger[level](message)).catch(() => {})
  } catch {}
}

module.exports = {
  registerProcessErrorHandlers,
}
