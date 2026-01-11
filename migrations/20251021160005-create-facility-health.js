const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('facility_health', {
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
      pustu_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      puskesmas_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      hospital_govt_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      hospital_private_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      clinic_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      pharmacy_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('facility_health', ['facility_survey_id'], {
      unique: true,
      name: 'uk_facility_health_survey',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('facility_health');
  },
};


