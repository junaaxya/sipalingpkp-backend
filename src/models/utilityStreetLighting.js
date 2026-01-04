const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const UtilityStreetLighting = sequelize.define('UtilityStreetLighting', {
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
    streetLightCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'street_light_count',
    },
    managedBy: {
      type: DataTypes.ENUM('Pemdes', 'Kecamatan', 'Pemkab', 'PLN', 'Swasta'),
      allowNull: true,
      field: 'managed_by',
      validate: {
        isIn: [['Pemdes', 'Kecamatan', 'Pemkab', 'PLN', 'Swasta']],
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'utility_street_lighting',
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

  UtilityStreetLighting.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  UtilityStreetLighting.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  UtilityStreetLighting.associate = (models) => {
    UtilityStreetLighting.belongsTo(models.FacilitySurvey, {
      foreignKey: 'facility_survey_id',
      as: 'facilitySurvey',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(UtilityStreetLighting, ['facility_survey_id']);

  return UtilityStreetLighting;
};

