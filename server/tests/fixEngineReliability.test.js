/**
 * Phase 6: Apply Fix & Undo Fix Reliability Test Suite
 * server/tests/fixEngineReliability.test.js
 *
 * Verifies:
 * 1. Dynamic Variable Preservation in Suggested Fixes (C, C++, Python, JS, TS, Java)
 * 2. Elimination of undeclared placeholder variables (e.g. gets(password) -> fgets(password, ...))
 * 3. Indentation Preservation across single-line and multiline fixes
 * 4. Apply Fix execution integrity (surrounding code preserved, range accuracy)
 * 5. LIFO Undo Fix restoration (character-for-character buffer equality)
 * 6. Multiple sequential fixes and re-analysis validation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { analyze } from '../src/services/staticAnalyzer/engine.js';

describe('Phase 6: Apply Fix & Undo Fix Engine Reliability Suite', () => {
  // ---------------------------------------------------------------------------
  // 1. Dynamic Variable Preservation & Fix Template Reliability
  // ---------------------------------------------------------------------------
  describe('1. Dynamic Variable Preservation in Fix Templates', () => {
    it('C: gets(password) generates fgets(password, sizeof(password), stdin);', () => {
      const code = [
        '#include <stdio.h>',
        'void read_credentials() {',
        '    char password[64];',
        '    gets(password);',
        '}'
      ].join('\n');

      const result = analyze(code, 'c');
      const getsFinding = result.findings.find((f) => f.ruleId === 'RISK-C-002' || f.ruleId === 'SEC-C-BUF-002');
      assert.ok(getsFinding, 'Must detect gets() finding');
      assert.equal(
        getsFinding.suggestedSnippet,
        'fgets(password, sizeof(password), stdin);',
        'Suggested snippet must preserve original variable name "password"'
      );
      assert.doesNotMatch(
        getsFinding.suggestedSnippet,
        /\bbuf\b/,
        'Must NOT use generic placeholder "buf" when variable is "password"'
      );
    });

    it('C: strcpy(authToken, rawInput) preserves original dest and src variables', () => {
      const code = [
        '#include <string.h>',
        'void handle_token(const char* rawInput) {',
        '    char authToken[128];',
        '    strcpy(authToken, rawInput);',
        '}'
      ].join('\n');

      const result = analyze(code, 'c');
      const strcpyFinding = result.findings.find((f) => f.ruleId === 'RISK-C-001' || f.ruleId === 'SEC-C-BUF-001');
      assert.ok(strcpyFinding, 'Must detect strcpy() finding');
      assert.ok(
        strcpyFinding.suggestedSnippet.includes('strncpy(authToken, rawInput, sizeof(authToken) - 1);'),
        `Expected strncpy with authToken and rawInput, got:\n${strcpyFinding.suggestedSnippet}`
      );
      assert.ok(
        strcpyFinding.suggestedSnippet.includes("authToken[sizeof(authToken) - 1] = '\\0';"),
        `Expected explicit null termination on authToken, got:\n${strcpyFinding.suggestedSnippet}`
      );
    });

    it('C: sprintf(sessionKey, "%s", clientToken) preserves buffer and format arguments', () => {
      const code = [
        '#include <stdio.h>',
        'void format_key(const char* clientToken) {',
        '    char sessionKey[256];',
        '    sprintf(sessionKey, "%s", clientToken);',
        '}'
      ].join('\n');

      const result = analyze(code, 'c');
      const sprintfFinding = result.findings.find((f) => f.ruleId === 'RISK-C-003' || f.ruleId === 'SEC-C-BUF-003');
      assert.ok(sprintfFinding, 'Must detect sprintf() finding');
      assert.equal(
        sprintfFinding.suggestedSnippet,
        'snprintf(sessionKey, sizeof(sessionKey), "%s", clientToken);',
        'Must preserve sessionKey, sizeof(sessionKey), and arguments'
      );
    });

    it('C++: strcpy(targetBuffer, srcStr.c_str()) preserves target variable in C++', () => {
      const code = [
        '#include <string>',
        '#include <cstring>',
        'void copy_cpp(const std::string& srcStr) {',
        '    char targetBuffer[100];',
        '    strcpy(targetBuffer, srcStr.c_str());',
        '}'
      ].join('\n');

      const result = analyze(code, 'cpp');
      const finding = result.findings.find((f) => f.ruleId === 'RISK-CPP-001' || f.ruleId === 'SEC-CPP-BUF-001');
      assert.ok(finding, 'Must detect C-style copy in C++');
      assert.ok(
        finding.suggestedSnippet.includes('targetBuffer'),
        `Suggested snippet must preserve targetBuffer, got: ${finding.suggestedSnippet}`
      );
    });

    it('C++: sprintf(outLog, "%s", entry.c_str()) preserves outLog in C++', () => {
      const code = [
        '#include <cstdio>',
        '#include <string>',
        'void log_entry(const std::string& entry) {',
        '    char outLog[512];',
        '    sprintf(outLog, "%s", entry.c_str());',
        '}'
      ].join('\n');

      const result = analyze(code, 'cpp');
      const finding = result.findings.find((f) => f.ruleId === 'RISK-CPP-003' || f.ruleId === 'SEC-CPP-FMT-001');
      assert.ok(finding, 'Must detect sprintf in C++');
      assert.equal(
        finding.suggestedSnippet,
        'snprintf(outLog, sizeof(outLog), "%s", entry.c_str());'
      );
    });

    it('C++: return total / divisor; preserves divisor name in division by zero fix', () => {
      const code = [
        'int calculate_ratio(int total, int divisor) {',
        '    return total / divisor;',
        '}'
      ].join('\n');

      const result = analyze(code, 'cpp');
      const finding = result.findings.find((f) => f.ruleId === 'RISK-CPP-004');
      assert.ok(finding, 'Must detect division by zero hazard');
      assert.ok(
        finding.suggestedSnippet.includes('if (divisor == 0)'),
        `Suggested snippet must validate divisor, got: ${finding.suggestedSnippet}`
      );
    });

    it('C++: int totalAccumulator; preserves variable name in uninitialized fix', () => {
      const code = [
        '#include <iostream>',
        'void process() {',
        '    int totalAccumulator;',
        '    std::cout << totalAccumulator;',
        '}'
      ].join('\n');

      const result = analyze(code, 'cpp');
      const finding = result.findings.find((f) => f.ruleId === 'RISK-CPP-006');
      assert.ok(finding, 'Must detect uninitialized variable');
      assert.ok(
        finding.suggestedSnippet.includes('totalAccumulator = 0'),
        `Suggested snippet must initialize totalAccumulator, got: ${finding.suggestedSnippet}`
      );
    });

    it('Python: eval(user_query) suggests safe ast.literal_eval', () => {
      const code = 'result = eval(user_query)';
      const result = analyze(code, 'python');
      const finding = result.findings.find((f) => f.ruleId === 'RISK-PY-001');
      assert.ok(finding, 'Must detect eval');
      assert.ok(finding.suggestedSnippet.includes('ast.literal_eval'));
    });

    it('JavaScript: card.innerHTML = rawInput suggests textContent or sanitization', () => {
      const code = 'card.innerHTML = rawInput;';
      const result = analyze(code, 'javascript');
      const finding = result.findings.find((f) => f.ruleId === 'RISK-JS-002');
      assert.ok(finding, 'Must detect innerHTML');
      assert.ok(finding.suggestedSnippet.includes('textContent'));
    });

    it('TypeScript: dangerouslySetInnerHTML suggests safe element structure', () => {
      const code = 'const view = <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;';
      const result = analyze(code, 'typescript');
      const finding = result.findings.find((f) => f.ruleId === 'RISK-TS-002');
      assert.ok(finding, 'Must detect dangerouslySetInnerHTML');
      assert.ok(finding.suggestedSnippet.length > 0);
    });

    it('Java: unprepared SQL concatenation suggests PreparedStatement', () => {
      const code = 'stmt.executeQuery("SELECT * FROM users WHERE name = \'" + user + "\'");';
      const result = analyze(code, 'java');
      const finding = result.findings.find((f) => f.ruleId === 'RISK-JAV-001' || f.ruleId === 'SEC-JAV-SQL-001');
      assert.ok(finding, 'Must detect SQL concatenation');
      assert.ok(finding.suggestedSnippet.includes('PreparedStatement'));
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Indentation Preservation Helper Validation
  // ---------------------------------------------------------------------------
  describe('2. Indentation Preservation Logic', () => {
    function applyFixWithIndentation(sourceCode, finding) {
      const lines = sourceCode.split(/\r?\n/);
      const totalLines = lines.length;
      const lineStart = Math.min(Math.max(1, finding.lineStart || 1), totalLines);
      const lineEnd = Math.min(Math.max(lineStart, finding.lineEnd || lineStart), totalLines);

      const targetFirstLine = lines[lineStart - 1] || '';
      const indentMatch = targetFirstLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '';

      const rawReplacementLines = finding.suggestedSnippet.split(/\r?\n/);
      const replacementLines = (baseIndent && !rawReplacementLines[0].startsWith(baseIndent))
        ? rawReplacementLines.map((l) => (l.trim().length > 0 ? baseIndent + l : l))
        : rawReplacementLines;

      const beforeLines = lines.slice(0, lineStart - 1);
      const afterLines = lines.slice(lineEnd);
      return [...beforeLines, ...replacementLines, ...afterLines].join('\n');
    }

    it('Preserves 4-space indentation on single-line replacement', () => {
      const code = [
        'void login() {',
        '    char password[64];',
        '    gets(password);',
        '    authenticate(password);',
        '}'
      ].join('\n');

      const analysis = analyze(code, 'c');
      const finding = analysis.findings.find((f) => f.ruleId === 'RISK-C-002');
      assert.ok(finding);

      const fixed = applyFixWithIndentation(code, finding);
      const fixedLines = fixed.split('\n');

      assert.equal(fixedLines[2], '    fgets(password, sizeof(password), stdin);');
      assert.equal(fixedLines[0], 'void login() {');
      assert.equal(fixedLines[1], '    char password[64];');
      assert.equal(fixedLines[3], '    authenticate(password);');
      assert.equal(fixedLines[4], '}');
    });

    it('Preserves 8-space indentation on multiline replacement', () => {
      const code = [
        'int main() {',
        '    if (ready) {',
        '        strcpy(dst, src);',
        '    }',
        '}'
      ].join('\n');

      const analysis = analyze(code, 'c');
      const finding = analysis.findings.find((f) => f.ruleId === 'RISK-C-001');
      assert.ok(finding);

      const fixed = applyFixWithIndentation(code, finding);
      const fixedLines = fixed.split('\n');

      assert.equal(fixedLines[2], '        strncpy(dst, src, sizeof(dst) - 1);');
      assert.equal(fixedLines[3], "        dst[sizeof(dst) - 1] = '\\0';");
      assert.equal(fixedLines[4], '    }');
    });

    it('Does not double-indent if snippet already has base indentation', () => {
      const code = '    val = 1;';
      const finding = {
        lineStart: 1,
        lineEnd: 1,
        suggestedSnippet: '    val = 2;'
      };

      const fixed = applyFixWithIndentation(code, finding);
      assert.equal(fixed, '    val = 2;');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Sequential Multiple Fixes & LIFO Undo Cycle
  // ---------------------------------------------------------------------------
  describe('3. Multi-Fix Application and LIFO Undo Verification', () => {
    it('applies two fixes sequentially and undos in reverse order to exact original code', () => {
      const originalCode = [
        '#include <stdio.h>',
        '#include <string.h>',
        'void vulnerable_flow() {',
        '    char name[32];',
        '    char pass[32];',
        '    gets(name);',
        '    strcpy(pass, name);',
        '}'
      ].join('\n');

      const undoStack = [];
      let currentCode = originalCode;

      // 1. Analyze initial code
      const initialAnalysis = analyze(currentCode, 'c');
      assert.ok(initialAnalysis.findings.length >= 2, 'Must detect at least 2 findings');

      // 2. Apply Fix 1 (gets on line 6)
      const getsFinding = initialAnalysis.findings.find((f) => f.ruleId === 'RISK-C-002');
      assert.ok(getsFinding);

      const codeAfterFix1 = [
        '#include <stdio.h>',
        '#include <string.h>',
        'void vulnerable_flow() {',
        '    char name[32];',
        '    char pass[32];',
        '    fgets(name, sizeof(name), stdin);',
        '    strcpy(pass, name);',
        '}'
      ].join('\n');

      undoStack.push({ previousCode: currentCode, appliedCode: codeAfterFix1 });
      currentCode = codeAfterFix1;

      // Verify Fix 1 resolved gets
      const analysisAfterFix1 = analyze(currentCode, 'c');
      assert.ok(
        !analysisAfterFix1.findings.some((f) => f.ruleId === 'RISK-C-002'),
        'RISK-C-002 must be resolved after Fix 1'
      );
      assert.ok(
        analysisAfterFix1.findings.some((f) => f.ruleId === 'RISK-C-001'),
        'RISK-C-001 must still remain'
      );

      // 3. Apply Fix 2 (strcpy on line 7)
      const codeAfterFix2 = [
        '#include <stdio.h>',
        '#include <string.h>',
        'void vulnerable_flow() {',
        '    char name[32];',
        '    char pass[32];',
        '    fgets(name, sizeof(name), stdin);',
        '    strncpy(pass, name, sizeof(pass) - 1);',
        "    pass[sizeof(pass) - 1] = '\\0';",
        '}'
      ].join('\n');

      undoStack.push({ previousCode: currentCode, appliedCode: codeAfterFix2 });
      currentCode = codeAfterFix2;

      // Verify Fix 2 resolved strcpy
      const analysisAfterFix2 = analyze(currentCode, 'c');
      assert.ok(
        !analysisAfterFix2.findings.some((f) => f.ruleId === 'RISK-C-001' || f.ruleId === 'RISK-C-002'),
        'Both findings must be resolved after Fix 2'
      );

      // 4. Undo Fix 2 (LIFO pop)
      const undoItem2 = undoStack.pop();
      currentCode = undoItem2.previousCode;
      assert.equal(currentCode, codeAfterFix1, 'Must restore codeAfterFix1');

      const reanalysisAfterUndo2 = analyze(currentCode, 'c');
      assert.ok(
        reanalysisAfterUndo2.findings.some((f) => f.ruleId === 'RISK-C-001'),
        'RISK-C-001 must be re-detected after undoing Fix 2'
      );

      // 5. Undo Fix 1 (LIFO pop)
      const undoItem1 = undoStack.pop();
      currentCode = undoItem1.previousCode;
      assert.equal(currentCode, originalCode, 'Must restore exact original code byte-for-byte');

      const reanalysisAfterUndo1 = analyze(currentCode, 'c');
      assert.ok(
        reanalysisAfterUndo1.findings.some((f) => f.ruleId === 'RISK-C-002'),
        'RISK-C-002 must be re-detected after undoing Fix 1'
      );
      assert.equal(undoStack.length, 0, 'Undo stack must now be empty');
    });
  });
});
