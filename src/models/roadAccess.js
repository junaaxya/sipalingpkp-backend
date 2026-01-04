const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const RoadAccess = sequelize.define('RoadAccess', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    roadType: {
      type: DataTypes.ENUM('lebar_kurang_3_5m', 'lebar_lebih_3_5m', 'tidak_ada_akses'),
      allowNull: true,
      field: 'road_type',
      validate: {
        isIn: [['lebar_kurang_3_5m', 'lebar_lebih_3_5m', 'tidak_ada_akses']],
      },
    },
    roadConstruction: {
      type: DataTypes.ENUM('beton', 'aspal', 'konblok', 'tanah_sirtu', 'lainnya'),
      allowNull: true,
      field: 'road_construction',
      validate: {
        isIn: [['beton', 'aspal', 'konblok', 'tanah_sirtu', 'lainnya']],
      },
    },
    roadConstructionOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'road_construction_other',
      validate: {
        len: [0, 100],
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
    tableName: 'road_access',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['road_type'],
      },
      {
        fields: ['road_construction'],
      },
      {
        fields: ['form_submission_id'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  RoadAccess.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  RoadAccess.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  RoadAccess.associate = (models) => {
    // Road access has many photos
    RoadAccess.hasMany(models.HousingPhoto, {
      foreignKey: 'entity_id',
      constraints: false,
      scope: {
        entity_type: 'road_access',
      },
      as: 'photos',
      onDelete: 'CASCADE',
    });

    // Road access belongs to a form submission (1-to-1)
    RoadAccess.belongsTo(models.FormSubmission, {
      foreignKey: 'form_submission_id',
      as: 'formSubmission',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(RoadAccess, ['entity_id', 'form_submission_id']);

  return RoadAccess;
};
