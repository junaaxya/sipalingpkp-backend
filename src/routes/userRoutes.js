const express = require('express');
const {
  getProfile,
  updateProfile,
  updateProfileAvatar,
  changePassword,
  updateTwoFactor,
  updateNotificationSettings,
  revokeAllSessions,
  getSessions,
  revokeSession,
  getUserRoles,
  getAuditLogs,
  getUsersAdmin,
  adminCreateUser,
  adminUpdateUser,
  adminDeactivateUser,
  adminActivateUser,
} = require('../controllers/userController');
const multer = require('multer');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateRequest, validatePagination } = require('../middleware/validation');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../utils/fileUpload');

const router = express.Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    req.fileValidationError = 'Format file tidak didukung';
    cb(null, false);
  },
});

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/user/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', getProfile);

/**
 * @route   PUT /api/user/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  validateRequest('user', 'updateProfile'),
  updateProfile,
);

/**
 * @route   PUT /api/user/profile/avatar
 * @desc    Update user profile avatar
 * @access  Private
 */
router.put('/profile/avatar', avatarUpload.single('avatar'), updateProfileAvatar);

/**
 * @route   POST /api/user/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  validateRequest('user', 'changePassword'),
  changePassword,
);

router.put(
  '/change-password',
  validateRequest('user', 'changePassword'),
  changePassword,
);

router.put(
  '/two-factor',
  validateRequest('user', 'updateTwoFactor'),
  updateTwoFactor,
);

router.put(
  '/notification-preferences',
  validateRequest('user', 'updateNotificationPreferences'),
  updateNotificationSettings,
);

/**
 * @route   GET /api/user/sessions
 * @desc    Get user active sessions
 * @access  Private
 */
router.get('/sessions', getSessions);

/**
 * @route   DELETE /api/user/sessions/:sessionId
 * @desc    Revoke a specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId', revokeSession);

router.post('/sessions/revoke-all', revokeAllSessions);

/**
 * @route   GET /api/user/roles
 * @desc    Get user roles
 * @access  Private
 */
router.get('/roles', getUserRoles);

/**
 * @route   GET /api/user/audit-logs
 * @desc    Get user audit logs
 * @access  Private
 */
router.get(
  '/audit-logs',
  validateRequest('user', 'getAuditLogs'),
  validatePagination,
  getAuditLogs,
);

/**
 * @route   POST /api/user/admin/users
 * @desc    Create staff user (admin desa/kabupaten/verifikator)
 * @access  Private (manage_users permission)
 */
router.post(
  '/admin/users',
  requirePermission('manage_users'),
  validateRequest('user', 'adminCreateUser'),
  adminCreateUser,
);

/**
 * @route   PUT /api/user/admin/users/:id
 * @desc    Update staff user
 * @access  Private (manage_users permission)
 */
router.put(
  '/admin/users/:id',
  requirePermission('manage_users'),
  validateRequest('user', 'adminUpdateUser'),
  adminUpdateUser,
);

/**
 * @route   DELETE /api/user/admin/users/:id
 * @desc    Deactivate staff user
 * @access  Private (manage_users permission)
 */
router.delete(
  '/admin/users/:id',
  requirePermission('manage_users'),
  adminDeactivateUser,
);

/**
 * @route   PUT /api/user/:id/activate
 * @desc    Activate user account
 * @access  Private (manage_users permission)
 */
router.put(
  '/:id/activate',
  requirePermission('manage_users'),
  adminActivateUser,
);

/**
 * @route   GET /api/user/admin/users
 * @desc    List users for management
 * @access  Private (manage_users permission)
 */
router.get(
  '/admin/users',
  requirePermission('manage_users'),
  validateRequest('user', 'adminListUsers'),
  validatePagination,
  getUsersAdmin,
);

module.exports = router;
