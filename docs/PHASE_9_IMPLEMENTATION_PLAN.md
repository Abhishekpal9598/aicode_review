# Phase 9 Implementation Plan: Comprehensive OWASP Security Analysis Engine
## Authoritative Technical Specification & Execution Roadmap — Revision 2.1.0

---

## Document Metadata & Revision History
- **Project**: AI Code Review — Intelligent AI-Powered Code Analysis & Review Platform
- **Phase**: Phase 9 — Comprehensive OWASP Security Analysis Engine
- **Specification Version**: 2.1.0 (Final Architecture Review & Validation)
- **Status**: Planning Stage — Awaiting User Approval Before Implementation
- **Author**: Antigravity Assistant (Principal Security Architect, Static Analysis Engineer, Full-Stack Reviewer)
- **Date**: October 2026
- **Target Supported Languages**: C, C++, Java, Python, JavaScript, TypeScript
- **Target Backend Service**: `server/src/services/staticAnalyzer/`, `server/src/services/review.service.js`, `server/src/controllers/review.controller.js`
- **Target API Endpoints**:
  - `POST /api/v1/reviews` (Enriched Dual-Engine Security Scanning & Deduplicated Persistence)
  - `GET /api/v1/reviews/:id/security` (Isolated Security Vulnerability Deep Dive)
- **Target Frontend Views**: `client/src/components/editor/FindingsPanel.jsx`, `client/src/pages/CodeReview.jsx`

