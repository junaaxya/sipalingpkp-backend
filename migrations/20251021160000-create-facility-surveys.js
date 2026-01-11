const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('facility_surveys', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      survey_year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      survey_period: {
        type: Sequelize.ENUM('q1', 'q2', 'q3', 'q4', 'annual', 'adhoc'),
        allowNull: false,
      },
      village_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'villages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      district_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'districts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      regency_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'regencies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      province_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'provinces',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM('draft', 'submitted', 'verified', 'approved'),
        allowNull: false,
        defaultValue: 'draft',
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      verified_by: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      verified_at: {
        type: Sequelize.DATE,
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
      created_by: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
    });

    // Add indexes
    await queryInterface.addIndex('facility_surveys', ['survey_year'], {
      name: 'idx_survey_year',
    });
    await queryInterface.addIndex('facility_surveys', ['survey_period'], {
      name: 'idx_survey_period',
    });
    await queryInterface.addIndex('facility_surveys', ['village_id'], {
      name: 'idx_village',
    });
    await queryInterface.addIndex('facility_surveys', ['district_id'], {
      name: 'idx_district',
    });
    await queryInterface.addIndex('facility_surveys', ['regency_id'], {
      name: 'idx_regency',
    });
    await queryInterface.addIndex('facility_surveys', ['province_id'], {
      name: 'idx_province',
    });
    await queryInterface.addIndex('facility_surveys', ['status'], {
      name: 'idx_facility_surveys_status',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('facility_surveys');
  },
};
