module.exports = {
  插件名: '舞立方信息查询插件',
  指令: '^[/!]?(绑定|个人信息|战绩|插眼|我要出勤)(.*)',
  版本: '2.4',
  作者: 'Giftina',
  描述: '舞立方信息查询，可以查询玩家信息以及机台状态。数据来源以及素材版权归属 胜骅科技 https://www.arccer.com/ ，如有侵权请联系作者删除。',
  使用示例: '个人信息',
  预期返回: '[炫酷的舞立方个人信息图片]',

  // 初始化方法，用于依赖注入
  init({logger, config, axios, path, fs, DanceCubeModel, canvas, baiduGeocodingAk}) {
    this.logger = logger
    this.config = config
    this.axios = axios
    this.path = path
    this.fs = fs
    this.DanceCubeModel = DanceCubeModel
    this.canvas = canvas
    this.baiduGeocodingAk = baiduGeocodingAk

    this.authorization = config.authorization
    this.baseURL = 'https://dancedemo.shenghuayule.com/'
    this.headers = {
      Authorization: this.authorization,
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Html5Plus/1.0 (Immersed/44) uni-app',
      Host: 'dancedemo.shenghuayule.com',
      Referer: this.baseURL,
    }
    this.api = {
      playerInfo: `${this.baseURL}Dance/api/User/GetInfo`,
      playerRank: `${this.baseURL}Dance/api/User/GetMyRank`,
      geocoding: 'https://api.map.baidu.com/geocoding/v3',
      machineListByLocation: `${this.baseURL}Dance/OAuth/GetMachineListByLocation`,
    }
  },

  // 插件执行逻辑
  execute: async function (msg, userId, userName, groupId, groupName, options) {
    let reply = ''
    const args = msg.split(' ') ?? []

    // 绑定
    if (/^[/!]?绑定(.*)/.test(msg)) {
      const playerId = args[1]
      if (!playerId) {
        return {type: 'text', content: '好像没有输入舞立方账号呢，绑定指令类似这样：绑定 823258'}
      }
      reply = await this.BindUser(userId, playerId)
    }
    // 个人信息
    else if (/^[/!]?个人信息(.*)/.test(msg)) {
      let playerId = args[1]
      const playerData = await this.DanceCubeModel.findOne({where: {userId}})
      if (!playerId) {
        if (!playerData) {
          return {type: 'text', content: '你还没有绑定舞立方账号呢，请使用指令 绑定 玩家ID 来绑定你的舞立方账号'}
        } else {
          playerId = playerData.playerId
        }
      }
      reply = await this.AnalysisPlayerInfo(playerId)
    }
    // 战绩
    else if (/^[/!]?战绩(.*)/.test(msg)) {
      let playerId = args[1]
      const playerData = await this.DanceCubeModel.findOne({where: {userId}})
      if (!playerId) {
        if (!playerData) {
          return {type: 'text', content: '你还没有绑定舞立方账号呢，请使用指令 绑定 玩家ID 来绑定你的舞立方账号'}
        } else {
          playerId = playerData.playerId
        }
      }
      const musicIndex = args[2] || 6 // 默认音乐类型
      reply = await this.GetPlayerRank(playerId, musicIndex)
    }
    // 插眼
    else if (/^[/!]?插眼(.*)/.test(msg)) {
      const playerData = await this.DanceCubeModel.findOne({where: {userId}})
      if (!playerData) {
        return {type: 'text', content: '你还没有绑定舞立方账号呢，请使用指令 绑定 玩家ID 来绑定你的舞立方账号'}
      } else if (!args[1]) {
        return {type: 'text', content: '好像没有指定地名噢，请发送 插眼 地名 在指定位置插眼吧'}
      }
      const location = args[1]
      reply = await this.Geocoding(userId, location)
    }
    // 我要出勤
    else if (/^[/!]?我要出勤/.test(msg)) {
      const playerData = await this.DanceCubeModel.findOne({where: {userId}})
      if (!playerData) {
        return {type: 'text', content: '你还没有绑定舞立方账号呢，请使用指令 绑定 玩家ID 来绑定你的舞立方账号'}
      } else if (!playerData.location) {
        return {type: 'text', content: '你还没有插眼呢，禁止出勤，请发送 插眼 地名 在指定位置插眼吧'}
      }
      reply = await this.GoGoGo(userId)
    }

    return {type: 'text', content: reply}
  },

  // 玩家绑定
  BindUser: async function (userId, playerId) {
    const playerInfo = await this.GetPlayerInfo(playerId)
    if (playerInfo.error) {
      return `获取玩家资料失败：${playerInfo.error}，可能是authorization.token已经过期，需 @机器人管理员 重新获取`
    }

    const {lng, lat} = await this.BaiduGeocoding(playerInfo.CityName)
    const location = lng && lat ? {lng, lat} : {lng: 116, lat: 39.9} // 默认北京坐标

    await this.DanceCubeModel.upsert({
      userId,
      playerId,
      playerName: playerInfo.UserName,
      location,
    })

    return `绑定成功，现在你绑定的账号是 ${playerInfo.UserName}`
  },

  // 获取玩家信息
  GetPlayerInfo: async function (playerId) {
    try {
      const response = await this.axios.get(this.api.playerInfo, {
        headers: this.headers,
        params: {userId: playerId},
      })
      return response.data
    } catch (error) {
      this.logger.error(`获取玩家资料失败: ${error.message}`)
      return {error: error.message}
    }
  },

  // 百度地理编码
  BaiduGeocoding: async function (address) {
    try {
      const response = await this.axios.get(this.api.geocoding, {
        params: {
          address,
          ak: this.baiduGeocodingAk,
          output: 'json',
        },
      })
      if (response.data.status !== 0) {
        return {error: response.data.message}
      }
      return response.data.result.location
    } catch (error) {
      this.logger.error(`地理编码失败: ${error.message}`)
      return {error: error.message}
    }
  },

  // 插眼
  Geocoding: async function (userId, address) {
    const {lng, lat, error} = await this.BaiduGeocoding(address)
    if (error) {
      return `插眼失败：${error}`
    }

    await this.DanceCubeModel.update({location: {lng, lat}}, {where: {userId}})
    return '插眼成功，发送 我要出勤 查询你附近的机台状态'
  },

  // 查询眼位附近的机台状态
  GoGoGo: async function (userId) {
    const playerData = await this.DanceCubeModel.findOne({where: {userId}, attributes: ['location']})
    const location = playerData.location

    try {
      const response = await this.axios.get(this.api.machineListByLocation, {
        headers: this.headers,
        params: location,
      })
      const machineList = response.data
      return `眼位附近有${machineList.length}台舞立方，下面播报舞立方状态：\n${machineList
        .map((machine) => `${machine.PlaceName} - ${machine.Online ? '在线' : '离线'}`)
        .join('\n')}`
    } catch (error) {
      this.logger.error(`获取机台状态失败: ${error.message}`)
      return `获取机台状态失败：${error.message}`
    }
  },
}
