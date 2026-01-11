const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const FacilitySurvey = sequelize.define('FacilitySurvey', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    surveyYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'survey_year',
    },
    surveyPeriod: {
      type: DataTypes.ENUM('q1', 'q2', 'q3', 'q4', 'annual', 'adhoc'),
      allowNull: false,
      field: 'survey_period',
      validate: {
        isIn: [['q1', 'q2', 'q3', 'q4', 'annual', 'adhoc']],
      },
    },
    villageId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'village_id',
      references: {
        model: 'villages',
        key: 'id',
      },
    },
    districtId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'district_id',
      references: {
        model: 'districts',
        key: 'id',
      },
    },
    regencyId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'regency_id',
      references: {
        model: 'regencies',
        key: 'id',
      },
    },
    provinceId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'province_id',
      references: {
        model: 'provinces',
        key: 'id',
      },
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      comment: 'GPS latitude',
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      comment: 'GPS longitude',
    },
    geom: {
      type: DataTypes.GEOMETRY('POINT', 4326),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'verified', 'approved'),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [['draft', 'submitted', 'verified', 'approved']],
      },
    },
    verificationStatus: {
      type: DataTypes.ENUM('Pending', 'Verified', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending',
      field: 'verification_status',
      validate: {
        isIn: [['Pending', 'Verified', 'Rejected']],
      },
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'submitted_at',
    },
    verifiedBy: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'verified_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at',
    },
    reviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'review_notes',
    },
    createdBy: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    updatedBy: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'updated_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
  }, {
    tableName: 'facility_surveys',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['survey_year'],
      },
      {
        fields: ['survey_period'],
      },
      {
        fields: ['village_id'],
      },
      {
        fields: ['district_id'],
      },
      {
        fields: ['regency_id'],
      },
      {
        fields: ['province_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['verification_status'],
      },
      {
        fields: ['latitude', 'longitude'],
        name: 'idx_facility_surveys_coordinates',
      },
    ],
  });

  // Add hooks to ensure ID is generated
  FacilitySurvey.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  FacilitySurvey.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  FacilitySurvey.associate = (models) => {
    // Facility survey belongs to geographic locations
    FacilitySurvey.belongsTo(models.Village, {
      foreignKey: 'village_id',
      as: 'village',
      onDelete: 'SET NULL',
    });

    FacilitySurvey.belongsTo(models.District, {
      foreignKey: 'district_id',
      as: 'district',
      onDelete: 'SET NULL',
    });

    FacilitySurvey.belongsTo(models.Regency, {
      foreignKey: 'regency_id',
      as: 'regency',
      onDelete: 'SET NULL',
    });

    FacilitySurvey.belongsTo(models.Province, {
      foreignKey: 'province_id',
      as: 'province',
      onDelete: 'SET NULL',
    });

    // Facility survey belongs to user (creator, updater, verifier)
    FacilitySurvey.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator',
      onDelete: 'SET NULL',
    });

    FacilitySurvey.belongsTo(models.User, {
      foreignKey: 'updated_by',
      as: 'updater',
      onDelete: 'SET NULL',
    });

    FacilitySurvey.belongsTo(models.User, {
      foreignKey: 'verified_by',
      as: 'verifier',
      onDelete: 'SET NULL',
    });

    // Facility survey has multiple items for each facility type
    FacilitySurvey.hasOne(models.FacilityVillageInfo, {
      foreignKey: 'facility_survey_id',
      as: 'villageInfo',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasMany(models.FacilityCommercial, {
      foreignKey: 'facility_survey_id',
      as: 'commercial',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasMany(models.FacilityPublicServices, {
      foreignKey: 'facility_survey_id',
      as: 'publicServices',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasMany(models.FacilityEducation, {
      foreignKey: 'facility_survey_id',
      as: 'education',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasMany(models.FacilityHealth, {
      foreignKey: 'facility_survey_id',
      as: 'health',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasMany(models.FacilityReligious, {
      foreignKey: 'facility_survey_id',
      as: 'religious',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasMany(models.FacilityRecreation, {
      foreignKey: 'facility_survey_id',
      as: 'recreation',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasMany(models.FacilityCemetery, {
      foreignKey: 'facility_survey_id',
      as: 'cemetery',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasMany(models.FacilityGreenSpace, {
      foreignKey: 'facility_survey_id',
      as: 'greenSpace',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasMany(models.FacilityParking, {
      foreignKey: 'facility_survey_id',
      as: 'parking',
      onDelete: 'CASCADE',
    });

    // Utility associations
    FacilitySurvey.hasOne(models.UtilityElectricity, {
      foreignKey: 'facility_survey_id',
      as: 'electricity',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasOne(models.UtilityWater, {
      foreignKey: 'facility_survey_id',
      as: 'water',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasOne(models.UtilityTelecom, {
      foreignKey: 'facility_survey_id',
      as: 'telecom',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasOne(models.UtilityGas, {
      foreignKey: 'facility_survey_id',
      as: 'gas',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasOne(models.UtilityTransportation, {
      foreignKey: 'facility_survey_id',
      as: 'transportation',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasOne(models.UtilityFireDepartment, {
      foreignKey: 'facility_survey_id',
      as: 'fireDepartment',
      onDelete: 'CASCADE',
    });

    FacilitySurvey.hasOne(models.UtilityStreetLighting, {
      foreignKey: 'facility_survey_id',
      as: 'streetLighting',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(FacilitySurvey, [
    'created_by',
    'district_id',
    'facility_survey_id',
    'province_id',
    'regency_id',
    'review_notes',
    'updated_by',
    'verified_by',
    'village_id',
    'verification_status',
  ]);

  return FacilitySurvey;
};
