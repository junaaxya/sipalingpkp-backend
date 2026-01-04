const express = require('express');
const {
  authenticateToken,
  requirePermission,
  requireAnyPermission,
} = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const {
  getFacilitySurveys,
  getFacilitySurvey,
  createFacilitySurvey,
  updateFacilitySurvey,
  submitFacilitySurvey,
  verifyFacilitySurvey,
  getFacilityStatistics,
} = require('../controllers/facilityController');

const router = express.Router();

/**
 * Facility Survey Routes
 */

/**
 * @route   GET /api/facility/surveys
 * @desc    Get facility surveys with filtering and pagination
 * @access  Private
 */
router.get(
  '/surveys',
  authenticateToken,
  requirePermission('facility:read'),
  getFacilitySurveys,
);

/**
 * @route   GET /api/facility/surveys/:surveyId
 * @desc    Get single facility survey with complete data
 * @access  Private
 */
router.get(
  '/surveys/:surveyId',
  authenticateToken,
  requirePermission('facility:read'),
  getFacilitySurvey,
);

/**
 * @route   POST /api/facility/surveys
 * @desc    Create facility survey
 * @access  Private
 */
router.post(
  '/surveys',
  authenticateToken,
  requirePermission('facility:create'),
  createFacilitySurvey,
);

/**
 * @route   PUT /api/facility/surveys/:surveyId
 * @desc    Update facility survey (only draft status)
 * @access  Private
 */
router.put(
  '/surveys/:surveyId',
  authenticateToken,
  requireAnyPermission(['facility:update', 'facility:verify', 'facility:approve']),
  updateFacilitySurvey,
);

/**
 * @route   POST /api/facility/surveys/:surveyId/submit
 * @desc    Submit facility survey (change status to submitted)
 * @access  Private
 */
router.post(
  '/surveys/:surveyId/submit',
  authenticateToken,
  requirePermission('facility:submit'),
  submitFacilitySurvey,
);

/**
 * @route   POST /api/facility/surveys/:surveyId/verify
 * @desc    Verify facility survey (change status to verified)
 * @access  Private
 */
router.post(
  '/surveys/:surveyId/verify',
  authenticateToken,
  requireAnyPermission(['facility:verify', 'facility:approve']),
  validateRequest('facility', 'reviewFacilitySurvey'),
  verifyFacilitySurvey,
);

/**
 * @route   POST /api/facility/surveys/:surveyId/review
 * @desc    Review facility survey (alias of verify)
 * @access  Private
 */
router.post(
  '/surveys/:surveyId/review',
  authenticateToken,
  requireAnyPermission(['facility:verify', 'facility:approve']),
  validateRequest('facility', 'reviewFacilitySurvey'),
  verifyFacilitySurvey,
);

/**
 * @route   GET /api/facility/statistics
 * @desc    Get facility statistics
 * @access  Private
 */
router.get(
  '/statistics',
  authenticateToken,
  requireAnyPermission(['facility:read', 'facility:create']),
  getFacilityStatistics,
);

module.exports = router;
