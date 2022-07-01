const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
  logging: false,
});

const MessageModel = sequelize.define("message", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  CID: {
    type: DataTypes.CHAR(13),
    unique: true,
  },
  message: {
    type: DataTypes.CHAR,
  },
}, {
  tableName: "messages",
});

module.exports = MessageModel;