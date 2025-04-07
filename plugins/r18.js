module.exports = {
  插件名: 'r18色图插件',
  指令: '^[/!]?r18$|(可以|能)?色色|[色涩瑟]图',
  版本: '3.3', // 升级版本号
  作者: 'Giftina',
  描述: '在危险的尺度下发送一张非法的 r18 二次元色图，图片来源api.lolicon.app。',
  使用示例: '可以色色',
  预期返回: '[一张r18图]',

  // 初始化方法，用于依赖注入
  init({logger, axios, utils, config, path, fs}) {
    this.logger = logger
    this.axios = axios
    this.utils = utils
    this.path = path
    this.fs = fs
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type === 'qq') {
      await this.axios.get(
        `http://${this.ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
          '你不对劲，我去问问小冰有没有r18图',
        )}`,
      )

      const fileDirectPath = `./static${await this.RandomR18()}`
      const fileModifiedPath = this.path.toFileURL(this.path.resolve(await this.utils.ModifyPic(fileDirectPath)))

      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: 'node',
            data: {
              name: `${userName}的r18图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileModifiedPath}]`,
            },
          },
        ],
      }

      await this.axios.post(`http://${this.ONE_BOT_API_URL}/send_group_forward_msg`, requestData)

      return {type: 'text', content: ''}
    }

    const filePath = await this.RandomR18()
    return {type: 'picture', content: {file: filePath}}
  },

  // 随机获取 r18 图片
  RandomR18: function () {
    return new Promise((resolve, reject) => {
      this.axios
        .get('https://api.lolicon.app/setu/v2?r18=0&size=original')
        .then((response) => {
          const body = response.data
          if (body.data && body.data.length > 0) {
            const picUrl = body.data[0].urls.original.replace('i.pixiv.cat', 'i.pixiv.re')
            this.logger.info(`准备保存r18图片：${picUrl}`)
            this.axios({
              url: picUrl,
              method: 'GET',
              responseType: 'stream',
            })
              .then((res) => {
                const filePath = this.path.join(process.cwd(), 'static', 'images', this.path.basename(picUrl))
                const writeStream = this.fs.createWriteStream(filePath)
                res.data.pipe(writeStream)
                writeStream.on('finish', () => {
                  this.logger.info('r18图片保存成功')
                  resolve(`/images/${this.path.basename(picUrl)}`)
                })
                writeStream.on('error', (err) => {
                  this.logger.error(`r18图片保存失败: ${err.message}`)
                  reject('获取r18失败，错误原因：' + err.message)
                })
              })
              .catch((err) => {
                this.logger.error(`下载r18图片失败: ${err.message}`)
                reject('获取r18失败，错误原因：' + err.message)
              })
          } else {
            reject('获取随机r18错误，API返回数据为空')
          }
        })
        .catch((err) => {
          this.logger.error(`请求r18 API失败: ${err.message}`)
          reject('获取随机r18错误，错误原因：' + err.message)
        })
    })
  },
}
