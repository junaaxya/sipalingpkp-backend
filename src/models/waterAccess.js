const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const WaterAccess = sequelize.define('WaterAccess', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    sanitationWaterSource: {
      type: DataTypes.ENUM('sumur_gali', 'sumur_bor', 'ledeng', 'lainnya'),
      allowNull: true,
      field: 'sanitation_water_source',
      validate: {
        isIn: [['sumur_gali', 'sumur_bor', 'ledeng', 'lainnya']],
      },
    },
    sanitationWaterSourceOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'sanitation_water_source_other',
      validate: {
        len: [0, 100],
      },
    },
    sanitationWaterDepth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'sanitation_water_depth',
      validate: {
        min: 0,
      },
    },
    sanitationWaterLocation: {
      type: DataTypes.ENUM('di_tanah_sendiri', 'menumpang_tempat_lain'),
      allowNull: true,
      field: 'sanitation_water_location',
      validate: {
        isIn: [['di_tanah_sendiri', 'menumpang_tempat_lain']],
      },
    },
    drinkingWaterSource: {
      type: DataTypes.ENUM('sumur_gali', 'sumur_bor', 'ledeng', 'air_isi_ulang', 'lainnya'),
      allowNull: true,
      field: 'drinking_water_source',
      validate: {
        isIn: [['sumur_gali', 'sumur_bor', 'ledeng', 'air_isi_ulang', 'lainnya']],
      },
    },
    drinkingWaterSourceOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'drinking_water_source_other',
      validate: {
        len: [0, 100],
      },
    },
    drinkingWaterDepth: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'drinking_water_depth',
      validate: {
        min: 0,
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
    tableName: 'water_access',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['sanitation_water_source'],
      },
      {
        fields: ['drinking_water_source'],
      },
      {
        fields: ['form_submission_id'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  WaterAccess.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  WaterAccess.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  WaterAccess.associate = (models) => {
    // Water access has many photos
    WaterAccess.hasMany(models.HousingPhoto, {
      foreignKey: 'entity_id',
      constraints: false,
      scope: {
        entity_type: 'water_access',
      },
      as: 'photos',
      onDelete: 'CASCADE',
    });

    // Water access belongs to a form submission (1-to-1)
    WaterAccess.belongsTo(models.FormSubmission, {
      foreignKey: 'form_submission_id',
      as: 'formSubmission',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(WaterAccess, ['entity_id', 'form_submission_id']);

  return WaterAccess;
};
