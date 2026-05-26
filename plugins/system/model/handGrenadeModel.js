const {sequelize, DataTypes} = require("./database.js");

const HandGrenadeModel = sequelize.define("handGrenade", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    unique: true,
  },
  times: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: "handGrenade",
});

module.exports = HandGrenadeModel;
