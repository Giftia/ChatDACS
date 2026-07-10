'use strict'

function registerOneBotWebhook({app, path, handleEvent, logger = console}) {
  if (!app || typeof app.post !== 'function') {
    throw new Error('app.post is required')
  }
  if (!path) {
    throw new Error('path is required')
  }
  if (typeof handleEvent !== 'function') {
    throw new Error('handleEvent is required')
  }

  app.post(path, (req, res) => {
    res.status(204).end()

    Promise.resolve()
      .then(() => handleEvent(req.body))
      .catch((error) => {
        if (typeof logger?.error === 'function') {
          logger.error(`OneBot 事件处理失败: ${formatError(error)}`)
        }
      })
  })
}

function formatError(error) {
  return error?.stack ?? error?.message ?? String(error)
}

module.exports = {
  registerOneBotWebhook,
}
