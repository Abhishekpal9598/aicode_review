/**
 * Finding Deduplicator Utility
 *
 * Implements strict same-rule deduplication:
 * - Findings are grouped by their immutable ruleId.
 * - Matches with identical ruleId and overlapping line ranges (lineStart <= next.lineEnd && lineEnd >= next.lineStart)
 *   are collapsed into a single comprehensive finding.
 * - Findings from DIFFERENT ruleIds are NEVER merged, even if on the exact same line.
 * - Sorts findings deterministically:
 *   1. Severity descending (CRITICAL > HIGH > MEDIUM > LOW > INFO)
 *   2. lineStart ascending
 *   3. columnStart ascending
 *   4. ruleId alphabetical
 */

const SEVERITY_ORDER = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1
};

/**
 * Deduplicates and sorts raw findings according to Phase 7 specification.
 *
 * @param {Array<object>} findings - Raw array of finding objects
 * @returns {Array<object>} - Deduplicated, deterministically ordered findings array
 */
export function deduplicateFindings(findings = []) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return [];
  }

  // 1. Group findings by unique ruleId
  const byRuleId = new Map();

  for (const finding of findings) {
    if (!finding || !finding.ruleId) continue;

    if (!byRuleId.has(finding.ruleId)) {
      byRuleId.set(finding.ruleId, []);
    }
    byRuleId.get(finding.ruleId).push({ ...finding });
  }

  const deduplicated = [];

  // 2. Deduplicate within each ruleId group
  for (const [ruleId, ruleFindings] of byRuleId.entries()) {
    // Sort this group by lineStart, then lineEnd
    ruleFindings.sort((a, b) => {
      if (a.lineStart !== b.lineStart) return a.lineStart - b.lineStart;
      return a.lineEnd - b.lineEnd;
    });

    const mergedForThisRule = [];

    for (const current of ruleFindings) {
      if (mergedForThisRule.length === 0) {
        mergedForThisRule.push(current);
        continue;
      }

      const prev = mergedForThisRule[mergedForThisRule.length - 1];

      // Check if current finding overlaps or touches the previous finding of the SAME rule
      const isOverlapping =
        current.lineStart <= prev.lineEnd && current.lineEnd >= prev.lineStart;

      if (isOverlapping) {
        // Merge into prev: extend span and keep the earliest/widest bounds
        prev.lineStart = Math.min(prev.lineStart, current.lineStart);
        prev.lineEnd = Math.max(prev.lineEnd, current.lineEnd);
        prev.columnStart = Math.min(prev.columnStart || 1, current.columnStart || 1);
        prev.columnEnd = Math.max(prev.columnEnd || 1, current.columnEnd || 1);

        // Prefer longer/more descriptive snippet if available
        if (current.originalSnippet && current.originalSnippet.length > (prev.originalSnippet || '').length) {
          prev.originalSnippet = current.originalSnippet;
        }
      } else {
        mergedForThisRule.push(current);
      }
    }

    deduplicated.push(...mergedForThisRule);
  }

  // 3. Assign deterministic sequence IDs (e.g. finding_1_risk_js_001)
  // and sort deterministically
  deduplicated.sort((a, b) => {
    const sevA = SEVERITY_ORDER[a.severity?.toUpperCase()] || 0;
    const sevB = SEVERITY_ORDER[b.severity?.toUpperCase()] || 0;

    if (sevB !== sevA) return sevB - sevA; // Severity weight descending
    if (a.lineStart !== b.lineStart) return a.lineStart - b.lineStart; // lineStart ascending
    if ((a.columnStart || 1) !== (b.columnStart || 1)) {
      return (a.columnStart || 1) - (b.columnStart || 1); // columnStart ascending
    }
    return (a.ruleId || '').localeCompare(b.ruleId || ''); // ruleId alphabetical
  });

  return deduplicated.map((f, index) => ({
    id: `finding_${index + 1}_${f.ruleId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    ...f
  }));
}

export default deduplicateFindings;
