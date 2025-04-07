module.exports = {
  插件名: 'cos图片插件',
  指令: '^[/!]?(cos图|cosplay)$',
  版本: '4.0',
  作者: 'Giftina',
  描述: '在普通限度的尺度下发送一张合法的 cos 三次元图, 图片来源哔哩哔哩cos专栏。',
  使用示例: 'cos图',
  预期返回: '[一张cos图]',

  // 初始化方法，用于依赖注入
  init({logger, config, axios, url, path, request, fs}) {
    this.logger = logger
    this.axios = axios
    this.url = url
    this.path = path
    this.request = request
    this.fs = fs
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
    this.cos_total_count = 2000 // 初始化随机cos上限，可以自己调整
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type === 'qq') {
      // 发送初始消息
      await this.axios.get(
        `http://${this.ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
          '你等等，我去问问小冰有没有cos图',
        )}`,
      )

      // 获取随机cos图片路径
      const fileDirectPath = this.url.pathToFileURL(this.path.resolve(`./static${await this.RandomCos()}`))

      // 构造转发消息
      const requestData = {
        group_id: groupId,
        messages: [
          {
            type: 'node',
            data: {
              name: `${userName}的cos图`,
              uin: 2854196306, // 对不起，QQ小冰
              content: `[CQ:image,file=${fileDirectPath}]`,
            },
          },
        ],
      }

      // 发送转发消息
      await this.axios.post(`http://${this.ONE_BOT_API_URL}/send_group_forward_msg`, requestData)

      return {type: 'text', content: ''}
    }

    // 返回图片路径
    const filePath = await this.RandomCos()
    return {type: 'picture', content: {file: filePath}}
  },

  // 获取随机cos图片
  RandomCos: function () {
    return new Promise((resolve, reject) => {
      const rand_page_num = Math.floor(Math.random() * this.cos_total_count)
      this.request(
        `https://api.vc.bilibili.com/link_draw/v2/Photo/list?category=cos&type=new&page_num=${rand_page_num}&page_size=10`,
        (err, response, body) => {
          body = JSON.parse(body)
          if (!err && response.statusCode === 200 && body.code === 0 && body.data.total_count != 0) {
            try {
              var obj = body.data.items[0].item.pictures // 检查图片数据
            } catch (err) {
              reject(
                '获取随机cos错误，是B站的锅。这个item里又双草没有图片，阿B你在干什么啊。错误原因：' +
                  JSON.stringify(response.body),
              )
              return 0
            }
            var count = Object.keys(obj).length
            var picUrl = obj[Math.floor(Math.random() * count)].img_src
            this.logger.info(`cos总数：${this.cos_total_count}页，当前选择：${rand_page_num}页，发送图片：${picUrl}`)

            // 绕过防盗链，保存为本地图片
            this.request(picUrl).pipe(
              this.fs.createWriteStream(`./static/images/${picUrl.split('/').pop()}`).on('close', (_err) => {
                resolve(`/images/${picUrl.split('/').pop()}`)
              }),
            )
          } else {
            reject('获取随机cos错误，是B站的锅。错误原因：' + JSON.stringify(response.body))
          }
        },
      )
    })
  },
}
