const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('utility_telecom', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      facility_survey_id: {
        type: Sequelize.STRING(12),
        allowNull: false,
        references: {
          model: 'facility_surveys',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      operator_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of telecom operators',
      },
      uncovered_dusun_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of Dusun/RW without coverage',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('utility_telecom', ['facility_survey_id'], {
      unique: true,
      name: 'uk_utility_telecom_survey',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('utility_telecom');
  },
};


