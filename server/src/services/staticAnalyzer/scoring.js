/**
 * Deterministic Scoring Engine
 *
 * Implements the mathematical scoring formula defined in docs/PHASE_7_IMPLEMENTATION_PLAN.md:
 * - Base score: 100
 * - Fixed severity weights:
 *     CRITICAL: 25
 *     HIGH: 15
 *     MEDIUM: 8
 *     LOW: 3
 *     INFO: 0
 * - Diminishing repeat penalty per unique ruleId:
 *     1st occurrence: 1.0 * w
 *     2nd occurrence: 0.5 * w
 *     3rd and subsequent: 0.25 * w
 *     Cumulative maximum deduction per ruleId: 1.75 * w
 * - Final score bounded to [0, 100]
 * - Deterministic grade thresholds:
 *     A: 90 - 100
 *     B: 75 - 89
 *     C: 60 - 74
 *     D: 40 - 59
 *     F: 0 - 39
 */

export const SEVERITY_WEIGHTS = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 8,
  LOW: 3,
  INFO: 0
};

export const GRADE_THRESHOLDS = [
  { min: 90, grade: 'A' },
  { min: 75, grade: 'B' },
  { min: 60, grade: 'C' },
  { min: 40, grade: 'D' },
  { min: 0, grade: 'F' }
];

export const STATIC_SCORE_DISCLAIMER =
  'The Static Code Quality Score is a deterministic rating calculated solely from pattern matching and static heuristics. It does not certify absolute security or production suitability.';

/**
 * Calculates rule deduction given occurrence count and severity weight.
 * Cumulative multiplier: k=1 -> 1.0, k=2 -> 1.5, k>=3 -> 1.75
 *
 * @param {number} count - Count of occurrences for this ruleId
 * @param {number} weight - Severity base weight
 * @returns {number} - Total deduction for this ruleId
 */
export function calculateRuleDeduction(count, weight) {
  if (!count || count <= 0 || !weight) return 0;
  if (count === 1) return 1.0 * weight;
  if (count === 2) return 1.5 * weight;
  return 1.75 * weight; // Natural ceiling for count >= 3
}

/**
 * Assigns letter grade based on overall numeric score.
 * @param {number} score
 * @returns {'A'|'B'|'C'|'D'|'F'}
 */
export function assignGrade(score) {
  for (const threshold of GRADE_THRESHOLDS) {
    if (score >= threshold.min) {
      return threshold.grade;
    }
  }
  return 'F';
}

/**
 * Computes deterministic scores from deduplicated findings.
 *
 * @param {Array<object>} findings - Deduplicated findings list
 * @returns {{ overallScore: number, grade: string, categoryScores: { security: number, risk: number, quality: number }, disclaimer: string }}
 */
export function calculateScore(findings = []) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return {
      overallScore: 100,
      grade: 'A',
      categoryScores: {
        security: 100,
        risk: 100,
        quality: 100
      },
      disclaimer: STATIC_SCORE_DISCLAIMER
    };
  }

  // Count occurrences per ruleId and track category
  const ruleCounts = new Map();
  const ruleSeverities = new Map();
  const ruleCategories = new Map();

  for (const finding of findings) {
    const ruleId = finding.ruleId;
    ruleCounts.set(ruleId, (ruleCounts.get(ruleId) || 0) + 1);

    if (!ruleSeverities.has(ruleId)) {
      const sev = (finding.severity || 'INFO').toUpperCase();
      ruleSeverities.set(ruleId, SEVERITY_WEIGHTS[sev] ?? 0);
      ruleCategories.set(ruleId, (finding.category || 'QUAL').toUpperCase());
    }
  }

  let totalDeduction = 0;
  let secDeduction = 0;
  let riskDeduction = 0;
  let qualDeduction = 0;

  for (const [ruleId, count] of ruleCounts.entries()) {
    const weight = ruleSeverities.get(ruleId) || 0;
    const category = ruleCategories.get(ruleId) || 'QUAL';
    const deduction = calculateRuleDeduction(count, weight);

    totalDeduction += deduction;

    if (category === 'SEC') {
      secDeduction += deduction;
    } else if (category === 'RISK') {
      riskDeduction += deduction;
    } else {
      qualDeduction += deduction;
    }
  }

  const overallScore = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
  const securityScore = Math.max(0, Math.min(100, Math.round(100 - secDeduction)));
  const riskScore = Math.max(0, Math.min(100, Math.round(100 - riskDeduction)));
  const qualityScore = Math.max(0, Math.min(100, Math.round(100 - qualDeduction)));

  const grade = assignGrade(overallScore);

  return {
    overallScore,
    grade,
    categoryScores: {
      security: securityScore,
      risk: riskScore,
      quality: qualityScore
    },
    disclaimer: STATIC_SCORE_DISCLAIMER
  };
}

export default calculateScore;
