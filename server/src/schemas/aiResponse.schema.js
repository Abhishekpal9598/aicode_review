/**
 * Strict AI Response Schema & Validation Pipeline
 * server/src/schemas/aiResponse.schema.js
 *
 * Implements strict structural and spatial validation for Google Gemini AI responses
 * prior to downstream service consumption and database persistence.
 *
 * Key Architectural Guarantees:
 * 1. Strict Object Validation (.strict()): All unknown or unexpected properties cause immediate rejection.
 * 2. Zero Fabricated Defaults: No synthetic defaults for missing AI fields or scores.
 *    All finding fields (including columnStart, columnEnd, originalSnippet, suggestedSnippet, explanation)
 *    are required and rejected if missing.
 * 3. Bounded Value Ranges: 4 integer category scores in [0, 100], bounded string lengths, max 50 issues.
 * 4. Coordinate Integrity: lineEnd >= lineStart, same-line columnEnd >= columnStart, multi-line allowed.
 * 5. Coordinate Convention: 1-indexed, half-open [start, end) interval (Monaco / LineMapper convention).
 *    columnEnd is exclusive and corresponds to the position immediately following the token (up to L + 1).
 * 6. Source-Aware Validation: Finding coordinates verified against actual source line count and line lengths.
 * 7. Zero Silent Clamping: Out-of-bounds coordinates cleanly reject the response without normalization.
 * 8. Weighted Composite Score: aiCompositeScore computed in trusted application logic:
 *    round(0.30 * bugScore + 0.30 * securityScore + 0.20 * performanceScore + 0.20 * maintainabilityScore).
 * 9. Confidentiality: Validation error messages never leak source code or raw secrets.
 */

import { z } from 'zod';

/**
 * Valid category and severity enum values matching ReviewIssue model contract.
 */
export const ISSUE_CATEGORIES = ['bug', 'security', 'performance', 'maintainability', 'style'];
export const ISSUE_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

/**
 * Category score weights defining AI composite calculation (sum = 1.00)
 * As defined in Revision 2.1 Section 5.2.
 */
export const AI_SCORE_WEIGHTS = {
  bug: 0.30,
  security: 0.30,
  performance: 0.20,
  maintainability: 0.20
};

/**
 * Calculates weighted AI composite score in trusted application logic.
 * Formula: round(0.30 * bugScore + 0.30 * securityScore + 0.20 * performanceScore + 0.20 * maintainabilityScore)
 *
 * @param {object} categoryScores
 * @param {number} categoryScores.bugScore
 * @param {number} categoryScores.securityScore
 * @param {number} categoryScores.performanceScore
 * @param {number} categoryScores.maintainabilityScore
 * @returns {number} Integer composite score in [0, 100]
 */
export function calculateAiCompositeScore(categoryScores) {
  if (!categoryScores || typeof categoryScores !== 'object') {
    throw new TypeError('calculateAiCompositeScore requires a categoryScores object');
  }

  const { bugScore, securityScore, performanceScore, maintainabilityScore } = categoryScores;
  const scoreEntries = [
    ['bugScore', bugScore],
    ['securityScore', securityScore],
    ['performanceScore', performanceScore],
    ['maintainabilityScore', maintainabilityScore]
  ];

  for (const [name, val] of scoreEntries) {
    if (typeof val !== 'number' || !Number.isInteger(val) || val < 0 || val > 100) {
      throw new RangeError(`${name} must be an integer between 0 and 100`);
    }
  }

  return Math.round(
    AI_SCORE_WEIGHTS.bug * bugScore +
    AI_SCORE_WEIGHTS.security * securityScore +
    AI_SCORE_WEIGHTS.performance * performanceScore +
    AI_SCORE_WEIGHTS.maintainability * maintainabilityScore
  );
}

/**
 * Strict schema for individual AI-detected findings.
 * Aligns with ReviewIssue model contract and Revision 2.1 Section 4.2.
 * Zero fabricated defaults: all 11 fields are explicitly required.
 */
