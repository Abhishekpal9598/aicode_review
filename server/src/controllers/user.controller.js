import { getDBStatus } from '../config/db.js';
import CodeReview from '../models/review.model.js';
import ReviewIssue from '../models/reviewIssue.model.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * GET /api/v1/users/stats
 * Aggregates dashboard telemetry for the authenticated user.
 * Strictly verifies database connectivity and enforces tenant isolation.
 */
export const getUserStats = asyncHandler(async (req, res) => {
  // 1. Verify database connectivity before querying
  const dbStatus = getDBStatus();
  if (!dbStatus.connected) {
    throw ApiError.serviceUnavailable(
      'Database service is currently unavailable. Please try again later.',
      'DATABASE_UNAVAILABLE'
    );
  }

  const userId = req.user._id;

  // 2. Query total reviews belonging strictly to the authenticated user
  const totalReviews = await CodeReview.countDocuments({ userId });

  // 3. Query recent reviews selecting ONLY genuine CodeReview database fields
  const recentReviews = await CodeReview.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('title language lineCount status createdAt');

  // 4. Calibrate performance bottlenecks in Phase 10 when reviews exist
  let performanceBottlenecks = null;
  if (totalReviews > 0) {
    performanceBottlenecks = await ReviewIssue.countDocuments({
      userId,
      category: 'performance',
      severity: { $in: ['CRITICAL', 'HIGH'] }
    });
  }

  // 5. Return standardized envelope matching ApiResponse.js
  return new ApiResponse(
    200,
    {
      overview: {
        totalReviews,
        averageQualityScore: null,     // Calibrates in Phase 8
        criticalSecurityIssues: null, // Calibrates in Phase 7 & 9
        performanceBottlenecks
      },
      scoreHistory: [],
      languageDistribution: [],
      recentReviews
    },
    'User statistics retrieved successfully.'
  ).send(res);
});

export default {
  getUserStats
};
