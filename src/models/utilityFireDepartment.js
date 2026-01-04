const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const UtilityFireDepartment = sequelize.define('UtilityFireDepartment', {
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
    fireTruckCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'fire_truck_count',
    },
    fireManager: {
      type: DataTypes.ENUM('pemkab', 'kecamatan', 'pemdes', 'swasta', 'lainnya'),
      allowNull: true,
      field: 'fire_manager',
      validate: {
        isIn: [['pemkab', 'kecamatan', 'pemdes', 'swasta', 'lainnya']],
      },
    },
    aparCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'apar_count',
      comment: 'Alat Pemadam Api Ringan',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'utility_fire_department',
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

  UtilityFireDepartment.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  UtilityFireDepartment.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  UtilityFireDepartment.associate = (models) => {
    UtilityFireDepartment.belongsTo(models.FacilitySurvey, {
      foreignKey: 'facility_survey_id',
      as: 'facilitySurvey',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(UtilityFireDepartment, ['facility_survey_id']);

  return UtilityFireDepartment;
};

