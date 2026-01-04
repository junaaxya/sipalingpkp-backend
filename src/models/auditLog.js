const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    resourceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'resource_type',
      validate: {
        len: [0, 50],
      },
    },
    resourceId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'resource_id',
    },
    oldValues: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'old_values',
    },
    newValues: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'new_values',
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
      validate: {
        isIP: true,
      },
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent',
    },
    requestId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'request_id',
      validate: {
        len: [0, 100],
      },
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'audit_logs',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['action'],
      },
      {
        fields: ['resource_type'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['user_id', 'action'],
      },
      {
        fields: ['resource_type', 'resource_id'],
      },
    ],
  });

  // Add hooks to ensure ID is generated
  AuditLog.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  AuditLog.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  AuditLog.associate = (models) => {
    // An audit log belongs to a user (nullable for system actions)
    AuditLog.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(AuditLog, ['created_at', 'user_id']);

  return AuditLog;
};
