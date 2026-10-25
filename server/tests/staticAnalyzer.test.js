/**
 * Backend Integration & Unit Tests for Phase 7: Static Code Analysis Engine
 *
 * Verifies:
 * 1. Universal secrets scanning (raw source scan)
 * 2. Lexical state machine & comment masking (FSM, 1:1 offsets, Python docstrings)
 * 3. All language rule implementations (Python, JS, TS, Java, C, C++)
 * 4. Strict same-rule deduplication & cross-rule finding preservation
 * 5. Scoring formula with diminishing multipliers and 1.75x rule cap
 * 6. HTTP API validation, authentication guards, rate limits, and zero DB persistence
 */

import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import * as dbConfig from '../src/config/db.js';
import User from '../src/models/user.model.js';
import CodeReview from '../src/models/review.model.js';
import { analyzeCode, getAllRules, getRulesForLanguage, preprocessCode, calculateScore } from '../src/services/staticAnalyzer/index.js';
import { deduplicateFindings } from '../src/services/staticAnalyzer/utils/deduplicator.js';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/aicode_review_test';

let server;
let serverPort;
let testUser;

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
        resolve({
          statusCode: res.statusCode,
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

const createTestJwt = (userId, email = 'dev@test.dev') => {
  const targetId = userId || (testUser ? testUser._id.toString() : '507f1f77bcf86cd799439011');
  return jwt.sign(
    {
      id: targetId,
      email,
      role: 'developer'
    },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

describe('Phase 7: Static Code Analysis Engine', () => {
  before(async () => {
    // 1. Connect strictly to isolated test database
    await mongoose.connect(TEST_DB_URI);

    // 2. Create isolated test user
    testUser = await User.create({
      name: 'Static Analysis Test Dev',
      email: `analyzer_${Date.now()}@test.dev`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: 'developer'
    });

    // 3. Start HTTP server on dynamic port
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    // 1. Clean up test user
    if (testUser) {
      await User.deleteOne({ _id: testUser._id });
    }

    // 2. Close HTTP server
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }

    // 3. Remove application-level disconnected listeners and disconnect cleanly
    const disconnectedListeners = mongoose.connection.listeners('disconnected');
    for (const listener of disconnectedListeners) {
      mongoose.connection.removeListener('disconnected', listener);
    }
    await dbConfig.disconnectDB();
  });

  // =========================================================================
  // 1. RULE REGISTRY INTEGRITY
  // =========================================================================
  test('Rule Registry: all 65 rules registered with required fields', () => {
    const rules = getAllRules();
    assert.strictEqual(rules.length, 65, 'Expected exactly 65 registered rules');

    for (const rule of rules) {
      assert.ok(rule.ruleId, 'Rule must have ruleId');
      assert.ok(rule.title, `Rule ${rule.ruleId} must have title`);
      assert.ok(['SEC', 'RISK', 'QUAL'].includes(rule.category), `Invalid category for ${rule.ruleId}`);
      assert.ok(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].includes(rule.severity), `Invalid severity for ${rule.ruleId}`);
      assert.ok(rule.regex instanceof RegExp, `Rule ${rule.ruleId} must have regex`);
      assert.ok(rule.explanation, `Rule ${rule.ruleId} must have explanation`);
    }
  });

  // =========================================================================
  // 2. TIER 1: UNIVERSAL SECRET DETECTION (RAW SOURCE SCAN)
  // =========================================================================
  test('Secrets: SEC-GEN-001 detects AWS access keys (even inside comments)', () => {
    const positive = '// AWS Key: AKIAIOSFODNN7EXAMPLE\nconst s3 = true;';
    const result = analyzeCode(positive, 'javascript');
    const finding = result.findings.find((f) => f.ruleId === 'SEC-GEN-001');
    assert.ok(finding, 'Must detect AWS key in comment');
    assert.strictEqual(finding.severity, 'CRITICAL');

    const negative = 'const normalVar = "notAnAwsKey";';
    const negResult = analyzeCode(negative, 'javascript');
    assert.ok(!negResult.findings.some((f) => f.ruleId === 'SEC-GEN-001'));
  });

  test('Secrets: SEC-GEN-002 detects GitHub personal access tokens', () => {
    const code = 'const token = "ghp_123456789012345678901234567890123456";';
    const result = analyzeCode(code, 'javascript');
    const finding = result.findings.find((f) => f.ruleId === 'SEC-GEN-002');
    assert.ok(finding, 'Must detect GitHub token');
  });

  test('Secrets: SEC-GEN-003 detects private key blocks', () => {
    const code = 'const key = "-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA...";';
    const result = analyzeCode(code, 'javascript');
    const finding = result.findings.find((f) => f.ruleId === 'SEC-GEN-003');
    assert.ok(finding, 'Must detect private key block');
  });

  test('Secrets: SEC-GEN-004 detects hardcoded JWTs', () => {
    const code = 'const auth = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.xyz_mock_signature";';
    const result = analyzeCode(code, 'javascript');
    const finding = result.findings.find((f) => f.ruleId === 'SEC-GEN-004');
    assert.ok(finding, 'Must detect JWT');
  });

  test('Secrets: SEC-GEN-005 detects cleartext password assignment', () => {
    const code = 'db_password = "productionMasterPassword#2026"';
    const result = analyzeCode(code, 'python');
    const finding = result.findings.find((f) => f.ruleId === 'SEC-GEN-005');
    assert.ok(finding, 'Must detect cleartext password assignment');
  });

  // =========================================================================
  // 3. LEXICAL PREPROCESSING, COMMENT MASKING & DOCSTRINGS
  // =========================================================================
  test('Lexical FSM: masks line comments and block comments without changing line offsets', () => {
    const raw = 'const a = 1; // eval("line comment")\n/*\n * eval("block comment")\n */\nconst b = 2;';
    const masked = preprocessCode(raw, 'javascript');

    assert.strictEqual(masked.length, raw.length, 'Length must be identical');
    assert.ok(!masked.includes('eval("line comment")'), 'Line comment content must be masked');
    assert.ok(!masked.includes('eval("block comment")'), 'Block comment content must be masked');
    assert.ok(masked.includes('const a = 1;'), 'Code before comment must be preserved');
    assert.ok(masked.includes('const b = 2;'), 'Code after comment must be preserved');

    // Analysis on this code must produce 0 dynamic execution findings
    const result = analyzeCode(raw, 'javascript');
    assert.strictEqual(result.findings.filter((f) => f.ruleId === 'RISK-JS-001').length, 0);
  });

  test('Lexical FSM: Python triple-quoted docstrings are preserved and not masked', () => {
    const raw = 'def calculate():\n    """Docstring containing # not a comment."""\n    return eval("1+1")';
    const masked = preprocessCode(raw, 'python');

    assert.ok(masked.includes('Docstring containing # not a comment.'), 'Docstrings must not be masked');
    const result = analyzeCode(raw, 'python');
    const finding = result.findings.find((f) => f.ruleId === 'RISK-PY-001');
    assert.ok(finding, 'Must find eval() after docstring');
    assert.strictEqual(finding.lineStart, 3);
  });

  test('Lexical FSM: Escaped quotes inside strings do not terminate string boundary prematurely', () => {
    const raw = 'const str = "hello \\" world // not a comment";\nconst x = eval("test");';
    const masked = preprocessCode(raw, 'javascript');
    assert.ok(masked.includes('hello \\" world // not a comment'));

    const result = analyzeCode(raw, 'javascript');
    const finding = result.findings.find((f) => f.ruleId === 'RISK-JS-001');
    assert.ok(finding, 'Must detect eval() on second line');
    assert.strictEqual(finding.lineStart, 2);
  });

  // =========================================================================
  // 4. LANGUAGE-SPECIFIC RULES
  // =========================================================================
  test('Language Rules: Python (eval, pickle, shell=True, bare except, mutable default)', () => {
    const code = [
      'import pickle, subprocess',
      'def load_stuff(items=[]):',
      '    try:',
      '        res = eval(input())',
      '        data = pickle.loads(raw)',
      '        subprocess.run("ls -la", shell=True)',
      '    except:',
      '        pass'
    ].join('\n');

    const result = analyzeCode(code, 'python');
    const ruleIds = result.findings.map((f) => f.ruleId);

    assert.ok(ruleIds.includes('RISK-PY-001'), 'Must detect eval');
    assert.ok(ruleIds.includes('RISK-PY-002'), 'Must detect pickle.loads');
    assert.ok(ruleIds.includes('RISK-PY-003'), 'Must detect shell=True');
    assert.ok(ruleIds.includes('QUAL-PY-001'), 'Must detect bare except:');
    assert.ok(ruleIds.includes('QUAL-PY-002'), 'Must detect mutable default argument');
  });

  test('Language Rules: Python (os.system and os.popen detection)', () => {
    const code = [
      'import os',
      'def run_cmd(user_input):',
      '    os.system("rm -rf " + user_input)',
      '    pipe = os.popen("cat " + user_input)'
    ].join('\n');

    const result = analyzeCode(code, 'python');
    const ruleIds = result.findings.map((f) => f.ruleId);

    assert.ok(ruleIds.includes('RISK-PY-003'), 'Must detect os.system under RISK-PY-003');
    assert.ok(ruleIds.includes('SEC-PY-CMD-001'), 'Must detect os.system under SEC-PY-CMD-001');
    const cmdFindings = result.findings.filter((f) => f.ruleId === 'RISK-PY-003');
    assert.equal(cmdFindings.length, 2, 'Must detect both os.system and os.popen');
  });

  test('Language Rules: Python string literal, docstring, and comment immunity', () => {
    const code = [
      '# os.system("rm -rf /")',
      '# subprocess.run("cmd", shell=True)',
      '"""',
      'os.system("rm -rf /")',
      'subprocess.run("test", shell=True)',
      '"""',
      'def info():',
      '    msg = "Use os.system or subprocess.run shell=True with care"',
      '    return os.path.join("/tmp", "safe.txt")'
    ].join('\n');

    const result = analyzeCode(code, 'python');
    const cmdFindings = result.findings.filter(
      (f) => f.ruleId === 'RISK-PY-003' || f.ruleId === 'SEC-PY-CMD-001'
    );
    assert.equal(cmdFindings.length, 0, 'Must NOT flag comments, docstrings, or string literals');
  });

  test('Language Rules: JavaScript (eval, innerHTML, child_process.exec, secure:false cookie, empty catch, loose equality, debugger)', () => {
    const code = [
      'try {',
      '  eval(cmd);',
      '  document.getElementById("out").innerHTML = raw;',
      '  child_process.exec("rm -rf " + folder);',
      '  res.cookie("auth", token, { secure: false });',
      '  if (x == 5) console.log("x");',
      '  debugger;',
      '} catch (e) {}'
    ].join('\n');

    const result = analyzeCode(code, 'javascript');
    const ruleIds = result.findings.map((f) => f.ruleId);

    assert.ok(ruleIds.includes('RISK-JS-001'), 'Must detect eval');
    assert.ok(ruleIds.includes('RISK-JS-002'), 'Must detect innerHTML');
    assert.ok(ruleIds.includes('RISK-JS-003'), 'Must detect child_process.exec');
    assert.ok(ruleIds.includes('RISK-JS-004'), 'Must detect secure: false cookie');
    assert.ok(ruleIds.includes('QUAL-JS-001'), 'Must detect empty catch');
    assert.ok(ruleIds.includes('QUAL-JS-002'), 'Must detect loose equality ==');
    assert.ok(ruleIds.includes('QUAL-JS-003'), 'Must detect active debugger statement');
  });

  test('Language Rules: JavaScript (require("child_process").exec and execSync detection)', () => {
    const code = [
      'function run(user) {',
      '  require("child_process").exec("cat " + user);',
      '  require(\'child_process\').execSync(`rm -rf ${user}`);',
      '}'
    ].join('\n');

    const result = analyzeCode(code, 'javascript');
    const ruleIds = result.findings.map((f) => f.ruleId);

    assert.ok(ruleIds.includes('RISK-JS-003'), 'Must detect require("child_process").exec under RISK-JS-003');
    assert.ok(ruleIds.includes('SEC-JS-CMD-001'), 'Must detect require("child_process").exec under SEC-JS-CMD-001');
    const cmdFindings = result.findings.filter((f) => f.ruleId === 'RISK-JS-003');
    assert.equal(cmdFindings.length, 2, 'Must detect both exec and execSync');
  });

  test('Language Rules: JavaScript string literal and comment immunity for command injection', () => {
    const code = [
      '// require("child_process").exec("cat " + user);',
      '/* child_process.exec("cat " + user); */',
      'const msg = "require(\'child_process\').exec(\'cat \' + user)";',
      'const msg2 = \'child_process.exec("cat " + user)\';',
      'const msg3 = `require("child_process").exec("cat " + user)`;',
      'function safe() {',
      '  child_process.execFile("ping", ["127.0.0.1"]);',
      '  child_process.spawn("ls", ["-la"]);',
      '  child_process.exec("ls -la", callback);',
      '}'
    ].join('\n');

    const result = analyzeCode(code, 'javascript');
    const cmdFindings = result.findings.filter(
      (f) => f.ruleId === 'RISK-JS-003' || f.ruleId === 'SEC-JS-CMD-001'
    );
    assert.equal(cmdFindings.length, 0, 'Must NOT flag comments, strings, or safe child_process methods');
  });

  test('Language Rules: TypeScript (eval, dangerouslySetInnerHTML, any, empty catch)', () => {
    const code = [
      'const value: any = eval("test");',
      'const element = <div dangerouslySetInnerHTML={{ __html: content }} />;',
      'try { doSomething(); } catch (e) {}'
    ].join('\n');

    const result = analyzeCode(code, 'typescript');
    const ruleIds = result.findings.map((f) => f.ruleId);

    assert.ok(ruleIds.includes('RISK-TS-001'), 'Must detect eval');
    assert.ok(ruleIds.includes('RISK-TS-002'), 'Must detect dangerouslySetInnerHTML');
    assert.ok(ruleIds.includes('QUAL-TS-001'), 'Must detect : any type escape');
    assert.ok(ruleIds.includes('QUAL-TS-002'), 'Must detect empty catch');
  });

  test('Language Rules: Java (JDBC credentials, SQL injection, readObject, Runtime.exec, Throwable, empty catch)', () => {
    const code = [
      'DriverManager.getConnection("jdbc:mysql://localhost/db?password=secret");',
      'stmt.executeQuery("SELECT * FROM users WHERE name = \'" + user + "\'");',
      'ois.readObject();',
      'Runtime.getRuntime().exec("sh script.sh " + param);',
      'try { process(); } catch (Throwable t) {}'
    ].join('\n');

    const result = analyzeCode(code, 'java');
    const ruleIds = result.findings.map((f) => f.ruleId);

    assert.ok(ruleIds.includes('SEC-JAV-001'), 'Must detect JDBC credentials');
    assert.ok(ruleIds.includes('RISK-JAV-001'), 'Must detect SQL concatenation');
    assert.ok(ruleIds.includes('RISK-JAV-002'), 'Must detect readObject');
    assert.ok(ruleIds.includes('RISK-JAV-003'), 'Must detect Runtime.exec');
    assert.ok(ruleIds.includes('QUAL-JAV-001'), 'Must detect catch Throwable');
    assert.ok(ruleIds.includes('QUAL-JAV-002'), 'Must detect empty catch');
  });

  test('Language Rules: C (strcpy, gets, sprintf %s, scanf %s, system)', () => {
    const code = [
      'char buf[64];',
      'gets(buf);',
      'strcpy(buf, input);',
      'sprintf(buf, "%s", input);',
      'scanf("%s", buf);',
      'system("ls " + dir);'
    ].join('\n');

    const result = analyzeCode(code, 'c');
    const ruleIds = result.findings.map((f) => f.ruleId);

    assert.ok(ruleIds.includes('RISK-C-001'), 'Must detect strcpy');
    assert.ok(ruleIds.includes('RISK-C-002'), 'Must detect gets');
    assert.ok(ruleIds.includes('RISK-C-003'), 'Must detect sprintf %s');
    assert.ok(ruleIds.includes('RISK-C-004'), 'Must detect scanf %s');
    assert.ok(ruleIds.includes('RISK-C-005'), 'Must detect system()');
  });

  test('Language Rules: C++ (strcpy in C++, std::system, sprintf in C++, C-style cast, empty catch (...))', () => {
    const code = [
      'char buf[30];',
      'strcpy(buf, str.c_str());',
      'std::system(("rm " + file).c_str());',
      'sprintf(buf, "%s", file.c_str());',
      'int x = (int)count;',
      'try { run(); } catch (...) {}'
    ].join('\n');

    const result = analyzeCode(code, 'cpp');
    const ruleIds = result.findings.map((f) => f.ruleId);

    assert.ok(ruleIds.includes('RISK-CPP-001'), 'Must detect strcpy in C++');
    assert.ok(ruleIds.includes('RISK-CPP-002'), 'Must detect std::system');
    assert.ok(ruleIds.includes('RISK-CPP-003'), 'Must detect sprintf in C++');
    assert.ok(ruleIds.includes('QUAL-CPP-001'), 'Must detect C-style cast');
    assert.ok(ruleIds.includes('QUAL-CPP-002'), 'Must detect catch (...)');
  });

  test('Language Rules: C++ (division by zero, array out of bounds, uninitialized variable, infinite loop)', () => {
    const code = [
      'int divide(int a, int b) {',
      '    return a / b;',
      '}',
      'void testArray() {',
      '    int arr[5] = {10, 20, 30, 40, 50};',
      '    cout << arr[10];',
      '}',
      'void testUninit() {',
      '    int result;',
      '    cout << result;',
      '}',
      'void testLoop() {',
      '    while (true) {',
      '        cout << "Running..." << endl;',
      '    }',
      '}'
    ].join('\n');

    const result = analyzeCode(code, 'cpp');
    const ruleIds = result.findings.map((f) => f.ruleId);

    assert.ok(ruleIds.includes('RISK-CPP-004'), 'Must detect potential division by zero (RISK-CPP-004)');
    assert.ok(ruleIds.includes('RISK-CPP-005'), 'Must detect array index out of bounds (RISK-CPP-005)');
    assert.ok(ruleIds.includes('RISK-CPP-006'), 'Must detect uninitialized variable read (RISK-CPP-006)');
    assert.ok(ruleIds.includes('QUAL-CPP-003'), 'Must detect unconditional infinite loop (QUAL-CPP-003)');

    const aobFinding = result.findings.find((f) => f.ruleId === 'RISK-CPP-005');
    assert.strictEqual(aobFinding.severity, 'CRITICAL', 'Array out of bounds must be CRITICAL');
    assert.strictEqual(aobFinding.cwe, 'CWE-125');

    const divFinding = result.findings.find((f) => f.ruleId === 'RISK-CPP-004');
    assert.strictEqual(divFinding.severity, 'HIGH', 'Division by zero must be HIGH');
    assert.strictEqual(divFinding.cwe, 'CWE-369');
  });

  test('Language Rules: C++ Negative Tests (safe code must not trigger false positives)', () => {
    const safeCode = [
      'int safeDivide(int a, int b) {',
      '    if (b == 0) return 0;',
      '    return a / b;',
      '}',
      'void safeArray() {',
      '    int arr[5] = {10, 20, 30, 40, 50};',
      '    cout << arr[2];',
      '}',
      'void safeUninit() {',
      '    int result = 42;',
      '    cout << result;',
      '}',
      'void safeLoop() {',
      '    while (true) {',
      '        if (check()) break;',
      '    }',
      '}'
    ].join('\n');

    const result = analyzeCode(safeCode, 'cpp');
    const relevantRuleIds = ['RISK-CPP-004', 'RISK-CPP-005', 'RISK-CPP-006', 'QUAL-CPP-003'];
    const falseFindings = result.findings.filter((f) => relevantRuleIds.includes(f.ruleId));

    assert.strictEqual(falseFindings.length, 0, `Expected 0 false findings on safe C++ code, got: ${JSON.stringify(falseFindings)}`);
    assert.strictEqual(result.scoring.overallScore, 100, 'Safe code must maintain 100 score');
  });

  test('Language Rules: C++ (comments and string literals do not trigger false findings)', () => {
    const commentAndStringCode = [
      '// return a / b;',
      '// int arr[5]; cout << arr[10];',
      '/* int result; cout << result; */',
      '/* while (true) {} */',
      'void testStrings() {',
      '    std::string s1 = "return a / b;";',
      '    std::string s2 = "while (true) { cout << 1; }";',
      '    std::string s3 = "int arr[5]; cout << arr[10];";',
      '}'
    ].join('\n');

    const result = analyzeCode(commentAndStringCode, 'cpp');
    const relevantRuleIds = ['RISK-CPP-004', 'RISK-CPP-005', 'RISK-CPP-006', 'QUAL-CPP-003'];
    const falseFindings = result.findings.filter((f) => relevantRuleIds.includes(f.ruleId));

    assert.strictEqual(falseFindings.length, 0, 'Comments and strings must not trigger C++ static findings');
  });

  // =========================================================================
  // 5. SAME-RULE DEDUPLICATION & CROSS-RULE ISOLATION
  // =========================================================================
  test('Deduplication: identical ruleId on overlapping lines collapses to 1 finding', () => {
    const rawMatches = [
      {
        ruleId: 'QUAL-JS-002',
        severity: 'LOW',
        lineStart: 10,
        lineEnd: 10,
        columnStart: 5,
        columnEnd: 7,
        originalSnippet: 'a == b'
      },
      {
        ruleId: 'QUAL-JS-002',
        severity: 'LOW',
        lineStart: 10,
        lineEnd: 10,
        columnStart: 15,
        columnEnd: 17,
        originalSnippet: 'c == d'
      }
    ];

    const deduplicated = deduplicateFindings(rawMatches);
    assert.strictEqual(deduplicated.length, 1, 'Same rule on same line must collapse to 1 finding');
    assert.strictEqual(deduplicated[0].columnStart, 5);
    assert.strictEqual(deduplicated[0].columnEnd, 17);
  });

  test('Deduplication: different ruleIds on the same line are NOT merged', () => {
    const rawMatches = [
      {
        ruleId: 'SEC-GEN-005',
        severity: 'HIGH',
        category: 'SEC',
        lineStart: 5,
        lineEnd: 5,
        columnStart: 1,
        columnEnd: 30,
        originalSnippet: 'password = "mySecretPassword123"'
      },
      {
        ruleId: 'RISK-PY-001',
        severity: 'HIGH',
        category: 'RISK',
        lineStart: 5,
        lineEnd: 5,
        columnStart: 35,
        columnEnd: 50,
        originalSnippet: 'eval(user_input)'
      }
    ];

    const deduplicated = deduplicateFindings(rawMatches);
    assert.strictEqual(deduplicated.length, 2, 'Distinct rules must remain distinct');
    assert.strictEqual(deduplicated[0].ruleId, 'SEC-GEN-005');
    assert.strictEqual(deduplicated[1].ruleId, 'RISK-PY-001');
  });

  // =========================================================================
  // 6. SCORING & MATHEMATICAL CEILING (1.75x SEVERITY WEIGHT)
  // =========================================================================
  test('Scoring: pristine code produces 100 Grade A', () => {
    const score = calculateScore([]);
    assert.strictEqual(score.overallScore, 100);
    assert.strictEqual(score.grade, 'A');
    assert.strictEqual(score.categoryScores.security, 100);
    assert.strictEqual(score.categoryScores.risk, 100);
    assert.strictEqual(score.categoryScores.quality, 100);
  });

  test('Scoring: 1 Critical finding deduces 25 points -> 75 Grade B', () => {
    const findings = [{ ruleId: 'TEST-CRIT-1', severity: 'CRITICAL', category: 'RISK' }];
    const score = calculateScore(findings);
    assert.strictEqual(score.overallScore, 75);
    assert.strictEqual(score.grade, 'B');
  });

  test('Scoring: 2 occurrences of same Critical rule -> 100 - (25 + 12.5) = 62.5 -> 63 Grade C', () => {
    const findings = [
      { ruleId: 'TEST-CRIT-1', severity: 'CRITICAL', category: 'RISK' },
      { ruleId: 'TEST-CRIT-1', severity: 'CRITICAL', category: 'RISK' }
    ];
    const score = calculateScore(findings);
    assert.strictEqual(score.overallScore, 63);
    assert.strictEqual(score.grade, 'C');
  });

  test('Scoring: 3+ occurrences naturally ceiling at 1.75 * w -> 100 - 43.75 = 56.25 -> 56 Grade D', () => {
    const findings = [
      { ruleId: 'TEST-CRIT-1', severity: 'CRITICAL', category: 'RISK' },
      { ruleId: 'TEST-CRIT-1', severity: 'CRITICAL', category: 'RISK' },
      { ruleId: 'TEST-CRIT-1', severity: 'CRITICAL', category: 'RISK' },
      { ruleId: 'TEST-CRIT-1', severity: 'CRITICAL', category: 'RISK' }
    ];
    const score = calculateScore(findings);
    assert.strictEqual(score.overallScore, 56);
    assert.strictEqual(score.grade, 'D');
  });

  test('Scoring: score never drops below 0', () => {
    const findings = [
      { ruleId: 'R1', severity: 'CRITICAL', category: 'SEC' },
      { ruleId: 'R2', severity: 'CRITICAL', category: 'SEC' },
      { ruleId: 'R3', severity: 'CRITICAL', category: 'SEC' },
      { ruleId: 'R4', severity: 'CRITICAL', category: 'SEC' },
      { ruleId: 'R5', severity: 'CRITICAL', category: 'SEC' }
    ];
    const score = calculateScore(findings);
    assert.strictEqual(score.overallScore, 0);
    assert.strictEqual(score.grade, 'F');
  });

  // =========================================================================
  // 7. API ENDPOINT INTEGRATION & GUARDS (POST /api/v1/analysis/static)
  // =========================================================================
  test('API Guard: 401 Unauthorized when no JWT access token provided', async () => {
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      body: { code: 'print("hello")', language: 'python' }
    });

    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'AUTH_TOKEN_MISSING');
  });

  test('API Validation: 400 when language is invalid or missing', async () => {
    const token = createTestJwt();
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { code: 'print("hello")', language: 'ruby' }
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('API Validation: 400 when code is empty or whitespace-only', async () => {
    const token = createTestJwt();
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { code: '   \n  \t  ', language: 'python' }
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('API Validation: 400 when code exceeds 2,500 lines', async () => {
    const token = createTestJwt();
    const oversizedLines = new Array(2505).fill('x = 1').join('\n');
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { code: oversizedLines, language: 'python' }
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('API Validation: 400 when code exceeds 1 MB (1,048,576 bytes)', async () => {
    const token = createTestJwt();
    const oversizedBytes = 'a'.repeat(1048577);
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { code: oversizedBytes, language: 'javascript' }
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('API Validation: 400 when fileName exceeds 255 characters', async () => {
    const token = createTestJwt();
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { code: 'const x = 1;', language: 'javascript', fileName: 'a'.repeat(256) }
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('API Validation: 400 when title exceeds 200 characters', async () => {
    const token = createTestJwt();
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { code: 'const x = 1;', language: 'javascript', title: 'a'.repeat(201) }
    });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('API Success: 200 with complete transient payload structure', async () => {
    const token = createTestJwt();
    const payload = {
      code: 'def run():\n    eval("1+1")\n',
      language: 'python',
      fileName: 'main.py'
    };

    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: payload
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.transient, true);
    assert.strictEqual(res.body.data.language, 'python');
    assert.strictEqual(res.body.data.fileName, 'main.py');

    // Metrics validation
    const m = res.body.data.metrics;
    assert.strictEqual(m.totalLines, 3);
    assert.strictEqual(m.analyzedLines, 2);
    assert.strictEqual(m.totalFindings, 1);
    assert.strictEqual(m.riskFindings, 1);
    assert.strictEqual(m.severityCounts.high, 1);
    assert.ok(m.executionTimeMs >= 0);

    // Scoring validation
    const s = res.body.data.scoring;
    assert.strictEqual(s.overallScore, 85);
    assert.strictEqual(s.grade, 'B');

    // Findings validation
    assert.strictEqual(res.body.data.findings.length, 1);
    assert.strictEqual(res.body.data.findings[0].ruleId, 'RISK-PY-001');
    assert.strictEqual(res.body.data.findings[0].source, 'static');
  });

  test('API Isolation: zero database persistence (no CodeReview documents written)', async () => {
    // If MongoDB is connected, verify count is 0 change
    const initialCount = mongoose.connection.readyState === 1 ? await CodeReview.countDocuments() : 0;

    const token = createTestJwt();
    const res = await makeRequest('/api/v1/analysis/static', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { code: 'const a = 1;', language: 'javascript' }
    });

    assert.strictEqual(res.statusCode, 200);

    if (mongoose.connection.readyState === 1) {
      const finalCount = await CodeReview.countDocuments();
      assert.strictEqual(finalCount, initialCount, 'Database must have ZERO newly created CodeReview records');
    }
  });

  test('Rate Limiting: 30 requests per minute quota enforcement and HTTP 429 response', async () => {
    const token = createTestJwt();

    // Consume remaining quota up to 30 requests total
    // (A few successful requests were made above, so we loop until 429 is reached or 35 attempts)
    let reached429 = false;
    let rateLimitResponse = null;
    let requestCount = 0;

    for (let i = 0; i < 35; i++) {
      const res = await makeRequest('/api/v1/analysis/static', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { code: 'const a = 1;', language: 'javascript' }
      });

      requestCount++;

      if (res.statusCode === 429) {
        reached429 = true;
        rateLimitResponse = res;
        break;
      }
    }

    assert.ok(reached429, 'Static analysis limiter must return HTTP 429 after 30 requests within 1 minute window');
    assert.strictEqual(rateLimitResponse.statusCode, 429);
    assert.strictEqual(rateLimitResponse.body.success, false);
    assert.strictEqual(rateLimitResponse.body.error.code, 'RATE_LIMIT_EXCEEDED');

    // Rate Limiter Isolation Verification:
    // Auth endpoints must remain accessible and NOT blocked by staticAnalysisLimiter
    const authRes = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@dev.com', password: 'WrongPassword123!' }
    });

    assert.notStrictEqual(authRes.statusCode, 429, 'Auth endpoint must NOT be rate-limited by staticAnalysisLimiter');
    assert.ok([400, 401].includes(authRes.statusCode), 'Auth endpoint must return normal auth/validation error');
  });
});
