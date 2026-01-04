const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const District = sequelize.define('District', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    regencyId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'regency_id',
      references: {
        model: 'regencies',
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
  }, {
    tableName: 'districts',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  // Add hooks to ensure ID is generated


  District.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  District.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  District.associate = (models) => {
    // A district belongs to a regency
    District.belongsTo(models.Regency, {
      foreignKey: 'regency_id',
      as: 'regency',
      onDelete: 'CASCADE',
    });

    // A district has many villages
    District.hasMany(models.Village, {
      foreignKey: 'district_id',
      as: 'villages',
      onDelete: 'CASCADE',
    });

    // A district can be assigned to many users
    District.hasMany(models.User, {
      foreignKey: 'assigned_district_id',
      as: 'assignedUsers',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(District, ['assigned_district_id', 'district_id', 'regency_id']);

  return District;
};
