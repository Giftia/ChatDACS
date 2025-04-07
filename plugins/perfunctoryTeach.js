module.exports = {
  插件名: '敷衍语料教学插件',
  指令: '^[/!]?说不出话 (.*)',
  版本: '2.3', // 升级版本号
  作者: 'Giftina',
  描述: '敷衍语料教学，教给小夜一些比较通用的回复。对于一些难以回复的对话，小夜的词库中没有搜索到回复的时候，小夜会随机回复这些回复作为敷衍，回复了，但完全没有回复的意义。',
  使用示例: '说不出话 ？',
  预期返回: '哇！小夜学会啦！小夜可能在说不出话的时候回复 ？ 噢',

  // 初始化方法，用于依赖注入
  init({logger, config, PerfunctoryModel}) {
    this.logger = logger
    this.CHAT_BAN_WORDS = config.CHAT_BAN_WORDS || []
    this.PerfunctoryModel = PerfunctoryModel
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const teachMsg = new RegExp(this.指令).exec(msg)[1]
    const teachMsgChecked = teachMsg.replace(/'/g, '') // 防爆

    this.logger.info(`${userId}(${userName}) 想要教给小夜敷衍语料: ${teachMsgChecked}，现在开始检测合法性`)

    // 检测是否包含违禁词
    for (let i in this.CHAT_BAN_WORDS) {
      if (teachMsgChecked.toLowerCase().includes(this.CHAT_BAN_WORDS[i].toLowerCase())) {
        this.logger.warn(`敷衍语料教学: 检测到不允许的词: ${this.CHAT_BAN_WORDS[i]}，退出教学`)
        return {
          type: 'text',
          content: '你教的内容里有主人不允许小夜学习的词qwq',
        }
      }
    }

    this.logger.info('敷衍语料教学: 没有检测到问题，可以学习')

    // 保存语料到数据库
    try {
      await this.PerfunctoryModel.create({content: teachMsgChecked})
      this.logger.info('敷衍语料教学: 学习成功')
    } catch (error) {
      this.logger.error(`敷衍语料教学: 保存语料失败 -> ${error.message}`)
      return {
        type: 'text',
        content: '保存语料失败，请稍后再试。',
      }
    }

    return {
      type: 'text',
      content: `哇！小夜学会啦！小夜可能在说不出话的时候回复 ${teachMsgChecked} 噢`,
    }
  },
}