export const geminiIssueOutputSchema = z
  .object({
    category: z.enum(ISSUE_CATEGORIES, {
      required_error: 'Issue category is required',
      invalid_type_error: `Issue category must be one of: ${ISSUE_CATEGORIES.join(', ')}`
    }),
    severity: z.enum(ISSUE_SEVERITIES, {
      required_error: 'Issue severity is required',
      invalid_type_error: `Issue severity must be one of: ${ISSUE_SEVERITIES.join(', ')}`
    }),
    title: z
      .string({ required_error: 'Issue title is required' })
      .trim()
      .min(5, 'Title must be at least 5 characters')
      .max(150, 'Title cannot exceed 150 characters'),
    description: z
      .string({ required_error: 'Issue description is required' })
      .trim()
      .min(10, 'Description must be at least 10 characters')
      .max(1000, 'Description cannot exceed 1000 characters'),
    lineStart: z
      .number({ required_error: 'lineStart coordinate is required' })
      .int('lineStart must be an integer')
      .min(1, 'lineStart must be at least 1'),
    lineEnd: z
      .number({ required_error: 'lineEnd coordinate is required' })
      .int('lineEnd must be an integer')
      .min(1, 'lineEnd must be at least 1'),
    columnStart: z
      .number({ required_error: 'columnStart coordinate is required' })
      .int('columnStart must be an integer')
      .min(1, 'columnStart must be at least 1'),
    columnEnd: z
      .number({ required_error: 'columnEnd coordinate is required' })
      .int('columnEnd must be an integer')
      .min(1, 'columnEnd must be at least 1'),
    originalSnippet: z
      .string({ required_error: 'originalSnippet is required' })
      .max(2000, 'originalSnippet cannot exceed 2000 characters'),
    suggestedSnippet: z
      .string({ required_error: 'suggestedSnippet is required' })
      .max(2000, 'suggestedSnippet cannot exceed 2000 characters'),
    explanation: z
      .string({ required_error: 'explanation is required' })
      .max(2000, 'explanation cannot exceed 2000 characters')
  })
  .strict()
  .refine((data) => data.lineEnd >= data.lineStart, {
    message: 'lineEnd cannot be less than lineStart',
    path: ['lineEnd']
  })
  .refine(
    (data) => {
      if (data.lineStart === data.lineEnd) {
        return data.columnEnd >= data.columnStart;
      }
      return true;
    },
    {
      message: 'columnEnd cannot be less than columnStart on the same line',
      path: ['columnEnd']
    }
  );

/**
 * Category scores schema: All 4 scores required, zero fabricated defaults.
 * Decimals, negatives, values > 100, NaN, and Infinity are strictly rejected.
 */
export const geminiCategoryScoresSchema = z
  .object({
    bugScore: z
      .number({ required_error: 'bugScore is required' })
      .int('bugScore must be an integer')
      .min(0, 'bugScore cannot be less than 0')
      .max(100, 'bugScore cannot exceed 100'),
    securityScore: z
      .number({ required_error: 'securityScore is required' })
      .int('securityScore must be an integer')
      .min(0, 'securityScore cannot be less than 0')
      .max(100, 'securityScore cannot exceed 100'),
    performanceScore: z
      .number({ required_error: 'performanceScore is required' })
      .int('performanceScore must be an integer')
      .min(0, 'performanceScore cannot be less than 0')
      .max(100, 'performanceScore cannot exceed 100'),
    maintainabilityScore: z
      .number({ required_error: 'maintainabilityScore is required' })
      .int('maintainabilityScore must be an integer')
      .min(0, 'maintainabilityScore cannot be less than 0')
      .max(100, 'maintainabilityScore cannot exceed 100')
  })
  .strict();

/**
 * Strict schema for top-level Gemini AI analysis payload.
 * Any unexpected or hallucinated properties are rejected.
 */
export const geminiAnalysisOutputSchema = z
  .object({
    summary: z
      .string({ required_error: 'summary is required' })
      .trim()
      .min(20, 'Summary must be at least 20 characters')
      .max(1000, 'Summary cannot exceed 1000 characters'),
    timeComplexity: z
      .string({ required_error: 'timeComplexity is required' })
      .trim()
      .min(2, 'timeComplexity must be at least 2 characters')
      .max(50, 'timeComplexity cannot exceed 50 characters'),
    spaceComplexity: z
      .string({ required_error: 'spaceComplexity is required' })
      .trim()
      .min(2, 'spaceComplexity must be at least 2 characters')
      .max(50, 'spaceComplexity cannot exceed 50 characters'),
    categoryScores: geminiCategoryScoresSchema,
    suggestedCode: z
      .string({ required_error: 'suggestedCode is required' })
      .min(1, 'suggestedCode cannot be empty')
      .max(200000, 'suggestedCode exceeds 200 KB limit'),
    refactoringRationale: z
      .string({ required_error: 'refactoringRationale is required' })
      .trim()
      .min(20, 'refactoringRationale must be at least 20 characters')
      .max(3000, 'refactoringRationale cannot exceed 3000 characters'),
    issues: z
      .array(geminiIssueOutputSchema)
      .max(50, 'Cannot exceed 50 AI issues')
  })
  .strict();

/**
 * Factory function creating a source-aware Zod schema that validates
 * finding coordinates against the original source code line count and line lengths.
 *
 * Coordinate Convention:
 * - 1-indexed, half-open [columnStart, columnEnd) interval, consistent with Monaco Editor
 *   and Phase 7 static analysis LineMapper.
 * - columnEnd is exclusive; on a line of length L, the maximum valid columnEnd is L + 1.
 * - A point/cursor coordinate on line L satisfies columnStart === columnEnd.
 *
 * @param {string|number|object} [sourceCodeOrOptions] - Raw source code string, total line count, or options object
 * @returns {z.ZodEffects} Source-aware Zod schema
 */
