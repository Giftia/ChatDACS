module.exports = {
  插件名: '搜图插件',
  指令: '来点(好.*的.*|坏的.*)|来点.*',
  版本: '3.3', // 升级版本号
  作者: 'Giftina',
  描述: '搜索一张指定tag的二次元图。`好的` 代表正常尺度，`坏的` 代表🔞。图片来源api.lolicon.app。注：经测试，本插件启用后较容易被风控封号，请酌量使用。',
  使用示例: '来点好的白丝',
  预期返回: '[一张健全的白丝图]',

  // 初始化方法，用于依赖注入
  init({logger, axios, path, fs, utils, config}) {
    this.logger = logger
    this.axios = axios
    this.path = path
    this.fs = fs
    this.utils = utils
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const tag = new RegExp(this.指令).exec(msg)?.[1] ?? msg.split('来点')[1]?.trim() ?? ''
    const searchTag = tag.split('的')[1] ?? tag
    const searchType = !!tag.match('坏的')

    this.logger.info(`搜索 ${searchType ? 'r18' : '正常'} tag：${searchTag}`)

    try {
      if (options.type === 'qq') {
        await this.axios.get(
          `http://${this.ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
            `你等等，我去问问小冰有没有${tag}`,
          )}`,
        )

        const fileDirectPath = `./static${await this.SearchTag(searchTag, searchType)}`
        const fileModifiedPath = this.path.toFileURL(this.path.resolve(await this.utils.ModifyPic(fileDirectPath)))

        const requestData = {
          group_id: groupId,
          messages: [
            {
              type: 'node',
              data: {
                name: `${userName}的${tag}`,
                uin: 2854196306, // 对不起，QQ小冰
                content: `[CQ:image,file=${fileModifiedPath}]`,
              },
            },
          ],
        }

        await this.axios.post(`http://${this.ONE_BOT_API_URL}/send_group_forward_msg`, requestData)

        return {type: 'text', content: ''}
      }

      const filePath = await this.SearchTag(searchTag, searchType)
      return {type: 'picture', content: {file: filePath}}
    } catch (error) {
      this.logger.error(`搜图失败：${error}`)
      return {type: 'text', content: `你要的${tag}发送失败啦：${error}`}
    }
  },

  // 搜索指定tag的图片
  SearchTag: function (tag, type) {
    return new Promise((resolve, reject) => {
      this.axios
        .get(`https://api.lolicon.app/setu/v2?r18=${type}&size=original&tag=${encodeURI(tag)}`)
        .then((response) => {
          const body = response.data
          if (body.data && body.data.length > 0) {
            const picUrl = body.data[0].urls.original.replace('pixiv.cat', 'pixiv.re')
            this.logger.info(`准备保存 ${tag} 图片：${picUrl}`)

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
                  this.logger.info(`${tag} 图片保存成功`)
                  resolve(`/images/${fileName}`)
                })

                writeStream.on('error', (err) => {
                  this.logger.error(`${tag} 图片保存失败: ${err.message}`)
                  reject(err)
                })
              })
              .catch((err) => {
                this.logger.error(`下载 ${tag} 图片失败: ${err.message}`)
                reject(err)
              })
          } else {
            reject(`找不到${tag}`)
          }
        })
        .catch((err) => {
          this.logger.error(`请求搜图API失败: ${err.message}`)
          reject(err)
        })
    })
  },
}
