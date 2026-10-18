/**
 * Unit & Integration Tests for Strict AI Response Schema
 * server/tests/aiResponse.schema.test.js
 *
 * Verifies Phase 8 Step 4 & Step 4.1 requirements:
 * Suite A: Valid AI response, integer scores, and findings.
 * Suite B: Invalid scores (negative, > 100, decimal, missing, NaN, Infinity).
 * Suite C: Invalid findings (invalid category, invalid severity, missing required fields
 *          including columnStart, columnEnd, originalSnippet, suggestedSnippet, explanation;
 *          decimal coordinates, inverted lines, same-line inverted columns, multi-line acceptance;
 *          explicit valid empty strings for snippets/explanation).
 * Suite D: Source-aware coordinates (valid positions, line > total lines, column > line length,
 *          half-open [columnStart, columnEnd) boundary, zero silent clamping / normalization).
 * Suite E: Strictness (unknown properties, malformed response, excessive issue count > 50,
 *          missing complexity/refactoring fields).
 * Suite F: Security & Zero Fabricated Defaults (no raw source code or secrets leaked in errors,
 *          no default scores or finding fields fabricated).
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  geminiIssueOutputSchema,
  geminiCategoryScoresSchema,
  geminiAnalysisOutputSchema,
  calculateAiCompositeScore,
  createSourceAwareSchema,
  validateAiResponse,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES
} from '../src/schemas/aiResponse.schema.js';

// =============================================================================
// TEST FIXTURES
// =============================================================================

const SAMPLE_SOURCE_CODE = `function processPayment(user, amount) {
  if (!user || amount <= 0) {
    throw new Error('Invalid input');
  }
  return db.query('UPDATE users SET balance = balance - ' + amount);
}`;

function createValidCategoryScores(overrides = {}) {
  return {
    bugScore: 80,
    securityScore: 90,
    performanceScore: 70,
    maintainabilityScore: 85,
    ...overrides
  };
}

function createValidIssue(overrides = {}) {
  return {
    category: 'security',
    severity: 'HIGH',
    title: 'Potential SQL injection in payment processing',
    description: 'Direct string concatenation into database query allows SQL injection vulnerability.',
    lineStart: 5,
    lineEnd: 5,
    columnStart: 10,
    columnEnd: 68,
    originalSnippet: "return db.query('UPDATE users SET balance = balance - ' + amount);",
    suggestedSnippet: "return db.query('UPDATE users SET balance = balance - $1', [amount]);",
    explanation: 'Use parameterized queries to avoid SQL injection risks.',
    ...overrides
  };
}

function createValidAiResponse(overrides = {}) {
  return {
    summary: 'The code implementation exhibits high maintainability but contains a critical SQL injection vulnerability in database access.',
    timeComplexity: 'O(1)',
    spaceComplexity: 'O(1)',
    categoryScores: createValidCategoryScores(),
    suggestedCode: `function processPayment(user, amount) {\n  if (!user || amount <= 0) throw new Error('Invalid');\n  return db.query('UPDATE users SET balance = balance - $1', [amount]);\n}`,
    refactoringRationale: 'Refactored raw SQL concatenation to parameterized queries to remediate SQL injection risk and ensure transactional integrity.',
    issues: [createValidIssue()],
    ...overrides
  };
}

describe('Phase 8 — Strict AI Response Schema & Validation Pipeline', () => {
  // ===========================================================================
  // SUITE A: VALID RESPONSE
  // ===========================================================================
  describe('Suite A: Valid Response Validation', () => {
    test('A.1: Valid complete AI response passes validation and computes aiCompositeScore', () => {
      const response = createValidAiResponse();
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);

      assert.strictEqual(res.success, true);
      assert.ok(res.data);
      // aiCompositeScore = round(0.30*80 + 0.30*90 + 0.20*70 + 0.20*85) = round(24 + 27 + 14 + 17) = 82
      assert.strictEqual(res.data.aiCompositeScore, 82);
      assert.strictEqual(res.data.categoryScores.bugScore, 80);
      assert.strictEqual(res.data.issues.length, 1);
    });

    test('A.2: Valid integer scores across extreme and intermediate boundaries pass', () => {
      // All 100s
      const perfectScores = { bugScore: 100, securityScore: 100, performanceScore: 100, maintainabilityScore: 100 };
      assert.strictEqual(calculateAiCompositeScore(perfectScores), 100);

      // All 0s
      const zeroScores = { bugScore: 0, securityScore: 0, performanceScore: 0, maintainabilityScore: 0 };
      assert.strictEqual(calculateAiCompositeScore(zeroScores), 0);

      // Asymmetric scores with rounding check
      // 0.30*75 + 0.30*85 + 0.20*90 + 0.20*65 = 22.5 + 25.5 + 18 + 13 = 79.0 -> 79
      const asymScores = { bugScore: 75, securityScore: 85, performanceScore: 90, maintainabilityScore: 65 };
      assert.strictEqual(calculateAiCompositeScore(asymScores), 79);

      // 0.30*51 + 0.30*51 + 0.20*51 + 0.20*51 = 51
      const uniformScores = { bugScore: 51, securityScore: 51, performanceScore: 51, maintainabilityScore: 51 };
      assert.strictEqual(calculateAiCompositeScore(uniformScores), 51);
    });

    test('A.3: Valid findings covering each category and severity enum pass', () => {
      const issues = [];
      for (const cat of ISSUE_CATEGORIES) {
        for (const sev of ISSUE_SEVERITIES) {
          issues.push(
            createValidIssue({
              category: cat,
              severity: sev,
              lineStart: 1,
              lineEnd: 1,
              columnStart: 1,
              columnEnd: 10,
              title: `Valid finding for ${cat} ${sev}`,
              description: `A detailed description for finding ${cat} with severity ${sev}`
            })
          );
        }
      }

      // 5 categories * 5 severities = 25 issues <= 50 max
      assert.strictEqual(issues.length, 25);
      const response = createValidAiResponse({ issues });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.issues.length, 25);
    });

    test('A.4: Valid clean analysis with zero issues passes', () => {
      const response = createValidAiResponse({ issues: [] });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.issues.length, 0);
    });
  });

  // ===========================================================================
  // SUITE B: INVALID SCORES
  // ===========================================================================
  describe('Suite B: Invalid Score Validation', () => {
    test('B.1: Negative score rejected', () => {
      const response = createValidAiResponse({
        categoryScores: createValidCategoryScores({ bugScore: -1 })
      });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('bugScore'));
    });

    test('B.2: Score above 100 rejected', () => {
      const response = createValidAiResponse({
        categoryScores: createValidCategoryScores({ securityScore: 101 })
      });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('securityScore'));
    });

    test('B.3: Decimal score rejected', () => {
      const response = createValidAiResponse({
        categoryScores: createValidCategoryScores({ performanceScore: 85.5 })
      });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('performanceScore'));
    });

    test('B.4: Missing required score rejected', () => {
      const incompleteScores = {
        bugScore: 80,
        securityScore: 90,
        performanceScore: 70
        // maintainabilityScore omitted
      };
      const response = createValidAiResponse({ categoryScores: incompleteScores });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('maintainabilityScore'));
    });

    test('B.5: NaN and Infinity scores rejected', () => {
      const nanResponse = createValidAiResponse({
        categoryScores: createValidCategoryScores({ bugScore: NaN })
      });
      assert.strictEqual(validateAiResponse(nanResponse, SAMPLE_SOURCE_CODE).success, false);

      const infResponse = createValidAiResponse({
        categoryScores: createValidCategoryScores({ securityScore: Infinity })
      });
      assert.strictEqual(validateAiResponse(infResponse, SAMPLE_SOURCE_CODE).success, false);
    });

    test('B.6: calculateAiCompositeScore rejects invalid inputs cleanly', () => {
      assert.throws(() => calculateAiCompositeScore(null), TypeError);
      assert.throws(() => calculateAiCompositeScore({}), RangeError);
      assert.throws(
        () => calculateAiCompositeScore({ bugScore: -5, securityScore: 90, performanceScore: 80, maintainabilityScore: 80 }),
        RangeError
      );
      assert.throws(
        () => calculateAiCompositeScore({ bugScore: 80, securityScore: 105, performanceScore: 80, maintainabilityScore: 80 }),
        RangeError
      );
      assert.throws(
        () => calculateAiCompositeScore({ bugScore: 80, securityScore: 90, performanceScore: 80.2, maintainabilityScore: 80 }),
        RangeError
      );
    });
  });

  // ===========================================================================
  // SUITE C: INVALID FINDINGS & STEP 4.1 HARDENING
  // ===========================================================================
  describe('Suite C: Invalid Finding Validation & Non-Fabrication', () => {
    test('C.1: Invalid category rejected', () => {
      const issue = createValidIssue({ category: 'lint' });
      const response = createValidAiResponse({ issues: [issue] });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('category'));
    });

    test('C.2: Invalid severity rejected', () => {
      const issue = createValidIssue({ severity: 'BLOCKER' });
      const response = createValidAiResponse({ issues: [issue] });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('severity'));
    });

    test('C.3.a: Missing columnStart is rejected (zero fabricated defaults)', () => {
      const issue = createValidIssue();
      delete issue.columnStart;
      const res = geminiIssueOutputSchema.safeParse(issue);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.errors.some((e) => e.path.includes('columnStart')));
    });

    test('C.3.b: Missing columnEnd is rejected (zero fabricated defaults)', () => {
      const issue = createValidIssue();
      delete issue.columnEnd;
      const res = geminiIssueOutputSchema.safeParse(issue);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.errors.some((e) => e.path.includes('columnEnd')));
    });

    test('C.3.c: Missing originalSnippet is rejected (zero fabricated defaults)', () => {
      const issue = createValidIssue();
      delete issue.originalSnippet;
      const res = geminiIssueOutputSchema.safeParse(issue);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.errors.some((e) => e.path.includes('originalSnippet')));
    });

    test('C.3.d: Missing suggestedSnippet is rejected (zero fabricated defaults)', () => {
      const issue = createValidIssue();
      delete issue.suggestedSnippet;
      const res = geminiIssueOutputSchema.safeParse(issue);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.errors.some((e) => e.path.includes('suggestedSnippet')));
    });

    test('C.3.e: Missing explanation is rejected (zero fabricated defaults)', () => {
      const issue = createValidIssue();
      delete issue.explanation;
      const res = geminiIssueOutputSchema.safeParse(issue);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.errors.some((e) => e.path.includes('explanation')));
    });

    test('C.3.f: Missing core identifying fields rejected (title, description, lineStart, lineEnd)', () => {
      const noTitle = createValidIssue();
      delete noTitle.title;
      assert.strictEqual(geminiIssueOutputSchema.safeParse(noTitle).success, false);

      const noDesc = createValidIssue();
      delete noDesc.description;
      assert.strictEqual(geminiIssueOutputSchema.safeParse(noDesc).success, false);

      const noLineStart = createValidIssue();
      delete noLineStart.lineStart;
      assert.strictEqual(geminiIssueOutputSchema.safeParse(noLineStart).success, false);

      const noLineEnd = createValidIssue();
      delete noLineEnd.lineEnd;
      assert.strictEqual(geminiIssueOutputSchema.safeParse(noLineEnd).success, false);
    });

    test('C.3.g: Explicit valid empty strings for snippets and explanation are accepted', () => {
      const emptySnippetsIssue = createValidIssue({
        originalSnippet: '',
        suggestedSnippet: '',
        explanation: ''
      });
      const res = geminiIssueOutputSchema.safeParse(emptySnippetsIssue);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.originalSnippet, '');
      assert.strictEqual(res.data.suggestedSnippet, '');
      assert.strictEqual(res.data.explanation, '');
    });

    test('C.4: Decimal coordinates rejected', () => {
      const decLine = createValidIssue({ lineStart: 1.5 });
      assert.strictEqual(geminiIssueOutputSchema.safeParse(decLine).success, false);

      const decCol = createValidIssue({ columnStart: 2.5 });
      assert.strictEqual(geminiIssueOutputSchema.safeParse(decCol).success, false);
    });

    test('C.5: Inverted line coordinates rejected', () => {
      const invertedLines = createValidIssue({ lineStart: 5, lineEnd: 2 });
      const res = geminiIssueOutputSchema.safeParse(invertedLines);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.errors.some((e) => e.message.includes('lineEnd cannot be less than lineStart')));
    });

    test('C.6: Same-line inverted columns rejected', () => {
      const invertedCols = createValidIssue({
        lineStart: 3,
        lineEnd: 3,
        columnStart: 20,
        columnEnd: 5
      });
      const res = geminiIssueOutputSchema.safeParse(invertedCols);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.errors.some((e) => e.message.includes('columnEnd cannot be less than columnStart on the same line')));
    });

    test('C.7: Valid multi-line coordinates accepted even when columnEnd < columnStart', () => {
      // Multi-line: line 2 col 25 to line 4 col 5 is completely valid
      const multiLineIssue = createValidIssue({
        lineStart: 2,
        lineEnd: 4,
        columnStart: 25,
        columnEnd: 5
      });
      const res = geminiIssueOutputSchema.safeParse(multiLineIssue);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.lineStart, 2);
      assert.strictEqual(res.data.lineEnd, 4);
      assert.strictEqual(res.data.columnStart, 25);
      assert.strictEqual(res.data.columnEnd, 5);
    });
  });

  // ===========================================================================
  // SUITE D: SOURCE-AWARE COORDINATES & CONVENTIONS
  // ===========================================================================
  describe('Suite D: Source-Aware Coordinate Validation & Conventions', () => {
    test('D.1: Valid source coordinates matching source line count and column lengths pass', () => {
      // Line 1: 'function processPayment(user, amount) {' -> length 39, exclusive end column = 40
      const issue = createValidIssue({
        lineStart: 1,
        lineEnd: 1,
        columnStart: 1,
        columnEnd: 40
      });
      const response = createValidAiResponse({ issues: [issue] });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, true);
    });

    test('D.2: Line coordinate beyond total source line count rejected without normalization', () => {
      // SAMPLE_SOURCE_CODE has 6 lines
      const outOfBoundsLine = createValidIssue({
        lineStart: 10,
        lineEnd: 10,
        columnStart: 1,
        columnEnd: 10
      });
      const response = createValidAiResponse({ issues: [outOfBoundsLine] });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('exceeding total source line count'));
      // Verify no silent clamping occurred
      assert.strictEqual(outOfBoundsLine.lineStart, 10);
    });

    test('D.3: Column coordinate beyond actual line length rejected', () => {
      // Line 2: '  if (!user || amount <= 0) {' -> length 30, exclusive maxEndCol = 31
      // columnEnd 99 exceeds line 2 length
      const outOfBoundsCol = createValidIssue({
        lineStart: 2,
        lineEnd: 2,
        columnStart: 3,
        columnEnd: 99
      });
      const response = createValidAiResponse({ issues: [outOfBoundsCol] });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('columnEnd'));
      assert.ok(res.error.message.includes('exceeding line 2 length'));
    });

    test('D.4: Supports sourceLineCount passed as numeric parameter', () => {
      const issue = createValidIssue({ lineStart: 15, lineEnd: 15, columnStart: 1, columnEnd: 10 });
      const response = createValidAiResponse({ issues: [issue] });
      // Total source lines = 10
      const res = validateAiResponse(response, 10);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('exceeding total source line count (10)'));
    });

    test('D.5: createSourceAwareSchema factory creates standalone reusable schema', () => {
      const schema = createSourceAwareSchema(SAMPLE_SOURCE_CODE);
      const invalidResponse = createValidAiResponse({
        issues: [createValidIssue({ lineStart: 20, lineEnd: 20, columnStart: 1, columnEnd: 10 })]
      });
      const res = schema.safeParse(invalidResponse);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.errors.some((e) => e.message.includes('exceeding total source line count')));
    });
  });

  // ===========================================================================
  // SUITE E: STRICTNESS & BOUNDARY LIMITS
  // ===========================================================================
  describe('Suite E: Strictness & Boundary Limits', () => {
    test('E.1: Top-level unknown properties rejected', () => {
      const response = createValidAiResponse({
        hallucinatedField: 'dangerous_untrusted_input'
      });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('Unrecognized key(s) in object: \'hallucinatedField\''));
    });

    test('E.2: CategoryScores unknown properties rejected', () => {
      const response = createValidAiResponse({
        categoryScores: {
          ...createValidCategoryScores(),
          extraScore: 90
        }
      });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('Unrecognized key(s) in object: \'extraScore\''));
    });

    test('E.3: Issue unknown properties rejected (e.g. database fields or arbitrary source)', () => {
      const response = createValidAiResponse({
        issues: [
          createValidIssue({
            _id: '670c5e9f8a3d2e1b4c9a8f01',
            source: 'gemini',
            userId: '670c5e9f8a3d2e1b4c9a8f02'
          })
        ]
      });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('Unrecognized key(s) in object'));
    });

    test('E.4: Empty, null, or malformed responses rejected cleanly', () => {
      assert.strictEqual(validateAiResponse(null, SAMPLE_SOURCE_CODE).success, false);
      assert.strictEqual(validateAiResponse(undefined, SAMPLE_SOURCE_CODE).success, false);
      assert.strictEqual(validateAiResponse('', SAMPLE_SOURCE_CODE).success, false);
      assert.strictEqual(validateAiResponse({}, SAMPLE_SOURCE_CODE).success, false);
      assert.strictEqual(validateAiResponse([], SAMPLE_SOURCE_CODE).success, false);
    });

    test('E.5: Excessive issue count (> 50) rejected', () => {
      const issues = [];
      for (let i = 0; i < 51; i++) {
        issues.push(createValidIssue({ title: `Issue number ${i + 1} with valid title` }));
      }
      assert.strictEqual(issues.length, 51);
      const response = createValidAiResponse({ issues });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.message.includes('Cannot exceed 50 AI issues'));
    });

    test('E.6: Maximum allowed issue count (exactly 50) accepted', () => {
      const issues = [];
      for (let i = 0; i < 50; i++) {
        issues.push(createValidIssue({ title: `Issue number ${i + 1} with valid title` }));
      }
      assert.strictEqual(issues.length, 50);
      const response = createValidAiResponse({ issues });
      const res = validateAiResponse(response, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.data.issues.length, 50);
    });

    test('E.7: Missing required complexity or refactoring fields rejected', () => {
      // Missing summary
      const noSummary = createValidAiResponse();
      delete noSummary.summary;
      assert.strictEqual(validateAiResponse(noSummary, SAMPLE_SOURCE_CODE).success, false);

      // Too short summary (< 20 chars)
      const shortSummary = createValidAiResponse({ summary: 'Too short' });
      assert.strictEqual(validateAiResponse(shortSummary, SAMPLE_SOURCE_CODE).success, false);

      // Missing timeComplexity
      const noTimeComp = createValidAiResponse();
      delete noTimeComp.timeComplexity;
      assert.strictEqual(validateAiResponse(noTimeComp, SAMPLE_SOURCE_CODE).success, false);

      // Missing spaceComplexity
      const noSpaceComp = createValidAiResponse();
      delete noSpaceComp.spaceComplexity;
      assert.strictEqual(validateAiResponse(noSpaceComp, SAMPLE_SOURCE_CODE).success, false);

      // Missing suggestedCode
      const noCode = createValidAiResponse();
      delete noCode.suggestedCode;
      assert.strictEqual(validateAiResponse(noCode, SAMPLE_SOURCE_CODE).success, false);

      // Empty suggestedCode
      const emptyCode = createValidAiResponse({ suggestedCode: '' });
      assert.strictEqual(validateAiResponse(emptyCode, SAMPLE_SOURCE_CODE).success, false);

      // Missing refactoringRationale
      const noRationale = createValidAiResponse();
      delete noRationale.refactoringRationale;
      assert.strictEqual(validateAiResponse(noRationale, SAMPLE_SOURCE_CODE).success, false);
    });
  });

  // ===========================================================================
  // SUITE F: SECURITY & ZERO FABRICATED DEFAULTS
  // ===========================================================================
  describe('Suite F: Security & Zero Fabricated Defaults', () => {
    test('F.1: Validation error output does not expose source code or secret values', () => {
      const rawSecret = 'AKIAIOSFODNN7EXAMPLE';
      const dbPassword = 'postgres://admin:SuperSecretP@ssw0rd!@cluster.internal:5432/db';

      // Input containing invalid fields and simulating secrets in text
      const maliciousPayload = {
        summary: `Refactoring for database ${dbPassword}`,
        timeComplexity: 'O(N)',
        spaceComplexity: 'O(1)',
        categoryScores: {
          bugScore: -1, // invalid: will trigger error
          securityScore: 80,
          performanceScore: 80,
          maintainabilityScore: 80
        },
        suggestedCode: `const secret = "${rawSecret}";`,
        refactoringRationale: 'Explanation of fixes that needed to be applied for production readiness.',
        issues: []
      };

      const res = validateAiResponse(maliciousPayload, SAMPLE_SOURCE_CODE);
      assert.strictEqual(res.success, false);

      // Ensure raw secret values and passwords do NOT enter error.message or error.details
      assert.ok(!res.error.message.includes(rawSecret), 'Error message must not contain secret');
      assert.ok(!res.error.message.includes(dbPassword), 'Error message must not contain password');
      assert.ok(!res.error.message.includes(SAMPLE_SOURCE_CODE), 'Error message must not contain source code');

      const detailsStr = JSON.stringify(res.error.details);
      assert.ok(!detailsStr.includes(rawSecret), 'Error details must not contain secret');
      assert.ok(!detailsStr.includes(dbPassword), 'Error details must not contain password');
      assert.ok(!detailsStr.includes(SAMPLE_SOURCE_CODE), 'Error details must not contain source code');
    });

    test('F.2: Zero fabricated defaults when scores or required fields are omitted', () => {
      // If categoryScores is missing, it must not fabricate a default object
      const noScores = createValidAiResponse();
      delete noScores.categoryScores;
      const resScores = validateAiResponse(noScores, SAMPLE_SOURCE_CODE);
      assert.strictEqual(resScores.success, false);

      // If one score is missing, it must not fill in a synthetic fallback (e.g. 85 or 0)
      const partialScores = createValidAiResponse({
        categoryScores: {
          bugScore: 90,
          securityScore: 90,
          performanceScore: 90
          // maintainabilityScore omitted
        }
      });
      const resPartial = validateAiResponse(partialScores, SAMPLE_SOURCE_CODE);
      assert.strictEqual(resPartial.success, false);
      assert.ok(resPartial.error.message.includes('maintainabilityScore'));
    });

    test('F.3: Zero fabricated defaults when finding fields are omitted', () => {
      // Omitting any finding field must not fabricate a fallback value
      const fields = ['columnStart', 'columnEnd', 'originalSnippet', 'suggestedSnippet', 'explanation'];
      for (const field of fields) {
        const issue = createValidIssue();
        delete issue[field];
        const res = geminiIssueOutputSchema.safeParse(issue);
        assert.strictEqual(
          res.success,
          false,
          `Expected issue without '${field}' to fail validation without fabricating default`
        );
      }
    });
  });
});
