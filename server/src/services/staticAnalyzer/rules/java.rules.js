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
  }
];

export default javaRules;
