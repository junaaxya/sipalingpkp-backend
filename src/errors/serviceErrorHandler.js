const { errorFactory, errorLogger, errorMetrics } = require('./errorUtils');

/**
 * Service Error Handler
 * Handles errors from service layer with proper logging and metrics
 */

/**
 * Handle service errors with context
 */
function handleServiceError(error, context = {}) {
  // Log the error with context
  errorLogger.log(error, context);

  // Track metrics
  errorMetrics.track(error, context);

  // Return processed error
  return errorFactory.database(
    error.message || 'Service operation failed',
    error,
  );
}

/**
 * Handle validation errors in services
 */
function handleValidationError(message, field = null, details = null) {
  const error = errorFactory.validation(message, field, details);
  errorLogger.log(error, { type: 'validation' });
  return error;
}

/**
 * Handle authentication errors in services
 */
function handleAuthenticationError(message = 'Authentication failed', code = 'AUTHENTICATION_ERROR') {
  const error = errorFactory.authentication(message, code);
  errorLogger.log(error, { type: 'authentication' });
  return error;
}

/**
 * Handle authorization errors in services
 */
function handleAuthorizationError(message = 'Access denied', code = 'AUTHORIZATION_ERROR') {
  const error = errorFactory.authorization(message, code);
  errorLogger.log(error, { type: 'authorization' });
  return error;
}

/**
 * Handle not found errors in services
 */
function handleNotFoundError(resource = 'Resource', code = 'NOT_FOUND') {
  const error = errorFactory.notFound(resource, code);
  errorLogger.log(error, { type: 'not_found' });
  return error;
}

/**
 * Handle conflict errors in services
 */
function handleConflictError(message, code = 'CONFLICT') {
  const error = errorFactory.conflict(message, code);
  errorLogger.log(error, { type: 'conflict' });
  return error;
}

/**
 * Handle database errors in services
 */
function handleDatabaseError(message = 'Database operation failed', originalError = null) {
  const error = errorFactory.database(message, originalError);
  errorLogger.log(error, { type: 'database' });
  return error;
}

/**
 * Handle business logic errors in services
 */
function handleBusinessLogicError(message, code = 'BUSINESS_LOGIC_ERROR') {
  const error = errorFactory.businessLogic(message, code);
  errorLogger.log(error, { type: 'business_logic' });
  return error;
}

/**
 * Service Error Handler Factory
 */
const serviceErrorHandler = {
  validation: handleValidationError,
  authentication: handleAuthenticationError,
  authorization: handleAuthorizationError,
  notFound: handleNotFoundError,
  conflict: handleConflictError,
  database: handleDatabaseError,
  businessLogic: handleBusinessLogicError,
  generic: handleServiceError,
};

/**
 * Wrap service function with error handling
 */
function wrapServiceFunction(fn, serviceName = 'Unknown') {
  return async(...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const context = {
        service: serviceName,
        function: fn.name,
        args: args.length,
      };
      throw handleServiceError(error, context);
    }
  };
}

/**
 * Safe service execution
 */
async function safeServiceExecution(fn, ...args) {
  try {
    const result = await fn(...args);
    return { success: true, result };
  } catch (error) {
    const context = {
      function: fn.name,
      args: args.length,
    };
    const processedError = handleServiceError(error, context);
    return { success: false, error: processedError };
  }
}

/**
 * Service error middleware
 */
function serviceErrorMiddleware(serviceName) {
  return (error, req, res, next) => {
    const context = {
      service: serviceName,
      method: req.method,
      url: req.url,
      userId: req.user?.id,
    };

    const processedError = handleServiceError(error, context);
    next(processedError);
  };
}

module.exports = {
  handleServiceError,
  handleValidationError,
  handleAuthenticationError,
  handleAuthorizationError,
  handleNotFoundError,
  handleConflictError,
  handleDatabaseError,
  handleBusinessLogicError,
  serviceErrorHandler,
  wrapServiceFunction,
  safeServiceExecution,
  serviceErrorMiddleware,
};
