import { z } from 'zod';

/**
 * Zod validation schema for POST /api/v1/analysis/static
 */
export const staticAnalysisSchema = {
  body: z.object({
    code: z
      .string({ required_error: 'Source code is required' })
      .refine((val) => val.trim().length > 0, {
        message: 'Source code cannot be empty or contain only whitespace'
      })
      .refine((val) => Buffer.byteLength(val, 'utf8') <= 1048576, {
        message: 'Source code exceeds maximum size limit (1 MB)'
      })
      .refine((val) => val.split(/\r?\n/).length <= 2500, {
        message: 'Source code exceeds maximum line count limit (2,500 LOC)'
      }),
    language: z.enum(
      ['c', 'cpp', 'java', 'python', 'javascript', 'typescript'],
      { required_error: 'Supported language identifier is required' }
    ),
    fileName: z.string().trim().max(255, 'Filename cannot exceed 255 characters').optional(),
    title: z.string().trim().max(200, 'Title cannot exceed 200 characters').optional()
  }).strict()
};

export default {
  staticAnalysisSchema
};
