const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const FacilityVillageInfo = sequelize.define('FacilityVillageInfo', {
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
    populationCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'population_count',
    },
    householdCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'household_count',
    },
    villageArea: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'village_area',
      comment: 'Area in hectares',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'facility_village_info',
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

  FacilityVillageInfo.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  FacilityVillageInfo.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  FacilityVillageInfo.associate = (models) => {
    FacilityVillageInfo.belongsTo(models.FacilitySurvey, {
      foreignKey: 'facility_survey_id',
      as: 'facilitySurvey',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(FacilityVillageInfo, ['facility_survey_id']);

  return FacilityVillageInfo;
};