### Revision History
| Revision | Date | Author | Summary of Changes |
|---|---|---|---|
| **1.0.0** | October 2026 | Antigravity Assistant | Initial Phase 9 design across 19 sections covering OWASP Top 10, static rule expansion, Gemini integration, and security endpoint. |
| **2.0.0** | October 2026 | Antigravity Assistant | Corrected multiple-critical ceiling to $\le 39$ for Grade F; established 4-tier confidence; audited Mongoose models; specified multi-factor hybrid fusion; bounded static analysis and dependency claims. |
| **2.1.0** | October 2026 | Antigravity Assistant | **Final Review Revision**: <br>1. *CWE Mapping Rigor*: Replaced generic CWE-1104 for dynamic imports with authentic **CWE-470** (Unsafe Reflection); restricted CWE-829 strictly to untrusted sphere inclusion; assigned **CWE-120** to classic unchecked buffer copies; assigned **CWE-942** to permissive CORS; segregated **CWE-614** (missing Secure flag) and **CWE-1004** (missing HttpOnly flag); assigned **CWE-489** to active debug code.<br>2. *Complete Confidence Lifecycle*: Fully documented static rule metadata origin, strict Gemini Zod validation, deterministic hybrid fusion policy, and explicitly identified the deferred `confidence` schema extension for `ReviewIssue` (no false claims of persistence without schema change).<br>3. *Multiple-Critical Ceiling Policy*: Kept proposed multiple-Critical ceiling ($\le 39$) **disabled by default** as an optional enhancement; preserved Phase 8 single-Critical ceiling ($\le 74$), hybrid scoring formula, and grade boundaries; enforced that only distinct validated Critical security findings count toward the policy.<br>4. *Final Architecture Validation*: Verified all 19 required sections, zero CVE database claims, zero unapproved scoring or schema modifications. |

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Scope and Non-Goals](#2-scope-and-non-goals)
3. [OWASP Mapping Matrix](#3-owasp-mapping-matrix)
4. [Vulnerability Categories and Detection Strategy](#4-vulnerability-categories-and-detection-strategy)
5. [Language-Specific Detection Rules](#5-language-specific-detection-rules)
6. [Static Analysis Architecture & Limitations](#6-static-analysis-architecture--limitations)
7. [Gemini Semantic Analysis Integration](#7-gemini-semantic-analysis-integration)
8. [Finding Schema and Severity Mapping](#8-finding-schema-and-severity-mapping)
9. [False Positive Reduction & Confidence Lifecycle](#9-false-positive-reduction--confidence-lifecycle)
10. [Duplicate Finding Prevention & Multi-Factor Hybrid Fusion](#10-duplicate-finding-prevention--multi-factor-hybrid-fusion)
11. [API and Backend Integration Design](#11-api-and-backend-integration-design)
12. [Database Schema Compatibility & Persistence Impact](#12-database-schema-compatibility--persistence-impact)
13. [Frontend FindingsPanel Integration](#13-frontend-findingspanel-integration)
14. [Security and Privacy Requirements](#14-security-and-privacy-requirements)
15. [Testing Strategy](#15-testing-strategy)
16. [Performance Considerations](#16-performance-considerations)
17. [Implementation Steps](#17-implementation-steps)
18. [Acceptance Criteria](#18-acceptance-criteria)
19. [Risks and Limitations](#19-risks-and-limitations)

---

## 1. Executive Summary

Phase 9 establishes an enterprise-grade, dual-layer security vulnerability analysis engine for the AI Code Review platform. It extends the Phase 7 deterministic static analyzer and the Phase 8 Google Gemini AI integration to identify, classify, score, and remediate high-impact software security vulnerabilities aligned with the **OWASP Top 10: 2021** standard and the **Common Weakness Enumeration (CWE)** taxonomy across all six supported languages: **C, C++, Java, Python, JavaScript, and TypeScript**.

The analysis engine operates under a unified dual-engine paradigm:
1. **Deterministic Static Rule Engine (Tier 1 & Tier 2)**: Sub-15 millisecond, zero-API-cost lexical and pattern-matching analysis utilizing FSM-driven comment masking. It identifies definitive syntax hazards, hardcoded credentials, dangerous standard library calls, weak cryptographic primitives, and unsafe API invocations with zero network latency.
2. **Google Gemini Semantic AI Analysis Layer (Tier 3)**: Contextual large language model evaluation (`gemini-3.5-flash` or `gemini-2.5-flash`) operating on pre-redacted source code. It traces multi-line taint paths, missing authorization controls (IDOR), complex business logic flaws, and framework-level security misconfigurations that cannot be captured by lexical regex alone.
3. **Multi-Factor Cross-Engine Hybrid Fusion**: An intelligent deduplication coordinator that evaluates coordinate overlap, vulnerability category, and rule/CWE domain to synthesize cross-verified `hybrid` findings. It preserves distinct co-located vulnerabilities while eliminating redundant reports.

All operations enforce strict safety guarantees: **untrusted source code is never executed, evaluated, or compiled**; secrets are redacted prior to external AI transmission; tenant isolation is strictly enforced via authenticated MongoDB queries; and deterministic scoring ceiling rules prevent insecure code from receiving passing grades.

---

## 2. Scope and Non-Goals

### 2.1 In-Scope Capabilities
- **10 Core Vulnerability Domains**:
  1. Injection vulnerabilities (SQL, NoSQL, Command, LDAP, Code Injection)
  2. Authentication weaknesses (hardcoded passwords, insecure hashing, weak credentials)
  3. Sensitive data exposure (API keys, private keys, weak crypto, pseudorandom generation)
  4. Broken access control (IDOR, missing authorization checks, path traversal)
  5. Security misconfiguration (debug flags, permissive CORS, insecure cookie flags, disabled TLS)
  6. Cross-Site Scripting (Reflected, Stored, and DOM-based XSS, React `dangerouslySetInnerHTML`)
  7. Cross-Site Request Forgery (CSRF patterns and unprotected state mutations)
  8. Insecure deserialization (`pickle`, Java `readObject`, `node-serialize`, unsafe YAML)
  9. Server-Side Request Forgery (SSRF via unvalidated client URLs)
  10. Unsafe dependency import and execution patterns (dynamic `require`/`importlib`, unpinned requirements)
- **Language Coverage**: C, C++, Java, Python, JavaScript, TypeScript.
- **Dedicated Security API**: `GET /api/v1/reviews/:id/security` providing isolated security finding inspection with CWE and OWASP metadata.
- **Multi-Factor Hybrid Fusion Engine**: Cross-engine deduplication combining static and AI findings into unified `source: 'hybrid'` issues without collapsing distinct co-located flaws.
- **Frontend Security Visualizations**: CWE pills, OWASP category badges, confidence indicators, and prominent critical vulnerability alert banners within `FindingsPanel.jsx`.

### 2.2 Non-Goals (Explicitly Deferred)
- **No Phase 10 Performance Profiling**: Algorithmic Big-O time/space complexity, memory leak tracing, and iteration optimizations remain strictly in Phase 10.
- **No Dynamic Sandboxed Execution (DAST)**: Submitted code is evaluated strictly via static and semantic text analysis. The backend will never run compilers (gcc, clang, javac), runtimes (node, python), or sandboxed containers on submitted code.
- **No External Dependency CVE Crawlers**: This engine does not query live external vulnerability databases (e.g., Snyk, GitHub Advisory Database, or National Vulnerability Database API). It identifies vulnerable code patterns and import constructs within the submitted source text itself.
- **No Automated Unilateral Code Mutation**: The engine generates suggested remediations and diffs; it never automatically modifies repository files without developer review.

---

## 3. OWASP Mapping Matrix

Every security finding generated by the static engine or Gemini AI is mapped directly to the **OWASP Top 10: 2021** standard and authentic MITRE Common Weakness Enumeration (CWE) definitions:

| OWASP Top 10: 2021 Category | Description | Primary CWE Identifiers (MITRE Exact) | Primary Engine Tier |
|---|---|---|---|
| **A01:2021 – Broken Access Control** | Unauthorized data access, privilege escalation, path traversal, IDOR | **CWE-22**: Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')<br>**CWE-284**: Improper Access Control<br>**CWE-639**: Authorization Bypass Through User-Controlled Key ('Insecure Direct Object Reference') | Static (Traversal) + Gemini (IDOR/AuthZ) |
| **A02:2021 – Cryptographic Failures** | Weak ciphers, insecure hashes for passwords, broken RNG, exposed secrets | **CWE-259**: Use of Hard-coded Password<br>**CWE-327**: Use of a Broken or Risky Cryptographic Algorithm<br>**CWE-328**: Use of Weak Hash<br>**CWE-338**: Use of Cryptographically Weak Pseudo-Random Number Generator (PRNG) | Static (Regex) + Gemini (Context) |
| **A03:2021 – Injection** | SQL, NoSQL, OS Command, and Code injection via untrusted string concatenation | **CWE-78**: Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')<br>**CWE-89**: Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')<br>**CWE-90**: Improper Neutralization of Special Elements used in an LDAP Query ('LDAP Injection')<br>**CWE-94**: Improper Control of Generation of Code ('Code Injection')<br>**CWE-943**: Improper Neutralization of Special Elements in Data Query Logic | Static (Pattern) + Gemini (Taint Flow) |
| **A04:2021 – Insecure Design** | Unrestricted resource consumption, missing rate limiting logic | **CWE-209**: Generation of Error Message Containing Sensitive Information<br>**CWE-799**: Improper Control of Interaction Frequency | Gemini Semantic |
| **A05:2021 – Security Misconfiguration** | Debug mode in production, overly permissive CORS, insecure cookie flags | **CWE-16**: Configuration<br>**CWE-295**: Improper Certificate Validation<br>**CWE-489**: Active Debug Code<br>**CWE-611**: Improper Restriction of XML External Entity Reference ('XXE')<br>**CWE-614**: Sensitive Cookie in HTTPS Session Without 'Secure' Attribute<br>**CWE-942**: Permissive Cross-domain Policy with Untrusted Domains<br>**CWE-1004**: Sensitive Cookie Without 'HttpOnly' Flag | Static (Pattern) + Gemini (Config) |
| **A06:2021 – Vulnerable / Outdated Components** | Dynamic unverified imports, unpinned dependency declarations | **CWE-470**: Use of Externally-Controlled Input to Select Classes or Code ('Unsafe Reflection')<br>**CWE-1357**: Reliance on Uncontrolled Component | Static (Import/Syntax) + Gemini |
| **A07:2021 – Identification & Auth Failures** | Plaintext credentials, weak credential verification, session fixation | **CWE-287**: Improper Authentication<br>**CWE-384**: Session Fixation<br>**CWE-798**: Use of Hard-coded Credentials | Static (Tier 1 Secrets) + Gemini |
| **A08:2021 – Software & Data Integrity Failures** | Deserialization of untrusted objects, untrusted script inclusion | **CWE-502**: Deserialization of Untrusted Data<br>**CWE-829**: Inclusion of Functionality from Untrusted Control Sphere | Static (Signatures) + Gemini |
| **A09:2021 – Security Logging & Monitoring Failures** | Log injection, logging sensitive tokens or passwords to disk/console | **CWE-117**: Improper Output Handling for Logs<br>**CWE-532**: Insertion of Sensitive Information into Log File | Static (Regex) + Gemini |
| **A10:2021 – Server-Side Request Forgery (SSRF)** | Arbitrary outbound network requests from backend services | **CWE-918**: Server-Side Request Forgery (SSRF) | Static (Sink calls) + Gemini (URL Flow) |

---

## 4. Vulnerability Categories and Detection Strategy

### 4.1 Four-Tier Finding Confidence & Evidence Classification
To eliminate false alarms and prevent labeling unproven heuristics as confirmed exploits, Phase 9 establishes four explicit confidence tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: CONFIRMED DANGEROUS PATTERN (Confidence: HIGH)                  │
│ • API signature is inherently hazardous by definition.                 │
│ • Exploitable without requiring complex external data flow.             │
│ • Examples: strcpy(), gets(), pickle.loads(), shell=True with dynamic   │
│   concatenation, plaintext AWS keys / JWT tokens in code.               │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2: POTENTIAL VULNERABILITY (Confidence: MEDIUM)                    │
│ • Recognizable vulnerable sink, but safe usage is syntactically         │
│   possible or sanitization may occur upstream outside snippet.          │
│ • Examples: SQL execute() with concatenated variable, innerHTML        │
│   assignment, os.path.join with query parameters.                       │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3: CONTEXT-DEPENDENT VULNERABILITY (Confidence: LOW / MEDIUM)      │
│ • Flaw depends entirely on system architecture or business logic.       │
│ • Cannot be proven without full router, session, or database context.   │
│ • Examples: Missing IDOR check on req.params.id, permissive CORS        │
│   without credentials, Math.random() used for non-security value.       │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 4: INFORMATIONAL OBSERVATION (Severity: INFO / Low, Confidence: -) │
│ • Defense-in-depth hygiene recommendation or supply-chain hint.        │
│ • Zero direct exploitability proven. Zero score deduction.             │
│ • Examples: Unpinned dependency (*), verbose error handling in Dev,    │
│   missing security response headers.                                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Detection Strategies Across the 10 Domains

1. **Injection Vulnerabilities (CWE-89, CWE-78, CWE-943, CWE-90, CWE-94)**:
   - *Static Detection*: Detects raw string concatenation (`+`, `.format()`, f-strings, template literals) into database query methods (`executeQuery`, `db.query`, `execute`, `knex.raw`, `sequelize.literal`, `sqlite3_exec`). Confirmed only when concatenation operators are present; static queries are ignored.
   - *Gemini Detection*: Identifies multi-step query construction where untrusted request parameters flow into ORM raw fragments or unescaped clauses across helper functions.
2. **Authentication Weaknesses (CWE-798, CWE-287, CWE-328)**:
   - *Static Detection*: Scans raw source code (Tier 1) for passwords, secret tokens, private keys, AWS access keys, GitHub tokens, and JWT strings using entropy and regex heuristics.
   - *Gemini Detection*: Flags custom, non-salted hashing implementations where bcrypt, Argon2, or PBKDF2 should be enforced.
3. **Sensitive Data Exposure & Cryptographic Failures (CWE-327, CWE-338, CWE-532)**:
   - *Static Detection*: Matches ciphers using ECB mode (`AES/ECB/PKCS5Padding`, `DES`, `RC4`, `Blowfish`) or static initialization vectors.
   - *Static Detection*: Identifies `Math.random()`, `random.random()`, `rand()` used in token or security contexts.
4. **Broken Access Control & Path Traversal (CWE-22, CWE-639)**:
   - *Static Detection*: Matches file access functions (`fs.readFile`, `open()`, `FileInputStream`, `fopen`) where dynamic variables or `..` sequences are concatenated into paths without sanitization or base-directory resolution.
   - *Gemini Detection*: Evaluates database lookup operations where entity IDs from request parameters (`req.params.id`) are queried without scoping by the authenticated user's session identifier (`userId: req.user._id`).
5. **Security Misconfiguration (CWE-489, CWE-942, CWE-614, CWE-1004, CWE-295)**:
   - *Static Detection*: Flags `DEBUG = True` in Python (`CWE-489`), `app.use(errorhandler())` in Express, permissive CORS (`*` with credentials, `CWE-942`), cookies missing `secure: true` (`CWE-614`), cookies missing `httpOnly: true` (`CWE-1004`), and disabled TLS verification (`CWE-295`).
6. **Cross-Site Scripting (XSS) (CWE-79)**:
   - *Static Detection*: Flags direct assignments to `.innerHTML`, `.outerHTML`, `document.write()`, and React `dangerouslySetInnerHTML`.
7. **Cross-Site Request Forgery (CSRF) (CWE-352)**:
   - *Gemini Detection*: Evaluates API architectural design to verify state-changing endpoints require anti-CSRF headers or anti-forgery tokens.
8. **Insecure Deserialization (CWE-502)**:
   - *Static Detection*: Direct signatures: `pickle.loads()`, `_pickle.loads()`, `yaml.load(..., Loader=yaml.Loader)` without `SafeLoader`, Java `ObjectInputStream.readObject()`, Node `node-serialize.unserialize()`.
9. **Server-Side Request Forgery (SSRF) (CWE-918)**:
   - *Static Detection*: Matches HTTP request libraries (`axios.get`, `fetch`, `requests.get`, `HttpURLConnection`) where full URLs are constructed from unvalidated variables without hostname whitelisting.
10. **Unsafe Dependency and Dynamic Import Patterns (CWE-470, CWE-1357, CWE-829)**:
    - *Static Detection (CWE-470)*: Flags dynamic unvalidated module loading where user-controlled input selects classes or code (`require(userInput)`, `importlib.import_module(userInput)`).
    - *Static Detection (CWE-1357)*: Flags unpinned dependencies (`package=*`) in dependency manifests.
    - *Static Detection (CWE-829)*: Flags inclusion of scripts or resources from untrusted, unverified remote origins without integrity attributes.

---

## 5. Language-Specific Detection Rules

The Phase 9 rule suite introduces 42 deterministic static security rules distributed across the six supported languages. Every rule specifies its exact OWASP category, valid MITRE CWE, detection method, severity, confidence tier, false-positive boundaries, and remediation:

### 5.1 Python Security Rules Matrix

| Rule ID | Vulnerability Name | OWASP:2021 | CWE | Lang | Detection Method | Severity | Confidence Requirement | False-Positive Limitations | Recommended Remediation |
|---|---|---|---|---|---|---|---|---|---|
| `SEC-PY-SQL-001` | Raw SQL String Formatting | A03:2021 | CWE-89 | Python | Masked Regex (Sink + Concatenation) | CRITICAL | HIGH if format/f-string; MEDIUM if plain var | Fires on internal test scripts using mocked DB | Use parameterized query placeholders (`%s`) |
| `SEC-PY-CMD-001` | Command Execution with shell=True | A03:2021 | CWE-78 | Python | Masked Regex (subprocess + shell=True) | HIGH | HIGH (inherently unsafe shell invocation) | Fires on hardcoded static admin scripts | Pass arguments as a list with `shell=False` |
| `SEC-PY-DES-001` | Insecure Pickle Deserialization | A08:2021 | CWE-502 | Python | Masked Regex (pickle.loads/load) | CRITICAL | HIGH (untrusted pickle is RCE) | Fires on internal trusted cache | Use safe serialization formats (`json`, `protobuf`) |
| `SEC-PY-DES-002` | Unsafe PyYAML Load | A08:2021 | CWE-502 | Python | Masked Regex (yaml.load without SafeLoader) | HIGH | HIGH | Fires on static config loads if trusted | Use `yaml.safe_load()` or `Loader=yaml.SafeLoader` |
| `SEC-PY-DBG-001` | Active Debug Code in Production | A05:2021 | CWE-489 | Python | Masked Regex (DEBUG=True / app.run(debug)) | HIGH | MEDIUM (may be local dev config) | Fires on local development configuration files | Bind debug flag to environment: `os.getenv("DEBUG")=="1"` |
| `SEC-PY-CRY-001` | Weak Cryptographic Hash (MD5/SHA1) | A02:2021 | CWE-328 | Python | Masked Regex (hashlib.md5/sha1) | MEDIUM | MEDIUM (could be checksum, not password) | Fires on file deduplication / checksum calculation | Use SHA-256 for integrity; bcrypt for passwords |
| `SEC-PY-RNG-001` | Insecure Pseudorandom Generator | A02:2021 | CWE-338 | Python | Masked Regex (random.random/randint) | LOW | LOW (valid for simulations, games) | Fires on statistical/simulation code | Use `secrets` module for tokens and security keys |
| `SEC-PY-SSRF-001` | Unvalidated Outbound Request (SSRF) | A10:2021 | CWE-918 | Python | Masked Regex (requests.get with variable URL) | MEDIUM | MEDIUM (depends on URL origin) | Fires when URL is loaded from trusted config | Validate destination against an allowlist of domains |
| `SEC-PY-TRAV-001` | Path Traversal via os.path.join | A01:2021 | CWE-22 | Python | Masked Regex (open + os.path.join + req) | HIGH | MEDIUM | Fires if path is sanitized earlier in function | Resolve path and assert `path.startswith(BASE_DIR)` |
| `SEC-PY-DEP-001` | Dynamic Module Loading (Unsafe Reflection) | A06:2021 | CWE-470 | Python | Masked Regex (importlib.import_module + var) | HIGH | MEDIUM | Fires on plugin architectures with internal map | Validate module name against a strict static whitelist |

### 5.2 JavaScript & TypeScript Security Rules Matrix

| Rule ID | Vulnerability Name | OWASP:2021 | CWE | Lang | Detection Method | Severity | Confidence Requirement | False-Positive Limitations | Recommended Remediation |
|---|---|---|---|---|---|---|---|---|---|
| `SEC-JS-XSS-001` | DOM XSS via innerHTML/outerHTML | A03:2021 | CWE-79 | JS/TS | Masked Regex (.innerHTML = untrusted) | HIGH | HIGH if dynamic expression; MEDIUM if string | Fires if developer wrote custom sanitizer beforehand | Use `textContent` or `DOMPurify.sanitize()` |
| `SEC-JS-XSS-002` | Document.write Direct Output | A03:2021 | CWE-79 | JS/TS | Masked Regex (document.write) | HIGH | HIGH (obsolete and unsafe) | Rare in modern code; legacy polyfills fire | Manipulate DOM nodes via `appendChild` or React |
| `SEC-TS-XSS-001` | React dangerouslySetInnerHTML | A03:2021 | CWE-79 | TS/JS | Masked Regex (dangerouslySetInnerHTML) | HIGH | HIGH | Fires on sanitized CMS html rendering | Sanitize input using `DOMPurify.sanitize(html)` |
| `SEC-JS-EVAL-001` | Dynamic Code Execution (Code Injection) | A03:2021 | CWE-94 | JS/TS | Masked Regex (eval( / new Function() | CRITICAL | HIGH (arbitrary code execution vector) | Fires on math expression parsers | Use `JSON.parse()` or safe expression parser |
| `SEC-JS-CMD-001` | Command Injection via child_process.exec | A03:2021 | CWE-78 | JS/TS | Masked Regex (child_process.exec + concat) | CRITICAL | HIGH if string template or concatenation | Fires on static administrative tools | Use `execFile` or `spawn` with an arguments array |
| `SEC-JS-SQL-001` | Raw SQL String Concatenation | A03:2021 | CWE-89 | JS/TS | Masked Regex (query/raw + template/concat) | CRITICAL | HIGH if template `${}` in query string | Fires on migrations with static table names | Use parameterized queries or ORM query builder |
| `SEC-JS-NOSQL-001` | MongoDB Insecure $where Evaluation | A03:2021 | CWE-943 | JS/TS | Masked Regex ($where: dynamic string) | HIGH | HIGH ($where runs JS interpreter) | Fires on internal reporting scripts | Use standard MongoDB query operators (`$eq`, `$in`) |
| `SEC-JS-COOKIE-001`| Cookie Without 'Secure' Attribute | A05:2021 | CWE-614 | JS/TS | Masked Regex (secure: false) | HIGH | HIGH (transmits over cleartext HTTP) | Intended for local HTTP testing | Set `secure: process.env.NODE_ENV === "production"` |
| `SEC-JS-COOKIE-002`| Sensitive Cookie Missing 'HttpOnly' | A05:2021 | CWE-1004 | JS/TS | Masked Regex (httpOnly: false) | MEDIUM | MEDIUM (client-side JS readable) | Intended if cookie is specifically for UI state | Set `httpOnly: true` for session/auth tokens |
| `SEC-JS-CORS-001` | Permissive Cross-Domain Policy (CORS) | A05:2021 | CWE-942 | JS/TS | Masked Regex (origin: * + credentials: true) | MEDIUM | HIGH (invalid spec configuration) | Fires if public API allows open access | Specify explicit trusted origin domains |
| `SEC-JS-CRY-001` | Weak Cryptographic Hash (MD5/SHA1) | A02:2021 | CWE-328 | JS/TS | Masked Regex (createHash('md5'/'sha1')) | MEDIUM | MEDIUM (could be ETag / asset cache hash) | Fires on webpack/asset hash generation | Use SHA-256 for integrity; bcrypt for passwords |
| `SEC-JS-TLS-001` | TLS Certificate Verification Disabled | A05:2021 | CWE-295 | JS/TS | Masked Regex (rejectUnauthorized: false) | CRITICAL | HIGH (disables TLS man-in-the-middle defense) | Often left in code during local dev | Enforce `rejectUnauthorized: true` in production |
| `SEC-JS-DES-001` | Insecure Object Unserialization | A08:2021 | CWE-502 | JS/TS | Masked Regex (node-serialize.unserialize) | CRITICAL | HIGH (RCE via IIFE gadget) | Very rarely legitimate | Replace with standard `JSON.parse()` |
| `SEC-JS-SSRF-001` | Unvalidated Outbound Request (SSRF) | A10:2021 | CWE-918 | JS/TS | Masked Regex (axios.get/fetch with variable) | MEDIUM | MEDIUM | Fires when fetching internal microservices | Validate target URL against a strict whitelist |
| `SEC-JS-DEP-001` | Dynamic Require (Unsafe Reflection) | A06:2021 | CWE-470 | JS/TS | Masked Regex (require\s*\(\s*[a-zA-Z_]\w*\s*\)) | HIGH | MEDIUM | Fires on dynamic router index loaders | Use static import maps or validate against allowlist |

### 5.3 Java Security Rules Matrix

| Rule ID | Vulnerability Name | OWASP:2021 | CWE | Lang | Detection Method | Severity | Confidence Requirement | False-Positive Limitations | Recommended Remediation |
|---|---|---|---|---|---|---|---|---|---|
| `SEC-JAV-SQL-001` | Unprepared SQL Statement Concatenation | A03:2021 | CWE-89 | Java | Masked Regex (Statement.execute + concat) | CRITICAL | HIGH | Fires on static concatenated constants | Use `conn.prepareStatement()` with `?` parameters |
| `SEC-JAV-CMD-001` | Command Injection via Runtime.exec | A03:2021 | CWE-78 | Java | Masked Regex (Runtime.getRuntime().exec) | CRITICAL | HIGH if string concatenation | Fires if command string is a static literal | Use `ProcessBuilder` with separate string arguments |
| `SEC-JAV-DES-001` | Insecure Java Deserialization | A08:2021 | CWE-502 | Java | Masked Regex (ObjectInputStream.readObject) | CRITICAL | HIGH (gadget chain RCE risk) | Fires if custom ObjectInputFilter is used | Use Jackson/JSON or configure `ObjectInputFilter` |
| `SEC-JAV-CRY-001` | Broken Cryptographic Cipher (DES/ECB) | A02:2021 | CWE-327 | Java | Masked Regex (Cipher.getInstance DES/ECB) | HIGH | HIGH | Fires on legacy backward-compatibility code | Use `AES/GCM/NoPadding` |
| `SEC-JAV-CRY-002` | Weak Cryptographic Hash (MD5/SHA1) | A02:2021 | CWE-328 | Java | Masked Regex (MessageDigest MD5/SHA-1) | MEDIUM | MEDIUM | Fires on file checksum verifications | Use `SHA-256` or `SHA-512` |
| `SEC-JAV-XXE-001` | XML External Entity (XXE) Injection | A05:2021 | CWE-611 | Java | Masked Regex (DocumentBuilderFactory without safe features) | HIGH | MEDIUM | Fires if features configured in separate helper | Disable external DTDs via `setFeature` |
| `SEC-JAV-RNG-001` | Insecure Random Number Generator | A02:2021 | CWE-338 | Java | Masked Regex (new Random()) | LOW | LOW | Fires on simulations, non-crypto sorting | Use `java.security.SecureRandom` for tokens |
| `SEC-JAV-CRED-001`| Hardcoded JDBC Database Credentials | A07:2021 | CWE-798 | Java | Masked Regex (DriverManager.getConnection + password=) | HIGH | HIGH | Fires on test fixtures with dummy passwords | Inject DB credentials via `System.getenv()` |

### 5.4 C & C++ Security Rules Matrix

| Rule ID | Vulnerability Name | OWASP:2021 | CWE | Lang | Detection Method | Severity | Confidence Requirement | False-Positive Limitations | Recommended Remediation |
|---|---|---|---|---|---|---|---|---|---|
| `SEC-C-BUF-001` | Buffer Copy Without Checking Input Size | A03:2021 | CWE-120 | C | Masked Regex (strcpy) | CRITICAL | HIGH (unbounded buffer copy) | Fires if buffer size was verified on line above | Use `strncpy()` or `snprintf()`, ensuring null termination |
| `SEC-C-BUF-002` | Use of Inherently Dangerous Function | A03:2021 | CWE-242 | C | Masked Regex (gets) | CRITICAL | HIGH (function cannot be used safely) | Universal hazard | Replace with `fgets(buf, sizeof(buf), stdin)` |
| `SEC-C-BUF-003` | Unbounded Output Buffer Copy (sprintf) | A03:2021 | CWE-120 | C | Masked Regex (sprintf + %s) | HIGH | HIGH | Fires on short bounded string constants | Use `snprintf(out, sizeof(out), ...)` |
| `SEC-C-BUF-004` | Unbounded Input Write via scanf | A03:2021 | CWE-120 | C | Masked Regex (scanf + %s without width) | HIGH | HIGH | Fires on bounded format strings (`%31s`) | Specify max width: `scanf("%63s", buf)` |
| `SEC-C-CMD-001` | Command Injection via system() | A03:2021 | CWE-78 | C | Masked Regex (system(cmd)) | HIGH | HIGH | Fires on static diagnostic commands | Use `execvp()` or `fork()/execve()` without shell |
| `SEC-CPP-BUF-001`| Legacy C-Style Buffer Copy in C++ | A03:2021 | CWE-120 | C++ | Masked Regex (strcpy/strcat) | HIGH | HIGH | Fires on legacy C compatibility wrappers | Use `std::string` or `std::string_view` |
| `SEC-CPP-CMD-001`| Command Injection via std::system | A03:2021 | CWE-78 | C++ | Masked Regex (std::system) | HIGH | HIGH | Fires on fixed diagnostic calls | Use `std::filesystem` or system exec without shell |
| `SEC-CPP-FMT-001`| Unsafe Formatted Output in C++ | A03:2021 | CWE-120 | C++ | Masked Regex (sprintf/vsprintf) | HIGH | HIGH | Fires on bounded fixed-size formatting | Use `snprintf()`, `std::ostringstream`, or `std::format` |
| `SEC-C-RNG-001` | Insecure Weak PRNG (rand) | A02:2021 | CWE-338 | C/C++ | Masked Regex (rand()) | LOW | LOW | Fires on games, graphics, non-security math | Use CSPRNG (`getrandom()` or `arc4random()`) |

---

## 6. Static Analysis Architecture & Limitations

### 6.1 Two-Tier Scanning Model
The Static Analysis Engine operates via `server/src/services/staticAnalyzer/engine.js`:
- **Tier 1 (Raw Scanning, `scanRaw: true`)**: Scans unmasked code for hardcoded secrets, AWS keys, GitHub tokens, JWTs, and private keys. Executes on raw code to ensure credentials hidden in comments are flagged.
- **Tier 2 (Comment-Masked Scanning, `scanRaw: false`)**: Scans code preprocessed by the FSM where comments are substituted with whitespace. Operates on 1:1 spatial line/column invariance.

### 6.2 Strict Static Analysis Limitations (Zero False Claims of Taint Tracking)
To preserve architectural integrity, we explicitly acknowledge what the static engine **can** and **cannot** do:

| Capability | Static Engine Ability | Technical Reason | Handled By |
|---|---|---|---|
| **Dangerous API Signature Detection** | **YES (Deterministic)** | Direct regex matching of known hazardous primitives (`strcpy`, `gets`, `pickle.loads`) | Static Tier 2 |
| **Comment Invariance** | **YES (Deterministic)** | Preprocessor FSM replaces comments with spaces of exact length (1:1 spatial coordinates) | Preprocessor FSM |
| **Literal Secret Entropy / Pattern Matching** | **YES (Deterministic)** | High-entropy regex patterns on raw strings (AWS, GitHub, JWT, Private Keys) | Static Tier 1 |
| **Syntactic String Concatenation in Sinks** | **YES (Heuristic)** | Detects `+`, `${}`, `%s`, `.format()` inside known query/exec call signatures | Static Tier 2 |
| **Inter-procedural Data-Flow / Taint Tracking** | **NO** | Static engine is lexical/regex-based; it does NOT build an Abstract Syntax Tree (AST), symbol table, or control-flow graph (CFG). | **Gemini AI Tier 3** |
| **Cross-Function Variable Origin Resolution** | **NO** | Cannot trace whether `query` passed to `db.query(query)` was sanitized in a different function. | **Gemini AI Tier 3** |
| **Missing Authorization Middleware (IDOR)** | **NO** | Cannot inspect multi-file route definitions or evaluate whether session authentication was verified. | **Gemini AI Tier 3** |
| **Business Logic Exploits** | **NO** | Cannot understand semantic intent, order workflows, or race conditions. | **Gemini AI Tier 3** |

---

## 7. Gemini Semantic Analysis Integration

### 7.1 Role of Supplementary Semantic Analysis
Gemini AI acts as a **Tier 3 Supplementary Semantic Security Engine**, tasked specifically with evaluating contextual security flaws that escape lexical filters:
1. Multi-line taint paths (tracking untrusted parameters across helper functions to sinks).
2. Broken Access Control / IDOR (evaluating database lookups that fail to verify `userId` ownership).
3. Framework-level configuration omissions across Express routers or Flask blueprints.
4. Business logic bypasses.

### 7.2 Pre-Filter Secret Redaction Boundary
Before source code is sent to Google Gemini, it must pass through the Phase 8 `redactSecrets()` service:
- Cleartext credentials, API keys, private keys, and passwords are replaced with character-length-matched asterisks (`AKIA****************`).
- Gemini evaluates the structure of the code without ever receiving cleartext secrets over the network.
- The `coordinateMapper` maps any AI-reported coordinates back to the original source coordinates before persistence.

### 7.3 Gemini Anti-Hallucination & Evidence Constraints
The Gemini prompt (`gemini.service.js`) enforces strict evidence requirements:
1. **No Invented Context**: Gemini must NOT assume missing sanitization functions exist or don't exist without evidence in the provided code snippet.
2. **Honest Confidence**: If an input appears to be handled by a framework mechanism, Gemini must NOT flag it as an active exploit. It must assign `confidence: 'MEDIUM'` or `'LOW'` and classify it as a *Potential Vulnerability*.
3. **No Fabricated Defaults**: All 11 issue fields must be populated with genuine analysis. Coordinates must be exact 1-indexed integers matching the provided code buffer.

---

## 8. Finding Schema and Severity Mapping

### 8.1 Score and Grade Integrity

#### Existing System Grade Boundaries:
$$\begin{aligned}
\mathbf{A} &: 90 - 100 \\
\mathbf{B} &: 75 - 89 \\
\mathbf{C} &: 60 - 74 \\
\mathbf{D} &: 40 - 59 \\
\mathbf{F} &: 0 - 39
\end{aligned}$$

#### Score Ceiling Policies:
1. **Single Critical Finding Policy (ACTIVE & APPROVED in Phase 8 Step 7)**:
   - If at least one confirmed `CRITICAL` finding is detected (by static analyzer or Gemini):
     $$\text{overallScore} = \min(\text{baseScore}, 74)$$
   - This caps the review at a maximum of **Grade C (74)**. Insecure code harboring a Critical flaw cannot receive Grade A or B.
2. **Multiple Critical Finding Policy (DISABLED BY DEFAULT — Optional Enhancement Pending Approval)**:
   - If two or more ($\ge 2$) distinct confirmed `CRITICAL` security findings are detected:
     $$\text{overallScore} = \min(\text{baseScore}, 39)$$
   - **Status**: The multiple-critical ceiling of 39 is **DISABLED BY DEFAULT**. The active system default remains strictly the approved single ceiling of 74 unless the multiple-critical policy is explicitly enabled by the user.
   - **Counting Guard**: Only *distinct, validated, non-duplicate Critical security findings* may count toward this optional policy. Multiple reports of the same vulnerability or redundant findings do NOT trigger this ceiling.
3. **Scoring Formula Invariance**:
   - Hybrid Mode Base Score remains strictly:
     $$\text{baseScore} = \text{round}(0.40 \times \text{staticScore} + 0.60 \times \text{aiCompositeScore})$$
   - Static Fallback Mode Score remains strictly:
     $$\text{baseScore} = \text{staticScore}$$
   - The existing mathematical formulas and deduction weights from Phase 7/8 are preserved without silent modifications.

---

## 9. False Positive Reduction & Confidence Lifecycle

### 9.1 End-to-End Confidence Lifecycle
The system enforces a rigorous, four-stage lifecycle for finding confidence:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. STATIC FINDING CONFIDENCE GENERATION                                │
│ • Inherited deterministically from static rule definition metadata.    │
│ • Defined as rule.confidence ('HIGH' for verified API signatures;       │
│   'MEDIUM' for heuristic pattern regexes).                             │
├────────────────────────────────────────────────────────────────────────┤
│ 2. GEMINI AI CONFIDENCE VALIDATION                                     │
│ • Validated strictly via Zod schema (z.enum(['HIGH', 'MEDIUM', 'LOW'])).│
│ • Context gating rejects synthetic 'HIGH' confidence if the snippet    │
│   lacks supporting data-flow evidence.                                 │
├────────────────────────────────────────────────────────────────────────┤
│ 3. DETERMINISTIC HYBRID FUSION CONFIDENCE POLICY                       │
│ • Static 'HIGH' + AI confirmed ───────────────► 'HIGH'                 │
│ • Static 'MEDIUM' + AI verified taint flow ──► 'HIGH'                  │
│ • Static 'MEDIUM' + AI unconfirmed ──────────► 'MEDIUM'                │
│ • Context-dependent findings ────────────────► 'LOW'                   │
├────────────────────────────────────────────────────────────────────────┤
│ 4. PERSISTENCE & REVIEW-HISTORY RETRIEVAL REALITY                      │
│ • Active ReviewIssue schema currently has NO 'confidence' column.       │
│ • Dynamic Derivation: Confidence is derived at runtime from the rule   │
│   registry for static rules and passed via GET /reviews/:id/security.  │
│ • Deferred Schema Extension: Adding a dedicated confidence column      │
│   to reviewIssue.model.js is formally identified and deferred.         │
│ • Rule: The platform NEVER falsely claims confidence is persisted in   │
│   MongoDB if it is discarded during model persistence.                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Duplicate Finding Prevention & Multi-Factor Hybrid Fusion

### 10.1 The Flaw with Coordinate-Only Merging
Merging findings solely based on overlapping coordinates is dangerous and incorrect. For example, a single line of code may contain two completely distinct vulnerabilities:
```javascript
// Line 42 contains both a hardcoded AWS key AND dynamic code execution:
const token = "AKIAIOSFODNN7EXAMPLE"; eval(req.query.cmd);
```
Merging these two findings simply because they share line 42 would destroy the audit trail for one of the vulnerabilities.

### 10.2 Multi-Factor Fusion Algorithm
Two findings $F_{\text{static}}$ and $F_{\text{ai}}$ are merged into a single `hybrid` finding **if and only if all four conditions are met**:

1. **Category Match**: Both findings belong to `category: 'security'`.
2. **Spatial Overlap**: The findings share an intersecting line range:
   $$\max(F_{\text{static}}.lineStart, F_{\text{ai}}.lineStart) \le \min(F_{\text{static}}.lineEnd, F_{\text{ai}}.lineEnd)$$
3. **Domain / CWE Alignment**: EITHER:
   - The findings share the exact same `cwe` (e.g. both are `CWE-89`), OR
   - The findings share the exact same `ruleId`, OR
   - The primary vulnerability domain matches (e.g., both identify SQL Injection, Command Injection, or Insecure Deserialization).
4. **Engine Attribution**: One finding originates from `source: 'static'` and the other from `source: 'gemini'`.

### 10.3 Deterministic Fusion Precedence
When multi-factor fusion conditions are met:
- `source`: Set to `'hybrid'`.
- `lineStart`, `lineEnd`, `columnStart`, `columnEnd`: Exact coordinates from the static analyzer are retained (deterministic AST/LineMapper precision).
- `ruleId`: Deterministic static `ruleId` is retained (e.g., `SEC-PY-SQL-001`).
- `severity`: Takes the maximum severity rank:
  $$\text{severity} = \max_{\text{rank}}(F_{\text{static}}.severity, F_{\text{ai}}.severity)$$
- `title`: Uses concise static title.
- `explanation`: Combines static rule explanation with Gemini's contextual explanation.
- `suggestedSnippet`: Prefers Gemini's holistic refactored snippet if non-empty, falling back to static snippet.
- `originalSnippet`: Exact mapped code excerpt from source buffer.
- The redundant AI issue is discarded.
- Distinct vulnerabilities on the same line (e.g., Secret + Command Injection) are **both preserved**.

---

## 11. API and Backend Integration Design

### 11.1 Enhanced Endpoint: `POST /api/v1/reviews`
Existing Phase 8 submission flow is enhanced to run the expanded security rule suite during static analysis and apply multi-factor hybrid fusion during AI reconciliation.
- **Rate Limit**: 10 requests per minute (`reviewLimiter`).
- **Secret Redaction**: Always executed before Gemini transmission.
- **Response**: Returns persisted review object with deduplicated, hybrid-fused issues.

### 11.2 New Dedicated Endpoint: `GET /api/v1/reviews/:id/security`
Provides an isolated, security-focused inspection view of a completed review:
- **Route**: `GET /api/v1/reviews/:id/security`
- **Controller**: `getReviewSecuritySummary` in `server/src/controllers/review.controller.js`
- **Middleware**: `authenticate` (ensures user session and verified `userId`).
- **Tenant Isolation**: Queries review where `_id = req.params.id` AND `userId = req.userId`. Returns 404 if not owned by user.
- **Dynamic Derivation**: Computes OWASP distribution, CWE groupings, and security grade dynamically at response time from persisted `ReviewIssue` records and static rule registry lookups.

---

## 12. Database Schema Compatibility & Persistence Impact

### 12.1 Detailed Schema Audit & Field Mapping Strategy
We have audited the existing Mongoose models (`server/src/models/reviewIssue.model.js`, `analysisResult.model.js`, and `review.model.js`). To maintain strict database stability without unauthorized migrations, each security property is handled as follows:

| Security Property | Existing Model Field? | Phase 9 Storage & Delivery Strategy | Schema Extension Required? |
|---|---|---|---|
| **Vulnerability Category** | YES (`ReviewIssue.category`) | Stored in existing enum (`'security'`). | **NO** |
| **Severity Rating** | YES (`ReviewIssue.severity`) | Stored in existing enum (`'CRITICAL'`, `'HIGH'`, `'MEDIUM'`, etc.). | **NO** |
| **Rule Identifier** | YES (`ReviewIssue.ruleId`, max 60) | Composite identifier: `CWE-89:SEC-PY-SQL-001` (21 chars). | **NO** |
| **Source Origin** | YES (`ReviewIssue.source`) | Stored in existing enum (`'static'`, `'gemini'`, `'hybrid'`). | **NO** |
| **Spatial Coordinates** | YES (`ReviewIssue.lineStart`, etc.) | Stored in existing 1-indexed spatial coordinate fields. | **NO** |
| **CWE Identifier** | NO | **Primary Strategy**: Extracted dynamically from `ruleId` prefix or via static `ruleRegistry` lookup at API query time.<br>**Proposed Extension**: Add `cwe: { type: String, maxlength: 30, default: null }` to `reviewIssue.model.js`. | **NO (Primary Dynamic)** / **YES (If Proposed)** |
| **OWASP Category** | NO | **Primary Strategy**: Resolved dynamically from `ruleRegistry` metadata at API response time.<br>**Proposed Extension**: Add `owaspCategory: { type: String, maxlength: 60, default: null }`. | **NO (Primary Dynamic)** / **YES (If Proposed)** |
| **Finding Confidence** | NO | **Primary Strategy**: Derived dynamically from rule definition metadata at query time.<br>**Proposed Extension**: Add `confidence: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'HIGH' }`. | **NO (Primary Dynamic)** / **YES (If Proposed)** |
| **Security Score** | YES (`AnalysisResult.metrics.securityScore`) | Stored in existing `metrics.securityScore` integer field. | **NO** |

### 12.2 Explicit Schema Extension Governance
- **Default Implementation**: Operates with **ZERO database schema modifications**. All new security metadata (CWE, OWASP, confidence) is resolved dynamically via runtime rule registry mapping and composite `ruleId` parsing.
- Any future proposal to add discrete schema columns (`cwe`, `owaspCategory`, `confidence`) will be formally submitted for user approval prior to modifying `reviewIssue.model.js`.

---

## 13. Frontend FindingsPanel Integration

### 13.1 FindingsPanel UI Enhancements (`FindingsPanel.jsx`)
The Monaco workstation findings panel will be enhanced to give security findings first-class visibility:
1. **CWE Badge**: Crisp badge rendering the associated CWE identifier (e.g. `[CWE-89]`, `[CWE-79]`, `[CWE-78]`).
2. **OWASP Tag**: Tooltip or metadata tag identifying the OWASP Top 10 category (`A03:2021-Injection`).
3. **Source Origin Badge**: Clearly shows whether the issue was identified by `Static`, `AI`, or cross-verified as `Hybrid`.
4. **Security Filter Pill**: Direct category filter allowing developers to isolate security issues with one click.
5. **Critical Alert Banner**: Prominently displayed at the top of the findings drawer whenever Critical security vulnerabilities exist.

---

## 14. Security and Privacy Requirements

1. **Non-Execution Invariant**:
   - Source code strings submitted by users are strictly treated as inert data.
   - Code is NEVER evaluated (`eval`), compiled (`gcc`, `javac`), or executed by the backend.
2. **Pre-LLM Secret Redaction**:
   - `redactSecrets()` runs on every submission prior to invoking the Gemini API.
   - Live passwords, AWS credentials, GitHub tokens, and private keys never leave the server.
3. **Prompt Injection Resilience**:
   - Source code is encapsulated within cryptographically random delimiter tokens:
     `---BEGIN_UNTRUSTED_SOURCE_CODE_${boundaryToken}---`
   - Explicit system instructions forbid the AI model from following instructions or role overrides embedded within source code or comments.
4. **Tenant Data Isolation**:
   - Every review query, issue retrieval, and security inspection requires an authenticated JWT session and enforces `userId: req.userId`.
   - Users cannot inspect or delete reviews belonging to other accounts.
5. **Credential Confidentiality in Logs**:
   - Application loggers (Winston) strip authorization headers, cookies, raw source code, and API keys.

---

## 15. Testing Strategy

### 15.1 Static Security Rule Unit Tests (`server/tests/securityRules.test.js`)
- Positive test fixtures verifying detection of known vulnerabilities across all 6 languages.
- Negative test fixtures verifying sanitized and parameterized code is not flagged.
- Comment-masking verification (ensures commented-out code does not trigger false positives).
- ReDoS safety tests verifying all regexes execute in $< 5\text{ms}$ on 50 KB adversarial strings.

### 15.2 Multi-Factor Hybrid Fusion Tests (`server/tests/hybridFusion.test.js`)
- Verifies coordinate overlap + matching CWE/rule domain merges findings into `source: 'hybrid'`.
- Verifies distinct vulnerabilities on the same line are NOT merged.
- Verifies static coordinates and rule IDs are preserved.

### 15.3 Security API Integration Tests (`server/tests/securityRoutes.test.js`)
- `GET /api/v1/reviews/:id/security`:
  - 200 OK for review owner with isolated security findings and CWE tags.
  - 401 Unauthorized for unauthenticated requests.
  - 404 Not Found for cross-tenant unauthorized access.
  - Single Critical ceiling caps score at $\le 74$.

### 15.4 Frontend Vitest Suite (`client/src/test/securityPanel.test.jsx`)
- Verifies CWE badges, OWASP tags, and severity pills render accurately.
- Verifies Security category filter toggles findings.
- Verifies Critical alert banner appears on critical vulnerabilities.

---

## 16. Performance Considerations

1. **Sub-15ms Static Rule Engine**: All regular expressions compiled at load time; nested unbounded quantifiers eliminated; zero catastrophic backtracking.
2. **Payload Size Guardrails**: `express.json({ limit: '2mb' })` and 2,500 lines / 1 MB upload limit.
3. **AI Latency & Timeout Protection**: Gemini calls bounded by `GEMINI_TIMEOUT_MS` (30,000 ms) with native `AbortController` cancellation. Automatic fallback to deterministic static analysis on timeout.

---

## 17. Implementation Steps

The Phase 9 implementation will proceed in seven controlled, incremental steps:

```
┌────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Static Security Rules Implementation                           │
│ • Create server/src/services/staticAnalyzer/rules/security/ modules    │
│ • Implement rules for SQLi, Command Injection, XSS, Deserialization,   │
│   Crypto, Misconfig, SSRF, and Traversal across all 6 languages.      │
├────────────────────────────────────────────────────────────────────────┤
│ STEP 2: Rule Registry & Preprocessor Integration                       │
│ • Update server/src/services/staticAnalyzer/rules/index.js             │
│ • Integrate domain security rules with language-specific registries.   │
│ • Verify existing Phase 7 test suite passes with zero regressions.     │
├────────────────────────────────────────────────────────────────────────┤
│ STEP 3: Multi-Factor Hybrid Fusion Service                             │
│ • Create server/src/services/hybridFusion.service.js                  │
│ • Implement multi-factor collision detection (coordinates + domain).   │
│ • Update review.service.js to synthesize hybrid findings.              │
├────────────────────────────────────────────────────────────────────────┤
│ STEP 4: Security Endpoint & Controller Integration                     │
│ • Add GET /api/v1/reviews/:id/security in review.routes.js            │
│ • Implement getReviewSecuritySummary in review.controller.js           │
│ • Enforce strict authenticated tenant isolation.                       │
├────────────────────────────────────────────────────────────────────────┤
│ STEP 5: Frontend FindingsPanel Security UI Enhancements                │
│ • Update client/src/components/editor/FindingsPanel.jsx               │
│ • Add CWE pill badges, OWASP tags, and Security category filter.       │
│ • Render Critical Security Alert banner on critical vulnerabilities.  │
├────────────────────────────────────────────────────────────────────────┤
│ STEP 6: Comprehensive Automated Test Suite                             │
│ • Implement securityRules.test.js (static rules + ReDoS verification)  │
│ • Implement hybridFusion.test.js (multi-factor collision tests)        │
│ • Implement securityRoutes.test.js (endpoint + tenant isolation)      │
│ • Implement frontend Vitest security component tests.                  │
├────────────────────────────────────────────────────────────────────────┤
│ STEP 7: Full End-to-End Audit & Documentation Finalization             │
│ • Run full backend test suite (target: 100% pass rate).               │
│ • Run full client test suite (target: 100% pass rate).                │
│ • Verify production build succeeds cleanly.                           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 18. Acceptance Criteria

Phase 9 will be considered complete and verified only when all of the following criteria are met:

1. **Rule Coverage**:
   - All 10 vulnerability domains represented in static and semantic analysis engines.
   - All 6 supported languages (C, C++, Java, Python, JavaScript, TypeScript) have active security rules.
2. **Deterministic Performance**:
   - Static analysis completes in $< 20\text{ms}$ for standard code files ($< 1,000$ lines).
   - All regular expressions pass automated ReDoS safety verification ($< 5\text{ms}$ on adversarial inputs).
3. **Data Protection & Secret Handling**:
   - 100% of detected raw secrets are redacted prior to external Gemini API transmission.
   - Cleartext credentials and raw private keys are never persisted to MongoDB or logged.
4. **Duplicate Prevention & Fusion Precision**:
   - Overlapping findings with matching vulnerability domains are merged into `source: 'hybrid'`.
   - Distinct co-located vulnerabilities on the same line are both preserved.
5. **Score Integrity**:
   - Any confirmed Critical security vulnerability caps overall review score at $\le 74$ (Grade C ceiling).
   - Insecure code harboring Critical flaws cannot achieve Grade A or B.
6. **API Contract**:
   - `GET /api/v1/reviews/:id/security` returns 200 with isolated security findings, CWE tags, and OWASP categories for authorized users.
   - Cross-tenant requests return 404 Not Found.
7. **Frontend Presentation**:
   - FindingsPanel displays CWE badges, OWASP categories, and the `[HYBRID]` source indicator.
   - Critical Security Alert banner appears when Critical vulnerabilities exist.
   - One-click "Copy Fix" copies suggested remediations to clipboard.
8. **Regression Freedom**:
   - 100% of existing Phase 7 and Phase 8 tests pass without regressions.
   - Client production build (`npm run build`) completes with zero errors.

---

## 19. Risks and Limitations

| Risk / Limitation | Impact | Mitigation Strategy |
|---|---|---|
| **Heuristic Static False Positives** | Developer annoyance from false alarms on safe code | Preprocessor FSM comment masking; static string constant checks for SQL/Command rules; confidence classification (`HIGH` vs `MEDIUM`). |
| **ReDoS Vulnerability in New Regexes** | Catastrophic backtracking causing CPU freeze on malicious code | All regular expressions strictly eliminate nested unbounded quantifiers; automated ReDoS performance tests enforce $< 5\text{ms}$ execution limit. |
| **LLM Hallucination of Non-Existent Flaws** | Confusing findings without real security vulnerability | Gemini prompt explicitly commands model never to claim an exploit without code evidence; schema requires exact line and column bounds verified against source buffer length. |
| **Distinction from Dependency Scanners** | Users expect package lockfile CVE checks (e.g. Snyk) | Documentation and UI explicitly state that Phase 9 scans source code syntax and import patterns, not external vulnerability databases. |
| **Network Timeout During Gemini AI Review** | AI analysis unavailable on slow network | Deterministic static fallback mode activates automatically with zero crash, preserving all static security findings with honest nulls for AI scores. |
