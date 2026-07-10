const path = require('path')
const {Sequelize, DataTypes} = require('sequelize')

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.CHATDACS_DB_PATH || path.join(process.cwd(), 'config', 'db.db'),
  logging: false,
})

module.exports = {
  sequelize,
  DataTypes,
}
