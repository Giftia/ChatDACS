module.exports = {
  插件名: '淘宝买家秀色图插件',
  指令: '买家秀|福利姬',
  版本: '3.3', // 升级版本号
  作者: 'Giftina',
  描述: '在危险的尺度下发送一张非法的淘宝买家秀福利图。',
  使用示例: '买家秀',
  预期返回: '[一张买家秀图]',

  // 初始化方法，用于依赖注入
  init({logger, axios, path, url, fs, config, utils}) {
    this.logger = logger
    this.axios = axios
    this.path = path
    this.url = url
    this.fs = fs
    this.utils = utils
    this.SUMT_API_KEY = config.SUMT_API_KEY
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (!this.SUMT_API_KEY) {
      return {
        type: 'text',
        content: `${this.插件名} 的接口密钥未配置，请通知小夜主人及时配置接口密钥。`,
      }
    }

    if (options.type === 'qq') {
      await this.axios.get(
        `http://${this.ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
          '你不对劲，我去问问小冰有没有买家秀',
        )}`,
      )

      const fileDirectPath = `./static${await this.RandomTbShow()}`
      const fileModifiedPath = this.url.pathToFileURL(this.path.resolve(await this.utils.ModifyPic(fileDirectPath)))

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: 'node',
            data: {
              name: `${userName}的福利姬图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileModifiedPath}]`,
            },
          },
        ],
      }

      await this.axios.post(`http://${this.ONE_BOT_API_URL}/send_group_forward_msg`, requestData)

      return {type: 'text', content: ''}
    }

    const fileURL = await this.RandomTbShow()
    return {type: 'picture', content: {file: fileURL}}
  },

  // 随机买家秀
  RandomTbShow: function () {
    return new Promise((resolve, reject) => {
      this.axios
        .get(`https://api.sumt.cn/api/rand.tbimg.php?token=${this.SUMT_API_KEY}&format=json`)
        .then((response) => {
          const body = response.data
          if (body.code === 200) {
            const picUrl = body.pic_url
            this.logger.info(`准备保存图片：${picUrl}`)

            const fileName = this.path.basename(picUrl)
            const filePath = this.path.join(process.cwd(), 'static', 'images', fileName)

            this.axios({
              url: picUrl,
              method: 'GET',
              responseType: 'stream',
            })
              .then((res) => {
                const writeStream = this.fs.createWriteStream(filePath)
                res.data.pipe(writeStream)

                writeStream.on('finish', () => {
                  this.logger.info('买家秀图片保存成功')
                  resolve(`/images/${fileName}`)
                })

                writeStream.on('error', (err) => {
                  this.logger.error(`买家秀图片保存失败: ${err.message}`)
                  reject(err)
                })
              })
              .catch((err) => {
                this.logger.error(`下载买家秀图片失败: ${err.message}`)
                reject(err)
              })
          } else {
            reject(`随机买家秀错误，接口返回错误：${JSON.stringify(body)}`)
          }
        })
        .catch((err) => {
          this.logger.error(`请求买家秀接口失败: ${err.message}`)
          reject(err)
        })
    })
  },
}
