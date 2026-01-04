const { errorFactory, isAppError } = require('./errorFactory');

/**
 * Error Response Builder
 */
const errorResponseBuilder = {
  /**
   * Build error response for API
   */
  buildResponse: (error, includeStack = false) => {
    const response = {
      success: false,
      message: error.message,
      code: error.code,
      timestamp: error.timestamp,
    };

    // Add additional fields if present
    if (error.field) response.field = error.field;
    if (error.details) response.details = error.details;
    if (error.retryAfter) response.retryAfter = error.retryAfter;

    // Include stack trace in development
    if (includeStack && process.env.NODE_ENV === 'development') {
      response.stack = error.stack;
    }

    return response;
  },

  /**
   * Build validation error response
   */
  buildValidationResponse: (errors) => ({
    success: false,
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    errors: Array.isArray(errors) ? errors : [errors],
    timestamp: new Date().toISOString(),
  }),
};

/**
 * Error Handler Utilities
 */
const errorHandler = {
  /**
   * Handle Sequelize errors
   */
  handleSequelizeError: (error) => {
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }));
      return errorFactory.validation('Validation failed', null, validationErrors);
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0]?.path || 'field';
      return errorFactory.conflict(`${field} already exists`, 'DUPLICATE_ENTRY');
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return errorFactory.validation('Invalid reference to related resource');
    }

    if (error.name === 'SequelizeDatabaseError') {
      return errorFactory.database('Database operation failed', error);
    }

    return errorFactory.database('Database error occurred', error);
  },

  /**
   * Handle JWT errors
   */
  handleJWTError: (error) => {
    if (error.name === 'JsonWebTokenError') {
      return errorFactory.authentication('Invalid token', 'INVALID_TOKEN');
    }
    if (error.name === 'TokenExpiredError') {
      return errorFactory.authentication('Token expired', 'TOKEN_EXPIRED');
    }
    return errorFactory.authentication('Token verification failed');
  },

  /**
   * Handle bcrypt errors
   */
  handleBcryptError: (_error) => errorFactory.authentication('Password verification failed'),

  /**
   * Handle generic errors
   */
  handleGenericError: (error) => {
    if (isAppError(error)) {
      return error;
    }

    // Handle known error types
    if (error.name === 'ValidationError') {
      return errorFactory.validation(error.message);
    }

    if (error.name === 'CastError') {
      return errorFactory.validation('Invalid data format');
    }

    // Default to internal server error
    return errorFactory.database(
      process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
      error,
    );
  },
};

/**
 * Error Logger
 */
const errorLogger = {
  /**
   * Log error with context
   */
  log: (error, context = {}) => {
    const logData = {
      timestamp: new Date().toISOString(),
      level: error.statusCode >= 500 ? 'error' : 'warn',
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      context,
    };

    if (error.statusCode >= 500) {
      console.error('🚨 Error:', logData);
    } else {
      console.warn('⚠️ Warning:', logData);
    }

    return logData;
  },

  /**
   * Log error with request context
   */
  logWithRequest: (error, req) => {
    const context = {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.user?.id,
    };

    return errorLogger.log(error, context);
  },
};

/**
 * Error Recovery Utilities
 */
const errorRecovery = {
  /**
   * Check if error is recoverable
   */
  isRecoverable: (error) => {
    if (isAppError(error)) {
      return error.isOperational;
    }
    return false;
  },

  /**
   * Get retry delay for error
   */
  getRetryDelay: (error, attempt = 1) => {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return Math.floor(delay + jitter);
  },

  /**
   * Check if operation should be retried
   */
  shouldRetry: (error, attempt = 1, maxAttempts = 3) => {
    if (attempt >= maxAttempts) return false;
    if (!errorRecovery.isRecoverable(error)) return false;

    // Don't retry certain error types
    const nonRetryableCodes = ['VALIDATION_ERROR', 'AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR'];
    return !nonRetryableCodes.includes(error.code);
  },
};

/**
 * Error Metrics
 */
const errorMetrics = {
  /**
   * Track error occurrence
   */
  track: (error, context = {}) => {
    // In a real application, you would send this to your metrics service
    const metrics = {
      errorCode: error.code,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
      context,
    };

    // For now, just log metrics
    console.log('📊 Error Metrics:', metrics);
    return metrics;
  },

  /**
   * Get error statistics
   */
  getStats: () => ({
    // In a real application, you would query your metrics database
    totalErrors: 0,
    errorsByCode: {},
    errorsByStatusCode: {},
    lastUpdated: new Date().toISOString(),
  }),
};

module.exports = {
  errorFactory,
  errorResponseBuilder,
  errorHandler,
  errorLogger,
  errorRecovery,
  errorMetrics,
};
