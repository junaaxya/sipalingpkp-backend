const {
  errorResponseBuilder,
  errorHandler,
  errorLogger,
  errorMetrics,
  errorRecovery,
} = require('./errorUtils');

/**
 * Centralized Error Handling Middleware
 * Handles all errors in a consistent and organized manner
 */

/**
 * Global Error Handler Middleware
 * This should be the last middleware in the chain
 */
const globalErrorHandler = (error, req, res, _next) => {
  // Handle the error
  const processedError = errorHandler.handleGenericError(error);

  // Log the error
  errorLogger.logWithRequest(processedError, req);

  // Track error metrics
  errorMetrics.track(processedError, {
    method: req.method,
    url: req.url,
    userId: req.user?.id,
  });

  // Build response
  const response = errorResponseBuilder.buildResponse(
    processedError,
    process.env.NODE_ENV === 'development',
  );

  if (processedError.retryAfter) {
    res.set('Retry-After', String(processedError.retryAfter));
  }

  // Send response
  res.status(processedError.statusCode).json(response);
};

/**
 * Async Error Handler Wrapper
 * Wraps async route handlers to catch and forward errors
 */
const asyncErrorHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validation Error Handler
 * Handles validation errors specifically
 */
const validationErrorHandler = (error, req, res, next) => {
  if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
    const response = errorResponseBuilder.buildValidationResponse(error.details || [error]);
    return res.status(400).json(response);
  }
  next(error);
};

/**
 * Authentication Error Handler
 * Handles authentication errors specifically
 */
const authenticationErrorHandler = (error, req, res, next) => {
  if (error.name === 'AuthenticationError' || error.code === 'AUTHENTICATION_ERROR') {
    const response = errorResponseBuilder.buildResponse(error);
    return res.status(401).json(response);
  }
  next(error);
};

/**
 * Authorization Error Handler
 * Handles authorization errors specifically
 */
const authorizationErrorHandler = (error, req, res, next) => {
  if (error.name === 'AuthorizationError' || error.code === 'AUTHORIZATION_ERROR') {
    const response = errorResponseBuilder.buildResponse(error);
    return res.status(403).json(response);
  }
  next(error);
};

/**
 * Not Found Error Handler
 * Handles not found errors specifically
 */
const notFoundErrorHandler = (error, req, res, next) => {
  if (error.name === 'NotFoundError' || error.code === 'NOT_FOUND') {
    const response = errorResponseBuilder.buildResponse(error);
    return res.status(404).json(response);
  }
  next(error);
};

/**
 * Conflict Error Handler
 * Handles conflict errors specifically
 */
const conflictErrorHandler = (error, req, res, next) => {
  if (error.name === 'ConflictError' || error.code === 'CONFLICT') {
    const response = errorResponseBuilder.buildResponse(error);
    return res.status(409).json(response);
  }
  next(error);
};

/**
 * Database Error Handler
 * Handles database errors specifically
 */
const databaseErrorHandler = (error, req, res, next) => {
  if (error.name === 'DatabaseError' || error.code === 'DATABASE_ERROR') {
    const response = errorResponseBuilder.buildResponse(error);
    return res.status(500).json(response);
  }
  next(error);
};

/**
 * Business Logic Error Handler
 * Handles business logic errors specifically
 */
const businessLogicErrorHandler = (error, req, res, next) => {
  if (error.name === 'BusinessLogicError' || error.code === 'BUSINESS_LOGIC_ERROR') {
    const response = errorResponseBuilder.buildResponse(error);
    return res.status(422).json(response);
  }
  next(error);
};

/**
 * 404 Handler for undefined routes
 */
const notFoundHandler = (req, res) => {
  const response = {
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
  };
  res.status(404).json(response);
};

/**
 * Error Handler Chain
 * Combines all error handlers in the correct order
 */
const errorHandlerChain = [
  validationErrorHandler,
  authenticationErrorHandler,
  authorizationErrorHandler,
  notFoundErrorHandler,
  conflictErrorHandler,
  databaseErrorHandler,
  businessLogicErrorHandler,
  globalErrorHandler,
];

/**
 * Service Error Handler
 * Handles errors from service layer
 */
const serviceErrorHandler = (error, context = {}) => {
  // Log the error with context
  errorLogger.log(error, context);

  // Track metrics
  errorMetrics.track(error, context);

  // Return processed error
  return errorHandler.handleGenericError(error);
};

/**
 * Retry Handler
 * Handles retry logic for recoverable errors
 */
const retryHandler = async(fn, maxAttempts = 3) => {
  let attempt = 1;

  const executeWithRetry = async() => {
    try {
      return await fn();
    } catch (error) {
      if (!errorRecovery.shouldRetry(error, attempt, maxAttempts)) {
        throw error;
      }

      const delay = errorRecovery.getRetryDelay(error, attempt);
      console.log(`Retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);

      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });

      attempt += 1;
      return executeWithRetry();
    }
  };

  return executeWithRetry();
};

/**
 * Error Boundary
 * Catches and handles errors in async operations
 */
const errorBoundary = (fn) => async(...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    const processedError = serviceErrorHandler(error, {
      function: fn.name,
      args: args.length,
    });
    throw processedError;
  }
};

/**
 * Safe Execute
 * Executes a function safely and returns error instead of throwing
 */
const safeExecute = async(fn, ...args) => {
  try {
    const result = await fn(...args);
    return { success: true, result };
  } catch (error) {
    const processedError = serviceErrorHandler(error, {
      function: fn.name,
      args: args.length,
    });
    return { success: false, error: processedError };
  }
};

module.exports = {
  globalErrorHandler,
  asyncErrorHandler,
  validationErrorHandler,
  authenticationErrorHandler,
  authorizationErrorHandler,
  notFoundErrorHandler,
  conflictErrorHandler,
  databaseErrorHandler,
  businessLogicErrorHandler,
  notFoundHandler,
  errorHandlerChain,
  serviceErrorHandler,
  retryHandler,
  errorBoundary,
  safeExecute,
};
