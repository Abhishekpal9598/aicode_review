/**
 * Cross-Site Scripting (XSS) Static Analysis Rules
 * server/src/services/staticAnalyzer/rules/security/xss.rules.js
 *
 * Covers:
 * - DOM-based XSS via innerHTML / outerHTML (CWE-79 / A03:2021-Injection)
 * - DOM-based XSS via document.write (CWE-79 / A03:2021-Injection)
 * - React dangerouslySetInnerHTML without sanitization (CWE-79 / A03:2021-Injection)
 */

export const xssRules = [
  {
    ruleId: 'SEC-JS-XSS-001',
    name: 'Direct DOM XSS Injection (innerHTML/outerHTML)',
    title: 'Direct DOM XSS Injection (innerHTML)',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A03:2021-Injection',
    cwe: 'CWE-79',
    confidence: 'HIGH',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /\.(?:innerHTML|outerHTML)\s*=\s*[^;]+/g,
    explanation:
      'Assigning untrusted strings directly to innerHTML or outerHTML bypasses HTML encoding and creates Cross-Site Scripting (XSS) vectors.',
    suggestedSnippet: 'element.textContent = cleanText;',
    remediation: 'Use element.textContent or DOMPurify.sanitize() before assigning HTML strings to DOM nodes.'
  },
  {
    ruleId: 'SEC-JS-XSS-002',
    name: 'Obsolete Insecure DOM Output (document.write)',
    title: 'Obsolete Insecure Output (document.write)',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A03:2021-Injection',
    cwe: 'CWE-79',
    confidence: 'HIGH',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /document\s*\.\s*write(?:ln)?\s*\(/g,
    explanation:
      'Using document.write() or document.writeln() directly injects unparsed strings into the page DOM, facilitating DOM-based XSS.',
    suggestedSnippet: 'const node = document.createElement("p");\nnode.textContent = text;\ndocument.body.appendChild(node);',
    remediation: 'Manipulate DOM nodes explicitly via createElement and appendChild or framework state.'
  },
  {
    ruleId: 'SEC-TS-XSS-001',
    name: 'React dangerouslySetInnerHTML HTML Injection',
    title: 'React dangerouslySetInnerHTML Injection',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A03:2021-Injection',
    cwe: 'CWE-79',
    confidence: 'HIGH',
    languages: ['typescript', 'javascript'],
    scanRaw: false,
    regex: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/g,
    explanation:
      'Using dangerouslySetInnerHTML in React without sanitization bypasses React built-in XSS protections.',
    suggestedSnippet: '<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml) }} />',
    remediation: 'Render standard React children or sanitize HTML strings using DOMPurify before injection.'
  }
];

export default xssRules;
