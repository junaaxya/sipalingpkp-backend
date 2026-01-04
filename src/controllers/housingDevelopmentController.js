const {
  getHousingDevelopments,
  getHousingDevelopmentById,
  createHousingDevelopment,
  updateHousingDevelopment,
  submitHousingDevelopment,
  verifyHousingDevelopment,
  deleteHousingDevelopment,
  getHousingDevelopmentStatistics,
} = require('../services/housingDevelopmentService');
const { housingDevelopmentsToGeoJSON } = require('../services/geojsonService');
const { asyncErrorHandler } = require('../errors/errorMiddleware');

/**
 * Get all housing developments with pagination and filtering
 */
const getHousingDevelopmentsController = async(req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      housingType,
      villageId,
      districtId,
      regencyId,
      provinceId,
      surveyYear,
      format,
    } = req.query;

    // Get user's location scope
    const userLocationScope = req.user;

    // Get housing developments using service
    const result = await getHousingDevelopments(userLocationScope, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
      housingType,
      villageId,
      districtId,
      regencyId,
      provinceId,
      surveyYear,
    });

    const developments = result.developments || [];
    const geojson = housingDevelopmentsToGeoJSON(developments);
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
    console.error('Get housing developments error:', error);

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
 * Get single housing development
 */
const getHousingDevelopment = async(req, res) => {
  try {
    const { developmentId } = req.params;

    const userLocationScope = req.user;
    const development = await getHousingDevelopmentById(developmentId, userLocationScope);

    res.json({
      success: true,
      data: { development },
    });
  } catch (error) {
    console.error('Get housing development error:', error);

    if (error.message === 'Housing development not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
        code: 'HOUSING_DEVELOPMENT_NOT_FOUND',
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
 * Create housing development
 */
const createHousingDevelopmentController = asyncErrorHandler(async(req, res) => {
  const developmentData = req.body;
  const userId = req.user.id;

  const development = await createHousingDevelopment(developmentData, userId);

  res.status(201).json({
    success: true,
    message: 'Housing development created successfully',
    data: { development },
  });
});

/**
 * Update housing development
 */
const updateHousingDevelopmentController = asyncErrorHandler(async(req, res) => {
  const { developmentId } = req.params;
  const developmentData = req.body;
  const development = await updateHousingDevelopment(developmentId, developmentData, req.user);

  res.json({
    success: true,
    message: 'Housing development updated successfully',
    data: { development },
  });
});

/**
 * Submit housing development
 */
const submitHousingDevelopmentController = asyncErrorHandler(async(req, res) => {
  const { developmentId } = req.params;
  const userId = req.user.id;

  const development = await submitHousingDevelopment(developmentId, userId);

  res.json({
    success: true,
    message: 'Housing development submitted successfully',
    data: { development },
  });
});

/**
 * Verify housing development
 */
const verifyHousingDevelopmentController = asyncErrorHandler(async(req, res) => {
  const { developmentId } = req.params;
  const verifierId = req.user.id;

  const reviewData = req.body || {};
  const development = await verifyHousingDevelopment(developmentId, verifierId, reviewData, req.user);

  res.json({
    success: true,
    message: 'Housing development review updated successfully',
    data: { development },
  });
});

/**
 * Get housing development statistics
 */
const getHousingDevelopmentStatisticsController = async(req, res) => {
  try {
    const {
      villageId, districtId, regencyId, provinceId, surveyYear,
    } = req.query;

    const userLocationScope = req.user;
    const statistics = await getHousingDevelopmentStatistics(userLocationScope, {
      villageId, districtId, regencyId, provinceId, surveyYear,
    });

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('Get housing development statistics error:', error);

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
 * Delete housing development
 */
const deleteHousingDevelopmentController = asyncErrorHandler(async(req, res) => {
  const { developmentId } = req.params;
  const userId = req.user.id;

  const result = await deleteHousingDevelopment(developmentId, userId);

  res.json({
    success: true,
    message: result.message,
  });
});

module.exports = {
  getHousingDevelopments: getHousingDevelopmentsController,
  getHousingDevelopment,
  createHousingDevelopment: createHousingDevelopmentController,
  updateHousingDevelopment: updateHousingDevelopmentController,
  submitHousingDevelopment: submitHousingDevelopmentController,
  verifyHousingDevelopment: verifyHousingDevelopmentController,
  getHousingDevelopmentStatistics: getHousingDevelopmentStatisticsController,
  deleteHousingDevelopment: deleteHousingDevelopmentController,
};
