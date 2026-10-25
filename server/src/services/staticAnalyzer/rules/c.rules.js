/**
 * C Static Analysis Rules (Tier 2: Comment-Masked Lexical Scanning)
 */

export const cRules = [
  {
    ruleId: 'RISK-C-001',
    name: 'Buffer Overflow via strcpy in C',
    title: 'Unbounded String Copy (strcpy)',
    category: 'RISK',
    severity: 'CRITICAL',
    scanRaw: false,
    regex: /\bstrcpy\s*\(\s*([a-zA-Z_]\w*(?:\[[^\]]*\]|(?:\->|\.)[a-zA-Z_]\w*)*)\s*,\s*(.+?)\)\s*(?:;|$)/g,
    explanation:
      'strcpy() performs unbounded byte copies until a null terminator is reached, creating severe stack/heap buffer overflow vulnerabilities.',
    suggestedSnippet: (m) => {
      const dest = m && m[1] ? m[1] : 'dest';
      const src = m && m[2] ? m[2] : 'src';
      return `strncpy(${dest}, ${src}, sizeof(${dest}) - 1);\n${dest}[sizeof(${dest}) - 1] = '\\0';`;
    },
    remediation: 'Replace strcpy() with strncpy() or snprintf(), ensuring explicit null termination.'
  },
  {
    ruleId: 'RISK-C-002',
    name: 'Obsolete Dangerous Input Function in C (gets)',
    title: 'Obsolete Insecure Input Function (gets)',
    category: 'RISK',
    severity: 'CRITICAL',
    scanRaw: false,
    regex: /\bgets\s*\(\s*([a-zA-Z_]\w*(?:\[[^\]]*\]|(?:\->|\.)[a-zA-Z_]\w*)*)\s*\)/g,
    explanation:
      'gets() has no bounds checking and cannot be safely used. It was formally removed in ISO C11 due to universal buffer overflow hazards.',
    suggestedSnippet: (m) => {
      const target = m && m[1] ? m[1] : 'buf';
      return `fgets(${target}, sizeof(${target}), stdin);`;
    },
    remediation: 'Replace gets() with fgets() specifying the destination buffer capacity.'
  },
  {
    ruleId: 'RISK-C-003',
    name: 'Unbounded Formatted String Write in C (sprintf %s)',
    title: 'Unbounded Formatted Output (sprintf %s)',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /\bsprintf\s*\(\s*([a-zA-Z_]\w*(?:\[[^\]]*\]|(?:\->|\.)[a-zA-Z_]\w*)*)\s*,\s*(["'][^"']*%s[^"']*["'](?:\s*,\s*.+?)?)\)\s*(?:;|$)/g,
    explanation:
      'Using sprintf() with %s specifiers does not enforce destination bounds, leading to buffer overflows when formatting unexpected string lengths.',
    suggestedSnippet: (m) => {
      const dest = m && m[1] ? m[1] : 'out';
      const args = m && m[2] ? m[2] : '"Record: %s", userInput';
      return `snprintf(${dest}, sizeof(${dest}), ${args});`;
    },
    remediation: 'Use snprintf() and supply destination buffer capacity.'
  },
  {
    ruleId: 'RISK-C-004',
    name: 'Unbounded String Read in C (scanf %s)',
    title: 'Unbounded String Read (scanf %s)',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /\bscanf\s*\(\s*["'][^"']*%s[^"']*["'](?:\s*,\s*([a-zA-Z_]\w*(?:\[[^\]]*\]|(?:\->|\.)[a-zA-Z_]\w*)*))?\s*\)/g,
    explanation:
      'Using scanf() with an unconstrained %s specifier writes until whitespace without checking target array length.',
    suggestedSnippet: (m) => {
      const target = m && m[1] ? m[1] : 'name';
      return `fgets(${target}, sizeof(${target}), stdin);`;
    },
    remediation: 'Specify maximum field width in format specifiers (e.g. %31s) or use fgets().'
  },
  {
    ruleId: 'RISK-C-005',
    name: 'Shell Execution via system() in C',
    title: 'Shell Command Execution via system()',
    category: 'RISK',
    severity: 'HIGH',
    scanRaw: false,
    regex: /\bsystem\s*\(\s*(?:[a-zA-Z_]\w*|"[^"]*"\s*\+)/g,
    explanation:
      'Invoking system() executes commands through a shell interpreter, exposing the application to argument and command injection.',
    suggestedSnippet: 'execvp(args[0], args);',
    remediation: 'Use execvp() or fork()/execve() without shell expansion.'
  },
  {
    ruleId: 'RISK-C-006',
    name: 'Potential Division by Zero in C',
    title: 'Potential Division by Zero',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-369',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /(?:return\s+|[a-zA-Z_]\w*\s*=\s*)[^;\n/]+\/\s*([a-zA-Z_]\w*)\s*;|(?:\/|%|\/=|%=)\s*0+(?![0-9.])/g,
    explanation:
      'Division or modulo by zero in C triggers undefined behavior, resulting in a SIGFPE signal and abnormal crash.',
    suggestedSnippet: (m) => {
      const divisor = m && m[1] ? m[1] : 'divisor';
      return `if (${divisor} == 0) return -1;\nreturn a / ${divisor};`;
    },
    remediation: 'Validate that the divisor operand is non-zero before performing division or modulo operations.',
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
    ruleId: 'RISK-C-007',
    name: 'Null Pointer Dereference in C',
    title: 'Potential Null Pointer Dereference',
    category: 'RISK',
    severity: 'CRITICAL',
    cwe: 'CWE-476',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b([a-zA-Z_]\w*)\s*=\s*NULL\s*;[\s\S]*?(?:\*\s*\1\b|\b\1\s*->\s*[a-zA-Z_]\w*)/g,
    explanation:
      'Dereferencing a pointer initialized to or holding NULL causes segmentation faults and application crashes.',
    suggestedSnippet: 'if (ptr != NULL) {\n    *ptr = value;\n}',
    remediation: 'Check pointers for NULL before dereferencing via *ptr or ptr->member.',
    matchFilter: (match, targetText) => {
      if (isInsideStringLiteral(targetText, match.index)) return false;
      const varName = match[1];
      const matchText = match[0];
      const firstSemicolon = matchText.indexOf(';');
      const between = matchText.slice(firstSemicolon + 1);
      const reassignRegex = new RegExp(`\\b${varName}\\s*=\\s*(?!NULL\\b)`);
      if (reassignRegex.test(between)) return false;
      const guardRegex = new RegExp(`if\\s*\\([^)]*\\b${varName}\\s*!=\\s*NULL`);
      if (guardRegex.test(between)) return false;
      return true;
    }
  },
  {
    ruleId: 'RISK-C-008',
    name: 'Resource Leak via Unclosed FILE Pointer in C',
    title: 'Resource Leak / Unclosed File Descriptor',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-775',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\bFILE\s*\*\s*([a-zA-Z_]\w*)\s*=\s*fopen\s*\([^;)]*\)\s*;/g,
    explanation:
      'Failing to call fclose() on a FILE* pointer leaks file descriptors and operating system resources.',
    suggestedSnippet: (m) => {
      const name = m && m[1] ? m[1] : 'fp';
      return `FILE *${name} = fopen("file.txt", "r");\nif (${name}) {\n    // Use file\n    fclose(${name});\n}`;
    },
    remediation: 'Always close opened files with fclose() once operations are finished.',
    matchFilter: (match, targetText) => {
      if (isInsideStringLiteral(targetText, match.index)) return false;
      const varName = match[1];
      const postText = targetText.slice(match.index + match[0].length);
      const closeRegex = new RegExp(`\\bfclose\\s*\\(\\s*${varName}\\s*\\)`);
      return !closeRegex.test(postText);
    }
  },
  {
    ruleId: 'RISK-C-009',
    name: 'Array Index Out of Bounds in C',
    title: 'Array Index Out of Bounds',
    category: 'RISK',
    severity: 'CRITICAL',
    cwe: 'CWE-125',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(?:int|char|float|double|long|short|unsigned|uint\d+_t|int\d+_t)\s+([a-zA-Z_]\w*)\s*\[\s*(\d+)\s*\][\s\S]*?\b\1\s*\[\s*(-?\d+)\s*\]/g,
    explanation:
      'Reading or writing an array at a constant index beyond its allocated size causes buffer overflow or memory corruption.',
    suggestedSnippet: 'if (idx >= 0 && idx < MAX_SIZE) {\n    arr[idx] = val;\n}',
    remediation: 'Verify array indices are strictly within [0, size - 1].',
    matchFilter: (match, targetText) => {
      if (isInsideStringLiteral(targetText, match.index)) return false;
      const size = parseInt(match[2], 10);
      const idx = parseInt(match[3], 10);
      return idx >= size || idx < 0;
    }
  },
  {
    ruleId: 'RISK-C-010',
    name: 'Use of Uninitialized Variable in C',
    title: 'Use of Uninitialized Variable',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-457',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(?:int|float|double|char|long|short|unsigned)\s+([a-zA-Z_]\w*)\s*;[\s\S]*?(?:printf\s*\(|return|\+|\-|\*|\/|=)\s*[^;]*?\b\1\b/g,
    explanation:
      'Reading a primitive variable before assigning it a value accesses indeterminate stack garbage, creating unpredictable program states.',
    suggestedSnippet: (m) => {
      const name = m && m[1] ? m[1] : 'val';
      return `int ${name} = 0;`;
    },
    remediation: 'Initialize variables at the point of declaration.',
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
    ruleId: 'QUAL-C-001',
    name: 'Unconditional Infinite Loop in C',
    title: 'Unconditional Infinite Loop',
    category: 'QUAL',
    severity: 'HIGH',
    cwe: 'CWE-835',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(?:while\s*\(\s*1\s*\)|for\s*\(\s*;\s*;\s*\))\s*\{((?:(?!break|return|exit|goto)[\s\S])*?)\}/g,
    explanation:
      'A loop with condition 1 that contains no break, return, exit, or goto statements never terminates, freezing program execution.',
    suggestedSnippet: 'while (running) {\n    if (should_stop()) break;\n    process();\n}',
    remediation: 'Provide an exit condition or break statement inside the loop body.',
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

export default cRules;
