/**
 * Phase 13: Audit Reports & Multi-Format Exporters Test Suite
 * server/tests/reportRoutes.test.js
 *
 * Verifies:
 * 1. Authenticated JSON export (GET /api/v1/reviews/:id/export?format=json)
 * 2. Authenticated Markdown export (GET /api/v1/reviews/:id/export?format=markdown)
 * 3. Default format fallback when query is omitted
 * 4. Zod query validation on unsupported formats (400 Bad Request)
 * 5. Review ID validation (400 Bad Request on invalid ObjectId format)
 * 6. Non-existent review handling (404 Not Found)
 * 7. Unauthenticated request rejection (401 Unauthorized)
 * 8. Strict tenant isolation (404 when user attempts to export another user's review)
 * 9. Enriched security metadata (CWE, OWASP Top 10, confidence, remediation)
 * 10. Applied fixes serialization in JSON and Markdown
 * 11. Zero secrets or internal sensitive attributes exposure
 * 12. Unit tests for computeDiffLineStats and formatMarkdownReport
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';

import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDB, disconnectDB, getDBStatus } from '../src/config/db.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';
import {
  computeDiffLineStats,
  formatMarkdownReport
} from '../src/services/reportExport.service.js';

let server;
let serverPort;

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
          status: res.statusCode,
          headers: res.headers,
          body: json,
          rawBody: body
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'object' ? JSON.stringify(options.body) : options.body);
    }
    req.end();
  });
};

describe('Phase 13: Audit Reports & Multi-Format Exporters', () => {
  let userA;
  let tokenA;
  let userB;
  let tokenB;

  let reviewA;
  let analysisA;
  let issueSecurityA;
  let issuePerformanceA;

  before(async () => {
    // 1. Ensure DB connection through authoritative connectDB()
    await connectDB();
    let dbAttempts = 0;
    while (!getDBStatus().connected && dbAttempts < 10) {
      dbAttempts++;
      await new Promise((r) => setTimeout(r, 1500));
      if (!getDBStatus().connected) {
        await connectDB();
      }
    }

    // 2. Start HTTP server
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });

    // 3. Create Developer A
    userA = await User.create({
      email: `report_dev_a_${Date.now()}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyza1b2c3d4e5f6g7h8i9j0k1l2m3n4',
      name: 'Developer Alice',
      isVerified: true
    });

    tokenA = jwt.sign(
      { id: userA._id.toString(), email: userA.email, role: 'developer' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 4. Create Developer B (for tenant isolation tests)
    userB = await User.create({
      email: `report_dev_b_${Date.now()}@example.com`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyza1b2c3d4e5f6g7h8i9j0k1l2m3n4',
      name: 'Developer Bob',
      isVerified: true
    });

    tokenB = jwt.sign(
      { id: userB._id.toString(), email: userB.email, role: 'developer' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 5. Seed Review for Developer A with Applied Fixes
    const rawCode = `import sqlite3
conn = sqlite3.connect("test.db")
cursor = conn.cursor()

def login(username, password):
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    cursor.execute(query)
`;

    const currentCode = `import sqlite3
conn = sqlite3.connect("test.db")
cursor = conn.cursor()

def login(username, password):
    query = "SELECT * FROM users WHERE username = ?"
    cursor.execute(query, (username,))
`;

    reviewA = await CodeReview.create({
      userId: userA._id,
      title: 'SQL Authentication Security Audit',
      filename: 'auth_handler.py',
      language: 'python',
      sourceType: 'pasted',
      rawCode,
      currentCode,
      lineCount: 8,
      characterCount: rawCode.length,
      fileSizeBytes: Buffer.byteLength(rawCode, 'utf8'),
      overallScore: 82,
      grade: 'B',
      status: 'completed',
      appliedFixes: [
        {
          ruleId: 'SEC-PY-SQL-002',
          lineStart: 6,
          lineEnd: 7,
          previousSnippet: '    query = "SELECT * FROM users WHERE username = \'" + username + "\'"\n    cursor.execute(query)',
          appliedSnippet: '    query = "SELECT * FROM users WHERE username = ?"\n    cursor.execute(query, (username,))',
          appliedAt: new Date()
        }
      ]
    });

    // Seed AnalysisResult for Developer A
    analysisA = await AnalysisResult.create({
      reviewId: reviewA._id,
      userId: userA._id,
      overallScore: 82,
      staticScore: 82,
      executionTimeMs: 120,
      grade: 'B',
      summary: 'SQL injection hazard detected in dynamic query string construction.',
      executiveSummary: 'Dynamic string concatenation exposes login function to authentication bypass via SQL Injection.',
      metrics: {
        securityScore: 70,
        performanceScore: 94,
        qualityScore: 82
      },
      timeComplexity: 'O(1)',
      spaceComplexity: 'O(1)',
      complexityType: 'deterministic',
      aiAvailable: false
    });

    // Seed Security Issue
    issueSecurityA = await ReviewIssue.create({
      reviewId: reviewA._id,
      analysisResultId: analysisA._id,
      userId: userA._id,
      category: 'security',
      severity: 'HIGH',
      title: 'SQL Injection via String Concatenation',
      description: 'Dynamic SQL query built using string concatenation allows unsanitized user input to alter SQL execution.',
      lineStart: 6,
      lineEnd: 6,
      columnStart: 1,
      columnEnd: 40,
      originalSnippet: '    query = "SELECT * FROM users WHERE username = \'" + username + "\'"',
      suggestedSnippet: '    query = "SELECT * FROM users WHERE username = ?"\n    cursor.execute(query, (username,))',
      explanation: 'Unsanitized user parameters directly spliced into SQL query strings lead to injection vulnerabilities.',
      ruleId: 'SEC-PY-SQL-002',
      source: 'static',
      confidence: 'HIGH'
    });

    // Seed Performance Issue
    issuePerformanceA = await ReviewIssue.create({
      reviewId: reviewA._id,
      analysisResultId: analysisA._id,
      userId: userA._id,
      category: 'performance',
      severity: 'LOW',
      title: 'Database Cursor Reinitialization',
      description: 'Reinitializing cursor without pooling or reuse can impact high-throughput performance.',
      lineStart: 3,
      lineEnd: 3,
      columnStart: 1,
      columnEnd: 20,
      originalSnippet: 'cursor = conn.cursor()',
      suggestedSnippet: '# Reuse shared cursor or pooled connection',
      explanation: 'Cursor initialization overhead is measurable in high frequency request loops.',
      ruleId: 'PERF-PY-001',
      source: 'static',
      complexityEstimate: 'O(1)'
    });
  });

  after(async () => {
    // Cleanup DB records
    if (userA) {
      await CodeReview.deleteMany({ userId: userA._id });
      await AnalysisResult.deleteMany({ userId: userA._id });
      await ReviewIssue.deleteMany({ userId: userA._id });
      await User.deleteOne({ _id: userA._id });
    }
    if (userB) {
      await User.deleteOne({ _id: userB._id });
    }

    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }

    const disconnectedListeners = mongoose.connection.listeners('disconnected');
    for (const listener of disconnectedListeners) {
      mongoose.connection.removeListener('disconnected', listener);
    }
    await disconnectDB();
  });

  // TEST 1: Unit Test computeDiffLineStats
  it('1. computeDiffLineStats accurately measures additions, deletions, and unchanged lines', () => {
    const orig = 'line1\nline2\nline3';
    const mod = 'line1\nline2_modified\nline3\nline4';

    const stats = computeDiffLineStats(orig, mod);
    assert.strictEqual(stats.addedLines, 2); // line2_modified, line4
    assert.strictEqual(stats.removedLines, 1); // line2
    assert.strictEqual(stats.unchangedLines, 2); // line1, line3
  });

  // TEST 2: Unit Test formatMarkdownReport
  it('2. formatMarkdownReport generates clean GitHub Flavored Markdown with all required sections', () => {
    const mockExport = {
      review: {
        id: '507f1f77bcf86cd799439011',
        filename: 'test.py',
        language: 'python',
        lineCount: 10,
        createdAt: new Date().toISOString()
      },
      qualityScore: {
        overall: 88,
        grade: 'B',
        securityScore: 80,
        performanceScore: 95
      },
      algorithmicComplexity: {
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(1)',
        complexityType: 'deterministic'
      },
      summary: 'Found 1 vulnerability.',
      severityBreakdown: {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 0,
        LOW: 0,
        INFO: 0
      },
      findings: {
        security: [
          {
            ruleId: 'SEC-PY-SQL-001',
            severity: 'HIGH',
            title: 'Raw SQL concatenation',
            lineStart: 5,
            lineEnd: 5,
            cwe: 'CWE-89',
            owaspCategory: 'A03:2021-Injection',
            confidence: 'HIGH',
            explanation: 'Avoid concatenation',
            originalSnippet: 'q = "SELECT " + val',
            remediation: 'Use parameters'
          }
        ],
        performance: []
      },
      appliedFixes: [],
      code: {
        hasModifications: false,
        diffSummary: { addedLines: 0, removedLines: 0 }
      }
    };

    const md = formatMarkdownReport(mockExport);
    assert.match(md, /# AI Code Review — Audit & Security Inspection Report/);
    assert.match(md, /## 1\. Executive Summary/);
    assert.match(md, /## 2\. Quality & Security Metrics Overview/);
    assert.match(md, /## 3\. Security Analysis & Vulnerabilities/);
    assert.match(md, /## 4\. Algorithmic Performance & Complexity/);
    assert.match(md, /## 5\. Applied Remediations History/);
    assert.match(md, /## 6\. Source Code Summary/);
    assert.match(md, /CWE-89/);
    assert.match(md, /A03:2021-Injection/);
  });

  // TEST 3: Authenticated JSON Export
  it('3. GET /api/v1/reviews/:id/export?format=json returns 200, application/json, and complete export payload', async () => {
    const res = await makeRequest(`/api/v1/reviews/${reviewA._id}/export?format=json`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.match(res.headers['content-disposition'], /attachment; filename="audit-report-.*\.json"/);

    const data = res.body;
    assert.ok(data.exportMetadata, 'Payload must include exportMetadata');
    assert.strictEqual(data.review.id, reviewA._id.toString());
    assert.strictEqual(data.review.filename, 'auth_handler.py');
    assert.strictEqual(data.review.language, 'python');
    assert.strictEqual(data.qualityScore.overall, 82);
    assert.strictEqual(data.qualityScore.grade, 'B');
    assert.strictEqual(data.algorithmicComplexity.timeComplexity, 'O(1)');
    assert.strictEqual(data.algorithmicComplexity.spaceComplexity, 'O(1)');

    // Findings
    assert.ok(data.findings, 'Must contain findings object');
    assert.strictEqual(data.findings.security.length, 1);
    const secFinding = data.findings.security[0];
    assert.strictEqual(secFinding.ruleId, 'SEC-PY-SQL-002');
    assert.strictEqual(secFinding.cwe, 'CWE-89');
    assert.strictEqual(secFinding.owaspCategory, 'A03:2021-Injection');
    assert.strictEqual(secFinding.confidence, 'HIGH');
    assert.ok(secFinding.remediation.length > 0);

    // Applied Fixes
    assert.strictEqual(data.appliedFixes.length, 1);
    assert.strictEqual(data.appliedFixes[0].ruleId, 'SEC-PY-SQL-002');
    assert.strictEqual(data.appliedFixes[0].lineStart, 6);

    // Code & Diff
    assert.strictEqual(data.code.hasModifications, true);
    assert.ok(data.code.diffSummary.addedLines > 0);
  });

  // TEST 4: Authenticated Markdown Export
  it('4. GET /api/v1/reviews/:id/export?format=markdown returns 200, text/markdown, and GFM content', async () => {
    const res = await makeRequest(`/api/v1/reviews/${reviewA._id}/export?format=markdown`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /text\/markdown/);
    assert.match(res.headers['content-disposition'], /attachment; filename="audit-report-.*\.md"/);

    const md = res.rawBody;
    assert.match(md, /# AI Code Review — Audit & Security Inspection Report/);
    assert.match(md, /> \*\*Target File:\*\* `auth_handler\.py`/);
    assert.match(md, /Grade B/);
    assert.match(md, /SEC-PY-SQL-002/);
    assert.match(md, /CWE-89/);
    assert.match(md, /A03:2021-Injection/);
    assert.match(md, /Applied Remediations History/);
  });

  // TEST 5: Default Format Fallback (query param omitted)
  it('5. GET /api/v1/reviews/:id/export defaults to JSON format when format query parameter is omitted', async () => {
    const res = await makeRequest(`/api/v1/reviews/${reviewA._id}/export`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.strictEqual(typeof res.body, 'object');
    assert.strictEqual(res.body.review.id, reviewA._id.toString());
  });

  // TEST 6: Zod Query Validation on Unsupported Format
  it('6. GET /api/v1/reviews/:id/export?format=xml returns 400 Bad Request with user-safe error', async () => {
    const res = await makeRequest(`/api/v1/reviews/${reviewA._id}/export?format=xml`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error?.message || res.body.message);
  });

  // TEST 7: Review ID Format Validation
  it('7. GET /api/v1/reviews/invalid-hex-id/export returns 400 Bad Request', async () => {
    const res = await makeRequest(`/api/v1/reviews/invalid-hex-id/export?format=json`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  // TEST 8: Missing Review Handling (404)
  it('8. GET /api/v1/reviews/:id/export returns 404 when review ID does not exist', async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const res = await makeRequest(`/api/v1/reviews/${nonExistentId}/export?format=json`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  // TEST 9: Unauthorized Request (401)
  it('9. GET /api/v1/reviews/:id/export returns 401 when no JWT authentication token is provided', async () => {
    const res = await makeRequest(`/api/v1/reviews/${reviewA._id}/export?format=json`);

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  // TEST 10: Strict Tenant Isolation
  it('10. GET /api/v1/reviews/:id/export returns 404 when Developer B attempts to export Developer A review', async () => {
    const res = await makeRequest(`/api/v1/reviews/${reviewA._id}/export?format=json`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  // TEST 11: Zero Sensitive Secrets or Internal Attributes Exposed
  it('11. JSON export payload never exposes user password, JWT tokens, internal MongoDB __v, or connection URI', async () => {
    const res = await makeRequest(`/api/v1/reviews/${reviewA._id}/export?format=json`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    const jsonStr = JSON.stringify(res.body);
    assert.strictEqual(jsonStr.includes('passwordHash'), false, 'passwordHash must never be exposed');
    assert.strictEqual(jsonStr.includes(env.MONGODB_URI), false, 'MONGODB_URI must never be exposed');
    assert.strictEqual(jsonStr.includes(env.JWT_SECRET), false, 'JWT_SECRET must never be exposed');
    assert.strictEqual(jsonStr.includes('__v'), false, 'Mongoose __v must never be exposed');
  });
});
