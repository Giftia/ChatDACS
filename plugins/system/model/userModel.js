const path = require("path");
const { Sequelize, DataTypes } = require(path.join(process.cwd(), "node_modules/sequelize"));
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
