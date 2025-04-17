module.exports = {
  插件名: '系统信息查询插件',
  指令: '^[/!]?(status|系统状态)$',
  版本: '2.5', // 升级版本号
  作者: 'Giftina',
  描述: '查询小夜的相关运行信息。',
  使用示例: '系统状态',
  预期返回: '[小夜的相关运行信息]',

  // 初始化方法，用于依赖注入
  init({logger, os, fs, path, yaml, config}) {
    this.logger = logger
    this.os = os
    this.fs = fs
    this.path = path
    this.yaml = yaml
    this.versionNumber = `v${require(path.join(process.cwd(), 'package.json')).version}`
    this.QQBOT_ADMIN_LIST = config.QQBOT_ADMIN_LIST || []
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const status = await this.CheckoutStatus()
    return {type: 'text', content: status}
  },

  // 查询系统状态
  CheckoutStatus: async function () {
    const stat = `ChatDACS ${this.versionNumber} Based on ${this.os.type()} ${this.os.arch()}
小夜存活了${Math.ceil(process.uptime() / 60 / 60)}小时，吃掉了 ${Math.round(
      process.memoryUsage().rss / 1024 / 1024,
    )}MB/${Math.round(this.os.totalmem() / 1024 / 1024)}MB 内存
这只小夜的领养员 ${this.QQBOT_ADMIN_LIST[0] || '未知'}`
    return stat
  },
}
