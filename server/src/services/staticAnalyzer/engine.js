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

  // 6. Strict same-rule deduplication & deterministic sorting
  const deduplicatedFindings = deduplicateFindings(rawFindings);

  // 7. Deterministic mathematical scoring
  const scoring = calculateScore(deduplicatedFindings);

  // 8. Derived metric aggregation
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
    metrics,
    scoring,
    findings: deduplicatedFindings
  };
}

export default analyze;
