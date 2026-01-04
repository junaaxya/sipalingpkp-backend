const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const UtilityTransportation = sequelize.define('UtilityTransportation', {
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
    busRouteCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'bus_route_count',
    },
    angkotRouteCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'angkot_route_count',
    },
    otherTransportCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'other_transport_count',
    },
    otherTransportType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'other_transport_type',
      comment: 'e.g., perahu, kapal laut',
      validate: {
        len: [0, 100],
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'utility_transportation',
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

  UtilityTransportation.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  UtilityTransportation.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  UtilityTransportation.associate = (models) => {
    UtilityTransportation.belongsTo(models.FacilitySurvey, {
      foreignKey: 'facility_survey_id',
      as: 'facilitySurvey',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(UtilityTransportation, ['facility_survey_id']);

  return UtilityTransportation;
};

