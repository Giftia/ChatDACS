const {sequelize, DataTypes} = require("./database.js");

const UserModel = sequelize.define("user", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  CID: {
    type: DataTypes.STRING,
    unique: true,
  },
  nickname: {
    type: DataTypes.STRING,
  },
  logintimes: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
}, {
  tableName: "users",
});

module.exports = UserModel;
