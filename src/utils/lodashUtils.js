const _ = require('lodash');
const {
  shouldBypassLocationScope,
  isMasyarakat,
  isAdminKabupaten,
  isAdminDesa,
} = require('./accessControl');

/**
 * Utility functions using Lodash
 * Provides common data manipulation and validation utilities
 */

/**
 * Data Transformation Utilities
 */
const dataUtils = {
  /**
   * Pick only allowed fields from an object
   */
  pickFields: (data, allowedFields) => _.pick(data, allowedFields),

  /**
   * Omit sensitive fields from an object
   */
  omitSensitive: (data, sensitiveFields = [
    'password', 'passwordHash', 'refreshToken',
  ]) => _.omit(data, sensitiveFields),

  /**
   * Transform object keys to camelCase
   */
  camelCaseKeys: (obj) => _.mapKeys(obj, (value, key) => _.camelCase(key)),

  /**
   * Transform object keys to snake_case
   */
  snakeCaseKeys: (obj) => _.mapKeys(obj, (value, key) => _.snakeCase(key)),

  /**
   * Deep clone an object
   */
  deepClone: (obj) => _.cloneDeep(obj),

  /**
   * Merge objects deeply
   */
  deepMerge: (target, source) => _.merge({}, target, source),
};

/**
 * Array and Collection Utilities
 */
const arrayUtils = {
  /**
   * Group array by a key
   */
  groupBy: (array, key) => _.groupBy(array, key),

  /**
   * Sort array by multiple criteria
   */
  sortBy: (array, criteria) => _.sortBy(array, criteria),

  /**
   * Remove duplicates from array
   */
  unique: (array) => _.uniq(array),

  /**
   * Chunk array into smaller arrays
   */
  chunk: (array, size) => _.chunk(array, size),

  /**
   * Flatten nested arrays
   */
  flatten: (array) => _.flatten(array),

  /**
   * Get unique values from array of objects by key
   */
  uniqueBy: (array, key) => _.uniqBy(array, key),
};

/**
 * String and Text Utilities
 */
const stringUtils = {
  /**
   * Capitalize first letter of each word
   */
  capitalize: (str) => _.capitalize(str),

  /**
   * Convert string to camelCase
   */
  camelCase: (str) => _.camelCase(str),

  /**
   * Convert string to kebab-case
   */
  kebabCase: (str) => _.kebabCase(str),

  /**
   * Convert string to snake_case
   */
  snakeCase: (str) => _.snakeCase(str),

  /**
   * Convert string to PascalCase
   */
  pascalCase: (str) => _.upperFirst(_.camelCase(str)),

  /**
   * Truncate string with ellipsis
   */
  truncate: (str, length = 50, omission = '...') => _.truncate(str, { length, omission }),
};

/**
 * Number and Math Utilities
 */
const numberUtils = {
  /**
   * Round number to specified decimal places
   */
  round: (num, precision = 2) => _.round(num, precision),

  /**
   * Clamp number between min and max
   */
  clamp: (num, min, max) => _.clamp(num, min, max),

  /**
   * Generate random number in range
   */
  random: (min = 0, max = 1) => _.random(min, max),

  /**
   * Sum array of numbers
   */
  sum: (array) => _.sum(array),

  /**
   * Calculate mean of array
   */
  mean: (array) => _.mean(array),
};

/**
 * Object and Property Utilities
 */
const objectUtils = {
  /**
   * Check if object is empty
   */
  isEmpty: (obj) => _.isEmpty(obj),

  /**
   * Check if value is null or undefined
   */
  isNil: (value) => _.isNil(value),

  /**
   * Get nested property value safely
   */
  get: (obj, path, defaultValue) => _.get(obj, path, defaultValue),

  /**
   * Set nested property value
   */
  set: (obj, path, value) => _.set(obj, path, value),

  /**
   * Check if object has property
   */
  has: (obj, path) => _.has(obj, path),

  /**
   * Get all property paths
   */
  paths: (obj) => _.paths(obj),
};

/**
 * Validation Utilities
 */
const validationUtils = {
  /**
   * Check if value is valid email
   */
  isEmail: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  /**
   * Check if value is valid phone number
   */
  isPhone: (value) => {
    const phoneRegex = /^[+]?[0-9\s\-()]{10,20}$/;
    return phoneRegex.test(value);
  },

  /**
   * Check if value is valid nanoid
   */
  isNanoid: (value, length = 12) => {
    const nanoidRegex = new RegExp(`^[A-Za-z0-9_-]{${length}}$`);
    return nanoidRegex.test(value);
  },

  /**
   * Check if value is positive integer
   */
  isPositiveInteger: (value) => _.isInteger(value) && value > 0,

  /**
   * Check if value is valid date
   */
  isValidDate: (value) => !_.isNil(value) && !Number.isNaN(Date.parse(value)),
};

/**
 * Pagination Utilities
 */
