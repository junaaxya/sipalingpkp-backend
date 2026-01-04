/**
 * Functional Error Handling System
 * Exports all error handling utilities using functional patterns
 */

// Error Factory Functions
const {
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
} = require('./errorFactory');

// Error Utilities
const {
  errorResponseBuilder,
  errorHandler,
  errorLogger,
  errorRecovery,
  errorMetrics,
} = require('./errorUtils');

// Error Middleware
const {
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
} = require('./errorMiddleware');

// Service Error Handler
const {
  handleServiceError,
  handleValidationError,
  handleAuthenticationError,
  handleAuthorizationError,
  handleNotFoundError,
  handleConflictError,
  handleDatabaseError,
  handleBusinessLogicError,
  serviceErrorHandler: serviceErrorHandlerFactory,
  wrapServiceFunction,
  safeServiceExecution,
  serviceErrorMiddleware,
} = require('./serviceErrorHandler');

module.exports = {
  // Error Creation Functions
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

  // Error Utilities
  errorResponseBuilder,
  errorHandler,
  errorLogger,
  errorRecovery,
  errorMetrics,

  // Error Middleware
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

  // Service Error Handler
  handleServiceError,
  handleValidationError,
  handleAuthenticationError,
  handleAuthorizationError,
  handleNotFoundError,
  handleConflictError,
  handleDatabaseError,
  handleBusinessLogicError,
  serviceErrorHandlerFactory,
  wrapServiceFunction,
  safeServiceExecution,
  serviceErrorMiddleware,
};
