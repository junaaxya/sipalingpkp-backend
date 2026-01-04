const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const Permission = sequelize.define('Permission', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    displayName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: 'display_name',
      validate: {
        notEmpty: true,
        len: [1, 150],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resource: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    scope: {
      type: DataTypes.ENUM('own', 'location', 'inherited', 'all'),
      allowNull: false,
      validate: {
        isIn: [['own', 'location', 'inherited', 'all']],
      },
    },
    isCritical: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_critical',
    },
    requiresApproval: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'requires_approval',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  }, {
    tableName: 'permissions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['resource'],
      },
      {
        fields: ['action'],
      },
      {
        fields: ['scope'],
      },
      {
        fields: ['is_critical'],
      },
      {
        fields: ['resource', 'action', 'scope'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  Permission.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  Permission.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  Permission.associate = (models) => {
    // A permission can be assigned to many roles
    Permission.belongsToMany(models.Role, {
      through: models.RolePermission,
      foreignKey: 'permission_id',
      otherKey: 'role_id',
      as: 'roles',
    });

    // A permission has many role permissions
    Permission.hasMany(models.RolePermission, {
      foreignKey: 'permission_id',
      as: 'rolePermissions',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(Permission, ['permission_id']);

  return Permission;
};
