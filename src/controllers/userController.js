const {
  getUserProfile,
  updateUserProfile,
  updateUserAvatar,
  changeUserPassword,
  updateTwoFactorSetting,
  updateNotificationPreferences,
  revokeAllUserSessions,
  getUserSessions,
  revokeUserSession,
  getUserRoles,
  getUserAuditLogs,
  createStaffUser,
  getUsers,
  adminUpdateUser,
  deactivateUser,
  activateUser,
} = require('../services/userService');

const maskEmail = (value) => {
  if (!value) return '';
  const [local, domain] = String(value).split('@');
  if (!domain) return value;
  const prefix = local.slice(0, 2) || local.slice(0, 1);
  return `${prefix}***@${domain}`;
};

const maskNoKk = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 6) return `${digits.slice(0, 2)}***`;
  return `${digits.slice(0, 4)}**********${digits.slice(-2)}`;
};

const maskSensitiveProfile = (user) => {
  if (!user) return user;
  const masked = { ...user };
  if (masked.email) masked.email = maskEmail(masked.email);
  if (masked.nik) masked.nik = maskNoKk(masked.nik);
  if (masked.nikNumber) masked.nikNumber = maskNoKk(masked.nikNumber);
  if (masked.familyCardNumber) masked.familyCardNumber = maskNoKk(masked.familyCardNumber);
  return masked;
};

/**
 * Get user profile
 */
const getProfile = async(req, res) => {
  try {
    const userProfile = await getUserProfile(req.user.id);
    const maskedProfile = maskSensitiveProfile(userProfile);

    res.json({
      success: true,
      data: { user: maskedProfile },
    });
  } catch (error) {
    console.error('Get profile error:', error);

    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'USER_NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Update user profile
 */
const updateProfile = async(req, res) => {
  try {
    const {
      fullName,
      phone,
      familyCardNumber,
      nik,
    } = req.body;

    const identityNumber = familyCardNumber || nik || null;

    const result = await updateUserProfile(
      req.user.id,
      { fullName, phone, familyCardNumber: identityNumber },
    );
    const maskedProfile = maskSensitiveProfile(result);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: maskedProfile },
    });
  } catch (error) {
    console.error('Update profile error:', error);

    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    if (error.message === 'Full name is required') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'MISSING_FULL_NAME',
      });
    }

    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'USER_NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Update profile avatar
 */
