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

/**
 * Request validation schema for GET /api/v1/reviews/:id/performance
 */
export const getPerformanceReviewSchema = {
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
      sort: z
        .enum(['severity_desc', 'severity_asc', 'line_asc', 'line_desc'])
        .default('severity_desc')
    })
    .strict()
};

/**
 * Request validation schema for POST /api/v1/reviews/:id/apply-fix
 */
export const applyFixSchema = {
  params: z
    .object({
      id: z
        .string({ required_error: 'Review ID is required' })
        .regex(OBJECT_ID_REGEX, { message: 'Invalid review ID format' })
    })
    .strict(),
  body: z
    .object({
      issueId: z
        .string()
        .regex(OBJECT_ID_REGEX, { message: 'Invalid issue ID format' })
        .optional()
        .nullable(),
      ruleId: z
        .string()
        .trim()
        .max(60, 'ruleId cannot exceed 60 characters')
        .optional()
        .nullable(),
      lineStart: z
        .number({ required_error: 'lineStart is required' })
        .int('lineStart must be an integer')
        .min(1, 'lineStart must be at least 1'),
      lineEnd: z
        .number({ required_error: 'lineEnd is required' })
        .int('lineEnd must be an integer')
        .min(1, 'lineEnd must be at least 1'),
      previousSnippet: z
        .string()
        .max(2000, 'previousSnippet cannot exceed 2000 characters')
        .optional()
        .default(''),
      appliedSnippet: z
        .string({ required_error: 'appliedSnippet is required' })
        .max(2000, 'appliedSnippet cannot exceed 2000 characters')
        .refine((v) => v.trim().length > 0, 'appliedSnippet cannot be empty'),
      updatedCode: z
        .string({ required_error: 'updatedCode is required' })
        .max(1000000, 'Source code exceeds maximum allowed size (1 MB)')
    })
    .refine((data) => data.lineEnd >= data.lineStart, {
      message: 'lineEnd cannot be less than lineStart',
      path: ['lineEnd']
    })
};

/**
 * Request validation schema for POST /api/v1/reviews/:id/undo-fix
 */
export const undoFixSchema = {
  params: z
    .object({
      id: z
        .string({ required_error: 'Review ID is required' })
        .regex(OBJECT_ID_REGEX, { message: 'Invalid review ID format' })
    })
    .strict(),
  body: z
    .object({
      restoredCode: z
        .string()
        .max(1000000, 'Source code exceeds maximum allowed size (1 MB)')
        .optional()
    })
    .optional()
    .default({})
};

/**
 * Request validation schema for GET /api/v1/reviews/:id/export
 */
export const exportReviewSchema = {
  params: z
    .object({
      id: z
        .string({ required_error: 'Review ID is required' })
        .regex(OBJECT_ID_REGEX, { message: 'Invalid review ID format' })
    })
    .strict(),
  query: z
    .object({
      format: z
        .enum(['json', 'markdown'], {
          errorMap: () => ({ message: "Export format must be either 'json' or 'markdown'" })
        })
        .default('json')
    })
    .strict()
};

export default {
  createReviewSchema,
  listReviewsSchema,
  getReviewByIdSchema,
  deleteReviewSchema,
  getSecurityReviewSchema,
  getPerformanceReviewSchema,
  applyFixSchema,
  undoFixSchema,
  exportReviewSchema
};



