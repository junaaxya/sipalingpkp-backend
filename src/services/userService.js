const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const { saveProfileAvatar } = require('../utils/profileUpload');
const { getPublicUrl } = require('../utils/fileUpload');
const {
  User,
  UserSession,
  AuditLog,
  Role,
  UserRole,
  RolePermission,
  Province,
  Regency,
  District,
  Village,
  RoleCategory,
  Permission,
  sequelize,
} = require('../models');
const { errorFactory } = require('../errors/errorUtils');
const { paginationUtils } = require('../utils/lodashUtils');

const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
};

/**
 * Get user profile with complete information
 */
async function getUserProfile(userId, transaction = null) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['passwordHash'] },
    transaction,
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
        where: { isActive: true },
        required: false,
      },
      {
        model: Province,
        as: 'assignedProvince',
        required: false,
      },
      {
        model: Regency,
        as: 'assignedRegency',
        required: false,
      },
      {
        model: District,
        as: 'assignedDistrict',
        required: false,
      },
      {
        model: Village,
        as: 'assignedVillage',
        required: false,
      },
    ],
  });

  if (!user) {
    throw errorFactory.notFound('User not found');
  }

  let permissionPayload = [];
  let permissionNames = [];
  try {
    const fallbackPermissions = await Permission.findAll({
      transaction,
      include: [
        {
          model: RolePermission,
          as: 'rolePermissions',
          include: [
            {
              model: Role,
              as: 'role',
              include: [
                {
                  model: UserRole,
                  as: 'userRoles',
                  where: {
                    userId,
                    isActive: true,
                    expiresAt: { [Op.or]: [null, { [Op.gt]: new Date() }] },
                  },
                },
              ],
            },
          ],
        },
      ],
      where: { isActive: true },
    });

    permissionPayload = fallbackPermissions.map((permission) => (
      permission.toJSON ? permission.toJSON() : permission
    ));
    permissionNames = permissionPayload
      .map((permission) => permission?.name)
      .filter(Boolean);
  } catch (fallbackError) {
    console.warn('Permission lookup failed:', fallbackError.message);
  }
  const roleNames = (user.roles || [])
    .map((role) => role?.name || role?.displayName)
    .filter(Boolean);

  const userPayload = user.toJSON ? user.toJSON() : user;
  if (userPayload?.avatarUrl) {
    userPayload.avatarUrl = getPublicUrl(userPayload.avatarUrl);
  }

  return {
    ...userPayload,
    permissions: permissionPayload,
    permissionNames,
    roleNames,
  };
}

/**
 * Update user profile
 */
async function updateUserProfile(userId, updateData, transaction = null) {
  const user = await User.findByPk(userId, { transaction });
  if (!user) {
    throw errorFactory.notFound('User not found');
  }

  if (updateData.fullName) {
    const normalizedName = String(updateData.fullName)
      .replace(/[\s\u00A0]+/g, ' ')
      .trim();
    const nameRegex = /^[a-zA-Z\u00C0-\u017F.'-]+(\s+[a-zA-Z\u00C0-\u017F.'-]+)*$/;
    if (!nameRegex.test(normalizedName)) {
      throw errorFactory.validation('Nama mengandung karakter tidak valid', 'fullName');
    }
    updateData.fullName = normalizedName;
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'phone')) {
    if (!updateData.phone) {
      updateData.phone = null;
    } else {
      const normalizedPhone = normalizePhoneNumber(updateData.phone);
      const phoneRegex = /^628\d{7,12}$/;
      if (!phoneRegex.test(normalizedPhone)) {
        throw errorFactory.validation('Nomor HP tidak valid', 'phone');
      }
      updateData.phone = normalizedPhone;
    }
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'familyCardNumber')) {
    if (!updateData.familyCardNumber) {
      updateData.familyCardNumber = null;
    } else {
      const normalizedId = String(updateData.familyCardNumber).replace(/\D/g, '');
      if (normalizedId.length < 8 || normalizedId.length > 20) {
        throw errorFactory.validation('Nomor identitas tidak valid', 'familyCardNumber');
      }
      updateData.familyCardNumber = normalizedId;
    }
  }

  // Filter allowed fields
  const allowedFields = ['fullName', 'phone', 'familyCardNumber'];

  const filteredData = Object.keys(updateData)
    .filter((key) => allowedFields.includes(key))
    .reduce((acc, key) => {
      acc[key] = updateData[key];
      return acc;
    }, {});

  await user.update(filteredData, { transaction });

  // Create audit log
  await AuditLog.create({
    userId,
    action: 'PROFILE_UPDATE',
    resourceType: 'user',
    resourceId: userId,
    metadata: filteredData,
  }, { transaction });

  return getUserProfile(userId, transaction);
}

