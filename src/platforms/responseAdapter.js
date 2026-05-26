'use strict'

const path = require('path')
const url = require('url')

function formatPluginAnswer(platform, answer, options = {}) {
  switch (platform) {
    case 'web':
      return formatWebAnswer(answer)
    case 'onebot':
    case 'go-cqhttp':
    case 'qq':
      return formatOneBotAnswer(answer, options)
    case 'qqGuild':
    case 'qqInsideGuild':
      return formatQQGuildAnswer(answer, options)
    case 'telegram':
      return formatTelegramAnswer(answer)
    default:
      throw new Error(`Unsupported response platform: ${platform}`)
  }
}

function formatWebAnswer(answer) {
  if (!answer?.content?.file) {
    return answer?.content
  }

  const styleMap = {
    picture: `img[${answer.content.file}]`,
    directPicture: `img[${answer.content.file}]`,
    audio: `audio[${answer.content.file}](${answer.content.filename})`,
    video: `video[${answer.content.file}](${answer.content.filename})`,
    file: `file(${answer.content.file})[${answer.content.filename}]`,
  }
  return styleMap[answer.type]
}

function formatOneBotAnswer(answer, {webPort} = {}) {
  if (!answer?.content?.file) {
    return answer?.content
  }

  const localBaseUrl = `http://127.0.0.1:${webPort}`
  const styleMap = {
    picture: `[CQ:image,file=${isRemoteFile(answer.content.file) ? answer.content.file : `${localBaseUrl}${answer.content.file}`}]`,
    directPicture: `[CQ:image,file=${url.pathToFileURL(path.resolve(answer.content.file))}]`,
    audio: `[CQ:record,file=${localBaseUrl}${answer.content.file}]`,
    video: `[CQ:video,file=${localBaseUrl}${answer.content.file}]`,
  }
  return styleMap[answer.type]
}

function formatQQGuildAnswer(answer, {webPort} = {}) {
  const localBaseUrl = `http://127.0.0.1:${webPort}`

  switch (answer?.type) {
    case 'picture':
      return {
        image: `${localBaseUrl}${answer.content?.file}`,
      }
    case 'directPicture':
      return {
        image: `${localBaseUrl}${answer.content?.file.replace('./static', '')}`,
      }
    case 'audio':
      return {
        text: answer.content.filename,
        audio: `${localBaseUrl}${answer.content?.file}`,
      }
    default:
      return {
        text: answer?.content,
      }
  }
}

function formatTelegramAnswer(answer) {
  switch (answer?.type) {
    case 'picture':
      return {
        image: `./static${answer.content?.file}`,
      }
    case 'directPicture':
      return {
        image: answer.content?.file,
      }
    case 'audio':
      return {
        text: answer.content.filename,
        audio: `./static${answer.content?.file}`,
        duration: answer.content.duration,
      }
    default:
      return {
        text: answer?.content,
      }
  }
}

function isRemoteFile(file) {
  return typeof file === 'string' && /^https?:\/\//.test(file)
}

module.exports = {
  formatPluginAnswer,
  formatWebAnswer,
  formatOneBotAnswer,
  formatQQGuildAnswer,
  formatTelegramAnswer,
}
