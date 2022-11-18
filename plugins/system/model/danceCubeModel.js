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
    type: DataTypes.INTEGER,
    unique: true,
  },
  playerId: {
    type: DataTypes.INTEGER,
  },
  playerName: {
    type: DataTypes.STRING,
  },
  location: {
    type: DataTypes.STRING,
    set: function (value) {
      return this.setDataValue("location", JSON.stringify(value));
    },
    get: function () {
      return JSON.parse(this.getDataValue("location"));
    },
  },
}, {
  tableName: "danceCube",
});

module.exports = DanceCubeModel;
