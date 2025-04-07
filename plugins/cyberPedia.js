module.exports = {
  插件名: '赛博百科问答插件',
  指令: '^[/!]?赛博朋克(.*)',
  版本: '2.1',
  作者: 'Giftina',
  描述: '非常赛博朋克的百科知识问答题',
  使用示例: '赛博朋克',
  预期返回: '大明湖畔位于哪个城市？ 请按如下格式回答: 赛博朋克 你的答案',

  // 初始化方法，用于依赖注入
  init({logger, request, config}) {
    this.logger = logger
    this.request = request
    this.TIAN_XING_API_KEY = config.TIAN_XING_API_KEY // 从扁平化的 config 中获取 API 密钥
    this.answer = null // 用于存储当前问题的答案
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (!this.TIAN_XING_API_KEY) {
      return {
        type: 'text',
        content: `${this.插件名} 的接口密钥未配置，请通知小夜主人及时配置接口密钥。方法：在状态栏右键小夜头像，点击 打开配置文件，按接口密钥配置说明进行操作`,
      }
    }

    // 如果消息包含答案
    if (msg.split(' ').length > 1) {
      const userAnswer = msg.split(' ')[1]
      if (userAnswer === this.answer) {
        return {type: 'text', content: `回答正确！答案是 ${this.answer}`}
      } else {
        return {type: 'text', content: `回答错误，答案是 ${this.answer}`}
      }
    }

    // 如果消息仅为 "赛博朋克"，获取新问题
    try {
      const cyberPedia = await this.CyberPedia()
      const question = `${cyberPedia.question} 请按如下格式回答: 赛博朋克 你的答案`
      this.SaveAnswer(cyberPedia.result) // 保存答案
      return {type: 'text', content: question}
    } catch (error) {
      this.logger.error(`获取赛博百科问答时出错: ${error.message}`)
      return {type: 'text', content: '获取赛博百科问答时出错，请稍后再试。'}
    }
  },

  // 保存答案
  SaveAnswer: function (cyberPediaAnswer) {
    this.answer = cyberPediaAnswer
  },

  // 获取赛博百科问答
  CyberPedia: function () {
    return new Promise((resolve, reject) => {
      this.request(`http://api.tianapi.com/txapi/wenda/index?key=${this.TIAN_XING_API_KEY}`, (err, response, body) => {
        if (err) {
          reject(new Error('获取赛博百科问答错误，是天行接口的锅。'))
          return
        }

        try {
          body = JSON.parse(body)
          if (body.code === 200 && body.newslist && body.newslist.length > 0) {
            resolve({
              question: body.newslist[0].quest,
              result: body.newslist[0].result,
            })
          } else {
            reject(new Error('天行接口返回数据格式错误或无数据。'))
          }
        } catch (parseError) {
          reject(new Error('解析天行接口返回数据时出错。'))
        }
      })
    })
  },
}
