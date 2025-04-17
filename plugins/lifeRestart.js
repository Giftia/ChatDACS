module.exports = {
  插件名: '人生重开模拟器插件',
  指令: '^[/!]?人生重开$|^[/!]?选择天赋 (.*)|^[/!]?分配属性 (.*)|^[/!]?人生总结$',
  版本: '1.2', // 升级版本号
  作者: 'Giftina',
  描述: '一个人生重开模拟器，区别于原作，该版本非常真实。原作 https://github.com/VickScarlet/lifeRestart',
  使用示例: '人生重开',
  预期返回: '[人生重开的结果]',

  // 初始化方法，用于依赖注入
  init({logger, fs, path}) {
    this.logger = logger
    this.fs = fs
    this.path = path
    this.userData = {} // 用于记录玩家的游戏存档
    this.gradeIconMaps = {
      0: '💔',
      1: '🤍',
      2: '💛',
      3: '💖',
    }
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    let reply = ''

    if (/^[/!]?人生重开$/.test(msg)) {
      reply = await this.LifeRestart(userId, userName)
    } else if (/^[/!]?选择天赋 (.*)/.test(msg)) {
      reply = await this.SelectTalents(msg, userId, userName)
    } else if (/^[/!]?分配属性 (.*)/.test(msg)) {
      reply = this.SetPoints(msg, userId, userName)
    } else if (/^[/!]?人生总结$/.test(msg)) {
      reply = await this.LifeSummary(userId, userName)
    }

    return {type: 'text', content: reply}
  },

  // 人生重开
  LifeRestart: async function (userId, userName) {
    const talents = this.fs.readFileSync(this.path.join(process.cwd(), 'config', 'talents.json'), 'utf-8')

    const {randomTalents, talentsList} = await this.Talents10x(talents)

    this.logger.info(`玩家 ${userId} 抽选10个随机天赋: ${randomTalents}`)

    if (!this.userData[userId]) {
      this.userData[userId] = {talentsList, points: ''}
    } else {
      this.userData[userId].talentsList = talentsList
    }

    return `${userName} 天赋10连抽:
${randomTalents}

请发送 选择天赋 天赋序号`
  },

  // 选择天赋
  SelectTalents: async function (msg, userId, userName) {
    const assertTalentsID = msg.match(/^[/!]?选择天赋 (.*)/)[1]?.split(' ')
    const talentsList = this.userData[userId]?.talentsList

    if (!talentsList) {
      return '请先发送 人生重开 以开始游戏。'
    }

    const selectedTalentsIDs = assertTalentsID.map((id) => talentsList[parseInt(id, 10)])

    this.userData[userId].talentsList = selectedTalentsIDs

    const talents = JSON.parse(this.fs.readFileSync(this.path.join(process.cwd(), 'config', 'talents.json'), 'utf-8'))

    const selectedTalents = selectedTalentsIDs.map((id) => {
      const talent = talents[Object.keys(talents)[id]]
      const grade = this.gradeIconMaps[talent?.grade || 0]
      return `\n${grade}${talent.description}`
    })

    return `${userName} 天赋生效:
${selectedTalents.join('')}

请发送 分配属性 属性值，属性值之间以空格隔开`
  },

  // 分配属性
  SetPoints: function (msg, userId, userName) {
    const assertPoints = msg.match(/^[/!]?分配属性 (.*)/)[1]?.split(' ')
    const points = assertPoints.map((p) => parseInt(p, 10) || 0)

    this.userData[userId].points = points

    return `${userName} 已分配属性点:

颜值: ${points[0]}
智力: ${points[1]}
体质: ${points[2]}
家境: ${points[3]}

你的新人生开始了:

0 岁: 体质过低，胎死腹中。
你死了。

请发送 人生总结`
  },

  // 人生总结
  LifeSummary: async function (userId, userName) {
    const points = this.userData[userId]?.points

    if (!points) {
      return '请先发送 人生重开 以开始游戏。'
    }

    return `${userName} 人生总结:

颜值: ${points[0]} 罕见
智力: ${points[1]} 罕见
体质: ${points[2]} 罕见
家境: ${points[3]} 罕见
快乐: 0 罕见
享年: 0 罕见
总评: ${points.reduce((a, b) => a + b, 0)} 罕见

感谢您的重开，欢迎您下次光临`
  },

  // 抽10个天赋
  Talents10x: async function (data) {
    const talents = JSON.parse(data)
    const talentsLength = Object.keys(talents).length

    let randomTalents = ''
    const talentsList = []

    for (let i = 0; i < 10; i++) {
      const randomTalentIndex = Math.floor(Math.random() * talentsLength)
      const talent = talents[Object.keys(talents)[randomTalentIndex]]
      const grade = this.gradeIconMaps[talent?.grade || 0]
      randomTalents += `\n${i} ${grade}${talent.name}（${talent.description}）`
      talentsList.push(randomTalentIndex)
    }

    return {randomTalents, talentsList}
  },
}
