const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('energy_access', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      electricity_source: {
        type: Sequelize.ENUM('pln_sendiri', 'pln_menumpang', 'tidak_ada', 'genset', 'pltmh', 'plts', 'lainnya'),
        allowNull: true,
      },
      electricity_source_other: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      pln_capacity: {
        type: Sequelize.STRING(20),
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

    // Add indexes
    await queryInterface.addIndex('energy_access', ['electricity_source'], {
      name: 'idx_energy_access_source',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('energy_access');
  },
};
