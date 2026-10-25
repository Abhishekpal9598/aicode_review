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
  },
  {
    ruleId: 'RISK-PY-004',
    name: 'Potential Division by Zero in Python',
    title: 'Potential Division by Zero',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-369',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /(?:return\s+|[a-zA-Z_]\w*\s*=\s*)[^\n#/]+(?:\/|\/\/|%)\s*([a-zA-Z_]\w*)\b|(?:\/|\/\/|%|\/=|%=)\s*0+(?![0-9.])/g,
    explanation:
      'Division or modulo by zero raises ZeroDivisionError in Python, terminating process execution if unhandled.',
    suggestedSnippet: (m) => {
      const divisor = m && m[1] ? m[1] : 'divisor';
      return `if ${divisor} == 0:\n    raise ValueError("Divisor cannot be zero")\nreturn a / ${divisor}`;
    },
    remediation: 'Verify that denominator operands are non-zero before evaluating division or modulo operations.',
    matchFilter: (match, targetText) => {
      if (isInsidePythonStringLiteral(targetText, match.index)) return false;
      if (match[1]) {
        const divisor = match[1];
        const matchIndex = match.index;
        const lookback = targetText.slice(Math.max(0, matchIndex - 300), matchIndex);
        const guardRegex = new RegExp(`if\\s+(?:${divisor}\\s*(?:==|!=|<=|<|>)\\s*0|not\\s+${divisor}\\b|${divisor}\\b)`);
        if (guardRegex.test(lookback)) return false;
      }
      return true;
    }
  },
  {
    ruleId: 'RISK-PY-005',
    name: 'NoneType Attribute Access or Call in Python',
    title: 'Potential None Dereference / AttributeError',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-476',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b([a-zA-Z_]\w*)\s*=\s*None\b[\s\S]*?\b\1\s*(?:\.\s*[a-zA-Z_]\w*|\s*\([^)]*\))|\bNone\s*\.\s*[a-zA-Z_]\w*|\bNone\s*\(/g,
    explanation:
      'Attempting to access attributes or invoke methods on None raises AttributeError: \'NoneType\' object has no attribute or TypeError: \'NoneType\' object is not callable.',
    suggestedSnippet: 'if val is not None:\n    val.process()',
    remediation: 'Check that objects are not None using "if obj is not None:" before invoking methods or accessing attributes.',
    matchFilter: (match, targetText) => {
      if (isInsidePythonStringLiteral(targetText, match.index)) return false;
      if (match[1]) {
        const varName = match[1];
        const matchText = match[0];
        const firstEq = matchText.indexOf('=');
        const between = matchText.slice(firstEq + 5);
        const reassignRegex = new RegExp(`\\b${varName}\\s*=\\s*(?!None\\b)`);
        if (reassignRegex.test(between)) return false;
        const guardRegex = new RegExp(`if\\s+(?:${varName}\\s+is\\s+not\\s+None|${varName}\\b(?!\\s+is\\s+None))`);
        if (guardRegex.test(between)) return false;
      }
      return true;
    }
  },
  {
    ruleId: 'RISK-PY-006',
    name: 'Unclosed File Handle or Resource Leak in Python',
    title: 'Resource Leak / Unclosed File Handle',
    category: 'RISK',
    severity: 'MEDIUM',
    cwe: 'CWE-775',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /(?<!with\s+)\b([a-zA-Z_]\w*)\s*=\s*open\s*\([^)\n]+\)/g,
    explanation:
      'Opening files with open() without a "with" context manager or explicit close() leaks system file descriptors.',
    suggestedSnippet: 'with open("data.txt", "r") as f:\n    data = f.read()',
    remediation: 'Always use the "with open(...) as f:" context manager to ensure files are closed automatically.',
    matchFilter: (match, targetText) => {
      if (isInsidePythonStringLiteral(targetText, match.index)) return false;
      const lineStart = targetText.lastIndexOf('\n', match.index) + 1;
      const lineBefore = targetText.slice(lineStart, match.index);
      if (/with\s+/.test(lineBefore)) return false;
      const varName = match[1];
      const postText = targetText.slice(match.index + match[0].length);
      const closeRegex = new RegExp(`\\b${varName}\\s*\\.\\s*close\\s*\\(`);
      return !closeRegex.test(postText);
    }
  },
  {
    ruleId: 'RISK-PY-007',
    name: 'List Index Out of Bounds in Python',
    title: 'List Index Out of Bounds',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-125',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b([a-zA-Z_]\w*)\s*=\s*\[([^\]]*)\][\s\S]*?\b\1\s*\[\s*(-?\d+)\s*\]/g,
    explanation:
      'Accessing a list with a constant index equal to or greater than its declared item count raises IndexError at runtime.',
    suggestedSnippet: 'if index < len(items):\n    val = items[index]',
    remediation: 'Ensure index access is guarded against len(list) or handle IndexError appropriately.',
    matchFilter: (match, targetText) => {
      if (isInsidePythonStringLiteral(targetText, match.index)) return false;
      const rawItems = match[2].trim();
      const items = rawItems.length > 0 ? rawItems.split(',').map((s) => s.trim()) : [];
      const accessedIndex = parseInt(match[3], 10);
      if (items.length === 0) return true;
      if (accessedIndex >= items.length || accessedIndex < -items.length) return true;
      return false;
    }
  },
  {
    ruleId: 'QUAL-PY-003',
    name: 'Unconditional Infinite Loop in Python',
    title: 'Unconditional Infinite Loop',
    category: 'QUAL',
    severity: 'HIGH',
    cwe: 'CWE-835',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\bwhile\s+(?:True|1)\s*:((?:(?!break|return|raise|sys\.exit)[\s\S])*?)(?=\n\S|\n*$)/g,
    explanation:
      'A while True: loop containing no break, return, or raise statements executes forever, leading to CPU starvation and process hangs.',
    suggestedSnippet: 'while is_running:\n    if should_stop():\n        break\n    process_item()',
    remediation: 'Ensure loops terminate via state condition flags or explicit break/return statements.',
    matchFilter: (match, targetText) => {
      if (isInsidePythonStringLiteral(targetText, match.index)) return false;
      return true;
    }
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
