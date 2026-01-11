const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const HouseholdOwner = sequelize.define('HouseholdOwner', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    ownerName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'owner_name',
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    ownerPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'owner_phone',
      validate: {
        len: [0, 20],
      },
    },
    headOfFamilyName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'head_of_family_name',
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    headOfFamilyPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'head_of_family_phone',
      validate: {
        len: [0, 20],
      },
    },
    headOfFamilyAge: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'head_of_family_age',
      validate: {
        min: 0,
        max: 150,
      },
    },
    familyCardNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'family_card_number',
      validate: {
        len: [0, 20],
      },
    },
    totalFamilyMembers: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'total_family_members',
      validate: {
        min: 1,
      },
    },
    houseNumber: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'house_number',
      validate: {
        len: [0, 255],
      },
    },
    rt: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        len: [0, 10],
      },
    },
    rw: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: {
        len: [0, 10],
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
    educationLevel: {
      type: DataTypes.ENUM('tidak_sekolah', 'sd', 'smp', 'sma', 'diploma', 'sarjana', 'magister', 'doktor', 'lainnya'),
      allowNull: true,
      field: 'education_level',
      validate: {
        isIn: [['tidak_sekolah', 'sd', 'smp', 'sma', 'diploma', 'sarjana', 'magister', 'doktor', 'lainnya']],
      },
    },
    educationLevelOther: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'education_level_other',
      validate: {
        len: [0, 100],
      },
    },
    occupation: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100],
      },
    },
    monthlyIncome: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: 'monthly_income',
      validate: {
        min: 0,
      },
    },
    landOwnershipStatus: {
      type: DataTypes.ENUM('milik_sendiri', 'bukan_milik_sendiri'),
      allowNull: false,
      field: 'land_ownership_status',
      validate: {
        isIn: [['milik_sendiri', 'bukan_milik_sendiri']],
      },
    },
    houseOwnershipStatus: {
      type: DataTypes.ENUM('milik_sendiri', 'sewa', 'menumpang'),
      allowNull: false,
      field: 'house_ownership_status',
      validate: {
        isIn: [['milik_sendiri', 'sewa', 'menumpang']],
      },
    },
    hasReceivedHousingAssistance: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'has_received_housing_assistance',
    },
    housingAssistanceYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'housing_assistance_year',
      validate: {
        min: 1900,
        max: new Date().getFullYear(),
      },
    },
    isRegisteredAsPoor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_registered_as_poor',
    },
    poorRegistrationAttachment: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'poor_registration_attachment',
      validate: {
        len: [0, 255],
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
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      validate: {
        min: -90,
        max: 90,
      },
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      validate: {
        min: -180,
        max: 180,
      },
    },
    geom: {
      type: DataTypes.GEOMETRY('POINT', 4326),
      allowNull: true,
    },
  }, {
    tableName: 'household_owners',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
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
        fields: ['rt', 'rw'],
      },
      {
        fields: ['form_submission_id'],
      },
      {
        fields: ['latitude', 'longitude'],
        name: 'idx_household_owners_coordinates',
      },
    ],
  });

  // Add hooks to ensure ID is generated


  HouseholdOwner.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  HouseholdOwner.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  HouseholdOwner.associate = (models) => {
    // Geographic associations
    HouseholdOwner.belongsTo(models.Village, {
      foreignKey: 'village_id',
      as: 'village',
      onDelete: 'SET NULL',
    });

    HouseholdOwner.belongsTo(models.District, {
      foreignKey: 'district_id',
      as: 'district',
      onDelete: 'SET NULL',
    });

    HouseholdOwner.belongsTo(models.Regency, {
      foreignKey: 'regency_id',
      as: 'regency',
      onDelete: 'SET NULL',
    });

    HouseholdOwner.belongsTo(models.Province, {
      foreignKey: 'province_id',
      as: 'province',
      onDelete: 'SET NULL',
    });

    HouseholdOwner.hasMany(models.FormSubmission, {
      foreignKey: 'household_owner_id',
      as: 'formSubmissions',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(HouseholdOwner, [
    'district_id',
    'form_submission_id',
    'province_id',
    'regency_id',
    'village_id',
  ]);

  return HouseholdOwner;
};
