module.exports = {
  插件名: '报错插件',
  指令: '^[/!]?报错 (.*)',
  版本: '3.0',
  作者: 'Giftina',
  描述: '向小夜开发组报错消息，消息会实时转达到小夜开发成员',
  使用示例: '报错 插件爆炸了',
  预期返回: `谢谢您的报错，小夜已经把您的报错信息 插件爆炸了 发给了小夜开发群157311946啦`,

  // 初始化方法，用于依赖注入
  init({sendMessageToQQGroup, logger, config}) {
    this.sendMessageToQQGroup = sendMessageToQQGroup
    this.logger = logger
    this.config = config
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const feedback = new RegExp(this.指令).exec(msg)[1]
    const feedbackContext = `用户 ${userId}(${userName}) 报告了错误：${feedback}`

    if (this.config.CONNECT_ONE_BOT_SWITCH) {
      try {
        await this.sendMessageToQQGroup(feedbackContext, {group_id: 157311946})
        this.logger.info(`报错信息已发送到开发群: ${feedbackContext}`)
      } catch (error) {
        this.logger.error(`发送报错信息失败: ${error.message}`)
        return {
          type: 'text',
          content: `报错信息发送失败，请稍后再试。错误详情：${error.message}`,
        }
      }
    }

    return {
      type: 'text',
      content: `谢谢您的报错，小夜已经把您的报错信息 ${feedback} 发给了小夜开发群157311946啦`,
    }
  },
}
