import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import { envSchema, calculateEntropy, INSECURE_DEFAULT_JWT_SECRETS } from '../src/config/env.js';
import app from '../src/app.js';
import { authLimiter } from '../src/middleware/rateLimit.middleware.js';

describe('Phase 17A Security Remediation Tests', () => {
  describe('Task 1: Mongoose Security & Compatibility', () => {
    it('Mongoose version is pinned to 8.24.5 in package.json and exports expected APIs', () => {
      assert.strictEqual(mongoose.version, '8.24.5', 'Mongoose runtime version must be 8.24.5');
      assert.ok(typeof mongoose.connect === 'function', 'mongoose.connect must be a function');
      assert.ok(typeof mongoose.Schema === 'function', 'mongoose.Schema must be a function');
      assert.ok(typeof mongoose.model === 'function', 'mongoose.model must be a function');
    });
  });

  describe('Task 3: Production JWT Secret Validation & Entropy', () => {
    it('calculateEntropy computes correct Shannon entropy', () => {
      assert.strictEqual(calculateEntropy(''), 0);
      assert.strictEqual(calculateEntropy('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), 0);
      const highEntropy = calculateEntropy('c8f9b2d4e6a10735f9e2c4b8d7a1e0f3');
      assert.ok(highEntropy > 3.0, `Entropy must be > 3.0 (got ${highEntropy})`);
    });

    it('rejects missing JWT_SECRET in production mode', () => {
      assert.throws(
        () => {
          envSchema.parse({
            NODE_ENV: 'production',
            CLIENT_URL: 'https://aicode.example.com',
            JWT_SECRET: ''
          });
        },
        (err) => {
          const messages = err.errors.map((e) => e.message);
          return messages.some((m) => m.includes('JWT_SECRET is strictly required in production mode'));
        }
      );
    });

    it('rejects known development/default secrets in production mode', () => {
      for (const insecureSecret of INSECURE_DEFAULT_JWT_SECRETS) {
        assert.throws(
          () => {
            envSchema.parse({
              NODE_ENV: 'production',
              CLIENT_URL: 'https://aicode.example.com',
              JWT_SECRET: insecureSecret
            });
          },
          (err) => {
            const messages = err.errors.map((e) => e.message);
            return messages.some((m) => m.includes('cannot use default or placeholder secret in production'));
          },
          `Must reject insecure secret: ${insecureSecret}`
        );
      }
    });

    it('rejects low-entropy secrets in production mode', () => {
      assert.throws(
        () => {
          envSchema.parse({
            NODE_ENV: 'production',
            CLIENT_URL: 'https://aicode.example.com',
            JWT_SECRET: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' // 32 chars but 0 entropy
          });
        },
        (err) => {
          const messages = err.errors.map((e) => e.message);
          return messages.some((m) => m.includes('must possess strong entropy'));
        }
      );
    });

    it('accepts strong, high-entropy secrets in production mode', () => {
      const validProductionSecret = '9f83b2a7c4e1605d8b72e4a9f3c1508e6d2b7a4c1f9e058d3b7a2c6f4e1905a8';
      const parsed = envSchema.parse({
        NODE_ENV: 'production',
        CLIENT_URL: 'https://aicode.example.com',
        JWT_SECRET: validProductionSecret
      });
      assert.strictEqual(parsed.NODE_ENV, 'production');
      assert.strictEqual(parsed.JWT_SECRET, validProductionSecret);
    });

    it('preserves safe development fallback when NODE_ENV is development or test', () => {
      const parsed = envSchema.parse({
        NODE_ENV: 'development',
        CLIENT_URL: 'http://localhost:5173'
        // JWT_SECRET omitted
      });
      assert.strictEqual(parsed.NODE_ENV, 'development');
      assert.ok(parsed.JWT_SECRET && parsed.JWT_SECRET.length >= 32);
    });
  });

  describe('Task 4: Reverse Proxy Trust & Client IP Resolution', () => {
    let testServer;
    let testPort;
    const testApp = express();

    before(async () => {
      testApp.set('trust proxy', 1);
      testApp.use('/test-rate-limit', authLimiter, (req, res) => {
        res.json({ ip: req.ip, rateLimit: req.rateLimit });
      });
      testApp.get('/test-client-ip', (req, res) => {
        res.json({ ip: req.ip });
      });

      await new Promise((resolve) => {
        testServer = testApp.listen(0, '127.0.0.1', () => {
          testPort = testServer.address().port;
          resolve();
        });
      });
    });

    after(async () => {
      if (testServer) {
        await new Promise((resolve) => testServer.close(resolve));
      }
    });

    it('app has trust proxy configured from env.TRUST_PROXY', () => {
      const trustProxyValue = app.get('trust proxy');
      assert.ok(trustProxyValue === 1 || trustProxyValue === true, `trust proxy must be active (got ${trustProxyValue})`);
    });

    it('resolves real client IP and avoids spoofing when trust proxy is 1', async () => {
      // Forwarded header with forged client prepended: "spoofed_ip, real_client_ip"
      const res = await fetch(`http://127.0.0.1:${testPort}/test-client-ip`, {
        headers: {
          'X-Forwarded-For': '198.51.100.1, 203.0.113.195'
        }
      });
      const data = await res.json();
      assert.strictEqual(data.ip, '203.0.113.195', 'Must resolve the genuine client IP from proxy and ignore prepended forged IP');
    });

    it('rate limiter tracks the genuine client IP from proxy', async () => {
      const res = await fetch(`http://127.0.0.1:${testPort}/test-rate-limit`, {
        headers: {
          'X-Forwarded-For': '198.51.100.22, 203.0.113.77'
        }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ip, '203.0.113.77', 'Rate limiter must track the genuine client IP from proxy');
      assert.ok(data.rateLimit && typeof data.rateLimit.remaining === 'number');
    });
  });
});
