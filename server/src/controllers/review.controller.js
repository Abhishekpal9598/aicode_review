/**
 * Review Controller
 * server/src/controllers/review.controller.js
 *
 * Request handlers for persistent review endpoints:
 * - POST /api/v1/reviews (createReview)
 * - GET /api/v1/reviews (getReviews)
 * - GET /api/v1/reviews/:id (getReviewById)
 * - DELETE /api/v1/reviews/:id (deleteReview)
 */

import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import * as reviewService from '../services/review.service.js';
import * as reportExportService from '../services/reportExport.service.js';

/**
 * Executes a full code review with dual-engine evaluation and atomic persistence.
 * POST /api/v1/reviews
 */
export const createReview = asyncHandler(async (req, res) => {
  const { code, language, title, fileName, sourceType } = req.body;
  const userId = req.userId;

  const result = await reviewService.executeReview({
    code,
    language,
    title,
    fileName,
    sourceType,
    userId
  });

  return new ApiResponse(
    201,
    result,
    'Code review completed and persisted successfully'
  ).send(res);
});

/**
 * Retrieves paginated code review history for the authenticated user.
 * GET /api/v1/reviews
 */
export const getReviews = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const result = await reviewService.getUserReviews(userId, req.query);

  return new ApiResponse(
    200,
    result.items,
    'User reviews retrieved successfully',
    result.pagination
  ).send(res);
});

/**
 * Retrieves deep-dive review details strictly scoped to the authenticated user.
 * GET /api/v1/reviews/:id
 */
export const getReviewById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const result = await reviewService.getReviewById(id, userId);
  if (!result) {
    throw ApiError.notFound('Review not found', 'NOT_FOUND');
  }

  return new ApiResponse(
    200,
    result,
    'Review details retrieved successfully'
  ).send(res);
});

/**
 * Retrieves dedicated security analysis details strictly scoped to the authenticated user.
 * GET /api/v1/reviews/:id/security
 */
export const getSecurityReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const result = await reviewService.getSecurityReview(id, userId, req.query);
  if (!result) {
    throw ApiError.notFound('Review not found', 'NOT_FOUND');
  }

  return new ApiResponse(
    200,
    result,
    'Security analysis retrieved successfully'
  ).send(res);
});

/**
 * Retrieves dedicated performance analysis details strictly scoped to the authenticated user.
 * GET /api/v1/reviews/:id/performance
 */
export const getPerformanceReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const result = await reviewService.getPerformanceReview(id, userId, req.query);
  if (!result) {
    throw ApiError.notFound('Review not found', 'NOT_FOUND');
  }

  return new ApiResponse(
    200,
    result,
    'Performance analysis retrieved successfully'
  ).send(res);
});

/**
 * Cascade-deletes a review and its child analysis & issues records.
 * DELETE /api/v1/reviews/:id
 */
export const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const deleted = await reviewService.deleteReview(id, userId);
  if (!deleted) {
    throw ApiError.notFound('Review not found', 'NOT_FOUND');
  }

  return new ApiResponse(
    200,
    null,
    'Review and associated analysis records deleted successfully'
  ).send(res);
});

/**
 * Persists an applied fix to an existing review record while preserving rawCode.
 * POST /api/v1/reviews/:id/apply-fix
 */
export const applyFix = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const result = await reviewService.applyFixToReview(id, userId, req.body);
  if (!result) {
    throw ApiError.notFound('Review not found', 'NOT_FOUND');
  }

  return new ApiResponse(
    200,
    result,
    'Fix applied successfully and persisted to review history'
  ).send(res);
});

/**
 * Undoes the most recently applied fix on an existing review.
 * POST /api/v1/reviews/:id/undo-fix
 */
export const undoFix = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const result = await reviewService.undoFixOnReview(id, userId, req.body);
  if (!result) {
    throw ApiError.notFound('Review not found', 'NOT_FOUND');
  }

  return new ApiResponse(
    200,
    result,
    'Applied fix undone successfully'
  ).send(res);
});

/**
 * Exports an audit report for a review as structured JSON or GitHub-Flavored Markdown.
 * GET /api/v1/reviews/:id/export?format=json|markdown
 */
export const exportReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const format = (req.query.format || 'json').toLowerCase();
  const userId = req.userId;

  const exportData = await reportExportService.generateReviewExport(id, userId, format);
  if (!exportData) {
    throw ApiError.notFound('Review not found', 'NOT_FOUND');
  }

  const filenameSafeTitle = (exportData.title || 'review')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50);

  if (format === 'markdown') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-report-${filenameSafeTitle}-${id}.md"`
    );
    return res.status(200).send(exportData.content);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="audit-report-${filenameSafeTitle}-${id}.json"`
  );
  return res.status(200).json(exportData.data);
});

export default {
  createReview,
  getReviews,
  getReviewById,
  getSecurityReview,
  getPerformanceReview,
  applyFix,
  undoFix,
  deleteReview,
  exportReview
};

