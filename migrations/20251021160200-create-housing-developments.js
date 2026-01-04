const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('housing_developments', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      development_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      developer_name: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      land_area: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Area in hectares',
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: 'GPS latitude',
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: 'GPS longitude',
      },
      housing_type: {
        type: Sequelize.ENUM('sederhana', 'menengah', 'mewah', 'campuran'),
        allowNull: false,
      },
      planned_unit_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Jumlah rumah rencana',
      },
      has_road_access: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      road_length_meters: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Panjang jalan in meters',
      },
      land_status: {
        type: Sequelize.STRING(100),
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
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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
      verified_at: {
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
    await queryInterface.addIndex('housing_developments', ['status'], {
      name: 'idx_status',
    });
    await queryInterface.addIndex('housing_developments', ['housing_type'], {
      name: 'idx_housing_type',
    });
    await queryInterface.addIndex('housing_developments', ['village_id', 'district_id', 'regency_id', 'province_id'], {
      name: 'idx_location',
    });
    await queryInterface.addIndex('housing_developments', ['created_by'], {
      name: 'idx_created_by',
    });
    await queryInterface.addIndex('housing_developments', ['verified_by'], {
      name: 'idx_verified_by',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.dropTable('housing_developments');
  },
};

