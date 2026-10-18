/**
 * Unit & Integration Tests for AnalysisResult and ReviewIssue Mongoose Models
 * server/tests/models.test.js
 *
 * Verifies Phase 8 Step 3 requirements:
 * 1. Valid AnalysisResult document creation (Hybrid Mode).
 * 2. Valid AnalysisResult document creation with null AI scores (Static Fallback Mode).
 * 3. Validation rejection of out-of-range scores (score < 0, score > 100).
 * 4. Validation rejection of invalid grades and required fields.
 * 5. Valid ReviewIssue document creation with static, gemini, and hybrid sources.
 * 6. Validation rejection of invalid severity, invalid source, and invalid category.
 * 7. Spatial coordinate validation (lineEnd >= lineStart, lineStart >= 1).
 * 8. Compound index definitions verification on AnalysisResult and ReviewIssue.
 * 9. Compatibility with existing CodeReview model.
 */

import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';

let testUser;
let testReview;

describe('Phase 8 — Mongoose Models: AnalysisResult & ReviewIssue', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);

    // Create an isolated test user
    testUser = await User.create({
      name: 'Model Test Developer',
      email: `model_test_${Date.now()}@test.dev`,
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr'
    });

    // Create an isolated test review
    testReview = await CodeReview.create({
      userId: testUser._id,
      title: 'Quicksort Analysis',
      sourceType: 'pasted',
      filename: 'quicksort.py',
      language: 'python',
      rawCode: 'def quicksort(arr): return arr',
      lineCount: 1,
      characterCount: 30,
      fileSizeBytes: 30,
      status: 'completed'
    });
  });

  after(async () => {
    // Clean up created test entities
    if (testReview) {
      await ReviewIssue.deleteMany({ reviewId: testReview._id });
      await AnalysisResult.deleteMany({ reviewId: testReview._id });
      await CodeReview.deleteOne({ _id: testReview._id });
    }
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
    }
    await mongoose.connection.close();
  });

  // =========================================================================
  // 1. ANALYSIS RESULT MODEL TESTS
  // =========================================================================
  test('AnalysisResult: creates valid document in Hybrid Mode with AI scores', async () => {
    const analysisDoc = new AnalysisResult({
      reviewId: testReview._id,
      userId: testUser._id,
      overallScore: 88,
      grade: 'B',
      staticScore: 85,
      aiAvailable: true,
      summary: 'Clean implementation with solid algorithmic performance and zero security flaws.',
      metrics: {
        bugScore: 92,
        securityScore: 100,
        performanceScore: 80,
        maintainabilityScore: 85,
        aiCompositeScore: 90,
        staticDeductions: 15,
        issueCounts: {
          critical: 0,
          high: 0,
          medium: 1,
          low: 2,
          info: 1
        }
      },
      timeComplexity: 'O(N log N)',
      spaceComplexity: 'O(log N)',
      suggestedCode: 'def quicksort(arr):\n    # Optimized in-place partition\n    return arr',
      refactoringRationale: 'Refactored to minimize recursive auxiliary call stack overhead.',
      executionTimeMs: 420
    });

    const validationErr = analysisDoc.validateSync();
    assert.strictEqual(validationErr, undefined, 'Hybrid AnalysisResult must be valid');
    assert.strictEqual(analysisDoc.overallScore, 88);
    assert.strictEqual(analysisDoc.metrics.aiCompositeScore, 90);
    assert.strictEqual(analysisDoc.aiAvailable, true);
  });

  test('AnalysisResult: creates valid document in Fallback Mode with null AI scores', async () => {
    const fallbackDoc = new AnalysisResult({
      reviewId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      overallScore: 75,
      grade: 'B',
      staticScore: 75,
      aiAvailable: false,
      summary: 'AI semantic analysis was unavailable. Review completed using deterministic static code analysis engine.',
      metrics: {
        bugScore: null,
        securityScore: null,
        performanceScore: null,
        maintainabilityScore: null,
        aiCompositeScore: null,
        staticDeductions: 25,
        issueCounts: {
          critical: 1,
          high: 0,
          medium: 0,
          low: 0,
          info: 0
        }
      },
      timeComplexity: null,
      spaceComplexity: null,
      suggestedCode: null,
      refactoringRationale: null,
      executionTimeMs: 15
    });

    const validationErr = fallbackDoc.validateSync();
    assert.strictEqual(validationErr, undefined, 'Fallback AnalysisResult must accept null AI scores');
    assert.strictEqual(fallbackDoc.metrics.bugScore, null);
    assert.strictEqual(fallbackDoc.metrics.securityScore, null);
    assert.strictEqual(fallbackDoc.metrics.aiCompositeScore, null);
    assert.strictEqual(fallbackDoc.timeComplexity, null);
    assert.strictEqual(fallbackDoc.suggestedCode, null);
    assert.strictEqual(fallbackDoc.aiAvailable, false);
  });

  test('AnalysisResult: rejects out-of-range scores (< 0 or > 100)', () => {
    const invalidDoc = new AnalysisResult({
      reviewId: testReview._id,
      userId: testUser._id,
      overallScore: 105, // Invalid > 100
      grade: 'A',
      staticScore: -5,   // Invalid < 0
      aiAvailable: true,
      summary: 'Test summary',
      metrics: {
        bugScore: 150, // Invalid > 100
        staticDeductions: 0
      },
      executionTimeMs: 100
    });

    const err = invalidDoc.validateSync();
    assert.ok(err, 'Must produce validation error for out-of-range scores');
    assert.ok(err.errors['overallScore'], 'Must reject overallScore > 100');
    assert.ok(err.errors['staticScore'], 'Must reject staticScore < 0');
    assert.ok(err.errors['metrics.bugScore'], 'Must reject bugScore > 100');
  });

  test('AnalysisResult: rejects invalid grade and missing required fields', () => {
    const invalidDoc = new AnalysisResult({
      // Missing reviewId, userId, summary, executionTimeMs
      overallScore: 80,
      grade: 'Z', // Invalid grade enum
      staticScore: 80,
      aiAvailable: true
    });

    const err = invalidDoc.validateSync();
    assert.ok(err, 'Must fail validation on missing fields and bad grade');
    assert.ok(err.errors['reviewId']);
    assert.ok(err.errors['userId']);
    assert.ok(err.errors['grade']);
    assert.ok(err.errors['summary']);
    assert.ok(err.errors['executionTimeMs']);
  });

  // =========================================================================
  // 2. REVIEW ISSUE MODEL TESTS
  // =========================================================================
  test('ReviewIssue: creates valid document with static, gemini, and hybrid sources', () => {
    const dummyResultId = new mongoose.Types.ObjectId();

    for (const source of ['static', 'gemini', 'hybrid']) {
      const issue = new ReviewIssue({
        reviewId: testReview._id,
        analysisResultId: dummyResultId,
        userId: testUser._id,
        category: 'security',
        severity: 'CRITICAL',
        title: 'Buffer Overflow via strcpy',
        description: 'Unbounded memory copy detected in C source code.',
        lineStart: 12,
        lineEnd: 12,
        columnStart: 5,
        columnEnd: 28,
        originalSnippet: 'strcpy(buffer, input);',
        suggestedSnippet: 'strncpy(buffer, input, sizeof(buffer) - 1);',
        explanation: 'strcpy does not perform boundary checks, resulting in memory corruption vulnerabilities.',
        ruleId: 'SEC-C-001',
        source
      });

      const err = issue.validateSync();
      assert.strictEqual(err, undefined, `ReviewIssue must accept source: ${source}`);
      assert.strictEqual(issue.source, source);
      assert.strictEqual(issue.severity, 'CRITICAL');
      assert.strictEqual(issue.lineStart, 12);
    }
  });

  test('ReviewIssue: rejects invalid severity enum', () => {
    const issue = new ReviewIssue({
      reviewId: testReview._id,
      analysisResultId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      category: 'bug',
      severity: 'SUPER_FATAL', // Invalid
      title: 'Invalid severity test',
      description: 'Testing severity enum constraint',
      lineStart: 1,
      lineEnd: 1,
      source: 'static'
    });

    const err = issue.validateSync();
    assert.ok(err);
    assert.ok(err.errors['severity'], 'Must reject invalid severity value');
  });

  test('ReviewIssue: rejects invalid source enum', () => {
    const issue = new ReviewIssue({
      reviewId: testReview._id,
      analysisResultId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      category: 'bug',
      severity: 'MEDIUM',
      title: 'Invalid source test',
      description: 'Testing source enum constraint',
      lineStart: 1,
      lineEnd: 1,
      source: 'third_party_scanner' // Invalid
    });

    const err = issue.validateSync();
    assert.ok(err);
    assert.ok(err.errors['source'], 'Must reject invalid source value');
  });

  test('ReviewIssue: rejects invalid category enum', () => {
    const issue = new ReviewIssue({
      reviewId: testReview._id,
      analysisResultId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      category: 'miscellaneous', // Invalid
      severity: 'LOW',
      title: 'Invalid category test',
      description: 'Testing category enum constraint',
      lineStart: 1,
      lineEnd: 1,
      source: 'static'
    });

    const err = issue.validateSync();
    assert.ok(err);
    assert.ok(err.errors['category'], 'Must reject invalid category value');
  });

  test('ReviewIssue: rejects inverted coordinates where lineEnd < lineStart', () => {
    const issue = new ReviewIssue({
      reviewId: testReview._id,
      analysisResultId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      category: 'performance',
      severity: 'MEDIUM',
      title: 'Inverted coordinates test',
      description: 'Testing spatial integrity validator',
      lineStart: 25,
      lineEnd: 10, // Invalid: lineEnd < lineStart
      source: 'gemini'
    });

    const err = issue.validateSync();
    assert.ok(err);
    assert.ok(err.errors['lineEnd'], 'Must reject lineEnd < lineStart');
    assert.strictEqual(err.errors['lineEnd'].message, 'lineEnd cannot be less than lineStart');
  });

  test('ReviewIssue: rejects line coordinates less than 1', () => {
    const issue = new ReviewIssue({
      reviewId: testReview._id,
      analysisResultId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      category: 'bug',
      severity: 'LOW',
      title: 'Zero coordinate test',
      description: 'Testing min coordinate constraint',
      lineStart: 0, // Invalid: < 1
      lineEnd: 0,   // Invalid: < 1
      source: 'static'
    });

    const err = issue.validateSync();
    assert.ok(err);
    assert.ok(err.errors['lineStart']);
    assert.ok(err.errors['lineEnd']);
  });

  // =========================================================================
  // 3. COMPOUND INDEXES VERIFICATION
  // =========================================================================
  test('Index Integrity: AnalysisResult and ReviewIssue define approved compound indexes', () => {
    // 1. AnalysisResult indexes
    const analysisIndexes = AnalysisResult.schema.indexes();
    const hasUniqueReviewId = analysisIndexes.some(
      ([idx, opts]) => idx.reviewId === 1 && opts && opts.unique === true
    );
    const hasUserCreated = analysisIndexes.some(
      ([idx]) => idx.userId === 1 && idx.createdAt === -1
    );

    assert.ok(hasUniqueReviewId, 'AnalysisResult must have unique reviewId index');
    assert.ok(hasUserCreated, 'AnalysisResult must have { userId: 1, createdAt: -1 } index');

    // 2. ReviewIssue indexes
    const issueIndexes = ReviewIssue.schema.indexes();
    const hasReviewSeverity = issueIndexes.some(
      ([idx]) => idx.reviewId === 1 && idx.severity === 1
    );
    const hasReviewSource = issueIndexes.some(
      ([idx]) => idx.reviewId === 1 && idx.source === 1
    );
    const hasIssueUserCreated = issueIndexes.some(
      ([idx]) => idx.userId === 1 && idx.createdAt === -1
    );

    assert.ok(hasReviewSeverity, 'ReviewIssue must have { reviewId: 1, severity: 1 } index');
    assert.ok(hasReviewSource, 'ReviewIssue must have { reviewId: 1, source: 1 } index');
    assert.ok(hasIssueUserCreated, 'ReviewIssue must have { userId: 1, createdAt: -1 } index');
  });

  // =========================================================================
  // 4. STEP 3.1 VALIDATION HARDENING TESTS
  // =========================================================================
  test('Hardening: AnalysisResult rejects decimal values in scores and metrics', () => {
    // 1. Decimal overallScore
    const doc1 = new AnalysisResult({
      reviewId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      overallScore: 88.5,
      grade: 'B',
      staticScore: 85,
      aiAvailable: true,
      summary: 'Summary text',
      executionTimeMs: 100
    });
    const err1 = doc1.validateSync();
    assert.ok(err1?.errors['overallScore'], 'Must reject decimal overallScore');

    // 2. Decimal staticScore
    const doc2 = new AnalysisResult({
      reviewId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      overallScore: 85,
      grade: 'B',
      staticScore: 80.25,
      aiAvailable: true,
      summary: 'Summary text',
      executionTimeMs: 100
    });
    const err2 = doc2.validateSync();
    assert.ok(err2?.errors['staticScore'], 'Must reject decimal staticScore');

    // 3. Decimal AI sub-scores
    const doc3 = new AnalysisResult({
      reviewId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      overallScore: 85,
      grade: 'B',
      staticScore: 85,
      aiAvailable: true,
      summary: 'Summary text',
      metrics: {
        bugScore: 90.5,
        securityScore: 95.1,
        performanceScore: 75.8,
        maintainabilityScore: 82.3,
        aiCompositeScore: 85.4
      },
      executionTimeMs: 100
    });
    const err3 = doc3.validateSync();
    assert.ok(err3?.errors['metrics.bugScore'], 'Must reject decimal bugScore');
    assert.ok(err3?.errors['metrics.securityScore'], 'Must reject decimal securityScore');
    assert.ok(err3?.errors['metrics.performanceScore'], 'Must reject decimal performanceScore');
    assert.ok(err3?.errors['metrics.maintainabilityScore'], 'Must reject decimal maintainabilityScore');
    assert.ok(err3?.errors['metrics.aiCompositeScore'], 'Must reject decimal aiCompositeScore');
  });

  test('Hardening: AnalysisResult rejects decimal/negative staticDeductions, issueCounts, and executionTimeMs', () => {
    // Decimal issueCounts and deductions
    const doc1 = new AnalysisResult({
      reviewId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      overallScore: 85,
      grade: 'B',
      staticScore: 85,
      aiAvailable: true,
      summary: 'Summary text',
      metrics: {
        staticDeductions: 10.5,
        issueCounts: {
          critical: 1.5,
          high: -1
        }
      },
      executionTimeMs: 150.75
    });
    const err1 = doc1.validateSync();
    assert.ok(err1?.errors['metrics.staticDeductions'], 'Must reject decimal staticDeductions');
    assert.ok(err1?.errors['metrics.issueCounts.critical'], 'Must reject decimal issue count');
    assert.ok(err1?.errors['metrics.issueCounts.high'], 'Must reject negative issue count');
    assert.ok(err1?.errors['executionTimeMs'], 'Must reject decimal executionTimeMs');

    // Negative executionTimeMs
    const doc2 = new AnalysisResult({
      reviewId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      overallScore: 85,
      grade: 'B',
      staticScore: 85,
      aiAvailable: true,
      summary: 'Summary text',
      executionTimeMs: -50
    });
    const err2 = doc2.validateSync();
    assert.ok(err2?.errors['executionTimeMs'], 'Must reject negative executionTimeMs');
  });

  test('Hardening: ReviewIssue rejects decimal coordinates', () => {
    const issue = new ReviewIssue({
      reviewId: testReview._id,
      analysisResultId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      category: 'bug',
      severity: 'LOW',
      title: 'Decimal coordinates test',
      description: 'Testing integer coordinate constraints',
      lineStart: 1.5,
      lineEnd: 2.5,
      columnStart: 3.5,
      columnEnd: 4.5,
      source: 'static'
    });

    const err = issue.validateSync();
    assert.ok(err?.errors['lineStart'], 'Must reject decimal lineStart');
    assert.ok(err?.errors['lineEnd'], 'Must reject decimal lineEnd');
    assert.ok(err?.errors['columnStart'], 'Must reject decimal columnStart');
    assert.ok(err?.errors['columnEnd'], 'Must reject decimal columnEnd');
  });

  test('Hardening: ReviewIssue rejects same-line inverted columns', () => {
    const sameLineInverted = new ReviewIssue({
      reviewId: testReview._id,
      analysisResultId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      category: 'security',
      severity: 'HIGH',
      title: 'Same line inverted column test',
      description: 'Testing columnEnd < columnStart on same line',
      lineStart: 10,
      lineEnd: 10, // Same line
      columnStart: 25,
      columnEnd: 10, // Inverted: columnEnd < columnStart
      source: 'gemini'
    });

    const err = sameLineInverted.validateSync();
    assert.ok(err?.errors['columnEnd'], 'Must reject columnEnd < columnStart on the same line');
    assert.strictEqual(
      err.errors['columnEnd'].message,
      'columnEnd cannot be less than columnStart on the same line'
    );
  });

  test('Hardening: ReviewIssue accepts valid multi-line findings where columnEnd < columnStart', () => {
    const multiLineValid = new ReviewIssue({
      reviewId: testReview._id,
      analysisResultId: new mongoose.Types.ObjectId(),
      userId: testUser._id,
      category: 'maintainability',
      severity: 'MEDIUM',
      title: 'Multi-line block issue',
      description: 'Testing valid multi-line finding spanning line 5 col 40 to line 6 col 10',
      lineStart: 5,
      lineEnd: 6, // Multi-line
      columnStart: 40,
      columnEnd: 10, // columnEnd < columnStart is completely valid across different lines!
      source: 'hybrid'
    });

    const err = multiLineValid.validateSync();
    assert.strictEqual(err, undefined, 'Must accept multi-line finding where columnEnd < columnStart');
    assert.strictEqual(multiLineValid.lineStart, 5);
    assert.strictEqual(multiLineValid.lineEnd, 6);
    assert.strictEqual(multiLineValid.columnStart, 40);
    assert.strictEqual(multiLineValid.columnEnd, 10);
  });

  // =========================================================================
  // 5. CODE REVIEW MODEL COMPATIBILITY
  // =========================================================================
  test('Compatibility: CodeReview model remains intact with userId compound index', async () => {
    const reviewIndexes = CodeReview.schema.indexes();
    const hasReviewUserCreated = reviewIndexes.some(
      ([idx]) => idx.userId === 1 && idx.createdAt === -1
    );

    assert.ok(hasReviewUserCreated, 'CodeReview must preserve { userId: 1, createdAt: -1 } index');
    assert.strictEqual(testReview.title, 'Quicksort Analysis');
    assert.strictEqual(testReview.language, 'python');
  });
});
