/**
 * Java Static Analysis Rules (Tier 2: Comment-Masked Lexical Scanning)
 */

export const javaRules = [
  {
    ruleId: 'SEC-JAV-001',
    name: 'Hardcoded JDBC Database Credentials in Java',
    title: 'Hardcoded JDBC Database Credentials',
    category: 'SEC',
    severity: 'HIGH',
    scanRaw: false,
    regex: /DriverManager\.getConnection\s*\([^)]*["'][^"']*password\s*=[^"']*["']/gi,
    explanation:
      'Embedding cleartext database passwords directly into JDBC connection strings risks credential exposure in version control.',
    suggestedSnippet: 'DriverManager.getConnection(System.getenv("DB_URL"), System.getenv("DB_USER"), System.getenv("DB_PASS"))',
    remediation: 'Extract database credentials into environment variables or a secure secret vault.'
  },
  {
    ruleId: 'RISK-JAV-001',
    name: 'SQL Injection via String Concatenation in Java',
    title: 'Unprepared SQL Statement Concatenation',
    category: 'RISK',
    severity: 'CRITICAL',
    scanRaw: false,
    regex: /(?:Statement|[a-zA-Z_]\w*)\s*\.\s*(?:executeQuery|executeUpdate|execute)\s*\(\s*(?:"[^"]*(?:SELECT|INSERT|UPDATE|DELETE)[^"]*"\s*\+|'[^']*(?:SELECT|INSERT|UPDATE|DELETE)[^']*'\s*\+)/gi,
    explanation:
      'Constructing SQL queries through dynamic string concatenation allows attackers to manipulate SQL semantics via SQL injection.',
    suggestedSnippet: 'PreparedStatement ps = conn.prepareStatement("SELECT * FROM accounts WHERE id = ?");\nps.setString(1, accountId);',
    remediation: 'Use parameterized queries with PreparedStatement or an ORM with automatic parameter binding.'
  },
  {
    ruleId: 'RISK-JAV-002',
    name: 'Insecure Java Object Deserialization',
    title: 'Insecure Object Deserialization (readObject)',
    category: 'RISK',
    severity: 'CRITICAL',
    scanRaw: false,
    regex: /(?:ObjectInputStream|[a-zA-Z_]\w*)\s*\.\s*readObject\s*\(/g,
    explanation:
      'Native Java deserialization via ObjectInputStream.readObject() on untrusted input can lead to arbitrary code execution through gadget chains.',
    suggestedSnippet: 'UserRecord record = objectMapper.readValue(stream, UserRecord.class);',
    remediation: 'Avoid native Java serialization. Use JSON, Protocol Buffers, or configure an ObjectInputFilter.'
  },
  {
    ruleId: 'RISK-JAV-003',
    name: 'Command Injection via Runtime.exec in Java',
    title: 'Command Injection via Runtime.exec',
    category: 'RISK',
    severity: 'CRITICAL',
    scanRaw: false,
    regex: /Runtime\.getRuntime\(\)\.exec\s*\(\s*(?:["'][^"']*["']\s*\+|[a-zA-Z_]\w*\s*\+)/g,
    explanation:
      'Passing dynamically concatenated strings to Runtime.exec() invokes system commands with user-controlled arguments, allowing command injection.',
    suggestedSnippet: 'ProcessBuilder pb = new ProcessBuilder("sh", "script.sh", userParam);',
    remediation: 'Use ProcessBuilder with an explicit string array of arguments to prevent argument injection.'
  },
  {
    ruleId: 'QUAL-JAV-001',
    name: 'Catching Throwable or Error in Java',
    title: 'Overly Broad Exception Handling (Throwable/Error)',
    category: 'QUAL',
    severity: 'MEDIUM',
    scanRaw: false,
    regex: /catch\s*\(\s*(?:Throwable|Error)\s+[a-zA-Z_]\w*\s*\)/g,
    explanation:
      'Catching Throwable or Error catches serious JVM internal conditions (e.g. OutOfMemoryError, StackOverflowError) that applications cannot safely handle.',
    suggestedSnippet: 'catch (Exception e)',
    remediation: 'Catch specific checked or runtime exceptions, or catch Exception rather than Throwable or Error.'
  },
  {
    ruleId: 'QUAL-JAV-002',
    name: 'Empty Catch Block in Java',
    title: 'Empty Catch Block',
    category: 'QUAL',
    severity: 'LOW',
    scanRaw: false,
    regex: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    explanation:
      'Silently suppressing exceptions without logging or handling hides operational failures and complicates root cause analysis.',
    suggestedSnippet: 'catch (IOException e) {\n    logger.warn("Operation failed", e);\n}',
    remediation: 'Log the exception or explain why it can be safely ignored in an informative comment.'
  },
  {
    ruleId: 'RISK-JAV-004',
    name: 'Potential Division by Zero in Java',
    title: 'Potential Division by Zero',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-369',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /(?:return\s+|[a-zA-Z_]\w*\s*=\s*)[^;\n/]+\/\s*([a-zA-Z_]\w*)\s*;|(?:\/|%|\/=|%=)\s*0+(?![0-9.])/g,
    explanation:
      'Performing integer division or modulo by zero produces an ArithmeticException in Java, terminating the executing thread and causing denial of service.',
    suggestedSnippet: (m) => {
      const divisor = m && m[1] ? m[1] : 'divisor';
      return `if (${divisor} == 0) throw new IllegalArgumentException("Divisor cannot be zero");\nreturn a / ${divisor};`;
    },
    remediation: 'Validate that the divisor operand is strictly non-zero before executing division or remainder calculations.',
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
    ruleId: 'RISK-JAV-005',
    name: 'Null Pointer Dereference in Java',
    title: 'Potential Null Pointer Dereference',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-476',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b([a-zA-Z_]\w*)\s*=\s*null\s*;[\s\S]*?\b\1\s*\.\s*([a-zA-Z_]\w*)|\bnull\s*\.\s*[a-zA-Z_]\w*/g,
    explanation:
      'Attempting to invoke methods or access fields on an object reference initialized or assigned to null throws NullPointerException at runtime.',
    suggestedSnippet: 'if (obj != null) {\n    obj.performAction();\n}',
    remediation: 'Use Optional<T>, perform explicit null checks, or apply null-safety annotations (@NonNull / @Nullable).',
    matchFilter: (match, targetText) => {
      if (isInsideStringLiteral(targetText, match.index)) return false;
      if (match[1]) {
        const varName = match[1];
        const matchText = match[0];
        const firstSemicolon = matchText.indexOf(';');
        const between = matchText.slice(firstSemicolon + 1);
        const reassignRegex = new RegExp(`\\b${varName}\\s*=\\s*(?!null\\b)`);
        if (reassignRegex.test(between)) return false;
        const guardRegex = new RegExp(`if\\s*\\([^)]*\\b${varName}\\s*!=\\s*null`);
        if (guardRegex.test(between)) return false;
      }
      return true;
    }
  },
  {
    ruleId: 'RISK-JAV-006',
    name: 'Unclosed I/O Resource or Stream in Java',
    title: 'Resource Leak / Unclosed I/O Stream',
    category: 'RISK',
    severity: 'HIGH',
    cwe: 'CWE-775',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(FileInputStream|FileOutputStream|FileReader|FileWriter|BufferedReader|BufferedWriter|Scanner|Socket|ServerSocket)\s+([a-zA-Z_]\w*)\s*=\s*new\s+\1\s*\([^;)]*\)\s*;/g,
    explanation:
      'Failing to release native operating system file descriptors or sockets via try-with-resources exhausts available handles, leading to I/O denial of service.',
    suggestedSnippet: (m) => {
      const type = m && m[1] ? m[1] : 'FileInputStream';
      const name = m && m[2] ? m[2] : 'fis';
      return `try (${type} ${name} = new ${type}("file.txt")) {\n    // Safely use ${name}\n}`;
    },
    remediation: 'Enclose AutoCloseable stream resources in a try-with-resources statement or ensure explicit closure in a finally block.',
    matchFilter: (match, targetText) => {
      if (isInsideStringLiteral(targetText, match.index)) return false;
      const lineStart = targetText.lastIndexOf('\n', match.index) + 1;
      const lineBefore = targetText.slice(lineStart, match.index);
      if (/try\s*\(/.test(lineBefore)) return false;
      const varName = match[2];
      const postText = targetText.slice(match.index + match[0].length);
      const closeRegex = new RegExp(`\\b${varName}\\s*\\.\\s*close\\s*\\(`);
      return !closeRegex.test(postText);
    }
  },
  {
    ruleId: 'RISK-JAV-007',
    name: 'Array Index Out of Bounds in Java',
    title: 'Array Index Out of Bounds',
    category: 'RISK',
    severity: 'CRITICAL',
    cwe: 'CWE-125',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /(?:int|byte|char|short|long|float|double|String|[a-zA-Z_]\w*)\s*\[\s*\]\s+([a-zA-Z_]\w*)\s*=\s*new\s+[a-zA-Z_]\w*\s*\[\s*(\d+)\s*\][\s\S]*?\b\1\s*\[\s*(-?\d+)\s*\]/g,
    explanation:
      'Accessing an array at an index outside its allocated bounds ([0, length - 1]) throws ArrayIndexOutOfBoundsException at runtime.',
    suggestedSnippet: 'if (index >= 0 && index < arr.length) {\n    int val = arr[index];\n}',
    remediation: 'Ensure array index expressions are validated against array.length before read or write access.',
    matchFilter: (match, targetText) => {
      if (isInsideStringLiteral(targetText, match.index)) return false;
      const size = parseInt(match[2], 10);
      const idx = parseInt(match[3], 10);
      return idx >= size || idx < 0;
    }
  },
  {
    ruleId: 'QUAL-JAV-003',
    name: 'Unconditional Infinite Loop in Java',
    title: 'Unconditional Infinite Loop',
    category: 'QUAL',
    severity: 'HIGH',
    cwe: 'CWE-835',
    owaspCategory: 'A04:2021-Insecure Design',
    confidence: 'HIGH',
    scanRaw: false,
    regex: /\b(?:while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\))\s*\{((?:(?!break|return|throw|System\.exit)[\s\S])*?)\}/g,
    explanation:
      'A loop with a condition fixed to true containing no exit statement (break, return, throw) runs indefinitely, freezing the thread.',
    suggestedSnippet: 'while (isRunning) {\n    if (shouldExit()) break;\n    processTask();\n}',
    remediation: 'Ensure loop termination criteria are evaluated or include break/return conditions.',
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

export default javaRules;
