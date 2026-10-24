/**
 * C++ Static Analysis Rules (Tier 2: Comment-Masked Lexical Scanning)
 */

export const cppRules = [
  {
    ruleId: 'RISK-CPP-001',
    name: 'C-style Buffer Copy in C++ (strcpy/strcat)',
    title: 'Unsafe C-style String Copy in C++',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /\b(?:strcpy|strcat)\s*\(\s*([a-zA-Z_]\w*(?:\[[^\]]*\]|(?:\->|\.)[a-zA-Z_]\w*)*)\s*,\s*(.+?)\)\s*(?:;|$)/g,
    explanation:
      'Using legacy C-style string manipulation functions (strcpy, strcat) in C++ forfeits RAII memory safety and invites buffer overflows.',
    suggestedSnippet: (m) => {
      const dest = m && m[1] ? m[1] : 'buf';
      const src = m && m[2] ? m[2] : 'input';
      return `std::string ${dest} = ${src};`;
    },
    remediation: 'Use std::string or std::string_view instead of raw char pointers and legacy C copy routines.'
  },
  {
    ruleId: 'RISK-CPP-002',
    name: 'Command Injection via std::system in C++',
    title: 'Command Injection via std::system',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /(?:std\s*::\s*)?system\s*\([^)]*(?:\+|c_str)/g,
    explanation:
      'Invoking std::system() with dynamic strings or c_str() conversions executes a system shell with user-supplied arguments, allowing command injection.',
    suggestedSnippet: 'std::filesystem::remove_all(path);',
    remediation: 'Use C++17 std::filesystem APIs or fork/exec without invoking a shell.'
  },
  {
    ruleId: 'RISK-CPP-003',
    name: 'Dangerous Formatted Output in C++ (sprintf/vsprintf)',
    title: 'Unsafe Formatted Output (sprintf/vsprintf)',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /\b(?:std\s*::\s*)?(?:sprintf|vsprintf)\s*\(\s*([a-zA-Z_]\w*(?:\[[^\]]*\]|(?:\->|\.)[a-zA-Z_]\w*)*)\s*,\s*(.+?)\)\s*(?:;|$)/g,
    explanation:
      'Using sprintf() or vsprintf() without bounds checking in C++ risks buffer overflow vulnerabilities. Bounded functions or modern formatting should be used.',
    suggestedSnippet: (m) => {
      const dest = m && m[1] ? m[1] : 'buf';
      const args = m && m[2] ? m[2] : '"%s", str.c_str()';
      return `snprintf(${dest}, sizeof(${dest}), ${args});`;
    },
    remediation: 'Use snprintf() with destination capacity bounds, std::ostringstream, or C++20 std::format.'
  },
  {
    ruleId: 'QUAL-CPP-001',
    name: 'C-Style Type Cast in C++',
    title: 'C-Style Type Cast',
    category: 'QUAL',
    severity: 'LOW',
    scanRaw: false,
    regex: /\((?:int|char|float|double|long|short|void|bool|unsigned|size_t)\s*\*?\)\s*[a-zA-Z_]\w*/g,
    explanation:
      'C-style type casts bypass C++ compile-time type safety checks and can silently perform dangerous reinterpretations or strip const qualifiers.',
    suggestedSnippet: 'static_cast<TargetType>(variable)',
    remediation: 'Replace C-style casts with explicit C++ cast operators: static_cast, reinterpret_cast, or const_cast.'
  },
  {
    ruleId: 'QUAL-CPP-002',
    name: 'Empty Catch-All Handler in C++ (catch (...))',
    title: 'Empty Catch-All Exception Handler',
    category: 'QUAL',
    severity: 'LOW',
    scanRaw: false,
    regex: /catch\s*\(\s*\.\.\.\s*\)\s*\{\s*\}/g,
    explanation:
      'A catch (...) block swallows all C++ exceptions without logging or inspection, preventing diagnoses of crashes and memory failures.',
    suggestedSnippet: 'catch (const std::exception& e) {\n    std::cerr << "Exception: " << e.what() << std::endl;\n}',
    remediation: 'Catch const std::exception& and log e.what(), or rethrow via "throw;".'
  },
  {
    ruleId: 'RISK-CPP-004',
    name: 'Potential Division by Zero in C++',
    title: 'Potential Division by Zero',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-369',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /(?:return\s+|[a-zA-Z_]\w*\s*=\s*)[^;\n/]+\/\s*([a-zA-Z_]\w*)\s*;|(?:\/|%|\/=|%=)\s*0+(?![0-9.])/g,
    explanation:
      'Division or modulo operation performed without validating that the divisor is non-zero, or explicit division by zero. In C/C++, integer division by zero is undefined behavior and produces a critical SIGFPE hardware fault.',
    suggestedSnippet: (m) => {
      const divisor = m && m[1] ? m[1] : 'b';
      return `if (${divisor} == 0) throw std::invalid_argument("Division by zero");\nreturn a / ${divisor};`;
    },
    remediation:
      'Always validate that the divisor operand is non-zero before performing division or modulo operations.',
    matchFilter: (match, targetText) => {
      const slashOffset = match[0].indexOf('/');
      const slashIndex = slashOffset !== -1 ? match.index + slashOffset : match.index;
      if (isInsideStringLiteral(targetText, slashIndex)) return false;
      if (match[1]) {
        const divisor = match[1];
        const matchIndex = match.index;
        const lookback = targetText.slice(Math.max(0, matchIndex - 300), matchIndex);
        const guardRegex = new RegExp(`(?:\\b${divisor}\\s*(?:==|!=|<=|<|>)\\s*0|!\\s*${divisor}\\b)`);
        if (guardRegex.test(lookback)) return false;
      }
      return true;
    }
  },
  {
    ruleId: 'RISK-CPP-005',
    name: 'Array Index Out of Bounds in C++',
    title: 'Array Index Out of Bounds',
    category: 'RISK',
    severity: 'CRITICAL',
    cwe: 'CWE-125',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(?:int|char|float|double|long|short|bool|size_t|auto|uint\d+_t|int\d+_t)\s+([a-zA-Z_]\w*)\s*\[\s*(\d+)\s*\][\s\S]*?\b\1\s*\[\s*(\d+)\s*\]/g,
    explanation:
      'Accessing an array with a constant index equal to or greater than its declared size (or negative index) constitutes an out-of-bounds memory read or write, causing memory corruption or segmentation faults.',
    suggestedSnippet: 'if (index >= 0 && index < 5) cout << arr[index];',
    remediation:
      'Verify array indices are strictly within [0, size - 1]. Prefer std::array or std::vector with .at() for bounds checking.',
    matchFilter: (match, targetText) => {
      if (isInsideStringLiteral(targetText, match.index)) return false;
      const declaredSize = parseInt(match[2], 10);
      const accessedIndex = parseInt(match[3], 10);
      return accessedIndex >= declaredSize || accessedIndex < 0;
    }
  },
  {
    ruleId: 'RISK-CPP-006',
    name: 'Use of Uninitialized Variable in C++',
    title: 'Use of Uninitialized Variable',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-457',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(?:int|float|double|char|long|short|bool|size_t)\s+([a-zA-Z_]\w*)\s*;[\s\S]*?(?:cout\s*<<|return|\bcin\b|\+|\-|\*|\/|=)\s*[^;]*?\b\1\b/g,
    explanation:
      'Reading a local primitive variable that has not been initialized or assigned undefined indeterminate memory contents, leading to undefined behavior and logic bugs.',
    suggestedSnippet: (m) => {
      const varName = m && m[1] ? m[1] : 'result';
      return `${varName} = 0; // Initialize ${varName}`;
    },
    remediation:
      'Always initialize local variables when declaring them (e.g. "int result = 0;").',
    matchFilter: (match, targetText) => {
      if (isInsideStringLiteral(targetText, match.index)) return false;
      const varName = match[1];
      const matchText = match[0];
      const firstSemicolon = matchText.indexOf(';');
      const between = matchText.slice(firstSemicolon + 1);
      const assignRegex = new RegExp(`\\b${varName}\\s*=(?!=)`);
      return !assignRegex.test(between);
    }
  },
  {
    ruleId: 'QUAL-CPP-003',
    name: 'Unconditional Infinite Loop in C++',
    title: 'Unconditional Infinite Loop',
    category: 'QUAL',
    severity: 'HIGH',
    cwe: 'CWE-835',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(?:while\s*\(\s*(?:true|1)\s*\)|for\s*\(\s*;\s*;\s*\))\s*\{((?:(?!break|return|throw|exit|goto)[\s\S])*?)\}/g,
    explanation:
      'A loop condition fixed to true or 1 that contains no exit path (break, return, throw, exit, goto) runs forever, freezing the thread and exhausting CPU resources.',
    suggestedSnippet: 'while (isRunning) {\n    if (shouldStop()) break;\n    cout << "Running..." << endl;\n}',
    remediation:
      'Include an exit condition or break/return statement inside the loop.',
    matchFilter: (match, targetText) => {
      if (isInsideStringLiteral(targetText, match.index)) return false;
      return true;
    }
  }
];

function isInsideStringLiteral(text, index) {
  if (typeof text !== 'string' || index <= 0) return false;
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const lineBefore = text.slice(lineStart, index);
  const quotes = (lineBefore.match(/(?<!\\)"/g) || []).length;
  return quotes % 2 !== 0;
}

export default cppRules;
