const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('waste_management', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      has_waste_collection: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      waste_collection_manager: {
        type: Sequelize.ENUM('pemda', 'pemdes', 'lsm_kelompok_masyarakat', 'swasta', 'lainnya'),
        allowNull: true,
      },
      waste_collection_manager_other: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      waste_disposal_method: {
        type: Sequelize.ENUM('dibakar', 'diolah_rumah', 'tempat_sampah_umum', 'dibuang_lainnya'),
        allowNull: true,
      },
      waste_disposal_location: {
        type: Sequelize.STRING(200),
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
    await queryInterface.addIndex('waste_management', ['has_waste_collection'], {
      name: 'idx_waste_management_collection',
    });
    await queryInterface.addIndex('waste_management', ['waste_disposal_method'], {
      name: 'idx_waste_management_disposal',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('waste_management');
  },
};
