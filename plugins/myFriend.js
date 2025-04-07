module.exports = {
  插件名: '我有个朋友插件',
  指令: '^我有个朋友说(.*)',
  版本: '2.1', // 升级版本号
  作者: 'Giftina',
  描述: 'QQ群专有功能。小夜会P一张你朋友说的图。',
  使用示例: '我有个朋友说我好了@朋友',
  预期返回: '[朋友：我好了]',

  // 初始化方法，用于依赖注入
  init({logger, axios, utils, Constants, canvas, path, fs, config}) {
    this.logger = logger
    this.axios = axios
    this.utils = utils
    this.Constants = Constants
    this.canvas = canvas
    this.path = path
    this.fs = fs
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type !== 'qq') {
      return 0
    }

    let target = this.Constants.has_qq_reg.exec(msg)
    target = !target ? userId : target[1]
    const headIcon = `https://api.sumt.cn/api/qq.logo.php?qq=${target}` // 载入朋友头像
    msg = msg.split('说')[1].split('[CQ:at,qq=')[0].trim()

    const fileURL = await this.canvas.loadImage(headIcon).then(async (image) => {
      const canvas = this.canvas.createCanvas(350, 80)
      const ctx = canvas.getContext('2d')

      // 绘制背景
      ctx.fillStyle = 'WHITE'
      ctx.fillRect(0, 0, 350, 80)

      // 绘制昵称
      ctx.font = '20px SimHei'
      ctx.textAlign = 'left'
      ctx.fillStyle = '#000000'
      const nickname = (
        await this.axios.get(
          `http://${this.ONE_BOT_API_URL}/get_stranger_info?group_id=${groupId}&user_id=${target}&no_cache=1`,
        )
      ).data.data.nickname
      ctx.fillText(nickname, 90.5, 35.5)

      // 绘制消息内容
      ctx.font = '16px SimHei'
      ctx.fillStyle = '#716F81'
      ctx.fillText(msg, 90.5, 55.5)

      // 绘制时间
      ctx.font = '13px SimHei'
      ctx.fillText(this.utils.GetTimes().Clock, 280.5, 35.5)

      // 绘制头像
      ctx.beginPath()
      ctx.arc(40, 40, 28, 0, 2 * Math.PI)
      ctx.fill()
      ctx.clip()
      ctx.drawImage(image, 10, 10, 60, 60)
      ctx.closePath()

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

      this.logger.info(`我有个朋友合成成功，图片路径: ${fileURL}`)
      return fileURL
    })

    return {type: 'picture', content: {file: fileURL}}
  },
}
