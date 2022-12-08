const path = require("path");
const { Sequelize, DataTypes } = require(path.join(process.cwd(), "node_modules/sequelize"));
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
  logging: false,
});

const PerfunctoryModel = sequelize.define("perfunctory", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  content: {
    type: DataTypes.STRING,
  }
}, {
  tableName: "perfunctory",
});

module.exports = PerfunctoryModel;
