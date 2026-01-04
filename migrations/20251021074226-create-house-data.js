const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('house_data', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      building_area: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      land_area: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      has_building_permit: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },
      house_type: {
        type: Sequelize.ENUM('rumah_tapak', 'rumah_susun', 'rumah_petak', 'kos'),
        allowNull: true,
      },
      total_occupants: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      floor_material: {
        type: Sequelize.ENUM('tanah', 'keramik', 'rabat_semen', 'papan', 'kayu', 'bata'),
        allowNull: true,
      },
      wall_material: {
        type: Sequelize.ENUM('tembok_tanpa_plester', 'tembok_dengan_plester', 'papan', 'anyaman_bambu', 'lainnya'),
        allowNull: true,
      },
      wall_material_other: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      roof_material: {
        type: Sequelize.ENUM('genteng_beton', 'genteng_keramik', 'seng_multiroof', 'kayu_sirap', 'asbes', 'lainnya'),
        allowNull: true,
      },
      roof_material_other: {
        type: Sequelize.STRING(100),
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
    await queryInterface.addIndex('house_data', ['house_type'], {
      name: 'idx_house_data_type',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('house_data');
  },
};
