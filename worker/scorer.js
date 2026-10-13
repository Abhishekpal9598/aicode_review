/**
 * Worker Scorer Module
 * Formula: Quality = 100 - weighted penalties:
 * - High: 10
 * - Medium: 4
 * - Low: 1
 * Floored at 0.
 */
function calculateScore(issues) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return 100;
  }

  let penalty = 0;
  for (const issue of issues) {
    const sev = String(issue.severity || '').toLowerCase();
    switch (sev) {
      case 'high':
        penalty += 10;
        break;
      case 'medium':
        penalty += 4;
        break;
      case 'low':
        penalty += 1;
        break;
      default:
        penalty += 2;
    }
  }

  return Math.max(0, 100 - penalty);
}

module.exports = {
  calculateScore
};
