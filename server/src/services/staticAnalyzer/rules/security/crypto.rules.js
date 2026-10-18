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
      'MD5 and SHA-1 suffer from practical collision vulnerabilities and must not be used in digital signatures or security verification.',
    suggestedSnippet: 'MessageDigest md = MessageDigest.getInstance("SHA-256");',
    remediation: 'Use SHA-256 or SHA-512 for cryptographic integrity, or bcrypt/Argon2 for passwords.'
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
      'MD5 and SHA-1 have known collision vulnerabilities. Do not use them for password storage, security tokens, or integrity proofs.',
    suggestedSnippet: 'hashlib.sha256(data).hexdigest()',
    remediation: 'Use hashlib.sha256() for cryptographic hashing or bcrypt/hashlib.scrypt() for credential hashing.'
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
      'MD5 and SHA-1 are cryptographically broken algorithms susceptible to hash collision attacks.',
    suggestedSnippet: 'crypto.createHash("sha256").update(data).digest("hex")',
    remediation: 'Use SHA-256 or SHA-512 for digest calculation, and bcrypt/Argon2 for password verification.'
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
