/**
 * Python Static Analysis Rules (Tier 2: Comment-Masked Lexical Scanning)
 */

export const pythonRules = [
  {
    ruleId: 'RISK-PY-001',
    name: 'Dynamic Code Execution in Python (eval/exec)',
    title: 'Dangerous Dynamic Execution (eval/exec)',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /\b(?:eval|exec)\s*\(/g,
    explanation:
      'Dynamic evaluation of expressions or statements via eval() or exec() can allow remote arbitrary code execution if user input is passed.',
    suggestedSnippet: 'ast.literal_eval(user_data)',
    remediation: 'Use ast.literal_eval() for parsing data structures or a dedicated mathematical expression evaluator.'
  },
  {
    ruleId: 'RISK-PY-002',
    name: 'Insecure Pickle Deserialization in Python',
    title: 'Insecure Object Deserialization (pickle)',
    category: 'RISK',
    severity: 'CRITICAL',
    scanRaw: false,
    regex: /(?:pickle|_pickle)\s*\.\s*(?:loads|load)\s*\(/g,
    explanation:
      'Deserializing untrusted data with pickle allows attackers to construct payloads that execute arbitrary code via __reduce__ hooks.',
    suggestedSnippet: 'json.loads(payload)',
    remediation: 'Avoid pickle for untrusted input. Use safe serialization formats such as JSON, Protocol Buffers, or msgpack.'
  },
  {
    ruleId: 'RISK-PY-003',
    name: 'Command Execution / Shell Injection in Python (os.system/subprocess)',
    title: 'Command Execution / Shell Injection (os.system/subprocess)',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex:
      /(?:subprocess\s*\.\s*(?:Popen|call|check_call|check_output|run)\s*\([^)]*shell\s*=\s*True|\bos\s*\.\s*(?:system|popen|spawn[lpe]*)\s*\()/g,
    matchFilter: (match, targetText) => !isInsidePythonStringLiteral(targetText, match.index),
    explanation:
      'Executing system commands via os.system(), os.popen(), or subprocess with shell=True spawns a system shell, exposing the application to command injection if unescaped variables are included.',
    suggestedSnippet: 'subprocess.run(["cmd", arg1, arg2], shell=False, check=True)',
    remediation:
      'Pass arguments as a sequence of strings and keep shell=False (the default) using subprocess.run(). Avoid os.system() and os.popen().'
  },
  {
    ruleId: 'QUAL-PY-001',
    name: 'Bare except: Exception Handler in Python',
    title: 'Bare Exception Handler',
    category: 'QUAL',
    severity: 'MEDIUM',
    scanRaw: false,
    regex: /(?:^|\n)\s*except\s*:\s*(?:\n|$)/g,
    explanation:
      'A bare except: clause catches all exceptions, including SystemExit and KeyboardInterrupt, preventing clean application shutdown and masking bugs.',
    suggestedSnippet: 'except Exception as e:',
    remediation: 'Catch specific exception types or use "except Exception as e:" to preserve system signals.'
  },
  {
    ruleId: 'QUAL-PY-002',
    name: 'Mutable Default Function Argument in Python',
    title: 'Mutable Default Function Argument',
    category: 'QUAL',
    severity: 'MEDIUM',
    scanRaw: false,
    regex: /def\s+\w+\s*\([^)]*=\s*(?:\[\]|\{\})/g,
    explanation:
      'Default arguments in Python are evaluated once at function definition time. Using mutable defaults (list or dict) shares state across calls.',
    suggestedSnippet: 'def func(items=None):\n    if items is None:\n        items = []',
    remediation: 'Use None as the default argument and initialize the mutable object inside the function body.'
  }
];

/**
 * Helper to determine if a match index is inside a Python string literal or docstring
 * @param {string} text 
 * @param {number} index 
 * @returns {boolean}
 */
export function isInsidePythonStringLiteral(text, index) {
  if (typeof text !== 'string' || index <= 0) return false;

  // 1. Check if inside triple quotes before index
  const prefix = text.slice(0, index);
  const tripleDoubleCount = (prefix.match(/"""/g) || []).length;
  if (tripleDoubleCount % 2 !== 0) return true;
  const tripleSingleCount = (prefix.match(/'''/g) || []).length;
  if (tripleSingleCount % 2 !== 0) return true;

  // 2. Check if inside single-line quotes on current line (after stripping closed triple quotes)
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  let lineBefore = text.slice(lineStart, index);
  lineBefore = lineBefore.replace(/"""[\s\S]*?"""/g, '').replace(/'''[\s\S]*?'''/g, '');
  const doubleQuotes = (lineBefore.match(/(?<!\\)"/g) || []).length;
  const singleQuotes = (lineBefore.match(/(?<!\\)'/g) || []).length;
  return doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0;
}

export default pythonRules;
