/**
 * JavaScript Static Analysis Rules (Tier 2: Comment-Masked Lexical Scanning)
 */

export const javascriptRules = [
  {
    ruleId: 'RISK-JS-001',
    name: 'Dynamic Code Execution in JavaScript (eval/new Function)',
    title: 'Dynamic Code Execution (eval/new Function)',
    category: 'RISK',
    severity: 'CRITICAL',
    scanRaw: false,
    regex: /\b(?:eval\s*\(|new\s+Function\s*\()/g,
    explanation:
      'Dynamic evaluation of strings as code using eval() or new Function() opens the door to arbitrary JavaScript execution and XSS attacks.',
    suggestedSnippet: 'JSON.parse(data)',
    remediation: 'Avoid eval() and new Function(). Use structured parsers like JSON.parse() or dedicated dispatch maps.'
  },
  {
    ruleId: 'RISK-JS-002',
    name: 'Direct DOM XSS Injection in JavaScript (innerHTML)',
    title: 'Direct DOM XSS Injection (innerHTML)',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /\.(?:innerHTML|outerHTML)\s*=\s*[^;]+/g,
    explanation:
      'Assigning raw untrusted strings to innerHTML or outerHTML bypasses HTML encoding and directly creates cross-site scripting (XSS) vectors.',
    suggestedSnippet: 'element.textContent = text;',
    remediation: 'Use element.textContent or DOMPurify.sanitize() before assigning HTML to DOM elements.'
  },
  {
    ruleId: 'RISK-JS-003',
    name: 'Insecure Shell Concatenation in JavaScript (child_process.exec / require)',
    title: 'Insecure Command Concatenation (child_process.exec)',
    category: 'RISK',
    severity: 'CRITICAL',
    scanRaw: false,
    regex:
      /(?:child_process|require\s*\(\s*['"](?:node:)?child_process['"]\s*\))\s*\.\s*(?:exec|execSync)\s*\([^)]*[\$\+]/g,
    matchFilter: (match, targetText) => !isInsideJsStringLiteral(targetText, match.index),
    explanation:
      'Passing dynamically concatenated strings with variables to child_process.exec() passes the string to a system shell, enabling command injection.',
    suggestedSnippet: 'child_process.execFile("executable", [arg1, arg2], callback)',
    remediation: 'Use child_process.execFile() or child_process.spawn() with an argument array instead of exec().'
  },
  {
    ruleId: 'QUAL-JS-001',
    name: 'Empty Catch Block in JavaScript',
    title: 'Empty Catch Block',
    category: 'QUAL',
    severity: 'LOW',
    scanRaw: false,
    regex: /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
    explanation:
      'Silently swallowing errors in empty catch blocks obscures runtime failures and makes asynchronous debugging extraordinarily difficult.',
    suggestedSnippet: 'catch (err) {\n  logger.warn("Operation failed:", err);\n}',
    remediation: 'Log caught errors or rethrow them with contextual application errors.'
  },
  {
    ruleId: 'QUAL-JS-002',
    name: 'Loose Equality Operator in JavaScript',
    title: 'Loose Equality Operator (== or !=)',
    category: 'QUAL',
    severity: 'LOW',
    scanRaw: false,
    regex: /(?:^|[^!=])==(?!=)|(?:^|[^!=])!=(?!=)/g,
    explanation:
      'Loose equality (== and !=) performs implicit type coercion, frequently leading to subtle logic errors and unexpected edge cases.',
    suggestedSnippet: 'a === b or a !== b',
    remediation: 'Use strict equality (=== and !==) to ensure both value and type match.'
  },
  {
    ruleId: 'RISK-JS-004',
    name: 'Insecure Cookie Configuration (secure: false)',
    title: 'Insecure Cookie Option (secure: false)',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /\bsecure\s*:\s*false\b/g,
    explanation:
      'Setting secure: false on session or authentication cookies allows cookies to be transmitted over unencrypted HTTP connections, exposing credentials to network interception.',
    suggestedSnippet: 'secure: process.env.NODE_ENV === "production"',
    remediation: 'Always set secure: true for sensitive cookies in production, or tie the flag to the production environment.'
  },
  {
    ruleId: 'QUAL-JS-003',
    name: 'Active Debugger Statement in JavaScript',
    title: 'Active Debugger Statement',
    category: 'QUAL',
    severity: 'LOW',
    scanRaw: false,
    regex: /\bdebugger\b\s*;?/g,
    explanation:
      'Active debugger statements left in code halt JavaScript execution when DevTools is open, impairing production performance and leaking internal state.',
    suggestedSnippet: '// Remove debugger statement',
    remediation: 'Remove all debugger; statements before committing or deploying code.'
  }
];

/**
 * Helper to determine if a match index is inside a JavaScript string literal or template literal
 * @param {string} text 
 * @param {number} index 
 * @returns {boolean}
 */
export function isInsideJsStringLiteral(text, index) {
  if (typeof text !== 'string' || index <= 0) return false;

  // 1. Check if inside unescaped backtick template literal
  const prefix = text.slice(0, index);
  const backtickCount = (prefix.match(/(?<!\\)`/g) || []).length;
  if (backtickCount % 2 !== 0) return true;

  // 2. Check if inside single or double quotes on current line
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  let lineBefore = text.slice(lineStart, index);
  // Strip closed template literals on this line so inner quotes don't skew counts
  lineBefore = lineBefore.replace(/(?<!\\)`[\s\S]*?(?<!\\)`/g, '');
  // Strip closed string literals
  lineBefore = lineBefore.replace(/(?<!\\)'(?:\\.|[^'])*?(?<!\\)'/g, '');
  lineBefore = lineBefore.replace(/(?<!\\)"(?:\\.|[^"])*?(?<!\\)"/g, '');
  const doubleQuotes = (lineBefore.match(/(?<!\\)"/g) || []).length;
  const singleQuotes = (lineBefore.match(/(?<!\\)'/g) || []).length;
  return doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0;
}

export default javascriptRules;
