module.exports = {
  插件名: '今日老婆插件',
  指令: '^[/!]?今日老婆$',
  版本: '1.4', // 升级版本号
  作者: 'Giftina',
  描述: '仅在qq端生效。将随机一名群友和你组成一对cp。',
  使用示例: '今日老婆',
  预期返回: '[cp头]',

  // 初始化方法，用于依赖注入
  init({logger, axios, path, fs, config, canvas}) {
    this.logger = logger
    this.axios = axios
    this.path = path
    this.fs = fs
    this.WEB_PORT = config.WEB_PORT
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
    this.createCanvas = canvas.createCanvas
    this.loadImage = canvas.loadImage
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type !== 'qq') {
      return 0
    }

    try {
      const selfHeadImgBuffer = await this.loadImage(`https://api.sumt.cn/api/qq.logo.php?qq=${userId}`)
      const randomCp = await this.getRandomOne(groupId)
      const targetHeadImgBuffer = await this.loadImage(`https://api.sumt.cn/api/qq.logo.php?qq=${randomCp}`)

      this.logger.info(`将 ${userId} 和 ${randomCp} 组成一对cp`)

      const canvas = this.createCanvas(200, 200)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = 'PINK'
      ctx.fillRect(0, 0, 200, 200)

      // 画用户的头像
      ctx.beginPath()
      ctx.arc(60, 60, 60, 0, 2 * Math.PI)
      ctx.fill()
      ctx.save()
      ctx.clip()
      ctx.drawImage(selfHeadImgBuffer, 0, 0, 120, 120)
      ctx.closePath()
      ctx.restore()

      // 画cp的头像
      ctx.beginPath()
      ctx.arc(140, 140, 60, 0, 2 * Math.PI)
      ctx.fill()
      ctx.clip()
      ctx.drawImage(targetHeadImgBuffer, 80, 80, 120, 120)
      ctx.closePath()

      // 保存图片
      const fileName = `${userId}x${randomCp}.jpg`
      const filePath = this.path.join(process.cwd(), 'static', 'xiaoye', 'images', fileName)
      const buffer = canvas.toBuffer('image/png')
      this.fs.writeFileSync(filePath, buffer)

      const fileURL = `http://127.0.0.1:${this.WEB_PORT}/xiaoye/images/${fileName}`

      return {type: 'picture', content: {file: fileURL}}
    } catch (error) {
      this.logger.error(`生成今日老婆图片失败: ${error.message}`)
      return {type: 'text', content: '生成今日老婆失败，请稍后再试。'}
    }
  },

  /**
   * 随机选一名幸运群友
   * @param {number} groupId 群号
   * @returns {Promise<number>} 幸运群友qq
   */
  getRandomOne: async function (groupId) {
    try {
      const groupMemberList = await this.axios
        .get(`http://${this.ONE_BOT_API_URL}/get_group_member_list?group_id=${groupId}`)
        .then((res) => res.data.data)

      return groupMemberList[Math.floor(Math.random() * groupMemberList.length)].user_id
    } catch (err) {
      this.logger.error(`获取群成员列表失败: ${err.message}`)
      return null
    }
  },
}
