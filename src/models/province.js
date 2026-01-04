const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const Province = sequelize.define('Province', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
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
  }, {
    tableName: 'provinces',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  // Add hooks to ensure ID is generated


  Province.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  Province.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  Province.associate = (models) => {
    // A province has many regencies
    Province.hasMany(models.Regency, {
      foreignKey: 'province_id',
      as: 'regencies',
      onDelete: 'CASCADE',
    });

    // A province can be assigned to many users
    Province.hasMany(models.User, {
      foreignKey: 'assigned_province_id',
      as: 'assignedUsers',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(Province, ['assigned_province_id', 'province_id']);

  return Province;
};
