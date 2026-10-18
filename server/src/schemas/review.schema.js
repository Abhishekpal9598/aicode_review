/**
 * Review Request Validation Schemas
 * server/src/schemas/review.schema.js
 *
 * Strict Zod request validation for Review Lifecycle APIs:
 * - POST /api/v1/reviews (createReviewSchema)
 * - GET /api/v1/reviews (listReviewsSchema)
 * - GET /api/v1/reviews/:id (getReviewByIdSchema)
 * - DELETE /api/v1/reviews/:id (deleteReviewSchema)
 */

import { z } from 'zod';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Request validation schema for POST /api/v1/reviews
 */
export const createReviewSchema = {
  body: z
    .object({
      code: z
        .string({ required_error: 'Source code is required' })
        .refine((v) => v.trim().length > 0, 'Source code cannot be empty or contain only whitespace')
        .refine((v) => Buffer.byteLength(v, 'utf8') <= 1048576, 'Source code exceeds maximum allowed size (1 MB)')
        .refine((v) => v.split(/\r?\n/).length <= 2500, 'Source code exceeds maximum allowed line count (2,500 LOC)'),
      language: z.enum(['c', 'cpp', 'java', 'python', 'javascript', 'typescript'], {
        required_error: 'Supported language identifier is required'
      }),
      title: z
        .string()
        .trim()
        .max(120, 'Title cannot exceed 120 characters')
        .optional(),
      fileName: z
        .string()
        .trim()
        .max(120, 'Filename cannot exceed 120 characters')
        .optional(),
      sourceType: z.enum(['pasted', 'upload']).default('pasted')
    })
    .strict()
};

/**
 * Request validation schema for GET /api/v1/reviews (paginated history)
 */
export const listReviewsSchema = {
  query: z
    .object({
      page: z.preprocess((val) => {
        if (typeof val === 'string' && /^\d+$/.test(val.trim())) {
          return parseInt(val.trim(), 10);
        }
        return val === undefined ? 1 : val;
      }, z.number().int().min(1, 'Page must be greater than or equal to 1').default(1)),
      limit: z.preprocess((val) => {
        if (typeof val === 'string' && /^\d+$/.test(val.trim())) {
          return parseInt(val.trim(), 10);
        }
        return val === undefined ? 10 : val;
      }, z.number().int().min(1, 'Limit must be at least 1').max(50, 'Limit cannot exceed 50').default(10)),
      language: z
        .enum(['c', 'cpp', 'java', 'python', 'javascript', 'typescript'])
        .optional(),
      status: z
        .enum(['pending', 'analyzing', 'completed', 'failed'])
        .optional(),
      search: z
        .string()
        .trim()
        .max(100, 'Search query cannot exceed 100 characters')
        .optional()
    })
    .strict()
};

/**
 * Request validation schema for GET /api/v1/reviews/:id
 */
export const getReviewByIdSchema = {
  params: z
    .object({
      id: z
        .string({ required_error: 'Review ID is required' })
        .regex(OBJECT_ID_REGEX, { message: 'Invalid review ID format' })
    })
    .strict()
};

/**
 * Request validation schema for DELETE /api/v1/reviews/:id
 */
export const deleteReviewSchema = {
  params: z
    .object({
      id: z
        .string({ required_error: 'Review ID is required' })
        .regex(OBJECT_ID_REGEX, { message: 'Invalid review ID format' })
    })
    .strict()
};

const CWE_QUERY_REGEX = /^cwe-\d+$/i;

/**
 * Request validation schema for GET /api/v1/reviews/:id/security
 */
export const getSecurityReviewSchema = {
  params: z
    .object({
      id: z
        .string({ required_error: 'Review ID is required' })
        .regex(OBJECT_ID_REGEX, { message: 'Invalid review ID format' })
    })
    .strict(),
  query: z
    .object({
      severity: z
        .enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'])
        .optional(),
      source: z
        .enum(['static', 'gemini', 'hybrid'])
        .optional(),
      owasp: z
        .string()
        .trim()
        .min(1, 'OWASP category filter cannot be empty')
        .max(100, 'OWASP filter cannot exceed 100 characters')
        .optional(),
      cwe: z
        .string()
        .trim()
        .regex(CWE_QUERY_REGEX, { message: 'Invalid CWE format. Expected CWE-XXX' })
        .optional(),
      sort: z
        .enum(['severity_desc', 'severity_asc', 'line_asc', 'line_desc'])
        .default('severity_desc')
    })
    .strict()
};

export default {
  createReviewSchema,
  listReviewsSchema,
  getReviewByIdSchema,
  deleteReviewSchema,
  getSecurityReviewSchema
};

