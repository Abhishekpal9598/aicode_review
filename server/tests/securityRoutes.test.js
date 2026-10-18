/**
 * Integration & API Test Suite for Dedicated Security Analysis Route
 * server/tests/securityRoutes.test.js
 *
 * Verifies Phase 9 Step 4 requirements:
 * - GET /api/v1/reviews/:id/security
 * - Group 1: Authentication, Tenant Scoping & Owner Access (5 tests)
 * - Group 2: Request Query Parameter Validation (4 tests)
 * - Group 3: Telemetry Aggregation & Conservation Laws (6 tests)
 * - Group 4: Metadata Dynamic Enrichment & Non-Fabrication (3 tests)
 * - Group 5: Scoring & Fallback Semantics (3 tests)
 * - Group 6: Query Filtering Accuracy (5 tests)
 * - Group 7: Deterministic Multi-Tier Sorting & Tie-Breaking (4 tests)
 * Total: Exactly 30 tests
 */

import test, { describe, before, after } from 'node:test';
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

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';

let server;
let serverPort;
let userA;
let userB;
let userAToken;
let userBToken;

let reviewUserA;
let reviewUserB;
let reviewEmpty;
let reviewNoAnalysis;
let reviewNullScore;
let reviewTieBreaker;

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

describe('Phase 9 — Step 4: Dedicated Security Analysis API Endpoint', () => {
  before(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_DB_URI);
    }

    // 1. Create test users
    userA = await User.create({
      name: 'Security Test Developer A',
      email: `sec_user_a_${Date.now()}@test.dev`,
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr'
    });

    userB = await User.create({
      name: 'Security Test Developer B',
      email: `sec_user_b_${Date.now()}@test.dev`,
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr'
    });

    userAToken = createTestJwt(userA._id, userA.email);
    userBToken = createTestJwt(userB._id, userB.email);

    // 2. Start HTTP server
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });

    // 3. Create Primary Review for User A (with 5 diverse security findings)
    const rawA = 'import sqlite3\ndef test(): pass';
    reviewUserA = await CodeReview.create({
      userId: userA._id,
      title: 'Primary Security Review A',
      language: 'python',
      sourceType: 'pasted',
      status: 'completed',
      rawCode: rawA,
      lineCount: 2,
      characterCount: rawA.length,
      fileSizeBytes: Buffer.byteLength(rawA, 'utf8')
    });

    const analysisResultA = await AnalysisResult.create({
      reviewId: reviewUserA._id,
      userId: userA._id,
      overallScore: 82,
      grade: 'B',
      staticScore: 75,
      aiAvailable: true,
      summary: 'Security review analysis summary',
      executionTimeMs: 150,
      metrics: {
        securityScore: 82,
        bugScore: 90,
        performanceScore: 80,
        maintainabilityScore: 85,
        staticDeductions: 25,
        issueCounts: { critical: 1, high: 1, medium: 1, low: 1, info: 1 }
      }
    });

    // Seed 5 diverse security issues for reviewUserA
    await ReviewIssue.create([
      {
        reviewId: reviewUserA._id,
        analysisResultId: analysisResultA._id,
        userId: userA._id,
        category: 'security',
        severity: 'CRITICAL',
        title: 'Raw SQL String Formatting',
        description: 'Dynamically constructing SQL queries using f-strings allows SQL injection.',
        lineStart: 10,
        lineEnd: 10,
        columnStart: 5,
        columnEnd: 30,
        ruleId: 'SEC-PY-SQL-001',
        source: 'static'
      },
      {
        reviewId: reviewUserA._id,
        analysisResultId: analysisResultA._id,
        userId: userA._id,
        category: 'security',
        severity: 'HIGH',
        title: 'Subprocess Execution with shell=True',
        description: 'Invoking subprocess commands with shell=True exposes to command injection.',
        lineStart: 15,
        lineEnd: 15,
        columnStart: 1,
        columnEnd: 40,
        ruleId: 'SEC-PY-CMD-001',
        source: 'hybrid'
      },
      {
        reviewId: reviewUserA._id,
        analysisResultId: analysisResultA._id,
        userId: userA._id,
        category: 'security',
        severity: 'MEDIUM',
        title: 'Pure AI Semantic Security Anomaly',
        description: 'Potentially dangerous data handling pattern identified by AI.',
        lineStart: 20,
        lineEnd: 20,
        columnStart: 1,
        columnEnd: 25,
        ruleId: null,
        source: 'gemini'
      },
      {
        reviewId: reviewUserA._id,
        analysisResultId: analysisResultA._id,
        userId: userA._id,
        category: 'security',
        severity: 'LOW',
        title: 'Reflected XSS Pattern in JS',
        description: 'Direct innerHTML assignment with untrusted data.',
        lineStart: 25,
        lineEnd: 25,
        columnStart: 10,
        columnEnd: 35,
        ruleId: 'SEC-JS-XSS-001',
        source: 'static'
      },
      {
        reviewId: reviewUserA._id,
        analysisResultId: analysisResultA._id,
        userId: userA._id,
        category: 'security',
        severity: 'INFO',
        title: 'Unregistered Rule Finding',
        description: 'Finding with an unknown rule ID.',
        lineStart: 30,
        lineEnd: 30,
        columnStart: 1,
        columnEnd: 20,
        ruleId: 'SEC-UNKNOWN-999',
        source: 'gemini'
      }
    ]);

    // 4. Create Review for User B (for tenant cross-access verification)
    const rawB = 'console.log("hello");';
    reviewUserB = await CodeReview.create({
      userId: userB._id,
      title: 'Security Review B',
      language: 'javascript',
      sourceType: 'pasted',
      status: 'completed',
      rawCode: rawB,
      lineCount: 1,
      characterCount: rawB.length,
      fileSizeBytes: Buffer.byteLength(rawB, 'utf8')
    });

    // 5. Create Empty Review for User A (zero security issues)
    const rawEmpty = 'def clean(): return 1';
    reviewEmpty = await CodeReview.create({
      userId: userA._id,
      title: 'Empty Security Review',
      language: 'python',
      sourceType: 'pasted',
      status: 'completed',
      rawCode: rawEmpty,
      lineCount: 1,
      characterCount: rawEmpty.length,
      fileSizeBytes: Buffer.byteLength(rawEmpty, 'utf8')
    });

    await AnalysisResult.create({
      reviewId: reviewEmpty._id,
      userId: userA._id,
      overallScore: 100,
      grade: 'A',
      staticScore: 100,
      aiAvailable: true,
      summary: 'Clean code with zero issues',
      executionTimeMs: 80,
      metrics: {
        securityScore: 100,
        bugScore: 100,
        performanceScore: 100,
        maintainabilityScore: 100,
        staticDeductions: 0,
        issueCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
      }
    });

    // 6. Create Review without AnalysisResult (missing analysis test)
    const rawNoAnalysis = 'x = 1';
    reviewNoAnalysis = await CodeReview.create({
      userId: userA._id,
      title: 'No Analysis Review',
      language: 'python',
      sourceType: 'pasted',
      status: 'completed',
      rawCode: rawNoAnalysis,
      lineCount: 1,
      characterCount: rawNoAnalysis.length,
      fileSizeBytes: Buffer.byteLength(rawNoAnalysis, 'utf8')
    });

    // 7. Create Review with null securityScore (Static Fallback Mode test)
    const rawNull = 'y = 2';
    reviewNullScore = await CodeReview.create({
      userId: userA._id,
      title: 'Null Security Score Review',
      language: 'python',
      sourceType: 'pasted',
      status: 'completed',
      rawCode: rawNull,
      lineCount: 1,
      characterCount: rawNull.length,
      fileSizeBytes: Buffer.byteLength(rawNull, 'utf8')
    });

    await AnalysisResult.create({
      reviewId: reviewNullScore._id,
      userId: userA._id,
      overallScore: 85,
      grade: 'B',
      staticScore: 85,
      aiAvailable: false,
      summary: 'Static fallback mode analysis',
      executionTimeMs: 90,
      metrics: {
        securityScore: null,
        bugScore: null,
        performanceScore: null,
        maintainabilityScore: null,
        staticDeductions: 15,
        issueCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
      }
    });

    // 8. Create Review with tied issues for deterministic tie-breaker test
    const rawTie = 'pass\npass';
    reviewTieBreaker = await CodeReview.create({
      userId: userA._id,
      title: 'Tie Breaker Review',
      language: 'python',
      sourceType: 'pasted',
      status: 'completed',
      rawCode: rawTie,
      lineCount: 2,
      characterCount: rawTie.length,
      fileSizeBytes: Buffer.byteLength(rawTie, 'utf8')
    });

    const analysisTie = await AnalysisResult.create({
      reviewId: reviewTieBreaker._id,
      userId: userA._id,
      overallScore: 70,
      grade: 'C',
      staticScore: 70,
      aiAvailable: true,
      summary: 'Tie breaker analysis',
      executionTimeMs: 110,
      metrics: {
        securityScore: 70,
        bugScore: 70,
        performanceScore: 70,
        maintainabilityScore: 70,
        staticDeductions: 30,
        issueCounts: { critical: 0, high: 2, medium: 0, low: 0, info: 0 }
      }
    });

    // Create two issues on identical line and column with same severity
    await ReviewIssue.create([
      {
        reviewId: reviewTieBreaker._id,
        analysisResultId: analysisTie._id,
        userId: userA._id,
        category: 'security',
        severity: 'HIGH',
        title: 'Tied Issue Alpha',
        description: 'First tied issue.',
        lineStart: 5,
        lineEnd: 5,
        columnStart: 1,
        columnEnd: 10,
        ruleId: 'SEC-PY-CMD-001',
        source: 'static'
      },
      {
        reviewId: reviewTieBreaker._id,
        analysisResultId: analysisTie._id,
        userId: userA._id,
        category: 'security',
        severity: 'HIGH',
        title: 'Tied Issue Beta',
        description: 'Second tied issue.',
        lineStart: 5,
        lineEnd: 5,
        columnStart: 1,
        columnEnd: 10,
        ruleId: 'SEC-PY-CMD-001',
        source: 'static'
      }
    ]);
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
      await User.deleteOne({ _id: userA._id });
    }

    if (userB) {
      await ReviewIssue.deleteMany({ userId: userB._id });
      await AnalysisResult.deleteMany({ userId: userB._id });
      await CodeReview.deleteMany({ userId: userB._id });
      await User.deleteOne({ _id: userB._id });
    }

    await mongoose.disconnect();
  });

  // =========================================================================
  // GROUP 1: Authentication, Tenant Scoping & Owner Access (5 tests)
  // =========================================================================
  describe('Group 1: Authentication, Tenant Scoping & Owner Access', () => {
    test('1. Rejects unauthenticated request without JWT (HTTP 401)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`);
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    test('2. Rejects invalid ObjectId format in URL parameter (HTTP 400)', async () => {
      const res = await makeRequest('/api/v1/reviews/not-an-objectid/security', {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('3. Rejects non-existent review ID (HTTP 404)', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await makeRequest(`/api/v1/reviews/${nonExistentId}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      assert.strictEqual(res.body.error.message, 'Review not found');
    });

    test('4. Rejects cross-tenant access to another user\'s review (HTTP 404)', async () => {
      // User B attempts to access User A's review
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userBToken}` }
      });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'NOT_FOUND');
      assert.strictEqual(res.body.error.message, 'Review not found');
    });

    test('5. Confirms authenticated owner retrieves their own security review successfully (HTTP 200)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.message, 'Security analysis retrieved successfully');
      assert.strictEqual(res.body.data.reviewId, reviewUserA._id.toString());
    });
  });

  // =========================================================================
  // GROUP 2: Request Query Parameter Validation (4 tests)
  // =========================================================================
  describe('Group 2: Request Query Parameter Validation', () => {
    test('6. Rejects invalid severity value with HTTP 400', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?severity=EXTREME`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('7. Rejects invalid source value with HTTP 400', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?source=external`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('8. Rejects invalid cwe format with HTTP 400', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?cwe=INVALID-89`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    });

    test('9. Rejects invalid sort option with HTTP 400', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?sort=random`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // GROUP 3: Telemetry Aggregation & Conservation Laws (6 tests)
  // =========================================================================
  describe('Group 3: Telemetry Aggregation & Conservation Laws', () => {
    test('10. Validates identity: sum(severityCounts) === totalSecurityIssues', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const data = res.body.data;
      const severitySum = Object.values(data.severityCounts).reduce((acc, count) => acc + count, 0);
      assert.strictEqual(severitySum, data.totalSecurityIssues);
      assert.strictEqual(data.totalSecurityIssues, 5);
      assert.strictEqual(data.hasCriticalVulnerability, true);
    });

    test('11. Validates identity: sum(sourceCounts) === totalSecurityIssues', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const data = res.body.data;
      const sourceSum = Object.values(data.sourceCounts).reduce((acc, count) => acc + count, 0);
      assert.strictEqual(sourceSum, data.totalSecurityIssues);
      assert.strictEqual(data.sourceCounts.static, 2);
      assert.strictEqual(data.sourceCounts.hybrid, 1);
      assert.strictEqual(data.sourceCounts.gemini, 2);
    });

    test('12. Validates identity: sum(owaspDistribution) === totalSecurityIssues', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const data = res.body.data;
      const owaspSum = Object.values(data.owaspDistribution).reduce((acc, count) => acc + count, 0);
      assert.strictEqual(owaspSum, data.totalSecurityIssues);
      assert.strictEqual(Object.keys(data.owaspDistribution).length, 11);
    });

    test('13. Validates identity: sum(cweDistribution) === totalSecurityIssues', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const data = res.body.data;
      const cweSum = Object.values(data.cweDistribution).reduce((acc, count) => acc + count, 0);
      assert.strictEqual(cweSum, data.totalSecurityIssues);
    });

    test('14. Unknown or null OWASP categories correctly increment the Uncategorized bucket', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const data = res.body.data;
      // 2 findings have null ruleId or unknown ruleId
      assert.strictEqual(data.owaspDistribution['Uncategorized'], 2);
      assert.strictEqual(data.owaspDistribution['A03:2021-Injection'], 3);
    });

    test('15. Empty review (zero security issues) returns zero counts across all buckets and empty cweDistribution object', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewEmpty._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 200);
      const data = res.body.data;
      assert.strictEqual(data.totalSecurityIssues, 0);
      assert.strictEqual(data.filteredCount, 0);
      assert.strictEqual(data.hasCriticalVulnerability, false);

      // Verify severity counts all zero
      for (const count of Object.values(data.severityCounts)) {
        assert.strictEqual(count, 0);
      }

      // Verify source counts all zero
      for (const count of Object.values(data.sourceCounts)) {
        assert.strictEqual(count, 0);
      }

      // Verify all 11 OWASP keys including Uncategorized are zero
      assert.strictEqual(Object.keys(data.owaspDistribution).length, 11);
      for (const count of Object.values(data.owaspDistribution)) {
        assert.strictEqual(count, 0);
      }

      // Verify cweDistribution is strictly an empty object
      assert.deepStrictEqual(data.cweDistribution, {});
      assert.strictEqual(data.issues.length, 0);
    });
  });

  // =========================================================================
  // GROUP 4: Metadata Dynamic Enrichment & Non-Fabrication (3 tests)
  // =========================================================================
  describe('Group 4: Metadata Dynamic Enrichment & Non-Fabrication', () => {
    test('16. Enriches registered static rule with metadata from registry', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const sqlIssue = res.body.data.issues.find((i) => i.ruleId === 'SEC-PY-SQL-001');
      assert.ok(sqlIssue, 'Expected SEC-PY-SQL-001 finding to exist');
      assert.strictEqual(sqlIssue.cwe, 'CWE-89');
      assert.strictEqual(sqlIssue.owaspCategory, 'A03:2021-Injection');
      assert.strictEqual(sqlIssue.confidence, 'HIGH');
      assert.ok(typeof sqlIssue.remediation === 'string' && sqlIssue.remediation.length > 0);
    });

    test('17. Pure AI finding (ruleId: null) receives null for cwe, owaspCategory, confidence, and remediation', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const aiIssue = res.body.data.issues.find((i) => i.ruleId === null);
      assert.ok(aiIssue, 'Expected pure AI finding to exist');
      assert.strictEqual(aiIssue.cwe, null);
      assert.strictEqual(aiIssue.owaspCategory, null);
      assert.strictEqual(aiIssue.confidence, null);
      assert.strictEqual(aiIssue.remediation, null);
    });

    test('18. Unregistered ruleId receives null for cwe, owaspCategory, confidence, and remediation', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const unknownIssue = res.body.data.issues.find((i) => i.ruleId === 'SEC-UNKNOWN-999');
      assert.ok(unknownIssue, 'Expected unregistered rule finding to exist');
      assert.strictEqual(unknownIssue.cwe, null);
      assert.strictEqual(unknownIssue.owaspCategory, null);
      assert.strictEqual(unknownIssue.confidence, null);
      assert.strictEqual(unknownIssue.remediation, null);
    });
  });

  // =========================================================================
  // GROUP 5: Scoring & Fallback Semantics (3 tests)
  // =========================================================================
  describe('Group 5: Scoring & Fallback Semantics', () => {
    test('19. Correctly maps securityScore to securityGrade reusing gradeForScore', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.body.data.securityScore, 82);
      assert.strictEqual(res.body.data.securityGrade, 'B'); // 82 in [75, 89] -> B
    });

    test('20. Returns null for securityScore and securityGrade when AnalysisResult record is missing', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewNoAnalysis._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.securityScore, null);
      assert.strictEqual(res.body.data.securityGrade, null);
    });

    test('21. Returns null for securityScore and securityGrade when metrics.securityScore is null (Static Fallback Mode)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewNullScore._id}/security`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.securityScore, null);
      assert.strictEqual(res.body.data.securityGrade, null);
    });
  });

  // =========================================================================
  // GROUP 6: Query Filtering Accuracy (5 tests)
  // =========================================================================
  describe('Group 6: Query Filtering Accuracy', () => {
    test('22. Filters by severity exact match and sets filteredCount accurately', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?severity=CRITICAL`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const data = res.body.data;
      assert.strictEqual(data.totalSecurityIssues, 5); // Pre-filter count preserved
      assert.strictEqual(data.filteredCount, 1);
      assert.strictEqual(data.issues.length, 1);
      assert.strictEqual(data.issues[0].severity, 'CRITICAL');
    });

    test('23. Filters by source exact match and sets filteredCount accurately', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?source=hybrid`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const data = res.body.data;
      assert.strictEqual(data.totalSecurityIssues, 5);
      assert.strictEqual(data.filteredCount, 1);
      assert.strictEqual(data.issues.length, 1);
      assert.strictEqual(data.issues[0].source, 'hybrid');
    });

    test('24. Filters by cwe case-insensitively (e.g. cwe-89 matches CWE-89)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?cwe=cwe-89`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const data = res.body.data;
      assert.strictEqual(data.filteredCount, 1);
      assert.strictEqual(data.issues.length, 1);
      assert.strictEqual(data.issues[0].cwe, 'CWE-89');
    });

    test('25. Filters by OWASP category prefix (e.g. A03 matches A03:2021-Injection)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?owasp=A03`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const data = res.body.data;
      assert.strictEqual(data.filteredCount, 3);
      assert.strictEqual(data.issues.length, 3);
      for (const issue of data.issues) {
        assert.ok(issue.owaspCategory.startsWith('A03'));
      }
    });

    test('26. Filters by full OWASP category name', async () => {
      const res = await makeRequest(
        `/api/v1/reviews/${reviewUserA._id}/security?owasp=A03:2021-Injection`,
        { headers: { Authorization: `Bearer ${userAToken}` } }
      );
      const data = res.body.data;
      assert.strictEqual(data.filteredCount, 3);
      assert.strictEqual(data.issues.length, 3);
      for (const issue of data.issues) {
        assert.strictEqual(issue.owaspCategory, 'A03:2021-Injection');
      }
    });
  });

  // =========================================================================
  // GROUP 7: Deterministic Multi-Tier Sorting & Tie-Breaking (4 tests)
  // =========================================================================
  describe('Group 7: Deterministic Multi-Tier Sorting & Tie-Breaking', () => {
    test('27. Sorts by severity_desc with secondary lineStart and tertiary columnStart', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?sort=severity_desc`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const issues = res.body.data.issues;
      const expectedSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      const actualSeverities = issues.map((i) => i.severity);
      assert.deepStrictEqual(actualSeverities, expectedSeverities);
    });

    test('28. Sorts by severity_asc with secondary lineStart and tertiary columnStart', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?sort=severity_asc`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const issues = res.body.data.issues;
      const expectedSeverities = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const actualSeverities = issues.map((i) => i.severity);
      assert.deepStrictEqual(actualSeverities, expectedSeverities);
    });

    test('29. Sorts by line_asc and line_desc', async () => {
      const resAsc = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?sort=line_asc`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const linesAsc = resAsc.body.data.issues.map((i) => i.lineStart);
      for (let i = 0; i < linesAsc.length - 1; i++) {
        assert.ok(linesAsc[i] <= linesAsc[i + 1]);
      }

      const resDesc = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security?sort=line_desc`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const linesDesc = resDesc.body.data.issues.map((i) => i.lineStart);
      for (let i = 0; i < linesDesc.length - 1; i++) {
        assert.ok(linesDesc[i] >= linesDesc[i + 1]);
      }
    });

    test('30. Resolves sorting ties deterministically using a._id.toString().localeCompare(b._id.toString())', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewTieBreaker._id}/security?sort=severity_desc`, {
        headers: { Authorization: `Bearer ${userAToken}` }
      });
      const issues = res.body.data.issues;
      assert.strictEqual(issues.length, 2);
      // Both have severity HIGH, lineStart 5, columnStart 1
      // Ascending _id tie-breaker ensures issues[0]._id < issues[1]._id
      const idComparison = issues[0]._id.toString().localeCompare(issues[1]._id.toString());
      assert.ok(idComparison < 0, 'First issue must have smaller _id under tie-breaking');
    });
  });
});
