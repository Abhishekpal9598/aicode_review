/**
 * Server-Side Request Forgery (SSRF) Static Analysis Rules
 * server/src/services/staticAnalyzer/rules/security/ssrf.rules.js
 *
 * Covers:
 * - Unvalidated Outbound HTTP Request in Python (CWE-918 / A10:2021-Server-Side Request Forgery)
 * - Unvalidated Outbound HTTP Request in JavaScript/TypeScript (CWE-918 / A10:2021-Server-Side Request Forgery)
 */

export const ssrfRules = [
  {
    ruleId: 'SEC-PY-SSRF-001',
    name: 'Unvalidated Outbound HTTP Request in Python (requests)',
    title: 'Unvalidated Outbound Request (SSRF)',
    category: 'SEC',
    severity: 'MEDIUM',
    owaspCategory: 'A10:2021-Server-Side Request Forgery (SSRF)',
    cwe: 'CWE-918',
    confidence: 'MEDIUM',
    languages: ['python'],
    scanRaw: false,
    regex: /requests\s*\.\s*(?:get|post|put|delete|patch|head)\s*\(\s*(?!["']https?:\/\/)[a-zA-Z_]\w*/g,
    explanation:
      'Passing dynamic variables directly as URLs to HTTP clients allows attackers to coerce the server into requesting internal endpoints (SSRF).',
    suggestedSnippet: 'if is_safe_url(target_url):\n    requests.get(target_url)',
    remediation: 'Validate destination URLs against a strict whitelist of protocols and domain names, and block internal IP ranges (127.0.0.1, 169.254.169.254).'
  },
  {
    ruleId: 'SEC-JS-SSRF-001',
    name: 'Unvalidated Outbound HTTP Request in JavaScript/TypeScript (axios/fetch)',
    title: 'Unvalidated Outbound Request (SSRF)',
    category: 'SEC',
    severity: 'MEDIUM',
    owaspCategory: 'A10:2021-Server-Side Request Forgery (SSRF)',
    cwe: 'CWE-918',
    confidence: 'MEDIUM',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /(?:axios\s*\.\s*(?:get|post|put|delete|patch)|fetch)\s*\(\s*(?!["']https?:\/\/)[a-zA-Z_]\w*/g,
    explanation:
      'Invoking HTTP request methods with unvalidated dynamic URLs enables Server-Side Request Forgery (SSRF) against internal services and metadata APIs.',
    suggestedSnippet: 'if (isAllowedUrl(destUrl)) {\n  await axios.get(destUrl);\n}',
    remediation: 'Validate destination hostnames against an allowlist, restrict ports to 80/443, and block private IP address ranges.'
  }
];

export default ssrfRules;
