const _ = require('lodash');
const { compiledSchemas } = require('../schemas/validationSchemas');

/**
 * Get user-friendly error message from Ajv error
 */
const getErrorMessage = (error) => {
  const { keyword, params, message } = error;

  switch (keyword) {
  case 'required':
    return `${params.missingProperty} is required`;
  case 'type':
    return `${error.dataPath || 'Field'} must be of type ${params.type}`;
  case 'format':
    return `${error.dataPath || 'Field'} has invalid format`;
  case 'minimum':
    return `${error.dataPath || 'Field'} must be at least ${params.limit}`;
  case 'maximum':
    return `${error.dataPath || 'Field'} must be at most ${params.limit}`;
  case 'minLength':
    return `${error.dataPath || 'Field'} must be at least ${params.limit} characters long`;
  case 'maxLength':
    return `${error.dataPath || 'Field'} must be at most ${params.limit} characters long`;
  case 'pattern':
    return `${error.dataPath || 'Field'} format is invalid`;
  case 'enum':
    return `${error.dataPath || 'Field'} must be one of: ${params.allowedValues.join(', ')}`;
  case 'additionalProperties':
    return `Additional property '${params.additionalProperty}' is not allowed`;
  default:
    return message || 'Invalid value';
  }
};

/**
 * Validation Middleware Factory
 * Creates middleware for validating request data using Ajv schemas
 */
const validateRequest = (schemaCategory, schemaName) => (req, res, next) => {
  try {
    const validator = compiledSchemas[schemaCategory][schemaName];

    if (!validator) {
      return res.status(500).json({
        success: false,
        message: `Validation schema not found: ${schemaCategory}.${schemaName}`,
        code: 'SCHEMA_NOT_FOUND',
      });
    }

    // Determine which data to validate based on HTTP method
    let dataToValidate;
    if (req.method === 'GET') {
      dataToValidate = req.query;
    } else {
      dataToValidate = req.body;
    }

    // Validate the data
    const isValid = validator(dataToValidate);

    if (!isValid) {
      // Format Ajv errors into user-friendly messages
      const errors = validator.errors.map((error) => {
        const field = error.instancePath ? error.instancePath.substring(1) : error.schemaPath;
        return {
          field: field || error.dataPath,
          message: getErrorMessage(error),
          value: error.data,
        };
      });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors,
      });
    }

    // If validation passes, clean the data (remove additional properties)
    if (req.method === 'GET') {
      req.query = _.pick(dataToValidate, Object.keys(validator.schema.properties || {}));
    } else {
      req.body = _.pick(dataToValidate, Object.keys(validator.schema.properties || {}));
    }

    next();
  } catch (error) {
    console.error('Validation middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during validation',
      code: 'VALIDATION_INTERNAL_ERROR',
    });
  }
};

/**
 * Custom validation middleware for specific use cases
 */
const validateLocationAssignment = (req, res, next) => {
  try {
    const {
      userLevel, assignedProvinceId, assignedRegencyId, assignedDistrictId, assignedVillageId,
    } = req.body;

    // Validate location assignment based on user level
    const locationValidation = {
      province: () => {
        if (!assignedProvinceId) {
          return { isValid: false, error: 'Province assignment required for province level user' };
        }
        return { isValid: true };
      },
      regency: () => {
        if (!assignedRegencyId) {
          return { isValid: false, error: 'Regency assignment required for regency level user' };
        }
        return { isValid: true };
      },
      district: () => {
        if (!assignedDistrictId) {
          return { isValid: false, error: 'District assignment required for district level user' };
        }
        return { isValid: true };
      },
      village: () => {
        if (!assignedVillageId) {
          return { isValid: false, error: 'Village assignment required for village level user' };
        }
        return { isValid: true };
      },
    };

    const validation = locationValidation[userLevel];
    if (validation) {
      const result = validation();
      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          message: result.error,
          code: 'LOCATION_ASSIGNMENT_ERROR',
        });
      }
    }

    next();
  } catch (error) {
    console.error('Location validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during location validation',
      code: 'LOCATION_VALIDATION_INTERNAL_ERROR',
    });
  }
};

/**
 * Validate geographic data query parameters
 */
const validateGeographicQuery = (req, res, next) => {
  try {
    const { level, parentId } = req.query;

    // Check if parentId is required for certain levels
    const requiresParentId = ['regencies', 'districts', 'villages'];
    if (requiresParentId.includes(level) && !parentId) {
      return res.status(400).json({
        success: false,
        message: `Parent ID is required for ${level}`,
        code: 'MISSING_PARENT_ID',
      });
    }

    next();
  } catch (error) {
    console.error('Geographic query validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during geographic validation',
      code: 'GEOGRAPHIC_VALIDATION_INTERNAL_ERROR',
    });
  }
};

/**
 * Sanitize and validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  try {
    const { page = '1', limit = '20' } = req.query;

    // Convert to numbers and validate
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (Number.isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer',
        code: 'INVALID_PAGE',
      });
    }

    if (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100',
        code: 'INVALID_LIMIT',
      });
    }

    // Update query with validated values
    req.query.page = pageNum.toString();
    req.query.limit = limitNum.toString();

    next();
  } catch (error) {
    console.error('Pagination validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during pagination validation',
      code: 'PAGINATION_VALIDATION_INTERNAL_ERROR',
    });
  }
};

module.exports = {
  validateRequest,
  validateLocationAssignment,
  validateGeographicQuery,
  validatePagination,
};
