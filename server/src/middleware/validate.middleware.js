import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';

/**
 * Reusable Express request validation middleware using Zod.
 * Validates req.body, req.query, and req.params against provided schemas.
 *
 * @param {{ body?: import('zod').ZodSchema, query?: import('zod').ZodSchema, params?: import('zod').ZodSchema } | import('zod').ZodSchema} schema
 */
export const validate = (schema) => (req, res, next) => {
  try {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }
    if (schema.query) {
      req.query = schema.query.parse(req.query);
    }
    if (schema.params) {
      req.params = schema.params.parse(req.params);
    }
    if (!schema.body && !schema.query && !schema.params && typeof schema.parse === 'function') {
      req.body = schema.parse(req.body);
    }
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map((err) => ({
        field: err.path.join('.') || 'body',
        issue: err.message
      }));
      return next(new ApiError(400, 'Request validation failed', 'VALIDATION_ERROR', details));
    }
    next(error);
  }
};

export default validate;
