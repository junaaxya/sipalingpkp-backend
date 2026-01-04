const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const FormSubmission = sequelize.define('FormSubmission', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    formRespondentId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'form_respondent_id',
      references: {
        model: 'form_respondents',
        key: 'id',
      },
    },
    householdOwnerId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'household_owner_id',
      references: {
        model: 'household_owners',
        key: 'id',
      },
    },
    houseDataId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'house_data_id',
      references: {
        model: 'house_data',
        key: 'id',
      },
    },
    waterAccessId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'water_access_id',
      references: {
        model: 'water_access',
        key: 'id',
      },
    },
    sanitationAccessId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'sanitation_access_id',
      references: {
        model: 'sanitation_access',
        key: 'id',
      },
    },
    wasteManagementId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'waste_management_id',
      references: {
        model: 'waste_management',
        key: 'id',
      },
    },
    roadAccessId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'road_access_id',
      references: {
        model: 'road_access',
        key: 'id',
      },
    },
    energyAccessId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'energy_access_id',
      references: {
        model: 'energy_access',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'under_review', 'reviewed', 'approved', 'rejected', 'history'),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [['draft', 'submitted', 'under_review', 'reviewed', 'approved', 'rejected', 'history']],
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
    isLivable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_livable',
    },
    reviewedBy: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'reviewed_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
    reviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'review_notes',
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'submitted_at',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
      validate: {
        isIP: true,
      },
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent',
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
    regencyId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'regency_id',
      references: {
        model: 'regencies',
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
    villageId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'village_id',
      references: {
        model: 'villages',
        key: 'id',
      },
    },
    createdBy: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    updatedBy: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'updated_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
  }, {
    tableName: 'form_submissions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['form_respondent_id'],
      },
      {
        fields: ['household_owner_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['verification_status'],
      },
      {
        fields: ['reviewed_by'],
      },
      {
        fields: ['submitted_at'],
      },
      {
        fields: ['province_id'],
      },
      {
        fields: ['regency_id'],
      },
      {
        fields: ['district_id'],
      },
      {
        fields: ['village_id'],
      },
      {
        fields: ['created_by'],
      },
      {
        fields: ['updated_by'],
      },
    ],
  });

  FormSubmission.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  FormSubmission.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  addCamelCaseToJSONHook(FormSubmission, [
    'created_by',
    'form_submission_id',
    'province_id',
    'regency_id',
    'district_id',
    'village_id',
    'reviewed_by',
    'updated_by',
    'verification_status',
  ]);

  FormSubmission.associate = (models) => {
    // Form submission is reviewed by a user
    FormSubmission.belongsTo(models.User, {
      foreignKey: 'reviewed_by',
      as: 'reviewer',
      onDelete: 'SET NULL',
    });

    // Form submission has one form respondent (1-to-1)
    FormSubmission.hasOne(models.FormRespondent, {
      foreignKey: 'form_submission_id',
      as: 'formRespondent',
      onDelete: 'CASCADE',
    });

    // Form submission belongs to a household owner (many submissions per owner)
    FormSubmission.belongsTo(models.HouseholdOwner, {
      foreignKey: 'household_owner_id',
      as: 'householdOwner',
      onDelete: 'SET NULL',
    });

    // Form submission has one house data (1-to-1)
    FormSubmission.hasOne(models.HouseData, {
      foreignKey: 'form_submission_id',
      as: 'houseData',
      onDelete: 'CASCADE',
    });

    // Form submission has one water access (1-to-1)
    FormSubmission.hasOne(models.WaterAccess, {
      foreignKey: 'form_submission_id',
      as: 'waterAccess',
      onDelete: 'CASCADE',
    });

    // Form submission has one sanitation access (1-to-1)
    FormSubmission.hasOne(models.SanitationAccess, {
      foreignKey: 'form_submission_id',
      as: 'sanitationAccess',
      onDelete: 'CASCADE',
    });

    // Form submission has one waste management (1-to-1)
    FormSubmission.hasOne(models.WasteManagement, {
      foreignKey: 'form_submission_id',
      as: 'wasteManagement',
      onDelete: 'CASCADE',
    });

    // Form submission has one road access (1-to-1)
    FormSubmission.hasOne(models.RoadAccess, {
      foreignKey: 'form_submission_id',
      as: 'roadAccess',
      onDelete: 'CASCADE',
    });

    // Form submission has one energy access (1-to-1)
    FormSubmission.hasOne(models.EnergyAccess, {
      foreignKey: 'form_submission_id',
      as: 'energyAccess',
      onDelete: 'CASCADE',
    });
  };

  return FormSubmission;
};
