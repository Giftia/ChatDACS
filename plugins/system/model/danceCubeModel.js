const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
  logging: false,
});

const DanceCubeModel = sequelize.define("danceCube", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER(12),
    unique: true,
  },
  playerId: {
    type: DataTypes.INTEGER(10),
  },
  playerName: {
    type: DataTypes.CHAR(20),
  },
  location: {
    type: DataTypes.CHAR(10),
  },
  focusMachine: {
    type: DataTypes.CHAR,
    set: function (value) {
      return this.setDataValue("focusMachine", JSON.stringify(value));
    },
    get: function () {
      return JSON.parse(this.getDataValue("focusMachine"));
    },
  },
}, {
  tableName: "danceCube",
});

module.exports = DanceCubeModel;
