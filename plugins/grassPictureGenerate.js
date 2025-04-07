module.exports = {
  插件名: '黑白生草图生成器插件',
  指令: '^[/!]?黑白图 (.*)',
  版本: '2.3', // 升级版本号
  作者: 'Giftina',
  描述: '生成一张黑白生草图。',
  使用示例: '黑白图 语段1 语段2[图片]',
  预期返回: '[一张黑白生草图]',

  // 初始化方法，用于依赖注入
  init({logger, utils, path, fs, Constants, canvas}) {
    this.logger = logger
    this.utils = utils
    this.path = path
    this.fs = fs
    this.Constants = Constants
    this.canvas = canvas
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const mainContent = msg.split('[')[0].replace(/^[/!]?黑白图 /g, '') ?? '智械危机 オムニッククライシス'
    const pictureSources =
      this.Constants.img_url_reg.exec(msg)?.[0] ??
      'https://gchat.qpic.cn/gchatpic_new/1005056803/2147311946-3104545614-E3DCA7F57C09808B2AFAAB22172197B8/0' // 取图片链接

    const firstContent = mainContent?.split(' ')[0]?.trim() ?? '智械危机' // 第一行内容
    const secondContent = mainContent?.split(' ')[1]?.trim() ?? 'オムニッククライシス' // 第二行内容

    try {
      const fileURL = await this.generatePicture(pictureSources, firstContent, secondContent)
      return {type: 'picture', content: {file: fileURL}}
    } catch (error) {
      this.logger.error(`生成黑白图失败: ${error.message}`)
      return {type: 'text', content: '生成黑白图失败，请稍后再试。'}
    }
  },

  // 生成黑白生草图
  generatePicture: async function (pictureSources, firstContent, secondContent) {
    const {createCanvas, loadImage} = this.canvas

    return new Promise((resolve, reject) => {
      loadImage(pictureSources)
        .then((image) => {
          const canvas = createCanvas(image.width, image.height + 150) // 根据图片尺寸创建画布，并在下方加文字区
          const ctx = canvas.getContext('2d')

          // 绘制图片
          ctx.drawImage(image, 0, 0)
          ctx.filter = 'grayscale'
          ctx.fillStyle = 'BLACK'
          ctx.fillRect(0, image.height, image.width, 150)

          // 绘制文字
          ctx.font = '40px Sans'
          ctx.textAlign = 'center'
          ctx.fillStyle = 'WHITE'
          ctx.fillText(firstContent, image.width / 2, image.height + 70) // 第一行文字
          ctx.font = '28px Sans'
          ctx.fillText(secondContent, image.width / 2, image.height + 110) // 第二行文字

          // 转换为黑白
          const canvasData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          for (let x = 0; x < canvasData.width; x++) {
            for (let y = 0; y < canvasData.height; y++) {
              const idx = (x + y * canvasData.width) * 4
              const r = canvasData.data[idx]
              const g = canvasData.data[idx + 1]
              const b = canvasData.data[idx + 2]
              const gray = 0.299 * r + 0.587 * g + 0.114 * b

              canvasData.data[idx] = gray // Red channel
              canvasData.data[idx + 1] = gray // Green channel
              canvasData.data[idx + 2] = gray // Blue channel
              canvasData.data[idx + 3] = 255 // Alpha channel

              // 添加黑色边框
              if (x < 8 || y < 8 || x > canvasData.width - 8 || y > canvasData.height - 8) {
                canvasData.data[idx] = 0
                canvasData.data[idx + 1] = 0
                canvasData.data[idx + 2] = 0
              }
            }
          }
          ctx.putImageData(canvasData, 0, 0)

          // 保存图片
          const fileLocalPath = this.path.join(
            process.cwd(),
            'static',
            'xiaoye',
            'images',
            `${this.utils.sha1(canvas.toBuffer())}.jpg`,
          )
          this.fs.writeFileSync(fileLocalPath, canvas.toBuffer())

          const fileURL = `/xiaoye/images/${this.utils.sha1(canvas.toBuffer())}.jpg`
          this.logger.info(`黑白图生成成功，图片路径: ${fileURL}`)
          resolve(fileURL)
        })
        .catch((error) => {
          this.logger.error(`加载图片失败: ${error.message}`)
          reject(error)
        })
    })
  },
}
