/**
 * Universal Shared Secret Detection Rules (Tier 1: Raw Content Scanning)
 * Scans for hardcoded credentials, access tokens, private keys, and JWTs.
 * Executes on raw source code to catch credentials even inside comments.
 */

export const secretRules = [
  {
    ruleId: 'SEC-GEN-001',
    name: 'Hardcoded AWS Access Key ID',
    title: 'Hardcoded AWS Access Key ID',
    category: 'SEC',
    severity: 'CRITICAL',
    scanRaw: true,
    regex: /(?:["']|^|\s)(AKIA[0-9A-Z]{16})(?:["']|$|\s)/g,
    explanation:
      'Hardcoded AWS Access Key IDs expose cloud infrastructure to automated scrapers and unauthorized access. Store keys in IAM roles or environment variables.',
    suggestedSnippet: 'os.environ.get("AWS_ACCESS_KEY_ID") || process.env.AWS_ACCESS_KEY_ID',
    remediation: 'Remove AWS key and inject via environment variables or cloud identity roles.'
  },
  {
    ruleId: 'SEC-GEN-002',
    name: 'Hardcoded GitHub Personal Access Token',
    title: 'Hardcoded GitHub Personal Access Token',
    category: 'SEC',
    severity: 'HIGH',
    scanRaw: true,
    regex: /(?:["']|^|\s)(ghp_[A-Za-z0-9_]{36})(?:["']|$|\s)/g,
    explanation:
      'Hardcoded GitHub Personal Access Tokens (classic tokens) grant automated repository and organization access if leaked.',
    suggestedSnippet: 'process.env.GITHUB_TOKEN || os.environ.get("GITHUB_TOKEN")',
    remediation: 'Revoke the exposed token and inject credentials through GitHub Secrets or environment variables.'
  },
  {
    ruleId: 'SEC-GEN-003',
    name: 'Hardcoded Private Key Block',
    title: 'Hardcoded Private Key Block',
    category: 'SEC',
    severity: 'CRITICAL',
    scanRaw: true,
    regex: /-----BEGIN\s+[A-Z\s]*PRIVATE\s+KEY-----/g,
    explanation:
      'Cryptographic private keys embedded in source code allow adversaries to decrypt communications, forge authentication tokens, or impersonate services.',
    suggestedSnippet: 'fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8")',
    remediation: 'Store private keys on disk with restrictive permissions (e.g. chmod 600) or in a key management service.'
  },
  {
    ruleId: 'SEC-GEN-004',
    name: 'Hardcoded JSON Web Token',
    title: 'Hardcoded JSON Web Token',
    category: 'SEC',
    severity: 'HIGH',
    scanRaw: true,
    regex: /(?:["']|^|\s|Bearer\s+)(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/gi,
    explanation:
      'Hardcoded JWTs in source code grant static sessions that cannot be cleanly rotated without re-deploying code.',
    suggestedSnippet: 'req.headers.authorization',
    remediation: 'Obtain JWT dynamically via authentication endpoints or request headers.'
  },
  {
    ruleId: 'SEC-GEN-005',
    name: 'Cleartext Generic Credential Assignment',
    title: 'Cleartext Generic Credential Assignment',
    category: 'SEC',
    severity: 'HIGH',
    scanRaw: true,
    regex: /(?:api[_-]?key|secret[_-]?token|auth[_-]?token|db[_-]?password|password)\s*[:=]\s*["']([^"'\r\n]{8,})["']/gi,
    explanation:
      'Cleartext passwords and secret tokens assigned in source files can easily be checked into version control.',
    suggestedSnippet: 'apiKey = process.env.API_KEY || os.environ.get("API_KEY")',
    remediation: 'Replace hardcoded credential strings with environment variable lookups.'
  }
];

export default secretRules;
