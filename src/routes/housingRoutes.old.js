const express = require('express');
const {
  submitForm,
  getFormSubmissions,
  getFormSubmission,
  reviewFormSubmission,
  getHousingStatistics,
  getGeographicData,
} = require('../controllers/housingController');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validateRequest, validatePagination, validateGeographicQuery } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/housing/submit
 * @desc    Submit housing form
 * @access  Private
 */
router.post(
  '/submit',
  validateRequest('housing', 'createFormSubmission'),
  submitForm,
);

/**
 * @route   GET /api/housing/submissions
 * @desc    Get form submissions with pagination and filtering
 * @access  Private
 */
router.get(
  '/submissions',
  validateRequest('housing', 'getFormSubmissions'),
  validatePagination,
  getFormSubmissions,
);

/**
 * @route   GET /api/housing/submissions/:submissionId
 * @desc    Get single form submission with complete data
 * @access  Private
 */
router.get('/submissions/:submissionId', getFormSubmission);

/**
 * @route   PUT /api/housing/submissions/:submissionId/review
 * @desc    Review form submission (approve/reject)
 * @access  Private (requires housing:review permission)
 */
router.put(
  '/submissions/:submissionId/review',
  requirePermission('housing:review'),
  validateRequest('housing', 'reviewFormSubmission'),
  reviewFormSubmission,
);

/**
 * @route   GET /api/housing/statistics
 * @desc    Get housing statistics and analytics
 * @access  Private
 */
router.get(
  '/statistics',
  validateRequest('housing', 'getStatistics'),
  getHousingStatistics,
);

/**
 * @route   GET /api/housing/geographic-data
 * @desc    Get geographic data for dropdowns (provinces, regencies, districts, villages)
 * @access  Private
 */
router.get(
  '/geographic-data',
  validateRequest('housing', 'getGeographicData'),
  validateGeographicQuery,
  getGeographicData,
);

module.exports = router;
