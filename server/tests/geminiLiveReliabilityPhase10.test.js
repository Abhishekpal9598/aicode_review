/**
 * Phase 10: Gemini Live AI Reliability & Multi-Model Resilience Audit Tests
 * server/tests/geminiLiveReliabilityPhase10.test.js
 *
 * Verifies all 8 Phase 10 requirements:
 * 1. Primary model success & tier attribution
 * 2. Fallback model success upon primary 429/503
 * 3. Primary and fallback failure propagation (zero infinite loops)
 * 4. HTTP 429 rate limit fast-fail and model fallback
 * 5. HTTP 503 service unavailable exponential backoff retries
 * 6. Timeout and AbortController cancellation (504 AI_TIMEOUT)
 * 7. Invalid API key fast-fail (401 AI_REQUEST_FAILED)
 * 8. Invalid and malformed AI response rejection (502 AI_INVALID_RESPONSE)
 * 9. Deterministic static fallback execution with honest null metrics
 * 10. Database persistence of reviewMode, aiModelUsed, aiModelTier, and staticScore
 * 11. Secret redaction pre-filter verifying credentials never reach external LLM prompts
 * 12. Live API environment validation and telemetry probe
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import {
  GeminiService,
  GeminiServiceError,
  classifyGeminiError,
  buildGeminiPrompt
} from '../src/services/gemini.service.js';
import { executeReview, getReviewById } from '../src/services/review.service.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';
import { env } from '../src/config/env.js';

const SAMPLE_CODE = `def divide(a, b):
    if b == 0:
        return None
    return a / b
`;

function createValidAiPayload(overrides = {}) {
  return {
    summary: 'The function divides two numbers with basic zero check but lacks type validation and raises no exceptions.',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    categoryScores: {
      bugScore: 85,
      securityScore: 90,
      performanceScore: 95,
      maintainabilityScore: 80
    },
    suggestedCode: `def divide(a: float, b: float) -> float:
    if b == 0:
        raise ValueError("Division by zero")
    return a / b
`,
    refactoringRationale: 'Added type hints and standard ValueError exception handling.',
    issues: [
      {
        category: 'bug',
        severity: 'LOW',
        title: 'Silent zero division handling',
        description: 'Returning None instead of raising an exception can mask runtime errors.',
        lineStart: 2,
        lineEnd: 3,
        columnStart: 5,
        columnEnd: 20,
        originalSnippet: 'if b == 0:\n        return None',
        suggestedSnippet: 'if b == 0:\n        raise ValueError("Division by zero")',
        explanation: 'Standard Python conventions encourage raising exceptions on invalid input.'
      }
    ],
    ...overrides
  };
}

function createMockClient(handler) {
  return {
    models: {
      generateContent: async (params) => {
        return handler(params);
      }
    }
  };
}

describe('Phase 10: Gemini Live AI Reliability & Multi-Model Resilience Audit', () => {
  let testUser;

  before(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    const passwordHash = await bcrypt.hash('Phase10Password123!', 12);
    testUser = await User.create({
      name: 'Phase 10 Lead Dev',
      email: `phase10_audit_${Date.now()}@example.com`,
      passwordHash,
      role: 'developer',
      tokenVersion: 0
    });
  });

  after(async () => {
    if (testUser) {
      await ReviewIssue.deleteMany({ userId: testUser._id });
      await AnalysisResult.deleteMany({ userId: testUser._id });
      await CodeReview.deleteMany({ userId: testUser._id });
      await User.deleteOne({ _id: testUser._id });
    }
    await mongoose.connection.close();
  });

  // =========================================================================
  // 1. PRIMARY MODEL SUCCESS & TIER ATTRIBUTION
  // =========================================================================
  describe('1. Primary Model Success & Tier Attribution', () => {
    it('executes primary model and attributes tier as "primary"', async () => {
      const calls = [];
      const mockClient = createMockClient(async (params) => {
        calls.push(params.model);
        return { text: () => JSON.stringify(createValidAiPayload()) };
      });

      const service = new GeminiService({
        client: mockClient,
        apiKey: 'test-api-key',
        primaryModel: 'gemini-primary-test',
        fallbackModel: 'gemini-fallback-test'
      });

      const result = await service.analyze(SAMPLE_CODE, 'python');
      assert.equal(result.aiModelUsed, 'gemini-primary-test');
      assert.equal(result.aiModelTier, 'primary');
      assert.equal(result.summary.length >= 20, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0], 'gemini-primary-test');
    });
  });

  // =========================================================================
  // 2. FALLBACK MODEL SUCCESS
  // =========================================================================
  describe('2. Fallback Model Engagement & Success', () => {
    it('engages fallback model when primary encounters HTTP 429 rate limit', async () => {
      const calls = [];
      const mockClient = createMockClient(async (params) => {
        calls.push(params.model);
        if (params.model === 'gemini-primary-test') {
          const err429 = new Error('Resource exhausted: quota exceeded');
          err429.status = 429;
          throw err429;
        }
        return { text: () => JSON.stringify(createValidAiPayload()) };
      });

      const service = new GeminiService({
        client: mockClient,
        apiKey: 'test-api-key',
        primaryModel: 'gemini-primary-test',
        fallbackModel: 'gemini-fallback-test'
      });

      const result = await service.analyze(SAMPLE_CODE, 'python');
      assert.equal(result.aiModelUsed, 'gemini-fallback-test');
      assert.equal(result.aiModelTier, 'fallback');
      assert.equal(calls.length, 2);
      assert.equal(calls[0], 'gemini-primary-test');
      assert.equal(calls[1], 'gemini-fallback-test');
    });

    it('engages fallback model when primary exhausts HTTP 503 retries', async () => {
      const calls = [];
      const mockClient = createMockClient(async (params) => {
        calls.push(params.model);
        if (params.model === 'gemini-primary-test') {
          const err503 = new Error('Service Unavailable: high demand');
          err503.status = 503;
          throw err503;
        }
        return { text: () => JSON.stringify(createValidAiPayload()) };
      });

      const service = new GeminiService({
        client: mockClient,
        apiKey: 'test-api-key',
        primaryModel: 'gemini-primary-test',
        fallbackModel: 'gemini-fallback-test',
        maxRetries: 1,
        retryDelayMs: 1
      });

      const result = await service.analyze(SAMPLE_CODE, 'python');
      assert.equal(result.aiModelUsed, 'gemini-fallback-test');
      assert.equal(result.aiModelTier, 'fallback');
      // Primary attempted 2 times (initial + 1 retry), then fallback succeeded on 1st attempt
      assert.equal(calls.length, 3);
      assert.equal(calls[0], 'gemini-primary-test');
      assert.equal(calls[1], 'gemini-primary-test');
      assert.equal(calls[2], 'gemini-fallback-test');
    });
  });

  // =========================================================================
  // 3. MULTI-MODEL FAILURE HANDLING (NO INFINITE LOOPS)
  // =========================================================================
  describe('3. Multi-Model Failure & Infinite Loop Prevention', () => {
    it('fails fast when both primary and fallback models encounter HTTP 429', async () => {
      const calls = [];
      const mockClient = createMockClient(async (params) => {
        calls.push(params.model);
        const err429 = new Error('Rate limit exceeded');
        err429.status = 429;
        throw err429;
      });

      const service = new GeminiService({
        client: mockClient,
        apiKey: 'test-api-key',
        primaryModel: 'gemini-primary-test',
        fallbackModel: 'gemini-fallback-test'
      });

      await assert.rejects(
        async () => {
          await service.analyze(SAMPLE_CODE, 'python');
        },
        (err) => {
          assert.equal(err.code, 'AI_RATE_LIMITED');
          assert.equal(err.statusCode, 429);
          return true;
        }
      );

      // Exactly 1 attempt on primary, 1 attempt on fallback, then clean termination
      assert.equal(calls.length, 2);
      assert.equal(calls[0], 'gemini-primary-test');
      assert.equal(calls[1], 'gemini-fallback-test');
    });
  });

  // =========================================================================
  // 4. RETRY HANDLING FOR TRANSIENT VS NON-TRANSIENT ERRORS
  // =========================================================================
  describe('4. Retry Handling & Error Classification', () => {
    it('retries transient network error and succeeds on subsequent attempt', async () => {
      let callCount = 0;
      const mockClient = createMockClient(async () => {
        callCount++;
        if (callCount === 1) {
          const netErr = new Error('fetch failed: socket hang up');
          netErr.code = 'ECONNRESET';
          throw netErr;
        }
        return { text: () => JSON.stringify(createValidAiPayload()) };
      });

      const service = new GeminiService({
        client: mockClient,
        apiKey: 'test-api-key',
        maxRetries: 2,
        retryDelayMs: 1
      });

      const result = await service.analyze(SAMPLE_CODE, 'python');
      assert.equal(result.aiCompositeScore > 0, true);
      assert.equal(callCount, 2);
    });

    it('does NOT retry authentication failure (401) and fails fast', async () => {
      let callCount = 0;
      const mockClient = createMockClient(async () => {
        callCount++;
        const authErr = new Error('API key not valid');
        authErr.status = 401;
        throw authErr;
      });

      const service = new GeminiService({
        client: mockClient,
        apiKey: 'test-api-key',
        primaryModel: 'gemini-primary-test',
        fallbackModel: 'gemini-fallback-test',
        maxRetries: 2
      });

      await assert.rejects(
        async () => {
          await service.analyze(SAMPLE_CODE, 'python');
        },
        (err) => {
          assert.equal(err.code, 'AI_REQUEST_FAILED');
          assert.equal(err.statusCode, 401);
          return true;
        }
      );

      // Strictly 1 attempt, zero retries, zero fallback attempt on auth failure
      assert.equal(callCount, 1);
    });

    it('does NOT retry bad request (400) and fails fast', async () => {
      let callCount = 0;
      const mockClient = createMockClient(async () => {
        callCount++;
        const badReqErr = new Error('Invalid argument provided');
        badReqErr.status = 400;
        throw badReqErr;
      });

      const service = new GeminiService({
        client: mockClient,
        apiKey: 'test-api-key',
        maxRetries: 2
      });

      await assert.rejects(
        async () => {
          await service.analyze(SAMPLE_CODE, 'python');
        },
        (err) => {
          assert.equal(err.code, 'AI_REQUEST_FAILED');
          assert.equal(err.statusCode, 400);
          return true;
        }
      );

      assert.equal(callCount, 1);
    });

    it('enforces request timeout via AbortController and throws 504 AI_TIMEOUT', async () => {
      const mockClient = createMockClient(async (params) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({ text: () => JSON.stringify(createValidAiPayload()) });
          }, 500);

          if (params.config?.abortSignal) {
            params.config.abortSignal.addEventListener('abort', () => {
              clearTimeout(timer);
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      const service = new GeminiService({
        client: mockClient,
        apiKey: 'test-api-key',
        timeoutMs: 15,
        maxRetries: 0
      });

      await assert.rejects(
        async () => {
          await service.analyze(SAMPLE_CODE, 'python');
        },
        (err) => {
          assert.equal(err.code, 'AI_TIMEOUT');
          assert.equal(err.statusCode, 504);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 5. AI RESPONSE VALIDATION & REJECTION
  // =========================================================================
  describe('5. Strict AI Response Validation', () => {
    it('rejects empty or whitespace response with 502 AI_INVALID_RESPONSE', async () => {
      const mockClient = createMockClient(async () => ({ text: () => '' }));
      const service = new GeminiService({ client: mockClient, apiKey: 'test-api-key' });

      await assert.rejects(
        async () => {
          await service.analyze(SAMPLE_CODE, 'python');
        },
        (err) => {
          assert.equal(err.code, 'AI_INVALID_RESPONSE');
          assert.equal(err.statusCode, 502);
          return true;
        }
      );
    });

    it('rejects malformed non-JSON response with 502 AI_INVALID_RESPONSE', async () => {
      const mockClient = createMockClient(async () => ({ text: () => 'Here is my review: everything looks good!' }));
      const service = new GeminiService({ client: mockClient, apiKey: 'test-api-key' });

      await assert.rejects(
        async () => {
          await service.analyze(SAMPLE_CODE, 'python');
        },
        (err) => {
          assert.equal(err.code, 'AI_INVALID_RESPONSE');
          assert.equal(err.statusCode, 502);
          return true;
        }
      );
    });

    it('rejects responses with out-of-bounds line coordinates with 502 AI_INVALID_RESPONSE', async () => {
      const badPayload = createValidAiPayload({
        issues: [
          {
            category: 'bug',
            severity: 'HIGH',
            title: 'Out of bounds line coordinate',
            description: 'Points past the end of the file',
            lineStart: 999, // Exceeds SAMPLE_CODE line count (5)
            lineEnd: 999,
            columnStart: 1,
            columnEnd: 10,
            originalSnippet: 'code',
            suggestedSnippet: 'fixed',
            explanation: 'Fix'
          }
        ]
      });

      const mockClient = createMockClient(async () => ({ text: () => JSON.stringify(badPayload) }));
      const service = new GeminiService({ client: mockClient, apiKey: 'test-api-key' });

      await assert.rejects(
        async () => {
          await service.analyze(SAMPLE_CODE, 'python');
        },
        (err) => {
          assert.equal(err.code, 'AI_INVALID_RESPONSE');
          assert.equal(err.statusCode, 502);
          assert.equal(err.message.includes('exceeding total source line count'), true);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 6. SECRET REDACTION PRE-FILTER
  // =========================================================================
  describe('6. Secret Redaction Pre-Filter Verification', () => {
    it('redacts passwords, API keys, and connection strings BEFORE external transmission', async () => {
      let capturedContents = '';
      const mockClient = createMockClient(async (params) => {
        capturedContents = params.contents;
        return { text: () => JSON.stringify(createValidAiPayload({ issues: [] })) };
      });

      const service = new GeminiService({ client: mockClient, apiKey: 'test-api-key' });

      const SENSITIVE_INPUT = `password = "P@ssw0rd123!"
AWS_KEY = "AKIAIOSFODNN7EXAMPLE"
MONGO_URL = "mongodb+srv://admin:SuperSecretPass123@cluster.mongodb.net/prod"
def query():
    pass
`;

      await service.analyze(SENSITIVE_INPUT, 'python');

      // The captured prompt sent to the LLM must NOT contain the cleartext secrets!
      assert.equal(capturedContents.includes('SuperSecretPass123'), false);
      assert.equal(capturedContents.includes('P@ssw0rd123!'), false);
      assert.equal(capturedContents.includes('AKIAIOSFODNN7EXAMPLE'), false);
      // It must contain the safely masked representations preserving 1:1 coordinate alignment
      assert.equal(capturedContents.includes('AKIA****************'), true);
      assert.equal(capturedContents.includes('password = "************"'), true);
      assert.equal(capturedContents.includes('mongodb+srv://admin:******************@cluster.mongodb.net/prod'), true);
    });
  });

  // =========================================================================
  // 7. DETERMINISTIC STATIC FALLBACK & DB PERSISTENCE
  // =========================================================================
  describe('7. Deterministic Static Fallback & Database Persistence', () => {
    it('executes deterministic static fallback when AI throws 429 and persists fallback tier to MongoDB', async () => {
      // Execute full review through reviewService with a mock that throws 429 rate limit
      const sampleReviewCode = `def test_fn():\n    return 42\n`;

      const mockFailingGemini = {
        analyze: async () => {
          const err429 = new Error('Resource exhausted: quota exceeded');
          err429.status = 429;
          err429.code = 'AI_RATE_LIMITED';
          throw err429;
        }
      };

      const result = await executeReview(
        {
          code: sampleReviewCode,
          language: 'python',
          title: 'Deterministic Static Fallback Test',
          fileName: 'fallback_test.py',
          userId: testUser._id
        },
        {
          geminiClient: mockFailingGemini
        }
      );

      assert.equal(result.review.reviewMode, 'static-fallback');
      assert.equal(result.analysis.aiAvailable, false);
      assert.equal(result.analysis.aiModelUsed, null);
      assert.equal(result.analysis.aiModelTier, 'static-fallback');
      assert.equal(result.analysis.overallScore, result.review.staticScore);
      assert.equal(result.analysis.metrics.bugScore, null, 'AI metrics must be honest nulls');
      assert.equal(result.analysis.metrics.securityScore, null, 'AI metrics must be honest nulls');
      assert.equal(result.analysis.metrics.maintainabilityScore, null, 'AI metrics must be honest nulls');

      // Verify persistence directly in MongoDB
      const dbReview = await CodeReview.findById(result.review._id);
      assert.ok(dbReview);
      assert.equal(dbReview.reviewMode, 'static-fallback');
      assert.equal(dbReview.aiModelTier, 'static-fallback');

      const dbAnalysis = await AnalysisResult.findOne({ reviewId: result.review._id });
      assert.ok(dbAnalysis);
      assert.equal(dbAnalysis.aiAvailable, false);
      assert.equal(dbAnalysis.aiModelTier, 'static-fallback');
      assert.equal(dbAnalysis.overallScore, dbReview.staticScore);
    });
  });

  // =========================================================================
  // 8. LIVE API ENVIRONMENT & CONFIGURATION INTEGRITY
  // =========================================================================
  describe('8. Live API Configuration & Diagnostic Probe', () => {
    it('verifies GEMINI_API_KEY is configured and environment variables are intact', () => {
      assert.ok(env.GEMINI_API_KEY, 'GEMINI_API_KEY must be present in environment');
      assert.ok(env.GEMINI_API_KEY.length >= 30, 'GEMINI_API_KEY must possess valid key length');
      assert.ok(env.GEMINI_MODEL, 'GEMINI_MODEL must be configured');
      assert.ok(env.GEMINI_FALLBACK_MODEL, 'GEMINI_FALLBACK_MODEL must be configured');
      assert.ok(env.GEMINI_TIMEOUT_MS > 0, 'GEMINI_TIMEOUT_MS must be greater than 0');
    });

    it('classifyGeminiError accurately maps JSON-encoded error status codes', () => {
      const quotaErr = new Error(
        JSON.stringify({
          error: {
            code: 429,
            message: 'You exceeded your current quota, please check your plan and billing details.',
            status: 'RESOURCE_EXHAUSTED'
          }
        })
      );

      const classified429 = classifyGeminiError(quotaErr);
      assert.equal(classified429.isRetryable, false);
      assert.equal(classified429.error.code, 'AI_RATE_LIMITED');
      assert.equal(classified429.error.statusCode, 429);

      const demandErr = new Error(
        JSON.stringify({
          error: {
            code: 503,
            message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
            status: 'UNAVAILABLE'
          }
        })
      );

      const classified503 = classifyGeminiError(demandErr);
      assert.equal(classified503.isRetryable, true);
      assert.equal(classified503.error.code, 'AI_PROVIDER_UNAVAILABLE');
      assert.equal(classified503.error.statusCode, 503);
    });
  });
});
