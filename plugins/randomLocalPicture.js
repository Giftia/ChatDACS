module.exports = {
  插件名: '本地随机图插件',
  指令: '[让给]我[看康]{1,3}|^[/!]?图来$',
  版本: '3.3', // 升级版本号
  作者: 'Giftina',
  描述: '从本地图片文件夹随机发送一张图片，默认使用其他插件自动下载保存的图库文件夹。',
  使用示例: '让我康康',
  预期返回: '[一张本地的随机图]',

  // 初始化方法，用于依赖注入
  init({logger, axios, path, fs, config, randomFile}) {
    this.logger = logger
    this.axios = axios
    this.path = path
    this.fs = fs
    this.randomFile = randomFile
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
    this.图片文件夹 = config.ImageFolder || './static/images/' // 默认图库文件夹
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type === 'qq') {
      await this.axios.get(
        `http://${this.ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI('杰哥不要！')}`,
      )

      const fileDirectPath = this.path.toFileURL(
        this.path.resolve(`${this.图片文件夹}${await this.RandomLocalPicture()}`),
      )

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: 'node',
            data: {
              name: `${userName}的本地随机图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileDirectPath}]`,
            },
          },
        ],
      }

      await this.axios.post(`http://${this.ONE_BOT_API_URL}/send_group_forward_msg`, requestData)

      return {type: 'text', content: ''}
    }

    // web端的非网站目录图片需要返回 base64
    const filePath = `${this.图片文件夹}${await this.RandomLocalPicture()}`
    const base64Img = `data:image/png;base64,${Buffer.from(this.fs.readFileSync(filePath)).toString('base64')}`
    return {type: 'directPicture', content: {file: base64Img}}
  },

  // 随机图
  RandomLocalPicture: function () {
    return new Promise((resolve, reject) => {
      this.randomFile(this.图片文件夹, (err, file) => {
        if (err) {
          this.logger.error(`随机图选择失败: ${err.message}`)
          reject(err)
        }
        this.logger.info(`随机选择的图片: ${file}`)
        resolve(file)
      })
    })
  },
}
