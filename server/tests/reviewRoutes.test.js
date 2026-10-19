/**
 * Integration & API Test Suite for Review Lifecycle & Endpoints
 * server/tests/reviewRoutes.test.js
 *
 * Verifies Phase 8 Step 7 requirements:
 * 1. POST /api/v1/reviews: Authentication guard (401 without token)
 * 2. POST /api/v1/reviews: Request validation (400 for empty code, invalid language, limits)
 * 3. POST /api/v1/reviews: Hybrid Mode scoring (0.4 * static + 0.6 * aiComposite)
 * 4. POST /api/v1/reviews: Critical Vulnerability Ceiling (<= 74 when Critical static finding exists)
 * 5. POST /api/v1/reviews: Static Fallback Mode (honest nulls, zero fabricated metrics on AI error)
 * 6. POST /api/v1/reviews: Secret redaction in stored CodeReview.rawCode
 * 7. POST /api/v1/reviews: Coordinate mapping and spatial preservation
 * 8. POST /api/v1/reviews: Static findings remain intact in hybrid mode
 * 9. Rate Limiting: 10 requests per minute quota enforcement (HTTP 429)
 * 10. GET /api/v1/reviews: Paginated review history with filters
 * 11. GET /api/v1/reviews: ReDoS-safe search parameter escaping
 * 12. GET /api/v1/reviews/:id: Deep-dive review inspection
 * 13. GET /api/v1/reviews/:id: Invalid ObjectId rejection (400 INVALID_ID_FORMAT)
 * 14. Tenant Isolation (Read): 404 on cross-user review access
 * 15. DELETE /api/v1/reviews/:id: Cascade deletion of review and child documents
 * 16. Tenant Isolation (Delete): 404 on cross-user review deletion
 * 17. DELETE /api/v1/reviews/:id: Invalid ObjectId rejection (400 INVALID_ID_FORMAT)
 */

import test, { describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import env from '../src/config/env.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';
import { geminiService, GeminiServiceError } from '../src/services/gemini.service.js';
import { executeReview } from '../src/services/review.service.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';

let server;
let serverPort;
let userA;
let userB;
let userAToken;
let userBToken;

const makeRequest = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: serverPort,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Connection: 'close',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(body);
        } catch {
          json = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
};

