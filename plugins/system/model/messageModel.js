const path = require("path");
const { Sequelize, DataTypes } = require(path.join(process.cwd(), "node_modules/sequelize"));
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(process.cwd(), "config", "db.db"),
  logging: false,
});

const MessageModel = sequelize.define("message", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  CID: {
    type: DataTypes.STRING,
    unique: true,
  },
  message: {
    type: DataTypes.STRING,
  },
}, {
  tableName: "messages",
});

module.exports = MessageModel;
