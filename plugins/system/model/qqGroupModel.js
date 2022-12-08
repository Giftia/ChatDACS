const path = require("path");
const { Sequelize, DataTypes } = require(path.join(process.cwd(), "node_modules/sequelize"));
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
  logging: false,
});

const QQGroupModel = sequelize.define("qqGroup", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
    unique: true,
  },
  serviceEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  loopBombEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  loopBombAnswer: {
    type: DataTypes.STRING,
  },
  loopBombHolder: {
    type: DataTypes.INTEGER,
  },
  loopBombStartTime: {
    type: DataTypes.INTEGER,
  },
  pluginsList: {
    type: DataTypes.STRING,
    defaultValue: "{}",
    set: function (value) {
      return this.setDataValue("pluginsList", JSON.stringify(value));
    },
    get: function () {
      return JSON.parse(this.getDataValue("pluginsList"));
    },
  },
}, {
  tableName: "qqGroups",
});

module.exports = QQGroupModel;
