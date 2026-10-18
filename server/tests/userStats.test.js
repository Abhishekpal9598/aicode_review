/**
 * Backend Integration Tests for Phase 5: GET /api/v1/users/stats
 * Tests 1 to 5 as defined in implementation_plan.md
 */

import test, { describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import * as dbConfig from '../src/config/db.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';

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

describe('Phase 5: User Stats Backend Integration Tests', () => {
  before(async () => {
    // 1. Connect strictly to isolated test database
    await mongoose.connect(TEST_DB_URI);

    // 2. Safety Guard: Never execute against development or production DB
    if (!mongoose.connection.name.includes('test')) {
      throw new Error(
        `Safety Guard Tripped: Connected to non-test database: "${mongoose.connection.name}". Aborting!`
      );
    }

    // 3. Start ephemeral test server
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    // 1. Clean up test collections on isolated test DB
    if (mongoose.connection.name.includes('test')) {
      await User.deleteMany({ email: /@test\.dev$/ });
      await CodeReview.deleteMany({});
    }

    // 2. HTTP cleanup: close active connections and server gracefully
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }

    // 3. MongoDB cleanup: Remove only application-level disconnected listener to prevent reconnect scheduling
    const disconnectedListeners = mongoose.connection.listeners('disconnected');
    for (const listener of disconnectedListeners) {
      mongoose.connection.removeListener('disconnected', listener);
    }

    // 4. Close database connection and clear active reconnect timers
    await dbConfig.disconnectDB();
  });

  beforeEach(async () => {
    if (mongoose.connection.name.includes('test')) {
      await User.deleteMany({ email: /@test\.dev$/ });
      await CodeReview.deleteMany({});
    }
  });

  // TEST 1: Unauthenticated request returns 401
  test('Test 1 (Unauthenticated Request Guard): GET /api/v1/users/stats returns 401 without token', async () => {
    const res = await makeRequest('/api/v1/users/stats');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'AUTH_TOKEN_MISSING');
  });

  // TEST 2: Authenticated request returns 200 with honest zero-state payload
  test('Test 2 (Authenticated Request & Zero-State Payload): GET /api/v1/users/stats returns 200 and ISO timestamp', async () => {
    const user = await User.create({
      name: 'Ada Lovelace',
      email: 'ada@test.dev',
      passwordHash: '$2b$12$e8rUqE7UqB8h2s7F7F6YbeK8A4v7qJ8O7C7H8E7UqB8h2s7F7F6Yb'
    });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const res = await makeRequest('/api/v1/users/stats', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, 'User statistics retrieved successfully.');
    assert.equal(res.body.data.overview.totalReviews, 0);
    assert.equal(res.body.data.overview.averageQualityScore, null);
    assert.equal(res.body.data.overview.criticalSecurityIssues, null);
    assert.equal(res.body.data.overview.performanceBottlenecks, null);
    assert.deepEqual(res.body.data.scoreHistory, []);
    assert.deepEqual(res.body.data.languageDistribution, []);
    assert.deepEqual(res.body.data.recentReviews, []);

    // Validate meta.timestamp is a valid ISO 8601 string
    assert.ok(res.body.meta?.timestamp, 'meta.timestamp must exist');
    const parsedDate = new Date(res.body.meta.timestamp);
    assert.equal(parsedDate.toISOString(), res.body.meta.timestamp);
  });

  // TEST 3: Database disconnection returns 503 without totalReviews: 0
  test('Test 3 (Database Disconnection Handling): Returns 503 DATABASE_UNAVAILABLE when MongoDB is disconnected', async () => {
    const user = await User.create({
      name: 'Grace Hopper',
      email: 'grace@test.dev',
      passwordHash: '$2b$12$e8rUqE7UqB8h2s7F7F6YbeK8A4v7qJ8O7C7H8E7UqB8h2s7F7F6Yb'
    });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Temporarily stub mongoose.connection.readyState to 0 (disconnected)
    const originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 0,
      configurable: true
    });

    try {
      const res = await makeRequest('/api/v1/users/stats', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      assert.equal(res.status, 503);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error.code, 'DATABASE_UNAVAILABLE');
      assert.equal(res.body.data, undefined, 'Must not return data payload during database outage');
    } finally {
      // Restore original readyState getter/setter on Mongoose connection prototype
      delete mongoose.connection.readyState;
    }
  });

  // TEST 4: Tenant isolation between Developer A and Developer B
  test('Test 4 (Tenant Isolation): Developer A query returns 0 reviews when only Developer B has records', async () => {
    const devA = await User.create({
      name: 'Developer A',
      email: 'deva@test.dev',
      passwordHash: '$2b$12$e8rUqE7UqB8h2s7F7F6YbeK8A4v7qJ8O7C7H8E7UqB8h2s7F7F6Yb'
    });

    const devB = await User.create({
      name: 'Developer B',
      email: 'devb@test.dev',
      passwordHash: '$2b$12$e8rUqE7UqB8h2s7F7F6YbeK8A4v7qJ8O7C7H8E7UqB8h2s7F7F6Yb'
    });

    // Create 3 reviews for Developer B
    await CodeReview.create([
      {
        userId: devB._id,
        title: 'sorting.py',
        sourceType: 'pasted',
        language: 'python',
        rawCode: 'def sort(x): return sorted(x)',
        lineCount: 1,
        characterCount: 30,
        fileSizeBytes: 30,
        status: 'completed'
      },
      {
        userId: devB._id,
        title: 'binarySearch.cpp',
        sourceType: 'upload',
        language: 'cpp',
        rawCode: 'int search() { return 0; }',
        lineCount: 1,
        characterCount: 26,
        fileSizeBytes: 26,
        status: 'completed'
      }
    ]);

    const tokenA = jwt.sign(
      { id: devA._id.toString(), email: devA.email, role: devA.role },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const res = await makeRequest('/api/v1/users/stats', {
      headers: {
        Authorization: `Bearer ${tokenA}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.overview.totalReviews, 0, 'Dev A must see 0 reviews');
    assert.deepEqual(res.body.data.recentReviews, [], 'Dev A must see empty recent reviews');
  });

  // TEST 5: RecentReviewsTable Field Masking on Model
  test('Test 5 (RecentReviewsTable Field Masking): Returned reviews contain ONLY genuine CodeReview fields', async () => {
    const user = await User.create({
      name: 'Katherine Johnson',
      email: 'katherine@test.dev',
      passwordHash: '$2b$12$e8rUqE7UqB8h2s7F7F6YbeK8A4v7qJ8O7C7H8E7UqB8h2s7F7F6Yb'
    });

    await CodeReview.create({
      userId: user._id,
      title: 'trajectory.ts',
      sourceType: 'pasted',
      filename: 'trajectory.ts',
      language: 'typescript',
      rawCode: 'export function calcTrajectory() { return 42; }',
      lineCount: 1,
      characterCount: 46,
      fileSizeBytes: 46,
      status: 'completed'
    });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const res = await makeRequest('/api/v1/users/stats', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.overview.totalReviews, 1);
    assert.equal(res.body.data.recentReviews.length, 1);

    const review = res.body.data.recentReviews[0];
    assert.ok(review._id, 'review must have _id');
    assert.equal(review.title, 'trajectory.ts');
    assert.equal(review.language, 'typescript');
    assert.equal(review.lineCount, 1);
    assert.equal(review.status, 'completed');
    assert.ok(review.createdAt, 'review must have createdAt');

    // Strict schema purity assertion: Future/analysis fields MUST NOT exist
    assert.equal(review.overallScore, undefined, 'overallScore must not exist');
    assert.equal(review.issuesCount, undefined, 'issuesCount must not exist');
    assert.equal(review.metrics, undefined, 'metrics must not exist');
    assert.equal(review.summary, undefined, 'summary must not exist');
  });
});
