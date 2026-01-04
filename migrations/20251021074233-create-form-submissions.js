const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('form_submissions', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      form_respondent_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'form_respondents',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      household_owner_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'household_owners',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      house_data_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'house_data',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      water_access_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'water_access',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sanitation_access_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'sanitation_access',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      waste_management_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'waste_management',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      road_access_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'road_access',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      energy_access_id: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'energy_access',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      status: {
        type: Sequelize.ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'draft',
      },
      isLivable: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reviewed_by: {
        type: Sequelize.STRING(12),
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      review_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      created_by: {
        type: Sequelize.STRING(12),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_by: {
        type: Sequelize.STRING(12),
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    });

    // Add indexes
    await queryInterface.addIndex('form_submissions', ['form_respondent_id'], {
      name: 'idx_form_submissions_respondent',
    });
    await queryInterface.addIndex('form_submissions', ['household_owner_id'], {
      name: 'idx_form_submissions_owner',
    });
    await queryInterface.addIndex('form_submissions', ['house_data_id'], {
      name: 'idx_form_submissions_house_data',
    });
    await queryInterface.addIndex('form_submissions', ['water_access_id'], {
      name: 'idx_form_submissions_water_access',
    });
    await queryInterface.addIndex('form_submissions', ['sanitation_access_id'], {
      name: 'idx_form_submissions_sanitation_access',
    });
    await queryInterface.addIndex('form_submissions', ['waste_management_id'], {
      name: 'idx_form_submissions_waste_management',
    });
    await queryInterface.addIndex('form_submissions', ['road_access_id'], {
      name: 'idx_form_submissions_road_access',
    });
    await queryInterface.addIndex('form_submissions', ['energy_access_id'], {
      name: 'idx_form_submissions_energy_access',
    });
    await queryInterface.addIndex('form_submissions', ['status'], {
      name: 'idx_form_submissions_status',
    });
    await queryInterface.addIndex('form_submissions', ['reviewed_by'], {
      name: 'idx_form_submissions_reviewed_by',
    });
    await queryInterface.addIndex('form_submissions', ['submitted_at'], {
      name: 'idx_form_submissions_submitted_at',
    });
    await queryInterface.addIndex('form_submissions', ['created_by'], {
      name: 'idx_form_submissions_created_by',
    });
    await queryInterface.addIndex('form_submissions', ['updated_by'], {
      name: 'idx_form_submissions_updated_by',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('form_submissions');
  },
};
