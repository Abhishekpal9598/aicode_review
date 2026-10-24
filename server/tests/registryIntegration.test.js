/**
 * Phase 9 — Step 2: Unified Registry & Preprocessor Integration Tests
 * server/tests/registryIntegration.test.js
 *
 * Verifies:
 * 1. Legacy getAllRules() contract returns exactly 37 Phase 7 base rules.
 * 2. getAllRegisteredRules() returns all 79 unified rules (37 base + 42 security).
 * 3. All 79 rule IDs are globally unique across Phase 7 and Phase 9.
 * 4. Language filtering returns exact expected rule counts per language.
 * 5. Unsupported languages receive only the 5 universal secret rules.
 * 6. In-memory security findings propagate authentic cwe, owaspCategory, and confidence metadata.
 * 7. Phase 7 findings receive null for security metadata.
 * 8. Comment masking ensures commented-out security vulnerabilities produce zero findings.
 * 9. Safe parameterized code patterns do not trigger security rules.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllRules,
  getAllRegisteredRules,
  getRulesForLanguage,
  validateRegistry,
  analyzeCode
} from '../src/services/staticAnalyzer/index.js';

describe('Phase 9 — Step 2: Unified Rule Registry & Engine Integration', () => {
  describe('1. Registry Public API & Rule Counts', () => {
    it('legacy getAllRules() must return exactly 41 base rules', () => {
      const baseRules = getAllRules();
      assert.equal(baseRules.length, 41, 'getAllRules() must strictly preserve the 41 base rules contract (including 9 C++ rules)');
      
      // Ensure only Phase 7 and universal secret rule IDs are present
      assert.ok(baseRules.some((r) => r.ruleId === 'SEC-GEN-001'));
      assert.ok(baseRules.some((r) => r.ruleId === 'RISK-PY-001'));
      assert.ok(baseRules.some((r) => r.ruleId === 'QUAL-JS-001'));
      assert.ok(baseRules.some((r) => r.ruleId === 'RISK-CPP-004'), 'Must include RISK-CPP-004');
      assert.ok(baseRules.some((r) => r.ruleId === 'RISK-CPP-005'), 'Must include RISK-CPP-005');
      assert.ok(baseRules.some((r) => r.ruleId === 'RISK-CPP-006'), 'Must include RISK-CPP-006');
      assert.ok(baseRules.some((r) => r.ruleId === 'QUAL-CPP-003'), 'Must include QUAL-CPP-003');
      assert.ok(!baseRules.some((r) => r.ruleId === 'SEC-PY-SQL-001'), 'getAllRules() must not include Phase 9 domain rules');
    });

    it('getAllRegisteredRules() must return all 84 unified rules (41 base + 43 security)', () => {
      const allRules = getAllRegisteredRules();
      assert.equal(allRules.length, 84, 'getAllRegisteredRules() must return exactly 84 unified rules');
      
      // Verify presence of both Phase 7 and Phase 9 rules
      assert.ok(allRules.some((r) => r.ruleId === 'SEC-GEN-001'), 'Must include universal secrets');
      assert.ok(allRules.some((r) => r.ruleId === 'RISK-PY-001'), 'Must include Phase 7 language rules');
      assert.ok(allRules.some((r) => r.ruleId === 'SEC-PY-SQL-001'), 'Must include Phase 9 security rules');
      assert.ok(allRules.some((r) => r.ruleId === 'SEC-JS-SSRF-001'), 'Must include Phase 9 security rules');
    });

    it('all 84 rule IDs must be globally unique with zero collisions', () => {
      const allRules = getAllRegisteredRules();
      const idSet = new Set();
      const duplicates = [];

      for (const rule of allRules) {
        if (idSet.has(rule.ruleId)) {
          duplicates.push(rule.ruleId);
        }
        idSet.add(rule.ruleId);
      }

      assert.equal(duplicates.length, 0, `Detected duplicate ruleIds: ${duplicates.join(', ')}`);
      assert.equal(idSet.size, 84, 'Must have exactly 84 unique rule IDs');
    });

    it('getRulesForLanguage() must return exact expected rule counts per language', () => {
      // Python: 5 (secrets) + 5 (Phase 7) + 11 (Security) = 21
      const pythonRules = getRulesForLanguage('python');
      assert.equal(pythonRules.length, 21, `Expected 21 Python rules, received ${pythonRules.length}`);

      // JavaScript: 5 (secrets) + 7 (Phase 7) + 15 (Security) = 27
      const jsRules = getRulesForLanguage('javascript');
      assert.equal(jsRules.length, 27, `Expected 27 JavaScript rules, received ${jsRules.length}`);

      // TypeScript: 5 (secrets) + 4 (Phase 7) + 15 (Security) = 24
      const tsRules = getRulesForLanguage('typescript');
      assert.equal(tsRules.length, 24, `Expected 24 TypeScript rules, received ${tsRules.length}`);

      // Java: 5 (secrets) + 6 (Phase 7) + 8 (Security) = 19
      const javaRules = getRulesForLanguage('java');
      assert.equal(javaRules.length, 19, `Expected 19 Java rules, received ${javaRules.length}`);

      // C: 5 (secrets) + 5 (Phase 7) + 6 (Security) = 16
      const cRules = getRulesForLanguage('c');
      assert.equal(cRules.length, 16, `Expected 16 C rules, received ${cRules.length}`);

      // C++: 5 (secrets) + 9 (base) + 4 (Security) = 18
      const cppRules = getRulesForLanguage('cpp');
      assert.equal(cppRules.length, 18, `Expected 18 C++ rules, received ${cppRules.length}`);
    });

    it('unsupported language returns only the 5 universal secret rules', () => {
      const rubyRules = getRulesForLanguage('ruby');
      assert.equal(rubyRules.length, 5, 'Unsupported language must return only universal secret rules');
      assert.ok(rubyRules.every((r) => r.ruleId.startsWith('SEC-GEN-')));

      const emptyRules = getRulesForLanguage('');
      assert.equal(emptyRules.length, 5, 'Empty language string must return only universal secret rules');

      const nullRules = getRulesForLanguage(null);
      assert.equal(nullRules.length, 5, 'Null language must return only universal secret rules');
    });
  });

  describe('2. Engine Finding Metadata Propagation', () => {
    it('security rule findings must propagate authentic cwe, owaspCategory, and confidence', () => {
      const pySqlCode = 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")\n';
      const result = analyzeCode(pySqlCode, 'python', { fileName: 'query.py' });

      const sqlFinding = result.findings.find((f) => f.ruleId === 'SEC-PY-SQL-001');
      assert.ok(sqlFinding, 'Engine must detect SEC-PY-SQL-001 finding');
      assert.equal(sqlFinding.category, 'SEC');
      assert.equal(sqlFinding.severity, 'CRITICAL');
      assert.equal(sqlFinding.cwe, 'CWE-89');
      assert.equal(sqlFinding.owaspCategory, 'A03:2021-Injection');
      assert.equal(sqlFinding.confidence, 'HIGH');
      assert.equal(sqlFinding.source, 'static');
    });

    it('SSRF security finding must propagate CWE-918 and MEDIUM confidence', () => {
      const jsSsrfCode = 'const res = await axios.get(targetUrl);\n';
      const result = analyzeCode(jsSsrfCode, 'javascript', { fileName: 'client.js' });

      const ssrfFinding = result.findings.find((f) => f.ruleId === 'SEC-JS-SSRF-001');
      assert.ok(ssrfFinding, 'Engine must detect SEC-JS-SSRF-001 finding');
      assert.equal(ssrfFinding.cwe, 'CWE-918');
      assert.equal(ssrfFinding.owaspCategory, 'A10:2021-Server-Side Request Forgery (SSRF)');
      assert.equal(ssrfFinding.confidence, 'MEDIUM');
      assert.equal(ssrfFinding.source, 'static');
    });

    it('Phase 7 findings must receive null for security metadata', () => {
      const pyQualityCode = 'try:\n    do_something()\nexcept:\n    pass\n';
      const result = analyzeCode(pyQualityCode, 'python', { fileName: 'handler.py' });

      const bareExceptFinding = result.findings.find((f) => f.ruleId === 'QUAL-PY-001');
      assert.ok(bareExceptFinding, 'Engine must detect QUAL-PY-001 finding');
      assert.equal(bareExceptFinding.cwe, null, 'Phase 7 rule cwe must be null');
      assert.equal(bareExceptFinding.owaspCategory, null, 'Phase 7 rule owaspCategory must be null');
      assert.equal(bareExceptFinding.confidence, null, 'Phase 7 rule confidence must be null');
      assert.equal(bareExceptFinding.source, 'static');
    });
  });

  describe('3. Preprocessor Masking & Pattern Immunity', () => {
    it('commented-out security vulnerabilities must produce zero findings', () => {
      const pythonCommentedCode = [
        '# cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")',
        '# resp = requests.get(target_url)',
        'safe_val = 42'
      ].join('\n');

      const pyResult = analyzeCode(pythonCommentedCode, 'python');
      assert.ok(!pyResult.findings.some((f) => f.ruleId === 'SEC-PY-SQL-001'), 'Commented Python SQLi must not trigger');
      assert.ok(!pyResult.findings.some((f) => f.ruleId === 'SEC-PY-SSRF-001'), 'Commented Python SSRF must not trigger');

      const cCommentedCode = [
        '// strcpy(dest, src);',
        '/* strcpy(dest, src); */',
        'int safe = 42;'
      ].join('\n');

      const cResult = analyzeCode(cCommentedCode, 'c');
      assert.ok(!cResult.findings.some((f) => f.ruleId === 'SEC-C-BUF-001'), 'Commented strcpy must not trigger');

      const jsCommentedCode = [
        '// const res = await axios.get(targetUrl);',
        '/* const res = await axios.get(targetUrl); */',
        'const safe = 42;'
      ].join('\n');

      const jsResult = analyzeCode(jsCommentedCode, 'javascript');
      assert.ok(!jsResult.findings.some((f) => f.ruleId === 'SEC-JS-SSRF-001'), 'Commented JS SSRF must not trigger');
    });

    it('safe parameterized SQL pattern does not trigger SQL injection rule', () => {
      const safePythonSql = 'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))\n';
      const pyResult = analyzeCode(safePythonSql, 'python');
      assert.ok(!pyResult.findings.some((f) => f.ruleId === 'SEC-PY-SQL-001'), 'Safe parameterized query must not trigger');

      const safeJsSql = 'db.query("SELECT * FROM users WHERE id = $1", [userId]);\n';
      const jsResult = analyzeCode(safeJsSql, 'javascript');
      assert.ok(!jsResult.findings.some((f) => f.ruleId === 'SEC-JS-SQL-001'), 'Safe parameterized query must not trigger');
    });

    it('uncommented code produces security findings at exact 1:1 line numbers', () => {
      const code = [
        '# Header comment line 1',
        '# Header comment line 2',
        'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")',
        'safe_call()'
      ].join('\n');

      const result = analyzeCode(code, 'python');
      const finding = result.findings.find((f) => f.ruleId === 'SEC-PY-SQL-001');
      assert.ok(finding, 'Must find SQL injection');
      assert.equal(finding.lineStart, 3, 'Line number must exactly match line 3');
    });
  });

  describe('4. Startup Validation Behavior', () => {
    it('validateRegistry succeeds on valid complete rule set', () => {
      const allRules = getAllRegisteredRules();
      assert.doesNotThrow(() => validateRegistry(allRules));
    });

    it('validateRegistry throws on duplicate ruleId', () => {
      const allRules = getAllRegisteredRules();
      const duplicateRules = [...allRules, { ...allRules[0] }];
      assert.throws(
        () => validateRegistry(duplicateRules),
        /REGISTRY_VALIDATION_ERROR: Duplicate ruleId detected/
      );
    });

    it('validateRegistry throws when security rule is missing languages array', () => {
      const invalidRule = {
        ruleId: 'SEC-PY-SQL-999',
        name: 'Test Rule',
        title: 'Test Rule Title',
        category: 'SEC',
        severity: 'CRITICAL',
        regex: /test/g,
        scanRaw: false,
        explanation: 'This is a test explanation with sufficient length.',
        suggestedSnippet: 'remediation snippet',
        remediation: 'This is a test remediation with sufficient length.',
        cwe: 'CWE-89',
        confidence: 'HIGH',
        owaspCategory: 'A03:2021-Injection'
      };
      assert.throws(
        () => validateRegistry([invalidRule]),
        /REGISTRY_VALIDATION_ERROR: Security rule SEC-PY-SQL-999 missing non-empty languages array/
      );
    });

    it('validateRegistry throws on invalid severity', () => {
      const invalidRule = {
        ...getAllRegisteredRules()[0],
        severity: 'URGENT'
      };
      assert.throws(
        () => validateRegistry([invalidRule]),
        /REGISTRY_VALIDATION_ERROR: Rule .* has invalid severity: URGENT/
      );
    });

    it('validateRegistry throws on non-RegExp regex', () => {
      const invalidRule = {
        ...getAllRegisteredRules()[0],
        regex: 'not-a-regex'
      };
      assert.throws(
        () => validateRegistry([invalidRule]),
        /REGISTRY_VALIDATION_ERROR: Rule .* regex must be a RegExp instance/
      );
    });

    it('validateRegistry throws on missing global (g) flag in regex', () => {
      const invalidRule = {
        ...getAllRegisteredRules()[0],
        regex: /pattern/i
      };
      assert.throws(
        () => validateRegistry([invalidRule]),
        /REGISTRY_VALIDATION_ERROR: Rule .* regex must have global \(g\) flag/
      );
    });

    it('validateRegistry throws on invalid CWE format in security rule', () => {
      const invalidRule = {
        ruleId: 'SEC-PY-SQL-999',
        name: 'Test Rule',
        title: 'Test Rule Title',
        category: 'SEC',
        severity: 'CRITICAL',
        regex: /test/g,
        scanRaw: false,
        explanation: 'This is a test explanation with sufficient length.',
        suggestedSnippet: 'remediation snippet',
        remediation: 'This is a test remediation with sufficient length.',
        languages: ['python'],
        cwe: 'INVALID-CWE-89',
        confidence: 'HIGH',
        owaspCategory: 'A03:2021-Injection'
      };
      assert.throws(
        () => validateRegistry([invalidRule]),
        /REGISTRY_VALIDATION_ERROR: Security rule SEC-PY-SQL-999 has invalid CWE format/
      );
    });
  });
});
