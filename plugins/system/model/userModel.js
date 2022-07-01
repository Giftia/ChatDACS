const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
  logging: false,
});

const UserModel = sequelize.define("user", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  CID: {
    type: DataTypes.CHAR(13),
    unique: true,
  },
  nickname: {
    type: DataTypes.CHAR(20),
  },
  logintimes: {
    type: DataTypes.INTEGER(6),
    defaultValue: 1,
  },
}, {
  tableName: "users",
});

module.exports = UserModel;
