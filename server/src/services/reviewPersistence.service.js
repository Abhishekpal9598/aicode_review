/**
 * Review Persistence & Transaction Safety Service
 * server/src/services/reviewPersistence.service.js
 *
 * Implements atomic persistence for completed code reviews across diverse
 * deployment topologies (MongoDB Atlas / replica sets vs standalone MongoDB).
 *
 * Key Architectural Guarantees:
 * 1. Strict User Ownership: Every document (CodeReview, AnalysisResult, ReviewIssue)
 *    is explicitly bound to the authenticated user's ObjectId. Rejects cross-user references.
 * 2. Relationship Integrity: Pre-validates ObjectIds and structural contracts before database execution.
 * 3. Dual Atomicity Engines:
 *    - Replica Set / Atlas: Uses native multi-document MongoDB transactions (commit/abort).
 *    - Standalone MongoDB: Uses deterministic reverse compensating rollback tracking created IDs.
 * 4. Bounded Compensating Rollback: Rollback removes ONLY records created by the current operation,
 *    guaranteeing zero accidental deletion of pre-existing user records.
 * 5. Rollback Failure Quarantine: Catches rollback failures separately, preserving the primary root error
 *    and logging structured, sanitized alerts without leaking code or credentials.
 * 6. Bulk Validation: Enforces runValidators: true during ReviewIssue bulk insertion.
 * 7. Safe Error Normalization: Maps Mongoose/MongoDB errors to clean ApiError instances.
 */

import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';
import CodeReview from '../models/review.model.js';
import AnalysisResult from '../models/analysisResult.model.js';
import ReviewIssue from '../models/reviewIssue.model.js';
import { assertRelationalParentIntegrity, validateCandidateContent } from './hybridFusion.service.js';

/**
 * Normalizes internal MongoDB and Mongoose errors into safe, structured ApiErrors.
 *
 * @param {Error} err - Caught error
 * @returns {ApiError} Structured ApiError
 */
export function normalizePersistenceError(err) {
  if (err instanceof ApiError) return err;

  // MongoDB duplicate key error (E11000)
  if (err.code === 11000 || (typeof err.message === 'string' && err.message.includes('E11000'))) {
    return new ApiError(409, 'A review result already exists for this review', 'CONFLICT');
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message
    }));
    return new ApiError(400, `Database validation failed: ${err.message}`, 'VALIDATION_ERROR', details);
  }

  // Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid format for field ${err.path}`, 'INVALID_ID_FORMAT');
  }

  return new ApiError(500, `Failed to persist review records: ${err.message || 'Database error'}`, 'INTERNAL_SERVER_ERROR');
}

/**
 * Validates the persistence payload, authenticated userId, and relational boundaries.
 *
 * @param {object} params
 * @param {object} params.reviewData
 * @param {object} params.analysisData
 * @param {Array} params.issuesData
 * @param {string|mongoose.Types.ObjectId} params.userId - Authenticated user's ID
 * @returns {mongoose.Types.ObjectId} Validated safe userId
 */
export function validatePersistencePayload({ reviewData, analysisData, issuesData, userId }) {
  // 1. Authenticated userId validation
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'A valid authenticated userId is required for review persistence', 'INVALID_USER_ID');
  }
  const safeUserId = new mongoose.Types.ObjectId(userId);

  // 2. Validate reviewData structure
  if (!reviewData || typeof reviewData !== 'object' || Array.isArray(reviewData)) {
    throw new ApiError(400, 'reviewData must be a non-null object', 'VALIDATION_ERROR');
  }

  // Cross-user reference rejection: if an alien userId was supplied in reviewData, reject tampering
  if (reviewData.userId && reviewData.userId.toString() !== safeUserId.toString()) {
    throw new ApiError(403, 'Cross-user reference detected: reviewData.userId does not match authenticated user', 'FORBIDDEN');
  }

  // 3. Validate analysisData structure
  if (!analysisData || typeof analysisData !== 'object' || Array.isArray(analysisData)) {
    throw new ApiError(400, 'analysisData must be a non-null object', 'VALIDATION_ERROR');
  }

  if (analysisData.userId && analysisData.userId.toString() !== safeUserId.toString()) {
    throw new ApiError(403, 'Cross-user reference detected: analysisData.userId does not match authenticated user', 'FORBIDDEN');
  }

  // 4. Validate issuesData structure
  if (!Array.isArray(issuesData)) {
    throw new ApiError(400, 'issuesData must be an array of review findings', 'VALIDATION_ERROR');
  }

  for (let idx = 0; idx < issuesData.length; idx++) {
    const issue = issuesData[idx];
    if (!issue || typeof issue !== 'object') {
      throw new ApiError(400, `Issue at index ${idx} must be a valid object`, 'VALIDATION_ERROR');
    }
    if (issue.userId && issue.userId.toString() !== safeUserId.toString()) {
      throw new ApiError(403, `Cross-user reference detected: issue at index ${idx} does not match authenticated user`, 'FORBIDDEN');
    }
  }

  return safeUserId;
}

