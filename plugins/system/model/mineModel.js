const {sequelize, DataTypes} = require("./database.js");

const MineModel = sequelize.define("mine", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  groupId: {
    type: DataTypes.INTEGER,
  },
  owner: {
    type: DataTypes.INTEGER,
  },
}, {
  tableName: "mine",
});

module.exports = MineModel;
