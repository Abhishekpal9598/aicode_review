export class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error description
   * @param {string} code - Machine-readable error code (e.g. VALIDATION_ERROR)
   * @param {Array} details - Array of specific error items
   * @param {string} stack - Optional stack trace override
   */
  constructor(
    statusCode = 500,
    message = 'Internal server error occurred',
    code = 'INTERNAL_SERVER_ERROR',
    details = [],
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = 'Bad request', code = 'BAD_REQUEST', details = []) {
    return new ApiError(400, message, code, details);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND', details = []) {
    return new ApiError(404, message, code, details);
  }

  static internal(message = 'Internal server error occurred', code = 'INTERNAL_SERVER_ERROR', details = []) {
    return new ApiError(500, message, code, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED', details = []) {
    return new ApiError(401, message, code, details);
  }

  static forbidden(message = 'Access denied', code = 'FORBIDDEN', details = []) {
    return new ApiError(403, message, code, details);
  }

  static conflict(message = 'Resource conflict', code = 'CONFLICT', details = []) {
    return new ApiError(409, message, code, details);
  }

  static tooManyRequests(message = 'Too many requests', code = 'RATE_LIMIT_EXCEEDED', details = []) {
    return new ApiError(429, message, code, details);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', code = 'SERVICE_UNAVAILABLE', details = []) {
    return new ApiError(503, message, code, details);
  }
}

export default ApiError;