export function createSourceAwareSchema(sourceCodeOrOptions) {
  let sourceCode = null;
  let sourceLineCount = null;

  if (typeof sourceCodeOrOptions === 'string') {
    sourceCode = sourceCodeOrOptions;
  } else if (
    typeof sourceCodeOrOptions === 'number' &&
    Number.isFinite(sourceCodeOrOptions) &&
    sourceCodeOrOptions >= 1
  ) {
    sourceLineCount = Math.floor(sourceCodeOrOptions);
  } else if (sourceCodeOrOptions && typeof sourceCodeOrOptions === 'object') {
    if (typeof sourceCodeOrOptions.sourceCode === 'string') {
      sourceCode = sourceCodeOrOptions.sourceCode;
    }
    if (
      typeof sourceCodeOrOptions.sourceLineCount === 'number' &&
      Number.isFinite(sourceCodeOrOptions.sourceLineCount) &&
      sourceCodeOrOptions.sourceLineCount >= 1
    ) {
      sourceLineCount = Math.floor(sourceCodeOrOptions.sourceLineCount);
    }
  }

  const lines = typeof sourceCode === 'string' ? sourceCode.split(/\r?\n/) : null;
  if (lines && sourceLineCount == null) {
    sourceLineCount = lines.length;
  }

  return geminiAnalysisOutputSchema.superRefine((data, ctx) => {
    if (!Array.isArray(data.issues)) return;

    for (let idx = 0; idx < data.issues.length; idx++) {
      const issue = data.issues[idx];

      // 1. Line bounds against total source line count
      if (sourceLineCount != null) {
        if (issue.lineStart > sourceLineCount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Issue at index ${idx} contains lineStart (${issue.lineStart}) exceeding total source line count (${sourceLineCount})`,
            path: ['issues', idx, 'lineStart']
          });
        }
        if (issue.lineEnd > sourceLineCount) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Issue at index ${idx} contains lineEnd (${issue.lineEnd}) exceeding total source line count (${sourceLineCount})`,
            path: ['issues', idx, 'lineEnd']
          });
        }
      }

      // 2. Column bounds against actual source line length
      // Consistent with Monaco Editor / LineMapper [start, end) exclusive boundary (maxCol = length + 1)
      if (lines) {
        if (issue.lineStart >= 1 && issue.lineStart <= lines.length) {
          const startLine = lines[issue.lineStart - 1];
          const maxStartCol = Math.max(1, startLine.length + 1);
          if (issue.columnStart > maxStartCol) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Issue at index ${idx} contains columnStart (${issue.columnStart}) exceeding line ${issue.lineStart} length (${startLine.length})`,
              path: ['issues', idx, 'columnStart']
            });
          }
        }

        if (issue.lineEnd >= 1 && issue.lineEnd <= lines.length) {
          const endLine = lines[issue.lineEnd - 1];
          const maxEndCol = Math.max(1, endLine.length + 1);
          if (issue.columnEnd > maxEndCol) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Issue at index ${idx} contains columnEnd (${issue.columnEnd}) exceeding line ${issue.lineEnd} length (${endLine.length})`,
              path: ['issues', idx, 'columnEnd']
            });
          }
        }
      }
    }
  });
}

/**
 * Validates AI-generated response against strict schema and source boundaries.
 * Computes the trusted weighted aiCompositeScore upon validation success.
 *
 * @param {unknown} parsedJson - Parsed JSON object from Gemini response
 * @param {string|number|object} [sourceCodeOrOptions] - Raw source code or line count
 * @returns {{ success: true, data: object } | { success: false, error: Error }}
 */
export function validateAiResponse(parsedJson, sourceCodeOrOptions) {
  if (!parsedJson || typeof parsedJson !== 'object') {
    const error = new Error('AI response validation failed: response must be a non-null object');
    error.name = 'AiResponseValidationError';
    error.details = [{ path: '', message: 'AI response must be a non-null object', code: 'invalid_type' }];
    return { success: false, error };
  }

  const schema = createSourceAwareSchema(sourceCodeOrOptions);
  const result = schema.safeParse(parsedJson);

  if (!result.success) {
    const safeDetails = result.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code
    }));

    const summaryMessage = safeDetails
      .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
      .join('; ');

    const error = new Error(`AI response validation failed: ${summaryMessage}`);
    error.name = 'AiResponseValidationError';
    error.details = safeDetails;
    return { success: false, error };
  }

  const data = result.data;
  const aiCompositeScore = calculateAiCompositeScore(data.categoryScores);

  return {
    success: true,
    data: {
      ...data,
      aiCompositeScore
    }
  };
}

export default {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  AI_SCORE_WEIGHTS,
  calculateAiCompositeScore,
  geminiIssueOutputSchema,
  geminiCategoryScoresSchema,
  geminiAnalysisOutputSchema,
  createSourceAwareSchema,
  validateAiResponse
};
