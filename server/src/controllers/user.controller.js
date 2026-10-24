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

  // 2. Query total reviews and recent reviews concurrently
  const [totalReviews, recentReviews] = await Promise.all([
    CodeReview.countDocuments({ userId }),
    CodeReview.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title language lineCount status createdAt')
  ]);

  // 3. Calculate genuine user telemetry when reviews exist
  let performanceBottlenecks = null;
  let criticalSecurityIssues = null;
  let averageQualityScore = null;
  let languageDistribution = [];

  if (totalReviews > 0) {
    const [perfCount, secCount, avgResult, langStats] = await Promise.all([
      ReviewIssue.countDocuments({
        userId,
        category: 'performance',
        severity: { $in: ['CRITICAL', 'HIGH'] }
      }),
      ReviewIssue.countDocuments({
        userId,
        category: 'security',
        severity: { $in: ['CRITICAL', 'HIGH'] }
      }),
      CodeReview.aggregate([
        { $match: { userId, staticScore: { $ne: null } } },
        { $group: { _id: null, avgScore: { $avg: '$staticScore' } } }
      ]),
      CodeReview.aggregate([
        { $match: { userId } },
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $project: { _id: 0, language: '$_id', count: 1 } },
        { $sort: { count: -1 } }
      ])
    ]);

    performanceBottlenecks = perfCount;
    criticalSecurityIssues = secCount;

    if (avgResult.length > 0 && typeof avgResult[0].avgScore === 'number') {
      averageQualityScore = Math.round(avgResult[0].avgScore);
    }

    languageDistribution = langStats;
  }

  // 5. Return standardized envelope matching ApiResponse.js
  return new ApiResponse(
    200,
    {
      overview: {
        totalReviews,
        averageQualityScore,
        criticalSecurityIssues,
        performanceBottlenecks
      },
      scoreHistory: [],
      languageDistribution,
      recentReviews
    },
    'User statistics retrieved successfully.'
  ).send(res);
});

export default {
  getUserStats
};
