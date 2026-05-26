const {sequelize, DataTypes} = require("./database.js");

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
