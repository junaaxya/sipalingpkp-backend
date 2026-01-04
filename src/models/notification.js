const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.STRING(12),
      allowNull: false,
      primaryKey: true,
      defaultValue: generateId,
    },
    userId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'user_id',
    },
    type: {
      type: DataTypes.ENUM('info', 'warning', 'success'),
      allowNull: false,
      defaultValue: 'info',
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    link: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM('security', 'verification', 'status', 'audit'),
      allowNull: false,
      defaultValue: 'status',
    },
    auditLogId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'audit_log_id',
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_read',
    },
  }, {
    tableName: 'notifications',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id', 'is_read'] },
      { fields: ['created_at'] },
    ],
  });

  Notification.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });
  };

  addCamelCaseToJSONHook(Notification, ['user_id', 'audit_log_id']);

  return Notification;
};
