const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const UserOAuthAccount = sequelize.define('UserOAuthAccount', {
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
    providerId: {
      type: DataTypes.STRING(12),
      allowNull: false,
      field: 'provider_id',
      references: {
        model: 'oauth_providers',
        key: 'id',
      },
    },
    providerUserId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'provider_user_id',
      validate: {
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [0, 100],
      },
    },
    avatarUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'avatar_url',
      validate: {
        isUrl: true,
      },
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'access_token',
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'refresh_token',
    },
    tokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'token_expires_at',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  }, {
    tableName: 'user_oauth_accounts',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['provider_id'],
      },
      {
        fields: ['provider_user_id'],
      },
      {
        fields: ['is_active'],
      },
    ],
  });

  // Add hooks to ensure ID is generated


  UserOAuthAccount.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });


  UserOAuthAccount.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });


  UserOAuthAccount.associate = (models) => {
    // A user OAuth account belongs to a user
    UserOAuthAccount.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user',
      onDelete: 'CASCADE',
    });

    // A user OAuth account belongs to an OAuth provider
    UserOAuthAccount.belongsTo(models.OAuthProvider, {
      foreignKey: 'provider_id',
      as: 'provider',
      onDelete: 'CASCADE',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(UserOAuthAccount, ['provider_id', 'user_id']);

  return UserOAuthAccount;
};
