module.exports = {
  插件名: '帮助插件',
  指令: '^[/!]?(help|帮助|菜单|说明书|指令|命令|小夜怎么用|docs|command)$',
  版本: '2.5', // 升级版本号
  作者: 'Giftina',
  描述: '会回复系统当前可用插件列表，描述插件版本和对应的使用示例。',
  使用示例: '/help',
  预期返回: '当前插件列表和使用示例：...',

  // 初始化方法，用于依赖注入
  init({logger, plugins}) {
    this.logger = logger
    this.plugins = plugins // 注入插件列表
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    // 针对 docs 指令生成文档
    if (msg === 'docs') {
      let docsMap = {}
      for (const plugin of Object.values(this.plugins)) {
        docsMap[`${plugin.插件名}_v${plugin.版本}`] = {
          使用例: plugin.使用示例,
          预期返回: plugin.预期返回,
          功能描述: plugin.描述,
          作者: plugin.作者,
        }
      }
      return {type: 'text', content: Object2Markdown(docsMap)}
    }

    // 针对 command 指令生成轮播placeholder
    else if (msg === 'command') {
      let docsMap = []
      for (const plugin of Object.values(this.plugins)) {
        docsMap.push(plugin.使用示例)
      }
      return {type: 'text', content: `"${docsMap.join('","')}"`}
    }

    // 默认返回插件列表
    let pluginList = ['当前插件列表和使用示例：']
    for (const plugin of Object.values(this.plugins)) {
      pluginList.push(`${plugin.插件名}_v${plugin.版本}: ${plugin.使用示例}`)
    }

    // 附上qq端特有的功能说明
    pluginList.push(`
QQ群专有功能：
闭菊 张菊@小夜
孤寡 @孤寡对象
强制迫害 @对象 说了什么 小夜说了什么

QQ地雷战：
埋地雷
踩地雷
希望的花 @希望目标
击鼓传雷`)

    return {type: 'text', content: pluginList.join('\n')}
  },
}

// 将生成的插件对象转换为markdown表格
function Object2Markdown(docsMap) {
  let markdown = '| 插件名 | 使用示例 | 预期返回 | 功能描述 | 作者 |\n'
  markdown += '|--------|----------|----------|----------|------|\n'
  for (const i in docsMap) {
    markdown += `| \`${i}\` | \`${docsMap[i].使用例}\` | ${docsMap[i].预期返回} | ${docsMap[i].功能描述} | ${docsMap[i].作者} |\n`
  }
  return markdown
}
