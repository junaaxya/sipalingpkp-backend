/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add form_submission_id to form_respondents
    await queryInterface.addColumn('form_respondents', 'form_submission_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'form_submissions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add form_submission_id to household_owners
    await queryInterface.addColumn('household_owners', 'form_submission_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'form_submissions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add form_submission_id to house_data
    await queryInterface.addColumn('house_data', 'form_submission_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'form_submissions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add form_submission_id to water_access
    await queryInterface.addColumn('water_access', 'form_submission_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'form_submissions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add form_submission_id to sanitation_access
    await queryInterface.addColumn('sanitation_access', 'form_submission_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'form_submissions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add form_submission_id to waste_management
    await queryInterface.addColumn('waste_management', 'form_submission_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'form_submissions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add form_submission_id to road_access
    await queryInterface.addColumn('road_access', 'form_submission_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'form_submissions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add form_submission_id to energy_access
    await queryInterface.addColumn('energy_access', 'form_submission_id', {
      type: Sequelize.STRING(12),
      allowNull: true,
      references: {
        model: 'form_submissions',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add indexes for form_submission_id
    await queryInterface.addIndex('form_respondents', ['form_submission_id'], {
      name: 'idx_form_respondents_submission',
    });
    await queryInterface.addIndex('household_owners', ['form_submission_id'], {
      name: 'idx_household_owners_submission',
    });
    await queryInterface.addIndex('house_data', ['form_submission_id'], {
      name: 'idx_house_data_submission',
    });
    await queryInterface.addIndex('water_access', ['form_submission_id'], {
      name: 'idx_water_access_submission',
    });
    await queryInterface.addIndex('sanitation_access', ['form_submission_id'], {
      name: 'idx_sanitation_access_submission',
    });
    await queryInterface.addIndex('waste_management', ['form_submission_id'], {
      name: 'idx_waste_management_submission',
    });
    await queryInterface.addIndex('road_access', ['form_submission_id'], {
      name: 'idx_road_access_submission',
    });
    await queryInterface.addIndex('energy_access', ['form_submission_id'], {
      name: 'idx_energy_access_submission',
    });
  },

  async down(queryInterface, _Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('form_respondents', 'idx_form_respondents_submission');
    await queryInterface.removeIndex('household_owners', 'idx_household_owners_submission');
    await queryInterface.removeIndex('house_data', 'idx_house_data_submission');
    await queryInterface.removeIndex('water_access', 'idx_water_access_submission');
    await queryInterface.removeIndex('sanitation_access', 'idx_sanitation_access_submission');
    await queryInterface.removeIndex('waste_management', 'idx_waste_management_submission');
    await queryInterface.removeIndex('road_access', 'idx_road_access_submission');
    await queryInterface.removeIndex('energy_access', 'idx_energy_access_submission');

    // Remove columns
    await queryInterface.removeColumn('form_respondents', 'form_submission_id');
    await queryInterface.removeColumn('household_owners', 'form_submission_id');
    await queryInterface.removeColumn('house_data', 'form_submission_id');
    await queryInterface.removeColumn('water_access', 'form_submission_id');
    await queryInterface.removeColumn('sanitation_access', 'form_submission_id');
    await queryInterface.removeColumn('waste_management', 'form_submission_id');
    await queryInterface.removeColumn('road_access', 'form_submission_id');
    await queryInterface.removeColumn('energy_access', 'form_submission_id');
  },
};