/**
 * Toggle two-factor authentication
 */
async function updateTwoFactorSetting(userId, enabled) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw errorFactory.notFound('User not found');
  }

  await user.update({ twoFactorEnabled: Boolean(enabled) });

  await AuditLog.create({
    userId,
    action: 'two_factor_updated',
    resourceType: 'user',
    resourceId: userId,
    metadata: { enabled: Boolean(enabled) },
  });

  return getUserProfile(userId);
}

/**
 * Update notification preferences
 */
async function updateNotificationPreferences(userId, preferences) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw errorFactory.notFound('User not found');
  }

  const updates = {
    notificationEmailEnabled: Boolean(preferences.notificationEmailEnabled),
    notificationWhatsappEnabled: Boolean(preferences.notificationWhatsappEnabled),
  };

  await user.update(updates);

  await AuditLog.create({
    userId,
    action: 'NOTIFICATION_PREF_UPDATE',
    resourceType: 'user',
    resourceId: userId,
    metadata: updates,
  });

  return getUserProfile(userId);
}

/**
 * Update user avatar
 */
async function updateUserAvatar(userId, file) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw errorFactory.notFound('User not found');
  }

  if (!file) {
    throw errorFactory.validation('Foto profil wajib diunggah', 'avatar');
  }

  const { relativePath } = await saveProfileAvatar(file, userId);
  await user.update({ avatarUrl: relativePath });

  await AuditLog.create({
    userId,
    action: 'PROFILE_AVATAR_UPDATE',
    resourceType: 'user',
    resourceId: userId,
    metadata: { avatarUrl: relativePath },
  });

  return getUserProfile(userId);
}

/**
 * Revoke all user sessions
 */
async function revokeAllUserSessions(userId) {
  await UserSession.update(
    { isActive: false },
    { where: { userId, isActive: true } },
  );

  await AuditLog.create({
    userId,
    action: 'sessions_revoked',
    resourceType: 'user_session',
    resourceId: userId,
  });

  return { success: true, message: 'All sessions revoked' };
}

/**
 * Change user password
 */
async function changeUserPassword(userId, currentPassword, newPassword) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw errorFactory.notFound('User not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    throw errorFactory.authentication('Current password is incorrect');
  }

  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await user.update({ passwordHash: newPasswordHash });

  // Sign out all sessions
  await UserSession.update(
    { isActive: false },
    { where: { userId, isActive: true } },
  );

  // Create audit log
  await AuditLog.create({
    userId,
    action: 'password_changed',
    resourceType: 'user',
    resourceId: userId,
    metadata: { action: 'password_change' },
  });

  return { success: true, message: 'Password updated successfully' };
}

/**
 * Get user sessions
 */
