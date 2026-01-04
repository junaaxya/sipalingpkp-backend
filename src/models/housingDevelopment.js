const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const HousingDevelopment = sequelize.define('HousingDevelopment', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    developmentName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'development_name',
      validate: {
        len: [1, 200],
      },
    },
    developerName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'developer_name',
      validate: {
        len: [0, 200],
      },
    },
    landArea: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'land_area',
      comment: 'Area in hectares',
      validate: {
        min: 0,
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
    housingType: {
      type: DataTypes.ENUM('sederhana', 'menengah', 'mewah', 'campuran'),
      allowNull: false,
      field: 'housing_type',
      validate: {
        isIn: [['sederhana', 'menengah', 'mewah', 'campuran']],
      },
    },
    plannedUnitCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'planned_unit_count',
      comment: 'Jumlah rumah rencana',
      validate: {
        min: 0,
      },
    },
    hasRoadAccess: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'has_road_access',
    },
    roadLengthMeters: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'road_length_meters',
      comment: 'Panjang jalan in meters',
      validate: {
        min: 0,
      },
    },
    landStatus: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'land_status',
      validate: {
        len: [0, 100],
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
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'under_review', 'verified', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [['draft', 'submitted', 'under_review', 'verified', 'approved', 'rejected']],
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
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'verified_at',
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
    tableName: 'housing_developments',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['status'],
      },
      {
        fields: ['housing_type'],
      },
      {
        fields: ['latitude', 'longitude'],
        name: 'idx_housing_developments_coordinates',
      },
      {
        fields: ['village_id', 'district_id', 'regency_id', 'province_id'],
      },
      {
        fields: ['created_by'],
      },
      {
        fields: ['verified_by'],
      },
    ],
  });

  HousingDevelopment.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  HousingDevelopment.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  HousingDevelopment.associate = (models) => {
    HousingDevelopment.belongsTo(models.Village, {
      foreignKey: 'village_id',
      as: 'village',
      onDelete: 'SET NULL',
    });

    HousingDevelopment.belongsTo(models.District, {
      foreignKey: 'district_id',
      as: 'district',
      onDelete: 'SET NULL',
    });

    HousingDevelopment.belongsTo(models.Regency, {
      foreignKey: 'regency_id',
      as: 'regency',
      onDelete: 'SET NULL',
    });

    HousingDevelopment.belongsTo(models.Province, {
      foreignKey: 'province_id',
      as: 'province',
      onDelete: 'SET NULL',
    });

    HousingDevelopment.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator',
      onDelete: 'SET NULL',
    });

    HousingDevelopment.belongsTo(models.User, {
      foreignKey: 'updated_by',
      as: 'updater',
      onDelete: 'SET NULL',
    });

    HousingDevelopment.belongsTo(models.User, {
      foreignKey: 'verified_by',
      as: 'verifier',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(HousingDevelopment, [
    'created_by',
    'district_id',
    'province_id',
    'regency_id',
    'review_notes',
    'updated_by',
    'verified_by',
    'village_id',
    'verification_status',
  ]);

  return HousingDevelopment;
};
