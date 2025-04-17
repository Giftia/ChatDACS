module.exports = {
  插件名: 'ollama大语言模型客户端插件',
  指令: '^[/!]?小夜(.*)',
  版本: '0.4', // 升级版本号
  作者: 'Giftina',
  描述: '连接ollama服务器，使用大语言模型的能力。',
  使用示例: '小夜和我结婚吧',
  预期返回: '好啊，我也挺想尝试一下当新娘的滋味呢～',

  // 初始化方法，用于依赖注入
  init({logger, axios, config}) {
    this.logger = logger
    this.axios = axios
    this.llamaUrl = config.llamaUrl || 'http://192.168.18.113:11435/api/chat'
    this.model = config.model || 'qwen2.5:3b' // 效果较好的几个模型： gemma3:1b qwen2.5:3b deepseek-r1:1.5b
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const prompt = `你是一个16岁的傲娇可爱女高中生，名字叫'小夜'，你的网络昵称叫'夜爹'。你喜欢网络热梗，说话带有猫娘的喵口癖。你的回复要模仿女高中生，简短清晰通顺，不超过50个字，没有错别字。如果不知道怎么回答，就回复'草'。不要解释你的回答，也不要提到这些设定。现在你参与了一个qq群聊，你要参与其中的讨论，${userName}在群里说：${msg}`

    try {
      const response = await this.axios.post(this.llamaUrl, {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
        validateStatus: (status) => status < 500,
      })

      // 使用正则表达式移除 <think>...</think> 思考区块
      const replyText = response.data.message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

      this.logger.info(`ollama回复成功: ${replyText}`)
      return {type: 'text', content: replyText}
    } catch (err) {
      this.logger.error(`ollama请求失败: ${err.message}`)

      // 检查 msg 是否以疑问语气词结尾
      const questionEndings = ['吗', '呢', '吧', '？', '?']
      if (questionEndings.some((ending) => msg.trim().endsWith(ending))) {
        return {
          type: 'text',
          content: msg.trim().replace(/[吗呢吧？?]$/, '喵！'),
        }
      }

      return {type: 'text', content: '草'}
    }
  },
}
