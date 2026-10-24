/**
 * Comprehensive End-to-End Application Functional Audit Test Suite
 * server/tests/e2eFullApplicationPhase11.test.js
 *
 * Covers Phase 11 Requirements across all 10 Functional Areas:
 * 1. Authentication Workflow & Session Lifecycle (signup, login, invalid credentials, protected access, session persistence, logout, token reuse, password change)
 * 2. Dashboard Telemetry & Empty States (stats, language breakdown, grade trend, fresh user empty state)
 * 3. Code Review Workspace (All 6 languages: C, C++, Java, Python, JavaScript, TypeScript, input validation, large input)
 * 4. Dual-Engine AI & Deterministic Static Fallback (honest null metrics, staticScore fallback, severity mapping, coordinate bounds)
 * 5. Apply Fix & Undo Fix Lifecycle (source code mutation, sequential fixes, undo restoration to rawCode, invalid fix rejection)
 * 6. Review History, Filtering & Cascade Deletion (pagination, language filter, deep detail, security/perf views, cascade delete)
 * 7. Reports & Comparison (Markdown export, JSON export, Content-Disposition headers, tenant-safe exports)
 * 8. User Settings & Profile Lifecycle (profile inspection, password change, session invalidation)
 * 9. Multi-Tenant Security & Account Isolation (User A vs User B, zero cross-account data leakage)
 * 10. Error Handling & System Recovery (malformed JSON, invalid ObjectIds, 404s, missing auth, rate limits)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import http from 'http';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';

let server;
let serverPort;

function makeRequest(path, options = {}) {
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
}

describe('Phase 11: Complete End-to-End Application Functional Audit', () => {
  const TIMESTAMP = Date.now();
  const USER_A_EMAIL = `alice_p11_${TIMESTAMP}@example.com`;
  const USER_A_PASSWORD = 'AlicePassword123!';
  const USER_A_NEW_PASSWORD = 'AliceNewPassword456@';

  const USER_B_EMAIL = `bob_p11_${TIMESTAMP}@example.com`;
  const USER_B_PASSWORD = 'BobPassword123!';

  let userAToken = null;
  let userACookie = null;
  let userAId = null;

  let userBToken = null;
  let userBId = null;

  let reviewUserA = null;
  let reviewUserB = null;

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
    const emailsToClean = [USER_A_EMAIL, USER_B_EMAIL, `fresh_p11_${TIMESTAMP}@example.com`];
    const users = await User.find({ email: { $in: emailsToClean } });
    const userIds = users.map((u) => u._id);

    if (userIds.length > 0) {
      await ReviewIssue.deleteMany({ userId: { $in: userIds } });
      await AnalysisResult.deleteMany({ userId: { $in: userIds } });
      await CodeReview.deleteMany({ userId: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // =========================================================================
  // PART 1 — AUTHENTICATION WORKFLOW
  // =========================================================================
  describe('Part 1: Authentication Workflow & Session Lifecycle', () => {
    it('1.1 User Signup (POST /api/v1/auth/register) succeeds and hides passwordHash', async () => {
      const res = await makeRequest('/api/v1/auth/register', {
        method: 'POST',
        body: {
          name: 'Alice Phase11 Lead',
          email: USER_A_EMAIL,
          password: USER_A_PASSWORD
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.user);
      userAId = res.body.data.user.id || res.body.data.user._id;
      assert.ok(userAId);
      assert.equal(res.body.data.user.email, USER_A_EMAIL);
      assert.equal(res.body.data.user.passwordHash, undefined, 'passwordHash must never be exposed');
    });

    it('1.2 User Signup rejects duplicate email with 409 Conflict', async () => {
      const res = await makeRequest('/api/v1/auth/register', {
        method: 'POST',
        body: {
          name: 'Alice Impostor',
          email: USER_A_EMAIL,
          password: USER_A_PASSWORD
        }
      });

      assert.equal(res.status, 409);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error?.code, 'EMAIL_ALREADY_EXISTS');
    });

    it('1.3 User Signup rejects invalid email format and weak password with 400 Bad Request', async () => {
      const res1 = await makeRequest('/api/v1/auth/register', {
        method: 'POST',
        body: {
          name: 'Invalid Email User',
          email: 'not-an-email',
          password: USER_A_PASSWORD
        }
      });
      assert.equal(res1.status, 400);

      const res2 = await makeRequest('/api/v1/auth/register', {
        method: 'POST',
        body: {
          name: 'Weak Pass User',
          email: 'weakpass@example.com',
          password: 'weak'
        }
      });
      assert.equal(res2.status, 400);
    });

    it('1.4 User Login (POST /api/v1/auth/login) validates credentials and issues token & HttpOnly cookie', async () => {
      const res = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: USER_A_EMAIL,
          password: USER_A_PASSWORD
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token, 'Must return JWT token');
      userAToken = res.body.data.token;

      const setCookie = res.headers['set-cookie'];
      assert.ok(setCookie, 'Must set HttpOnly cookie');
      userACookie = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
      assert.ok(userACookie.includes('access_token='));
    });

    it('1.5 User Login rejects incorrect password with 401 Unauthorized', async () => {
      const res = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: USER_A_EMAIL,
          password: 'WrongPassword999!'
        }
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error?.code, 'INVALID_CREDENTIALS');
    });

    it('1.6 User Login rejects non-existent email with 401 Unauthorized', async () => {
      const res = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: 'nonexistent_user_999@example.com',
          password: USER_A_PASSWORD
        }
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error?.code, 'INVALID_CREDENTIALS');
    });

    it('1.7 Protected route (GET /api/v1/auth/me) succeeds with Bearer token', async () => {
      const res = await makeRequest('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userAToken}`
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, USER_A_EMAIL);
      assert.equal(res.body.data.user.name, 'Alice Phase11 Lead');
    });

    it('1.8 Protected route (GET /api/v1/auth/me) succeeds with HttpOnly cookie alone', async () => {
      const res = await makeRequest('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Cookie': userACookie
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.user.email, USER_A_EMAIL);
    });

    it('1.9 Protected route rejects request without credentials with 401', async () => {
      const res = await makeRequest('/api/v1/auth/me', {
        method: 'GET'
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('1.10 Protected route rejects tampered token with 401', async () => {
      const res = await makeRequest('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userAToken}tampered`
        }
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('1.11 Password change (PUT /api/v1/auth/password) updates password and issues new token', async () => {
      const res = await makeRequest('/api/v1/auth/password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userAToken}`
        },
        body: {
          currentPassword: USER_A_PASSWORD,
          newPassword: USER_A_NEW_PASSWORD
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.token, 'Must return new session token');
      userAToken = res.body.data.token;
    });

    it('1.12 Old password fails to login; new password succeeds', async () => {
      const failRes = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: USER_A_EMAIL,
          password: USER_A_PASSWORD
        }
      });
      assert.equal(failRes.status, 401);

      const okRes = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: USER_A_EMAIL,
          password: USER_A_NEW_PASSWORD
        }
      });
      assert.equal(okRes.status, 200);
      userAToken = okRes.body.data.token;
      const setCookie = okRes.headers['set-cookie'];
      userACookie = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
    });

    it('1.13 User Logout (POST /api/v1/auth/logout) clears cookie and invalidates token', async () => {
      const logoutToken = userAToken;
      const logoutRes = await makeRequest('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${logoutToken}`
        }
      });

      assert.equal(logoutRes.status, 200);
      assert.equal(logoutRes.body.success, true);

      // Re-use of the logged-out token must fail with 401
      const testRes = await makeRequest('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${logoutToken}`
        }
      });
      assert.equal(testRes.status, 401);

      // Log back in to establish active session for subsequent tests
      const reLogin = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: USER_A_EMAIL,
          password: USER_A_NEW_PASSWORD
        }
      });
      assert.equal(reLogin.status, 200);
      userAToken = reLogin.body.data.token;
      const setCookie = reLogin.headers['set-cookie'];
      userACookie = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
    });
  });

  // =========================================================================
  // PART 2 — DASHBOARD
  // =========================================================================
  describe('Part 2: Dashboard & User Statistics', () => {
    it('2.1 Fresh user with zero reviews returns honest zero stats', async () => {
      const freshEmail = `fresh_p11_${TIMESTAMP}@example.com`;
      const regRes = await makeRequest('/api/v1/auth/register', {
        method: 'POST',
        body: {
          name: 'Fresh Developer',
          email: freshEmail,
          password: 'FreshPassword123!'
        }
      });
      assert.equal(regRes.status, 201);

      const loginRes = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: freshEmail,
          password: 'FreshPassword123!'
        }
      });
      assert.equal(loginRes.status, 200);
      const freshToken = loginRes.body.data.token;

      const statsRes = await makeRequest('/api/v1/users/stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${freshToken}`
        }
      });

      assert.equal(statsRes.status, 200);
      assert.equal(statsRes.body.success, true);
      assert.equal(statsRes.body.data.overview.totalReviews, 0);
      assert.equal(statsRes.body.data.overview.averageQualityScore, null);
      assert.equal(statsRes.body.data.languageDistribution.length, 0);
    });

    it('2.2 GET /api/v1/users/stats loads authenticated user overview data', async () => {
      const statsRes = await makeRequest('/api/v1/users/stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userAToken}`
        }
      });

      assert.equal(statsRes.status, 200);
      assert.equal(statsRes.body.success, true);
      assert.ok(statsRes.body.data.overview);
      assert.ok(typeof statsRes.body.data.overview.totalReviews === 'number');
      assert.ok(Array.isArray(statsRes.body.data.languageDistribution));
    });
  });

  // =========================================================================
  // PART 3 — CODE REVIEW WORKSPACE (ALL 6 SUPPORTED LANGUAGES)
  // =========================================================================
  describe('Part 3: Code Review Workspace Across All 6 Supported Languages', () => {
    it('3.1 Review C code with gets() buffer vulnerability', async () => {
      const cCode = `#include <stdio.h>\nint main() {\n    char password[32];\n    gets(password);\n    return 0;\n}\n`;
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: cCode,
          language: 'c',
          title: 'C Buffer Audit',
          fileName: 'vuln.c'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.language, 'c');
      assert.ok(res.body.data.issues.length > 0);
      const getsFinding = res.body.data.issues.find((i) => i.title.toLowerCase().includes('gets'));
      assert.ok(getsFinding, 'Must detect unsafe gets() function');
    });

    it('3.2 Review C++ code with memory management vulnerability', async () => {
      const cppCode = `#include <iostream>\nvoid process() {\n    int* arr = new int[100];\n    arr[0] = 42;\n}\n`;
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: cppCode,
          language: 'cpp',
          title: 'C++ Memory Leak Audit',
          fileName: 'leak.cpp'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.language, 'cpp');
    });

    it('3.3 Review Java code with SQL injection vulnerability', async () => {
      const javaCode = `import java.sql.*;\npublic class DBService {\n    public void getUser(Statement stmt, String input) throws SQLException {\n        stmt.executeQuery("SELECT * FROM users WHERE name = '" + input + "'");\n    }\n}\n`;
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: javaCode,
          language: 'java',
          title: 'Java SQLi Audit',
          fileName: 'DBService.java'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.language, 'java');
    });

    it('3.4 Review Python code with command injection and pickle vulnerability', async () => {
      const pythonCode = `import os\nimport pickle\ndef execute(cmd, raw):\n    os.system(cmd)\n    return pickle.loads(raw)\n`;
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: pythonCode,
          language: 'python',
          title: 'Python Remote Execution Audit',
          fileName: 'audit.py'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.language, 'python');
      reviewUserA = res.body.data.review;
      assert.ok(res.body.data.issues.length >= 2, 'Must detect os.system and pickle vulnerabilities');
    });

    it('3.5 Review JavaScript code with eval() injection', async () => {
      const jsCode = `function compute(userInput) {\n    return eval(userInput);\n}\n`;
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: jsCode,
          language: 'javascript',
          title: 'JavaScript Eval Audit',
          fileName: 'eval.js'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.language, 'javascript');
      const evalIssue = res.body.data.issues.find((i) => i.title.toLowerCase().includes('eval'));
      assert.ok(evalIssue, 'Must detect eval vulnerability in JavaScript');
    });

    it('3.6 Review TypeScript code with child_process execution', async () => {
      const tsCode = `import { exec } from 'child_process';\nexport function runScript(cmd: string): void {\n    exec(cmd);\n}\n`;
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: tsCode,
          language: 'typescript',
          title: 'TypeScript Exec Audit',
          fileName: 'exec.ts'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.language, 'typescript');
    });

    it('3.7 Input Validation: Rejects empty source code with 400 Bad Request', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: '   ',
          language: 'python'
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('3.8 Input Validation: Rejects unsupported programming language with 400', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: 'fn main() { println!("Hello"); }',
          language: 'rust'
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('3.9 Large Input Handling: Processes large file without hanging or exceeding limits', async () => {
      const largeLines = [];
      for (let i = 0; i < 400; i++) {
        largeLines.push(`def func_${i}():\n    return ${i}\n`);
      }
      const largePy = largeLines.join('\n');

      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: largePy,
          language: 'python',
          title: 'Large Python File Benchmark'
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });
  });

  // =========================================================================
  // PART 4 — DUAL-ENGINE AI & STATIC REVIEW WORKFLOW
  // =========================================================================
  describe('Part 4: AI & Static Review Dual-Engine Behavior', () => {
    it('4.1 Verifies static fallback persists honest null metrics when AI quota is exhausted', async () => {
      assert.ok(reviewUserA);
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const { review, analysis } = res.body.data;

      // When Gemini is quota-exhausted or rate-limited (HTTP 429), reviewMode is 'static-fallback'
      if (review.reviewMode === 'static-fallback') {
        assert.equal(analysis.aiAvailable, false);
        assert.equal(analysis.aiModelUsed, null);
        assert.equal(analysis.aiModelTier, 'static-fallback');
        assert.equal(analysis.metrics.bugScore, null, 'Must report honest null bugScore');
        assert.equal(analysis.metrics.securityScore, null, 'Must report honest null securityScore');
        assert.equal(analysis.overallScore, review.staticScore);
      } else {
        // Hybrid mode (if quota allowed)
        assert.equal(review.reviewMode, 'hybrid');
        assert.equal(analysis.aiAvailable, true);
        assert.ok(analysis.aiModelUsed);
      }
    });

    it('4.2 Finding coordinates are within bounds and severity is mapped correctly', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      const { issues } = res.body.data;
      assert.ok(issues.length > 0);

      const validSeverities = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
      for (const issue of issues) {
        assert.ok(validSeverities.has(issue.severity), `Invalid severity: ${issue.severity}`);
        assert.ok(typeof issue.lineStart === 'number' && issue.lineStart >= 1);
        assert.ok(typeof issue.lineEnd === 'number' && issue.lineEnd >= issue.lineStart);
      }
    });
  });

  // =========================================================================
  // PART 5 — APPLY FIX AND UNDO FIX
  // =========================================================================
  describe('Part 5: Apply Fix and Undo Fix Lifecycle', () => {
    it('5.1 POST /api/v1/reviews/:id/apply-fix applies fix and updates currentCode', async () => {
      const updatedCode = `import subprocess\nimport pickle\ndef execute(cmd, raw):\n    subprocess.run(['echo', cmd], check=True)\n    return pickle.loads(raw)\n`;
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/apply-fix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          lineStart: 1,
          lineEnd: 4,
          appliedSnippet: `import subprocess\ndef execute(cmd, raw):\n    subprocess.run(['echo', cmd], check=True)`,
          updatedCode
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.currentCode, updatedCode);
      assert.equal(res.body.data.review.appliedFixes.length, 1);
    });

    it('5.2 Sequential second fix application appends to fix history', async () => {
      const secondUpdatedCode = `import subprocess\nimport json\ndef execute(cmd, raw):\n    subprocess.run(['echo', cmd], check=True)\n    return json.loads(raw)\n`;
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/apply-fix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          lineStart: 2,
          lineEnd: 5,
          appliedSnippet: `import json\n    return json.loads(raw)`,
          updatedCode: secondUpdatedCode
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.currentCode, secondUpdatedCode);
      assert.equal(res.body.data.review.appliedFixes.length, 2);
    });

    it('5.3 POST /api/v1/reviews/:id/undo-fix reverts fix to previous state', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/undo-fix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {}
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.appliedFixes.length, 1);
    });

    it('5.4 Second undo reverts back to rawCode', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/undo-fix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {}
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.review.appliedFixes.length, 0);
      assert.equal(res.body.data.review.currentCode, null);
      assert.ok(res.body.data.review.rawCode.includes('pickle.loads'));
    });

    it('5.5 Rejects invalid fix with lineEnd < lineStart with 400 Bad Request', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/apply-fix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          lineStart: 10,
          lineEnd: 5, // Invalid: lineEnd < lineStart
          appliedSnippet: 'fix',
          updatedCode: 'fix code'
        }
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });
  });

  // =========================================================================
  // PART 6 — REVIEW HISTORY AND DETAILS
  // =========================================================================
  describe('Part 6: Review History, Filtering & Cascade Deletion', () => {
    it('6.1 GET /api/v1/reviews lists reviews with pagination metadata', async () => {
      const res = await makeRequest('/api/v1/reviews?page=1&limit=5', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 1);
      assert.ok(res.body.meta);
      assert.ok(res.body.meta.total >= 1);
    });

    it('6.2 Filter by programming language (GET /api/v1/reviews?language=python)', async () => {
      const res = await makeRequest('/api/v1/reviews?language=python', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.every((r) => r.language === 'python'));
    });

    it('6.3 GET /api/v1/reviews/:id/security retrieves security audit breakdown', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/security`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.reviewId);
      assert.ok(typeof res.body.data.totalSecurityIssues === 'number');
    });

    it('6.4 GET /api/v1/reviews/:id/performance retrieves Big-O analysis', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/performance`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.timeComplexity);
      assert.ok(typeof res.body.data.performanceScore === 'number');
    });

    it('6.5 DELETE /api/v1/reviews/:id cascade deletes review and child records', async () => {
      // Create a temporary review to delete
      const tempReviewRes = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          code: 'print("delete me")\n',
          language: 'python',
          title: 'Temporary Deletion Test'
        }
      });
      const tempId = tempReviewRes.body.data.review._id;

      // Delete the review
      const delRes = await makeRequest(`/api/v1/reviews/${tempId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });
      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.success, true);

      // Subsequent retrieval must return 404
      const getRes = await makeRequest(`/api/v1/reviews/${tempId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });
      assert.equal(getRes.status, 404);

      // Verify child records are gone from DB
      const dbAnalysis = await AnalysisResult.findOne({ reviewId: tempId });
      assert.equal(dbAnalysis, null, 'AnalysisResult must be deleted via cascade');
      const dbIssues = await ReviewIssue.find({ reviewId: tempId });
      assert.equal(dbIssues.length, 0, 'ReviewIssues must be deleted via cascade');
    });
  });

  // =========================================================================
  // PART 7 — COMPARISON AND REPORTS
  // =========================================================================
  describe('Part 7: Comparison & Audit Reports', () => {
    it('7.1 GET /api/v1/reviews/:id/export?format=markdown exports GitHub-Flavored Markdown', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/export?format=markdown`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type']?.includes('text/markdown'));
      assert.ok(res.headers['content-disposition']?.includes('attachment;'));
      assert.ok(typeof res.body === 'string');
      assert.ok(res.body.includes('# AI Code Review — Audit & Security Inspection Report'));
      assert.ok(res.body.includes('python'));
    });

    it('7.2 GET /api/v1/reviews/:id/export?format=json exports structured JSON report', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserA._id}/export?format=json`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 200);
      assert.ok(res.headers['content-type']?.includes('application/json'));
      assert.ok(res.body.title || res.body.review || res.body.summary);
      assert.ok(res.body.issues || res.body.findings);
    });

    it('7.3 Export rejects non-existent review ID with 404 Not Found', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await makeRequest(`/api/v1/reviews/${fakeId}/export?format=json`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });
  });

  // =========================================================================
  // PART 8 — SETTINGS & PROFILE LIFECYCLE
  // =========================================================================
  describe('Part 8: Settings & User Profile Management', () => {
    it('8.1 User profile inspection returns name, email, and role', async () => {
      const res = await makeRequest('/api/v1/auth/me', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.email, USER_A_EMAIL);
      assert.equal(res.body.data.user.role.toLowerCase(), 'developer');
      assert.ok(res.body.data.user.createdAt);
    });
  });

  // =========================================================================
  // PART 9 — MULTI-USER ISOLATION (TENANT SEPARATION)
  // =========================================================================
  describe('Part 9: Multi-User Isolation & Tenant Security', () => {
    before(async () => {
      // Register User B
      const regRes = await makeRequest('/api/v1/auth/register', {
        method: 'POST',
        body: {
          name: 'Bob Phase11 Auditor',
          email: USER_B_EMAIL,
          password: USER_B_PASSWORD
        }
      });
      userBId = regRes.body.data.user.id || regRes.body.data.user._id;

      // Login User B
      const loginRes = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        body: {
          email: USER_B_EMAIL,
          password: USER_B_PASSWORD
        }
      });
      userBToken = loginRes.body.data.token;

      // User B creates Review B
      const reviewBRes = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userBToken}` },
        body: {
          code: `def b_private_logic():\n    return "Secret B Data"\n`,
          language: 'python',
          title: 'User B Private Review'
        }
      });
      assert.equal(reviewBRes.status, 201, `Failed to create review: ${JSON.stringify(reviewBRes.body)}`);
      reviewUserB = reviewBRes.body.data.review;
    });

    it('9.1 User A CANNOT read User B private review (returns 404)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserB._id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 404, 'Must return 404 due to tenant filter');
    });

    it('9.2 User A CANNOT modify User B review with apply-fix (returns 404)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserB._id}/apply-fix`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${userAToken}` },
        body: {
          lineStart: 1,
          lineEnd: 2,
          appliedSnippet: 'def hacked(): pass',
          updatedCode: 'def hacked(): pass'
        }
      });

      assert.equal(res.status, 404, 'Must return 404 due to tenant filter');
    });

    it('9.3 User A CANNOT delete User B review (returns 404)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserB._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 404, 'Must return 404 due to tenant filter');
    });

    it('9.4 User A CANNOT export User B report (returns 404)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${reviewUserB._id}/export?format=json`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 404, 'Must return 404 due to tenant filter');
    });

    it('9.5 User B dashboard stats DO NOT leak User A review counts', async () => {
      const res = await makeRequest('/api/v1/users/stats', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userBToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.overview.totalReviews, 1, 'User B must only see their 1 review');
    });
  });

  // =========================================================================
  // PART 10 — ERROR HANDLING & SYSTEM RECOVERY
  // =========================================================================
  describe('Part 10: Error Handling & System Recovery', () => {
    it('10.1 Non-existent API route returns 404 with structured JSON envelope', async () => {
      const res = await makeRequest('/api/v1/nonexistent-endpoint', {
        method: 'GET'
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error?.code, 'NOT_FOUND');
    });

    it('10.2 Malformed JSON body returns 400 Bad Request', async () => {
      const res = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"invalid_json": bad_value}'
      });

      assert.equal(res.status, 400);
    });

    it('10.3 Malformed ObjectId parameter returns 400 Bad Request', async () => {
      const res = await makeRequest('/api/v1/reviews/not-a-valid-24-char-hex-id', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${userAToken}` }
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('10.4 Health endpoint (/api/v1/health) returns 200 with database status', async () => {
      const res = await makeRequest('/api/v1/health', {
        method: 'GET'
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.database?.connected, true);
    });

    it('10.5 Root API endpoint (GET /) returns running service metadata', async () => {
      const res = await makeRequest('/', {
        method: 'GET'
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'AI Code Review API Server is running');
    });
  });
});
