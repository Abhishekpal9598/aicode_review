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
  }
];

export default cRules;
