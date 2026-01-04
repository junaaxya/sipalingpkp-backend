const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const Village = sequelize.define('Village', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    districtId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'district_id',
      references: {
        model: 'districts',
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
    tableName: 'villages',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  });

  // Add hooks to ensure ID is generated


  Village.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  Village.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  Village.associate = (models) => {
    // A village belongs to a district
    Village.belongsTo(models.District, {
      foreignKey: 'district_id',
      as: 'district',
      onDelete: 'CASCADE',
    });

    // A village can be assigned to many users
    Village.hasMany(models.User, {
      foreignKey: 'assigned_village_id',
      as: 'assignedUsers',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(Village, ['assigned_village_id', 'district_id']);

  return Village;
};
