import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'Internal server error occurred';
  let details = err.details || [];

  // 1. Handle JSON parse errors from body parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'MALFORMED_JSON';
    message = 'Malformed JSON in request payload';
  }
  // 2. Handle Zod validation errors
  else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.errors[0]?.message || 'Request validation failed';
    details = err.errors.map((e) => ({
      field: e.path.join('.') || 'body',
      issue: e.message
    }));
  }
  // 3. Handle Mongoose CastError (e.g., malformed ObjectId)
  else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid ${err.path}: ${err.value}`;
  }
  // 4. Handle Mongoose ValidationError
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Database validation failed';
    details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      issue: e.message
    }));
  }
  // 5. Handle duplicate key collisions (code 11000)
  else if (err.name === 'MongoServerError' && err.code === 11000) {
    statusCode = 409;
    code = 'CONFLICT';
    message = 'Resource already exists with unique field conflict';
  }
  // 6. Handle ApiError instances
  else if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details || [];
  }

  // Structured logging
  if (statusCode >= 500) {
    logger.error(`Internal server error [${code}]:`, message);
  } else {
    logger.debug(`Client request error [${code}]:`, message);
  }

  const response = {
    success: false,
    error: {
      code,
      message,
      ...(details.length > 0 && { details }),
      ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack })
    }
  };

  res.status(statusCode).json(response);
};

export default errorHandler;
