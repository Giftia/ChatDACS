"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // chat表 增加 teacherType 字段
    await queryInterface.addColumn("chat", "teacherType", {
      type: Sequelize.STRING,
    });
  },

  async down(queryInterface, Sequelize) {
    // chat表 删除 teacherType 字段
    await queryInterface.removeColumn("chat", "teacherType");
  }
};
