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

export default {
  createReview,
  getReviews,
  getReviewById,
  getSecurityReview,
  deleteReview
};
