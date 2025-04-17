module.exports = {
  插件名: '疯狂星期四插件',
  指令: '疯狂星期四',
  版本: '2.0',
  作者: 'Giftina',
  描述: '全自动学习关于 `疯狂星期四` 的语料。只要聊天对话中包含了 `疯狂星期四` ，就会自动学习之，并且回复一段其他的语料。',
  使用示例:
    '世上77亿人，有253亿只鸡，是人数量三倍。如果鸡与人类开战，你必须要对抗3只鸡，就算它死了，又会有同类补上，就算你一个朋友都没有，你还有三只鸡做敌。今天是肯德基疯狂星期四，V我50，我帮你杀敌',
  预期返回:
    '我本是显赫世家的大少，却被诡计多端的奸人所害！家人弃我！师门逐我！甚至断我灵脉!重生一世，今天肯德基疯狂星期四!谁请我吃？家人们，别他*垂头丧气了 知道今天是什么日子吗？ 今天是肯德基fucking crazy Thursday！大鸡腿29.9两块 ，家人们v我299，我他*要吃20个。',

  // 初始化方法，用于依赖注入
  init({logger, utils, config}) {
    this.logger = logger
    this.utils = utils
    this.ChatModel = utils.ChatModel
    this.CHAT_BAN_WORDS = config.CHAT_BAN_WORDS || [] // 从配置中获取违禁词
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const teachMsgChecked = msg.replace(/'/g, '') // 防爆

    // 获取现有疯狂星期四语料量
    if (teachMsgChecked === '疯狂星期四 -length') {
      const corpus = await this.ChatModel.findAndCountAll({
        where: {
          ask: '疯狂星期四',
        },
      })
      return {type: 'text', content: `小夜现有${corpus.count}条疯狂星期四的语料`}
    }

    // 对于 "疯狂星期四" 视为仅触发语料回复，不学习
    if (teachMsgChecked !== '疯狂星期四') {
      for (let i in this.CHAT_BAN_WORDS) {
        if (teachMsgChecked.toLowerCase().indexOf(this.CHAT_BAN_WORDS[i].toLowerCase()) !== -1) {
          this.logger.warn(`疯狂星期四插件: 检测到不允许的词: ${this.CHAT_BAN_WORDS[i]}，退出教学`)
          return {type: 'text', content: '你教的疯狂星期四里有主人不允许小夜学习的词qwq'}
        }
      }
      if (teachMsgChecked.length > 350) {
        // 图片长度差不多是350左右
        this.logger.warn('疯狂星期四插件: 教的太长了，退出教学')
        return {type: 'text', content: '你教的疯狂星期四太长了，小夜要坏掉了qwq，不要呀'}
      }

      // 到这里都没有出错的话就视为没有问题，可以让小夜学了
      this.logger.info('疯狂星期四插件: 没有检测到问题，可以学习')

      await this.ChatModel.create({ask: '疯狂星期四', answer: teachMsgChecked}).then(() => {
        this.logger.info('疯狂星期四插件: 学习成功')
      })
    }

    // 随机回复一段疯狂星期四
    return {type: 'text', content: await this.utils.FullContentSearchAnswer('疯狂星期四')}
  },
}
