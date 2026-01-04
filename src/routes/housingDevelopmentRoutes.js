const express = require('express');
const {
  authenticateToken,
  requirePermission,
  requireAnyPermission,
} = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  getHousingDevelopments,
  getHousingDevelopment,
  createHousingDevelopment,
  updateHousingDevelopment,
  submitHousingDevelopment,
  verifyHousingDevelopment,
  deleteHousingDevelopment,
  getHousingDevelopmentStatistics,
} = require('../controllers/housingDevelopmentController');

const router = express.Router();

/**
 * @route   GET /api/housing-developments
 * @desc    Get housing developments with filtering and pagination
 * @access  Private
 */
router.get(
  '/',
  authenticateToken,
  requirePermission('housing_development:read'),
  getHousingDevelopments,
);

/**
 * @route   GET /api/housing-developments/statistics
 * @desc    Get housing development statistics
 * @access  Private
 */
router.get(
  '/statistics',
  authenticateToken,
  requirePermission('housing_development:read'),
  getHousingDevelopmentStatistics,
);

/**
 * @route   GET /api/housing-developments/:developmentId
 * @desc    Get single housing development
 * @access  Private
 */
router.get(
  '/:developmentId',
  authenticateToken,
  requirePermission('housing_development:read'),
  getHousingDevelopment,
);

/**
 * @route   POST /api/housing-developments
 * @desc    Create housing development
 * @access  Private
 */
router.post(
  '/',
  authenticateToken,
  requirePermission('housing_development:create'),
  createHousingDevelopment,
);

/**
 * @route   PUT /api/housing-developments/:developmentId
 * @desc    Update housing development (only draft status)
 * @access  Private
 */
router.put(
  '/:developmentId',
  authenticateToken,
  requireAnyPermission(['housing_development:update', 'housing_development:verify', 'housing_development:approve']),
  updateHousingDevelopment,
);

/**
 * @route   POST /api/housing-developments/:developmentId/submit
 * @desc    Submit housing development (change status to submitted)
 * @access  Private
 */
router.post(
  '/:developmentId/submit',
  authenticateToken,
  requirePermission('housing_development:submit'),
  submitHousingDevelopment,
);

/**
 * @route   POST /api/housing-developments/:developmentId/verify
 * @desc    Verify housing development (change status to verified)
 * @access  Private
 */
router.post(
  '/:developmentId/verify',
  authenticateToken,
  requireAnyPermission(['housing_development:verify', 'housing_development:approve']),
  validateRequest('housingDevelopment', 'reviewHousingDevelopment'),
  verifyHousingDevelopment,
);

/**
 * @route   POST /api/housing-developments/:developmentId/review
 * @desc    Review housing development (alias of verify)
 * @access  Private
 */
router.post(
  '/:developmentId/review',
  authenticateToken,
  requireAnyPermission(['housing_development:verify', 'housing_development:approve']),
  validateRequest('housingDevelopment', 'reviewHousingDevelopment'),
  verifyHousingDevelopment,
);

/**
 * @route   DELETE /api/housing-developments/:developmentId
 * @desc    Delete housing development (only draft status)
 * @access  Private
 */
router.delete(
  '/:developmentId',
  authenticateToken,
  requirePermission('housing_development:delete'),
  deleteHousingDevelopment,
);

module.exports = router;
