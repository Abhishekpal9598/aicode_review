/**
 * Phase 17B Security Remediation Integration & Unit Tests
 * server/tests/securityRemediation17B.test.js
 *
 * Verifies Phase 17B Security Remediation:
 * 1. Task 1: Health Endpoint Rate Limiting & DB Status Caching
 * 2. Task 2: JWT Logout Invalidation (Cookie and Bearer)
 * 3. Task 3: Strict Input Validation (.strict() on register, login, staticAnalysis schemas)
 * 4. Task 4: JWT Algorithm Restriction (strict HS256 enforcement)
 * 5. Task 5: Password Security (length and complexity rules)
 * 6. Authorization, Token Expiration & Tenant Isolation
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
import { getCachedDBStatus, clearHealthDBCache } from '../src/controllers/health.controller.js';
import { registerSchema, loginSchema } from '../src/schemas/auth.schema.js';
import { staticAnalysisSchema } from '../src/schemas/analysis.schema.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';

let server;
let baseUrl;

const makeRequest = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    let bodyData = null;
    if (options.body) {
      bodyData = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
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

describe('Phase 17B: Security Remediation Tests', () => {
  let userA;
  let userB;
  let reviewB;

  before(async () => {
    await mongoose.connect(TEST_DB_URI);

    // Create test users
    userA = await User.create({
      name: 'Dev User A',
      email: `deva_${Date.now()}@security.test`,
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      tokenVersion: 0
    });

    userB = await User.create({
      name: 'Dev User B',
      email: `devb_${Date.now()}@security.test`,
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      tokenVersion: 0
    });

    // Create a review belonging to User B
    reviewB = await CodeReview.create({
      userId: userB._id,
      title: 'Tenant Isolation Test Review',
      sourceType: 'pasted',
      filename: 'tenant.py',
      language: 'python',
      rawCode: 'def test(): return 42',
      lineCount: 1,
      characterCount: 22,
      fileSizeBytes: 22,
      status: 'completed'
    });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (reviewB) {
      await CodeReview.deleteOne({ _id: reviewB._id });
    }
    if (userA) {
      await User.deleteOne({ _id: userA._id });
    }
    if (userB) {
      await User.deleteOne({ _id: userB._id });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.connection.close();
  });

  // =========================================================================
  // TASK 1: HEALTH ENDPOINT RATE LIMITING & DB CACHING
  // =========================================================================
  describe('Task 1: Health Endpoint Rate Limiting & DB Telemetry Caching', () => {
    test('GET /api/health returns 200 and healthy status', async () => {
      const res = await makeRequest('/api/health');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.status, 'healthy');
      assert.ok(res.headers['ratelimit-limit'], 'RateLimit-Limit header should be present');
    });

    test('GET /api/v1/health returns 200 with database telemetry', async () => {
      const res = await makeRequest('/api/v1/health');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.database.connected, true);
      assert.strictEqual(res.body.status, 'healthy');
      assert.ok(res.headers['ratelimit-limit'], 'RateLimit-Limit header should be present');
    });

    test('getCachedDBStatus caches database status to reduce overhead under load', () => {
      clearHealthDBCache();
      const status1 = getCachedDBStatus();
      assert.strictEqual(status1.connected, true);

      // Subsequent call within TTL returns same cached object
      const status2 = getCachedDBStatus();
      assert.strictEqual(status1, status2, 'Expected identical cached reference within TTL');

      // Force refresh returns fresh status
      const status3 = getCachedDBStatus(true);
      assert.strictEqual(status3.connected, true);
    });
  });

  // =========================================================================
  // TASK 2: JWT LOGOUT INVALIDATION (COOKIE & BEARER)
  // =========================================================================
  describe('Task 2: JWT Logout Invalidation (Cookie and Bearer)', () => {
    test('Logout invalidates Bearer token session via tokenVersion increment', async () => {
      // 1. Generate token with current tokenVersion (0)
      const token = jwt.sign(
        {
          id: userA._id.toString(),
          email: userA.email,
          role: userA.role,
          tokenVersion: userA.tokenVersion ?? 0
        },
        env.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      // 2. Verified token works before logout
      const beforeLogout = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(beforeLogout.statusCode, 200);
      assert.strictEqual(beforeLogout.body.data.user.email, userA.email);

      // 3. User logs out with Bearer token
      const logoutRes = await makeRequest('/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(logoutRes.statusCode, 200);
      assert.strictEqual(logoutRes.body.success, true);

      // 4. Verify token is now INVALIDATED for Bearer auth
      const afterLogout = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.strictEqual(afterLogout.statusCode, 401);
      assert.strictEqual(afterLogout.body.error.code, 'AUTH_TOKEN_INVALIDATED');

      // 5. Check user model tokenVersion incremented in database
      const updatedUser = await User.findById(userA._id);
      assert.strictEqual(updatedUser.tokenVersion, 1);

      // 6. New token issued with updated tokenVersion (1) works
      const newToken = jwt.sign(
        {
          id: userA._id.toString(),
          email: userA.email,
          role: userA.role,
          tokenVersion: updatedUser.tokenVersion
        },
        env.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const newSessionRes = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      assert.strictEqual(newSessionRes.statusCode, 200);
    });

    test('Logout invalidates Cookie token session', async () => {
      const freshUser = await User.findById(userA._id);
      const currentVer = freshUser.tokenVersion;

      const cookieToken = jwt.sign(
        {
          id: userA._id.toString(),
          email: userA.email,
          role: userA.role,
          tokenVersion: currentVer
        },
        env.JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      // Verified cookie works before logout
      const beforeRes = await makeRequest('/api/v1/auth/me', {
        headers: { Cookie: `access_token=${cookieToken}` }
      });
      assert.strictEqual(beforeRes.statusCode, 200);

      // Logout with Cookie + CSRF header
      const logoutRes = await makeRequest('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: `access_token=${cookieToken}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      assert.strictEqual(logoutRes.statusCode, 200);

      // Old cookie is now invalidated server-side
      const afterRes = await makeRequest('/api/v1/auth/me', {
        headers: { Cookie: `access_token=${cookieToken}` }
      });
      assert.strictEqual(afterRes.statusCode, 401);
      assert.strictEqual(afterRes.body.error.code, 'AUTH_TOKEN_INVALIDATED');
    });
  });

  // =========================================================================
  // TASK 3: STRICT INPUT VALIDATION (.strict())
  // =========================================================================
  describe('Task 3: Strict Input Validation (.strict())', () => {
    test('registerSchema rejects unexpected extra properties with HTTP 400', () => {
      const payloadWithExtra = {
        name: 'Valid Name',
        email: 'valid@developer.com',
        password: 'ValidPassword123!',
        injectedRole: 'admin',
        isSuperuser: true
      };

      const result = registerSchema.body.safeParse(payloadWithExtra);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.errors[0].code, 'unrecognized_keys');
    });

    test('registerSchema accepts valid registration payload', () => {
      const validPayload = {
        name: 'Valid Name',
        email: 'valid@developer.com',
        password: 'ValidPassword123!'
      };

      const result = registerSchema.body.safeParse(validPayload);
      assert.strictEqual(result.success, true);
    });

    test('loginSchema rejects unexpected extra properties with HTTP 400', () => {
      const payloadWithExtra = {
        email: 'valid@developer.com',
        password: 'ValidPassword123!',
        extraData: 'malicious'
      };

      const result = loginSchema.body.safeParse(payloadWithExtra);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.errors[0].code, 'unrecognized_keys');
    });

    test('loginSchema accepts valid login payload', () => {
      const validPayload = {
        email: 'valid@developer.com',
        password: 'ValidPassword123!'
      };

      const result = loginSchema.body.safeParse(validPayload);
      assert.strictEqual(result.success, true);
    });

    test('staticAnalysisSchema rejects unexpected extra properties with HTTP 400', () => {
      const payloadWithExtra = {
        code: 'def add(a, b): return a + b',
        language: 'python',
        injectedProperty: 'exploit'
      };

      const result = staticAnalysisSchema.body.safeParse(payloadWithExtra);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error.errors[0].code, 'unrecognized_keys');
    });

    test('staticAnalysisSchema accepts valid analysis payload', () => {
      const validPayload = {
        code: 'def add(a, b): return a + b',
        language: 'python',
        fileName: 'math.py',
        title: 'Math Utilities'
      };

      const result = staticAnalysisSchema.body.safeParse(validPayload);
      assert.strictEqual(result.success, true);
    });
  });

  // =========================================================================
  // TASK 4: JWT ALGORITHM RESTRICTION (HS256 ONLY)
  // =========================================================================
  describe('Task 4: JWT Algorithm Restriction', () => {
    test('Accepts valid HS256-signed tokens', async () => {
      const freshUser = await User.findById(userA._id);
      const hs256Token = jwt.sign(
        {
          id: userA._id.toString(),
          email: userA.email,
          role: userA.role,
          tokenVersion: freshUser.tokenVersion
        },
        env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      const res = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${hs256Token}` }
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    });

    test('Rejects tokens signed with "none" algorithm', async () => {
      // Create an unsigned "none" algorithm token (header.payload.)
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          id: userA._id.toString(),
          email: userA.email,
          role: userA.role,
          tokenVersion: 0
        })
      ).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${noneToken}` }
      });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error.code, 'AUTH_TOKEN_INVALID');
    });

    test('Rejects tokens signed with algorithms other than HS256 (e.g. HS384)', async () => {
      const hs384Token = jwt.sign(
        {
          id: userA._id.toString(),
          email: userA.email,
          role: userA.role,
          tokenVersion: 0
        },
        env.JWT_SECRET,
        { algorithm: 'HS384', expiresIn: '15m' }
      );

      const res = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${hs384Token}` }
      });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error.code, 'AUTH_TOKEN_INVALID');
    });
  });

  // =========================================================================
  // TASK 5: PASSWORD SECURITY & STRENGTH VALIDATION
  // =========================================================================
  describe('Task 5: Password Security & Strength Validation', () => {
    test('Rejects password shorter than 8 characters', () => {
      const result = registerSchema.body.safeParse({
        name: 'Dev Tester',
        email: 'test@dev.com',
        password: 'P@1s'
      });
      assert.strictEqual(result.success, false);
      const issue = result.error.errors.find((e) => e.path.includes('password'));
      assert.strictEqual(issue.message, 'Password must be at least 8 characters long');
    });

    test('Rejects password lacking uppercase letter', () => {
      const result = registerSchema.body.safeParse({
        name: 'Dev Tester',
        email: 'test@dev.com',
        password: 'password123!'
      });
      assert.strictEqual(result.success, false);
      const issue = result.error.errors.find((e) => e.message.includes('uppercase'));
      assert.ok(issue, 'Expected error requiring uppercase letter');
    });

    test('Rejects password lacking lowercase letter', () => {
      const result = registerSchema.body.safeParse({
        name: 'Dev Tester',
        email: 'test@dev.com',
        password: 'PASSWORD123!'
      });
      assert.strictEqual(result.success, false);
      const issue = result.error.errors.find((e) => e.message.includes('lowercase'));
      assert.ok(issue, 'Expected error requiring lowercase letter');
    });

    test('Rejects password lacking a number', () => {
      const result = registerSchema.body.safeParse({
        name: 'Dev Tester',
        email: 'test@dev.com',
        password: 'PasswordNoNumber!'
      });
      assert.strictEqual(result.success, false);
      const issue = result.error.errors.find((e) => e.message.includes('number'));
      assert.ok(issue, 'Expected error requiring number');
    });

    test('Rejects password lacking a special character', () => {
      const result = registerSchema.body.safeParse({
        name: 'Dev Tester',
        email: 'test@dev.com',
        password: 'Password12345'
      });
      assert.strictEqual(result.success, false);
      const issue = result.error.errors.find((e) => e.message.includes('special character'));
      assert.ok(issue, 'Expected error requiring special character');
    });

    test('Accepts strong password meeting all criteria', () => {
      const result = registerSchema.body.safeParse({
        name: 'Dev Tester',
        email: 'test@dev.com',
        password: 'StrongDevPassword2026!'
      });
      assert.strictEqual(result.success, true);
    });

    test('Validation errors never echo or expose the entered plaintext password', () => {
      const secretPassword = 'weak';
      const result = registerSchema.body.safeParse({
        name: 'Dev Tester',
        email: 'test@dev.com',
        password: secretPassword
      });
      assert.strictEqual(result.success, false);
      const errorString = JSON.stringify(result.error.errors);
      assert.ok(!errorString.includes(secretPassword), 'Password plaintext must never appear in validation error objects');
    });
  });

  // =========================================================================
  // AUTHORIZATION, TOKEN EXPIRATION & TENANT ISOLATION
  // =========================================================================
  describe('Authorization, Expiration & Tenant Isolation Verification', () => {
    test('Expired token returns 401 AUTH_TOKEN_EXPIRED', async () => {
      const expiredToken = jwt.sign(
        {
          id: userA._id.toString(),
          email: userA.email,
          role: userA.role,
          tokenVersion: userA.tokenVersion
        },
        env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      const res = await makeRequest('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.error.code, 'AUTH_TOKEN_EXPIRED');
    });

    test('Tenant isolation: User A cannot access User B review', async () => {
      const freshUserA = await User.findById(userA._id);
      const tokenA = jwt.sign(
        {
          id: userA._id.toString(),
          email: userA.email,
          role: userA.role,
          tokenVersion: freshUserA.tokenVersion
        },
        env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      // User A requests review belonging to User B
      const res = await makeRequest(`/api/v1/reviews/${reviewB._id}`, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      // Review controller must either return 404 (not found under user's scope) or 403 forbidden
      assert.ok([403, 404].includes(res.statusCode), `Expected 403 or 404 for tenant isolation, got ${res.statusCode}`);
    });
  });
});
