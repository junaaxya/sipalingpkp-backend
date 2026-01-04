const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const WasteManagement = sequelize.define('WasteManagement', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    hasWasteCollection: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: 'has_waste_collection',
    },
    wasteCollectionManager: {
      type: DataTypes.ENUM('pemda', 'pemdes', 'lsm_kelompok_masyarakat', 'swasta', 'lainnya'),
      allowNull: true,
      field: 'waste_collection_manager',
      validate: {
        isIn: [['pemda', 'pemdes', 'lsm_kelompok_masyarakat', 'swasta', 'lainnya']],
      },
    },
    wasteCollectionManagerOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'waste_collection_manager_other',
      validate: {
        len: [0, 100],
      },
    },
    wasteDisposalMethod: {
      type: DataTypes.ENUM('dibakar', 'diolah_rumah', 'tempat_sampah_umum', 'dibuang_lainnya'),
      allowNull: true,
      field: 'waste_disposal_method',
      validate: {
        isIn: [['dibakar', 'diolah_rumah', 'tempat_sampah_umum', 'dibuang_lainnya']],
      },
    },
    wasteDisposalLocation: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'waste_disposal_location',
      validate: {
        len: [0, 200],
      },
    },
    formSubmissionId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'form_submission_id',
      references: {
        model: 'form_submissions',
        key: 'id',
      },
    },
  }, {
    tableName: 'waste_management',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['has_waste_collection'],
      },
      {
        fields: ['waste_disposal_method'],
      },
      {
        fields: ['form_submission_id'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  WasteManagement.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  WasteManagement.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  WasteManagement.associate = (models) => {
    // Waste management has many photos
    WasteManagement.hasMany(models.HousingPhoto, {
      foreignKey: 'entity_id',
      constraints: false,
      scope: {
        entity_type: 'waste_management',
      },
      as: 'photos',
      onDelete: 'CASCADE',
    });

    // Waste management belongs to a form submission (1-to-1)
    WasteManagement.belongsTo(models.FormSubmission, {
      foreignKey: 'form_submission_id',
      as: 'formSubmission',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(WasteManagement, ['entity_id', 'form_submission_id']);

  return WasteManagement;
};
