const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const UtilityWater = sequelize.define('UtilityWater', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    facilitySurveyId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'facility_survey_id',
      references: {
        model: 'facility_surveys',
        key: 'id',
      },
    },
    spamCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'spam_count',
      comment: 'Sistem Penyediaan Air Minum',
    },
    pipedWaterCoverage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: 'piped_water_coverage',
      comment: 'Coverage percentage',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'utility_water',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['facility_survey_id'],
        unique: true,
      },
    ],
  });

  UtilityWater.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  UtilityWater.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  UtilityWater.associate = (models) => {
    UtilityWater.belongsTo(models.FacilitySurvey, {
      foreignKey: 'facility_survey_id',
      as: 'facilitySurvey',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(UtilityWater, ['facility_survey_id']);

  return UtilityWater;
};

