const path = require('path')
const {Sequelize, DataTypes} = require('sequelize')

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(process.cwd(), 'config', 'db.db'),
  logging: false,
})

module.exports = {
  sequelize,
  DataTypes,
}