const paginationUtils = {
  /**
   * Calculate pagination metadata
   */
  calculatePagination: (page, limit, total) => {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: parseInt(total, 10),
      pages: totalPages,
      hasNext,
      hasPrev,
      nextPage: hasNext ? page + 1 : null,
      prevPage: hasPrev ? page - 1 : null,
    };
  },

  /**
   * Calculate offset for database queries
   */
  calculateOffset: (page, limit) => (page - 1) * limit,

  /**
   * Format Sequelize pagination results
   */
  formatPagination: (result, page, limit) => {
    const rows = result?.rows || [];
    const total = result?.count || 0;
    const pagination = paginationUtils.calculatePagination(page, limit, total);

    return {
      items: rows,
      pagination: {
        ...pagination,
        totalItems: pagination.total,
        totalPages: pagination.pages,
        itemsPerPage: pagination.limit,
        currentPage: pagination.page,
      },
    };
  },
};

/**
 * Error Handling Utilities
 */
const errorUtils = {
  /**
   * Create standardized error response
   */
  createErrorResponse: (message, code = 'ERROR', errors = null) => {
    const response = {
      success: false,
      message,
      code,
    };

    if (errors) {
      response.errors = errors;
    }

    return response;
  },

  /**
   * Extract error message from error object
   */
  extractErrorMessage: (error) => {
    if (_.isString(error)) {
      return error;
    }
    if (_.isObject(error) && error.message) {
      return error.message;
    }
    return 'Unknown error occurred';
  },
};

/**
 * Database Query Utilities
 */
const queryUtils = {
  /**
   * Build where clause for location-based filtering
   */
  buildLocationWhereClause: (user, additionalFilters = {}) => {
    const whereClause = {};

    // Filter out undefined values from additional filters
    Object.keys(additionalFilters).forEach((key) => {
      if (additionalFilters[key] !== undefined && additionalFilters[key] !== null) {
        whereClause[key] = additionalFilters[key];
      }
    });

    if (!user || shouldBypassLocationScope(user) || isMasyarakat(user)) {
      return whereClause;
    }

    // Apply location-based filtering based on user level
    if (isAdminKabupaten(user) && user.assignedRegencyId) {
      whereClause.regencyId = user.assignedRegencyId;
      return whereClause;
    }

    if (isAdminDesa(user) && user.assignedVillageId) {
      whereClause.villageId = user.assignedVillageId;
      return whereClause;
    }

    if (user.userLevel === 'village' && user.assignedVillageId) {
      whereClause.villageId = user.assignedVillageId;
    } else if (user.userLevel === 'district' && user.assignedDistrictId) {
      whereClause.districtId = user.assignedDistrictId;
    } else if (user.userLevel === 'regency' && user.assignedRegencyId) {
      whereClause.regencyId = user.assignedRegencyId;
    } else if (user.userLevel === 'province' && user.assignedProvinceId) {
      whereClause.provinceId = user.assignedProvinceId;
    }

    return whereClause;
  },

  /**
   * Build pagination options for Sequelize
   */
  buildPaginationOptions: (page, limit) => ({
    limit: parseInt(limit, 10),
    offset: paginationUtils.calculateOffset(page, limit),
  }),

  /**
   * Build order options for Sequelize
   */
  buildOrderOptions: (sortBy = 'createdAt', sortOrder = 'DESC') => [[sortBy, sortOrder]],

  /**
   * Check if user has access to a location based on user level and assigned location IDs
   * @param {Object} user - User object with userLevel and assigned location IDs
   * @param {Object} targetLocation - Target location object with provinceId, regencyId, districtId, villageId
   * @returns {boolean} - True if user has access, false otherwise
   */
  checkLocationAccess: (user, targetLocation) => {
    if (!user || !targetLocation) {
      return false;
    }

    const {
      userLevel,
      assignedProvinceId,
      assignedRegencyId,
      assignedDistrictId,
      assignedVillageId,
    } = user;

    const {
      provinceId: targetProvinceId,
      regencyId: targetRegencyId,
      districtId: targetDistrictId,
      villageId: targetVillageId,
    } = targetLocation;

    // Super admin and verifikator can access everything
    if (shouldBypassLocationScope(user)) {
      return true;
    }

    // Check direct access based on user level
    if (userLevel === 'village' && assignedVillageId) {
      return targetVillageId === assignedVillageId;
    }

    if (userLevel === 'district' && assignedDistrictId) {
      return targetDistrictId === assignedDistrictId;
    }

    if (userLevel === 'regency' && assignedRegencyId) {
      return targetRegencyId === assignedRegencyId;
    }

    if (userLevel === 'province' && assignedProvinceId) {
      return targetProvinceId === assignedProvinceId;
    }

    // No access if user level doesn't match or no assigned location
    return false;
  },
};

module.exports = {
  dataUtils,
  arrayUtils,
  stringUtils,
  numberUtils,
  objectUtils,
  validationUtils,
  paginationUtils,
  errorUtils,
  queryUtils,
};
