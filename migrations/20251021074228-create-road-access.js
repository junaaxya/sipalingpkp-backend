const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('road_access', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      road_type: {
        type: Sequelize.ENUM('lebar_kurang_3_5m', 'lebar_lebih_3_5m', 'tidak_ada_akses'),
        allowNull: true,
      },
      road_construction: {
        type: Sequelize.ENUM('beton', 'aspal', 'konblok', 'tanah_sirtu', 'lainnya'),
        allowNull: true,
      },
      road_construction_other: {
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
    await queryInterface.addIndex('road_access', ['road_type'], {
      name: 'idx_road_access_type',
    });
    await queryInterface.addIndex('road_access', ['road_construction'], {
      name: 'idx_road_access_construction',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('road_access');
  },
};
