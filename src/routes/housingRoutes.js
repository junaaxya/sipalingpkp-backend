const express = require('express');
const multer = require('multer');
const {
  authenticateToken,
  requirePermission,
  requireRole,
  // requireLocationAccess,
  requireResourceAccess,
  requireAnyPermission,
} = require('../middleware/auth');
const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } = require('../utils/fileUpload');
const { validateRequest } = require('../middleware/validation');
const {
  getFormSubmissions,
  getFormSubmission,
  getSubmissionHistoryByOwner,
  submitForm,
  updateFormSubmission,
  updateOwnSubmission,
  reviewFormSubmission,
  getHousingStatistics,
} = require('../controllers/housingController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 36,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`File type ${file.mimetype} is not allowed.`));
    }
    return cb(null, true);
  },
});

const housingUploadFields = [
  { name: 'houseDataPhotos', maxCount: 6 },
  { name: 'houseStructurePhotos', maxCount: 6 },
  { name: 'waterAccessPhotos', maxCount: 6 },
  { name: 'sanitationAccessPhotos', maxCount: 6 },
  { name: 'wasteManagementPhotos', maxCount: 6 },
  { name: 'roadAccessPhotos', maxCount: 6 },
  { name: 'energyAccessPhotos', maxCount: 6 },
];

/**
 * @route   POST /api/housing/submit
 * @desc    Submit housing form (with enhanced permission checking)
 * @access  Private
 */
router.post(
  '/submit',
  authenticateToken, // Uses database functions for user data
  requirePermission('housing:create'), // Uses database functions for permission check
  upload.fields(housingUploadFields),
  submitForm,
);

/**
 * @route   GET /api/housing/submissions
 * @desc    Get form submissions (with enhanced location access control)
 * @access  Private
 */
router.get(
  '/submissions',
  authenticateToken, // Uses database functions for user data
  requirePermission('housing:read'), // Uses database functions for permission check
  // requireLocationAccess('village'), // Uses database functions for location access
  getFormSubmissions,
);

/**
 * @route   GET /api/housing/submissions/:id
 * @desc    Get specific form submission (with resource access control)
 * @access  Private
 */
router.get(
  '/submissions/:id',
  authenticateToken, // Uses database functions for user data
  requirePermission('housing:read'), // Uses database functions for permission check
  requireResourceAccess('housing', 'read'), // Uses database functions for resource access
  getFormSubmission,
);

/**
 * @route   GET /api/housing/owners/:ownerId/history
 * @desc    Get submission history for a household owner
 * @access  Private
 */
router.get(
  '/owners/:ownerId/history',
  authenticateToken,
  requirePermission('housing:read'),
  getSubmissionHistoryByOwner,
);

/**
 * @route   PUT /api/housing/submissions/:id/edit
 * @desc    Update form submission (verifier edit before approval)
 * @access  Private
 */
router.put(
  '/submissions/:id/edit',
  authenticateToken, // Uses database functions for user data
  requirePermission('housing:update'),
  requireResourceAccess('housing', 'update'),
  validateRequest('housing', 'updateFormSubmission'),
  updateFormSubmission,
);

/**
 * @route   PUT /api/housing/submissions/:id/self
 * @desc    Update form submission by owner (draft/rejected only)
 * @access  Private
 */
router.put(
  '/submissions/:id/self',
  authenticateToken,
  requirePermission('housing:create'),
  validateRequest('housing', 'updateFormSubmission'),
  updateOwnSubmission,
);

/**
 * @route   PUT /api/housing/submissions/:id/review
 * @desc    Review form submission (with multiple permission options)
 * @access  Private
 */
router.put(
  '/submissions/:id/review',
  authenticateToken, // Uses database functions for user data
  requireAnyPermission(['housing:review', 'housing:approve']), // Uses database functions for multiple permissions
  requireResourceAccess('housing', 'update'), // Uses database functions for resource access
  validateRequest('housing', 'reviewFormSubmission'),
  reviewFormSubmission,
);

/**
 * @route   GET /api/housing/admin/submissions
 * @desc    Admin-only route for all submissions (with role-based access)
 * @access  Private
 */
router.get(
  '/admin/submissions',
  authenticateToken, // Uses database functions for user data
  requireRole('administrator'), // Uses database functions for role check
  getFormSubmissions,
);

/**
 * @route   GET /api/housing/statistics
 * @desc    Get housing statistics
 * @access  Private
 */
router.get(
  '/statistics',
  authenticateToken,
  requirePermission('housing:read'),
  getHousingStatistics,
);

module.exports = router;
