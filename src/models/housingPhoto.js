const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const HousingPhoto = sequelize.define('HousingPhoto', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    entityType: {
      type: DataTypes.ENUM(
        'house_data',
        'water_access',
        'sanitation_access',
        'waste_management',
        'road_access',
        'energy_access',
      ),
      allowNull: false,
      field: 'entity_type',
      validate: {
        isIn: [
          [
            'house_data',
            'water_access',
            'sanitation_access',
            'waste_management',
            'road_access',
            'energy_access',
          ],
        ],
      },
    },
    entityId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'entity_id',
    },
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'file_path',
      validate: {
        len: [1, 500],
      },
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'mime_type',
      validate: {
        len: [1, 100],
      },
    },
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'file_size',
      validate: {
        min: 0,
      },
      comment: 'File size in bytes',
    },
    caption: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        len: [0, 255],
      },
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'display_order',
      validate: {
        min: 0,
      },
      comment: 'Order for displaying photos',
    },
    uploadedBy: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'uploaded_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
  }, {
    tableName: 'housing_photos',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['entity_type', 'entity_id'],
        name: 'idx_housing_photos_entity',
      },
      {
        fields: ['entity_id'],
        name: 'idx_housing_photos_entity_id',
      },
      {
        fields: ['uploaded_by'],
        name: 'idx_housing_photos_uploaded_by',
      },
      {
        fields: ['display_order'],
        name: 'idx_housing_photos_display_order',
      },
    ],
  });

  // Add hooks to ensure ID is generated
  HousingPhoto.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  HousingPhoto.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  HousingPhoto.associate = (models) => {
    // Housing photo belongs to user who uploaded it
    HousingPhoto.belongsTo(models.User, {
      foreignKey: 'uploaded_by',
      as: 'uploadedByUser',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(HousingPhoto, ['uploaded_by']);

  return HousingPhoto;
};

