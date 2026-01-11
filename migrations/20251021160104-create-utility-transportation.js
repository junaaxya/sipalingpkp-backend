const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('utility_transportation', {
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
      bus_route_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      angkot_route_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      other_transport_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      other_transport_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'e.g., perahu, kapal laut',
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

    await queryInterface.addIndex('utility_transportation', ['facility_survey_id'], {
      unique: true,
      name: 'uk_utility_transportation_survey',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('utility_transportation');
  },
};


