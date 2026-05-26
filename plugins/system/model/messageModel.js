const {sequelize, DataTypes} = require("./database.js");

const MessageModel = sequelize.define("message", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  CID: {
    type: DataTypes.STRING,
    unique: true,
  },
  message: {
    type: DataTypes.STRING,
  },
}, {
  tableName: "messages",
});

module.exports = MessageModel;
