"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      CID: {
        type: Sequelize.STRING,
        unique: true,
      },
      nickname: {
        type: Sequelize.STRING
      },
      logintimes: {
        type: Sequelize.NUMBER,
        defaultValue: 1,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.createTable("chat", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      ask: {
        type: Sequelize.STRING,
      },
      answer: {
        type: Sequelize.STRING,
      },
      teacherUserId: {
        type: Sequelize.INTEGER,
      },
      teacherGroupId: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.createTable("messages", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      CID: {
        type: Sequelize.STRING,
        unique: true,
      },
      message: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.createTable("danceCube", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        type: Sequelize.INTEGER,
        unique: true,
      },
      playerId: {
        type: Sequelize.INTEGER,
      },
      playerName: {
        type: Sequelize.STRING,
      },
      location: {
        type: Sequelize.STRING,
        set: function (value) {
          return this.setDataValue("location", JSON.stringify(value));
        },
        get: function () {
          return JSON.parse(this.getDataValue("location"));
        },
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.createTable("handGrenade", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        type: Sequelize.INTEGER,
        unique: true,
      },
      times: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.createTable("mine", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      groupId: {
        type: Sequelize.INTEGER,
      },
      owner: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.createTable("perfunctory", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      content: {
        type: Sequelize.STRING,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.createTable("qqGroups", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      groupId: {
        type: Sequelize.INTEGER,
        unique: true,
      },
      serviceEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      loopBombEnabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      loopBombAnswer: {
        type: Sequelize.STRING,
      },
      loopBombHolder: {
        type: Sequelize.INTEGER,
      },
      loopBombStartTime: {
        type: Sequelize.INTEGER,
      },
      pluginsList: {
        type: Sequelize.STRING,
        set: function (value) {
          return this.setDataValue("pluginsList", JSON.stringify(value));
        },
        get: function () {
          return JSON.parse(this.getDataValue("pluginsList"));
        }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("users");
    await queryInterface.dropTable("chat");
    await queryInterface.dropTable("messages");
    await queryInterface.dropTable("danceCube");
    await queryInterface.dropTable("handGrenade");
    await queryInterface.dropTable("mine");
    await queryInterface.dropTable("perfunctory");
    await queryInterface.dropTable("qqGroups");
  }
};
