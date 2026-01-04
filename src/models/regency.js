const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const Regency = sequelize.define('Regency', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    provinceId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'province_id',
      references: {
        model: 'provinces',
        key: 'id',
      },
    },
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 10],
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    type: {
      type: DataTypes.ENUM('kota', 'kabupaten'),
      allowNull: false,
      validate: {
        isIn: [['kota', 'kabupaten']],
      },
    },
  }, {
    tableName: 'regencies',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  // Add hooks to ensure ID is generated
  Regency.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  Regency.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  Regency.associate = (models) => {
    // A regency belongs to a province
    Regency.belongsTo(models.Province, {
      foreignKey: 'province_id',
      as: 'province',
      onDelete: 'CASCADE',
    });

    // A regency has many districts
    Regency.hasMany(models.District, {
      foreignKey: 'regency_id',
      as: 'districts',
      onDelete: 'CASCADE',
    });

    // A regency can be assigned to many users
    Regency.hasMany(models.User, {
      foreignKey: 'assigned_regency_id',
      as: 'assignedUsers',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(Regency, ['assigned_regency_id', 'province_id', 'regency_id']);

  return Regency;
};
