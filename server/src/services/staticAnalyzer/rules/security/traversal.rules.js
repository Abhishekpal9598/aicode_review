/**
 * Path Traversal & File Access Static Analysis Rules
 * server/src/services/staticAnalyzer/rules/security/traversal.rules.js
 *
 * Covers:
 * - Path Traversal / Arbitrary File Access (CWE-22 / A01:2021-Broken Access Control)
 */

export const traversalRules = [
  {
    ruleId: 'SEC-PY-TRAV-001',
    name: 'Path Traversal via os.path.join in Python',
    title: 'Path Traversal via Unvalidated Path',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A01:2021-Broken Access Control',
    cwe: 'CWE-22',
    confidence: 'MEDIUM',
    languages: ['python'],
    scanRaw: false,
    regex: /open\s*\(\s*os\.path\.join\([^)]*(?:request\.|req\.|user_input|filename|path)/g,
    explanation:
      'Joining user-controlled input into file paths using os.path.join() allows directory traversal sequences (../) to read arbitrary files.',
    suggestedSnippet: 'safe_path = os.path.abspath(os.path.join(BASE_DIR, filename))\nif not safe_path.startswith(BASE_DIR):\n    raise PermissionError("Access denied")',
    remediation: 'Canonicalize paths with os.path.abspath() and verify that the target path begins with the intended base directory.'
  }
];

export default traversalRules;
