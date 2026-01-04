const {
  submitHousingForm,
  getFormSubmissions,
  getFormSubmissionById,
  getSubmissionHistoryByOwner,
  updateFormSubmission,
  updateOwnSubmission,
  reviewFormSubmission,
  getHousingStatistics,
  getGeographicData,
} = require('../services/housingService');
const { housingToGeoJSON } = require('../services/geojsonService');
const { asyncErrorHandler } = require('../errors/errorMiddleware');
const { isMasyarakat } = require('../utils/accessControl');

const parsePayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  try {
    return JSON.parse(payload);
  } catch (error) {
    return {};
  }
};

const attachPhotos = (formData, targetKey, files, caption) => {
  if (!files || !files.length) return;
  const target = formData[targetKey] || {};
  const existing = Array.isArray(target.photos) ? target.photos : [];
  const offset = existing.length;
  const mapped = files.map((file, index) => ({
    ...file,
    caption,
    displayOrder: offset + index,
  }));
  target.photos = [...existing, ...mapped];
  formData[targetKey] = target;
};

/**
 * Submit housing form
 */
const submitForm = asyncErrorHandler(async(req, res) => {
  const formData = parsePayload(req.body?.payload || req.body);
  const respondentId = req.user.id; // Assuming the authenticated user is the respondent
  const files = req.files || {};

  attachPhotos(formData, 'houseData', files.houseDataPhotos, 'Rumah');
  attachPhotos(formData, 'houseData', files.houseStructurePhotos, 'Bangunan');
  attachPhotos(formData, 'waterAccess', files.waterAccessPhotos, 'Air Bersih');
  attachPhotos(formData, 'sanitationAccess', files.sanitationAccessPhotos, 'Sanitasi');
  attachPhotos(formData, 'wasteManagement', files.wasteManagementPhotos, 'Persampahan');
  attachPhotos(formData, 'roadAccess', files.roadAccessPhotos, 'Akses Jalan');
  attachPhotos(formData, 'energyAccess', files.energyAccessPhotos, 'Akses Energi');

  // Submit form using service
  const submission = await submitHousingForm(
    formData,
    respondentId,
  );

  res.status(201).json({
    success: true,
    message: 'Form submitted successfully',
    data: {
      submissionId: submission.id,
      status: submission.status,
      submittedAt: submission.submittedAt,
    },
  });
});

/**
 * Get all form submissions with pagination and filtering
 */
