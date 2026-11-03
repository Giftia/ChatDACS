'use strict'

const {DataTypes} = require('sequelize')

function createConversationPluginStateStore({sequelize}) {
  const model = sequelize.models.conversationPluginState ?? sequelize.define('conversationPluginState', {
    key: {type: DataTypes.STRING(1024), primaryKey: true, allowNull: false},
    enabled: {type: DataTypes.BOOLEAN, allowNull: false},
  }, {tableName: 'conversationPluginStates', timestamps: false})
  let writes = Promise.resolve()
  const keyFor = (context, pluginName) => JSON.stringify([context.platform, context.selfId, context.groupId, pluginName])

  async function get(context, pluginName) {
    const row = await model.findByPk(keyFor(context, pluginName))
    return row ? row.enabled : true
  }

  function toggle(context, pluginName) {
    const operation = writes.then(async () => {
      const enabled = !await get(context, pluginName)
      await model.upsert({key: keyFor(context, pluginName), enabled})
      return enabled
    })
    writes = operation.catch(() => {})
    return operation
  }

  return {get, toggle}
}

module.exports = {createConversationPluginStateStore}
