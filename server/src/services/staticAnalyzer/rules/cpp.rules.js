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
    regex: /\b(?:strcpy|strcat)\s*\(/g,
    explanation:
      'Using legacy C-style string manipulation functions (strcpy, strcat) in C++ forfeits RAII memory safety and invites buffer overflows.',
    suggestedSnippet: 'std::string buf = input;',
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
    regex: /\b(?:std\s*::\s*)?(?:sprintf|vsprintf)\s*\(/g,
    explanation:
      'Using sprintf() or vsprintf() without bounds checking in C++ risks buffer overflow vulnerabilities. Bounded functions or modern formatting should be used.',
    suggestedSnippet: 'snprintf(buf, sizeof(buf), "%s", str.c_str());',
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
  }
];

export default cppRules;
