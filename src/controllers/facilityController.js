const {
  getFacilitySurveys,
  getFacilitySurveyById,
  createFacilitySurvey,
  updateFacilitySurvey,
  submitFacilitySurvey,
  verifyFacilitySurvey,
  getFacilityStatistics,
} = require('../services/facilityService');
const { facilitiesToGeoJSON } = require('../services/geojsonService');
const { asyncErrorHandler } = require('../errors/errorMiddleware');
const { isAdminDesa } = require('../utils/accessControl');

/**
 * Get all facility surveys with pagination and filtering
 */
const getFacilitySurveysController = async(req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      surveyYear,
      surveyPeriod,
      villageId,
      districtId,
      regencyId,
      provinceId,
      format,
    } = req.query;

    // Get user's location scope
    const userLocationScope = req.user;

    // Get facility surveys using service
    const result = await getFacilitySurveys(userLocationScope, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      surveyYear: surveyYear ? parseInt(surveyYear, 10) : undefined,
      surveyPeriod,
      villageId,
      districtId,
      regencyId,
      provinceId,
    });

    const surveys = result.surveys || [];
    const geojson = await facilitiesToGeoJSON(surveys);
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
    console.error('Get facility surveys error:', error);

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
 * Get single facility survey with complete data
 */
const getFacilitySurvey = async(req, res) => {
  try {
    const { surveyId } = req.params;

    // Get user's location scope
    const userLocationScope = req.user;

    const survey = await getFacilitySurveyById(surveyId, userLocationScope);

    res.json({
      success: true,
      data: { survey },
    });
  } catch (error) {
    console.error('Get facility survey error:', error);

    if (error.message === 'Facility survey not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'FACILITY_SURVEY_NOT_FOUND',
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
 * Create facility survey
 */
const createFacilitySurveyController = asyncErrorHandler(async(req, res) => {
  const surveyData = req.body;
  const userId = req.user.id;

  if (isAdminDesa(req.user)) {
    const householdCount = Number(surveyData?.villageInfo?.householdCount);
    if (!Number.isFinite(householdCount) || householdCount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Jumlah KK desa wajib diisi untuk sinkronisasi data statistik.',
        code: 'HOUSEHOLD_COUNT_REQUIRED',
      });
    }
  }

  const survey = await createFacilitySurvey(surveyData, userId);

  res.status(201).json({
    success: true,
    message: 'Facility survey created successfully',
    data: { survey },
  });
});

/**
 * Update facility survey
 */
const updateFacilitySurveyController = asyncErrorHandler(async(req, res) => {
  const { surveyId } = req.params;
  const surveyData = req.body;

  if (isAdminDesa(req.user)) {
    const householdCount = Number(surveyData?.villageInfo?.householdCount);
    if (!Number.isFinite(householdCount) || householdCount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Jumlah KK desa wajib diisi untuk sinkronisasi data statistik.',
        code: 'HOUSEHOLD_COUNT_REQUIRED',
      });
    }
  }

  const survey = await updateFacilitySurvey(surveyId, surveyData, req.user);

  res.json({
    success: true,
    message: 'Facility survey updated successfully',
    data: { survey },
  });
});

/**
 * Submit facility survey
 */
const submitFacilitySurveyController = asyncErrorHandler(async(req, res) => {
  const { surveyId } = req.params;
  const userId = req.user.id;

  const survey = await submitFacilitySurvey(surveyId, userId);

  res.json({
    success: true,
    message: 'Facility survey submitted successfully',
    data: { survey },
  });
});

/**
 * Verify facility survey
 */
const verifyFacilitySurveyController = asyncErrorHandler(async(req, res) => {
  const { surveyId } = req.params;
  const verifierId = req.user.id;

  const reviewData = req.body || {};
  const survey = await verifyFacilitySurvey(surveyId, verifierId, reviewData, req.user);

  res.json({
    success: true,
    message: 'Facility survey review updated successfully',
    data: { survey },
  });
});

/**
 * Get facility survey statistics
 */
const getFacilityStatisticsController = async(req, res) => {
  try {
    const {
      villageId, districtId, regencyId, provinceId, surveyYear, surveyPeriod,
    } = req.query;

    const userLocationScope = req.user;
    const statistics = await getFacilityStatistics(userLocationScope, {
      villageId, districtId, regencyId, provinceId, surveyYear, surveyPeriod,
    });

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('Get facility statistics error:', error);

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

module.exports = {
  getFacilitySurveys: getFacilitySurveysController,
  getFacilitySurvey,
  createFacilitySurvey: createFacilitySurveyController,
  updateFacilitySurvey: updateFacilitySurveyController,
  submitFacilitySurvey: submitFacilitySurveyController,
  verifyFacilitySurvey: verifyFacilitySurveyController,
  getFacilityStatistics: getFacilityStatisticsController,
};
