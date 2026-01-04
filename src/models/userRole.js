const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const UserRole = sequelize.define('UserRole', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    roleId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'role_id',
      references: {
        model: 'roles',
        key: 'id',
      },
    },
    assignedBy: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'assigned_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'assigned_at',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  }, {
    tableName: 'user_roles',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['role_id'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['expires_at'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  UserRole.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  UserRole.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  UserRole.associate = (models) => {
    // A user role belongs to a user
    UserRole.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });

    // A user role belongs to a role
    UserRole.belongsTo(models.Role, {
      foreignKey: 'role_id',
      as: 'role',
      onDelete: 'CASCADE',
    });

    // A user role is assigned by a user
    UserRole.belongsTo(models.User, {
      foreignKey: 'assigned_by',
      as: 'assignedByUser',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(UserRole, ['assigned_by', 'role_id', 'user_id']);

  return UserRole;
};
