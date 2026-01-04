const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const RolePermission = sequelize.define('RolePermission', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
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
    permissionId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'permission_id',
      references: {
        model: 'permissions',
        key: 'id',
      },
    },
    grantedBy: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'granted_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    grantedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'granted_at',
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
    tableName: 'role_permissions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['role_id'],
      },
      {
        fields: ['permission_id'],
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


  RolePermission.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  RolePermission.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  RolePermission.associate = (models) => {
    // A role permission belongs to a role
    RolePermission.belongsTo(models.Role, {
      foreignKey: 'role_id',
      as: 'role',
      onDelete: 'CASCADE',
    });

    // A role permission belongs to a permission
    RolePermission.belongsTo(models.Permission, {
      foreignKey: 'permission_id',
      as: 'permission',
      onDelete: 'CASCADE',
    });

    // A role permission is granted by a user
    RolePermission.belongsTo(models.User, {
      foreignKey: 'granted_by',
      as: 'grantedByUser',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(RolePermission, ['granted_by', 'permission_id', 'role_id']);

  return RolePermission;
};
