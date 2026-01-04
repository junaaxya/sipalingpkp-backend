const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('form_respondents', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      position: {
        type: Sequelize.ENUM('perangkat_desa', 'pemilik_rumah', 'lainnya'),
        allowNull: false,
      },
      position_other: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      phone: {
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
    await queryInterface.addIndex('form_respondents', ['email'], {
      name: 'idx_form_respondents_email',
    });
    await queryInterface.addIndex('form_respondents', ['position'], {
      name: 'idx_form_respondents_position',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('form_respondents');
  },
};
