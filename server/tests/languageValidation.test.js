/**
 * Language Validation, Persistence & Engine Propagation Tests
 * server/tests/languageValidation.test.js
 *
 * Verifies:
 * 1. Backend schema validation accepts all 6 supported languages:
 *    python, javascript, typescript, java, c, cpp.
 * 2. Backend rejects unsupported languages (e.g. ruby, php, go, swift, rust).
 * 3. Review records persist the exact validated language in MongoDB.
 * 4. Language propagates correctly to Static Analyzer and Gemini services.
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
import { createReviewSchema } from '../src/schemas/review.schema.js';
import { staticAnalysisSchema } from '../src/schemas/analysis.schema.js';
import { analyzeCode } from '../src/services/staticAnalyzer/index.js';
import { executeReview } from '../src/services/review.service.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';

let server;
let serverPort;
let testUser;
let userToken;

const makeRequest = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Connection: 'close',
          ...(options.headers || {})
        }
      },
      (res) => {
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
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
};

describe('Language Validation, MongoDB Persistence & Engine Propagation', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI);

    testUser = await User.create({
      name: 'Language Test Dev',
      email: `lang_test_${Date.now()}@test.dev`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: 'developer'
    });

    userToken = jwt.sign(
      { id: testUser._id.toString(), email: testUser.email, role: 'developer' },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    serverPort = server.address().port;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
      await CodeReview.deleteMany({ userId: testUser._id });
    }
    await mongoose.connection.close();
  });

  describe('1. Zod Schema Language Validation', () => {
    const supportedLangs = ['python', 'javascript', 'typescript', 'java', 'c', 'cpp'];
    const unsupportedLangs = ['ruby', 'go', 'rust', 'php', 'swift', 'auto', ''];

    for (const lang of supportedLangs) {
      it(`accepts supported language: ${lang}`, () => {
        const payload = {
          code: 'let x = 1;',
          language: lang,
          title: `Test ${lang}`
        };
        const reviewParse = createReviewSchema.body.safeParse(payload);
        assert.equal(reviewParse.success, true, `Review schema must accept ${lang}`);

        const staticParse = staticAnalysisSchema.body.safeParse(payload);
        assert.equal(staticParse.success, true, `Static analysis schema must accept ${lang}`);
      });
    }

    for (const lang of unsupportedLangs) {
      it(`rejects unsupported language: '${lang}' with validation error`, () => {
        const payload = {
          code: 'let x = 1;',
          language: lang,
          title: `Test ${lang}`
        };
        const reviewParse = createReviewSchema.body.safeParse(payload);
        assert.equal(reviewParse.success, false, `Review schema must reject '${lang}'`);

        const staticParse = staticAnalysisSchema.body.safeParse(payload);
        assert.equal(staticParse.success, false, `Static analysis schema must reject '${lang}'`);
      });
    }
  });

  describe('2. HTTP API Language Enforcement', () => {
    it('POST /api/v1/reviews returns 400 for unsupported language', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: {
          code: 'puts "Hello Ruby"',
          language: 'ruby',
          title: 'Ruby Test'
        }
      });
      assert.equal(res.statusCode, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });

    it('POST /api/v1/reviews successfully accepts and persists Python review', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: {
          code: 'def add(a, b):\n    return a + b\n',
          language: 'python',
          title: 'Python Addition Review'
        }
      });
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.data.review.language, 'python');

      // Verify MongoDB persistence
      const reviewId = res.body.data.review._id || res.body.data.review.id;
      const saved = await CodeReview.findById(reviewId);
      assert.ok(saved, 'Review must be saved in database');
      assert.equal(saved.language, 'python', 'MongoDB record must store exact language');
    });

    it('POST /api/v1/reviews successfully accepts and persists C++ review', async () => {
      const res = await makeRequest('/api/v1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: {
          code: '#include <iostream>\nint main() { return 0; }\n',
          language: 'cpp',
          title: 'C++ Main Review'
        }
      });
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.data.review.language, 'cpp');

      const reviewId = res.body.data.review._id || res.body.data.review.id;
      const saved = await CodeReview.findById(reviewId);
      assert.equal(saved.language, 'cpp', 'MongoDB record must store cpp');
    });
  });

  describe('3. Engine Language Propagation', () => {
    it('Static Analyzer correctly receives language and applies language-specific rules', () => {
      const pyCode = 'eval("1 + 1")';
      const pyResult = analyzeCode(pyCode, 'python');
      assert.ok(
        pyResult.findings.some((f) => f.ruleId === 'RISK-PY-001'),
        'Python eval must trigger RISK-PY-001'
      );

      const jsCode = 'eval("1 + 1");';
      const jsResult = analyzeCode(jsCode, 'javascript');
      assert.ok(
        jsResult.findings.some((f) => f.ruleId === 'RISK-JS-001'),
        'JavaScript eval must trigger RISK-JS-001'
      );
    });

    it('executeReview passes language to mock Gemini client with exact language context', async () => {
      let receivedLanguage = null;
      const mockGemini = {
        analyze: async (code, lang) => {
          receivedLanguage = lang;
          return {
            summary: 'Review summary',
            timeComplexity: 'O(1)',
            spaceComplexity: 'O(1)',
            categoryScores: {
              bugScore: 90,
              securityScore: 90,
              performanceScore: 90,
              maintainabilityScore: 90
            },
            aiCompositeScore: 90,
            suggestedCode: code,
            refactoringRationale: 'Clean code',
            issues: []
          };
        }
      };

      const result = await executeReview(
        {
          code: 'interface Item { id: string; }',
          language: 'typescript',
          title: 'TypeScript Review Test',
          userId: testUser._id
        },
        { geminiClient: mockGemini }
      );

      assert.equal(receivedLanguage, 'typescript', 'Gemini client must receive exact language');
      assert.equal(result.review.language, 'typescript', 'Persisted review must have typescript');
    });
  });
});
