/**
 * Phase 10: Performance & Big-O Algorithmic Analysis Test Suite
 * server/tests/performanceRoutes.test.js
 *
 * Comprehensive tests verifying:
 * 1. Complexity Evaluator on all 6 languages (Python, Java, JS, TS, C, C++)
 *    - O(1), O(log n), O(n), O(n²), O(n³), O(2^n)
 *    - Auxiliary space complexity (O(1), O(n), O(n²))
 * 2. GET /api/v1/reviews/:id/performance endpoint
 *    - Authentication enforcement (401)
 *    - Schema validation (400)
 *    - Tenant isolation (404 for other user's review)
 *    - Success (200) with complete Big-O metrics and bottleneck findings
 *    - Query filtering (severity, source) and deterministic sorting
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import http from 'http';

import app from '../src/app.js';
import { env } from '../src/config/env.js';
import * as dbConfig from '../src/config/db.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';
import {
  evaluateComplexity,
  TIME_COMPLEXITY,
  SPACE_COMPLEXITY
} from '../src/services/staticAnalyzer/performance/index.js';
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

describe('Phase 10: Performance & Big-O Algorithmic Analysis', () => {
  // ---------------------------------------------------------------------------
  // 1. Static Algorithmic Complexity Evaluator across 6 languages
  // ---------------------------------------------------------------------------
  describe('1. Static Algorithmic Complexity Evaluator (All 6 Languages)', () => {
    it('Python: detects constant time O(1) for arithmetic without loops', () => {
      const code = `
def add(a, b):
    result = a + b
    return result
`;
      const res = evaluateComplexity(code, 'python');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_1);
      assert.equal(res.spaceComplexity, SPACE_COMPLEXITY.O_1);
      assert.equal(res.findings.length, 0);
      assert.equal(res.metrics.performanceScore, 100);
    });

    it('Python: detects binary search O(log n) time and O(1) space', () => {
      const code = `
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
`;
      const res = evaluateComplexity(code, 'python');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_LOG_N);
      assert.equal(res.spaceComplexity, SPACE_COMPLEXITY.O_1);
    });

    it('Python: detects quadratic nested loop O(n²)', () => {
      const code = `
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
`;
      const res = evaluateComplexity(code, 'python');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_N_2);
      assert.ok(res.findings.some((f) => f.ruleId === 'PERF-GEN-001'));
      assert.ok(res.metrics.performanceScore < 100);
    });

    it('Python: detects triple nested loop O(n³)', () => {
      const code = `
def three_sum(arr):
    n = len(arr)
    triplets = []
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                if arr[i] + arr[j] + arr[k] == 0:
                    triplets.append((arr[i], arr[j], arr[k]))
    return triplets
`;
      const res = evaluateComplexity(code, 'python');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_N_3);
      assert.ok(res.findings.some((f) => f.ruleId === 'PERF-GEN-002'));
      assert.equal(res.findings.find((f) => f.ruleId === 'PERF-GEN-002').severity, 'CRITICAL');
    });

    it('Python: detects exponential recursion O(2^n)', () => {
      const code = `
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
`;
      const res = evaluateComplexity(code, 'python');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_2_N);
      assert.equal(res.spaceComplexity, SPACE_COMPLEXITY.O_N);
      assert.ok(res.findings.some((f) => f.ruleId === 'PERF-GEN-003'));
      assert.equal(res.metrics.recursionDetected, true);
    });

    it('Python: detects linear membership check in loop O(n²)', () => {
      const code = `
def find_common(list_a, list_b):
    common = []
    for item in list_a:
        if item in list_b:
            common.append(item)
    return common
`;
      const res = evaluateComplexity(code, 'python');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_N_2);
      assert.ok(res.findings.some((f) => f.ruleId === 'PERF-PY-002'));
    });

    it('Java: detects quadratic String concatenation in loop', () => {
      const code = `
public class Formatter {
    public String buildMessage(String[] items) {
        String res = "";
        for (int i = 0; i < items.length; i++) {
            res += items[i] + ", ";
        }
        return res;
    }
}
`;
      const res = evaluateComplexity(code, 'java');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_N_2);
      assert.ok(res.findings.some((f) => f.ruleId === 'PERF-JAV-001'));
      assert.ok(res.findings.find((f) => f.ruleId === 'PERF-JAV-001').suggestedSnippet.includes('StringBuilder'));
    });

    it('Java: detects list.contains inside loop as hidden O(n²)', () => {
      const code = `
public class Deduplicator {
    public List<String> filter(List<String> a, List<String> b) {
        List<String> res = new ArrayList<>();
        for (String item : a) {
            if (b.contains(item)) {
                res.add(item);
            }
        }
        return res;
    }
}
`;
      const res = evaluateComplexity(code, 'java');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_N_2);
      assert.ok(res.findings.some((f) => f.ruleId === 'PERF-JAV-002'));
    });

    it('JavaScript/TypeScript: detects nested for loops O(n²)', () => {
      const code = `
function findPairs(arr) {
    const pairs = [];
    for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < arr.length; j++) {
            pairs.push([arr[i], arr[j]]);
        }
    }
    return pairs;
}
`;
      const res = evaluateComplexity(code, 'javascript');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_N_2);
      assert.ok(res.findings.some((f) => f.ruleId === 'PERF-GEN-001'));
    });

    it('JavaScript/TypeScript: detects Array.includes inside loop as hidden O(n²)', () => {
      const code = `
export function intersect(arr1: number[], arr2: number[]): number[] {
    const results: number[] = [];
    for (let i = 0; i < arr1.length; i++) {
        if (arr2.includes(arr1[i])) {
            results.push(arr1[i]);
        }
    }
    return results;
}
`;
      const res = evaluateComplexity(code, 'typescript');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_N_2);
      assert.ok(res.findings.some((f) => f.ruleId === 'PERF-JS-001'));
    });

    it('C/C++: detects dynamic malloc in loop', () => {
      const code = `
#include <stdlib.h>
void process_chunks(int n) {
    for (int i = 0; i < n; i++) {
        char* buf = (char*)malloc(1024);
        // ... work
    }
}
`;
      const res = evaluateComplexity(code, 'c');
      assert.ok(res.findings.some((f) => f.ruleId === 'PERF-C-001'));
      assert.equal(res.metrics.memoryAllocationRisks, 1);
    });

    it('C++: detects binary search O(log n)', () => {
      const code = `
#include <vector>
int binarySearch(const std::vector<int>& arr, int target) {
    int low = 0;
    int high = (int)arr.size() - 1;
    while (low <= high) {
        int mid = (low + high) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}
`;
      const res = evaluateComplexity(code, 'cpp');
      assert.equal(res.timeComplexity, TIME_COMPLEXITY.O_LOG_N);
      assert.equal(res.spaceComplexity, SPACE_COMPLEXITY.O_1);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. HTTP Integration Tests for GET /api/v1/reviews/:id/performance
  // ---------------------------------------------------------------------------
  describe('2. HTTP API: GET /api/v1/reviews/:id/performance', () => {
    let testUser;
    let otherUser;
    let userToken;
    let otherToken;
    let sampleReviewId;

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
        name: 'Alan Turing',
        email: `turing_${Date.now()}@test.dev`,
        passwordHash: '$2b$12$e8rUqE7UqB8h2s7F7F6YbeK8A4v7qJ8O7C7H8E7UqB8h2s7F7F6Yb'
      });

      otherUser = await User.create({
        name: 'John von Neumann',
        email: `neumann_${Date.now()}@test.dev`,
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

      // Create a genuine review with nested loop quadratic complexity
      const quadraticPython = `
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr
`;
      const created = await executeReview({
        code: quadraticPython,
        language: 'python',
        title: 'Bubble Sort Performance Test',
        fileName: 'bubble.py',
        userId: testUser._id
      });

      sampleReviewId = created.review._id.toString();
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

    it('returns 401 Unauthorized when request lacks JWT token', async () => {
      const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/performance`);
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    it('returns 400 Bad Request when review ID is not a valid ObjectId', async () => {
      const res = await makeRequest('/api/v1/reviews/invalid-id/performance', {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    it('returns 404 Not Found when review does not exist', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await makeRequest(`/api/v1/reviews/${nonExistentId}/performance`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('enforces tenant isolation: returns 404 when querying another user review', async () => {
      const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/performance`, {
        headers: { Authorization: `Bearer ${otherToken}` }
      });
      assert.equal(res.status, 404);
      assert.equal(res.body.success, false);
    });

    it('returns 200 with complete performance analysis structure', async () => {
      const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/performance`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data);

      const d = res.body.data;
      assert.equal(d.reviewId, sampleReviewId);
      assert.equal(d.language, 'python');
      assert.equal(d.timeComplexity, TIME_COMPLEXITY.O_N_2);
      assert.ok(typeof d.performanceScore === 'number');
      assert.ok(typeof d.performanceGrade === 'string');
      assert.ok(d.severityCounts);
      assert.ok(Array.isArray(d.issues));
      assert.ok(d.issues.length > 0);

      // Verify finding fields per Requirement 4
      const finding = d.issues[0];
      assert.ok(finding.lineStart >= 1);
      assert.ok(finding.severity);
      assert.ok(finding.complexityEstimate);
      assert.ok(finding.explanation);
      assert.ok(finding.remediation);
      assert.ok(finding.confidence);
    });

    it('filters performance findings by severity', async () => {
      const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/performance?severity=HIGH`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data.issues.every((i) => i.severity === 'HIGH'));
    });

    it('sorts findings by line number ascending (line_asc)', async () => {
      const res = await makeRequest(`/api/v1/reviews/${sampleReviewId}/performance?sort=line_asc`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });

      assert.equal(res.status, 200);
      const issues = res.body.data.issues;
      for (let i = 1; i < issues.length; i++) {
        assert.ok(issues[i].lineStart >= issues[i - 1].lineStart);
      }
    });
  });
});
