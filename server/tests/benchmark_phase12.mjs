/**
 * Phase 12: Comprehensive Performance, Load & Large-File Benchmark Runner
 * server/tests/benchmark_phase12.mjs
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

import app from '../src/app.js';
import { analyze } from '../src/services/staticAnalyzer/engine.js';
import { languageRuleMap, getRulesForLanguage } from '../src/services/staticAnalyzer/rules/index.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import AnalysisResult from '../src/models/analysisResult.model.js';
import ReviewIssue from '../src/models/reviewIssue.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to calculate percentiles
function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { avg: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = Number((sum / sorted.length).toFixed(2));
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
  return { avg, p50, p95, p99, min: sorted[0], max: sorted[sorted.length - 1], count: sorted.length };
}

// Generators for synthetic code in 6 languages
function generateCode(lang, targetLines) {
  const blocks = [];
  switch (lang) {
    case 'c':
      blocks.push('#include <stdio.h>\n#include <string.h>\n');
      while (blocks.join('\n').split('\n').length < targetLines) {
        const id = blocks.length;
        blocks.push(`void process_chunk_${id}(char* input) {\n    char buf[64];\n    if (input) {\n        strcpy(buf, input);\n        printf("Processed: %s\\n", buf);\n    }\n}`);
      }
      break;
    case 'cpp':
      blocks.push('#include <iostream>\n#include <vector>\n');
      while (blocks.join('\n').split('\n').length < targetLines) {
        const id = blocks.length;
        blocks.push(`void handle_vector_${id}(int count) {\n    int* raw_arr = new int[count];\n    for (int i = 0; i < count; i++) {\n        raw_arr[i] = i * 2;\n    }\n}`);
      }
      break;
    case 'java':
      blocks.push('import java.sql.*;\npublic class BenchmarkService {\n');
      while (blocks.join('\n').split('\n').length < targetLines) {
        const id = blocks.length;
        blocks.push(`    public void executeQuery_${id}(Statement stmt, String userInput) throws SQLException {\n        String sql = "SELECT * FROM items WHERE id = '" + userInput + "'";\n        stmt.executeQuery(sql);\n    }`);
      }
      blocks.push('}');
      break;
    case 'python':
      blocks.push('import os\nimport pickle\n');
      while (blocks.join('\n').split('\n').length < targetLines) {
        const id = blocks.length;
        blocks.push(`def handler_task_${id}(cmd_param, raw_data):\n    os.system(cmd_param)\n    if raw_data:\n        return pickle.loads(raw_data)\n    return None\n`);
      }
      break;
    case 'javascript':
      blocks.push('// JavaScript Benchmark Script\n');
      while (blocks.join('\n').split('\n').length < targetLines) {
        const id = blocks.length;
        blocks.push(`function computeExpression_${id}(untrustedInput) {\n    const parsed = eval(untrustedInput);\n    console.log("Result:", parsed);\n    return parsed;\n}`);
      }
      break;
    case 'typescript':
      blocks.push('import { exec } from "child_process";\n');
      while (blocks.join('\n').split('\n').length < targetLines) {
        const id = blocks.length;
        blocks.push(`export function executeScript_${id}(commandString: string): Promise<string> {\n    return new Promise((resolve) => {\n        exec(commandString, (err, stdout) => {\n            resolve(stdout);\n        });\n    });\n}`);
      }
      break;
  }
  return blocks.join('\n');
}

async function runBenchmark() {
  console.log('===============================================================');
  console.log(' PHASE 12: COMPREHENSIVE PERFORMANCE & LOAD BENCHMARK');
  console.log('===============================================================\n');

  const results = {
    part1_large_files: {},
    part2_analyzer_perf: {},
    part3_api_latencies: {},
    part4_concurrency: {},
    part5_database: {},
    part7_resource_limits: {}
  };

  // =========================================================================
  // PART 1: LARGE CODE FILE TESTING ACROSS ALL 6 LANGUAGES
  // =========================================================================
  console.log('--- PART 1: Large Code File Testing (100, 500, 1000, 2500, 5000 LOC) ---');
  const languages = ['c', 'cpp', 'java', 'python', 'javascript', 'typescript'];
  const sizes = [100, 500, 1000, 2500, 5000];

  for (const lang of languages) {
    results.part1_large_files[lang] = {};
    for (const size of sizes) {
      const code = generateCode(lang, size);
      const actualLines = code.split('\n').length;
      const codeBytes = Buffer.byteLength(code, 'utf8');

      if (global.gc) global.gc();
      const memBefore = process.memoryUsage().heapUsed;
      const tStart = process.hrtime.bigint();

      const analysis = analyze(code, lang);

      const tEnd = process.hrtime.bigint();
      const memAfter = process.memoryUsage().heapUsed;

      const durationMs = Number(tEnd - tStart) / 1_000_000;
      const memDeltaKb = Math.round((memAfter - memBefore) / 1024);
      const findingsCount = analysis.findings.length;
      const linesPerSec = Math.round((actualLines / durationMs) * 1000);

      results.part1_large_files[lang][size] = {
        targetLines: size,
        actualLines,
        codeBytes,
        durationMs: Number(durationMs.toFixed(2)),
        memDeltaKb,
        findingsCount,
        linesPerSec,
        score: analysis.scoring.overallScore
      };

      console.log(`  [${lang.padEnd(10)}] ${size.toString().padStart(5)} LOC -> ${durationMs.toFixed(2).padStart(7)} ms | ${findingsCount.toString().padStart(4)} findings | ${memDeltaKb.toString().padStart(6)} KB heap | ${linesPerSec.toLocaleString().padStart(9)} lines/s`);
    }
  }

  // =========================================================================
  // PART 2: STATIC ANALYZER PERFORMANCE, REDOS & ADVERSARIAL STRESS
  // =========================================================================
  console.log('\n--- PART 2: Static Analyzer Regex ReDoS & Deep Nesting Audit ---');
  let redosVulnerableCount = 0;
  let totalRulesAudited = 0;

  for (const lang of languages) {
    const rules = getRulesForLanguage(lang);
    totalRulesAudited += rules.length;
    for (const rule of rules) {
      const adversarialInput = 'a'.repeat(500) + '!';
      const t0 = process.hrtime.bigint();
      try {
        rule.regex.test(adversarialInput);
      } catch (err) {
        // ignore
      }
      const t1 = process.hrtime.bigint();
      const regexDurationMs = Number(t1 - t0) / 1_000_000;
      if (regexDurationMs > 50) {
        redosVulnerableCount++;
        console.warn(`  [ReDoS Warning] Rule ${rule.ruleId} took ${regexDurationMs.toFixed(2)} ms on adversarial input`);
      }
    }
  }

  // Test deeply nested syntax (50 levels of brackets)
  const deeplyNested = '('.repeat(50) + 'userInput' + ')'.repeat(50);
  const tNest0 = process.hrtime.bigint();
  const nestedResult = analyze(`eval(${deeplyNested});`, 'javascript');
  const tNest1 = process.hrtime.bigint();
  const nestedDurationMs = Number(tNest1 - tNest0) / 1_000_000;

  // Test 1,000 iterations for memory leak
  const memLeakStart = process.memoryUsage().heapUsed;
  const samplePy = `def foo():\n    return 42\n`;
  for (let i = 0; i < 1000; i++) {
    analyze(samplePy, 'python');
  }
  const memLeakEnd = process.memoryUsage().heapUsed;
  const leakGrowthKb = Math.round((memLeakEnd - memLeakStart) / 1024);

  results.part2_analyzer_perf = {
    totalRulesAudited,
    redosVulnerableCount,
    deeplyNestedDurationMs: Number(nestedDurationMs.toFixed(2)),
    nestedFindings: nestedResult.findings.length,
    leakGrowthKb1000Runs: leakGrowthKb
  };

  console.log(`  Total Rules Checked for ReDoS: ${totalRulesAudited}`);
  console.log(`  ReDoS Vulnerable Rules: ${redosVulnerableCount}`);
  console.log(`  Deeply Nested Input (50 levels) Execution Time: ${nestedDurationMs.toFixed(2)} ms`);
  console.log(`  1,000 Iterations Heap Growth: ${leakGrowthKb} KB`);

  // =========================================================================
  // SETUP HTTP SERVER FOR PARTS 3, 4, 5
  // =========================================================================
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  const server = http.createServer(app);
  let serverPort;
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      resolve();
    });
  });

  function request(path, opts = {}) {
    return new Promise((resolve, reject) => {
      const t0 = process.hrtime.bigint();
      const req = http.request({
        hostname: '127.0.0.1',
        port: serverPort,
        path,
        method: opts.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Connection': 'keep-alive',
          ...(opts.headers || {})
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const t1 = process.hrtime.bigint();
          const latencyMs = Number(t1 - t0) / 1_000_000;
          let body;
          try { body = JSON.parse(data); } catch { body = data; }
          resolve({ status: res.statusCode, headers: res.headers, body, latencyMs });
        });
      });
      req.on('error', reject);
      if (opts.body) {
        req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
      }
      req.end();
    });
  }

  // Create test user and obtain auth token
  const TEST_EMAIL = `perf_audit_${Date.now()}@example.com`;
  const TEST_PASS = 'PerfAuditPass123!';

  await request('/api/v1/auth/register', {
    method: 'POST',
    body: { name: 'Performance Lead', email: TEST_EMAIL, password: TEST_PASS }
  });

  const loginRes = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { email: TEST_EMAIL, password: TEST_PASS }
  });

  const authToken = loginRes.body.data.token;
  const authHeaders = { 'Authorization': `Bearer ${authToken}` };

  // Create a baseline review
  const createReviewRes = await request('/api/v1/reviews', {
    method: 'POST',
    headers: authHeaders,
    body: {
      code: 'import os\ndef test(cmd):\n    os.system(cmd)\n',
      language: 'python',
      title: 'Baseline Review for Latency Testing'
    }
  });

  const sampleReviewId = createReviewRes.body.data.review._id;

  // =========================================================================
  // PART 3: API ENDPOINT LATENCY PROFILING (Average, P50, P95, P99, Throughput)
  // =========================================================================
  console.log('\n--- PART 3: API Endpoint Latency Profiling (10 samples per endpoint) ---');

  const endpointsToProfile = [
    { name: 'GET /api/v1/auth/me', path: '/api/v1/auth/me', method: 'GET', headers: authHeaders },
    { name: 'GET /api/v1/users/stats', path: '/api/v1/users/stats', method: 'GET', headers: authHeaders },
    { name: 'GET /api/v1/reviews', path: '/api/v1/reviews?limit=10', method: 'GET', headers: authHeaders },
    { name: 'GET /api/v1/reviews/:id', path: `/api/v1/reviews/${sampleReviewId}`, method: 'GET', headers: authHeaders },
    { name: 'GET /api/v1/reviews/:id/security', path: `/api/v1/reviews/${sampleReviewId}/security`, method: 'GET', headers: authHeaders },
    { name: 'GET /api/v1/reviews/:id/performance', path: `/api/v1/reviews/${sampleReviewId}/performance`, method: 'GET', headers: authHeaders },
    { name: 'GET /api/v1/reviews/:id/export (MD)', path: `/api/v1/reviews/${sampleReviewId}/export?format=markdown`, method: 'GET', headers: authHeaders },
    { name: 'GET /api/v1/reviews/:id/export (JSON)', path: `/api/v1/reviews/${sampleReviewId}/export?format=json`, method: 'GET', headers: authHeaders },
    {
      name: 'POST /api/v1/reviews/:id/apply-fix',
      path: `/api/v1/reviews/${sampleReviewId}/apply-fix`,
      method: 'POST',
      headers: authHeaders,
      body: {
        lineStart: 1,
        lineEnd: 3,
        appliedSnippet: 'import subprocess\ndef test(cmd):\n    subprocess.run([cmd])\n',
        updatedCode: 'import subprocess\ndef test(cmd):\n    subprocess.run([cmd])\n'
      }
    },
    {
      name: 'POST /api/v1/reviews/:id/undo-fix',
      path: `/api/v1/reviews/${sampleReviewId}/undo-fix`,
      method: 'POST',
      headers: authHeaders,
      body: {}
    }
  ];

  for (const ep of endpointsToProfile) {
    const latencies = [];
    let errCount = 0;
    const SAMPLE_COUNT = 10;

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const res = await request(ep.path, {
        method: ep.method,
        headers: ep.headers,
        body: ep.body
      });
      if (res.status >= 400) {
        errCount++;
      }
      latencies.push(Number(res.latencyMs.toFixed(2)));
    }

    const stats = calculatePercentiles(latencies);
    stats.errorRate = Number(((errCount / SAMPLE_COUNT) * 100).toFixed(1));
    stats.throughputRps = Number((1000 / stats.avg).toFixed(1));

    results.part3_api_latencies[ep.name] = stats;
    console.log(`  ${ep.name.padEnd(35)} -> Avg: ${stats.avg.toFixed(1).padStart(5)} ms | P50: ${stats.p50.toFixed(1).padStart(5)} ms | P95: ${stats.p95.toFixed(1).padStart(5)} ms | P99: ${stats.p99.toFixed(1).padStart(5)} ms | Throughput: ${stats.throughputRps.toString().padStart(5)} rps`);
  }

  // =========================================================================
  // PART 4: CONCURRENT REQUEST TESTING (1, 5, 10, 25 CONCURRENT WORKERS)
  // =========================================================================
  console.log('\n--- PART 4: Controlled Concurrent Load Testing (Mocked Gemini / Local Server) ---');
  const concurrencyLevels = [1, 5, 10, 25];

  for (const concurrency of concurrencyLevels) {
    const TOTAL_REQUESTS = concurrency * 4;
    const latencies = [];
    let errCount = 0;

    const tStart = process.hrtime.bigint();
    const memBefore = process.memoryUsage().heapUsed;

    const executeBatch = async (batchSize) => {
      const promises = [];
      for (let i = 0; i < batchSize; i++) {
        promises.push(
          request('/api/v1/users/stats', { method: 'GET', headers: authHeaders })
            .then(res => {
              latencies.push(res.latencyMs);
              if (res.status !== 200) errCount++;
            })
            .catch(() => {
              errCount++;
            })
        );
      }
      await Promise.all(promises);
    };

    for (let sent = 0; sent < TOTAL_REQUESTS; sent += concurrency) {
      await executeBatch(Math.min(concurrency, TOTAL_REQUESTS - sent));
    }

    const tEnd = process.hrtime.bigint();
    const memAfter = process.memoryUsage().heapUsed;
    const totalDurationSec = Number(tEnd - tStart) / 1_000_000_000;

    const stats = calculatePercentiles(latencies);
    stats.concurrency = concurrency;
    stats.totalRequests = TOTAL_REQUESTS;
    stats.durationSec = Number(totalDurationSec.toFixed(2));
    stats.throughputRps = Number((TOTAL_REQUESTS / totalDurationSec).toFixed(1));
    stats.errorRate = Number(((errCount / TOTAL_REQUESTS) * 100).toFixed(1));
    stats.memDeltaKb = Math.round((memAfter - memBefore) / 1024);

    results.part4_concurrency[`${concurrency}_concurrent_users`] = stats;
    console.log(`  [Concurrency: ${concurrency.toString().padStart(2)}] -> Requests: ${TOTAL_REQUESTS.toString().padStart(3)} | Throughput: ${stats.throughputRps.toFixed(1).padStart(5)} rps | Avg Latency: ${stats.avg.toFixed(1).padStart(5)} ms | P95: ${stats.p95.toFixed(1).padStart(5)} ms | Errors: ${stats.errorRate}%`);
  }

  // =========================================================================
  // PART 5: DATABASE PERFORMANCE & INDEX VERIFICATION
  // =========================================================================
  console.log('\n--- PART 5: MongoDB Index Inspection & Query Execution ---');

  const reviewIndexes = await CodeReview.collection.indexes();
  const issueIndexes = await ReviewIssue.collection.indexes();
  const analysisIndexes = await AnalysisResult.collection.indexes();

  results.part5_database.reviewIndexes = reviewIndexes.map(idx => Object.keys(idx.key).join('_'));
  results.part5_database.issueIndexes = issueIndexes.map(idx => Object.keys(idx.key).join('_'));
  results.part5_database.analysisIndexes = analysisIndexes.map(idx => Object.keys(idx.key).join('_'));

  console.log(`  CodeReview Indexes: ${results.part5_database.reviewIndexes.join(', ')}`);
  console.log(`  ReviewIssue Indexes: ${results.part5_database.issueIndexes.join(', ')}`);
  console.log(`  AnalysisResult Indexes: ${results.part5_database.analysisIndexes.join(', ')}`);

  const tAgg0 = process.hrtime.bigint();
  await CodeReview.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(loginRes.body.data.user._id) } },
    { $group: { _id: '$language', count: { $sum: 1 } } }
  ]);
  const tAgg1 = process.hrtime.bigint();
  const aggMs = Number(tAgg1 - tAgg0) / 1_000_000;
  results.part5_database.userStatsAggregationMs = Number(aggMs.toFixed(2));
  console.log(`  User Stats Language Aggregation: ${aggMs.toFixed(2)} ms`);

  // =========================================================================
  // PART 7: SECURITY & RESOURCE LIMITS
  // =========================================================================
  console.log('\n--- PART 7: Security Limits & Oversized Input Boundaries ---');

  // Test 1: Payload exceeding 2MB (express.json limit)
  const hugePayload = 'x'.repeat(2 * 1024 * 1024 + 1024);
  const oversizedRes = await request('/api/v1/reviews', {
    method: 'POST',
    headers: authHeaders,
    body: { code: hugePayload, language: 'python' }
  });
  const payloadLimitEnforced = oversizedRes.status === 413 || oversizedRes.status === 400;
  console.log(`  Payload > 2MB Protection: Status ${oversizedRes.status} (Enforced: ${payloadLimitEnforced})`);

  // Test 2: Code exceeding 2,500 LOC (Schema limit)
  const codeOver2500 = generateCode('python', 3000);
  const overLocRes = await request('/api/v1/reviews', {
    method: 'POST',
    headers: authHeaders,
    body: { code: codeOver2500, language: 'python' }
  });
  const locLimitEnforced = overLocRes.status === 400 && JSON.stringify(overLocRes.body).includes('2,500 LOC');
  console.log(`  Code > 2,500 LOC Protection: Status ${overLocRes.status} (Enforced: ${locLimitEnforced})`);

  results.part7_resource_limits = {
    payloadLimitEnforced,
    payloadStatus: oversizedRes.status,
    locLimitEnforced,
    locStatus: overLocRes.status
  };

  // Teardown
  await CodeReview.deleteMany({ userId: loginRes.body.data.user._id });
  await User.deleteOne({ _id: loginRes.body.data.user._id });
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();

  // Save benchmark results to scratch directory
  const outPath = path.resolve('../scratch/phase12_benchmark_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n[Benchmark Finished] Results written to: ${outPath}`);
}

runBenchmark().catch(err => {
  console.error('Benchmark fatal error:', err);
  process.exit(1);
});