const getFormSubmissionsController = async(req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      isLivable,
      villageId,
      districtId,
      regencyId,
      provinceId,
      surveyYear,
      format,
    } = req.query;

    // Get user's location scope
    const userLocationScope = req.user;

    // Get form submissions using service
    const result = await getFormSubmissions(userLocationScope, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      isLivable: isLivable !== undefined ? (isLivable === 'true' || isLivable === true) : undefined,
      villageId,
      districtId,
      regencyId,
      provinceId,
      surveyYear,
    });

    const submissions = result.submissions?.rows || result.submissions || [];
    const geojson = housingToGeoJSON(submissions);
    if (format === 'geojson') {
      return res.json({
        success: true,
        data: geojson,
      });
    }

    res.json({
      success: true,
      data: {
        ...result,
        geojson,
      },
    });
  } catch (error) {
    console.error('Get form submissions error:', error);

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
 * Get single form submission with complete data
 */
const getFormSubmission = async(req, res) => {
  try {
    const { id } = req.params;

    const userLocationScope = req.user;
    const submission = await getFormSubmissionById(id, userLocationScope);

    res.json({
      success: true,
      data: { submission },
    });
  } catch (error) {
    console.error('Get form submission error:', error);

    if (error.message === 'Form submission not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'SUBMISSION_NOT_FOUND',
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
 * Get submission history by household owner
 */
const getSubmissionHistoryByOwnerController = async(req, res) => {
  try {
    const { ownerId } = req.params;
    const userLocationScope = req.user;
    const history = await getSubmissionHistoryByOwner(ownerId, userLocationScope);

    res.json({
      success: true,
      data: { history },
    });
  } catch (error) {
    console.error('Get submission history error:', error);

    if (error.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
      code: error.code || 'INTERNAL_ERROR',
    });
  }
};

/**
 * Update form submission (verifier edits)
 */
const updateFormSubmissionController = async(req, res) => {
  try {
    const { id } = req.params;
    const updaterId = req.user.id;

    const submission = await updateFormSubmission(id, req.body, updaterId);

    res.json({
      success: true,
      message: 'Form submission updated successfully',
      data: submission,
    });
  } catch (error) {
    console.error('Update form submission error:', error);

    if (error.message === 'Form submission not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'SUBMISSION_NOT_FOUND',
      });
    }

    if (error.message.includes('Koordinat tidak sesuai')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'INVALID_COORDINATES',
      });
    }

    if (error.message.includes('only be edited')) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: 'SUBMISSION_LOCKED',
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
 * Update form submission (masyarakat resubmission)
 */
const updateOwnSubmissionController = async(req, res) => {
  try {
    if (!isMasyarakat(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak.',
        code: 'FORBIDDEN',
      });
    }

    const { id } = req.params;
    const updaterId = req.user.id;

    const submission = await updateOwnSubmission(id, req.body, updaterId);

    res.json({
      success: true,
      message: 'Form submission updated successfully',
      data: submission,
    });
  } catch (error) {
    console.error('Update own submission error:', error);

    if (error.message === 'Form submission not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'SUBMISSION_NOT_FOUND',
      });
    }

    if (error.message.includes('draft or rejected')) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: 'SUBMISSION_LOCKED',
      });
    }

    if (error.message.includes('Koordinat tidak sesuai')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'INVALID_COORDINATES',
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
 * Review form submission
 */
const reviewFormSubmissionController = async(req, res) => {
  try {
    const submissionId = req.params.id || req.params.submissionId;
    const { status, reviewNotes } = req.body;
    const reviewerId = req.user.id;

    const submission = await reviewFormSubmission(
      submissionId,
      { status, reviewNotes },
      reviewerId,
      req.user,
    );

    res.json({
      success: true,
      message: 'Form submission reviewed successfully',
      data: submission,
    });
  } catch (error) {
    console.error('Review form submission error:', error);

    if (error.message.includes('Invalid status')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'INVALID_STATUS',
      });
    }

    if (error.message.includes('must be reviewed') || error.message.includes('finalized')) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: 'SUBMISSION_LOCKED',
      });
    }

    if (error.code === 'CONFLICT' || error.message.includes('sedang ditinjau')) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: 'SUBMISSION_LOCKED',
      });
    }

    if (error.statusCode === 404 || error.code === 'NOT_FOUND' || error.message.includes('Form submission not found')) {
      return res.status(404).json({
        success: false,
        message: 'Form submission not found',
        code: 'SUBMISSION_NOT_FOUND',
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
 * Get housing statistics
 */
const getHousingStatisticsController = async(req, res) => {
  try {
    const {
      villageId, districtId, regencyId, provinceId, surveyYear,
    } = req.query;

    // Get user's location scope
    const userLocationScope = req.user;

    // Get statistics using service
    const statistics = await getHousingStatistics(userLocationScope, {
      villageId, districtId, regencyId, provinceId, surveyYear,
    });

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('Get housing statistics error:', error);

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
 * Get geographic data for dropdowns
 */
const getGeographicDataController = async(req, res) => {
  try {
    const { level, parentId } = req.query;

    const data = await getGeographicData(level, parentId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get geographic data error:', error);

    if (error.message.includes('Parent ID is required')
        || error.message.includes('Invalid level')) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: 'INVALID_REQUEST',
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
  submitForm,
  getFormSubmissions: getFormSubmissionsController,
  getFormSubmission,
  getSubmissionHistoryByOwner: getSubmissionHistoryByOwnerController,
  updateFormSubmission: updateFormSubmissionController,
  updateOwnSubmission: updateOwnSubmissionController,
  reviewFormSubmission: reviewFormSubmissionController,
  getHousingStatistics: getHousingStatisticsController,
  getGeographicData: getGeographicDataController,
};