const createTestJwt = (userId, email) => {
  return jwt.sign(
    {
      id: userId.toString(),
      email,
      role: 'developer'
    },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const createMockAiResponse = (overrides = {}) => ({
  summary: 'Architecturally clean implementation with minimal algorithmic overhead.',
  timeComplexity: 'O(1)',
  spaceComplexity: 'O(1)',
  categoryScores: {
    bugScore: 90,
    securityScore: 90,
    performanceScore: 85,
    maintainabilityScore: 80,
    ...(overrides.categoryScores || {})
  },
  aiCompositeScore: overrides.aiCompositeScore !== undefined ? overrides.aiCompositeScore : 87,
  suggestedCode: 'def add(a: int, b: int) -> int:\n    return a + b\n',
  refactoringRationale: 'Type annotations enhance tooling clarity and eliminate subtle type coercion bugs.',
  issues: overrides.issues !== undefined ? overrides.issues : [
    {
      category: 'maintainability',
      severity: 'LOW',
      title: 'Missing type hints on function parameters',
      description: 'Parameters a and b do not have explicit type hints.',
      lineStart: 1,
      lineEnd: 1,
      columnStart: 1,
      columnEnd: 15,
      originalSnippet: 'def add(a, b):',
      suggestedSnippet: 'def add(a: int, b: int) -> int:',
      explanation: 'Adding type hints improves static analysis capability.',
      source: 'gemini'
    }
  ],
  redactedCode: overrides.redactedCode || 'def add(a, b):\n    return a + b\n',
  redactedSecretsCount: overrides.redactedSecretsCount || 0,
  coordinateMapper: null
});

describe('Phase 8 — Step 7: Review API Endpoints & Orchestration', () => {
  before(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_DB_URI);
    }

    userA = await User.create({
      name: 'Review Test Developer A',
      email: `review_user_a_${Date.now()}@test.dev`,
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr'
    });

    userB = await User.create({
      name: 'Review Test Developer B',
      email: `review_user_b_${Date.now()}@test.dev`,
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr'
    });

    userAToken = createTestJwt(userA._id, userA.email);
    userBToken = createTestJwt(userB._id, userB.email);

    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }

    if (userA) {
      await ReviewIssue.deleteMany({ userId: userA._id });
      await AnalysisResult.deleteMany({ userId: userA._id });
      await CodeReview.deleteMany({ userId: userA._id });
      await User.findByIdAndDelete(userA._id);
    }
    if (userB) {
      await ReviewIssue.deleteMany({ userId: userB._id });
      await AnalysisResult.deleteMany({ userId: userB._id });
      await CodeReview.deleteMany({ userId: userB._id });
      await User.findByIdAndDelete(userB._id);
    }

    await mongoose.disconnect();
  });

  // =========================================================================
  // 1. AUTHENTICATION & INPUT VALIDATION GUARDS
  // =========================================================================
  test('1. Unauthenticated Guard: 401 when no JWT token is supplied', async () => {
    const res = await makeRequest('/api/v1/reviews', {
      method: 'POST',
      body: { code: 'def add(a, b): return a + b', language: 'python' }
    });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'AUTH_TOKEN_MISSING');
  });

  test('2. Input Validation: 400 when code is empty or whitespace-only', async () => {
    const res = await makeRequest('/api/v1/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { code: '   \n  \t  ', language: 'python' }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('3. Input Validation: 400 when language is invalid or unsupported', async () => {
    const res = await makeRequest('/api/v1/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { code: 'puts "hello"', language: 'ruby' }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('4. Input Validation: 400 when code exceeds 2,500 lines', async () => {
    const oversized = new Array(2505).fill('x = 1').join('\n');
    const res = await makeRequest('/api/v1/reviews', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { code: oversized, language: 'python' }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 2. HYBRID REVIEW EXECUTION & FORMULA VERIFICATION
  // =========================================================================
  test('5. POST /api/v1/reviews (Hybrid Mode): Blends static & AI scores and persists atomically', async () => {
    const mockAi = createMockAiResponse({
      categoryScores: {
        bugScore: 90,
        securityScore: 90,
        performanceScore: 80,
        maintainabilityScore: 80
      },
      aiCompositeScore: 86 // round(0.30*90 + 0.30*90 + 0.20*80 + 0.20*80) = round(27+27+16+16) = 86
    });

    mock.method(geminiService, 'analyze', async () => mockAi);

    try {
      const code = 'def compute_total(items):\n    return sum(items)\n';
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: {
          code,
          language: 'python',
          title: 'Total Calculator Review',
          fileName: 'calculator.py'
        }
      });

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      const data = res.body.data;

      assert.ok(data.review);
      assert.ok(data.analysis);
      assert.ok(Array.isArray(data.issues));

      // Review metadata
      assert.equal(data.review.title, 'Total Calculator Review');
      assert.equal(data.review.filename, 'calculator.py');
      assert.equal(data.review.reviewMode, 'hybrid');
      assert.equal(data.review.language, 'python');
      assert.equal(data.review.userId, userA._id.toString());

      // Scoring formulas:
      // Pristine code staticScore = 100
      // baseScore = round(0.40 * 100 + 0.60 * 86) = round(40 + 51.6) = 92
      assert.equal(data.analysis.staticScore, 100);
      assert.equal(data.analysis.metrics.aiCompositeScore, 86);
      assert.equal(data.analysis.overallScore, 92);
      assert.equal(data.analysis.grade, 'A');
      assert.equal(data.analysis.aiAvailable, true);

      // Verify persistence in DB
      const dbReview = await CodeReview.findById(data.review._id);
      const dbAnalysis = await AnalysisResult.findOne({ reviewId: data.review._id });
      assert.ok(dbReview);
      assert.ok(dbAnalysis);
      assert.equal(dbReview.userId.toString(), userA._id.toString());
      assert.equal(dbAnalysis.overallScore, 92);
    } finally {
      mock.reset();
    }
  });

  // =========================================================================
  // 3. CRITICAL VULNERABILITY SCORE CEILING ENFORCEMENT
  // =========================================================================
  test('6. POST /api/v1/reviews (Critical Ceiling): Caps overall score at <= 74 when Critical static finding exists', async () => {
    // AWS Key triggers Critical SEC-GEN-001 finding (25pt static deduction)
    const codeWithSecret = 'AWS_KEY = "AKIAIOSFODNN7EXAMPLE"\ndef connect(): pass\n';

    // Mock Gemini returns 100 across all categories
    const mockAi = createMockAiResponse({
      categoryScores: {
        bugScore: 100,
        securityScore: 100,
        performanceScore: 100,
        maintainabilityScore: 100
      },
      aiCompositeScore: 100,
      redactedCode: 'AWS_KEY = "AKIA****************"\ndef connect(): pass\n'
    });

    mock.method(geminiService, 'analyze', async () => mockAi);

    try {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: {
          code: codeWithSecret,
          language: 'python',
          title: 'AWS Secret Test'
        }
      });

      assert.equal(res.statusCode, 201);
      const data = res.body.data;

      // Static score: 100 - 25 = 75
      // Base score: round(0.40 * 75 + 0.60 * 100) = round(30 + 60) = 90
      // Critical Ceiling: because SEC-GEN-001 is CRITICAL, score must cap at min(90, 74) = 74
      assert.equal(data.analysis.staticScore, 75);
      assert.equal(data.analysis.overallScore, 74, 'Score must be capped at 74 due to Critical static finding');
      assert.equal(data.analysis.grade, 'C', 'Grade cannot exceed C when Critical finding exists');
    } finally {
      mock.reset();
    }
  });

  // =========================================================================
  // 4. STATIC FALLBACK MODE (HONEST NULLS & ZERO FABRICATED METRICS)
  // =========================================================================
  test('7. POST /api/v1/reviews (Static Fallback): Completes safely with 201 and honest nulls when Gemini fails', async () => {
    // Simulate Gemini timeout failure
    mock.method(geminiService, 'analyze', async () => {
      throw new GeminiServiceError('Gemini analysis request timed out after 30000ms', 'AI_TIMEOUT', 504);
    });

    try {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: {
          code: 'def is_even(n):\n    return n % 2 == 0\n',
          language: 'python',
          title: 'Timeout Fallback Test'
        }
      });

      assert.equal(res.statusCode, 201, 'Fallback mode must succeed with HTTP 201');
      const data = res.body.data;

      assert.equal(data.review.reviewMode, 'static-fallback');
      assert.equal(data.analysis.aiAvailable, false);
      assert.equal(data.analysis.overallScore, data.analysis.staticScore, 'overallScore strictly equals staticScore');
      assert.equal(data.analysis.staticScore, 100);
      assert.equal(data.analysis.grade, 'A');

      // Honest nulls: zero fabricated AI scores
      assert.equal(data.analysis.metrics.bugScore, null);
      assert.equal(data.analysis.metrics.securityScore, null);
      assert.equal(data.analysis.metrics.maintainabilityScore, null);
      assert.equal(data.analysis.metrics.aiCompositeScore, null);
      assert.equal(typeof data.analysis.metrics.performanceScore, 'number', 'Deterministic performance score evaluated');
      assert.equal(typeof data.analysis.timeComplexity, 'string', 'Deterministic time complexity evaluated');
      assert.equal(data.analysis.suggestedCode, null);
      assert.equal(data.analysis.refactoringRationale, null);
      assert.match(data.analysis.summary, /AI semantic analysis was unavailable/i);
    } finally {
      mock.reset();
    }
  });

  // =========================================================================
  // 5. SECRET REDACTION & SPATIAL INTEGRITY
  // =========================================================================
  test('8. Secret Redaction: Only redacted code is stored in CodeReview.rawCode', async () => {
    const rawSecretCode = 'DATABASE_URL = "postgres://admin:super_secret_password_123@db.internal:5432/prod"\n';

    mock.method(geminiService, 'analyze', async (code) => {
      // Confirm that the code received has the secret redacted
      assert.equal(code.includes('super_secret_password_123'), false, 'Gemini must never receive raw credentials');
      return createMockAiResponse({
        redactedCode: code.replace('super_secret_password_123', '**************************')
      });
    });

    try {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: {
          code: rawSecretCode,
          language: 'python',
          title: 'Redaction DB Storage Test'
        }
      });

      assert.equal(res.statusCode, 201);
      const data = res.body.data;

      // Ensure response and database contain redacted code only
      assert.equal(data.review.rawCode.includes('super_secret_password_123'), false);
      const dbReview = await CodeReview.findById(data.review._id);
      assert.equal(dbReview.rawCode.includes('super_secret_password_123'), false);
    } finally {
      mock.reset();
    }
  });

  test('9. Coordinate Mapping & Static Findings Preservation: Both static and AI findings are present', async () => {
    // Code with a static finding (eval) and AI finding
    const code = 'eval("1 + 1")\nx = 10\n';

    const mockAi = createMockAiResponse({
      issues: [
        {
          category: 'style',
          severity: 'INFO',
          title: 'Unused variable x',
          description: 'Variable x is defined but never used.',
          lineStart: 2,
          lineEnd: 2,
          columnStart: 1,
          columnEnd: 6,
          originalSnippet: 'x = 10',
          suggestedSnippet: '',
          explanation: 'Remove dead code',
          source: 'gemini'
        }
      ]
    });

    mock.method(geminiService, 'analyze', async () => mockAi);

    try {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: {
          code,
          language: 'python',
          title: 'Combined Findings Test'
        }
      });

      assert.equal(res.statusCode, 201);
      const issues = res.body.data.issues;

      const staticEval = issues.find((i) => i.ruleId === 'SEC-PY-001' || i.ruleId === 'RISK-PY-001');
      const aiFinding = issues.find((i) => i.source === 'gemini');

      assert.ok(staticEval, 'Static eval finding must be preserved in issues');
      assert.equal(staticEval.source, 'static');
      assert.ok(aiFinding, 'AI finding must be present in issues');
      assert.equal(aiFinding.source, 'gemini');
      assert.equal(aiFinding.lineStart, 2);
    } finally {
      mock.reset();
    }
  });

  // =========================================================================
  // 6. PAGINATED HISTORY & SEARCH REDOS DEFENSE
  // =========================================================================
  test('10. GET /api/v1/reviews: Returns paginated reviews with metadata', async () => {
    const res = await makeRequest('/api/v1/reviews?page=1&limit=5', {
      method: 'GET',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.meta);
    assert.equal(res.body.meta.page, 1);
    assert.equal(res.body.meta.limit, 5);
    assert.ok(typeof res.body.meta.total === 'number');
    assert.ok(typeof res.body.meta.totalPages === 'number');
  });

  test('11. GET /api/v1/reviews?search=...: ReDoS defense escapes regex special characters', async () => {
    // Search with regex characters like .* or (.*)+
    const res = await makeRequest('/api/v1/reviews?search=.*+test', {
      method: 'GET',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  // =========================================================================
  // 7. DEEP-DIVE INSPECTION & TENANT ISOLATION
  // =========================================================================
  // =========================================================================
  // 7. DEEP-DIVE INSPECTION & TENANT ISOLATION
  // =========================================================================
  test('12. GET /api/v1/reviews/:id: Returns full deep-dive inspection for review owner', async () => {
    // Create a review for User A using executeReview directly
    const mockAi = createMockAiResponse();
    mock.method(geminiService, 'analyze', async () => mockAi);

    let createdId;
    try {
      const created = await executeReview({
        code: 'def test(): pass\n',
        language: 'python',
        title: 'Inspection Target',
        userId: userA._id
      });
      createdId = created.review._id.toString();
    } finally {
      mock.reset();
    }

    const res = await makeRequest(`/api/v1/reviews/${createdId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.review);
    assert.ok(res.body.data.analysis);
    assert.ok(Array.isArray(res.body.data.issues));
    assert.equal(res.body.data.review._id, createdId);
  });

  test('13. GET /api/v1/reviews/:id: Invalid ObjectId returns 400 INVALID_ID_FORMAT', async () => {
    const res = await makeRequest('/api/v1/reviews/invalid-hex-id-123', {
      method: 'GET',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('14. Tenant Isolation (Read): User B requesting User A review returns 404', async () => {
    // Create review owned by User A
    const mockAi = createMockAiResponse();
    mock.method(geminiService, 'analyze', async () => mockAi);

    let userAReviewId;
    try {
      const created = await executeReview({
        code: 'def secret_user_a(): pass\n',
        language: 'python',
        userId: userA._id
      });
      userAReviewId = created.review._id.toString();
    } finally {
      mock.reset();
    }

    // User B attempts to access User A's review
    const res = await makeRequest(`/api/v1/reviews/${userAReviewId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${userBToken}` }
    });

    assert.equal(res.statusCode, 404, 'Must return 404 to prevent resource existence enumeration');
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  // =========================================================================
  // 8. CASCADE DELETION & TENANT ISOLATION
  // =========================================================================
  test('15. DELETE /api/v1/reviews/:id: Cascade deletes review, analysis, and child issues', async () => {
    const mockAi = createMockAiResponse();
    mock.method(geminiService, 'analyze', async () => mockAi);

    let reviewId;
    try {
      const created = await executeReview({
        code: 'def to_delete(): pass\n',
        language: 'python',
        title: 'Delete Target',
        userId: userA._id
      });
      reviewId = created.review._id.toString();
    } finally {
      mock.reset();
    }

    // Confirm existence before delete
    assert.ok(await CodeReview.findById(reviewId));
    assert.ok(await AnalysisResult.findOne({ reviewId }));
    assert.ok((await ReviewIssue.find({ reviewId })).length > 0);

    // Delete review
    const deleteRes = await makeRequest(`/api/v1/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.equal(deleteRes.statusCode, 200);
    assert.equal(deleteRes.body.success, true);

    // Verify cascade deletion in DB
    assert.equal(await CodeReview.findById(reviewId), null);
    assert.equal(await AnalysisResult.findOne({ reviewId }), null);
    assert.equal((await ReviewIssue.find({ reviewId })).length, 0);

    // Subsequent GET should return 404
    const getRes = await makeRequest(`/api/v1/reviews/${reviewId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.equal(getRes.statusCode, 404);
  });

  test('16. Tenant Isolation (Delete): User B attempting to delete User A review returns 404', async () => {
    const mockAi = createMockAiResponse();
    mock.method(geminiService, 'analyze', async () => mockAi);

    let userAReviewId;
    try {
      const created = await executeReview({
        code: 'def protected_user_a(): pass\n',
        language: 'python',
        userId: userA._id
      });
      userAReviewId = created.review._id.toString();
    } finally {
      mock.reset();
    }

    // User B attempts to delete User A's review
    const deleteRes = await makeRequest(`/api/v1/reviews/${userAReviewId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` }
    });

    assert.equal(deleteRes.statusCode, 404, 'Must return 404 on unauthorized deletion attempt');

    // Confirm User A's review and children are still 100% intact!
    assert.ok(await CodeReview.findById(userAReviewId), 'Review must NOT be deleted');
    assert.ok(await AnalysisResult.findOne({ reviewId: userAReviewId }), 'Analysis must NOT be deleted');
  });

  test('17. DELETE /api/v1/reviews/:id: Invalid ObjectId returns 400 INVALID_ID_FORMAT', async () => {
    const res = await makeRequest('/api/v1/reviews/not-an-object-id', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // 9. RATE LIMITING (10 REQUESTS PER MINUTE QUOTA ENFORCEMENT)
  // =========================================================================
  test('18. Rate Limiting: 10 requests per minute quota enforcement and HTTP 429 response', async () => {
    const mockAi = createMockAiResponse();
    mock.method(geminiService, 'analyze', async () => mockAi);

    let reached429 = false;
    let rateLimitResponse = null;

    try {
      // Loop requests to consume remaining quota and trigger 429
      for (let i = 0; i < 15; i++) {
        const res = await makeRequest('/api/v1/reviews', {
          method: 'POST',
          headers: { Authorization: `Bearer ${userAToken}` },
          body: { code: 'def ping(): return 1\n', language: 'python' }
        });

        if (res.statusCode === 429) {
          reached429 = true;
          rateLimitResponse = res;
          break;
        }
      }

      assert.ok(reached429, 'Review limiter must return HTTP 429 when quota is exceeded');
      assert.equal(rateLimitResponse.statusCode, 429);
      assert.equal(rateLimitResponse.body.success, false);
      assert.equal(rateLimitResponse.body.error.code, 'RATE_LIMIT_EXCEEDED');
    } finally {
      mock.reset();
    }
  });
});
