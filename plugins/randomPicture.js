module.exports = {
  插件名: '随机网图插件',
  指令: '^[/!]?随机网图$',
  版本: '2.2', // 升级版本号
  作者: 'Giftina',
  描述: '从随机网络图源下载图片后发送图片，图源可以自定义，网上很多。',
  使用示例: '随机网图',
  预期返回: '[一张随机网图]',

  // 初始化方法，用于依赖注入
  init({logger, axios, path, fs}) {
    this.logger = logger
    this.axios = axios
    this.path = path
    this.fs = fs
    this.随机图源 = 'https://api.btstu.cn/sjbz/?m_lx=suiji' // 默认随机图源
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const url = await this.RandomPicture()
    return {type: 'picture', content: {file: url}}
  },

  // 随机图
  RandomPicture: function () {
    return new Promise((resolve, reject) => {
      const picFilePath = `/images/${Date.now()}.jpg`
      const picFileFullPath = this.path.join(process.cwd(), 'static', picFilePath)

      this.axios({
        url: this.随机图源,
        method: 'GET',
        responseType: 'stream',
      })
        .then((response) => {
          const writeStream = this.fs.createWriteStream(picFileFullPath)
          response.data.pipe(writeStream)

          writeStream.on('finish', () => {
            this.logger.info(`随机网图保存成功: ${picFileFullPath}`)
            resolve(picFilePath)
          })

          writeStream.on('error', (err) => {
            this.logger.error(`随机网图保存失败: ${err.message}`)
            reject(err)
          })
        })
        .catch((err) => {
          this.logger.error(`获取随机网图失败: ${err.message}`)
          reject(err)
        })
    })
  },
}
