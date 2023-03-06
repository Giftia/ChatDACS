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
    type: DataTypes.STRING,
  },
  answer: {
    type: DataTypes.STRING,
  },
  teacherUserId: {
    type: DataTypes.INTEGER,
  },
  teacherGroupId: {
    type: DataTypes.INTEGER,
  },
  teacherType: {
    type: DataTypes.STRING,
  },
}, {
  tableName: "chat",
});

module.exports = ChatModel;
