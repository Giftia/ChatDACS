module.exports = {
  插件名: '随机二次元图插件',
  指令: '^[/!]?(随机)二次元(图)$|^[/!]?二次元$',
  版本: '3.3', // 升级版本号
  作者: 'Giftina',
  描述: '发送一张正常尺度的二次元图。',
  使用示例: '二次元',
  预期返回: '[一张随机二次元图]',

  // 初始化方法，用于依赖注入
  init({logger, axios, utils, path, url, fs, config}) {
    this.logger = logger
    this.axios = axios
    this.utils = utils
    this.path = path
    this.url = url
    this.fs = fs
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type === 'qq') {
      await this.axios.get(
        `http://${this.ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
          '你等等，我去问问小冰有没有二次元',
        )}`,
      )

      const fileDirectPath = this.url.pathToFileURL(this.path.resolve(`./static${await this.RandomECY()}`))

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: 'node',
            data: {
              name: `${userName}的二次元图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileDirectPath}]`,
            },
          },
        ],
      }

      await this.axios.post(`http://${this.ONE_BOT_API_URL}/send_group_forward_msg`, requestData)

      return {type: 'text', content: ''}
    }

    const filePath = await this.RandomECY()
    return {type: 'picture', content: {file: filePath}}
  },

  // 随机二次元图
  RandomECY: function () {
    return new Promise((resolve, reject) => {
      this.axios
        .get('https://iw233.cn/api/Random.php', {responseType: 'stream'})
        .then((response) => {
          const picUrl = response.request.res.responseUrl
          const fileName = this.path.basename(picUrl)
          const filePath = this.path.join(process.cwd(), 'static', 'images', fileName)

          const writeStream = this.fs.createWriteStream(filePath)
          response.data.pipe(writeStream)

          writeStream.on('finish', () => {
            this.logger.info(`保存了好康的二次元图：${picUrl}`)
            resolve(`/images/${fileName}`)
          })

          writeStream.on('error', (err) => {
            this.logger.error(`保存二次元图失败: ${err.message}`)
            reject('随机二次元图错误，保存图片失败。')
          })
        })
        .catch((err) => {
          this.logger.error(`获取二次元图失败: ${err.message}`)
          reject('随机二次元图错误，无法获取图片。')
        })
    })
  },
}
