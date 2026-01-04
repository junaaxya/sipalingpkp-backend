const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const UserSession = sequelize.define('UserSession', {
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
    sessionToken: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'session_token',
      validate: {
        notEmpty: true,
      },
    },
    refreshToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      field: 'refresh_token',
    },
    deviceInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'device_info',
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
    locationInfo: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'location_info',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
      validate: {
        isDate: true,
      },
    },
    lastActivityAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_activity_at',
    },
  }, {
    tableName: 'user_sessions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['session_token'],
      },
      {
        fields: ['refresh_token'],
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


  UserSession.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  UserSession.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  UserSession.associate = (models) => {
    // A session belongs to a user
    UserSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(UserSession, ['user_id']);

  return UserSession;
};
