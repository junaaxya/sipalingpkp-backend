/**
 * Functional Error Creation Utilities
 * Creates error objects without using classes
 */

/**
 * Create a base application error object
 */
function createAppError(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
  const error = new Error(message);

  // Set error properties
  error.name = 'AppError';
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = isOperational;
  error.timestamp = new Date().toISOString();

  // Capture stack trace
  Error.captureStackTrace(error, createAppError);

  // Add toJSON method
  error.toJSON = function toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      timestamp: this.timestamp,
      ...(this.details && { details: this.details }),
      ...(this.field && { field: this.field }),
    };
  };

  return error;
}

/**
 * Create validation error
 */
function createValidationError(message, field = null, details = null) {
  const error = createAppError(message, 400, 'VALIDATION_ERROR', true);
  error.name = 'ValidationError';
  error.field = field;
  error.details = details;
  return error;
}

/**
 * Create authentication error
 */
function createAuthenticationError(message = 'Authentication failed', code = 'AUTHENTICATION_ERROR') {
  const error = createAppError(message, 401, code, true);
  error.name = 'AuthenticationError';
  return error;
}

/**
 * Create authorization error
 */
function createAuthorizationError(message = 'Access denied', code = 'AUTHORIZATION_ERROR') {
  const error = createAppError(message, 403, code, true);
  error.name = 'AuthorizationError';
  return error;
}

/**
 * Create not found error
 */
function createNotFoundError(resource = 'Resource', code = 'NOT_FOUND') {
  const message = typeof resource === 'string' ? `${resource} not found` : 'Resource not found';
  const error = createAppError(message, 404, code, true);
  error.name = 'NotFoundError';
  return error;
}

/**
 * Create conflict error
 */
function createConflictError(message, code = 'CONFLICT') {
  const error = createAppError(message, 409, code, true);
  error.name = 'ConflictError';
  return error;
}

/**
 * Create database error
 */
function createDatabaseError(message = 'Database operation failed', originalError = null) {
  const error = createAppError(message, 500, 'DATABASE_ERROR', true);
  error.name = 'DatabaseError';
  error.originalError = originalError;
  return error;
}

/**
 * Create business logic error
 */
function createBusinessLogicError(message, code = 'BUSINESS_LOGIC_ERROR') {
  const error = createAppError(message, 422, code, true);
  error.name = 'BusinessLogicError';
  return error;
}

/**
 * Error Factory Functions
 */
const errorFactory = {
  validation: createValidationError,
  authentication: createAuthenticationError,
  authorization: createAuthorizationError,
  notFound: createNotFoundError,
  conflict: createConflictError,
  database: createDatabaseError,
  businessLogic: createBusinessLogicError,
};

/**
 * Check if error is an AppError instance
 */
function isAppError(error) {
  return error && error.isOperational !== undefined && error.statusCode !== undefined;
}

/**
 * Check if error is a specific type
 */
function isErrorType(error, type) {
  return error && error.name === type;
}

module.exports = {
  createAppError,
  createValidationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createConflictError,
  createDatabaseError,
  createBusinessLogicError,
  errorFactory,
  isAppError,
  isErrorType,
};
