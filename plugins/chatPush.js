module.exports = {
  插件名: '微信息知频道消息推送插件',
  指令: '^推送',
  版本: '3.0',
  作者: 'Giftina',
  描述: '将指定格式的消息推送至微信息知指定频道，适合传送消息至微信。',
  使用示例: '推送我晚上要手冲',
  预期返回: '好的，已经推送到微信，你晚上要手冲',

  // 初始化方法，用于依赖注入
  init({axios, logger, config}) {
    this.axios = axios
    this.logger = logger
    this.config = config
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const XIZHI_CHANNEL_KEY = this.config.ApiKey?.XIZHI_CHANNEL_KEY

    if (!XIZHI_CHANNEL_KEY) {
      this.logger.warn(`${this.插件名} 的接口密钥未配置`)
      return {
        type: 'text',
        content: `${this.插件名} 的接口密钥未配置，请通知小夜主人及时配置接口密钥。方法：在状态栏右键小夜头像，点击 打开配置文件，按接口密钥配置说明进行操作`,
      }
    }

    try {
      const response = await this.axios.get(
        `https://xizhi.qqoq.net/${XIZHI_CHANNEL_KEY}.channel?title=${encodeURI(
          '来自 ' + userName + ' 的消息：' + msg,
        )}`,
      )
      this.logger.info(`消息推送成功: ${response.data}`)
    } catch (error) {
      this.logger.error(`消息推送失败: ${error.message}`)
      return {
        type: 'text',
        content: `推送消息失败，请稍后再试。错误详情：${error.message}`,
      }
    }

    return {
      type: 'text',
      content: `好的，已经推送到微信，${msg.replace(/我/g, '你').replace('推送', '')}`,
    }
  },
}
