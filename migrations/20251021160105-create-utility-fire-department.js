const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('utility_fire_department', {
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
      fire_truck_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      fire_manager: {
        type: Sequelize.ENUM('pemkab', 'kecamatan', 'pemdes', 'swasta', 'lainnya'),
        allowNull: true,
      },
      apar_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Alat Pemadam Api Ringan',
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

    await queryInterface.addIndex('utility_fire_department', ['facility_survey_id'], {
      unique: true,
      name: 'uk_utility_fire_department_survey',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('utility_fire_department');
  },
};


