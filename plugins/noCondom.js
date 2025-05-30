module.exports = {
  插件名: '今日不带套插件',
  指令: '^今[日天]不[带戴]套$',
  版本: '2.1', // 升级版本号
  作者: 'Giftina',
  描述: '2018年七夕节彩蛋功能，让小夜帮你计算今天不带套的结果，仅供娱乐。',
  使用示例: '今天不带套',
  预期返回: '小夜温馨提示您: 今日不戴套，小小夜酱 金牛座，属兔，2041年高考，一本机率约43%',

  // 初始化方法，用于依赖注入
  init({logger, utils}) {
    this.logger = logger
    this.utils = utils
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (!userName) userName = '小夜'

    const now = new Date()
    let year = now.getFullYear()
    let month = now.getMonth() + 1
    let day = now.getDate()

    // 如果当前月份大于2月，年份加1
    if (month > 2) {
      year++
    }

    // 星座计算
    const starSetName = '魔羯水瓶双鱼牡羊金牛双子巨蟹狮子处女天秤天蝎射手魔羯'
    const starSetDays = [20, 19, 21, 21, 21, 22, 23, 23, 23, 23, 22, 22]
    const starSetResult = starSetName.substr(month * 2 - (day < starSetDays[month - 1] ? 2 : 0), 2)

    // 生肖计算
    const theTwelveChineseZodiacSigns = ['猴', '鸡', '狗', '猪', '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊']
    const theTwelveChineseZodiacSignsResult = theTwelveChineseZodiacSigns[year % 12]

    // 一本概率计算
    const admittedToKeyUniversitiesProbability = this.utils.getRandomInt(20, 99)

    // 最终结果
    const final = `小夜温馨提示您: 今日不戴套，小${userName}酱 ${starSetResult}座，属${theTwelveChineseZodiacSignsResult}，${
      year + 18
    }年高考，一本机率约${admittedToKeyUniversitiesProbability}%`

    this.logger.info(`今日不带套结果生成: ${final}`)
    return {type: 'text', content: final}
  },
}
