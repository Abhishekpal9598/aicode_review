/**
 * Phase 11: Editor Apply Fix & Undo + Review History Integration Test Suite
 * server/tests/applyFixRoutes.test.js
 *
 * Verifies:
 * 1. Authentication & Tenant Isolation on apply-fix and undo-fix endpoints
 * 2. Zod Schema Validation for coordinates and payloads
 * 3. Atomic persistence of applied fixes to review history
 * 4. Preservation of original rawCode across fix and undo cycles
 * 5. Sequential multiple fixes and LIFO undo operations
 * 6. Review retrieval consistency with appliedFixes and currentCode
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';

import app from '../src/app.js';
import { env } from '../src/config/env.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';
import { executeReview } from '../src/services/review.service.js';

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
        'Connection': 'close',
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
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
};

describe('Phase 11: Editor Apply Fix & Undo + Review History Integration', () => {
  let testUser;
  let otherUser;
  let userToken;
  let otherToken;
  let sampleReviewId;
  let sampleIssueId;
  const originalSourceCode = `import sqlite3

def get_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    query = "SELECT * FROM users WHERE username = '" + username + "'"
    cursor.execute(query)
    return cursor.fetchone()
`;

  before(async () => {
    const TEST_DB_URI = process.env.TEST_MONGODB_URI || env.MONGODB_URI;
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(TEST_DB_URI);
    }

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });

    // Create test users
    testUser = await User.create({
      name: 'Ada Lovelace',
      email: `ada_fix_${Date.now()}@test.dev`,
      passwordHash: '$2b$12$e8rUqE7UqB8h2s7F7F6YbeK8A4v7qJ8O7C7H8E7UqB8h2s7F7F6Yb'
    });

    otherUser = await User.create({
      name: 'Charles Babbage',
      email: `babbage_fix_${Date.now()}@test.dev`,
      passwordHash: '$2b$12$e8rUqE7UqB8h2s7F7F6YbeK8A4v7qJ8O7C7H8E7UqB8h2s7F7F6Yb'
    });

    userToken = jwt.sign(
      { id: testUser._id.toString(), email: testUser.email, role: testUser.role },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    otherToken = jwt.sign(
      { id: otherUser._id.toString(), email: otherUser.email, role: otherUser.role },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Create review with SQL injection finding
    const created = await executeReview({
      code: originalSourceCode,
      language: 'python',
      title: 'SQL Injection Test Review',
      fileName: 'auth.py',
      userId: testUser._id
    });

    sampleReviewId = created.review._id.toString();
    const issue = created.issues.find((i) => i.ruleId === 'SEC-INJ-001') || created.issues[0];
    sampleIssueId = issue ? issue._id?.toString() || issue.id : null;
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }

    if (testUser) await User.deleteOne({ _id: testUser._id });
    if (otherUser) await User.deleteOne({ _id: otherUser._id });
    if (sampleReviewId) {
      await CodeReview.deleteOne({ _id: sampleReviewId });
      await AnalysisResult.deleteOne({ reviewId: sampleReviewId });
      await ReviewIssue.deleteMany({ reviewId: sampleReviewId });
    }

    const disconnectedListeners = mongoose.connection.listeners('disconnected');
    for (const listener of disconnectedListeners) {
      mongoose.connection.removeListener('disconnected', listener);
    }
    await mongoose.disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. Authentication & Tenant Isolation
  // ---------------------------------------------------------------------------
  it('1. Returns 401 Unauthorized when POST /apply-fix lacks JWT token', async () => {
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/apply-fix`, {
      method: 'POST',
      body: {
        lineStart: 6,
        lineEnd: 6,
        appliedSnippet: '    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))',
        updatedCode: 'some updated code'
      }
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('2. Returns 400 Bad Request when review ID is not a valid ObjectId', async () => {
    const res = await makeRequest('/api/v1/reviews/not-a-valid-id/apply-fix', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        lineStart: 6,
        lineEnd: 6,
        appliedSnippet: 'valid snippet',
        updatedCode: 'valid code'
      }
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it('3. Returns 404 Not Found when review does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await makeRequest(`/api/v1/reviews/${fakeId}/apply-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        lineStart: 6,
        lineEnd: 6,
        appliedSnippet: 'valid snippet',
        updatedCode: 'valid code'
      }
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  it('4. Enforces tenant isolation: other user cannot apply fix to this review (404)', async () => {
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/apply-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: {
        lineStart: 6,
        lineEnd: 6,
        appliedSnippet: 'valid snippet',
        updatedCode: 'valid code'
      }
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  // ---------------------------------------------------------------------------
  // 2. Validation Checks
  // ---------------------------------------------------------------------------
  it('5. Rejects invalid line range where lineEnd < lineStart with 400', async () => {
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/apply-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        lineStart: 10,
        lineEnd: 5,
        appliedSnippet: 'valid snippet',
        updatedCode: 'valid code'
      }
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  it('6. Rejects empty appliedSnippet with 400', async () => {
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/apply-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        lineStart: 6,
        lineEnd: 6,
        appliedSnippet: '   ',
        updatedCode: 'valid code'
      }
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  // ---------------------------------------------------------------------------
  // 3. Applying Fixes & Preserving Original rawCode
  // ---------------------------------------------------------------------------
  it('7. Successfully applies a single fix and preserves original rawCode', async () => {
    const fixedLine = '    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))';
    const updatedCode = `import sqlite3

def get_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
${fixedLine}
    return cursor.fetchone()
`;

    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/apply-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        issueId: sampleIssueId,
        ruleId: 'SEC-INJ-001',
        lineStart: 6,
        lineEnd: 7,
        previousSnippet: 'query = "SELECT * FROM users WHERE username = \'" + username + "\'"',
        appliedSnippet: fixedLine,
        updatedCode
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.review);
    assert.ok(res.body.data.appliedFix);

    // Verify DB state
    const reviewInDb = await CodeReview.findById(sampleReviewId).lean();
    // CRITICAL: original rawCode MUST NOT BE OVERWRITTEN!
    assert.equal(reviewInDb.rawCode, originalSourceCode);
    assert.equal(reviewInDb.currentCode, updatedCode);
    assert.equal(reviewInDb.appliedFixes.length, 1);
    assert.equal(reviewInDb.appliedFixes[0].ruleId, 'SEC-INJ-001');
    assert.equal(reviewInDb.appliedFixes[0].lineStart, 6);
  });

  it('8. Supports multiple sequential fixes in the review session', async () => {
    const secondFixedCode = `# Optimized DB lookup
import sqlite3

def get_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    return cursor.fetchone()
`;

    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/apply-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        ruleId: 'QUAL-STYLE-001',
        lineStart: 1,
        lineEnd: 1,
        previousSnippet: 'import sqlite3',
        appliedSnippet: '# Optimized DB lookup\nimport sqlite3',
        updatedCode: secondFixedCode
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const reviewInDb = await CodeReview.findById(sampleReviewId).lean();
    assert.equal(reviewInDb.rawCode, originalSourceCode); // original code still preserved!
    assert.equal(reviewInDb.currentCode, secondFixedCode);
    assert.equal(reviewInDb.appliedFixes.length, 2);
    assert.equal(reviewInDb.appliedFixes[1].ruleId, 'QUAL-STYLE-001');
  });

  // ---------------------------------------------------------------------------
  // 4. Undo Fix Functionality
  // ---------------------------------------------------------------------------
  it('9. Returns 401 Unauthorized when POST /undo-fix lacks JWT token', async () => {
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/undo-fix`, {
      method: 'POST'
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('10. Enforces tenant isolation on undo-fix (404 for other user)', async () => {
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/undo-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` }
    });

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  it('11. Undoes the most recently applied fix in LIFO order', async () => {
    const intermediateCode = `import sqlite3

def get_user(username):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    return cursor.fetchone()
`;

    // Undo Fix 2 (QUAL-STYLE-001)
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/undo-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        restoredCode: intermediateCode
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.undoneFix.ruleId, 'QUAL-STYLE-001');

    const reviewInDb = await CodeReview.findById(sampleReviewId).lean();
    assert.equal(reviewInDb.rawCode, originalSourceCode); // rawCode strictly preserved
    assert.equal(reviewInDb.currentCode, intermediateCode);
    assert.equal(reviewInDb.appliedFixes.length, 1);
  });

  it('12. Undoes the remaining fix to restore original code state', async () => {
    // Undo Fix 1 (SEC-INJ-001)
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/undo-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.undoneFix.ruleId, 'SEC-INJ-001');

    const reviewInDb = await CodeReview.findById(sampleReviewId).lean();
    assert.equal(reviewInDb.rawCode, originalSourceCode);
    assert.equal(reviewInDb.currentCode, null); // restored to baseline
    assert.equal(reviewInDb.appliedFixes.length, 0);
  });

  it('13. Rejects undo-fix with 400 when applied fixes stack is empty', async () => {
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/undo-fix`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NO_FIXES_TO_UNDO');
  });

  it('14. GET /api/v1/reviews/:id returns review preserving rawCode', async () => {
    const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.review.rawCode, originalSourceCode);
    assert.deepEqual(res.body.data.review.appliedFixes, []);
  });
});
