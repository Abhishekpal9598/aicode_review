/**
 * TypeScript Static Analysis Rules (Tier 2: Comment-Masked Lexical Scanning)
 */

export const typescriptRules = [
  {
    ruleId: 'RISK-TS-001',
    name: 'Dynamic Code Execution in TypeScript (eval)',
    title: 'Dynamic Code Execution (eval/new Function)',
    category: 'RISK',
    severity: 'CRITICAL',
    scanRaw: false,
    regex: /\b(?:eval\s*\(|new\s+Function\s*\()/g,
    explanation:
      'Dynamic evaluation of strings as code using eval() or new Function() opens the door to arbitrary JavaScript execution and XSS attacks.',
    suggestedSnippet: 'JSON.parse(data)',
    remediation: 'Avoid eval() and new Function(). Use typed schema parsers like Zod or JSON.parse().'
  },
  {
    ruleId: 'RISK-TS-002',
    name: 'React Dangerous HTML Injection in TypeScript',
    title: 'React Dangerous HTML Injection',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/g,
    explanation:
      'Using dangerouslySetInnerHTML in React without rigorous sanitization enables Cross-Site Scripting (XSS).',
    suggestedSnippet: '<div>{cleanText}</div>',
    remediation: 'Render standard React children instead, or sanitize untrusted HTML using DOMPurify.'
  },
  {
    ruleId: 'QUAL-TS-001',
    name: 'Type Safety Escape Hatch in TypeScript (any)',
    title: 'Unsafe Type Escape Hatch (any)',
    category: 'QUAL',
    severity: 'LOW',
    scanRaw: false,
    regex: /:\s*any\b|\bas\s+any\b/g,
    explanation:
      'The "any" type disables TypeScript compiler type checking, eliminating type safety and masking defects at runtime.',
    suggestedSnippet: 'const value: unknown = ...; // or define specific interface',
    remediation: 'Use "unknown" with type narrowing or define explicit interfaces/types.'
  },
  {
    ruleId: 'QUAL-TS-002',
    name: 'Empty Catch Block in TypeScript',
    title: 'Empty Catch Block',
    category: 'QUAL',
    severity: 'LOW',
    scanRaw: false,
    regex: /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
    explanation:
      'Silently swallowing errors in empty catch blocks obscures runtime failures and makes asynchronous debugging difficult.',
    suggestedSnippet: 'catch (err) {\n  console.warn("Caught error:", err);\n}',
    remediation: 'Log caught errors or rethrow typed errors.'
  }
];

export default typescriptRules;
