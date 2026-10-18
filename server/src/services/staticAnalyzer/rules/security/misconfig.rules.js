/**
 * Security Misconfiguration & Authentication Static Analysis Rules
 * server/src/services/staticAnalyzer/rules/security/misconfig.rules.js
 *
 * Covers:
 * - Active Debug Code in Production (CWE-489 / A05:2021-Security Misconfiguration)
 * - Sensitive Cookie Without 'Secure' Attribute (CWE-614 / A05:2021-Security Misconfiguration)
 * - Sensitive Cookie Without 'HttpOnly' Flag (CWE-1004 / A05:2021-Security Misconfiguration)
 * - Permissive Cross-Domain Policy / CORS (CWE-942 / A05:2021-Security Misconfiguration)
 * - Disabled TLS Certificate Verification (CWE-295 / A05:2021-Security Misconfiguration)
 * - XML External Entity (XXE) Injection (CWE-611 / A05:2021-Security Misconfiguration)
 * - Hardcoded Database Credentials (CWE-798 / A07:2021-Identification and Authentication Failures)
 */

export const misconfigRules = [
  {
    ruleId: 'SEC-PY-DBG-001',
    name: 'Active Debug Code in Production in Python',
    title: 'Active Debug Mode Enabled',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    cwe: 'CWE-489',
    confidence: 'MEDIUM',
    languages: ['python'],
    scanRaw: false,
    regex: /(?:DEBUG\s*=\s*True|app\.run\([^)]*debug\s*=\s*True)/g,
    explanation:
      'Running web frameworks with debug=True enables interactive debuggers and verbose stack traces, leaking internal application state and secrets.',
    suggestedSnippet: 'DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"',
    remediation: 'Bind debug flags to environment variables and enforce debug=False in production.'
  },
  {
    ruleId: 'SEC-JS-COOKIE-001',
    name: 'Cookie Without Secure Attribute in JavaScript/TypeScript',
    title: 'Cookie Missing Secure Flag (secure: false)',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    cwe: 'CWE-614',
    confidence: 'HIGH',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /\bsecure\s*:\s*false\b/g,
    explanation:
      'Setting secure: false on session or authentication cookies allows them to be transmitted over unencrypted HTTP, exposing sessions to network interception.',
    suggestedSnippet: 'secure: process.env.NODE_ENV === "production"',
    remediation: 'Always set secure: true for sensitive cookies in production environments.'
  },
  {
    ruleId: 'SEC-JS-COOKIE-002',
    name: 'Sensitive Cookie Missing HttpOnly Flag in JavaScript/TypeScript',
    title: 'Cookie Missing HttpOnly Flag (httpOnly: false)',
    category: 'SEC',
    severity: 'MEDIUM',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    cwe: 'CWE-1004',
    confidence: 'MEDIUM',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /\bhttpOnly\s*:\s*false\b/g,
    explanation:
      'Setting httpOnly: false allows client-side scripts to read the cookie via document.cookie, exposing sessions to theft via XSS.',
    suggestedSnippet: 'httpOnly: true',
    remediation: 'Set httpOnly: true for session cookies so client-side JavaScript cannot read them.'
  },
  {
    ruleId: 'SEC-JS-CORS-001',
    name: 'Permissive Cross-Domain Policy with Credentials in JavaScript/TypeScript',
    title: 'Permissive CORS Configuration',
    category: 'SEC',
    severity: 'MEDIUM',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    cwe: 'CWE-942',
    confidence: 'HIGH',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /origin\s*:\s*(?:true|["']\*["'])\s*,\s*credentials\s*:\s*true/g,
    explanation:
      'Combining wildcard or reflection CORS origins with credentials: true allows arbitrary third-party websites to make authenticated cross-origin requests.',
    suggestedSnippet: 'origin: ["https://trusted.example.com"], credentials: true',
    remediation: 'Configure an explicit allowlist of trusted origin domains when credentials are enabled.'
  },
  {
    ruleId: 'SEC-JS-TLS-001',
    name: 'TLS Certificate Verification Disabled in JavaScript/TypeScript',
    title: 'TLS Certificate Validation Disabled',
    category: 'SEC',
    severity: 'CRITICAL',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    cwe: 'CWE-295',
    confidence: 'HIGH',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /rejectUnauthorized\s*:\s*false/g,
    explanation:
      'Setting rejectUnauthorized: false disables SSL/TLS certificate verification, opening HTTPS connections to trivial man-in-the-middle attacks.',
    suggestedSnippet: 'rejectUnauthorized: true',
    remediation: 'Always verify TLS certificates in production. Install custom CA certificates if internal certificates are required.'
  },
  {
    ruleId: 'SEC-JAV-XXE-001',
    name: 'XML External Entity (XXE) Injection in Java',
    title: 'XML External Entity Injection (XXE)',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A05:2021-Security Misconfiguration',
    cwe: 'CWE-611',
    confidence: 'MEDIUM',
    languages: ['java'],
    scanRaw: false,
    regex: /DocumentBuilderFactory\s*\.\s*newInstance\s*\(\s*\)/g,
    explanation:
      'Standard DocumentBuilderFactory instances parse external entities by default, exposing the server to local file disclosures and SSRF.',
    suggestedSnippet: 'DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();\ndbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);',
    remediation: 'Disable external entity declarations (DOCTYPE) using explicit secure parser features.'
  },
  {
    ruleId: 'SEC-JAV-CRED-001',
    name: 'Hardcoded JDBC Database Credentials in Java',
    title: 'Hardcoded JDBC Database Credentials',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A07:2021-Identification and Authentication Failures',
    cwe: 'CWE-798',
    confidence: 'HIGH',
    languages: ['java'],
    scanRaw: false,
    regex: /DriverManager\.getConnection\s*\([^)]*["'][^"']*password\s*=[^"']*["']/gi,
    explanation:
      'Embedding cleartext database passwords directly into JDBC connection strings risks credential exposure in version control.',
    suggestedSnippet: 'DriverManager.getConnection(System.getenv("DB_URL"), System.getenv("DB_USER"), System.getenv("DB_PASS"))',
    remediation: 'Extract database credentials into environment variables or a secure secrets manager.'
  }
];

export default misconfigRules;
