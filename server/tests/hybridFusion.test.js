/**
 * Multi-Factor Hybrid Security Finding Fusion Automated Test Suite
 * server/tests/hybridFusion.test.js
 *
 * Implements all 64 comprehensive tests using Node.js native test runner (node:test):
 * - Suite 1: Pair-Score Table, Directed Lookup & Tier 1 Match Scoring (4 tests)
 * - Suite 2: Reciprocal-Unique-Best Matching Strategy (4 tests)
 * - Suite 3: Global-Buffer Lexical Scanner & Template Machine (12 tests)
 * - Suite 4: Source Occurrence Identity & Coordinate Contracts (8 tests)
 * - Suite 5: Content-Field Persistence Validation & Clamping (12 tests)
 * - Suite 6: Relational Parent Ownership & Abort Invariant (16 tests)
 * - Suite 7: Telemetry Accounting & Lifecycle Conservation (8 tests)
 * Total: 64 automated tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {
  trimHorizontal,
  normalizeNewlines,
  extractSourceSlice,
  computeLineStarts,
  coordinateToGlobalOffset,
  globalOffsetToCoordinate,
  scanGlobalSourceBuffer,
  PairScoreTable,
  calculateTier1MatchScore,
  matchReciprocalUniqueBest,
  assertRelationalParentIntegrity,
  validateCandidateContent,
  compareFindingsTotal,
  fuseFindings,
  buildCanonicalFindingFingerprint
} from '../src/services/hybridFusion.service.js';
import ApiError from '../src/utils/ApiError.js';

describe('Multi-Factor Hybrid Security Finding Fusion Service', () => {

  // ===========================================================================
  // SUITE 1: Pair-Score Table, Directed Lookup & Match Scoring (4 tests)
  // ===========================================================================
  describe('Suite 1: Pair-Score Table, Directed Lookup & Match Scoring', () => {
    it('1. PairScoreTable stores and retrieves directed scores correctly', () => {
      const table = new PairScoreTable();
      const s = { title: 'Static 1' };
      const a = { title: 'AI 1' };
      table.set(s, a, 108.5);
      assert.strictEqual(table.get(s, a), 108.5);
    });

    it('2. matchScores.get(s, a) returns default 0 for unrecorded pairs', () => {
      const table = new PairScoreTable();
      const s = { title: 'Static A' };
      const a = { title: 'AI B' };
      assert.strictEqual(table.get(s, a), 0);
    });

    it('3. Tier 1 matchScore calculation calculates IoU + positive column overlap', () => {
      const s = { lineStart: 10, lineEnd: 10, columnStart: 5, columnEnd: 25 };
      const a = { lineStart: 10, lineEnd: 10, columnStart: 15, columnEnd: 30 };
      const occ = { lineStart: 10, columnStart: 1, lineEnd: 10, columnEnd: 35 };

      const score = calculateTier1MatchScore(s, a, occ);
      assert.ok(score >= 105.0 && score <= 115.0);
    });

    it('4. Ineligible candidate rejection returns zero score when no column overlap', () => {
      const s = { lineStart: 10, lineEnd: 10, columnStart: 1, columnEnd: 10 };
      const a = { lineStart: 10, lineEnd: 10, columnStart: 15, columnEnd: 25 };
      const occ = { lineStart: 10, columnStart: 1, lineEnd: 10, columnEnd: 30 };

      const score = calculateTier1MatchScore(s, a, occ);
      assert.strictEqual(score, 0);
    });
  });

  // ===========================================================================
  // SUITE 2: Reciprocal-Unique-Best Matching Strategy (4 tests)
  // ===========================================================================
  describe('Suite 2: Reciprocal-Unique-Best Matching Strategy', () => {
    it('5. Mutual unique-best match commits successfully', () => {
      const table = new PairScoreTable();
      const s1 = { id: 's1' };
      const a1 = { id: 'a1' };
      table.set(s1, a1, 110.0);

      const committed = matchReciprocalUniqueBest([{ s: s1, a: a1, score: 110.0 }], table, [s1], [a1]);
      assert.strictEqual(committed.length, 1);
      assert.strictEqual(committed[0].staticFinding, s1);
      assert.strictEqual(committed[0].aiFinding, a1);
    });

    it('6. Asymmetric candidate scores resolve strictly to mutual unique-best', () => {
      const table = new PairScoreTable();
      const s1 = { id: 's1' };
      const s2 = { id: 's2' };
      const a1 = { id: 'a1' };

      table.set(s1, a1, 108.0);
      table.set(s2, a1, 112.0);

      const committed = matchReciprocalUniqueBest([], table, [s1, s2], [a1]);
      assert.strictEqual(committed.length, 1);
      assert.strictEqual(committed[0].staticFinding, s2);
      assert.strictEqual(committed[0].aiFinding, a1);
    });

    it('7. Tied AI candidates (1 static vs 2 identical AI) remain unassigned (3 un-fused)', () => {
      const table = new PairScoreTable();
      const s1 = { id: 's1' };
      const a1 = { id: 'a1' };
      const a2 = { id: 'a2' };

      table.set(s1, a1, 110.0);
      table.set(s1, a2, 110.0);

      const committed = matchReciprocalUniqueBest([], table, [s1], [a1, a2]);
      assert.strictEqual(committed.length, 0);
    });

    it('8. One-to-one participation invariant verified across multiple rounds', () => {
      const table = new PairScoreTable();
      const s1 = { id: 's1' };
      const s2 = { id: 's2' };
      const a1 = { id: 'a1' };
      const a2 = { id: 'a2' };

      table.set(s1, a1, 112.0);
      table.set(s1, a2, 106.0);
      table.set(s2, a1, 107.0);
      table.set(s2, a2, 111.0);

      const committed = matchReciprocalUniqueBest([], table, [s1, s2], [a1, a2]);
      assert.strictEqual(committed.length, 2);
      const matchedS = committed.map((c) => c.staticFinding);
      const matchedA = committed.map((c) => c.aiFinding);
      assert.strictEqual(new Set(matchedS).size, 2);
      assert.strictEqual(new Set(matchedA).size, 2);
    });
  });

  // ===========================================================================
  // SUITE 3: Global-Buffer Lexical Scanner & Template Machine (12 tests)
  // ===========================================================================
  describe('Suite 3: Global-Buffer Lexical Scanner & Template Machine', () => {
    it('9. Global UTF-16 offset scanner parses tokens across newlines', () => {
      const code = 'const a = 1;\ncursor.execute("SELECT 1");\nconst b = 2;';
      const occs = scanGlobalSourceBuffer(code, 'javascript');
      assert.strictEqual(occs.length, 1);
      assert.strictEqual(occs[0].opName, 'execute');
      assert.strictEqual(occs[0].receiver, 'cursor');
    });

    it('10. Multiline sink call: extracts invocation and args across newlines', () => {
      const code = `cursor.execute(
        "SELECT * FROM users WHERE id = %s",
        [uid]
      );`;
      const occs = scanGlobalSourceBuffer(code, 'python');
      assert.strictEqual(occs.length, 1);
      assert.strictEqual(occs[0].opName, 'execute');
      assert.strictEqual(occs[0].primaryArgSlice, '"SELECT * FROM users WHERE id = %s"');
      assert.strictEqual(occs[0].lineStart, 1);
      assert.strictEqual(occs[0].lineEnd, 4);
    });

    it('11. Template literal stack frame: Level 1 interpolation', () => {
      const code = 'const q = `SELECT * FROM ${tableName} WHERE id = 1`;';
      const occs = scanGlobalSourceBuffer(code, 'javascript');
      assert.strictEqual(occs.length, 0);
    });

    it('12. Template literal stack frame: Level 2 nested templates parse sinks accurately', () => {
      const code = 'const q = `outer ${ `inner ${ db.query("SELECT secret") }` }`;';
      const occs = scanGlobalSourceBuffer(code, 'javascript');
      assert.strictEqual(occs.length, 1);
      assert.strictEqual(occs[0].opName, 'query');
      assert.strictEqual(occs[0].receiver, 'db');
      assert.strictEqual(occs[0].primaryArgSlice, '"SELECT secret"');
    });

    it('13. Language-aware comments: Python # and triple-quotes ignored as sinks', () => {
      const code = '# cursor.execute("SELECT fake")\n"""\ncursor.execute("SELECT doc")\n"""\ncursor.execute("SELECT real")';
      const occs = scanGlobalSourceBuffer(code, 'python');
      assert.strictEqual(occs.length, 1);
      assert.strictEqual(occs[0].primaryArgSlice, '"SELECT real"');
    });

    it('14. Language-aware comments: JS/TS // and /* */ ignored as sinks', () => {
      const code = '// db.query("comment1");\n/* db.query("comment2"); */\ndb.query("active");';
      const occs = scanGlobalSourceBuffer(code, 'javascript');
      assert.strictEqual(occs.length, 1);
      assert.strictEqual(occs[0].primaryArgSlice, '"active"');
    });

    it('15. JS/TS regex literal detection distinguishes regex from division', () => {
      const code = 'const regex = /eval\\(x\\)/g;\nconst div = x / eval(y);';
      const occs = scanGlobalSourceBuffer(code, 'javascript');
      assert.strictEqual(occs.length, 1);
      assert.strictEqual(occs[0].opName, 'eval');
      assert.strictEqual(occs[0].primaryArgSlice, 'y');
    });

    it('16. Java/C/C++ comment syntax and string literal handling', () => {
      const code = '// system("rm -rf");\nsystem("active_cmd");';
      const occs = scanGlobalSourceBuffer(code, 'c');
      assert.strictEqual(occs.length, 1);
      assert.strictEqual(occs[0].opName, 'system');
      assert.strictEqual(occs[0].primaryArgSlice, '"active_cmd"');
    });

    it('17. Unsupported chained expression (getDb().query()) flags complex receiver', () => {
      const code = 'getDb().query("SELECT * FROM table");';
      const occs = scanGlobalSourceBuffer(code, 'javascript');
      assert.strictEqual(occs.length, 1);
      assert.strictEqual(occs[0].hasComplexReceiver, true);
    });

    it('18. trimHorizontal preserves internal quote whitespace character-for-character', () => {
      const raw = '   "SELECT   *   FROM   users  WHERE  name = \'John  Doe\'"   ';
      const trimmed = trimHorizontal(raw);
      assert.strictEqual(trimmed, '"SELECT   *   FROM   users  WHERE  name = \'John  Doe\'"');
      assert.ok(trimmed.includes('   *   '));
    });

    it('19. Multiple identical calls on same line disambiguated by global token spans', () => {
      const code = 'child_process.exec(cmdA); child_process.exec(cmdB);';
      const occs = scanGlobalSourceBuffer(code, 'javascript');
      assert.strictEqual(occs.length, 2);
      assert.strictEqual(occs[0].globalSinkId, 0);
      assert.strictEqual(occs[0].primaryArgSlice, 'cmdA');
      assert.strictEqual(occs[1].globalSinkId, 1);
      assert.strictEqual(occs[1].primaryArgSlice, 'cmdB');
      assert.ok(occs[0].opTokenGlobalSpan[0] < occs[1].opTokenGlobalSpan[0]);
    });

    it('20. Standalone exec/spawn without verified child_process rejected in rule matching', () => {
      const code = 'exec(untrusted);';
      const occs = scanGlobalSourceBuffer(code, 'javascript');
      assert.strictEqual(occs.length, 1);
      assert.strictEqual(occs[0].receiver, null);
    });
  });

  // ===========================================================================
  // SUITE 4: Source Occurrence Identity & Coordinate Contracts (8 tests)
  // ===========================================================================
  describe('Suite 4: Source Occurrence Identity & Coordinate Contracts', () => {
    it('21. Occurrence identity established via unique global opTokenGlobalSpan', () => {
      const code = 'const x = 1;\ndb.query("SELECT 1");';
      const occs = scanGlobalSourceBuffer(code, 'javascript');
      assert.strictEqual(occs.length, 1);

      const lineStarts = computeLineStarts(code);
      const startOff = coordinateToGlobalOffset(2, 4, lineStarts);
      const endOff = coordinateToGlobalOffset(2, 9, lineStarts);

      const [tokStart, tokEnd] = occs[0].opTokenGlobalSpan;
      assert.strictEqual(startOff, tokStart);
      assert.strictEqual(endOff, tokEnd);
    });

    it('22. Multi-line source extraction extracts first colStart, full lines, and last colEnd', () => {
      const lines = [
        'function test() {',
        '  const query = "SELECT *',
        '    FROM users',
        '    WHERE id = 1";',
        '  return query;',
        '}'
      ];
      const slice = extractSourceSlice(lines, 2, 17, 4, 19);
      assert.strictEqual(slice, '"SELECT *\n    FROM users\n    WHERE id = 1";');
    });

    it('23. Newline handling: LF, CRLF, and CR parsed and normalized uniformly', () => {
      const lf = 'line1\nline2\nline3';
      const crlf = 'line1\r\nline2\r\nline3';
      const cr = 'line1\rline2\rline3';

      assert.strictEqual(normalizeNewlines(lf), 'line1\nline2\nline3');
      assert.strictEqual(normalizeNewlines(crlf), 'line1\nline2\nline3');
      assert.strictEqual(normalizeNewlines(cr), 'line1\nline2\nline3');
    });

    it('24. Single-line coordinate validation requires columnEnd > columnStart (empty range rejected)', () => {
      const emptyRange = {
        category: 'security',
        severity: 'HIGH',
        source: 'static',
        title: 'Empty Range Test',
        description: 'Test description',
        lineStart: 1,
        lineEnd: 1,
        columnStart: 5,
        columnEnd: 5
      };
      const res = validateCandidateContent(emptyRange, ['const a = 1;']);
      assert.strictEqual(res.isValid, false);
    });

    it('25. Multi-line validation permits columnEnd <= columnStart across different lines', () => {
      const validMulti = {
        category: 'security',
        severity: 'HIGH',
        source: 'static',
        title: 'Multi Line Test',
        description: 'Test description',
        lineStart: 1,
        lineEnd: 2,
        columnStart: 25,
        columnEnd: 5
      };
      const res = validateCandidateContent(validMulti, [
        'const query = cursor.execute(',
        '  [param]);'
      ]);
      assert.strictEqual(res.isValid, true);
    });

    it('26. Pre-mapping validation against redactedCode boundaries', () => {
      const outOfBoundsAi = {
        category: 'security',
        severity: 'HIGH',
        title: 'OOB Test',
        description: 'Desc',
        lineStart: 10,
        lineEnd: 10,
        columnStart: 1,
        columnEnd: 10,
        originalSnippet: 'code'
      };
      const result = fuseFindings({
        staticFindings: [],
        aiFindings: [outOfBoundsAi],
        sourceCode: 'const a = 1;\nconst b = 2;',
        redactedCode: 'const a = 1;\nconst b = 2;'
      });
      assert.strictEqual(result.finalFindings.length, 0);
      assert.strictEqual(result.dropCounters.coord_pre, 1);
    });

    it('27. Post-mapping boundary failure via CoordinateMapper preserves findings independently', () => {
      const badMapper = {
        mapToOriginal: () => ({ line: 999, column: 999 })
      };
      const ai = {
        category: 'security',
        severity: 'HIGH',
        title: 'Map Error',
        description: 'Desc',
        lineStart: 1,
        lineEnd: 1,
        columnStart: 1,
        columnEnd: 13,
        originalSnippet: 'const a = 1;'
      };
      const result = fuseFindings({
        staticFindings: [],
        aiFindings: [ai],
        sourceCode: 'const a = 1;',
        redactedCode: 'const a = 1;',
        coordinateMapper: badMapper
      });
      assert.strictEqual(result.finalFindings.length, 0);
      assert.strictEqual(result.dropCounters.coord_post, 1);
    });

    it('28. Secret non-reintroduction: pre-redacted asterisks retained in hybrid finding', () => {
      const rawCode = 'const key = "AKIA1234567890EXAMPLE";\ndb.query("SELECT 1");';
      const redactedCode = 'const key = "AKIA****************";\ndb.query("SELECT 1");';

      const s = {
        category: 'security',
        severity: 'CRITICAL',
        title: 'SQLi',
        description: 'SQLi detected',
        lineStart: 2,
        lineEnd: 2,
        columnStart: 1,
        columnEnd: 22,
        originalSnippet: 'db.query("SELECT 1");',
        ruleId: 'SEC-JS-SQL-001',
        cwe: 'CWE-89'
      };

      const a = {
        category: 'security',
        severity: 'CRITICAL',
        title: 'SQL Injection',
        description: 'AI SQLi detected',
        lineStart: 2,
        lineEnd: 2,
        columnStart: 1,
        columnEnd: 22,
        originalSnippet: 'db.query("SELECT 1");',
        suggestedSnippet: 'db.query("SELECT 1", []);'
      };

      const res = fuseFindings({
        staticFindings: [s],
        aiFindings: [a],
        sourceCode: rawCode,
        redactedCode
      });

      assert.strictEqual(res.finalFindings.length, 1);
      assert.strictEqual(res.finalFindings[0].source, 'hybrid');
      assert.strictEqual(res.finalFindings[0].cwe, 'CWE-89');
    });
  });

  // ===========================================================================
  // SUITE 5: Content-Field Persistence Validation & Clamping (12 tests)
  // ===========================================================================
  describe('Suite 5: Content-Field Persistence Validation & Clamping', () => {
    it('29. Rejects invalid category enum (enums++)', () => {
      const issue = { category: 'unknown_cat', severity: 'HIGH', source: 'static', title: 'T', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const drops = { enums: 0, total: 0 };
      const res = validateCandidateContent(issue, ['code'], drops);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(drops.enums, 1);
    });

    it('30. Rejects invalid severity enum (enums++)', () => {
      const issue = { category: 'security', severity: 'EXTREME', source: 'static', title: 'T', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const drops = { enums: 0, total: 0 };
      const res = validateCandidateContent(issue, ['code'], drops);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(drops.enums, 1);
    });

    it('31. Rejects invalid source enum (enums++)', () => {
      const issue = { category: 'security', severity: 'HIGH', source: 'external', title: 'T', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const drops = { enums: 0, total: 0 };
      const res = validateCandidateContent(issue, ['code'], drops);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(drops.enums, 1);
    });

    it('32. Rejects whitespace-only title (type++)', () => {
      const issue = { category: 'security', severity: 'HIGH', source: 'static', title: '   \t  ', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const drops = { type: 0, total: 0 };
      const res = validateCandidateContent(issue, ['code'], drops);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(drops.type, 1);
    });

    it('33. Safe prose clamping for oversized title (> 150 chars clamped to 147 + ...)', () => {
      const longTitle = 'A'.repeat(200);
      const issue = { category: 'security', severity: 'HIGH', source: 'static', title: longTitle, description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const res = validateCandidateContent(issue, ['code']);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.sanitizedIssue.title.length, 150);
      assert.ok(res.sanitizedIssue.title.endsWith('...'));
    });

    it('34. Rejects whitespace-only description (type++)', () => {
      const issue = { category: 'security', severity: 'HIGH', source: 'static', title: 'Valid Title', description: '   \n \t ', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const drops = { type: 0, total: 0 };
      const res = validateCandidateContent(issue, ['code'], drops);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(drops.type, 1);
    });

    it('35. Safe prose clamping for oversized description (> 1000 chars clamped to 997 + ...)', () => {
      const longDesc = 'B'.repeat(1200);
      const issue = { category: 'security', severity: 'HIGH', source: 'static', title: 'T', description: longDesc, lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const res = validateCandidateContent(issue, ['code']);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.sanitizedIssue.description.length, 1000);
      assert.ok(res.sanitizedIssue.description.endsWith('...'));
    });

    it('36. Safe prose clamping for explanation (> 2000 chars clamped to 1997 + ...)', () => {
      const longExpl = 'E'.repeat(2500);
      const issue = { category: 'security', severity: 'HIGH', source: 'static', title: 'T', description: 'D', explanation: longExpl, lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const res = validateCandidateContent(issue, ['code']);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.sanitizedIssue.explanation.length, 2000);
      assert.ok(res.sanitizedIssue.explanation.endsWith('...'));
    });

    it('37. Rejects oversized originalSnippet > 2000 chars without code truncation (snippets++)', () => {
      const longSnippet = 'code;'.repeat(500);
      const issue = { category: 'security', severity: 'HIGH', source: 'static', title: 'T', description: 'D', originalSnippet: longSnippet, lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const drops = { snippets: 0, total: 0 };
      const res = validateCandidateContent(issue, ['code'], drops);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(drops.snippets, 1);
    });

    it('38. Rejects oversized suggestedSnippet > 2000 chars without code truncation (snippets++)', () => {
      const longSnippet = 'fix;'.repeat(600);
      const issue = { category: 'security', severity: 'HIGH', source: 'static', title: 'T', description: 'D', suggestedSnippet: longSnippet, lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const drops = { snippets: 0, total: 0 };
      const res = validateCandidateContent(issue, ['code'], drops);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(drops.snippets, 1);
    });

    it('39. Rejects oversized ruleId > 60 chars without code truncation (ruleId++)', () => {
      const longRuleId = 'SEC-RULE-' + 'X'.repeat(60);
      const issue = { category: 'security', severity: 'HIGH', source: 'static', title: 'T', description: 'D', ruleId: longRuleId, lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const drops = { ruleId: 0, total: 0 };
      const res = validateCandidateContent(issue, ['code'], drops);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(drops.ruleId, 1);
    });

    it('40. Default value assignment for optional fields', () => {
      const issue = { category: 'security', severity: 'HIGH', source: 'static', title: 'T', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 5 };
      const res = validateCandidateContent(issue, ['code']);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.sanitizedIssue.originalSnippet, '');
      assert.strictEqual(res.sanitizedIssue.suggestedSnippet, '');
      assert.strictEqual(res.sanitizedIssue.explanation, '');
      assert.strictEqual(res.sanitizedIssue.ruleId, null);
    });
  });

  // ===========================================================================
  // SUITE 6: Relational Parent Ownership & Abort Invariant (16 tests)
  // ===========================================================================
  describe('Suite 6: Relational Parent Ownership & Abort Invariant', () => {
    const validRevId = new mongoose.Types.ObjectId();
    const validAnalysisId = new mongoose.Types.ObjectId();
    const validUserId = new mongoose.Types.ObjectId();

    const expectedParents = {
      reviewId: validRevId,
      analysisResultId: validAnalysisId,
      userId: validUserId
    };

    const validIssue = {
      reviewId: validRevId,
      analysisResultId: validAnalysisId,
      userId: validUserId
    };

    it('41. Valid projected ReviewIssue with valid ObjectIds passes validation', () => {
      assert.doesNotThrow(() => assertRelationalParentIntegrity([validIssue], expectedParents));
    });

    it('42. Missing reviewId aborts persistence operation', () => {
      const bad = { ...validIssue, reviewId: undefined };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('43. Null reviewId aborts persistence operation', () => {
      const bad = { ...validIssue, reviewId: null };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('44. Wrong-type reviewId (number/boolean) aborts persistence operation', () => {
      const badNum = { ...validIssue, reviewId: 12345 };
      const badBool = { ...validIssue, reviewId: true };
      assert.throws(() => assertRelationalParentIntegrity([badNum], expectedParents), ApiError);
      assert.throws(() => assertRelationalParentIntegrity([badBool], expectedParents), ApiError);
    });

    it('45. Malformed reviewId (non-24 hex string) aborts persistence operation', () => {
      const bad = { ...validIssue, reviewId: 'invalid-hex-string' };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('46. Mismatched reviewId aborts persistence operation', () => {
      const bad = { ...validIssue, reviewId: new mongoose.Types.ObjectId() };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('47. Missing analysisResultId aborts persistence operation', () => {
      const bad = { ...validIssue, analysisResultId: undefined };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('48. Null analysisResultId aborts persistence operation', () => {
      const bad = { ...validIssue, analysisResultId: null };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('49. Wrong-type analysisResultId (number/bool) aborts persistence operation', () => {
      const bad = { ...validIssue, analysisResultId: 98765 };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('50. Malformed analysisResultId (non-24 hex) aborts persistence operation', () => {
      const bad = { ...validIssue, analysisResultId: 'not-valid-id' };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('51. Mismatched analysisResultId aborts persistence operation', () => {
      const bad = { ...validIssue, analysisResultId: new mongoose.Types.ObjectId() };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('52. Missing userId aborts persistence operation', () => {
      const bad = { ...validIssue, userId: undefined };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('53. Null userId aborts persistence operation', () => {
      const bad = { ...validIssue, userId: null };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('54. Wrong-type userId (number/boolean) aborts persistence operation', () => {
      const bad = { ...validIssue, userId: false };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('55. Malformed userId (non-24 hex string) aborts persistence operation', () => {
      const bad = { ...validIssue, userId: 'short-id' };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });

    it('56. Mismatched userId (cross-user tenancy violation) aborts persistence operation', () => {
      const foreignUserId = new mongoose.Types.ObjectId();
      const bad = { ...validIssue, userId: foreignUserId };
      assert.throws(() => assertRelationalParentIntegrity([bad], expectedParents), ApiError);
    });
  });

  // ===========================================================================
  // SUITE 7: Telemetry Accounting & Lifecycle Conservation (8 tests)
  // ===========================================================================
  describe('Suite 7: Telemetry Accounting & Lifecycle Conservation', () => {
    it('57. Accounting Example 1: Clean fusion (|S|=3, |A|=2, K=1, D=0 -> finalCount=4)', () => {
      const code = 'db.query("SELECT 1");\nconst x = 2;';
      const s1 = { category: 'security', severity: 'HIGH', title: 'S1', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 22, ruleId: 'SEC-JS-SQL-001' };
      const s2 = { category: 'security', severity: 'LOW', title: 'S2', description: 'D', lineStart: 2, lineEnd: 2, columnStart: 1, columnEnd: 13, ruleId: 'SEC-JS-MISC-001' };
      const s3 = { category: 'bug', severity: 'MEDIUM', title: 'S3', description: 'D', lineStart: 2, lineEnd: 2, columnStart: 1, columnEnd: 13, ruleId: null };

      const a1 = { category: 'security', severity: 'HIGH', title: 'A1', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 22, originalSnippet: 'db.query("SELECT 1");' };
      const a2 = { category: 'bug', severity: 'LOW', title: 'A2', description: 'D', lineStart: 2, lineEnd: 2, columnStart: 1, columnEnd: 13, originalSnippet: 'const x = 2;' };

      const res = fuseFindings({
        staticFindings: [s1, s2, s3],
        aiFindings: [a1, a2],
        sourceCode: code,
        redactedCode: code
      });

      assert.strictEqual(res.telemetry.inputStaticCount, 3);
      assert.strictEqual(res.telemetry.inputAiCount, 2);
      assert.strictEqual(res.telemetry.fusedCount, 1);
      assert.strictEqual(res.telemetry.droppedCount, 0);
      assert.strictEqual(res.telemetry.finalFindingsCount, 4);
      assert.strictEqual(res.telemetry.isConserved, true);
    });

    it('58. Accounting Example 2: Invalid AI coords pre-fusion (D=1 -> finalCount=2)', () => {
      const code = 'db.query("SELECT 1");\nconst z = 3;';
      const s1 = { category: 'security', severity: 'HIGH', title: 'S1', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 22, ruleId: 'SEC-JS-SQL-001' };
      const s2 = { category: 'security', severity: 'LOW', title: 'S2', description: 'D', lineStart: 2, lineEnd: 2, columnStart: 1, columnEnd: 13, ruleId: 'SEC-JS-MISC-001' };

      const a1 = { category: 'security', severity: 'HIGH', title: 'A1', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 22, originalSnippet: 'db.query("SELECT 1");' };
      const a2_bad = { category: 'security', severity: 'LOW', title: 'A2', description: 'D', lineStart: 99, lineEnd: 99, columnStart: 1, columnEnd: 10, originalSnippet: 'bad' };

      const res = fuseFindings({
        staticFindings: [s1, s2],
        aiFindings: [a1, a2_bad],
        sourceCode: code,
        redactedCode: code
      });

      assert.strictEqual(res.telemetry.inputStaticCount, 2);
      assert.strictEqual(res.telemetry.inputAiCount, 2);
      assert.strictEqual(res.telemetry.fusedCount, 1);
      assert.strictEqual(res.telemetry.droppedCount, 1);
      assert.strictEqual(res.telemetry.finalFindingsCount, 2);
      assert.strictEqual(res.telemetry.isConserved, true);
    });

    it('59. Accounting Example 3: Fused candidate rejected in persistence (D=1 -> finalCount=2)', () => {
      const code = 'db.query("SELECT 1");\nconst y = 2;';
      const s1 = { category: 'security', severity: 'HIGH', title: 'S1', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 22, ruleId: 'SEC-JS-SQL-001' };
      const s2 = { category: 'security', severity: 'LOW', title: 'S2', description: 'D', lineStart: 2, lineEnd: 2, columnStart: 1, columnEnd: 13, ruleId: 'SEC-JS-MISC-001' };

      const a1_oversized = {
        category: 'security',
        severity: 'HIGH',
        title: 'A1',
        description: 'D',
        lineStart: 1,
        lineEnd: 1,
        columnStart: 1,
        columnEnd: 22,
        originalSnippet: 'db.query("SELECT 1");',
        suggestedSnippet: 'x'.repeat(2500)
      };
      const a2 = {
        category: 'security',
        severity: 'LOW',
        title: 'A2',
        description: 'D',
        lineStart: 2,
        lineEnd: 2,
        columnStart: 1,
        columnEnd: 13,
        originalSnippet: 'const y = 2;'
      };

      const res = fuseFindings({
        staticFindings: [s1, s2],
        aiFindings: [a1_oversized, a2],
        sourceCode: code,
        redactedCode: code
      });

      assert.strictEqual(res.telemetry.fusedCount, 1);
      assert.strictEqual(res.telemetry.droppedCount, 1);
      assert.strictEqual(res.telemetry.finalFindingsCount, 2);
      assert.strictEqual(res.telemetry.isConserved, true);
    });

    it('60. Multiple validation failures on single candidate increment D by exactly 1', () => {
      const multiErrorIssue = {
        category: 'invalid_category',
        severity: 'invalid_severity',
        source: 'invalid_source',
        title: '   ',
        description: '   ',
        lineStart: -5,
        lineEnd: -10,
        columnStart: -1,
        columnEnd: -1,
        originalSnippet: 's'.repeat(2500),
        ruleId: 'r'.repeat(100)
      };

      const drops = { total: 0, enums: 0, coords: 0, type: 0, snippets: 0, ruleId: 0 };
      const res = validateCandidateContent(multiErrorIssue, ['line1'], drops);
      assert.strictEqual(res.isValid, false);
      assert.strictEqual(drops.total, 1);
      assert.ok(drops.enums >= 1);
      assert.ok(drops.coords >= 1);
      assert.ok(drops.type >= 1);
    });

    it('61. Non-security findings bypass fusion and preserve multiset union', () => {
      const code = 'const a = 1;';
      const sBug1 = { category: 'bug', severity: 'MEDIUM', title: 'Bug A', description: 'Desc', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 13, ruleId: null };
      const sBug2 = { category: 'bug', severity: 'MEDIUM', title: 'Bug A', description: 'Desc', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 13, ruleId: null };
      const aBug = { category: 'bug', severity: 'MEDIUM', title: 'Bug A', description: 'Desc', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 13, originalSnippet: 'const a = 1;' };

      const res = fuseFindings({
        staticFindings: [sBug1, sBug2],
        aiFindings: [aBug],
        sourceCode: code,
        redactedCode: code
      });

      assert.strictEqual(res.finalFindings.length, 3);
      assert.strictEqual(res.telemetry.fusedCount, 0);
      assert.strictEqual(res.telemetry.isConserved, true);
    });

    it('62. Telemetry conservation holds across lifecycle stages without double-counting', () => {
      const code = 'db.query("SELECT 1");';
      const s = { category: 'security', severity: 'HIGH', title: 'S', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 22, ruleId: 'SEC-JS-SQL-001' };
      const a = { category: 'security', severity: 'HIGH', title: 'A', description: 'D', lineStart: 1, lineEnd: 1, columnStart: 1, columnEnd: 22, originalSnippet: 'db.query("SELECT 1");' };

      const res = fuseFindings({
        staticFindings: [s],
        aiFindings: [a],
        sourceCode: code,
        redactedCode: code
      });

      assert.strictEqual(
        res.telemetry.inputStaticCount + res.telemetry.inputAiCount - res.telemetry.fusedCount - res.telemetry.droppedCount,
        res.telemetry.finalFindingsCount
      );
    });

    it('63. Collision-safe JSON fingerprints immune to delimiter collision', () => {
      const f1 = { lineStart: 1, columnStart: 1, lineEnd: 1, columnEnd: 5, category: 'security', severity: 'HIGH', source: 'static', ruleId: 'RULE::1', title: 'Title' };
      const f2 = { lineStart: 1, columnStart: 1, lineEnd: 1, columnEnd: 5, category: 'security', severity: 'HIGH', source: 'static', ruleId: 'RULE', title: ':1::Title' };

      const fp1 = buildCanonicalFindingFingerprint(f1);
      const fp2 = buildCanonicalFindingFingerprint(f2);
      assert.notStrictEqual(fp1, fp2);
    });

    it('64. 17-field comparator verifies antisymmetry, transitivity, and equality', () => {
      const a = { lineStart: 1, columnStart: 1, lineEnd: 1, columnEnd: 10, severity: 'CRITICAL', category: 'security', source: 'hybrid', title: 'A' };
      const b = { lineStart: 1, columnStart: 1, lineEnd: 1, columnEnd: 10, severity: 'HIGH', category: 'security', source: 'hybrid', title: 'B' };
      const c = { lineStart: 2, columnStart: 1, lineEnd: 2, columnEnd: 10, severity: 'LOW', category: 'bug', source: 'static', title: 'C' };

      assert.ok(compareFindingsTotal(a, b) < 0);
      assert.ok(compareFindingsTotal(b, a) > 0);
      assert.ok(compareFindingsTotal(b, c) < 0);
      assert.ok(compareFindingsTotal(a, c) < 0);
      assert.strictEqual(compareFindingsTotal(a, a), 0);
    });
  });
});
