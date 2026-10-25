/**
 * Static Analysis Engine Coordinator
 *
 * Orchestrates the full static analysis pipeline:
 * 1. Lexical comment masking via Preprocessor FSM (1:1 spatial offset invariance)
 * 2. Rule evaluation (Tier 1: raw secrets, Tier 2: comment-masked patterns)
 * 3. Spatial coordinate and snippet mapping
 * 4. Strict same-rule deduplication
 * 5. Deterministic scoring and grade calculation
 * 6. Mathematical metrics aggregation
 */

import { preprocessCode } from './utils/preprocessor.js';
import { LineMapper } from './utils/lineMapper.js';
import { deduplicateFindings } from './utils/deduplicator.js';
import { calculateScore } from './scoring.js';
import { getRulesForLanguage } from './rules/index.js';
import { detectLanguageMismatch } from './utils/detector.js';

/**
 * Analyzes source code deterministically across supported languages.
 *
 * @param {string} code - Untrusted source code string
 * @param {string} language - Programming language identifier ('python', 'javascript', 'typescript', 'java', 'c', 'cpp')
 * @param {object} [options={}] - Optional metadata (fileName, title)
 * @returns {object} - Analysis results payload
 */
export function analyze(code, language, options = {}) {
  const startTime = process.hrtime.bigint();

  const safeCode = typeof code === 'string' ? code : '';
  const safeLang = (language || '').toLowerCase().trim();
  const fileName = options.fileName || null;

  // 1. Line and character metrics
  const lines = safeCode.split(/\r?\n/);
  const totalLines = lines.length;
  const analyzedLines = lines.filter((line) => line.trim().length > 0).length;
  const characterCount = safeCode.length;

  // 2. Preprocess code (FSM comment masking)
  const maskedCode = preprocessCode(safeCode, safeLang);

  // 3. Coordinate mapper
  const lineMapper = new LineMapper(safeCode);

  // 4. Retrieve rules for target language
  const rules = getRulesForLanguage(safeLang);

  // 5. Rule execution
  const rawFindings = [];

  for (const rule of rules) {
    // Select scanning tier: raw text for secrets, comment-masked text for patterns
    const targetText = rule.scanRaw ? safeCode : maskedCode;
    const regex = new RegExp(rule.regex.source, rule.regex.flags);

    let match;
    while ((match = regex.exec(targetText)) !== null) {
      // Backward-compatible match filter hook (e.g. contextual bounds or guard validation)
      if (typeof rule.matchFilter === 'function' && !rule.matchFilter(match, targetText)) {
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
        continue;
      }

      const startIndex = match.index;
      const matchedText = match[0];
      const endIndex = startIndex + matchedText.length;

      // Map to 1-indexed line and column coordinates
      const coords = lineMapper.mapCoordinates(startIndex, endIndex);

      const finding = {
        ruleId: rule.ruleId,
        title: rule.title || rule.name,
        category: rule.category,
        severity: rule.severity,
        lineStart: coords.lineStart,
        lineEnd: coords.lineEnd,
        columnStart: coords.columnStart,
        columnEnd: coords.columnEnd,
        originalSnippet: coords.originalSnippet,
        suggestedSnippet:
          typeof rule.suggestedSnippet === 'function'
            ? rule.suggestedSnippet(match)
            : rule.suggestedSnippet || '',
        explanation: rule.explanation,
        remediation: rule.remediation || '',
        source: 'static',
        cwe: rule.cwe || null,
        owaspCategory: rule.owaspCategory || null,
        confidence: rule.confidence || null
      };

      rawFindings.push(finding);

      // Prevent infinite loop on zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  }

  // 6. Language signature validation (prevent silent cross-language false clean Grade A)
  const mismatchCheck = detectLanguageMismatch(safeCode, safeLang);
  if (mismatchCheck.isMismatch) {
    const detected = mismatchCheck.detectedLanguage;
    const evidenceStr = mismatchCheck.evidence.slice(0, 3).join(', ');
    rawFindings.push({
      ruleId: 'LANG-MISMATCH-001',
      title: 'Programming Language Mismatch Detected',
      category: 'RISK',
      severity: 'HIGH',
      lineStart: 1,
      lineEnd: 1,
      columnStart: 1,
      columnEnd: Math.max(2, (lines[0] || '').length + 1),
      originalSnippet: lines[0] ? lines[0].slice(0, 100) : '',
      suggestedSnippet: `// Switch selected language to ${detected ? detected.toUpperCase() : 'correct language'}`,
      explanation: `The submitted code exhibits syntax patterns typical of ${detected ? detected.toUpperCase() : 'another language'} (e.g. ${evidenceStr}), but analysis was requested for "${safeLang}". Static analysis rules for ${safeLang.toUpperCase()} cannot parse or evaluate ${detected ? detected.toUpperCase() : 'this'} code, resulting in invalid analysis.`,
      remediation: `Change the selected language to '${detected ? detected.toUpperCase() : 'the matching language'}' to run the appropriate static analysis rules.`,
      source: 'static',
      cwe: 'CWE-398',
      owaspCategory: 'A04:2021-Insecure Design',
      confidence: 'HIGH'
    });
  }

  // 7. Strict same-rule deduplication & deterministic sorting
  const deduplicatedFindings = deduplicateFindings(rawFindings);

  // 8. Deterministic mathematical scoring
  const scoring = calculateScore(deduplicatedFindings);

  // 9. Derived metric aggregation
  const securityFindings = deduplicatedFindings.filter((f) => f.category === 'SEC').length;
  const riskFindings = deduplicatedFindings.filter((f) => f.category === 'RISK').length;
  const qualityFindings = deduplicatedFindings.filter((f) => f.category === 'QUAL').length;

  const severityCounts = {
    critical: deduplicatedFindings.filter((f) => f.severity === 'CRITICAL').length,
    high: deduplicatedFindings.filter((f) => f.severity === 'HIGH').length,
    medium: deduplicatedFindings.filter((f) => f.severity === 'MEDIUM').length,
    low: deduplicatedFindings.filter((f) => f.severity === 'LOW').length,
    info: deduplicatedFindings.filter((f) => f.severity === 'INFO').length
  };

  const endTime = process.hrtime.bigint();
  const executionTimeMs = Math.max(1, Number((endTime - startTime) / 1_000_000n));

  const metrics = {
    totalLines,
    analyzedLines,
    totalFindings: deduplicatedFindings.length,
    securityFindings,
    riskFindings,
    qualityFindings,
    severityCounts,
    characterCount,
    executionTimeMs
  };

  return {
    transient: true,
    language: safeLang,
    fileName,
    languageMismatch: mismatchCheck.isMismatch
      ? {
          detectedLanguage: mismatchCheck.detectedLanguage,
          declaredLanguage: safeLang,
          evidence: mismatchCheck.evidence
        }
      : null,
    metrics,
    scoring,
    findings: deduplicatedFindings
  };
}

export default analyze;
