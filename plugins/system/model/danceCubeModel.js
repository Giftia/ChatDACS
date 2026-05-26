const {sequelize, DataTypes} = require("./database.js");

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
    defaultValue: "{}",
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
