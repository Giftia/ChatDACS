'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('conversationPluginStates', {
      key: {type: Sequelize.STRING(1024), primaryKey: true, allowNull: false},
      enabled: {type: Sequelize.BOOLEAN, allowNull: false},
    })
  },
  async down(queryInterface) {
    await queryInterface.dropTable('conversationPluginStates')
  },
}
