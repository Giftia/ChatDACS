'use strict'

function handleQQMediaBridge({event, config, constants, utils, io, logger, continueImages = false}) {
  if (config.QQBOT_SAVE_ALL_IMAGE_TO_LOCAL_SWITCH && constants.isImage_reg.test(event.message)) {
    const imageUrl = constants.img_url_reg.exec(event.message)
    utils
      .SaveQQimg(imageUrl)
      .then((savedImage) => {
        io.emit('qqImage', savedImage)
      })
      .catch(() => {
        logger.error('QQ_IMAGE_FORWARD_FAILED')
      })
    return !continueImages
  }

  if (constants.isVideo_reg.test(event.message)) {
    const videoUrl = constants.video_url_reg.exec(event.message)[0]
    io.emit('qqVideo', {file: videoUrl, filename: 'qq视频'})
    return true
  }

  return false
}

module.exports = {
  handleQQMediaBridge,
}
