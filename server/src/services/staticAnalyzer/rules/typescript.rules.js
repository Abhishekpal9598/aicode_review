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
  },
  {
    ruleId: 'RISK-TS-003',
    name: 'Potential Division by Zero in TypeScript',
    title: 'Potential Division by Zero',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-369',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /(?:return\s+|[a-zA-Z_]\w*\s*=\s*)[^;\n/]+\/\s*([a-zA-Z_]\w*)\s*;|(?:\/|%|\/=|%=)\s*0+(?![0-9.])/g,
    explanation:
      'Division or modulo by zero produces Infinity or NaN in TypeScript, leading to arithmetic inaccuracies and runtime failure.',
    suggestedSnippet: (m) => {
      const divisor = m && m[1] ? m[1] : 'divisor';
      return `if (${divisor} === 0) throw new Error("Divisor cannot be zero");\nreturn a / ${divisor};`;
    },
    remediation: 'Validate that the divisor is non-zero before evaluating division.',
    matchFilter: (match, targetText) => {
      const slashOffset = match[0].indexOf('/');
      const slashIndex = slashOffset !== -1 ? match.index + slashOffset : match.index;
      if (isInsideTsStringLiteral(targetText, slashIndex)) return false;
      if (match[1]) {
        const divisor = match[1];
        const matchIndex = match.index;
        const lookback = targetText.slice(Math.max(0, matchIndex - 300), matchIndex);
        const guardRegex = new RegExp(`(?:\\b${divisor}\\s*(?:===|!==|<=|<|>)\\s*0|!\\s*${divisor}\\b)`);
        if (guardRegex.test(lookback)) return false;
      }
      return true;
    }
  },
  {
    ruleId: 'RISK-TS-004',
    name: 'Null or Undefined Object Dereference in TypeScript',
    title: 'Potential Null or Undefined Dereference',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-476',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(?:let|const|var)\s+([a-zA-Z_]\w*)(?:\s*:\s*[^=;]+)?\s*=\s*(?:null|undefined)\s*;[\s\S]*?\b\1\s*\.\s*[a-zA-Z_]\w*|\b(?:null|undefined)\s*\.\s*[a-zA-Z_]\w*/g,
    explanation:
      'Accessing properties or methods on variables holding null or undefined bypasses non-null assertions and triggers runtime TypeError.',
    suggestedSnippet: 'if (obj) {\n  obj.performAction();\n}',
    remediation: 'Use optional chaining (?.) or type guards before dereferencing potentially nullable values.',
    matchFilter: (match, targetText) => {
      if (isInsideTsStringLiteral(targetText, match.index)) return false;
      if (match[1]) {
        const varName = match[1];
        const matchText = match[0];
        const firstSemicolon = matchText.indexOf(';');
        const between = matchText.slice(firstSemicolon + 1);
        const reassignRegex = new RegExp(`\\b${varName}\\s*=\\s*(?!null|undefined\\b)`);
        if (reassignRegex.test(between)) return false;
        const guardRegex = new RegExp(`if\\s*\\([^)]*\\b${varName}\\b`);
        if (guardRegex.test(between)) return false;
      }
      return true;
    }
  },
  {
    ruleId: 'QUAL-TS-003',
    name: 'Unconditional Infinite Loop in TypeScript',
    title: 'Unconditional Infinite Loop',
    category: 'QUAL',
    severity: 'HIGH',
    cwe: 'CWE-835',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(?:while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\))\s*\{((?:(?!break|return|throw)[\s\S])*?)\}/g,
    explanation:
      'An unconstrained loop without break, return, or throw statements runs indefinitely, blocking thread execution.',
    suggestedSnippet: 'while (hasMore) {\n  if (shouldStop()) break;\n  processItem();\n}',
    remediation: 'Include an explicit termination check or break condition inside the loop body.',
    matchFilter: (match, targetText) => {
      if (isInsideTsStringLiteral(targetText, match.index)) return false;
      return true;
    }
  }
];

function isInsideTsStringLiteral(text, index) {
  if (typeof text !== 'string' || index <= 0) return false;
  const prefix = text.slice(0, index);
  const backtickCount = (prefix.match(/(?<!\\)`/g) || []).length;
  if (backtickCount % 2 !== 0) return true;
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const lineBefore = text.slice(lineStart, index);
  const quotes = (lineBefore.match(/(?<!\\)["']/g) || []).length;
  return quotes % 2 !== 0;
}

export default typescriptRules;