async function getUserSessions(userId, options = {}) {
  const { page = 1, limit = 10, currentSessionToken = null } = options;
  const offset = (page - 1) * limit;

  const sessions = await UserSession.findAndCountAll({
    where: { userId },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  const mappedRows = (sessions.rows || []).map((session) => {
    const data = session.toJSON();
    const parser = new UAParser(data.userAgent || '');
    const result = parser.getResult();
    const deviceType = result.device?.type || 'desktop';
    const ipAddress = data.ipAddress || null;
    const isLocalIp = ipAddress === '127.0.0.1' || ipAddress === '::1';
    const lookup = ipAddress ? geoip.lookup(ipAddress) : null;
    const locationInfo = data.locationInfo && typeof data.locationInfo === 'object'
      ? data.locationInfo
      : lookup
        ? {
          city: lookup.city || null,
          region: lookup.region || null,
          country: lookup.country || null,
          timezone: lookup.timezone || null,
        }
        : null;
    const locationLabel = locationInfo?.city
      || locationInfo?.region
      || locationInfo?.country
      || (isLocalIp ? 'Lokal' : null);
    return {
      ...data,
      client: {
        browser: {
          name: result.browser?.name || 'Unknown',
          version: result.browser?.version || null,
        },
        os: {
          name: result.os?.name || 'Unknown',
          version: result.os?.version || null,
        },
        device: {
          type: deviceType,
          model: result.device?.model || null,
          vendor: result.device?.vendor || null,
        },
        location: locationInfo || null,
      },
      locationLabel,
      isCurrent: currentSessionToken
        ? data.sessionToken === currentSessionToken
        : false,
    };
  });

  return paginationUtils.formatPagination(
    { ...sessions, rows: mappedRows },
    page,
    limit,
  );
}

/**
 * Revoke user session
 */
async function revokeUserSession(userId, sessionId) {
  const session = await UserSession.findOne({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw errorFactory.notFound('Session not found');
  }

  await session.update({ isActive: false });

  // Create audit log
  await AuditLog.create({
    userId,
    action: 'session_revoked',
    resourceType: 'user_session',
    resourceId: sessionId,
    metadata: { sessionId },
  });

  return { success: true };
}

/**
 * Get user roles
 */
async function getUserRoles(userId) {
  const userRoles = await UserRole.findAll({
    where: { userId, isActive: true },
    include: [
      {
        model: Role,
        as: 'role',
        include: [
          {
            model: RoleCategory,
            as: 'category',
            required: false,
          },
        ],
      },
    ],
    order: [[sequelize.literal('created_at'), 'DESC']],
  });

  return userRoles.map((userRole) => ({
    id: userRole.id,
    role: userRole.role,
    assignedAt: userRole.createdAt,
    expiresAt: userRole.expiresAt,
    assignedBy: userRole.assignedBy,
  }));
}

/**
 * Assign role to user
 */
async function assignUserRole(userId, roleId, assignedBy, expiresAt = null) {
  // Check if user exists
  const user = await User.findByPk(userId);
  if (!user) {
    throw errorFactory.notFound('User not found');
  }

  // Check if role exists
  const role = await Role.findByPk(roleId);
  if (!role) {
    throw errorFactory.notFound('Role not found');
  }

  // Check if user already has this role
  const existingUserRole = await UserRole.findOne({
    where: { userId, roleId, isActive: true },
  });

  if (existingUserRole) {
    throw errorFactory.conflict('User already has this role');
  }

  // Assign role
  const userRole = await UserRole.create({
    userId,
    roleId,
    assignedBy,
    expiresAt,
    isActive: true,
  });

  // Create audit log
  await AuditLog.create({
    userId,
    action: 'role_assigned',
    resourceType: 'user_role',
    resourceId: userRole.id,
    metadata: { roleId, assignedBy, expiresAt },
  });

  return userRole;
}

/**
 * Remove role from user
 */
async function removeUserRole(userId, userRoleId) {
  const userRole = await UserRole.findOne({
    where: { id: userRoleId, userId },
  });

  if (!userRole) {
    throw errorFactory.notFound('User role not found');
  }

  await userRole.update({ isActive: false });

  // Create audit log
  await AuditLog.create({
    userId,
    action: 'role_removed',
    resourceType: 'user_role',
    resourceId: userRoleId,
    metadata: { roleId: userRole.roleId },
  });

  return { success: true };
}

/**
 * Get user permissions
 */
async function getUserPermissions(userId) {
  const userRoles = await UserRole.findAll({
    where: { userId, isActive: true },
    include: [
      {
        model: Role,
        as: 'role',
        include: [
          {
            model: Permission,
            as: 'permissions',
            through: { attributes: [] },
            where: { isActive: true },
            required: false,
          },
        ],
      },
    ],
  });

  const permissions = new Map();

  userRoles.forEach((userRole) => {
    if (userRole.role && userRole.role.permissions) {
      userRole.role.permissions.forEach((permission) => {
        permissions.set(permission.id, permission);
      });
    }
  });

  return Array.from(permissions.values());
}

/**
 * Get user audit logs
 */
async function getUserAuditLogs(userId, options = {}) {
  const {
    page = 1, limit = 10, action, resourceType, startDate, endDate,
  } = options;
  const offset = (page - 1) * limit;

  const whereClause = { userId };

  if (action) whereClause.action = action;
  if (resourceType) whereClause.resourceType = resourceType;
  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt[Op.gte] = startDate;
    if (endDate) whereClause.createdAt[Op.lte] = endDate;
  }

  const auditLogs = await AuditLog.findAndCountAll({
    where: whereClause,
    order: [[sequelize.literal('created_at'), 'DESC']],
    limit,
    offset,
  });

  return paginationUtils.formatPagination(auditLogs, page, limit);
}

/**
 * Get users with pagination and filters
 */
async function getUsers(options = {}) {
  const {
    page = 1, limit = 10, search, userLevel, isActive,
    assignedProvinceId, assignedRegencyId, assignedDistrictId, assignedVillageId,
  } = options;

  const offset = (page - 1) * limit;
  const whereClause = {};

  if (search) {
    whereClause[Op.or] = [
      { fullName: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  if (userLevel) whereClause.userLevel = userLevel;
  if (isActive !== undefined) whereClause.isActive = isActive;
  if (assignedProvinceId) whereClause.assignedProvinceId = assignedProvinceId;
  if (assignedRegencyId) whereClause.assignedRegencyId = assignedRegencyId;
  if (assignedDistrictId) whereClause.assignedDistrictId = assignedDistrictId;
  if (assignedVillageId) whereClause.assignedVillageId = assignedVillageId;

  const users = await User.findAndCountAll({
    where: whereClause,
    attributes: { exclude: ['passwordHash'] },
    include: [
      {
        model: Role,
        as: 'roles',
        through: { attributes: [] },
        where: { isActive: true },
        required: false,
      },
      {
        model: Province,
        as: 'assignedProvince',
        required: false,
      },
      {
        model: Regency,
        as: 'assignedRegency',
        required: false,
      },
      {
        model: District,
        as: 'assignedDistrict',
        required: false,
      },
      {
        model: Village,
        as: 'assignedVillage',
        required: false,
      },
    ],
    order: [[sequelize.literal('created_at'), 'DESC']],
    limit,
    offset,
  });

  return paginationUtils.formatPagination(users, page, limit);
}

/**
 * Deactivate user
 */
async function deactivateUser(userId, deactivatedBy) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw errorFactory.notFound('User not found');
  }

  await user.update({ isActive: false });

  // Sign out all sessions
  await UserSession.update(
    { isActive: false },
    { where: { userId, isActive: true } },
  );

  // Create audit log
  await AuditLog.create({
    userId,
    action: 'user_deactivated',
    resourceType: 'user',
    resourceId: userId,
    metadata: { deactivatedBy },
  });

  return { success: true };
}

/**
 * Activate user
 */
async function activateUser(userId, activatedBy) {
  const user = await User.findByPk(userId);
  if (!user) {
    throw errorFactory.notFound('User not found');
  }

  await user.update({ isActive: true });

  // Create audit log
  await AuditLog.create({
    userId,
    action: 'user_activated',
    resourceType: 'user',
    resourceId: userId,
    metadata: { activatedBy },
  });

  return { success: true };
}

/**
 * Create staff user (admin desa/kabupaten/verifikator)
 */
async function createStaffUser(payload, createdBy) {
  const {
    fullName,
    email,
    password,
    role,
    regencyId,
    villageId,
  } = payload;

  const normalizedRole = String(role || '').trim().toLowerCase();
  if (normalizedRole === 'masyarakat') {
    throw errorFactory.validation('Role masyarakat hanya bisa dibuat lewat pendaftaran warga.');
  }
  const roleMap = {
    admin_desa: {
      roleName: 'admin_village',
      userLevel: 'village',
      requiresVillage: true,
    },
    admin_kabupaten: {
      roleName: 'admin_regency',
      userLevel: 'regency',
      requiresRegency: true,
    },
    verifikator: {
      roleName: 'verifikator',
      userLevel: 'regency',
      requiresRegency: true,
    },
  };

  const roleConfig = roleMap[normalizedRole];
  if (!roleConfig) {
    throw errorFactory.validation('Role tidak valid untuk akun pejabat.');
  }

  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw errorFactory.conflict('User dengan email tersebut sudah ada', 'USER_EXISTS');
  }

  let assignedProvinceId = null;
  let assignedRegencyId = null;
  let assignedDistrictId = null;
  let assignedVillageId = null;

  if (roleConfig.requiresRegency) {
    if (!regencyId) {
      throw errorFactory.validation('Kabupaten wajib diisi untuk role ini.');
    }
    const regency = await Regency.findByPk(regencyId);
    if (!regency) {
      throw errorFactory.notFound('Kabupaten tidak ditemukan');
    }
    assignedRegencyId = regency.id;
    assignedProvinceId = regency.provinceId || null;
  }

  if (roleConfig.requiresVillage) {
    if (!villageId) {
      throw errorFactory.validation('Desa wajib diisi untuk role ini.');
    }
    const village = await Village.findByPk(villageId, {
      include: [
        {
          model: District,
          as: 'district',
          required: false,
          include: [
            {
              model: Regency,
              as: 'regency',
              required: false,
              include: [
                {
                  model: Province,
                  as: 'province',
                  required: false,
                },
              ],
            },
          ],
        },
      ],
    });

    if (!village) {
      throw errorFactory.notFound('Desa tidak ditemukan');
    }

    assignedVillageId = village.id;
    assignedDistrictId = village.district?.id || null;
    assignedRegencyId = village.district?.regency?.id || null;
    assignedProvinceId = village.district?.regency?.province?.id || null;
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  return sequelize.transaction(async (transaction) => {
    const user = await User.create({
      fullName,
      email,
      passwordHash,
      userLevel: roleConfig.userLevel,
      assignedProvinceId,
      assignedRegencyId,
      assignedDistrictId,
      assignedVillageId,
      emailVerified: true,
      isActive: true,
    }, { transaction });

    const roleRecord = await Role.findOne({
      where: { name: roleConfig.roleName, isActive: true },
      transaction,
    });
    if (!roleRecord) {
      throw errorFactory.notFound('Role pejabat belum tersedia di sistem.');
    }

    await UserRole.create({
      userId: user.id,
      roleId: roleRecord.id,
      assignedBy: createdBy,
      isActive: true,
    }, { transaction });

    await AuditLog.create({
      userId: createdBy,
      action: 'staff_user_created',
      resourceType: 'user',
      resourceId: user.id,
      metadata: {
        role: roleConfig.roleName,
        assignedProvinceId,
        assignedRegencyId,
        assignedDistrictId,
        assignedVillageId,
      },
    }, { transaction });

    return getUserProfile(user.id, transaction);
  });
}

/**
 * Update staff user (admin desa/kabupaten/verifikator)
 */
async function adminUpdateUser(userId, payload, updatedBy) {
  const {
    fullName,
    role,
    regencyId,
    villageId,
  } = payload;

  const normalizedRole = String(role || '').trim().toLowerCase();
  if (normalizedRole === 'masyarakat') {
    throw errorFactory.validation('Role masyarakat hanya bisa dibuat lewat pendaftaran warga.');
  }

  const roleMap = {
    admin_desa: {
      roleName: 'admin_village',
      userLevel: 'village',
      requiresVillage: true,
    },
    admin_kabupaten: {
      roleName: 'admin_regency',
      userLevel: 'regency',
      requiresRegency: true,
    },
    verifikator: {
      roleName: 'verifikator',
      userLevel: 'regency',
      requiresRegency: true,
    },
  };

  const roleConfig = roleMap[normalizedRole];
  if (!roleConfig) {
    throw errorFactory.validation('Role tidak valid untuk akun pejabat.');
  }

  return sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      throw errorFactory.notFound('User not found');
    }

    let assignedProvinceId = null;
    let assignedRegencyId = null;
    let assignedDistrictId = null;
    let assignedVillageId = null;

    if (roleConfig.requiresRegency) {
      if (!regencyId) {
        throw errorFactory.validation('Kabupaten wajib diisi untuk role ini.');
      }
      const regency = await Regency.findByPk(regencyId, { transaction });
      if (!regency) {
        throw errorFactory.notFound('Kabupaten tidak ditemukan');
      }
      assignedRegencyId = regency.id;
      assignedProvinceId = regency.provinceId || null;
    }

    if (roleConfig.requiresVillage) {
      if (!villageId) {
        throw errorFactory.validation('Desa wajib diisi untuk role ini.');
      }
      const village = await Village.findByPk(villageId, {
        transaction,
        include: [
          {
            model: District,
            as: 'district',
            required: false,
            include: [
              {
                model: Regency,
                as: 'regency',
                required: false,
                include: [
                  {
                    model: Province,
                    as: 'province',
                    required: false,
                  },
                ],
              },
            ],
          },
        ],
      });

      if (!village) {
        throw errorFactory.notFound('Desa tidak ditemukan');
      }

      assignedVillageId = village.id;
      assignedDistrictId = village.district?.id || null;
      assignedRegencyId = village.district?.regency?.id || null;
      assignedProvinceId = village.district?.regency?.province?.id || null;
    }

    await user.update({
      fullName,
      userLevel: roleConfig.userLevel,
      assignedProvinceId,
      assignedRegencyId,
      assignedDistrictId,
      assignedVillageId,
    }, { transaction });

    const roleRecord = await Role.findOne({
      where: { name: roleConfig.roleName, isActive: true },
      transaction,
    });
    if (!roleRecord) {
      throw errorFactory.notFound('Role pejabat belum tersedia di sistem.');
    }

    await UserRole.update(
      { isActive: false },
      { where: { userId: user.id, isActive: true }, transaction },
    );

    await UserRole.create({
      userId: user.id,
      roleId: roleRecord.id,
      assignedBy: updatedBy,
      isActive: true,
    }, { transaction });

    await AuditLog.create({
      userId: updatedBy,
      action: 'staff_user_updated',
      resourceType: 'user',
      resourceId: user.id,
      metadata: {
        role: roleConfig.roleName,
        assignedProvinceId,
        assignedRegencyId,
        assignedDistrictId,
        assignedVillageId,
      },
    }, { transaction });

    return getUserProfile(user.id, transaction);
  });
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  updateTwoFactorSetting,
  updateNotificationPreferences,
  updateUserAvatar,
  revokeAllUserSessions,
  getUserSessions,
  revokeUserSession,
  getUserRoles,
  assignUserRole,
  removeUserRole,
  getUserPermissions,
  getUserAuditLogs,
  getUsers,
  deactivateUser,
  activateUser,
  createStaffUser,
  adminUpdateUser,
};
