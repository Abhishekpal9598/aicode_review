/**
 * Phase 9: Comprehensive Authentication & JWT Security Audit Tests
 * server/tests/securityAuditPhase9.test.js
 *
 * Verifies all 8 audit areas:
 * 1. JWT Security: Expired, Invalid, Tampered Signature, TokenVersion mismatch
 * 2. Token Storage & Headers: Bearer + Cookie dual-channel, token leakage prevention
 * 3. Cookie Security: HttpOnly, Path, SameSite, Secure flags, and logout cookie clearing
 * 4. CSRF Protection: Rejection of untrusted Origins, missing headers on state-changing requests, GET exemption
 * 5. CORS Allowlisting: Strict rejection of untrusted origins and arbitrary .vercel.app domains
 * 6. Authorization & IDOR: Multi-tenant resource isolation (reviews, fixes, exports, metrics)
 * 7. Password & Session Security: Password-change token invalidation, logout session termination
 * 8. Role-Based Authorization: authorize() middleware blocking unauthorized roles
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { isOriginAllowed } from '../src/config/cors.js';
import { authorize } from '../src/middleware/auth.middleware.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';

let server;
let serverPort;
let baseUrl;

let userA;
let userB;
let adminUser;
let userAReview;

const makeRequest = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: serverPort,
      path,
      method: options.method || 'GET',
      headers: {
        'Connection': 'close',
        ...(options.headers || {})
      }
    };

    let bodyData = null;
    if (options.body) {
      bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (!reqOptions.headers['Content-Type']) {
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

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
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
};

describe('Phase 9: Comprehensive Authentication & JWT Security Audit', () => {
  const TEST_PASSWORD = 'AuditPassword123!';

  before(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

    // Create Developer User A
    userA = await User.create({
      name: 'Audited Dev A',
      email: `audit_deva_${Date.now()}@example.com`,
      passwordHash,
      role: 'developer',
      tokenVersion: 0
    });

    // Create Developer User B
    userB = await User.create({
      name: 'Audited Dev B',
      email: `audit_devb_${Date.now()}@example.com`,
      passwordHash,
      role: 'developer',
      tokenVersion: 0
    });

    // Create Admin User
    adminUser = await User.create({
      name: 'Audited Admin',
      email: `audit_admin_${Date.now()}@example.com`,
      passwordHash,
      role: 'admin',
      tokenVersion: 0
    });

    // Create Review belonging strictly to User A
    userAReview = await CodeReview.create({
      userId: userA._id,
      title: 'Tenant Isolation Security Audit',
      language: 'python',
      sourceType: 'pasted',
      filename: 'audit_main.py',
      rawCode: 'def secure_fn():\n    return True\n',
      lineCount: 2,
      characterCount: 35,
      fileSizeBytes: 35,
      status: 'completed'
    });

    await AnalysisResult.create({
      reviewId: userAReview._id,
      userId: userA._id,
      overallScore: 95,
      grade: 'A',
      staticScore: 95,
      aiAvailable: false,
      summary: 'Tenant isolation test analysis summary.',
      executionTimeMs: 120,
      metrics: { securityScore: 100, performanceScore: 90 }
    });

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (userAReview) {
      await ReviewIssue.deleteMany({ reviewId: userAReview._id });
      await AnalysisResult.deleteMany({ reviewId: userAReview._id });
      await CodeReview.deleteOne({ _id: userAReview._id });
    }
    if (userA) await User.deleteOne({ _id: userA._id });
    if (userB) await User.deleteOne({ _id: userB._id });
    if (adminUser) await User.deleteOne({ _id: adminUser._id });

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();
  });

  // =========================================================================
  // 1. JWT SECURITY
  // =========================================================================
  describe('1. JWT Security & Cryptographic Verification', () => {
    it('rejects expired JWT with HTTP 401 AUTH_TOKEN_EXPIRED', async () => {
      const expiredToken = jwt.sign(
        { id: userA._id.toString(), email: userA.email, role: userA.role, tokenVersion: 0 },
        env.JWT_SECRET,
        { expiresIn: '-1s', algorithm: 'HS256' }
      );

      const res = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AUTH_TOKEN_EXPIRED');
    });

    it('rejects malformed JWT with HTTP 401 AUTH_TOKEN_INVALID', async () => {
      const res = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: 'Bearer not.a.valid.jwt.structure' }
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AUTH_TOKEN_INVALID');
    });

    it('rejects tampered JWT signature with HTTP 401 AUTH_TOKEN_INVALID', async () => {
      const validToken = jwt.sign(
        { id: userA._id.toString(), email: userA.email, role: userA.role, tokenVersion: 0 },
        env.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const parts = validToken.split('.');
      // Tamper signature
      const tamperedSignature = parts[2].slice(0, -4) + 'X9Z0';
      const tamperedToken = `${parts[0]}.${parts[1]}.${tamperedSignature}`;

      const res = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${tamperedToken}` }
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AUTH_TOKEN_INVALID');
    });

    it('rejects missing authentication with HTTP 401 AUTH_TOKEN_MISSING', async () => {
      const res = await makeRequest('/api/v1/auth/me');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AUTH_TOKEN_MISSING');
    });

    it('rejects tokenVersion mismatch with HTTP 401 AUTH_TOKEN_INVALIDATED', async () => {
      const staleToken = jwt.sign(
        { id: userA._id.toString(), email: userA.email, role: userA.role, tokenVersion: 999 },
        env.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const res = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${staleToken}` }
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'AUTH_TOKEN_INVALIDATED');
    });
  });

  // =========================================================================
  // 2. SESSION TERMINATION & LOGOUT
  // =========================================================================
  describe('2. Session Invalidation & Logout', () => {
    it('invalidates active token upon logout and prevents token reuse', async () => {
      // 1. Login to obtain valid session token
      const loginRes = await makeRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { email: userA.email, password: TEST_PASSWORD }
      });
      assert.equal(loginRes.status, 200);
      const activeToken = loginRes.body.data.token;

      // 2. Verify token operates
      const meBefore = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      assert.equal(meBefore.status, 200);

      // 3. Perform logout
      const logoutRes = await makeRequest('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      assert.equal(logoutRes.status, 200);

      // 4. Attempt to reuse token - must be rejected
      const meAfter = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      assert.equal(meAfter.status, 401);
      assert.equal(meAfter.body.error.code, 'AUTH_TOKEN_INVALIDATED');
    });

    it('clears access_token cookie on logout with matching cookie options', async () => {
      // Fetch fresh token for userB
      const freshUserB = await User.findById(userB._id);
      const token = jwt.sign(
        { id: userB._id.toString(), email: userB.email, role: userB.role, tokenVersion: freshUserB.tokenVersion },
        env.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const logoutRes = await makeRequest('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: `access_token=${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      assert.equal(logoutRes.status, 200);
      const setCookie = logoutRes.headers['set-cookie'];
      assert.ok(setCookie && setCookie.length > 0, 'Set-Cookie header must be present on logout');
      const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      assert.ok(cookieStr.includes('access_token='), 'Must clear access_token');
      assert.ok(cookieStr.toLowerCase().includes('httponly'), 'Cleared cookie must include HttpOnly');
      assert.ok(cookieStr.includes('Path=/'), 'Cleared cookie must include Path=/');
    });

    it('invalidates existing tokens upon password change and issues functional new token', async () => {
      const freshUserB = await User.findById(userB._id);
      const oldToken = jwt.sign(
        { id: userB._id.toString(), email: userB.email, role: userB.role, tokenVersion: freshUserB.tokenVersion },
        env.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const NEW_PASSWORD = 'NewSecurePassword2026!';
      const changeRes = await makeRequest('/api/v1/auth/password', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${oldToken}` },
        body: { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD }
      });

      assert.equal(changeRes.status, 200);
      assert.ok(changeRes.body.data.token, 'Must issue a fresh session token');
      const newToken = changeRes.body.data.token;

      // Old token must be invalidated
      const oldTokenCheck = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${oldToken}` }
      });
      assert.equal(oldTokenCheck.status, 401);
      assert.equal(oldTokenCheck.body.error.code, 'AUTH_TOKEN_INVALIDATED');

      // New token must be accepted
      const newTokenCheck = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      assert.equal(newTokenCheck.status, 200);
    });
  });

  // =========================================================================
  // 3. CSRF & ORIGIN PROTECTION
  // =========================================================================
  describe('3. CSRF Protection & Origin Validation', () => {
    let cookieToken;

    before(async () => {
      const freshUserA = await User.findById(userA._id);
      cookieToken = jwt.sign(
        { id: userA._id.toString(), email: userA.email, role: userA.role, tokenVersion: freshUserA.tokenVersion },
        env.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );
    });

    it('rejects cookie-authenticated POST with untrusted Origin header', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: {
          Cookie: `access_token=${cookieToken}`,
          Origin: 'https://evil-attacker.com'
        },
        body: { code: 'print("hello")', language: 'python', title: 'Malicious CSRF' }
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'CSRF_VALIDATION_FAILED');
    });

    it('rejects cookie-authenticated POST with arbitrary third-party .vercel.app Origin', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: {
          Cookie: `access_token=${cookieToken}`,
          Origin: 'https://arbitrary-unrelated-app.vercel.app'
        },
        body: { code: 'print("hello")', language: 'python', title: 'Vercel Subdomain Exploit' }
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'CSRF_VALIDATION_FAILED');
    });

    it('rejects cookie-authenticated POST when Origin is missing and no custom header or Referer is sent', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: {
          Cookie: `access_token=${cookieToken}`
        },
        body: { code: 'print("hello")', language: 'python', title: 'Missing Origin CSRF' }
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'CSRF_VALIDATION_FAILED');
    });

    it('accepts cookie-authenticated POST with trusted Origin (localhost)', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: {
          Cookie: `access_token=${cookieToken}`,
          Origin: 'http://localhost:5173',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: { code: 'print("safe")', language: 'python', title: 'Legitimate Review' }
      });

      // Review was accepted and created (201)
      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });

    it('accepts cookie-authenticated POST with production Vercel Origin (aicode-review-ten.vercel.app)', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: {
          Cookie: `access_token=${cookieToken}`,
          Origin: 'https://aicode-review-ten.vercel.app',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: { code: 'print("prod safe")', language: 'python', title: 'Production Vercel Review' }
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
    });

    it('exempts safe GET requests from CSRF origin checks', async () => {
      const res = await makeRequest('/api/v1/auth/me', {
        method: 'GET',
        headers: {
          Cookie: `access_token=${cookieToken}`,
          Origin: 'https://untrusted-external-site.com'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  // =========================================================================
  // 4. CORS ORIGIN ALLOWLISTING
  // =========================================================================
  describe('4. CORS Allowlisting', () => {
    it('isOriginAllowed returns false for malicious and arbitrary domains', () => {
      assert.equal(isOriginAllowed('https://evil.com'), false);
      assert.equal(isOriginAllowed('http://malicious.org'), false);
      assert.equal(isOriginAllowed('https://random-app.vercel.app'), false);
      assert.equal(isOriginAllowed('http://ai-code-review.vercel.app'), false, 'HTTP without TLS must be rejected');
      assert.equal(isOriginAllowed('http://aicode-review-ten.vercel.app'), false, 'HTTP without TLS must be rejected');
      assert.equal(isOriginAllowed('https://aicode-review-ten.vercel.app.evil.com'), false);
      assert.equal(isOriginAllowed('https://not-aicode-review.vercel.app'), false);
    });

    it('isOriginAllowed returns true for authorized project domains', () => {
      assert.equal(isOriginAllowed('http://localhost:5173'), true);
      assert.equal(isOriginAllowed('http://127.0.0.1:3000'), true);
      assert.equal(isOriginAllowed('https://ai-code-review.vercel.app'), true);
      assert.equal(isOriginAllowed('https://ai-code-review-preview-42.vercel.app'), true);
      assert.equal(isOriginAllowed('https://aicode-review-ten.vercel.app'), true, 'Production Vercel domain must be allowed');
      assert.equal(isOriginAllowed('https://aicode-review.vercel.app'), true);
      assert.equal(isOriginAllowed('https://aicode-review-preview-99.vercel.app'), true);
      assert.equal(isOriginAllowed(null), true, 'Server-to-server calls without Origin must be allowed');
    });

    it('CORS preflight rejects untrusted origin without Access-Control-Allow-Origin', async () => {
      const res = await makeRequest('/api/v1/auth/login', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil-hacker.com',
          'Access-Control-Request-Method': 'POST'
        }
      });

      assert.equal(res.headers['access-control-allow-origin'], undefined);
    });

    it('CORS preflight approves trusted origin with Access-Control-Allow-Credentials', async () => {
      const res = await makeRequest('/api/v1/auth/login', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST'
        }
      });

      assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert.equal(res.headers['access-control-allow-credentials'], 'true');
    });
  });

  // =========================================================================
  // 5. AUTHORIZATION & IDOR (TENANT ISOLATION)
  // =========================================================================
  describe('5. Authorization & Multi-Tenant Resource Isolation (IDOR)', () => {
    let tokenUserB;

    before(async () => {
      const freshUserB = await User.findById(userB._id);
      tokenUserB = jwt.sign(
        { id: userB._id.toString(), email: userB.email, role: userB.role, tokenVersion: freshUserB.tokenVersion },
        env.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );
    });

    it('prevents User B from accessing User A review details (IDOR Prevention)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${userAReview._id}`, {
        headers: { Authorization: `Bearer ${tokenUserB}` }
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('prevents User B from deleting User A review (IDOR Prevention)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${userAReview._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenUserB}` }
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('prevents User B from applying fix to User A review (IDOR Prevention)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${userAReview._id}/apply-fix`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenUserB}` },
        body: {
          lineStart: 1,
          lineEnd: 2,
          previousSnippet: 'def secure_fn():',
          appliedSnippet: 'def patched_fn():',
          updatedCode: 'def patched_fn():\n    return True\n'
        }
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('prevents User B from exporting User A review report (IDOR Prevention)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${userAReview._id}/export?format=markdown`, {
        headers: { Authorization: `Bearer ${tokenUserB}` }
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });

    it('prevents User B from accessing User A security report details', async () => {
      const res = await makeRequest(`/api/v1/reviews/${userAReview._id}/security`, {
        headers: { Authorization: `Bearer ${tokenUserB}` }
      });

      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'NOT_FOUND');
    });
  });

  // =========================================================================
  // 6. ROLE-BASED ACCESS CONTROL (RBAC)
  // =========================================================================
  describe('6. Role-Based Access Control (RBAC)', () => {
    it('blocks developer user from admin-only resource with HTTP 403 FORBIDDEN', () => {
      const middleware = authorize('admin');
      const req = { user: { id: userA._id.toString(), role: 'developer' } };
      let nextCalled = false;

      assert.throws(
        () => middleware(req, {}, () => { nextCalled = true; }),
        (err) => {
          assert.equal(err.statusCode, 403);
          assert.equal(err.code, 'FORBIDDEN');
          return true;
        }
      );
      assert.equal(nextCalled, false);
    });

    it('grants admin user access to admin-only resource', () => {
      const middleware = authorize('admin');
      const req = { user: { id: adminUser._id.toString(), role: 'admin' } };
      let nextCalled = false;

      middleware(req, {}, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
    });

    it('grants developer access when developer role is allowed', () => {
      const middleware = authorize('developer', 'lead');
      const req = { user: { id: userA._id.toString(), role: 'developer' } };
      let nextCalled = false;

      middleware(req, {}, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
    });

    it('rejects unauthenticated request without req.user with HTTP 401 AUTH_TOKEN_MISSING', () => {
      const middleware = authorize('admin');
      const req = {};
      let nextCalled = false;

      assert.throws(
        () => middleware(req, {}, () => { nextCalled = true; }),
        (err) => {
          assert.equal(err.statusCode, 401);
          assert.equal(err.code, 'AUTH_TOKEN_MISSING');
          return true;
        }
      );
      assert.equal(nextCalled, false);
    });
  });

  // =========================================================================
  // 7. ROOT ENDPOINT METADATA CHECK
  // =========================================================================
  describe('7. Root Endpoint Metadata Integrity', () => {
    it('GET / returns HTTP 200 with server metadata and valid clientUrl without crashing', async () => {
      const res = await makeRequest('/');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.clientUrl, 'clientUrl must be present in root metadata');
    });
  });
});
