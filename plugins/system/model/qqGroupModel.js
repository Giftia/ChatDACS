const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
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
    type: DataTypes.INTEGER(10),
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
    type: DataTypes.CHAR,
  },
  loopBombHolder: {
    type: DataTypes.INTEGER(12),
  },
  loopBombStartTime: {
    type: DataTypes.INTEGER(10),
  },
}, {
  tableName: "qqGroups",
});

module.exports = QQGroupModel;
