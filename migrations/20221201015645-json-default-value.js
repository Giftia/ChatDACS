"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    //增加 danceCube表 的 location字段 的默认值 "{}"
    await queryInterface.changeColumn("danceCube", "location", {
      type: Sequelize.STRING,
      defaultValue: "{}",
      set: function (value) {
        return this.setDataValue("location", JSON.stringify(value));
      },
      get: function () {
        return JSON.parse(this.getDataValue("location"));
      },
    });

    // 增加 qqGroup表 的 pluginsList字段 的默认值 "{}"
    await queryInterface.changeColumn("qqGroups", "pluginsList", {
      type: Sequelize.STRING,
      defaultValue: "{}",
      set: function (value) {
        return this.setDataValue("pluginsList", JSON.stringify(value));
      },
      get: function () {
        return JSON.parse(this.getDataValue("pluginsList"));
      },
    });

    // 给已有记录设置默认值
    await queryInterface.sequelize.query(`
      UPDATE qqGroups SET pluginsList = '{}' WHERE pluginsList = '';
      UPDATE danceCube SET location = '{}' WHERE location = '';
    `);
  },

  async down(queryInterface, Sequelize) {
    // 删除 danceCube表 的 location字段 的默认值
    await queryInterface.changeColumn("danceCube", "location", {
      type: Sequelize.STRING,
      set: function (value) {
        return this.setDataValue("location", JSON.stringify(value));
      },
      get: function () {
        return JSON.parse(this.getDataValue("location"));
      },
    });

    // 删除 qqGroup表 的 pluginsList字段 的默认值
    await queryInterface.changeColumn("qqGroups", "pluginsList", {
      type: Sequelize.STRING,
      set: function (value) {
        return this.setDataValue("pluginsList", JSON.stringify(value));
      },
      get: function () {
        return JSON.parse(this.getDataValue("pluginsList"));
      },
    });

    // 已有记录回滚默认值
    await queryInterface.sequelize.query(`
      UPDATE qqGroups SET pluginsList = '' WHERE pluginsList = '{}';
      UPDATE danceCube SET location = '' WHERE location = '{}';
    `);
  }
};
