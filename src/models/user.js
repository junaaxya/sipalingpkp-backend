const { DataTypes } = require('sequelize');
const { generateId } = require('../config/nanoid');
const { addCamelCaseToJSONHook } = require('../utils/modelUtils');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.STRING(12),
      primaryKey: true,
      defaultValue: generateId,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
      validate: {
        notEmpty: true,
      },
    },
    fullName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'full_name',
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [0, 20],
      },
    },
    avatarUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'avatar_url',
      validate: {
        len: [0, 500],
      },
    },
    // Location Assignment
    assignedProvinceId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'assigned_province_id',
      references: {
        model: 'provinces',
        key: 'id',
      },
    },
    assignedRegencyId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'assigned_regency_id',
      references: {
        model: 'regencies',
        key: 'id',
      },
    },
    assignedDistrictId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'assigned_district_id',
      references: {
        model: 'districts',
        key: 'id',
      },
    },
    assignedVillageId: {
      type: DataTypes.STRING(12),
      allowNull: true,
      field: 'assigned_village_id',
      references: {
        model: 'villages',
        key: 'id',
      },
    },
    // User Level
    userLevel: {
      type: DataTypes.ENUM('province', 'regency', 'district', 'village', 'citizen'),
      allowNull: false,
      field: 'user_level',
      validate: {
        isIn: [['province', 'regency', 'district', 'village', 'citizen']],
      },
    },
    // Inheritance Control
    canInheritData: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'can_inherit_data',
    },
    inheritanceDepth: {
      type: DataTypes.ENUM('direct', 'all_children'),
      allowNull: false,
      defaultValue: 'all_children',
      field: 'inheritance_depth',
      validate: {
        isIn: [['direct', 'all_children']],
      },
    },
    // Authentication fields
    emailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'email_verified',
    },
    emailVerificationToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'email_verification_token',
    },
    emailVerificationExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'email_verification_expires_at',
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'phone_verified',
    },
    otpCode: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'otp_code',
    },
    otpExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'otp_expires_at',
    },
    passwordResetToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_reset_token',
    },
    passwordResetExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'password_reset_expires_at',
    },
    // Security fields
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at',
    },
    loginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'login_attempts',
      validate: {
        min: 0,
      },
    },
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'locked_until',
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'two_factor_enabled',
    },
    twoFactorSecret: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'two_factor_secret',
    },
    notificationEmailEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'notification_email_enabled',
    },
    notificationWhatsappEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'notification_whatsapp_enabled',
    },
    // Status
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['email'],
      },
      {
        fields: ['user_level'],
      },
      {
        fields: ['assigned_province_id'],
      },
      {
        fields: ['assigned_regency_id'],
      },
      {
        fields: ['assigned_district_id'],
      },
      {
        fields: ['assigned_village_id'],
      },
      {
        fields: ['is_active'],
      },
    ],
  });

  // Add hooks to ensure ID is generated
  User.beforeValidate((instance) => {
    if (!instance.id) {
      instance.id = generateId();
    }
  });

  User.beforeBulkCreate((instances) => {
    instances.forEach((instance) => {
      if (!instance.id) {
        instance.id = generateId();
      }
    });
  });

  User.associate = (models) => {
    // User belongs to assigned location
    User.belongsTo(models.Province, {
      foreignKey: 'assigned_province_id',
      as: 'assignedProvince',
      onDelete: 'SET NULL',
    });

    User.belongsTo(models.Regency, {
      foreignKey: 'assigned_regency_id',
      as: 'assignedRegency',
      onDelete: 'SET NULL',
    });

    User.belongsTo(models.District, {
      foreignKey: 'assigned_district_id',
      as: 'assignedDistrict',
      onDelete: 'SET NULL',
    });

    User.belongsTo(models.Village, {
      foreignKey: 'assigned_village_id',
      as: 'assignedVillage',
      onDelete: 'SET NULL',
    });

    // User has many roles
    User.belongsToMany(models.Role, {
      through: models.UserRole,
      foreignKey: 'user_id',
      otherKey: 'role_id',
      as: 'roles',
    });

    // User has many sessions
    User.hasMany(models.UserSession, {
      foreignKey: 'user_id',
      as: 'sessions',
      onDelete: 'CASCADE',
    });

    // User has many notifications
    User.hasMany(models.Notification, {
      foreignKey: 'user_id',
      as: 'notifications',
      onDelete: 'CASCADE',
    });

    // User has many audit logs
    User.hasMany(models.AuditLog, {
      foreignKey: 'user_id',
      as: 'auditLogs',
      onDelete: 'SET NULL',
    });

    // User has many OAuth accounts
    User.hasMany(models.UserOAuthAccount, {
      foreignKey: 'user_id',
      as: 'oauthAccounts',
      onDelete: 'CASCADE',
    });

    // User can create roles
    User.hasMany(models.Role, {
      foreignKey: 'created_by',
      as: 'createdRoles',
      onDelete: 'SET NULL',
    });

    // User can assign roles to others
    User.hasMany(models.UserRole, {
      foreignKey: 'assigned_by',
      as: 'assignedUserRoles',
      onDelete: 'SET NULL',
    });

    // User can grant permissions
    User.hasMany(models.RolePermission, {
      foreignKey: 'granted_by',
      as: 'grantedRolePermissions',
      onDelete: 'SET NULL',
    });
  };

  // Add global camelCase toJSON hook
  addCamelCaseToJSONHook(User, [
    'assigned_by',
    'assigned_district_id',
    'assigned_province_id',
    'assigned_regency_id',
    'assigned_village_id',
    'created_by',
    'granted_by',
    'user_id',
  ]);

  return User;
};