const updateProfileAvatar = async(req, res) => {
  try {
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        message: req.fileValidationError,
        code: 'VALIDATION_ERROR',
      });
    }

    const updatedProfile = await updateUserAvatar(req.user.id, req.file);
    const maskedProfile = maskSensitiveProfile(updatedProfile);

    res.json({
      success: true,
      message: 'Foto profil berhasil diperbarui',
      data: { user: maskedProfile },
    });
  } catch (error) {
    console.error('Update avatar error:', error);

    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Update notification preferences
 */
const updateNotificationSettings = async(req, res) => {
  try {
    const { notificationEmailEnabled, notificationWhatsappEnabled } = req.body;
    const updatedProfile = await updateNotificationPreferences(req.user.id, {
      notificationEmailEnabled,
      notificationWhatsappEnabled,
    });
    const maskedProfile = maskSensitiveProfile(updatedProfile);

    res.json({
      success: true,
      message: 'Preferensi notifikasi diperbarui',
      data: { user: maskedProfile },
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);

    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};
/**
 * Change password
 */
const changePassword = async(req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await changeUserPassword(
      req.user.id,
      currentPassword,
      newPassword,
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Change password error:', error);

    if (error.message === 'Current password and new password are required') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'MISSING_PASSWORDS',
      });
    }

    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'USER_NOT_FOUND',
      });
    }

    if (error.message === 'Current password is incorrect') {
      return res.status(401).json({
        success: false,
        message: error.message,
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Update two-factor authentication setting
 */
const updateTwoFactor = async(req, res) => {
  try {
    const { enabled } = req.body;

    const userProfile = await updateTwoFactorSetting(req.user.id, enabled);

    res.json({
      success: true,
      message: 'Two-factor setting updated',
      data: { user: userProfile },
    });
  } catch (error) {
    console.error('Update two-factor error:', error);

    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    if (error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'USER_NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Revoke all sessions
 */
const revokeAllSessions = async(req, res) => {
  try {
    const result = await revokeAllUserSessions(req.user.id);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Get user sessions
 */
const getSessions = async(req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const { page = 1, limit = 10 } = req.query;
    const sessions = await getUserSessions(req.user.id, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      currentSessionToken: req.user.sessionToken || req.sessionToken || null,
    });

    res.json({
      success: true,
      data: { sessions },
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Revoke session
 */
const revokeSession = async(req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await revokeUserSession(
      req.user.id,
      sessionId,
      req.ip,
      req.headers['user-agent'],
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Revoke session error:', error);

    if (error.message === 'Session not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'SESSION_NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Get user roles
 */
const getUserRolesController = async(req, res) => {
  try {
    const roles = await getUserRoles(req.user.id);

    res.json({
      success: true,
      data: { roles },
    });
  } catch (error) {
    console.error('Get user roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Get user audit logs
 */
const getAuditLogs = async(req, res) => {
  try {
    const { page = 1, limit = 50, action } = req.query;

    const result = await getUserAuditLogs(req.user.id, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      action,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Get users for admin management
 */
const getUsersAdmin = async(req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      userLevel,
      isActive,
      assignedProvinceId,
      assignedRegencyId,
      assignedDistrictId,
      assignedVillageId,
    } = req.query;

    const parsedIsActive = isActive === undefined
      ? undefined
      : (isActive === 'true' || isActive === true);

    const result = await getUsers({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      userLevel,
      isActive: parsedIsActive,
      assignedProvinceId,
      assignedRegencyId,
      assignedDistrictId,
      assignedVillageId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Get users admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Create staff user (admin desa/kabupaten/verifikator)
 */
const adminCreateUser = async(req, res) => {
  try {
    if (!req.user?.roleNames?.includes('super_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Hanya Super Admin yang dapat membuat akun pejabat.',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }

    const createdUser = await createStaffUser(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: 'User berhasil dibuat',
      data: { user: createdUser },
    });
  } catch (error) {
    console.error('Admin create user error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || 'VALIDATION_ERROR',
      });
    }

    if (error.name === 'ConflictError') {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: error.code || 'CONFLICT',
      });
    }

    if (error.name === 'NotFoundError') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: error.code || 'NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Update staff user (admin desa/kabupaten/verifikator)
 */
const adminUpdateUserController = async(req, res) => {
  try {
    if (!req.user?.roleNames?.includes('super_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Hanya Super Admin yang dapat mengubah akun pejabat.',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }

    const updatedUser = await adminUpdateUser(req.params.id, req.body, req.user.id);

    res.json({
      success: true,
      message: 'User berhasil diperbarui',
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error('Admin update user error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || 'VALIDATION_ERROR',
      });
    }

    if (error.name === 'ConflictError') {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: error.code || 'CONFLICT',
      });
    }

    if (error.name === 'NotFoundError') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: error.code || 'NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Deactivate staff user
 */
const adminDeactivateUser = async(req, res) => {
  try {
    if (!req.user?.roleNames?.includes('super_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Hanya Super Admin yang dapat menonaktifkan akun.',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }

    await deactivateUser(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'User berhasil dinonaktifkan',
    });
  } catch (error) {
    console.error('Admin deactivate user error:', error);

    if (error.name === 'NotFoundError') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: error.code || 'NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

/**
 * Activate staff user
 */
const adminActivateUser = async(req, res) => {
  try {
    if (!req.user?.roleNames?.includes('super_admin')) {
      return res.status(403).json({
        success: false,
        message: 'Hanya Super Admin yang dapat mengaktifkan akun.',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }

    await activateUser(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'User berhasil diaktifkan',
    });
  } catch (error) {
    console.error('Admin activate user error:', error);

    if (error.name === 'NotFoundError') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: error.code || 'NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateProfileAvatar,
  updateNotificationSettings,
  changePassword,
  updateTwoFactor,
  revokeAllSessions,
  getSessions,
  revokeSession,
  getUserRoles: getUserRolesController,
  getAuditLogs,
  getUsersAdmin,
  adminCreateUser,
  adminUpdateUser: adminUpdateUserController,
  adminDeactivateUser,
  adminActivateUser,
};
