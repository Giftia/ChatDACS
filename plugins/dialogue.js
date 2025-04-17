module.exports = {
  插件名: '名场面插件',
  指令: '^[/!]?名场面 (.*)',
  版本: '1.3', // 升级版本号
  作者: 'Giftina',
  描述: '根据字幕台词搜索名场面出处，原作：https://github.com/windrises/dialogue.moe',
  使用示例: '名场面 不能逃避',
  预期返回: '原作：福音战士新剧场版：序 不能逃避…不能逃避…不能逃避… 不能逃避…不能逃避…不能逃避… 不能逃避',

  // 初始化方法，用于依赖注入
  init({axios, logger}) {
    this.axios = axios
    this.logger = logger
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const text = new RegExp(this.指令).exec(msg)[1]
    this.logger.info(`名场面插件: 搜索台词 -> ${text}`)

    try {
      const response = await this.axios({
        url: 'https://api.dialogue.moe/',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        data: {
          text: text,
          duplicate: true,
        },
      })

      if (response.data.total === 0) {
        return {type: 'text', content: '没有找到这样的名场面，换个名场面试试吧！'}
      } else {
        // 随机从 res.data.dialogues 数组中取一组对话
        const dialogue = response.data.dialogues[Math.floor(Math.random() * response.data.dialogues.length)]

        const result = `原作：${dialogue.subject_name}
:━━━━●${dialogue.time_current}────:
  ⇆         ◁        ❚❚        ▷          ↻

          正 在 播 放 名 场 面

  - ${dialogue.text_before}
  - ${dialogue.text_current}
  - ${dialogue.text_after}
`

        return {type: 'text', content: result}
      }
    } catch (error) {
      this.logger.error(`名场面插件: 搜索失败 -> ${error.message}`)
      return {type: 'text', content: '搜索失败，请稍后再试。'}
    }
  },
}
