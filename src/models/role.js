const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const Role = sequelize.define('Role', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'display_name',
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'category_id',
      references: {
        model: 'role_categories',
        key: 'id',
      },
    },
    isSystemRole: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_system_role',
    },
    isDeletable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_deletable',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    parentRoleId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'parent_role_id',
      references: {
        model: 'roles',
        key: 'id',
      },
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
  }, {
    tableName: 'roles',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['category_id'],
      },
      {
        fields: ['is_system_role'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['parent_role_id'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  Role.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  Role.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  Role.associate = (models) => {
    // A role belongs to a category
    Role.belongsTo(models.RoleCategory, {
      foreignKey: 'category_id',
      as: 'category',
      onDelete: 'SET NULL',
    });

    // A role can have a parent role (hierarchy)
    Role.belongsTo(models.Role, {
      foreignKey: 'parent_role_id',
      as: 'parentRole',
      onDelete: 'SET NULL',
    });

    // A role can have many child roles
    Role.hasMany(models.Role, {
      foreignKey: 'parent_role_id',
      as: 'childRoles',
      onDelete: 'SET NULL',
    });

    // A role is created by a user
    Role.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator',
      onDelete: 'SET NULL',
    });

    // A role has many permissions
    Role.belongsToMany(models.Permission, {
      through: models.RolePermission,
      foreignKey: 'role_id',
      otherKey: 'permission_id',
      as: 'permissions',
    });

    // A role can be assigned to many users
    Role.belongsToMany(models.User, {
      through: models.UserRole,
      foreignKey: 'role_id',
      otherKey: 'user_id',
      as: 'users',
    });

    // A role has many role permissions
    Role.hasMany(models.RolePermission, {
      foreignKey: 'role_id',
      as: 'rolePermissions',
      onDelete: 'CASCADE',
    });

    // A role has many user roles
    Role.hasMany(models.UserRole, {
      foreignKey: 'role_id',
      as: 'userRoles',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(Role, [
    'category_id',
    'created_by',
    'parent_role_id',
    'role_id',
  ]);

  return Role;
};
