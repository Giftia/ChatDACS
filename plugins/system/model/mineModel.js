const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
  logging: false,
});

const MineModel = sequelize.define("mine", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  groupId: {
    type: DataTypes.INTEGER(10),
  },
  owner: {
    type: DataTypes.INTEGER(12),
  },
}, {
  tableName: "mine",
});

module.exports = MineModel;
