const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sanitation_access', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      toilet_ownership: {
        type: Sequelize.ENUM('milik_sendiri', 'jamban_bersama', 'tidak_memiliki'),
        allowNull: true,
      },
      toilet_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      toilet_type: {
        type: Sequelize.ENUM('cubluk', 'leher_angsa_jongkok', 'leher_angsa_duduk'),
        allowNull: true,
      },
      septic_tank_type: {
        type: Sequelize.ENUM('biotank', 'tanki_permanen', 'lubang_tanah', 'tidak_memiliki'),
        allowNull: true,
      },
      septic_tank_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      has_septic_pumping: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      septic_pumping_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      septic_pumping_service: {
        type: Sequelize.ENUM('pemda', 'swasta_perorangan', 'swasta_badan_usaha'),
        allowNull: true,
      },
      wastewater_disposal: {
        type: Sequelize.ENUM('jaringan_pipa', 'tangki_septic', 'drainase_sungai', 'resapan_tanah'),
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
    await queryInterface.addIndex('sanitation_access', ['toilet_ownership'], {
      name: 'idx_sanitation_access_toilet',
    });
    await queryInterface.addIndex('sanitation_access', ['septic_tank_type'], {
      name: 'idx_sanitation_access_septic',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('sanitation_access');
  },
};
