const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
  logging: false,
});

const HandGrenadeModel = sequelize.define("handGrenade", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER(12),
    unique: true,
  },
  times: {
    type: DataTypes.INTEGER(3),
    defaultValue: 0,
  },
}, {
  tableName: "handGrenade",
});

module.exports = HandGrenadeModel;
