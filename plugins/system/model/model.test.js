const {sequelize} = require('./database.js')
const UserModel = require('./userModel.js')
const MessageModel = require('./messageModel.js')
const QQGroupModel = require('./qqGroupModel.js')
const MineModel = require('./mineModel.js')
const ChatModel = require('./chatModel.js')
const PerfunctoryModel = require('./perfunctoryModel.js')
const HandGrenadeModel = require('./handGrenadeModel.js')
const DanceCubeModel = require('./danceCubeModel.js')

describe('system models', () => {
  test('share one Sequelize connection', () => {
    for (const model of [
      UserModel,
      MessageModel,
      QQGroupModel,
      MineModel,
      ChatModel,
      PerfunctoryModel,
      HandGrenadeModel,
      DanceCubeModel,
    ]) {
      expect(model.sequelize).toBe(sequelize)
    }
  })
})
