/**
 * Unit & Integration Tests for Review Persistence & Transaction Safety Service
 * server/tests/reviewPersistence.test.js
 *
 * Verifies Phase 8 Step 6 specifications:
 * 1. Successful persistence of one review and analysis result.
 * 2. Successful persistence of multiple review issues with relational integrity.
 * 3. Correct userId assignment across all persisted documents (tenant isolation).
 * 4. Invalid userId ObjectId rejection (INVALID_USER_ID, 400).
 * 5. Cross-user reference rejection (differing userIds trigger 403 FORBIDDEN).
 * 6. Transaction success (using mock session commit and resource cleanup).
 * 7. Transaction failure and abort (aborts transaction and normalizes error).
 * 8. Standalone database compensating rollback (forces standalone mode; cleans up partial records).
 * 9. Rollback failure logging without sensitive data (CRITICAL_ROLLBACK_FAILURE alert).
 * 10. Bulk insert validation (runValidators: true rejects invalid issues and rolls back).
 * 11. Duplicate review handling (duplicate reviewId on AnalysisResult triggers 409 CONFLICT).
 * 12. No orphaned records after successful rollback.
 * 13. No deletion of pre-existing records during compensating rollback.
 */

import test, { describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';
import {
  persistReviewAtomic,
  validatePersistencePayload,
  normalizePersistenceError
} from '../src/services/reviewPersistence.service.js';
import ApiError from '../src/utils/ApiError.js';
import logger from '../src/utils/logger.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';

let primaryUser;
let secondaryUser;

const sampleReviewData = () => ({
  title: 'Binary Search Implementation',
  sourceType: 'pasted',
  filename: 'binary_search.py',
  language: 'python',
  rawCode: 'def binary_search(arr, x):\n    low = 0\n    high = len(arr) - 1\n    return -1\n',
  lineCount: 4,
  characterCount: 65,
  fileSizeBytes: 65,
  status: 'completed',
  reviewMode: 'hybrid',
  staticScore: 85
});

const sampleAnalysisData = () => ({
  overallScore: 82,
  grade: 'B',
  staticScore: 85,
  aiAvailable: true,
  summary: 'Code has clean structure with low algorithmic complexity.',
  metrics: {
    bugScore: 85,
    securityScore: 90,
    performanceScore: 80,
    maintainabilityScore: 75,
    aiCompositeScore: 83,
    staticDeductions: 15,
    issueCounts: {
      critical: 0,
      high: 0,
      medium: 1,
      low: 1,
      info: 0
    }
  },
  timeComplexity: 'O(log n)',
  spaceComplexity: 'O(1)',
  suggestedCode: 'def binary_search(arr, x):\n    return bisect_left(arr, x)\n',
  refactoringRationale: 'Leverage standard library for optimal edge case handling.',
  executionTimeMs: 450
});

const sampleIssuesData = () => [
  {
    category: 'performance',
    severity: 'MEDIUM',
    title: 'Suboptimal loop initialization',
    description: 'Loop initialization can be streamlined using tuple unpacking.',
    lineStart: 2,
    lineEnd: 3,
    columnStart: 5,
    columnEnd: 15,
    originalSnippet: 'low = 0\nhigh = len(arr) - 1',
    suggestedSnippet: 'low, high = 0, len(arr) - 1',
    explanation: 'Tuple unpacking is more concise in Python.',
    ruleId: 'PERF-PY-002',
    source: 'gemini'
  },
  {
    category: 'maintainability',
    severity: 'LOW',
    title: 'Missing type annotations',
    description: 'Function signature lacks explicit type hints.',
    lineStart: 1,
    lineEnd: 1,
    columnStart: 1,
    columnEnd: 27,
    originalSnippet: 'def binary_search(arr, x):',
    suggestedSnippet: 'def binary_search(arr: list[int], x: int) -> int:',
    explanation: 'Type hints improve code documentation and tooling support.',
    ruleId: null,
    source: 'gemini'
  }
];

describe('Phase 8 — Step 6: Review Persistence & Transaction Safety', () => {
  before(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_DB_URI);
    }

    primaryUser = await User.create({
      name: 'Persistence Primary Dev',
      email: `persistence_primary_${Date.now()}@test.dev`,
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr'
    });

    secondaryUser = await User.create({
      name: 'Persistence Alien Dev',
      email: `persistence_alien_${Date.now()}@test.dev`,
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr'
    });
  });

  after(async () => {
    if (primaryUser) {
      await ReviewIssue.deleteMany({ userId: primaryUser._id });
      await AnalysisResult.deleteMany({ userId: primaryUser._id });
      await CodeReview.deleteMany({ userId: primaryUser._id });
      await User.findByIdAndDelete(primaryUser._id);
    }
    if (secondaryUser) {
      await ReviewIssue.deleteMany({ userId: secondaryUser._id });
      await AnalysisResult.deleteMany({ userId: secondaryUser._id });
      await CodeReview.deleteMany({ userId: secondaryUser._id });
      await User.findByIdAndDelete(secondaryUser._id);
    }
    await mongoose.disconnect();
  });

  // -------------------------------------------------------------------------
  // 1. Successful persistence of one review and analysis result
  // -------------------------------------------------------------------------
  test('1. Successful persistence of one review and analysis result (0 issues)', async () => {
    const payload = {
      reviewData: sampleReviewData(),
      analysisData: sampleAnalysisData(),
      issuesData: [],
      userId: primaryUser._id
    };

    const result = await persistReviewAtomic(payload);

    assert.ok(result.review, 'Result must contain review object');
    assert.ok(result.analysis, 'Result must contain analysis object');
    assert.equal(result.issues.length, 0, 'Issues array should be empty');

    // Confirm in DB
    const persistedReview = await CodeReview.findById(result.review._id);
    const persistedAnalysis = await AnalysisResult.findOne({ reviewId: result.review._id });

    assert.ok(persistedReview, 'CodeReview should exist in database');
    assert.equal(persistedReview.title, 'Binary Search Implementation');
    assert.ok(persistedAnalysis, 'AnalysisResult should exist in database');
    assert.equal(persistedAnalysis.overallScore, 82);
    assert.equal(persistedAnalysis.reviewId.toString(), persistedReview._id.toString());
  });

  // -------------------------------------------------------------------------
  // 2. Successful persistence of multiple review issues
  // -------------------------------------------------------------------------
  test('2. Successful persistence of multiple review issues with relational integrity', async () => {
    const payload = {
      reviewData: sampleReviewData(),
      analysisData: sampleAnalysisData(),
      issuesData: sampleIssuesData(),
      userId: primaryUser._id
    };

    const result = await persistReviewAtomic(payload);

    assert.ok(result.review._id);
    assert.ok(result.analysis._id);
    assert.equal(result.issues.length, 2);

    // Verify relations in DB
    const dbIssues = await ReviewIssue.find({ reviewId: result.review._id });
    assert.equal(dbIssues.length, 2);
    for (const issue of dbIssues) {
      assert.equal(issue.reviewId.toString(), result.review._id.toString());
      assert.equal(issue.analysisResultId.toString(), result.analysis._id.toString());
      assert.equal(issue.userId.toString(), primaryUser._id.toString());
    }
  });

  // -------------------------------------------------------------------------
  // 3. Correct userId assignment across all documents
  // -------------------------------------------------------------------------
  test('3. Enforces userId assignment across all persisted documents', async () => {
    const payload = {
      reviewData: sampleReviewData(),
      analysisData: sampleAnalysisData(),
      issuesData: sampleIssuesData(),
      userId: primaryUser._id
    };

    const result = await persistReviewAtomic(payload);

    assert.equal(result.review.userId.toString(), primaryUser._id.toString());
    assert.equal(result.analysis.userId.toString(), primaryUser._id.toString());
    for (const issue of result.issues) {
      assert.equal(issue.userId.toString(), primaryUser._id.toString());
    }
  });

  // -------------------------------------------------------------------------
  // 4. Invalid userId ObjectId rejection
  // -------------------------------------------------------------------------
  test('4. Rejects invalid userId ObjectId with 400 INVALID_USER_ID', async () => {
    const invalidIds = ['not-an-id', '12345', null, undefined, {}];

    for (const badId of invalidIds) {
      await assert.rejects(
        async () => {
          await persistReviewAtomic({
            reviewData: sampleReviewData(),
            analysisData: sampleAnalysisData(),
            issuesData: [],
            userId: badId
          });
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'INVALID_USER_ID');
          return true;
        }
      );
    }
  });

  // -------------------------------------------------------------------------
  // 5. Cross-user reference rejection
  // -------------------------------------------------------------------------
  test('5. Rejects cross-user reference tampering in reviewData, analysisData, or issuesData', async () => {
    // 5a. Tampering in reviewData
    await assert.rejects(
      async () => {
        await persistReviewAtomic({
          reviewData: { ...sampleReviewData(), userId: secondaryUser._id },
          analysisData: sampleAnalysisData(),
          issuesData: [],
          userId: primaryUser._id
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FORBIDDEN');
        assert.match(err.message, /Cross-user reference detected/i);
        return true;
      }
    );

    // 5b. Tampering in analysisData
    await assert.rejects(
      async () => {
        await persistReviewAtomic({
          reviewData: sampleReviewData(),
          analysisData: { ...sampleAnalysisData(), userId: secondaryUser._id },
          issuesData: [],
          userId: primaryUser._id
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FORBIDDEN');
        assert.match(err.message, /Cross-user reference detected/i);
        return true;
      }
    );

    // 5c. Tampering in issuesData
    await assert.rejects(
      async () => {
        const issues = sampleIssuesData();
        issues[0].userId = secondaryUser._id;
        await persistReviewAtomic({
          reviewData: sampleReviewData(),
          analysisData: sampleAnalysisData(),
          issuesData: issues,
          userId: primaryUser._id
        });
      },
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'FORBIDDEN');
        assert.match(err.message, /Cross-user reference detected/i);
        return true;
      }
    );
  });

  // -------------------------------------------------------------------------
  // 6. Transaction success (using mock session commit)
  // -------------------------------------------------------------------------
  test('6. Executes transactional persistence committing session when transactions are supported', async () => {
    let commitCalled = false;
    let abortCalled = false;
    let endSessionCalled = false;

    const mockSession = {
      commitTransaction: async () => { commitCalled = true; },
      abortTransaction: async () => { abortCalled = true; },
      endSession: async () => { endSessionCalled = true; }
    };

    // Mock Mongoose model operations to avoid talking to standalone server inside transaction
    const expectedReviewId = new mongoose.Types.ObjectId();
    const expectedAnalysisId = new mongoose.Types.ObjectId();

    mock.method(CodeReview, 'create', async (docs) => {
      return [{ ...docs[0], _id: expectedReviewId }];
    });
    mock.method(AnalysisResult, 'create', async (docs) => {
      return [{ ...docs[0], _id: expectedAnalysisId }];
    });
    mock.method(ReviewIssue, 'insertMany', async (docs) => {
      return docs.map((d) => ({ ...d, _id: new mongoose.Types.ObjectId() }));
    });

    try {
      const result = await persistReviewAtomic(
        {
          reviewData: sampleReviewData(),
          analysisData: sampleAnalysisData(),
          issuesData: sampleIssuesData(),
          userId: primaryUser._id
        },
        { mockSession }
      );

      assert.ok(result.review);
      assert.equal(result.review._id.toString(), expectedReviewId.toString());
      assert.equal(commitCalled, true, 'commitTransaction must be called on success');
      assert.equal(abortCalled, false, 'abortTransaction must not be called on success');
      assert.equal(endSessionCalled, true, 'endSession must always be called in finally');
    } finally {
      mock.reset();
    }
  });

  // -------------------------------------------------------------------------
  // 7. Transaction failure and abort
  // -------------------------------------------------------------------------
  test('7. Aborts transaction and normalizes error when transactional stage fails', async () => {
    let commitCalled = false;
    let abortCalled = false;
    let endSessionCalled = false;

    const mockSession = {
      commitTransaction: async () => { commitCalled = true; },
      abortTransaction: async () => { abortCalled = true; },
      endSession: async () => { endSessionCalled = true; }
    };

    mock.method(CodeReview, 'create', async (docs) => {
      return [{ ...docs[0], _id: new mongoose.Types.ObjectId() }];
    });
    mock.method(AnalysisResult, 'create', async () => {
      throw new Error('Simulated transactional failure at AnalysisResult stage');
    });

    try {
      await assert.rejects(
        async () => {
          await persistReviewAtomic(
            {
              reviewData: sampleReviewData(),
              analysisData: sampleAnalysisData(),
              issuesData: [],
              userId: primaryUser._id
            },
            { mockSession }
          );
        },
        (err) => {
          assert.equal(err.statusCode, 500);
          assert.equal(err.code, 'INTERNAL_SERVER_ERROR');
          return true;
        }
      );

      assert.equal(commitCalled, false, 'commitTransaction must not be called on failure');
      assert.equal(abortCalled, true, 'abortTransaction must be called on failure');
      assert.equal(endSessionCalled, true, 'endSession must always be called in finally');
    } finally {
      mock.reset();
    }
  });

  // -------------------------------------------------------------------------
  // 8. Standalone database compensating rollback
  // -------------------------------------------------------------------------
  test('8. Compensating rollback cleans up CodeReview when AnalysisResult stage fails', async () => {
    let createdReviewId = null;

    // We make AnalysisResult fail by passing invalid required fields (e.g. missing overallScore)
    const invalidAnalysis = sampleAnalysisData();
    delete invalidAnalysis.overallScore;

    // Spy on CodeReview.create to record the reviewId created before the failure
    const origCreate = CodeReview.create.bind(CodeReview);
    mock.method(CodeReview, 'create', async (...args) => {
      const review = await origCreate(...args);
      createdReviewId = review._id;
      return review;
    });

    try {
      await assert.rejects(
        async () => {
          await persistReviewAtomic(
            {
              reviewData: sampleReviewData(),
              analysisData: invalidAnalysis,
              issuesData: [],
              userId: primaryUser._id
            },
            { forceStandalone: true }
          );
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'VALIDATION_ERROR');
          return true;
        }
      );

      assert.ok(createdReviewId, 'CodeReview was temporarily created before stage 2 failed');

      // Verify compensating rollback deleted the created review
      const reviewInDb = await CodeReview.findById(createdReviewId);
      assert.equal(reviewInDb, null, 'CodeReview must be cleaned up by compensating rollback');

      const analysisInDb = await AnalysisResult.findOne({ reviewId: createdReviewId });
      assert.equal(analysisInDb, null, 'AnalysisResult must not exist');
    } finally {
      mock.reset();
    }
  });

  // -------------------------------------------------------------------------
  // 9. Rollback failure logging without sensitive data
  // -------------------------------------------------------------------------
  test('9. Handles and logs rollback failure separately without leaking code or secrets', async () => {
    let errorLogCalled = false;
    let loggedMetadata = null;

    const originalLoggerError = logger.error.bind(logger);
    mock.method(logger, 'error', (msg, meta) => {
      if (typeof msg === 'string' && msg.includes('CRITICAL_ROLLBACK_FAILURE')) {
        errorLogCalled = true;
        loggedMetadata = meta;
      }
      return originalLoggerError(msg, meta);
    });

    const invalidAnalysis = sampleAnalysisData();
    delete invalidAnalysis.overallScore;

    try {
      await assert.rejects(
        async () => {
          await persistReviewAtomic(
            {
              reviewData: sampleReviewData(),
              analysisData: invalidAnalysis,
              issuesData: [],
              userId: primaryUser._id
            },
            { forceStandalone: true, simulateRollbackError: true }
          );
        },
        (err) => {
          // Primary error must still be preserved and rethrown!
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'VALIDATION_ERROR');
          return true;
        }
      );

      assert.equal(errorLogCalled, true, 'Must log CRITICAL_ROLLBACK_FAILURE');
      assert.ok(loggedMetadata, 'Metadata must be logged');
      assert.ok(loggedMetadata.trackedIds, 'Must track document IDs');
      assert.ok(loggedMetadata.primaryError, 'Must log primary error message');
      // Ensure zero source code or raw secrets in log metadata
      const serializedMeta = JSON.stringify(loggedMetadata);
      assert.equal(serializedMeta.includes('binary_search'), false, 'Log metadata must not leak source code');
      assert.equal(serializedMeta.includes('passwordHash'), false, 'Log metadata must not leak credentials');
    } finally {
      mock.reset();
    }
  });

  // -------------------------------------------------------------------------
  // 10. Bulk insert validation (runValidators: true rejects invalid issues)
  // -------------------------------------------------------------------------
  test('10. Enforces runValidators: true on bulk issues and triggers rollback on validation failure', async () => {
    let createdReviewId = null;

    const origCreate = CodeReview.create.bind(CodeReview);
    mock.method(CodeReview, 'create', async (...args) => {
      const review = await origCreate(...args);
      createdReviewId = review._id;
      return review;
    });

    // Provide an invalid issue (severity not in enum)
    const invalidIssues = [
      {
        category: 'bug',
        severity: 'CATASTROPHIC_EXPLOSION', // Invalid enum value!
        title: 'Fatal logic bug',
        description: 'Logic error in algorithm.',
        lineStart: 1,
        lineEnd: 2,
        columnStart: 1,
        columnEnd: 10,
        originalSnippet: 'def test():',
        suggestedSnippet: 'def test():',
        explanation: 'Fix error',
        source: 'gemini'
      }
    ];

    try {
      await assert.rejects(
        async () => {
          await persistReviewAtomic(
            {
              reviewData: sampleReviewData(),
              analysisData: sampleAnalysisData(),
              issuesData: invalidIssues,
              userId: primaryUser._id
            },
            { forceStandalone: true }
          );
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, 'VALIDATION_ERROR');
          return true;
        }
      );

      assert.ok(createdReviewId, 'CodeReview was created prior to issue validation failure');

      // Compensating rollback must clean up review and analysis
      const reviewInDb = await CodeReview.findById(createdReviewId);
      assert.equal(reviewInDb, null, 'CodeReview must be cleaned up after issue validation failure');

      const analysisInDb = await AnalysisResult.findOne({ reviewId: createdReviewId });
      assert.equal(analysisInDb, null, 'AnalysisResult must be cleaned up after issue validation failure');

      const issuesInDb = await ReviewIssue.find({ reviewId: createdReviewId });
      assert.equal(issuesInDb.length, 0, 'No ReviewIssue records should remain');
    } finally {
      mock.reset();
    }
  });

  // -------------------------------------------------------------------------
  // 11. Duplicate review handling (duplicate reviewId on AnalysisResult -> 409)
  // -------------------------------------------------------------------------
  test('11. Normalizes duplicate reviewId conflict to 409 CONFLICT', async () => {
    // First, persist a valid review
    const firstResult = await persistReviewAtomic({
      reviewData: sampleReviewData(),
      analysisData: sampleAnalysisData(),
      issuesData: [],
      userId: primaryUser._id
    });

    // Attempt to manually trigger a duplicate AnalysisResult by mocking AnalysisResult.create
    // or by forcing a duplicate key error
    const duplicateKeyError = new Error('E11000 duplicate key error collection: aicode_review_test.analysisresults index: reviewId_1 dup key');
    duplicateKeyError.code = 11000;

    const normalized = normalizePersistenceError(duplicateKeyError);
    assert.equal(normalized.statusCode, 409);
    assert.equal(normalized.code, 'CONFLICT');
    assert.match(normalized.message, /already exists/i);

    // Also verify when AnalysisResult model throws E11000 inside persistReviewAtomic
    mock.method(AnalysisResult, 'create', async () => {
      throw duplicateKeyError;
    });

    try {
      await assert.rejects(
        async () => {
          await persistReviewAtomic(
            {
              reviewData: sampleReviewData(),
              analysisData: sampleAnalysisData(),
              issuesData: [],
              userId: primaryUser._id
            },
            { forceStandalone: true }
          );
        },
        (err) => {
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, 'CONFLICT');
          return true;
        }
      );
    } finally {
      mock.reset();
    }
  });

  // -------------------------------------------------------------------------
  // 12. No orphaned records after successful rollback
  // -------------------------------------------------------------------------
  test('12. Guarantees zero orphaned records in any collection after rollback', async () => {
    let createdReviewId = null;

    const origCreate = CodeReview.create.bind(CodeReview);
    mock.method(CodeReview, 'create', async (...args) => {
      const review = await origCreate(...args);
      createdReviewId = review._id;
      return review;
    });

    // Cause failure at ReviewIssue stage
    const badIssues = [
      {
        category: 'security',
        severity: 'INVALID_SEVERITY',
        title: 'Bad security finding',
        description: 'Test',
        lineStart: 1,
        lineEnd: 2,
        source: 'static'
      }
    ];

    try {
      await assert.rejects(async () => {
        await persistReviewAtomic(
          {
            reviewData: sampleReviewData(),
            analysisData: sampleAnalysisData(),
            issuesData: badIssues,
            userId: primaryUser._id
          },
          { forceStandalone: true }
        );
      });

      assert.ok(createdReviewId);

      // Verify all collections for this reviewId have 0 records
      const reviewCount = await CodeReview.countDocuments({ _id: createdReviewId });
      const analysisCount = await AnalysisResult.countDocuments({ reviewId: createdReviewId });
      const issueCount = await ReviewIssue.countDocuments({ reviewId: createdReviewId });

      assert.equal(reviewCount, 0, 'CodeReview count must be 0');
      assert.equal(analysisCount, 0, 'AnalysisResult count must be 0');
      assert.equal(issueCount, 0, 'ReviewIssue count must be 0');
    } finally {
      mock.reset();
    }
  });

  // -------------------------------------------------------------------------
  // 13. No deletion of pre-existing records during compensating rollback
  // -------------------------------------------------------------------------
  test('13. Compensating rollback never deletes pre-existing reviews of the same user', async () => {
    // 1. Create a pre-existing review and analysis that must remain untouched
    const preExistingResult = await persistReviewAtomic({
      reviewData: {
        ...sampleReviewData(),
        title: 'Pre-existing Review to Preserve'
      },
      analysisData: sampleAnalysisData(),
      issuesData: sampleIssuesData(),
      userId: primaryUser._id
    });

    const preExistingReviewId = preExistingResult.review._id;
    const preExistingAnalysisId = preExistingResult.analysis._id;
    const preExistingIssueCount = preExistingResult.issues.length;

    // 2. Execute a failing review persistence that will trigger compensating rollback
    const invalidAnalysis = sampleAnalysisData();
    delete invalidAnalysis.executionTimeMs; // missing required field

    await assert.rejects(async () => {
      await persistReviewAtomic(
        {
          reviewData: {
            ...sampleReviewData(),
            title: 'Failing Review That Should Rollback'
          },
          analysisData: invalidAnalysis,
          issuesData: [],
          userId: primaryUser._id
        },
        { forceStandalone: true }
      );
    });

    // 3. Assert that the pre-existing records are 100% intact and untouched!
    const preservedReview = await CodeReview.findById(preExistingReviewId);
    assert.ok(preservedReview, 'Pre-existing review must NOT be deleted');
    assert.equal(preservedReview.title, 'Pre-existing Review to Preserve');

    const preservedAnalysis = await AnalysisResult.findById(preExistingAnalysisId);
    assert.ok(preservedAnalysis, 'Pre-existing analysis must NOT be deleted');

    const preservedIssues = await ReviewIssue.find({ reviewId: preExistingReviewId });
    assert.equal(preservedIssues.length, preExistingIssueCount, 'Pre-existing issues must NOT be deleted');
  });
});
