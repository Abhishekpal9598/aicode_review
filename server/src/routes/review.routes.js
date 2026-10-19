/**
 * Review Routes
 * server/src/routes/review.routes.js
 *
 * Routes for persistent code reviews:
 * - POST /api/v1/reviews (createReview)
 * - GET /api/v1/reviews (getReviews)
 * - GET /api/v1/reviews/:id (getReviewById)
 * - DELETE /api/v1/reviews/:id (deleteReview)
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { reviewLimiter } from '../middleware/rateLimit.middleware.js';
import * as reviewController from '../controllers/review.controller.js';
import {
  createReviewSchema,
  listReviewsSchema,
  getReviewByIdSchema,
  deleteReviewSchema,
  getSecurityReviewSchema,
  getPerformanceReviewSchema,
  applyFixSchema,
  undoFixSchema,
  exportReviewSchema
} from '../schemas/review.schema.js';

const router = Router();

// Enforce authentication on all review routes
router.use(authenticate);

// POST /api/v1/reviews — Execute review and persist results atomically
router.post(
  '/',
  reviewLimiter,
  validate(createReviewSchema),
  reviewController.createReview
);

// GET /api/v1/reviews — Retrieve paginated user review history
router.get(
  '/',
  validate(listReviewsSchema),
  reviewController.getReviews
);

// GET /api/v1/reviews/:id/security — Retrieve dedicated security analysis
router.get(
  '/:id/security',
  validate(getSecurityReviewSchema),
  reviewController.getSecurityReview
);

// GET /api/v1/reviews/:id/performance — Retrieve dedicated performance analysis
router.get(
  '/:id/performance',
  validate(getPerformanceReviewSchema),
  reviewController.getPerformanceReview
);

// POST /api/v1/reviews/:id/apply-fix — Persist applied fix to review while preserving rawCode
router.post(
  '/:id/apply-fix',
  validate(applyFixSchema),
  reviewController.applyFix
);

// POST /api/v1/reviews/:id/undo-fix — Revert applied fix on review while preserving rawCode
router.post(
  '/:id/undo-fix',
  validate(undoFixSchema),
  reviewController.undoFix
);

// GET /api/v1/reviews/:id/export — Export review report as JSON or Markdown
router.get(
  '/:id/export',
  validate(exportReviewSchema),
  reviewController.exportReview
);

// GET /api/v1/reviews/:id — Retrieve full deep-dive review inspection
router.get(
  '/:id',
  validate(getReviewByIdSchema),
  reviewController.getReviewById
);

// DELETE /api/v1/reviews/:id — Cascade delete review and child records
router.delete(
  '/:id',
  validate(deleteReviewSchema),
  reviewController.deleteReview
);

export default router;