/**
 * Persists CodeReview, AnalysisResult, and ReviewIssue atomically.
 * Automatically selects between replica-set transactions and standalone compensating rollback.
 *
 * @param {object} payload
 * @param {object} payload.reviewData - CodeReview fields
 * @param {object} payload.analysisData - AnalysisResult fields
 * @param {Array} payload.issuesData - Array of ReviewIssue finding fields
 * @param {string|mongoose.Types.ObjectId} payload.userId - Authenticated user ID
 * @param {object} [options={}] - Execution options
 * @param {boolean} [options.forceStandalone=false] - Force standalone compensating rollback mode
 * @param {boolean} [options.useTransactions] - Explicit transaction flag
 * @param {object} [options.mockSession] - Injected session for transaction testing
 * @param {boolean} [options.simulateRollbackError=false] - Simulate rollback failure for test verification
 * @returns {Promise<{ review: object, analysis: object, issues: Array }>}
 */
export async function persistReviewAtomic({ reviewData, analysisData, issuesData, userId }, options = {}) {
  // 1. Connection Health Guard
  if (mongoose.connection.readyState !== 1) {
    throw new ApiError(503, 'Database service is currently unavailable', 'DATABASE_UNAVAILABLE');
  }

  // 2. Pre-Persistence Validation & Ownership Verification
  const safeUserId = validatePersistencePayload({ reviewData, analysisData, issuesData, userId });

  // Bind authenticated user ownership to root document
  const safeReviewData = {
    ...reviewData,
    userId: safeUserId
  };

  // 3. Determine Transaction Capability
  let session = null;
  let useTransactions = false;

  const topologyType = mongoose.connection.client?.topology?.description?.type;
  const isReplicaOrSharded = topologyType ? (topologyType !== 'Single' && topologyType !== 'Unknown') : false;
  const allowTransactions = options.useTransactions === true || (options.useTransactions !== false && !options.forceStandalone && isReplicaOrSharded);

  if (options.mockSession) {
    session = options.mockSession;
    useTransactions = true;
  } else if (allowTransactions) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransactions = true;
    } catch (sessionErr) {
      if (session) {
        try {
          await session.endSession();
        } catch {}
        session = null;
      }
      useTransactions = false;
      logger.debug(`Multi-document transactions unavailable: ${sessionErr.message}. Falling back to compensating rollback.`);
    }
  }

  // ===========================================================================
  // PATH A: TRANSACTIONAL PERSISTENCE (Replica Sets / MongoDB Atlas)
  // ===========================================================================
  if (useTransactions && session) {
    try {
      // 1. Persist CodeReview
      const [review] = await CodeReview.create([safeReviewData], { session });

      // 2. Persist AnalysisResult linked to review._id
      const [analysis] = await AnalysisResult.create(
        [
          {
            ...analysisData,
            reviewId: review._id,
            userId: safeUserId
          }
        ],
        { session }
      );

      // 3. Persist ReviewIssues with runValidators: true
      const expectedParents = {
        reviewId: review._id,
        analysisResultId: analysis._id,
        userId: safeUserId
      };

      const issuesToInsert = issuesData.map((issue) => ({
        ...issue,
        reviewId: review._id,
        analysisResultId: analysis._id,
        userId: safeUserId
      }));

      // Assert relational parent integrity (aborts transaction if any parent ID is invalid or mismatched)
      assertRelationalParentIntegrity(issuesToInsert, expectedParents);

      let issues = [];
      if (issuesToInsert.length > 0) {
        issues = await ReviewIssue.insertMany(issuesToInsert, {
          session,
          ordered: true,
          runValidators: true
        });
      }

      await session.commitTransaction();
      return { review, analysis, issues };
    } catch (txError) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        logger.warn(`Failed to abort transaction cleanly: ${abortErr.message}`);
      }
      logger.error('Transaction aborted during review persistence', { error: txError.message });
      throw normalizePersistenceError(txError);
    } finally {
      try {
        await session.endSession();
      } catch {}
    }
  }

  // ===========================================================================
  // PATH B: STANDALONE COMPENSATING ROLLBACK (Local / Standalone Deployments)
  // ===========================================================================
  const createdDocs = {
    reviewId: null,
    analysisResultId: null,
    issueIds: []
  };

  try {
    // 1. Persist CodeReview
    const review = await CodeReview.create(safeReviewData);
    createdDocs.reviewId = review._id;

    // 2. Persist AnalysisResult
    const analysis = await AnalysisResult.create({
      ...analysisData,
      reviewId: review._id,
      userId: safeUserId
    });
    createdDocs.analysisResultId = analysis._id;

    // 3. Persist ReviewIssues with runValidators: true
    const expectedParents = {
      reviewId: review._id,
      analysisResultId: analysis._id,
      userId: safeUserId
    };

    const issuesToInsert = issuesData.map((issue) => ({
      ...issue,
      reviewId: review._id,
      analysisResultId: analysis._id,
      userId: safeUserId
    }));

    // Assert relational parent integrity (aborts persistence and triggers compensating rollback if invalid)
    assertRelationalParentIntegrity(issuesToInsert, expectedParents);

    let issues = [];
    if (issuesToInsert.length > 0) {
      issues = await ReviewIssue.insertMany(issuesToInsert, {
        ordered: true,
        runValidators: true
      });
      createdDocs.issueIds = issues.map((i) => i._id);
    }

    return { review, analysis, issues };
  } catch (stageError) {
    logger.warn('Review persistence stage failed. Initiating compensating rollback...', {
      failedStageError: stageError.message,
      trackedReviewId: createdDocs.reviewId ? createdDocs.reviewId.toString() : null
    });

    // 4. Reverse Compensating Rollback (Only delete tracked records from THIS operation)
    try {
      if (options.simulateRollbackError) {
        throw new Error('Simulated failure during compensating rollback execution');
      }

      // Rollback ReviewIssues
      if (createdDocs.issueIds.length > 0) {
        await ReviewIssue.deleteMany({ _id: { $in: createdDocs.issueIds } });
      } else if (createdDocs.reviewId) {
        // Fallback cleanup in case partial batch occurred before error
        await ReviewIssue.deleteMany({ reviewId: createdDocs.reviewId });
      }

      // Rollback AnalysisResult
      if (createdDocs.analysisResultId) {
        await AnalysisResult.findByIdAndDelete(createdDocs.analysisResultId);
      }

      // Rollback CodeReview
      if (createdDocs.reviewId) {
        await CodeReview.findByIdAndDelete(createdDocs.reviewId);
      }

      logger.info('Compensating rollback completed successfully. All created documents cleaned up.');
    } catch (rollbackError) {
      // 5. Separate Rollback Failure Alert (Confidentiality Guaranteed: IDs only, no secrets or code)
      logger.error('CRITICAL_ROLLBACK_FAILURE: Compensating rollback failed to clean up records', {
        primaryError: stageError.message,
        rollbackError: rollbackError.message,
        trackedIds: {
          reviewId: createdDocs.reviewId ? createdDocs.reviewId.toString() : null,
          analysisResultId: createdDocs.analysisResultId ? createdDocs.analysisResultId.toString() : null,
          issueCount: createdDocs.issueIds.length
        },
        timestamp: new Date().toISOString()
      });
    }

    // Always preserve and rethrow the primary root error
    throw normalizePersistenceError(stageError);
  }
}

export default {
  normalizePersistenceError,
  validatePersistencePayload,
  persistReviewAtomic
};
