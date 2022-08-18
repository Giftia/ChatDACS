const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
  logging: false,
});

const ChatModel = sequelize.define("chat", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  ask: {
    type: DataTypes.CHAR,
    unique: true,
  },
  answer: {
    type: DataTypes.CHAR,
  },
  teacherUserId: {
    type: DataTypes.INTEGER(12),
  },
  teacherGroupId: {
    type: DataTypes.INTEGER(10),
  },
}, {
  tableName: "chat",
});

module.exports = ChatModel;
