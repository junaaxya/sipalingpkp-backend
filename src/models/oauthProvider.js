const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const OAuthProvider = sequelize.define('OAuthProvider', {
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
    clientId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'client_id',
      validate: {
        notEmpty: true,
      },
    },
    clientSecret: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'client_secret',
      validate: {
        notEmpty: true,
      },
    },
    redirectUri: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'redirect_uri',
      validate: {
        isUrl: true,
      },
    },
    scope: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    autoRegister: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'auto_register',
    },
  }, {
    tableName: 'oauth_providers',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['is_active'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  OAuthProvider.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  OAuthProvider.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  OAuthProvider.associate = (models) => {
    // An OAuth provider has many user OAuth accounts
    OAuthProvider.hasMany(models.UserOAuthAccount, {
      foreignKey: 'provider_id',
      as: 'userAccounts',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(OAuthProvider, ['provider_id']);

  return OAuthProvider;
};
