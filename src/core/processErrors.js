'use strict'

function registerProcessErrorHandlers({processLike = process, io, logger = console, notifyAdmin} = {}) {
  const report = async (prefix, error) => {
    const formattedError = formatError(error)
    io?.emit?.('system', `${prefix}: ${formattedError}`)
    loggerCall(logger, 'error', `${prefix}: ${formattedError}`)

    if (typeof notifyAdmin !== 'function') {
      return
    }

    try {
      await notifyAdmin(error)
    } catch (notificationError) {
      loggerCall(logger, 'error', `异常通知发送失败: ${formatError(notificationError)}`)
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

function formatError(error) {
  return error?.stack ?? error?.message ?? String(error)
}

function loggerCall(logger, level, message) {
  if (typeof logger?.[level] === 'function') {
    logger[level](message)
  }
}

module.exports = {
  registerProcessErrorHandlers,
}
