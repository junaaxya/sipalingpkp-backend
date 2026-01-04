const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('water_access', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      sanitation_water_source: {
        type: Sequelize.ENUM('sumur_gali', 'sumur_bor', 'ledeng', 'lainnya'),
        allowNull: true,
      },
      sanitation_water_source_other: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      sanitation_water_depth: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      sanitation_water_location: {
        type: Sequelize.ENUM('di_tanah_sendiri', 'menumpang_tempat_lain'),
        allowNull: true,
      },
      drinking_water_source: {
        type: Sequelize.ENUM('sumur_gali', 'sumur_bor', 'ledeng', 'air_isi_ulang', 'lainnya'),
        allowNull: true,
      },
      drinking_water_source_other: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      drinking_water_depth: {
        type: Sequelize.INTEGER,
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
    await queryInterface.addIndex('water_access', ['sanitation_water_source'], {
      name: 'idx_water_access_sanitation_source',
    });
    await queryInterface.addIndex('water_access', ['drinking_water_source'], {
      name: 'idx_water_access_drinking_source',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('water_access');
  },
};
