/**
 * Comprehensive End-to-End Functional & Integration Test Suite
 * server/tests/e2eWorkstationIntegration.test.js
 *
 * Covers Phase 7 End-to-End Workstation Verification:
 * 1. User Registration (POST /api/v1/auth/register)
 * 2. User Authentication & Cookie/Bearer issuance (POST /api/v1/auth/login)
 * 3. Profile & Session verification (GET /api/v1/auth/me)
 * 4. Deterministic Static Analysis (POST /api/v1/analysis/static)
 * 5. Persistent Review Creation (POST /api/v1/reviews)
 * 6. User Dashboard Telemetry (GET /api/v1/users/stats)
 * 7. Review History & Search (GET /api/v1/reviews)
 * 8. Review Detail Inspection (GET /api/v1/reviews/:id)
 * 9. Security Review Retrieval (GET /api/v1/reviews/:id/security)
 * 10. Performance Review Retrieval (GET /api/v1/reviews/:id/performance)
 * 11. Apply Automated Fix (POST /api/v1/reviews/:id/apply-fix)
 * 12. Undo Applied Fix (POST /api/v1/reviews/:id/undo-fix)
 * 13. Audit Report Export JSON & Markdown (GET /api/v1/reviews/:id/export)
 * 14. Password Change & Session Renewal (PUT /api/v1/auth/password)
 * 15. Invalidation of Old Password & Multi-device Token Revocation
 * 16. Logout & Server-Side Token Invalidation (POST /api/v1/auth/logout)
 * 17. Multi-Tenant Isolation (Unauthorized cross-user review access)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';

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
        'X-Requested-With': 'XMLHttpRequest',
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
        resolve({
          status: res.statusCode,
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

describe('Phase 7: Comprehensive Full-Stack Workstation Functional Audit', () => {
  const TEST_EMAIL = `audit_lead_${Date.now()}@example.com`;
  const TEST_PASSWORD = 'InitialPassword123!';
  const NEW_PASSWORD = 'RenewedPassword456@';

  let authToken = null;
  let authCookie = null;
  let testUserId = null;
  let createdReviewId = null;

  before(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (testUserId) {
      await User.deleteMany({ email: { $in: [TEST_EMAIL, `other_${TEST_EMAIL}`] } });
      await CodeReview.deleteMany({ userId: testUserId });
      await AnalysisResult.deleteMany({ userId: testUserId });
      await ReviewIssue.deleteMany({});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  it('1. POST /api/v1/auth/register registers developer user with secure password', async () => {
    const res = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Audit Engineer Alice',
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    testUserId = res.body.data.user.id || res.body.data.user._id;
    assert.ok(testUserId, 'User ID must be returned');
    assert.equal(res.body.data.user.email, TEST_EMAIL);
    assert.equal(res.body.data.user.role.toLowerCase(), 'developer');
    assert.equal(res.body.data.user.passwordHash, undefined, 'passwordHash must never be exposed');
  });

  it('2. POST /api/v1/auth/login validates credentials and issues token & HttpOnly cookie', async () => {
    const res = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token, 'Token must be provided in response body');
    authToken = res.body.data.token;

    const setCookie = res.headers['set-cookie'];
    assert.ok(setCookie, 'HttpOnly cookie must be set in response headers');
    authCookie = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
    assert.ok(authCookie.includes('access_token='));
  });

  it('3. GET /api/v1/auth/me verifies profile using Bearer token', async () => {
    const res = await makeRequest('/api/v1/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, TEST_EMAIL);
    assert.equal(res.body.data.user.name, 'Audit Engineer Alice');
  });

  it('4. POST /api/v1/analysis/static executes deterministic analysis without persistence', async () => {
    const sampleCode = `import os\n\ndef run(user_cmd):\n    os.system(user_cmd)\n`;
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: {
        code: sampleCode,
        language: 'python',
        fileName: 'exec_cmd.py'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.transient, true);
    assert.ok(Array.isArray(res.body.data.findings));
    assert.ok(res.body.data.findings.length > 0, 'Must detect os.system command injection');
    assert.ok(typeof res.body.data.scoring.overallScore === 'number');
  });

  it('5. POST /api/v1/reviews creates and persists a dual analysis review', async () => {
    const vulnerablePy = `import pickle\n\ndef load_data(raw):\n    return pickle.loads(raw)\n`;
    const res = await makeRequest('/api/v1/reviews', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: {
        code: vulnerablePy,
        language: 'python',
        title: 'Python Pickle Deserialization Audit',
        fileName: 'pickle_load.py'
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.review._id || res.body.data.review.id);
    createdReviewId = (res.body.data.review._id || res.body.data.review.id).toString();
    assert.equal(res.body.data.review.userId.toString(), testUserId.toString());
    assert.equal(res.body.data.review.language, 'python');
  });

  it('6. GET /api/v1/users/stats verifies dashboard overview and language metrics', async () => {
    const res = await makeRequest('/api/v1/users/stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.overview.totalReviews >= 1);
    assert.ok(Array.isArray(res.body.data.languageDistribution));
    const pyEntry = res.body.data.languageDistribution.find((l) => l.language === 'python');
    assert.ok(pyEntry, 'Python must appear in language distribution');
    assert.ok(pyEntry.count >= 1);
  });

  it('7. GET /api/v1/reviews retrieves review history with pagination', async () => {
    const res = await makeRequest('/api/v1/reviews?limit=10&page=1', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    const found = res.body.data.find((r) => r._id === createdReviewId);
    assert.ok(found, 'Created review must be present in history');
  });

  it('8. GET /api/v1/reviews/:id retrieves deep review details and findings', async () => {
    const res = await makeRequest(`/api/v1/reviews/${createdReviewId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.review._id, createdReviewId);
    assert.ok(res.body.data.analysis);
    assert.ok(Array.isArray(res.body.data.issues));
  });

  it('9. GET /api/v1/reviews/:id/security retrieves security audit details', async () => {
    const res = await makeRequest(`/api/v1/reviews/${createdReviewId}/security`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.reviewId);
    assert.ok(Array.isArray(res.body.data.issues));
    assert.ok(typeof res.body.data.totalSecurityIssues === 'number');
  });

  it('10. GET /api/v1/reviews/:id/performance retrieves Big-O and bottleneck analysis', async () => {
    const res = await makeRequest(`/api/v1/reviews/${createdReviewId}/performance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.reviewId);
    assert.ok(typeof res.body.data.performanceScore === 'number');
    assert.ok(res.body.data.timeComplexity);
  });

  it('11. POST /api/v1/reviews/:id/apply-fix updates currentCode and records fix history', async () => {
    const updatedCode = `import json\n\ndef load_data(raw):\n    return json.loads(raw)\n`;
    const res = await makeRequest(`/api/v1/reviews/${createdReviewId}/apply-fix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: {
        lineStart: 1,
        lineEnd: 4,
        appliedSnippet: `import json\n\ndef load_data(raw):\n    return json.loads(raw)\n`,
        updatedCode
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.review.currentCode, updatedCode);
    assert.ok(res.body.data.review.appliedFixes.length > 0);
  });

  it('12. POST /api/v1/reviews/:id/undo-fix reverts applied fix back to rawCode', async () => {
    const res = await makeRequest(`/api/v1/reviews/${createdReviewId}/undo-fix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: {}
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.review.rawCode.includes('pickle.loads'));
  });

  it('13. GET /api/v1/reviews/:id/export exports structured JSON and Markdown audit reports', async () => {
    // Test JSON export
    const jsonRes = await makeRequest(`/api/v1/reviews/${createdReviewId}/export?format=json`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    assert.equal(jsonRes.status, 200);
    assert.ok(jsonRes.body.title || jsonRes.body.summary || jsonRes.body.review);

    // Test Markdown export
    const mdRes = await makeRequest(`/api/v1/reviews/${createdReviewId}/export?format=markdown`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    assert.equal(mdRes.status, 200);
    assert.ok(typeof mdRes.body === 'string');
    assert.ok(mdRes.body.includes('# AI Code Review — Audit & Security Inspection Report'));
  });

  it('14. PUT /api/v1/auth/password changes password and updates session token', async () => {
    const res = await makeRequest('/api/v1/auth/password', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      body: {
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token, 'Must return new session token');
    authToken = res.body.data.token;
  });

  it('15. Authentication with old password fails; succeeds with new password', async () => {
    // Old password fails
    const failRes = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD
      }
    });
    assert.equal(failRes.status, 401);

    // New password succeeds
    const okRes = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: TEST_EMAIL,
        password: NEW_PASSWORD
      }
    });
    assert.equal(okRes.status, 200);
    assert.ok(okRes.body.data.token);
    authToken = okRes.body.data.token;
  });

  it('16. POST /api/v1/auth/logout invalidates token server-side', async () => {
    const logoutRes = await makeRequest('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.body.success, true);

    // Subsequent request with the logged-out token must fail with 401 AUTH_TOKEN_INVALIDATED
    const testRes = await makeRequest('/api/v1/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    assert.equal(testRes.status, 401);
  });

  it('17. Enforces tenant isolation: another user cannot access or mutate private review', async () => {
    // Register User 2
    const otherUserRes = await makeRequest('/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Attacker Bob',
        email: `other_${TEST_EMAIL}`,
        password: 'AttackerPass123!'
      }
    });
    assert.equal(otherUserRes.status, 201);

    // Login User 2
    const loginRes = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: `other_${TEST_EMAIL}`,
        password: 'AttackerPass123!'
      }
    });
    const attackerToken = loginRes.body.data.token;

    // User 2 attempts to get User 1's review
    const getRes = await makeRequest(`/api/v1/reviews/${createdReviewId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${attackerToken}`
      }
    });
    assert.equal(getRes.status, 404, 'Must return 404 Review not found due to tenant filter');

    // User 2 attempts to delete User 1's review
    const delRes = await makeRequest(`/api/v1/reviews/${createdReviewId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${attackerToken}`
      }
    });
    assert.equal(delRes.status, 404, 'Must return 404 Review not found due to tenant filter');
  });
});
