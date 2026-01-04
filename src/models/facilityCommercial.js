const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const FacilityCommercial = sequelize.define('FacilityCommercial', {
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
    type: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'facility_commercial',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['facility_survey_id'],
      },
    ],
  });

  FacilityCommercial.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  FacilityCommercial.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  FacilityCommercial.associate = (models) => {
    FacilityCommercial.belongsTo(models.FacilitySurvey, {
      foreignKey: 'facility_survey_id',
      as: 'facilitySurvey',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(FacilityCommercial, ['facility_survey_id']);

  return FacilityCommercial;
};
