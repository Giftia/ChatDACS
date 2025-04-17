module.exports = {
  插件名: '聊天教学插件',
  指令: '^问：(?<ask>.*)答：(?<answer>.*)',
  版本: '3.0',
  作者: 'Giftina',
  描述: '来调教小夜说话吧！帮助小夜养成由数万用户调教练就的嘴臭词库。当小夜收到含有 `关键词` 的语句时便会有几率触发回复。若该关键词有多个回复，将会随机选择一个回复。支持图片问答。',
  使用示例: '问：HELLO 答：WORLD',
  预期返回: '哇!小夜学会啦!对我说: HELLO 试试吧，小夜有可能会回复 WORLD 噢',

  // 初始化方法，用于依赖注入
  init({logger, config, utils}) {
    this.logger = logger
    this.utils = utils
    this.CHAT_BAN_WORDS = config.CHAT_BAN_WORDS || [] // 从配置中获取违禁词
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const teachMsgChecked = msg.replace(/'/g, '') // 防爆
    const teachMsgMatched = new RegExp(this.指令).exec(teachMsgChecked)
    if (!teachMsgMatched) {
      this.logger.warn('聊天教学插件: 正则匹配失败，退出教学')
      return {type: 'text', content: '你教的姿势好像不对噢qwq'}
    }

    const ask = teachMsgMatched.groups.ask.trim()
    const answer = teachMsgMatched.groups.answer.trim()

    this.logger.info(`${userId} ${userName} 想要教给小夜: ${msg}，现在开始检测合法性`)

    // 检测语料合法性
    const teachMsgCheck = this.CheckTeachMsg(ask, answer)
    if (teachMsgCheck !== true) {
      this.logger.warn(`聊天教学插件：非法的违禁词${teachMsgCheck}，退出教学`)
      return {type: 'text', content: teachMsgCheck}
    }

    this.logger.info('聊天教学插件: 没有检测到问题，可以学习')
    await this.utils.CreateOneConversation(ask, answer, userId, groupId, options.type)
    this.logger.info(`聊天教学插件: 学习成功，关键词: ${ask}，回答: ${answer}`)

    return {
      type: 'text',
      content: `哇！小夜学会啦！小夜在聊天中看见 ${ask} 时可能会回复 ${answer} 噢`,
    }
  },

  // 检测语料合法性
  CheckTeachMsg: function (ask, answer) {
    if (ask == '' || answer == '') {
      this.logger.warn('问/答为空，退出教学')
      return '你教的关键词或者回答好像是空的噢qwq'
    }

    if (ask.indexOf(/\r?\n/g) !== -1) {
      this.logger.warn('聊天教学插件: 关键词换行了，退出教学')
      return '关键词不能换行啦qwq'
    }

    for (let i in this.CHAT_BAN_WORDS) {
      if (
        ask.toLowerCase().indexOf(this.CHAT_BAN_WORDS[i].toLowerCase()) !== -1 ||
        answer.toLowerCase().indexOf(this.CHAT_BAN_WORDS[i].toLowerCase()) !== -1
      ) {
        this.logger.warn(`聊天教学插件: 检测到不允许的词: ${this.CHAT_BAN_WORDS[i]}，退出教学`)
        return '你教的内容里有主人不允许小夜学习的词qwq'
      }
    }

    if (Buffer.from(ask).length < 4) {
      // 关键词最低长度: 4个英文或2个汉字
      this.logger.warn('聊天教学插件: 关键词太短，退出教学')
      return '关键词太短了啦qwq，至少要4个英文或2个汉字啦'
    }

    if (ask.length > 350 || answer.length > 350) {
      // 图片长度差不多是350左右
      this.logger.warn('聊天教学插件: 教的太长了，退出教学')
      return '你教的内容太长了，小夜要坏掉了qwq，不要呀'
    }

    return true
  },
}
