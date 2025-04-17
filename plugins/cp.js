module.exports = {
  插件名: 'cp文生成插件',
  指令: '^[/!]?cp(.*)',
  版本: '3.0',
  作者: 'Giftina',
  描述: 'cp文生成器，生成一段简单的 cp 文。简简单单，就是最好的爱。语料来自 https://github.com/mxhcpstories/mxh-cp-stories/blob/master/src/assets/story.json',
  使用示例: 'cp 小夜 小雫',
  预期返回: '小夜，小雫，你们的爱情是什么样子？',

  // 初始化方法，用于依赖注入
  init({logger, fs, path}) {
    this.logger = logger
    this.fs = fs
    this.path = path
    this.storyFilePath = this.path.join(process.cwd(), 'config', '1and0story.json') // 配置文件路径
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const CP = new RegExp(this.指令).exec(msg)[1]?.split(' ')

    const tops = CP[1]?.trim() ?? userName ?? '小夜' // 小攻
    const bottoms = CP[2]?.trim() ?? userName ?? '小雫' // 小受

    try {
      const CPStory = await this.getReplacedCPStory(tops, bottoms)
      return {type: 'text', content: CPStory}
    } catch (error) {
      this.logger.error(`生成 CP 文时出错: ${error.message}`)
      return {type: 'text', content: '生成 CP 文时出错，请稍后再试。'}
    }
  },

  // 获取替换后的 CP 文
  getReplacedCPStory: async function (tops, bottoms) {
    try {
      const storyData = this.fs.readFileSync(this.storyFilePath, 'utf-8')
      const story = JSON.parse(storyData)

      const originalRandomCPStory = await this.getOriginalRandomCPStory(story, tops, bottoms)

      // 替换角色
      let replacedCPStory = originalRandomCPStory?.replace(/<攻>/g, tops)
      replacedCPStory = replacedCPStory?.replace(/<受>/g, bottoms)
      return replacedCPStory
    } catch (error) {
      this.logger.error(`读取或解析 CP 文配置文件时出错: ${error.message}`)
      throw new Error('无法读取或解析 CP 文配置文件')
    }
  },

  // 获取原始随机 CP 文
  getOriginalRandomCPStory: async function (story, tops, bottoms) {
    // 首先查询是否有完全匹配的 CP 文
    for (let i in story) {
      if (tops === story[i].roles.gong || bottoms === story[i].roles.shou) {
        // 从待选 CP 文中选择一条
        const storyLength = story[i].stories.length - 1
        const storyIndex = Math.round(Math.random() * storyLength)
        return story[i].stories[storyIndex]
      }
    }

    // 如果没有完全匹配的 CP 文，则发送位于 CP 文数组最后的随机 CP 文
    const lastIndex = story.length - 1
    const storyLength = story[lastIndex].stories.length - 1
    const storyIndex = Math.round(Math.random() * storyLength)
    return story[lastIndex].stories[storyIndex]
  },
}
