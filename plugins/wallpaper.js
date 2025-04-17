module.exports = {
  插件名: '壁纸插件',
  指令: '^[/!]?设置壁纸(.*)',
  版本: '1.1', // 升级版本号
  作者: 'Giftina',
  描述: '2022年圣诞节彩蛋，可以给小夜的宿主设置一张指定的壁纸。',
  使用示例: '设置壁纸 [图片]',
  预期返回: '[给宿主设置一张指定壁纸]',

  // 初始化方法，用于依赖注入
  init({logger, axios, fs, path, constants, wallpaper}) {
    this.logger = logger
    this.axios = axios
    this.fs = fs
    this.path = path
    this.constants = constants
    this.wallpaper = wallpaper
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const picURI = this.constants.img_url_reg.exec(msg)?.[0]
    if (!picURI) {
      return {type: 'text', content: '未检测到图片链接，请提供有效的图片地址。'}
    }

    try {
      const picPath = await this.axios.get(picURI, {responseType: 'arraybuffer'}).then((res) => {
        const picPath = this.path.join(process.cwd(), 'static', 'images', `wallpaper-${this.path.basename(picURI)}`)
        this.fs.writeFileSync(picPath, res.data)
        return picPath
      })

      if (picPath) {
        await this.wallpaper.set(picPath)
        this.logger.info(`壁纸设置成功: ${picPath}`)
        return {type: 'text', content: '小夜宿主壁纸设置成功！我要给你打易佰昏！'}
      }
    } catch (error) {
      this.logger.error(`壁纸设置失败: ${error.message}`)
      return {type: 'text', content: '小夜宿主壁纸设置失败！是不是还不够色？'}
    }
  },
}
