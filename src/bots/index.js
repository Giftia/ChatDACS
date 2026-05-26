/**
 * 机器人集成模块主入口
 * 导出所有机器人平台的集成模块
 */

const {StartQQBot} = require('./qq')
const {ProcessGuildMessage, StartQQGuild} = require('./qqGuild')
const {StartLive} = require('./bilibili')
const {StartTelegram} = require('./telegram')

module.exports = {
  StartQQBot,
  ProcessGuildMessage,
  StartQQGuild,
  StartLive,
  StartTelegram,
}
