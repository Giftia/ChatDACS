module.exports = {
  插件名: '一个手雷插件',
  指令: '^[/!]?一[个颗]手雷(.*)',
  版本: '2.2', // 升级版本号
  作者: 'Giftina',
  描述: 'QQ群专有功能。向被害者丢出一个手雷，一位幸运玩家将会被炸伤 0 到 120 秒（禁言）。有千分之一的概率手雷会转化为神圣手雷（Holly Hand Grenade），将会炸伤所有无辜群友（全体禁言）。手雷有60%几率成功丢出，40%几率被自己炸伤。玩家当日投掷次数每增加1，自雷概率增加10%，当日有效。',
  使用示例: '一个手雷 @被害者',
  预期返回: '[被害者和投弹者概率被禁言]',

  // 初始化方法，用于依赖注入
  init({logger, axios, utils, Constants, config}) {
    this.logger = logger
    this.axios = axios
    this.utils = utils
    this.Constants = Constants
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (options.type !== 'qq') {
      return 0
    }

    let target, reply

    // 神圣手雷的概率为1%
    const isHollyHandGrenade = Math.floor(Math.random() * 100) < 1

    // 获取玩家当日手雷次数，以此计算手雷成功概率
    const userPlayedTimes = await this.utils.GetUserHandGrenadeTimesToday(userId)
    if (userPlayedTimes === 0) {
      this.logger.info('玩家今天没有投掷过手雷，初始化今日手雷次数')
      await this.utils.IncreaseHandGrenadePlayedTimes(userId, 1)
    } else {
      this.logger.info(`玩家今天已经投掷过${userPlayedTimes}次手雷`)
      await this.utils.IncreaseHandGrenadePlayedTimes(userId, userPlayedTimes + 1)
    }

    // 手雷成功概率，60%几率成功丢出，40%几率被自己炸伤。玩家当日投掷次数每增加1，自雷概率增加10%
    const successfullyThrown = Math.floor(Math.random() * 100) + userPlayedTimes * 10 < 60

    // 造成伤害时间，2分钟内
    const boomTime = Math.floor(Math.random() * 60 * 2)

    // 判断是否神圣手雷
    if (isHollyHandGrenade) {
      this.logger.error(`${userId} 在群 ${groupId} 触发了神圣手雷`)
      await this.axios.get(`http://${this.ONE_BOT_API_URL}/set_group_whole_ban?group_id=${groupId}&enable=1`)
      return {
        type: 'text',
        content:
          '噢，该死，我的上帝啊，真是不敢相信，瞧瞧我发现了什么，我发誓我没有看错，这竟然是一颗出现率为千分之一的神圣手雷！我是说，这是一颗毁天灭地的神圣手雷啊！哈利路亚！麻烦管理员解除一下',
      }
    }

    // 是常规手雷
    if (msg === '一个手雷') {
      this.logger.info(`群 ${groupId} 的群员 ${userId} 朝自己丢出一颗手雷`)
      target = userId
      reply = `[CQ:at,qq=${userId}]面无表情地朝自己丢出一颗手雷，造成了${boomTime}秒的伤害`
    } else if (this.Constants.has_qq_reg.exec(msg)) {
      const specifiedTarget = this.Constants.has_qq_reg.exec(msg)[1]
      target = specifiedTarget
      this.logger.info(`群 ${groupId} 的群员 ${userId} 尝试向 ${target} 丢出一颗手雷`)
    } else {
      this.logger.info(`没有指定正确的目标，群 ${groupId} 的群员 ${userId} 朝自己丢出一颗手雷`)
      target = userId
      reply = `[CQ:at,qq=${userId}]没有指定受害者，混乱中朝空中丢出一颗手雷，对自己造成了${boomTime}秒的伤害`
    }

    // 判断手雷是否成功丢出
    if (!successfullyThrown && target !== userId) {
      this.logger.info(`群 ${groupId} 的 群员 ${userId} 的手雷炸到了自己`)
      target = userId
      reply = `[CQ:at,qq=${userId}]小手一滑，被自己丢出的手雷炸伤，造成了${boomTime}秒的伤害，苍天有轮回，害人终害己，你的自雷几率现在是${
        40 + (userPlayedTimes <= 3 ? 0 : userPlayedTimes) * 10
      }%，祝你下次好运`
    } else {
      this.logger.info(`群 ${groupId} 的 群员 ${userId} 的手雷成功炸到了 ${target}`)
      reply =
        reply ||
        `恭喜 [CQ:at,qq=${target}]被 [CQ:at,qq=${userId}]丢出的手雷炸伤，造成了${boomTime}秒的伤害，祝你下次好运`
    }

    await this.axios.get(
      `http://${this.ONE_BOT_API_URL}/set_group_ban?group_id=${groupId}&user_id=${target}&duration=${boomTime}`,
    )
    return {type: 'text', content: reply}
  },
}
