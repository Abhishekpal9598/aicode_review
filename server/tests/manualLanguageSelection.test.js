/**
 * Phase 8: Manual Programming Language Selection Backend Integration Tests
 * server/tests/manualLanguageSelection.test.js
 *
 * Verifies:
 * 1. Static Analysis API accepts all 6 supported languages: c, cpp, java, python, javascript, typescript.
 * 2. Static Analysis API runs language-specific rules for manually selected language.
 * 3. Static Analysis API gracefully rejects unsupported languages (e.g. ruby, php, go) with HTTP 400.
 * 4. Code Review Persistence stores the exact manual language in MongoDB.
 * 5. Review History, Details, and Export endpoints preserve and reflect the manual language.
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

let server;
let serverPort;
let testUser;
let authToken;

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

describe('Phase 8: Manual Programming Language Selection & Analyzer Execution', () => {
  const TEST_EMAIL = `phase8_dev_${Date.now()}@example.com`;
  let createdReviewIdC = null;
  let createdReviewIdCpp = null;

  before(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    testUser = await User.create({
      name: 'Phase 8 Lead Dev',
      email: TEST_EMAIL,
      passwordHash: '$2b$12$e8rUqE7UqB8h2s7F7F6YbeK8A4v7qJ8O7C7H8E7UqB8h2s7F7F6Yb',
      role: 'developer'
    });

    authToken = jwt.sign(
      { id: testUser._id.toString(), email: testUser.email, role: 'developer', tokenVersion: 0 },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
      await CodeReview.deleteMany({ userId: testUser._id });
      await AnalysisResult.deleteMany({ userId: testUser._id });
      await ReviewIssue.deleteMany({ userId: testUser._id });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // Test 1: Manual C Selection
  it('1. POST /api/v1/analysis/static accepts manual language "c" and executes C rules', async () => {
    const cSnippet = `#include <stdio.h>\nvoid read_data() {\n    char buf[64];\n    gets(buf);\n}\n`;
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: cSnippet,
        language: 'c',
        fileName: 'buffer.c'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.language, 'c');
    const getsFinding = res.body.data.findings.find((f) => f.ruleId === 'RISK-C-002');
    assert.ok(getsFinding, 'Must trigger RISK-C-002 for gets() vulnerability');
  });

  // Test 2: Manual C++ Selection
  it('2. POST /api/v1/analysis/static accepts manual language "cpp" and executes C++ rules', async () => {
    const cppSnippet = `#include <iostream>\nvoid loop_forever() {\n    for (;;) {\n        std::cout << "Infinite";\n    }\n}\n`;
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: cppSnippet,
        language: 'cpp',
        fileName: 'loop.cpp'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.language, 'cpp');
    const loopFinding = res.body.data.findings.find((f) => f.ruleId === 'QUAL-CPP-003');
    assert.ok(loopFinding, 'Must trigger QUAL-CPP-003 for infinite loop');
  });

  // Test 3: Manual Java Selection
  it('3. POST /api/v1/analysis/static accepts manual language "java" and executes Java rules', async () => {
    const javaSnippet = `import java.sql.DriverManager;\nimport java.sql.Connection;\npublic class DB {\n    public Connection connect() throws Exception {\n        return DriverManager.getConnection("jdbc:mysql://localhost:3306/db?user=admin&password=hardcodedSecret123");\n    }\n}\n`;
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: javaSnippet,
        language: 'java',
        fileName: 'DB.java'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.language, 'java');
    const credFinding = res.body.data.findings.find((f) => f.ruleId === 'SEC-JAV-001');
    assert.ok(credFinding, 'Must trigger SEC-JAV-001 for hardcoded JDBC credentials');
  });

  // Test 4: Manual Python Selection
  it('4. POST /api/v1/analysis/static accepts manual language "python" and executes Python rules', async () => {
    const pySnippet = `import pickle\ndef unsafe_load(data):\n    return pickle.loads(data)\n`;
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: pySnippet,
        language: 'python',
        fileName: 'loader.py'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.language, 'python');
    const pickleFinding = res.body.data.findings.find((f) => f.ruleId === 'RISK-PY-002');
    assert.ok(pickleFinding, 'Must trigger RISK-PY-002 for insecure pickle deserialization');
  });

  // Test 5: Manual JavaScript Selection
  it('5. POST /api/v1/analysis/static accepts manual language "javascript" and executes JS rules', async () => {
    const jsSnippet = `function executeCode(userInput) {\n    eval(userInput);\n}\n`;
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: jsSnippet,
        language: 'javascript',
        fileName: 'runner.js'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.language, 'javascript');
    const evalFinding = res.body.data.findings.find((f) => f.ruleId === 'RISK-JS-001');
    assert.ok(evalFinding, 'Must trigger RISK-JS-001 for eval usage');
  });

  // Test 6: Manual TypeScript Selection
  it('6. POST /api/v1/analysis/static accepts manual language "typescript" and executes TS rules', async () => {
    const tsSnippet = `export function compute(input: string): void {\n    eval(input);\n}\n`;
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: tsSnippet,
        language: 'typescript',
        fileName: 'compute.ts'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.language, 'typescript');
  });

  // Test 7: Rejects Unsupported Language (Ruby)
  it('7. POST /api/v1/analysis/static rejects unsupported language "ruby" with HTTP 400', async () => {
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: 'puts "Hello Ruby"',
        language: 'ruby',
        fileName: 'hello.rb'
      }
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // Test 8: Rejects Unsupported Language (PHP)
  it('8. POST /api/v1/analysis/static rejects unsupported language "php" with HTTP 400', async () => {
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: '<?php echo "Hello"; ?>',
        language: 'php',
        fileName: 'index.php'
      }
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // Test 9: Review Persistence with Manual Language C
  it('9. POST /api/v1/reviews persists manual language "c" in MongoDB', async () => {
    const cSnippet = `#include <stdio.h>\nint main() {\n    printf("Safe C Code\\n");\n    return 0;\n}\n`;
    const res = await makeRequest('/api/v1/reviews', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: cSnippet,
        language: 'c',
        title: 'Manual C Review Audit',
        fileName: 'safe_main.c'
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.review.language, 'c');
    createdReviewIdC = res.body.data.review._id;

    // Verify directly in MongoDB
    const dbReview = await CodeReview.findById(createdReviewIdC);
    assert.ok(dbReview);
    assert.equal(dbReview.language, 'c');
  });

  // Test 10: Review Persistence with Manual Language C++
  it('10. POST /api/v1/reviews persists manual language "cpp" in MongoDB', async () => {
    const cppSnippet = `#include <vector>\nint count(const std::vector<int>& v) {\n    return v.size();\n}\n`;
    const res = await makeRequest('/api/v1/reviews', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: cppSnippet,
        language: 'cpp',
        title: 'Manual C++ Review Audit',
        fileName: 'vector_count.cpp'
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.review.language, 'cpp');
    createdReviewIdCpp = res.body.data.review._id;

    const dbReview = await CodeReview.findById(createdReviewIdCpp);
    assert.ok(dbReview);
    assert.equal(dbReview.language, 'cpp');
  });

  // Test 11: Rejects Unsupported Language in Review Creation
  it('11. POST /api/v1/reviews rejects unsupported language "rust" with HTTP 400', async () => {
    const res = await makeRequest('/api/v1/reviews', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: {
        code: 'fn main() { println!("Rust"); }',
        language: 'rust',
        title: 'Rust Review Attempt'
      }
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  // Test 12: Filters Reviews by Manual Language
  it('12. GET /api/v1/reviews?language=c returns only C language reviews', async () => {
    const res = await makeRequest('/api/v1/reviews?language=c', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    for (const r of res.body.data) {
      assert.equal(r.language, 'c');
    }
  });

  // Test 13: Review Details Preserves Manual Language
  it('13. GET /api/v1/reviews/:id returns review preserving manual language', async () => {
    const res = await makeRequest(`/api/v1/reviews/${createdReviewIdCpp}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.review.language, 'cpp');
  });

  // Test 14: Export Preserves Manual Language in Markdown
  it('14. GET /api/v1/reviews/:id/export preserves manual language in exported markdown', async () => {
    const res = await makeRequest(`/api/v1/reviews/${createdReviewIdC}/export?format=markdown`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    assert.equal(res.status, 200);
    assert.ok(typeof res.body === 'string');
    assert.ok(res.body.includes('`c`'), 'Exported markdown must specify target language `c`');
  });
});
