const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('household_owners', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      owner_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      owner_phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      head_of_family_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      head_of_family_phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      head_of_family_age: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      family_card_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      total_family_members: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      house_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      rt: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      rw: {
        type: Sequelize.STRING(10),
        allowNull: true,
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
      education_level: {
        type: Sequelize.ENUM('tidak_sekolah', 'sd', 'smp', 'sma', 'diploma', 'sarjana', 'magister', 'lainnya'),
        allowNull: true,
      },
      education_level_other: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      occupation: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      monthly_income: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      },
      land_ownership_status: {
        type: Sequelize.ENUM('milik_sendiri', 'bukan_milik_sendiri'),
        allowNull: false,
      },
      house_ownership_status: {
        type: Sequelize.ENUM('milik_sendiri', 'sewa', 'menumpang'),
        allowNull: false,
      },
      has_received_housing_assistance: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      housing_assistance_year: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      is_registered_as_poor: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      poor_registration_attachment: {
        type: Sequelize.STRING(255),
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
    await queryInterface.addIndex('household_owners', ['province_id'], {
      name: 'idx_household_owners_province',
    });
    await queryInterface.addIndex('household_owners', ['village_id'], {
      name: 'idx_household_owners_village',
    });
    await queryInterface.addIndex('household_owners', ['district_id'], {
      name: 'idx_household_owners_district',
    });
    await queryInterface.addIndex('household_owners', ['regency_id'], {
      name: 'idx_household_owners_regency',
    });
    await queryInterface.addIndex('household_owners', ['rt', 'rw'], {
      name: 'idx_household_owners_rt_rw',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('household_owners');
  },
};
