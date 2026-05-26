const {sequelize, DataTypes} = require("./database.js");

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
