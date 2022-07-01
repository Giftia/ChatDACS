const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
});

const PerfunctoryModel = sequelize.define("perfunctory", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  content: {
    type: DataTypes.CHAR,
  }
}, {
  tableName: "perfunctory",
});

module.exports = PerfunctoryModel;
