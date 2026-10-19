/**
 * Cryptographic Failures & Weak Randomness Static Analysis Rules
 * server/src/services/staticAnalyzer/rules/security/crypto.rules.js
 *
 * Covers:
 * - Broken Cryptographic Ciphers (DES / ECB mode) (CWE-327 / A02:2021-Cryptographic Failures)
 * - Weak Cryptographic Hash Algorithms (MD5 / SHA-1) (CWE-328 / A02:2021-Cryptographic Failures)
 * - Cryptographically Weak Pseudo-Random Number Generators (CWE-338 / A02:2021-Cryptographic Failures)
 */

export const cryptoRules = [
  {
    ruleId: 'SEC-JAV-CRY-001',
    name: 'Broken Cryptographic Cipher in Java (DES/ECB)',
    title: 'Broken Cryptographic Cipher (DES/ECB)',
    category: 'SEC',
    severity: 'HIGH',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    cwe: 'CWE-327',
    confidence: 'HIGH',
    languages: ['java'],
    scanRaw: false,
    regex: /Cipher\.getInstance\s*\(\s*["'](?:DES|AES\/ECB)[^"']*["']\)/g,
    explanation:
      'Using legacy DES or AES in Electronic Codebook (ECB) mode exposes plaintext patterns across blocks without cryptographic diffusion.',
    suggestedSnippet: 'Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");',
    remediation: 'Use authenticated encryption modes such as AES/GCM/NoPadding with a unique initialization vector.'
  },
  {
    ruleId: 'SEC-JAV-CRY-002',
    name: 'Weak Cryptographic Hash Algorithm in Java (MD5/SHA-1)',
    title: 'Weak Cryptographic Hash (MD5/SHA-1)',
    category: 'SEC',
    severity: 'MEDIUM',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    cwe: 'CWE-328',
    confidence: 'MEDIUM',
    languages: ['java'],
    scanRaw: false,
    regex: /MessageDigest\.getInstance\s*\(\s*["'](?:MD5|SHA-?1)["']\)/gi,
    explanation:
      'MD5 and SHA-1 suffer from practical collision vulnerabilities. Furthermore, fast general-purpose hashes like plain SHA-256 or MD5 must NEVER be used for passwords due to GPU brute-force feasibility.',
    suggestedSnippet:
      '// For passwords, use BCrypt or Argon2:\nString hashed = org.mindrot.jbcrypt.BCrypt.hashpw(password, org.mindrot.jbcrypt.BCrypt.gensalt(12));\n// For non-password data integrity:\nMessageDigest md = MessageDigest.getInstance("SHA-256");',
    remediation:
      'For password hashing, always use adaptive algorithms (bcrypt, Argon2, or scrypt) - never plain SHA-256. For data integrity verification (non-passwords), use SHA-256 or SHA-512.'
  },
  {
    ruleId: 'SEC-PY-CRY-001',
    name: 'Weak Cryptographic Hash Algorithm in Python (MD5/SHA1)',
    title: 'Weak Cryptographic Hash (MD5/SHA1)',
    category: 'SEC',
    severity: 'MEDIUM',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    cwe: 'CWE-328',
    confidence: 'MEDIUM',
    languages: ['python'],
    scanRaw: false,
    regex: /hashlib\s*\.\s*(?:md5|sha1)\s*\(/gi,
    explanation:
      'MD5 and SHA-1 have known collision vulnerabilities. Furthermore, fast general-purpose hashes like plain SHA-256 or MD5 must NEVER be used for password hashing, as GPUs can compute billions of hashes per second.',
    suggestedSnippet:
      '# For passwords, use adaptive salted hashing:\nimport bcrypt\nhashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12))\n# For non-password file/data integrity only:\n# import hashlib; digest = hashlib.sha256(data).hexdigest()',
    remediation:
      'For password storage, always use slow adaptive hashing algorithms with salt (bcrypt, Argon2, or hashlib.scrypt) - never plain SHA-256. For non-password data integrity, use hashlib.sha256().'
  },
  {
    ruleId: 'SEC-JS-CRY-001',
    name: 'Weak Cryptographic Hash Algorithm in JavaScript/TypeScript',
    title: 'Weak Cryptographic Hash (MD5/SHA1)',
    category: 'SEC',
    severity: 'MEDIUM',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    cwe: 'CWE-328',
    confidence: 'MEDIUM',
    languages: ['javascript', 'typescript'],
    scanRaw: false,
    regex: /crypto\s*\.\s*createHash\s*\(\s*["'](?:md5|sha1)["']\)/gi,
    explanation:
      'MD5 and SHA-1 are cryptographically broken algorithms susceptible to hash collision attacks. Furthermore, plain fast hashes must never be used for password storage.',
    suggestedSnippet:
      '// For passwords, use adaptive hashing:\nconst bcrypt = require("bcrypt");\nconst hash = await bcrypt.hash(password, 12);\n// For non-password data integrity:\n// const hash = crypto.createHash("sha256").update(data).digest("hex");',
    remediation:
      'For passwords, always use bcrypt, Argon2, or scrypt (never plain SHA-256). For non-password data integrity digests, use SHA-256 or SHA-512.'
  },
  {
    ruleId: 'SEC-PY-RNG-001',
    name: 'Insecure Pseudorandom Number Generator in Python (random)',
    title: 'Insecure Pseudorandom Generator (random)',
    category: 'SEC',
    severity: 'LOW',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    cwe: 'CWE-338',
    confidence: 'LOW',
    languages: ['python'],
    scanRaw: false,
    regex: /\brandom\s*\.\s*(?:random|randint|choice|randrange)\s*\(/g,
    explanation:
      'Standard Python random module uses the Mersenne Twister PRNG, which is completely predictable and insecure for security tokens or nonces.',
    suggestedSnippet: 'import secrets\ntoken = secrets.token_hex(32)',
    remediation: 'Use the standard library secrets module (e.g. secrets.token_hex) when generating security tokens or keys.'
  },
  {
    ruleId: 'SEC-JAV-RNG-001',
    name: 'Insecure Random Number Generator in Java (java.util.Random)',
    title: 'Insecure Random Number Generator (Random)',
    category: 'SEC',
    severity: 'LOW',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    cwe: 'CWE-338',
    confidence: 'LOW',
    languages: ['java'],
    scanRaw: false,
    regex: /new\s+Random\s*\(/g,
    explanation:
      'java.util.Random uses a linear congruential generator which produces predictable sequences unsuitable for security-sensitive tokens.',
    suggestedSnippet: 'SecureRandom sr = new SecureRandom();',
    remediation: 'Use java.security.SecureRandom for cryptographic tokens, nonces, and session identifiers.'
  },
  {
    ruleId: 'SEC-C-RNG-001',
    name: 'Insecure Weak PRNG in C/C++ (rand)',
    title: 'Insecure Weak PRNG (rand)',
    category: 'SEC',
    severity: 'LOW',
    owaspCategory: 'A02:2021-Cryptographic Failures',
    cwe: 'CWE-338',
    confidence: 'LOW',
    languages: ['c', 'cpp'],
    scanRaw: false,
    regex: /\brand\s*\(\s*\)/g,
    explanation:
      'The standard C rand() function generates a predictable sequence and has low entropy. It is not secure for cryptographic use.',
    suggestedSnippet: 'getrandom(buf, sizeof(buf), 0); // or arc4random()',
    remediation: 'Use getrandom() on Linux, arc4random() on BSD/macOS, or BCryptGenRandom on Windows.'
  }
];

export default cryptoRules;
