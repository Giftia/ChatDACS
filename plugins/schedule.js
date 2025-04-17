module.exports = {
  插件名: '日程计划提醒插件',
  指令: '^[/!]?提醒(.*)',
  版本: '1.1', // 升级版本号
  作者: 'Giftina',
  描述: '计划提醒功能，会在指定时刻提醒你。',
  使用示例: '提醒我晚上要手冲',
  预期返回: '好的，我会提醒你晚上要手冲',

  // 初始化方法，用于依赖注入
  init({logger, axios, config, schedule, dayjs}) {
    this.logger = logger
    this.axios = axios
    this.schedule = schedule
    this.dayjs = dayjs
    this.ONE_BOT_API_URL = config.ONE_BOT_API_URL
    this.CONNECT_ONE_BOT_SWITCH = config.CONNECT_ONE_BOT_SWITCH
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    const text = new RegExp(this.指令).exec(msg)[1].replace(/我/g, '你')

    // 获取预约天数
    const daySchedule = this.DayToTime(text)

    // 获取预约时间
    const timeSchedule = this.TimeToSchedule(text, daySchedule)

    if (!timeSchedule) {
      // 如果没有匹配到预约时间，则返回错误信息
      return {type: 'text', content: '小夜不知道该什么时候提醒你呢…要指定提醒时间噢'}
    }

    this.logger.info(`创建提醒: ${timeSchedule}`)

    this.schedule.scheduleJob(timeSchedule, async () => {
      this.logger.info(`触发提醒：${text}`)
      if (this.CONNECT_ONE_BOT_SWITCH) {
        await this.axios.get(
          `http://${this.ONE_BOT_API_URL}/send_group_msg?group_id=${groupId}&message=${encodeURI(
            `小夜提醒${userName}：${text}`,
          )}`,
        )
      }
    })

    return {type: 'text', content: `好的，我会提醒${text}`}
  },

  // 天数转换
  DayToTime: function (text) {
    const dayMap = {
      今天: 0,
      明天: 1,
      后天: 2,
    }

    // 统计字符串中，"后天" 前有几个 "大"，1个 "大" 代表1天
    if (text.includes('大后天')) {
      const x后天 = text.match(/后天/g)[0]
      const howManyNextDay = x后天.match(/大/g).length
      return this.dayjs().add(howManyNextDay, 'days')
    }

    // 获取常规天数
    for (const key in dayMap) {
      if (text.includes(key)) {
        return this.dayjs().add(dayMap[key], 'days')
      }
    }

    // 默认返回当天
    return this.dayjs()
  },

  // 时间转换
  TimeToSchedule: function (text, daySchedule) {
    const timeMap = {
      早上: 8,
      中午: 12,
      下午: 15,
      傍晚: 17,
      晚上: 21,
    }

    const delayMap = {
      待会: 10 * 60,
      马上: 10,
    }

    // 将 text 遍历 timeMap
    let hourSchedule = daySchedule
    for (const key in timeMap) {
      if (text.includes(key)) {
        hourSchedule = this.dayjs(daySchedule).set('hour', timeMap[key])
        break
      }
    }

    // 将 text 遍历 delayMap
    let delaySchedule = hourSchedule
    for (const key in delayMap) {
      if (text.includes(key)) {
        delaySchedule = this.dayjs(hourSchedule).add(delayMap[key], 'seconds')
        break
      }
    }

    // 最后.toDate();
    return delaySchedule.toDate()
  },
}
