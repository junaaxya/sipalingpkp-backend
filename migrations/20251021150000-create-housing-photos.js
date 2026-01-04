const { generateId } = require('../src/config/nanoid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('housing_photos', {
      id: {
        type: Sequelize.STRING(12),
        primaryKey: true,
        defaultValue: generateId,
        allowNull: false,
      },
      entity_type: {
        type: Sequelize.ENUM(
          'house_data',
          'water_access',
          'sanitation_access',
          'waste_management',
          'road_access',
          'energy_access',
        ),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.STRING(12),
        allowNull: false,
      },
      file_path: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'File size in bytes',
      },
      caption: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order for displaying photos',
      },
      uploaded_by: {
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

    // Add indexes for better query performance
    await queryInterface.addIndex('housing_photos', ['entity_type', 'entity_id'], {
      name: 'idx_housing_photos_entity',
    });
    await queryInterface.addIndex('housing_photos', ['entity_id'], {
      name: 'idx_housing_photos_entity_id',
    });
    await queryInterface.addIndex('housing_photos', ['uploaded_by'], {
      name: 'idx_housing_photos_uploaded_by',
    });
    await queryInterface.addIndex('housing_photos', ['display_order'], {
      name: 'idx_housing_photos_display_order',
    });
  },

  async down(queryInterface, _Sequelize) {
    // Drop indexes first
    await queryInterface.removeIndex('housing_photos', 'idx_housing_photos_entity');
    await queryInterface.removeIndex('housing_photos', 'idx_housing_photos_entity_id');
    await queryInterface.removeIndex('housing_photos', 'idx_housing_photos_uploaded_by');
    await queryInterface.removeIndex('housing_photos', 'idx_housing_photos_display_order');

    // Drop table
    await queryInterface.dropTable('housing_photos');
  },
};

