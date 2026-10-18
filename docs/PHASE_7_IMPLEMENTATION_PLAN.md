# Phase 7 Implementation Plan: Deterministic Static Code Analysis Engine

## Document Metadata
- **Project**: AI Code Review — Intelligent AI-Powered Code Analysis & Review Platform
- **Phase**: Phase 7 — Deterministic Static Code Analysis Engine
- **Target Endpoint**: `POST /api/v1/analysis/static`
- **Target UI**: `/code-review` Workstation Findings Panel & Monaco Line Decorations
- **Status**: Revised Planning Stage (Awaiting Review & Approval)
- **Author**: Antigravity Assistant & Engineering Team
- **Date**: October 2026
- **Revision**: 2.1 (Lexical State Machine, Triple-Quoted String Boundaries, Same-Rule Deduplication, Exact Metric Schema, 1.75x Scoring Bound)

---

## 1. Executive Summary & Objective

The objective of **Phase 7** is to design and build a high-performance, deterministic **Static Code Analysis Engine** that inspects untrusted source code across all six supported languages (**C, C++, Java, Python, JavaScript, TypeScript**) without compiling or executing it.

The engine relies on a two-tier scanning pipeline:
1. **Raw Content Scanning** for hardcoded secrets, private keys, and cleartext credentials.
2. **Comment-Masked Lexical Scanning** for dangerous runtime operations, injection vectors, and severe code-quality hygiene flaws.

### Strict Phase Boundaries & Exclusions
- **In-Scope (Phase 7)**:
  - Server-side modular static analysis engine with language-specific rule registries.
  - Complete 32-rule deterministic registry across C, C++, Java, Python, JavaScript, and TypeScript.
  - Conservative comment-masking preprocessor preserving 1:1 line/column offsets to eliminate comment false positives.
  - Deterministic findings normalization conforming to `ReviewIssue` schema standards.
  - Mathematical Code Quality Scoring formula (0–100) with grade assignment (A–F) and diminishing repeat penalties.
  - Authenticated REST API endpoint `POST /api/v1/analysis/static` protected by Zod validation, JWT authentication, and an independent rate limiter (30 req/min).
  - Transient analysis results: returned exclusively in the HTTP 200 JSON envelope with **zero database persistence**.
  - Frontend Monaco Editor workstation integration: active "Analyze Code" trigger, findings side-panel, severity filter counts, stale-result invalidation on code edit, Monaco line gutter markers, line decorations, and safe jump-to-line navigation.
  - Comprehensive automated testing suite (backend rule tests, API schema tests, frontend interaction tests).
  - Production build verification (`npm run build`).
- **Explicit Exclusions (Future Phases)**:
  - **No Google Gemini or LLM integration** (deferred to Phase 8).
  - **No AI-generated refactoring code or conversational advice** (deferred to Phase 8).
  - **No review submission or database persistence** (`POST /api/v1/reviews` deferred to Phase 8).
  - **No comprehensive OWASP/CWE security scanner** (deferred to Phase 9).
  - **No deep algorithmic Big-O performance diagnostics** (deferred to Phase 10).
  - **Zero remote code execution (RCE) or sandboxing**: code is strictly treated as untrusted text strings. It is never compiled, evaluated with `eval()`, or executed using Node.js child processes (`exec`, `spawn`, `fork`).

---

## 2. Existing Architecture Assessment

### 2.1 Backend Architecture (Phases 1–5)
- **Runtime**: Node.js LTS (ES Modules) + Express 4.
- **Security & Middleware Chain** (`server/src/app.js`):
  - `helmet()`: Security response headers.
  - `cors({ credentials: true, origin })`: Strict origin matching.
  - `express.json({ limit: '2mb' })`: Global request payload limit (2 MB).
  - `cookieParser()`: HttpOnly cookie parsing.
  - `auth.middleware.js`: JWT verification attaching `req.user`.
  - `validate.middleware.js`: Generic Zod request schema validation.
  - `rateLimit.middleware.js`: Window rate limiting.
  - `error.middleware.js`: Centralized error handler using `ApiError`.
  - `ApiResponse.js`: Predictable JSON envelope `{ success, data, message, meta }`.
- **Database Model Standards**: `DATABASE_SCHEMA.md` Section 3.4 defines the `ReviewIssue` standard (`category`, `severity`, `title`, `description`, `lineStart`, `lineEnd`, `originalSnippet`, `suggestedSnippet`, `explanation`, `ruleId`, `source: 'static'`).

### 2.2 Frontend Architecture (Phase 6)
- **Workspace Page**: `client/src/pages/CodeReview.jsx` renders `EditorToolbar`, `MonacoEditorWrapper` (lazy-loaded), `EditorStatusBar`, and `FileUploadZone`.
- **State Management**: `useEditorState.js` handles code buffer, active language (C, C++, Java, Python, JS, TS), filename, dirty state, and versioned `sessionStorage` persistence (`aicode_editor_draft_v1`).
- **Toolbar Action**: `EditorToolbar.jsx` currently contains an "Analyze" button with a disabled badge ("Coming in Phase 8"). In Phase 7, this button will be activated to trigger static code analysis.
- **API Client**: `client/src/services/apiClient.js` provides centralized, credentialed HTTP request methods (`get`, `post`, `put`, `delete`).

---

## 3. Analysis Engine Architecture & Preprocessing Strategy

### 3.1 Two-Tier Scanning & Preprocessing Pipeline
Pure regex matching directly on raw source code is vulnerable to false positives when keywords appear inside comments or string literals. To solve this deterministically without heavy native AST parsers, the engine implements a two-tier scanning pipeline:

1. **Tier 1: Raw Content Scanning for Secrets (`SEC` rules)**
   - Hardcoded credentials often reside inside commented-out code (e.g. `// const apiKey = "AKIA..."` or `# password = "..."`).
   - Secret detection rules execute against the **raw, unmodified source code** so commented-out credentials and tokens are fully identified.

2. **Tier 2: Comment-Masked Lexical Scanning for Risky Patterns and Quality (`RISK` and `QUAL` rules)**
   - To prevent comments (e.g. `// We avoid using eval() here` or `# TODO: replace with pickle`) from triggering false positives, the source undergoes a **conservative lexical comment-masking preprocessor**.
   - Risky pattern and code quality rules execute exclusively against this comment-masked buffer.

### 3.2 Deterministic Lexical State Machine
The comment-masking preprocessor is implemented as a deterministic character-by-character **Lexical Finite State Machine (FSM)** tailored to the active programming language:

#### Parser States & Transition Boundaries:
1. `STATE_CODE` (Default):
   - Transitions to `STATE_LINE_COMMENT` on `//` (C, C++, Java, JS, TS) or `#` (Python).
   - Transitions to `STATE_BLOCK_COMMENT` on `/*` (C, C++, Java, JS, TS).
   - Transitions to `STATE_STRING_SINGLE` on `'`.
   - Transitions to `STATE_STRING_DOUBLE` on `"`.
   - Transitions to `STATE_STRING_BACKTICK` on `` ` `` (JS, TS template literals).
   - Transitions to `STATE_PYTHON_TRIPLE_STRING` on `"""` or `'''` (Python only).

2. `STATE_LINE_COMMENT`:
   - Active in C, C++, Java, JS, TS (after `//`) and Python (after `#`).
   - Terminated strictly by a newline (`\n` or `\r\n`).
   - **Masking Action**: Every character from the comment marker to the newline is replaced with a single space (`' '`). The newline character is preserved unchanged.

3. `STATE_BLOCK_COMMENT`:
   - Active in C, C++, Java, JS, TS (after `/*`).
   - Terminated strictly by `*/`.
   - **Masking Action**: Every character inside the block comment is replaced with a single space (`' '`), except newlines (`\n`), which are preserved intact.

4. `STATE_STRING_SINGLE`, `STATE_STRING_DOUBLE`, & `STATE_STRING_BACKTICK`:
   - Safely tracks string literal boundaries across all languages.
   - Handles escaped quotes (`\'`, `\"`, `` \` ``) and escape backslashes (`\\`) to prevent premature termination.
   - String literal contents are preserved as string data; any comment markers occurring inside strings (e.g., `"https://example.com"`, `'# not a comment'`) are treated strictly as string content and never trigger comment masking.

5. `STATE_PYTHON_TRIPLE_STRING` (Docstrings & Multiline Strings):
   - **Critical Python Boundary Rule**: In Python, triple-quoted blocks (`"""..."""` and `'''...'''`) are syntactically and semantically multiline string literals (used as docstrings or multiline text), **NOT ordinary comments**.
   - The preprocessor **does NOT classify Python docstrings or triple-quoted strings as comments**, and does NOT mask out their contents.
   - Tracking this distinct state guarantees that `#` characters occurring inside docstrings are not misidentified as line comments, and valid docstring code examples or documentation text are handled with syntactic accuracy.

#### Spatial Invariance (1:1 Line & Column Preservation):
- Masking preserves character offsets and line breaks with strict 1:1 spatial equality:
  - `maskedText.length === rawText.length`
  - `maskedText[i] === '\n'` if and only if `rawText[i] === '\n'`
- Any finding detected on line $L$, column $C$ in the masked text corresponds to the exact line $L$, column $C$ in the original source file.

### 3.3 Explicit Limitations of Regex-Based Analysis
The Static Code Analysis Engine is a deterministic lexical pattern-matching system. It has the following fundamental technical limitations:
- **No Data-Flow / Taint Analysis**: The engine cannot trace whether an argument passed to a function (e.g., `subprocess.run` or `child_process.exec`) originated from untrusted user HTTP input or a hardcoded internal constant.
- **No Pointer Aliasing or Control-Flow (CFG) Analysis**: The engine cannot determine whether a pointer in C/C++ is guaranteed to point to valid memory or whether `free()` was called through an alias.
- **No Compiler/AST-Level Verification**: The engine does not build a full Abstract Syntax Tree or Symbol Table. Rules are marked as heuristic pattern detectors, and findings are identified as static indicators, not formal compiler proofs.
- **C/C++ Memory Allocation Checks Omitted**: In accordance with technical reassessment, attempting to verify whether `malloc()` is checked for `NULL` using regex creates unacceptable false positives (due to macros, ternary guards, or helper allocator wrappers). This check is **explicitly deferred to future AST-based phases**. Rules that cannot be reliably distinguished without AST or semantic analysis are excluded from Phase 7.

---

## 4. Complete Static Code Analysis Rule Registry

The engine includes **32 discrete, deterministic rules** categorized into Security (`SEC`), Risky Code Patterns (`RISK`), and Code Quality (`QUAL`).

### Summary Registry Table

| Rule ID | Rule Name | Language | Category | Severity | Detection Target |
|---|---|---|---|---|---|
| `SEC-GEN-001` | Hardcoded AWS Access Key ID | All | SEC | CRITICAL | `AKIA[0-9A-Z]{16}` |
| `SEC-GEN-002` | Hardcoded GitHub Personal Access Token | All | SEC | HIGH | `ghp_[A-Za-z0-9_]{36}` |
| `SEC-GEN-003` | Hardcoded Private Key Block | All | SEC | CRITICAL | `-----BEGIN [A-Z ]*PRIVATE KEY-----` |
| `SEC-GEN-004` | Hardcoded JSON Web Token | All | SEC | HIGH | `eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}` |
| `SEC-GEN-005` | Cleartext Generic Credential Assignment | All | SEC | HIGH | `(password\|secret\|api_key)\s*[:=]\s*["'][^"']{8,}["']` |
| `RISK-PY-001` | Dynamic Code Execution (`eval`/`exec`) | Python | RISK | HIGH | `\b(eval\|exec)\s*\(` |
| `RISK-PY-002` | Insecure Deserialization (`pickle`) | Python | RISK | CRITICAL | `pickle\.(loads\|load)\s*\(` |
| `RISK-PY-003` | Command Injection (`subprocess` shell=True) | Python | RISK | HIGH | `subprocess\.[a-zA-Z_]+\([^)]*shell\s*=\s*True` |
| `QUAL-PY-001` | Bare `except:` Exception Handler | Python | QUAL | MEDIUM | `^\s*except\s*:\s*$` |
| `QUAL-PY-002` | Mutable Default Function Argument | Python | QUAL | MEDIUM | `def\s+\w+\([^)]*=\s*(\[\]\|\{\})` |
| `RISK-JS-001` | Dynamic Code Execution (`eval`/`new Function`) | JS | RISK | CRITICAL | `\b(eval\s*\( \| new\s+Function\s*\()` |
| `RISK-JS-002` | DOM Cross-Site Scripting (`innerHTML`) | JS | RISK | HIGH | `\.(innerHTML\|outerHTML)\s*=\s*[^;]+` |
| `RISK-JS-003` | Insecure Shell Concatenation (`child_process`) | JS | RISK | CRITICAL | `child_process\.exec\s*\([^)]*[\$\+]` |
| `QUAL-JS-001` | Empty Catch Block | JS | QUAL | LOW | `catch\s*\([^)]*\)\s*\{\s*\}` |
| `QUAL-JS-002` | Loose Equality Operator | JS | QUAL | LOW | `[^!=]==[^=] \| [^!]===[^=]` |
| `RISK-TS-001` | Dynamic Code Execution (`eval`/`new Function`) | TS | RISK | CRITICAL | `\b(eval\s*\( \| new\s+Function\s*\()` |
| `RISK-TS-002` | React Dangerous HTML Injection | TS | RISK | HIGH | `dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:` |
| `QUAL-TS-001` | Unsafe Type Escape Hatch (`any`) | TS | QUAL | LOW | `:\s*any\b \| \bas\s+any\b` |
| `QUAL-TS-002` | Empty Catch Block | TS | QUAL | LOW | `catch\s*\([^)]*\)\s*\{\s*\}` |
| `SEC-JAV-001` | Hardcoded JDBC Database Credentials | Java | SEC | HIGH | `DriverManager\.getConnection\([^)]*password=` |
| `RISK-JAV-001` | SQL Injection via String Concatenation | Java | RISK | CRITICAL | `Statement\.(executeQuery\|execute)\([^)]*SELECT[^)]*\+` |
| `RISK-JAV-002` | Insecure Object Deserialization | Java | RISK | CRITICAL | `ObjectInputStream\.readObject\s*\(` |
| `RISK-JAV-003` | Command Injection via `Runtime.exec` | Java | RISK | CRITICAL | `Runtime\.getRuntime\(\)\.exec\([^)]*\+` |
| `QUAL-JAV-001` | Catching `Throwable` or `Error` | Java | QUAL | MEDIUM | `catch\s*\(\s*(Throwable\|Error)\s+\w+\s*\)` |
| `QUAL-JAV-002` | Empty Catch Block | Java | QUAL | LOW | `catch\s*\([^)]*\)\s*\{\s*\}` |
| `RISK-C-001` | Unbounded Buffer Copy (`strcpy`) | C | RISK | CRITICAL | `\bstrcpy\s*\(\s*\w+\s*,\s*[^)]+\)` |
| `RISK-C-002` | Obsolete Dangerous Input (`gets`) | C | RISK | CRITICAL | `\bgets\s*\(\s*\w+\s*\)` |
| `RISK-C-003` | Unbounded Formatted Output (`sprintf %s`) | C | RISK | HIGH | `\bsprintf\s*\(\s*\w+\s*,\s*["'][^"']*%s` |
| `RISK-C-004` | Unbounded Input Read (`scanf %s`) | C | RISK | HIGH | `\bscanf\s*\(\s*["'][^"']*%s[^"']*["']` |
| `RISK-C-005` | Shell Execution via `system()` | C | RISK | HIGH | `\bsystem\s*\(\s*(\w+\s*\+\|"[^"]*"\s*\+)` |
| `RISK-CPP-001` | C-style Buffer Copy in C++ (`strcpy`) | C++ | RISK | HIGH | `\bstrcpy\s*\(` |
| `RISK-CPP-002` | Command Injection via `std::system` | C++ | RISK | HIGH | `(?:std::)?system\s*\([^)]*(\+|c_str)` |
| `QUAL-CPP-001` | Empty Catch-All Handler (`catch (...)`) | C++ | QUAL | LOW | `catch\s*\(\s*\.\.\.\s*\)\s*\{\s*\}` |

---

### Detailed Specification for Every Rule

#### 1. `SEC-GEN-001` — Hardcoded AWS Access Key ID
- **Name**: Hardcoded AWS Access Key ID
- **Language**: `all`
- **Category**: `SEC`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/(?:["'])AKIA[0-9A-Z]{16}(?:["'])/`
- **Positive Example**: `const awsKey = "AKIAIOSFODNN7EXAMPLE";`
- **Negative Example**: `const awsKey = process.env.AWS_ACCESS_KEY_ID;`
- **False-Positive Considerations**: Variable names in documentation examples containing dummy keys with `EXAMPLE`.
- **Recommended Remediation**: Remove cleartext credentials from source code. Load credentials from environment variables or a secure secret manager.

#### 2. `SEC-GEN-002` — Hardcoded GitHub Personal Access Token
- **Name**: Hardcoded GitHub Personal Access Token
- **Language**: `all`
- **Category**: `SEC`
- **Severity**: `HIGH`
- **Detection Condition**: `/(?:["'])ghp_[A-Za-z0-9_]{36}(?:["'])/`
- **Positive Example**: `github_token = "ghp_1234567890abcdef1234567890abcdef1234"`
- **Negative Example**: `github_token = os.environ.get("GITHUB_TOKEN")`
- **False-Positive Considerations**: Truncated or placeholder tokens in documentation.
- **Recommended Remediation**: Revoke the leaked token immediately and load credentials at runtime via secure environment configurations.

#### 3. `SEC-GEN-003` — Hardcoded Private Key Block
- **Name**: Hardcoded Private Key Block
- **Language**: `all`
- **Category**: `SEC`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/`
- **Positive Example**: `const key = "-----BEGIN RSA PRIVATE KEY-----\nMIIE...";`
- **Negative Example**: `const key = fs.readFileSync(process.env.KEY_PATH, 'utf8');`
- **False-Positive Considerations**: Public test keys in cryptographic testing suites.
- **Recommended Remediation**: Store private keys on disk with restrictive filesystem permissions (e.g., `chmod 600`) or in an encrypted KMS.

#### 4. `SEC-GEN-004` — Hardcoded JSON Web Token
- **Name**: Hardcoded JSON Web Token (JWT)
- **Language**: `all`
- **Category**: `SEC`
- **Severity**: `HIGH`
- **Detection Condition**: `/["']eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}["']/`
- **Positive Example**: `String auth = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.xyz";`
- **Negative Example**: `String auth = "Bearer " + request.getHeader("Authorization");`
- **False-Positive Considerations**: Decoded header mock constants in unit tests.
- **Recommended Remediation**: Inject dynamic authentication tokens via request headers or session cookies.

#### 5. `SEC-GEN-005` — Cleartext Generic Credential Assignment
- **Name**: Cleartext Generic Credential Assignment
- **Language**: `all`
- **Category**: `SEC`
- **Severity**: `HIGH`
- **Detection Condition**: `/(?i)(?:api[_-]?key|secret[_-]?token|auth[_-]?token|db[_-]?password|password)\s*[:=]\s*["'][a-zA-Z0-9_\-\.]{8,}["']/`
- **Positive Example**: `db_password = "productionMasterPassword#2026"`
- **Negative Example**: `db_password = os.environ.get("DB_PASSWORD")`
- **False-Positive Considerations**: Non-secret configurations like `secret_name = "production-key"`.
- **Recommended Remediation**: Replace hardcoded values with configuration files loaded from environment variables.

#### 6. `RISK-PY-001` — Dynamic Code Execution in Python (`eval`/`exec`)
- **Name**: Dangerous Dynamic Execution (`eval`/`exec`)
- **Language**: `python`
- **Category**: `RISK`
- **Severity**: `HIGH`
- **Detection Condition**: `/\b(?:eval|exec)\s*\(/`
- **Positive Example**: `result = eval(user_input)`
- **Negative Example**: `result = ast.literal_eval(user_input)`
- **False-Positive Considerations**: AST/compiler tool development.
- **Recommended Remediation**: Use `ast.literal_eval()` for parsing data structures or a dedicated mathematical expression evaluator.

#### 7. `RISK-PY-002` — Insecure Pickle Deserialization in Python
- **Name**: Insecure Object Deserialization (`pickle`)
- **Language**: `python`
- **Category**: `RISK`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/(?:pickle|_pickle)\s*\.\s*(?:loads|load)\s*\(/`
- **Positive Example**: `data = pickle.loads(network_packet)`
- **Negative Example**: `data = json.loads(network_packet)`
- **False-Positive Considerations**: Loading local static cache files created by the same application instance.
- **Recommended Remediation**: Avoid `pickle` for untrusted network input. Use `json`, `msgpack`, or Protocol Buffers.

#### 8. `RISK-PY-003` — Shell Injection in Python (`subprocess` shell=True)
- **Name**: Subprocess Command Execution with `shell=True`
- **Language**: `python`
- **Category**: `RISK`
- **Severity**: `HIGH`
- **Detection Condition**: `/subprocess\s*\.\s*(?:Popen|call|check_call|check_output|run)\s*\([^)]*shell\s*=\s*True/`
- **Positive Example**: `subprocess.run(f"grep {query} {file}", shell=True)`
- **Negative Example**: `subprocess.run(["grep", query, file], shell=False, check=True)`
- **False-Positive Considerations**: Static shell commands with zero variable interpolation.
- **Recommended Remediation**: Pass command arguments as an array of strings and set `shell=False`.

#### 9. `QUAL-PY-001` — Bare `except:` Exception Handler
- **Name**: Bare Exception Handler
- **Language**: `python`
- **Category**: `QUAL`
- **Severity**: `MEDIUM`
- **Detection Condition**: `/^\s*except\s*:\s*$/m`
- **Positive Example**: `try: do_work()\nexcept:\n pass`
- **Negative Example**: `try: do_work()\nexcept Exception as err:\n logger.error(err)`
- **False-Positive Considerations**: Top-level system daemon event loops.
- **Recommended Remediation**: Specify the caught exception (`except Exception:` or `except SpecificError:`).

#### 10. `QUAL-PY-002` — Mutable Default Function Argument
- **Name**: Mutable Default Function Argument
- **Language**: `python`
- **Category**: `QUAL`
- **Severity**: `MEDIUM`
- **Detection Condition**: `/def\s+[a-zA-Z_]\w*\s*\([^)]*=\s*(?:\[\]|\{\})\s*[,)]/`
- **Positive Example**: `def append_item(item, items=[]):`
- **Negative Example**: `def append_item(item, items=None):\n if items is None: items = []`
- **False-Positive Considerations**: Deliberate memoization caches using default dictionaries.
- **Recommended Remediation**: Default the parameter to `None` and instantiate the collection inside the function.

#### 11. `RISK-JS-001` — Dynamic Code Execution in JavaScript (`eval`/`new Function`)
- **Name**: Dangerous Dynamic Execution (`eval`/`new Function`)
- **Language**: `javascript`
- **Category**: `RISK`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/\b(?:eval\s*\(|new\s+Function\s*\()/`
- **Positive Example**: `const fn = new Function("x", userInput);`
- **Negative Example**: `const result = JSON.parse(userInput);`
- **False-Positive Considerations**: Browser sandboxes and web-based code interpreters.
- **Recommended Remediation**: Refactor code to use declarative mapping tables or `JSON.parse()`.

#### 12. `RISK-JS-002` — Direct DOM XSS Injection in JavaScript (`innerHTML`)
- **Name**: Direct DOM Injection (XSS Vulnerability)
- **Language**: `javascript`
- **Category**: `RISK`
- **Severity**: `HIGH`
- **Detection Condition**: `/\.\s*(?:innerHTML|outerHTML)\s*=\s*[^;]+|\bdocument\.write\s*\(/`
- **Positive Example**: `container.innerHTML = "<b>" + userComment + "</b>";`
- **Negative Example**: `container.textContent = userComment;`
- **False-Positive Considerations**: Assigning static string constants without variable interpolation.
- **Recommended Remediation**: Use `textContent` for raw strings, or sanitize with `DOMPurify.sanitize()` prior to assignment.

#### 13. `RISK-JS-003` — Insecure Shell Concatenation in JavaScript (`child_process.exec`)
- **Name**: Shell Command String Concatenation
- **Language**: `javascript`
- **Category**: `RISK`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/(?:child_process\s*\.\s*exec|exec\s*\()\s*\(\s*(?:`[^`]*\${|"[^"]*"\s*\+|'[^']*'\s*\+)/`
- **Positive Example**: `exec(`convert ${inputFile} output.png`);`
- **Negative Example**: `execFile('convert', [inputFile, 'output.png'], callback);`
- **False-Positive Considerations**: Concatenating known static path constants.
- **Recommended Remediation**: Use `execFile` or `spawn` with an array of arguments, preventing shell interpolation.

#### 14. `QUAL-JS-001` — Empty Catch Block in JavaScript
- **Name**: Empty Catch Block
- **Language**: `javascript`
- **Category**: `QUAL`
- **Severity**: `LOW`
- **Detection Condition**: `/catch\s*(?:\([^)]*\))?\s*\{\s*\}/`
- **Positive Example**: `try { localStorage.setItem('k', 'v'); } catch (e) {}`
- **Negative Example**: `try { ... } catch (e) { console.warn('Storage unavailable:', e); }`
- **False-Positive Considerations**: Feature-detection probes in legacy browser shims.
- **Recommended Remediation**: Log the exception or include a clarifying comment explaining why errors are ignored.

#### 15. `QUAL-JS-002` — Loose Equality Operator in JavaScript
- **Name**: Loose Equality Comparison
- **Language**: `javascript`
- **Category**: `QUAL`
- **Severity**: `LOW`
- **Detection Condition**: `/(?:[^!=]==[^=]|[^!]===[^=])/`
- **Positive Example**: `if (userRole == 0) { ... }`
- **Negative Example**: `if (userRole === 0) { ... }`
- **False-Positive Considerations**: Deliberate `== null` checks to test for both `null` and `undefined`.
- **Recommended Remediation**: Use strict equality (`===` and `!==`) to prevent unexpected type coercion bugs.

#### 16. `RISK-TS-001` — Dynamic Code Execution in TypeScript (`eval`)
- **Name**: Dangerous Dynamic Execution in TypeScript
- **Language**: `typescript`
- **Category**: `RISK`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/\b(?:eval\s*\(|new\s+Function\s*\()/`
- **Positive Example**: `const res = eval(userCode);`
- **Negative Example**: `const res = JSON.parse(userCode);`
- **False-Positive Considerations**: Internal code compilers.
- **Recommended Remediation**: Eliminate dynamic string evaluation.

#### 17. `RISK-TS-002` — React Dangerous HTML Injection in TypeScript
- **Name**: React Dangerous HTML Injection
- **Language**: `typescript`
- **Category**: `RISK`
- **Severity**: `HIGH`
- **Detection Condition**: `/dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/`
- **Positive Example**: `<div dangerouslySetInnerHTML={{ __html: postBody }} />`
- **Negative Example**: `<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(postBody) }} />`
- **False-Positive Considerations**: Pre-rendered static SVG icons.
- **Recommended Remediation**: Sanitize untrusted markup using `DOMPurify` before injecting it into the DOM.

#### 18. `QUAL-TS-001` — Type Safety Escape Hatch in TypeScript (`any`)
- **Name**: Explicit `any` Type Cast
- **Language**: `typescript`
- **Category**: `QUAL`
- **Severity**: `LOW`
- **Detection Condition**: `/:\s*any\b|\bas\s+any\b/`
- **Positive Example**: `function parse(data: any): any { return data as any; }`
- **Negative Example**: `function parse(data: unknown): UserRecord { ... }`
- **False-Positive Considerations**: Interfacing with un-typed third-party legacy JavaScript packages.
- **Recommended Remediation**: Use `unknown`, generic parameters, or explicit interfaces to preserve type safety.

#### 19. `QUAL-TS-002` — Empty Catch Block in TypeScript
- **Name**: Empty Catch Block
- **Language**: `typescript`
- **Category**: `QUAL`
- **Severity**: `LOW`
- **Detection Condition**: `/catch\s*(?:\([^)]*\))?\s*\{\s*\}/`
- **Positive Example**: `try { validate(); } catch (err) {}`
- **Negative Example**: `try { validate(); } catch (err) { logger.warn(err); }`
- **False-Positive Considerations**: Silent fallback in optional helper functions.
- **Recommended Remediation**: Handle or log errors appropriately.

#### 20. `SEC-JAV-001` — Hardcoded JDBC Database Credentials
- **Name**: Hardcoded JDBC Connection Credentials
- **Language**: `java`
- **Category**: `SEC`
- **Severity**: `HIGH`
- **Detection Condition**: `/DriverManager\.getConnection\s*\([^)]*["'][^"']*password\s*=[^"']*["']/i`
- **Positive Example**: `DriverManager.getConnection("jdbc:mysql://localhost/app?user=admin&password=123");`
- **Negative Example**: `DriverManager.getConnection(System.getenv("DB_URL"));`
- **False-Positive Considerations**: In-memory test H2 connections (`jdbc:h2:mem:test;DB_CLOSE_DELAY=-1`).
- **Recommended Remediation**: Extract connection parameters into environment variables or a configuration vault.

#### 21. `RISK-JAV-001` — SQL Injection via String Concatenation in Java
- **Name**: Unprepared SQL Statement Concatenation
- **Language**: `java`
- **Category**: `RISK`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/(?:Statement\s*\.\s*(?:executeQuery|executeUpdate|execute)|createQuery)\s*\(\s*(?:["'][^"']*SELECT[^"']*["']\s*\+|["'][^"']*INSERT[^"']*["']\s*\+|["'][^"']*UPDATE[^"']*["']\s*\+)/i`
- **Positive Example**: `stmt.executeQuery("SELECT * FROM accounts WHERE id = '" + accountId + "'");`
- **Negative Example**: `PreparedStatement ps = conn.prepareStatement("SELECT * FROM accounts WHERE id = ?"); ps.setString(1, accountId);`
- **False-Positive Considerations**: Multi-line static SQL queries split across strings without variable interpolation.
- **Recommended Remediation**: Use parameterized queries (`PreparedStatement`) with placeholders (`?`).

#### 22. `RISK-JAV-002` — Insecure Java Object Deserialization
- **Name**: Insecure Object Deserialization (`readObject`)
- **Language**: `java`
- **Category**: `RISK`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/ObjectInputStream\s*\.\s*readObject\s*\(/`
- **Positive Example**: `Object obj = ois.readObject();`
- **Negative Example**: `UserRecord record = objectMapper.readValue(stream, UserRecord.class);`
- **False-Positive Considerations**: Streams protected by a custom `ObjectInputFilter`.
- **Recommended Remediation**: Use structured formats like JSON or Protobuf. If native serialization is required, enforce an `ObjectInputFilter`.

#### 23. `RISK-JAV-003` — Command Injection via `Runtime.exec` in Java
- **Name**: Command Injection via `Runtime.exec`
- **Language**: `java`
- **Category**: `RISK`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/Runtime\.getRuntime\(\)\.exec\s*\(\s*(?:["'][^"']*["']\s*\+|[a-zA-Z_]\w*\s*\+)/`
- **Positive Example**: `Runtime.getRuntime().exec("sh script.sh " + userParam);`
- **Negative Example**: `new ProcessBuilder("sh", "script.sh", userParam).start();`
- **False-Positive Considerations**: Static string literals split across constants.
- **Recommended Remediation**: Use `ProcessBuilder` with an explicit string array of arguments.

#### 24. `QUAL-JAV-001` — Catching `Throwable` or `Error` in Java
- **Name**: Overly Broad Exception Handling (`Throwable`/`Error`)
- **Language**: `java`
- **Category**: `QUAL`
- **Severity**: `MEDIUM`
- **Detection Condition**: `/catch\s*\(\s*(?:Throwable|Error)\s+[a-zA-Z_]\w*\s*\)/`
- **Positive Example**: `try { process(); } catch (Throwable t) { ... }`
- **Negative Example**: `try { process(); } catch (Exception e) { ... }`
- **False-Positive Considerations**: Top-level thread dispatchers in framework containers.
- **Recommended Remediation**: Catch `Exception` rather than `Throwable` or `Error` so JVM fatal errors (`OutOfMemoryError`) are not caught.

#### 25. `QUAL-JAV-002` — Empty Catch Block in Java
- **Name**: Empty Catch Block
- **Language**: `java`
- **Category**: `QUAL`
- **Severity**: `LOW`
- **Detection Condition**: `/catch\s*\([^)]*\)\s*\{\s*\}/`
- **Positive Example**: `try { file.close(); } catch (IOException e) {}`
- **Negative Example**: `try { file.close(); } catch (IOException e) { log.warn(e); }`
- **False-Positive Considerations**: Interrupted exceptions in thread shutdown hooks.
- **Recommended Remediation**: Log exceptions or explain why they are safely suppressed.

#### 26. `RISK-C-001` — Buffer Overflow via `strcpy` in C
- **Name**: Unbounded String Copy (`strcpy`)
- **Language**: `c`
- **Category**: `RISK`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/\bstrcpy\s*\(\s*[a-zA-Z_]\w*\s*,\s*[^)]+\)/`
- **Positive Example**: `char dest[16]; strcpy(dest, src);`
- **Negative Example**: `strncpy(dest, src, sizeof(dest) - 1); dest[sizeof(dest) - 1] = '\0';`
- **False-Positive Considerations**: Copying static string literals where the literal size is provably smaller than the destination.
- **Recommended Remediation**: Use bounded string copy functions like `strncpy` or `snprintf`.

#### 27. `RISK-C-002` — Obsolete Dangerous Input Function in C (`gets`)
- **Name**: Obsolete Insecure Input Function (`gets`)
- **Language**: `c`
- **Category**: `RISK`
- **Severity**: `CRITICAL`
- **Detection Condition**: `/\bgets\s*\(\s*[a-zA-Z_]\w*\s*\)/`
- **Positive Example**: `char buf[64]; gets(buf);`
- **Negative Example**: `fgets(buf, sizeof(buf), stdin);`
- **False-Positive Considerations**: None (`gets()` is fundamentally unsafe and removed from ISO C11).
- **Recommended Remediation**: Replace `gets()` with `fgets(buf, sizeof(buf), stdin)`.

#### 28. `RISK-C-003` — Unbounded Formatted String Write in C (`sprintf %s`)
- **Name**: Unbounded Formatted Output (`sprintf %s`)
- **Language**: `c`
- **Category**: `RISK`
- **Severity**: `HIGH`
- **Detection Condition**: `/\bsprintf\s*\(\s*[a-zA-Z_]\w*\s*,\s*["'][^"']*%s/`
- **Positive Example**: `sprintf(out, "Record: %s", userInput);`
- **Negative Example**: `snprintf(out, sizeof(out), "Record: %s", userInput);`
- **False-Positive Considerations**: Writing fixed-width numbers or verified static strings.
- **Recommended Remediation**: Replace `sprintf()` with `snprintf()` and specify destination buffer capacity.

#### 29. `RISK-C-004` — Unbounded String Read in C (`scanf %s`)
- **Name**: Unbounded String Read (`scanf %s`)
- **Language**: `c`
- **Category**: `RISK`
- **Severity**: `HIGH`
- **Detection Condition**: `/\bscanf\s*\(\s*["'][^"']*%s[^"']*["']/`
- **Positive Example**: `char name[32]; scanf("%s", name);`
- **Negative Example**: `char name[32]; scanf("%31s", name);`
- **False-Positive Considerations**: Precision widths like `%31s` already present in format string.
- **Recommended Remediation**: Specify field width in the format string (e.g. `%31s` for a 32-byte buffer) or use `fgets()`.

#### 30. `RISK-C-005` — Shell Execution via `system()` in C
- **Name**: Shell Command Execution via `system()`
- **Language**: `c`
- **Category**: `RISK`
- **Severity**: `HIGH`
- **Detection Condition**: `/\bsystem\s*\(\s*(?:[a-zA-Z_]\w*|"[^"]*"\s*\+)/`
- **Positive Example**: `char cmd[100]; ... system(cmd);`
- **Negative Example**: `execvp(args[0], args);`
- **False-Positive Considerations**: Calling static system commands like `system("cls")`.
- **Recommended Remediation**: Use `execvp()` or `fork()`/`execve()` to execute commands without shell interpretation.

#### 31. `RISK-CPP-001` — C-style Buffer Copy in C++ (`strcpy`/`strcat`)
- **Name**: Unsafe C-style String Copy in C++
- **Language**: `cpp`
- **Category**: `RISK`
- **Severity**: `HIGH`
- **Detection Condition**: `/\b(?:strcpy|strcat)\s*\(/`
- **Positive Example**: `char buf[20]; strcpy(buf, input);`
- **Negative Example**: `std::string buf = input;`
- **False-Positive Considerations**: Interfacing with legacy C library wrappers.
- **Recommended Remediation**: Use `std::string` or `std::string_view` instead of raw character pointers.

#### 32. `RISK-CPP-002` — Command Injection via `std::system` in C++
- **Name**: Command Injection via `std::system`
- **Language**: `cpp`
- **Category**: `RISK`
- **Severity**: `HIGH`
- **Detection Condition**: `/(?:std::)?system\s*\([^)]*(\+|c_str)/`
- **Positive Example**: `std::system(("rm -rf " + path).c_str());`
- **Negative Example**: `std::filesystem::remove_all(path);`
- **False-Positive Considerations**: Running static script names without user arguments.
- **Recommended Remediation**: Use C++17 `std::filesystem` or native process spawning APIs.

#### 33. `QUAL-CPP-001` — Empty Catch-All Handler in C++ (`catch (...)`)
- **Name**: Empty Catch-All Handler
- **Language**: `cpp`
- **Category**: `QUAL`
- **Severity**: `LOW`
- **Detection Condition**: `/catch\s*\(\s*\.\.\.\s*\)\s*\{\s*\}/`
- **Positive Example**: `try { run(); } catch (...) {}`
- **Negative Example**: `try { run(); } catch (const std::exception& e) { std::cerr << e.what(); }`
- **False-Positive Considerations**: Destructors that must never throw.
- **Recommended Remediation**: Catch `const std::exception&` and log the exception reason.

---

## 5. Exact Mathematical Scoring Formula & Deduplication

### 5.1 Base Score, Rule Grouping & Fixed Severity Weights
Every source analysis starts with a pristine baseline score of **100**.

Each rule in the 32-rule registry has an immutable, fixed severity and a corresponding deduction weight $w(r)$:
- `CRITICAL`: **25 points**
- `HIGH`: **15 points**
- `MEDIUM`: **8 points**
- `LOW`: **3 points**
- `INFO`: **0 points**

Findings are grouped by unique `ruleId`. Severity is an inherent property of each registered rule and cannot vary dynamically.

### 5.2 Diminishing Penalty Formula & Maximum Cumulative Cap (1.75 × w)
If a rule triggers multiple times across a file (e.g. 10 occurrences of `QUAL-JS-001` loose equality), applying a linear deduction would unfairly reduce a large, functional file to a 0 score. The engine applies a deterministic diminishing factor per unique `ruleId`:

For a given rule $r$ with $k_r$ deduplicated occurrences:
- **1st occurrence** ($i = 1$): $d(1) = 1.0 \quad \Longrightarrow \quad 1.0 \times w(r)$
- **2nd occurrence** ($i = 2$): $d(2) = 0.5 \quad \Longrightarrow \quad 0.5 \times w(r)$ (cumulative $1.5 \times w(r)$)
- **3rd and subsequent occurrences** ($i \ge 3$): single combined marginal increment of $d(3) = 0.25 \quad \Longrightarrow \quad 0.25 \times w(r)$ (cumulative $1.75 \times w(r)$)

#### Closed-Form Cumulative Deduction:
$$\text{Deduction}(r) = w(r) \times \begin{cases} 
0 & \text{if } k_r = 0 \\
1.0 & \text{if } k_r = 1 \\
1.5 & \text{if } k_r = 2 \\
1.75 & \text{if } k_r \ge 3
\end{cases}$$

#### Natural Ceiling of $1.75 \times w(r)$ & Removal of Redundant Cap:
Because $1.0 + 0.5 + 0.25 = 1.75$, the cumulative deduction for any individual rule $r$ is naturally bounded at **$1.75 \times w(r)$**:
- `CRITICAL`: Maximum deduction $= 1.75 \times 25 = 43.75$ points (rounded to 44)
- `HIGH`: Maximum deduction $= 1.75 \times 15 = 26.25$ points (rounded to 26)
- `MEDIUM`: Maximum deduction $= 1.75 \times 8 = 14.0$ points
- `LOW`: Maximum deduction $= 1.75 \times 3 = 5.25$ points (rounded to 5)
- `INFO`: Maximum deduction $= 1.75 \times 0 = 0.0$ points

The previously considered $2.5 \times$ cap is mathematically redundant under this schedule and is removed from the active formula. (A higher cap parameter is documented solely as a design reserve for future engine versions if 4th+ occurrences ever accrue separate marginal penalties).

### 5.3 Overall Score Calculation
The final Static Code Quality Score ($Q_{\text{static}}$) is:

$$Q_{\text{static}} = \max\left(0, \min\left(100, \text{round}\left(100 - \sum_{r \in \text{Rules}} \text{Deduction}(r)\right)\right)\right)$$

Identical source code and language will **always** produce the exact same score.

### 5.4 Grade Boundaries
- **Score 90–100**: Grade **A** (Clean code, zero Critical or High issues)
- **Score 75–89**: Grade **B** (Good code, minor quality or low/medium findings)
- **Score 60–74**: Grade **C** (Acceptable, contains High findings or multiple defects)
- **Score 40–59**: Grade **D** (Poor quality, multiple High or Critical vulnerabilities)
- **Score 0–39**: Grade **F** (Severe security hazards or critical bugs)

### 5.5 Finding Identity Fields & Strict Same-Rule Deduplication

#### Finding Identity Fields:
Every normalized finding conforms to the standard `ReviewIssue` contract:
- `id`: Unique per-run string identifier (e.g. `finding_1_risk_js_001`).
- `ruleId`: Unique registered rule identifier string (e.g. `RISK-JS-001`, `SEC-GEN-001`).
- `category`: Category string (`SEC`, `RISK`, `QUAL`).
- `severity`: Fixed severity string (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`).
- `lineStart`: 1-based start line number in original code.
- `lineEnd`: 1-based end line number in original code.
- `columnStart`: 1-based start column.
- `columnEnd`: 1-based end column.
- `originalSnippet`: Extracted code snippet matching the violation.
- `suggestedSnippet`: Remediated replacement code.
- `explanation`: Educational context and security guidance.
- `source`: Fixed string `'static'`.

#### Strict Same-Rule Deduplication:
1. **Deduplication Scope**: Deduplication applies **strictly to matches sharing the identical `ruleId`**.
   - If multiple regex matches for the **same `ruleId`** overlap or occupy the same line range (`lineStart` to `lineEnd`), they are collapsed into a single finding for that `ruleId`.
   - The collapsed finding's column range (`columnStart` to `columnEnd`) and `originalSnippet` are extended to envelop the full matched span.
2. **Never Merge Different Rule IDs**:
   - Findings originating from **different `ruleId`s are NEVER merged**, even if they occur on the exact same line.
   - For example, if line 24 contains both a hardcoded token (`SEC-GEN-005`) and an insecure dynamic call (`RISK-JS-001`), both findings are preserved in their entirety as distinct, individual issues.
3. **Pipeline Ordering**:
   - Deduplication executes **immediately after rule evaluation and before metrics aggregation or scoring**.
   - Scoring penalties, severity counts, and category statistics are calculated **strictly over the deduplicated findings list**.

#### Deterministic Sort Order:
After deduplication, findings are deterministically sorted:
- Primary: Severity weight descending (`CRITICAL` > `HIGH` > `MEDIUM` > `LOW` > `INFO`).
- Secondary: Line number ascending (`lineStart`).
- Tertiary: Column number ascending (`columnStart`).
- Quaternary: Rule ID alphabetical.

---

## 6. Express Request Size & Validation Architecture

### 6.1 Body Parser Limit Inspection
- Existing `server/src/app.js` line 32:
  ```javascript
  app.use(express.json({ limit: '2mb' }));
  ```
- A 1 MB UTF-8 source code file serialized inside a JSON envelope (`{ "code": "...", "language": "...", "fileName": "..." }`) with newline escaping (`\n`) has approximately 5% to 15% serialization overhead (~1.05 MB to 1.15 MB total payload).
- This is **well within the existing 2 MB limit**.
- **No changes are required to `server/src/app.js`**. Other endpoints remain protected by their existing route-specific schemas.

### 6.2 Endpoint-Specific Validation (`staticAnalysisSchema`)
In `server/src/schemas/analysis.schema.js`, the request body is strictly validated using Zod:

```javascript
import { z } from 'zod';

export const staticAnalysisSchema = {
  body: z.object({
    code: z
      .string({ required_error: 'Source code is required' })
      .refine((val) => val.trim().length > 0, {
        message: 'Source code cannot be empty or contain only whitespace'
      })
      .refine((val) => Buffer.byteLength(val, 'utf8') <= 1048576, {
        message: 'Source code exceeds maximum size limit (1 MB)'
      })
      .refine((val) => val.split(/\r\n|\r|\n/).length <= 2500, {
        message: 'Source code exceeds maximum line count limit (2,500 LOC)'
      }),
    language: z.enum(
      ['c', 'cpp', 'java', 'python', 'javascript', 'typescript'],
      { required_error: 'Supported language identifier is required' }
    ),
    title: z.string().trim().max(120, 'Title cannot exceed 120 characters').optional(),
    fileName: z.string().trim().max(120, 'Filename cannot exceed 120 characters').optional()
  })
};
```

---

## 7. Transient Results Architecture

In strict adherence to Phase 7 boundaries:
- **Zero Database Persistence**:
  - No Mongoose documents (`CodeReview`, `ReviewIssue`, `AnalysisResult`) are created or saved to MongoDB.
  - The database connection is never queried or touched by static analysis.
  - Findings are computed entirely in volatile server memory and returned strictly in the HTTP response envelope.
- **Standardized Response Envelope**:
  - The response payload follows the fields defined in `DATABASE_SCHEMA.md` Section 3.4 for seamless future Phase 8 compatibility, but is explicitly marked with `transient: true`.

```json
{
  "success": true,
  "message": "Static code analysis completed successfully",
  "data": {
    "transient": true,
    "language": "python",
    "fileName": "main.py",
    "metrics": {
      "totalLines": 42,
      "analyzedLines": 38,
      "totalFindings": 1,
      "securityFindings": 1,
      "riskFindings": 0,
      "qualityFindings": 0,
      "severityCounts": {
        "critical": 0,
        "high": 1,
        "medium": 0,
        "low": 0,
        "info": 0
      },
      "characterCount": 1250,
      "executionTimeMs": 14
    },
    "scoring": {
      "overallScore": 85,
      "grade": "B",
      "categoryScores": {
        "security": 85,
        "risk": 100,
        "quality": 100
      },
      "disclaimer": "The Static Code Quality Score is a deterministic rating calculated solely from pattern matching and static heuristics. It does not certify absolute security or production suitability."
    },
    "findings": [
      {
        "id": "finding_1_sec_gen_005",
        "ruleId": "SEC-GEN-005",
        "title": "Cleartext Generic Credential Assignment",
        "category": "SEC",
        "severity": "HIGH",
        "lineStart": 14,
        "lineEnd": 14,
        "columnStart": 5,
        "columnEnd": 45,
        "originalSnippet": "api_key = \"superSecretToken12345\"",
        "suggestedSnippet": "api_key = os.environ.get(\"API_KEY\")",
        "explanation": "Hardcoded credentials in source code can easily be leaked to version control. Load secrets from environment variables.",
        "source": "static"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-10-15T00:50:00.000Z",
    "engineVersion": "1.0.0-static"
  }
}
```

### 7.3 Mathematical Derivation of Metrics
Every metric returned in `data.metrics` is calculated dynamically and deterministically from the raw code and the deduplicated findings list. **No mock, default, or hardcoded values are ever returned**:
- `totalLines`: Total line count computed directly from the source buffer (`code.split(/\r\n|\r|\n/).length`).
- `analyzedLines`: Count of lines that contain non-whitespace code or docstrings.
- `totalFindings`: Total count of deduplicated findings (`findings.length`).
- `securityFindings`: `findings.filter(f => f.category === 'SEC').length`.
- `riskFindings`: `findings.filter(f => f.category === 'RISK').length`.
- `qualityFindings`: `findings.filter(f => f.category === 'QUAL').length`.
- `severityCounts`:
  - `critical`: `findings.filter(f => f.severity === 'CRITICAL').length`.
  - `high`: `findings.filter(f => f.severity === 'HIGH').length`.
  - `medium`: `findings.filter(f => f.severity === 'MEDIUM').length`.
  - `low`: `findings.filter(f => f.severity === 'LOW').length`.
  - `info`: `findings.filter(f => f.severity === 'INFO').length`.
- `executionTimeMs`: High-resolution wall-clock duration (`process.hrtime` converted to integer ms).

#### Mathematical Metric Invariants:
$$\text{totalFindings} = \text{securityFindings} + \text{riskFindings} + \text{qualityFindings}$$
$$\text{totalFindings} = \text{critical} + \text{high} + \text{medium} + \text{low} + \text{info}$$
$$\text{analyzedLines} \le \text{totalLines}$$

---

## 8. Frontend Result Consistency & Monaco Integration

### 8.1 Result Lifecycle & Stale Data Invalidation
To prevent displaying outdated analysis results for newly modified code:
1. **Invalidation on Edit**:
   - Whenever the code buffer changes (`updateCode` in `useEditorState`), or the language changes, or a new file is uploaded:
   - Existing analysis results are marked as **stale**:
     - Either cleared immediately (`setAnalysisResults(null)`), or
     - Displayed with an amber banner: *"Source code modified since last analysis. Click 'Analyze Code' to refresh findings."*
2. **Monaco Decoration Cleanup**:
   - Decoration IDs are tracked in a React ref: `decorationsRef = useRef([])`.
   - On every code edit or clear action, `editor.deltaDecorations(decorationsRef.current, [])` is called immediately to wipe line highlights and gutter markers.
3. **Safe Bounds Checking for Line Navigation**:
   - When a user clicks a finding card, `editor.revealLineInCenter(lineStart)` is called only after verifying:
     ```javascript
     const lineCount = editor.getModel()?.getLineCount() || 1;
     const targetLine = Math.min(Math.max(1, finding.lineStart), lineCount);
     editor.revealLineInCenter(targetLine);
     editor.setPosition({ lineNumber: targetLine, column: 1 });
     ```

### 8.2 Severity Filter Tabs & Empty Filter States
- Tabs display live counts: `All (3)`, `Critical (1)`, `High (1)`, `Medium (0)`, `Low (1)`.
- If a user selects a tab with 0 findings (e.g. `Critical (0)`), the panel displays an informative empty card:
  *"No Critical severity findings detected in this file."*
- Findings can be toggled between **Severity View** and **Category View** (`Security`, `Risky Patterns`, `Code Quality`).

### 8.3 Copy Fix Safety
- Finding cards feature a "Copy Fix" button with a clipboard icon.
- Clicking the button writes `finding.suggestedSnippet` to `navigator.clipboard.writeText`.
- **Zero Code Mutation**: The button does **not** silently overwrite or modify the editor content. The user retains complete control over editing.

---

## 9. Rate Limiting Architecture

An independent rate limiter will be implemented in `server/src/middleware/rateLimit.middleware.js`:

```javascript
import rateLimit from 'express-rate-limit';

export const staticAnalysisLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many analysis requests. Please wait a moment before analyzing again.'
    }
  }
});
```

- **Separation of Concerns**: Operates independently from authentication rate limiters (which restrict login brute-force attempts).
- **Limitation Documentation**: This in-memory limiter stores hit counts in process memory. It is suitable for single-node deployments. Multi-instance cluster scaling would require a shared Redis store (deferred to future deployment scaling phases).

---

## 10. Testing Strategy

The test plan covers 100% of the newly introduced static analysis logic:

### 10.1 Backend Test Plan (`server/tests/staticAnalyzer.test.js`)
1. **Universal Secret Detection**: Tests positive and negative detection for AWS keys (`SEC-GEN-001`), GitHub tokens (`SEC-GEN-002`), private keys (`SEC-GEN-003`), JWTs (`SEC-GEN-004`), and passwords (`SEC-GEN-005`).
2. **Comment-Masking False-Positive Isolation**: Verifies that `eval()` inside `// comment` or `# comment` does NOT trigger `RISK-PY-001` or `RISK-JS-001`.
3. **Language Rules**:
   - Python: verifies `eval()`, `pickle.loads()`, `shell=True`, bare `except:`, mutable default args.
   - JS/TS: verifies `eval()`, `innerHTML`, `child_process.exec()`, empty `catch`, `as any`.
   - Java: verifies hardcoded JDBC, SQL concatenation, `ObjectInputStream.readObject()`, `catch (Throwable)`.
   - C/C++: verifies `strcpy()`, `gets()`, `sprintf()`, unconstrained `scanf()`, `system()`, and empty `catch (...)`.
4. **Diminishing Penalty & Scoring**: Verifies exact mathematical score calculations:
   - 1 Critical finding: $100 - 25 = 75$ (Grade B).
   - 2 Critical findings: $100 - (25 + 12.5) = 62.5 \approx 63$ (Grade C).
   - Score boundaries: verify score cannot go below 0 or above 100.
5. **Deduplication Engine**: Verifies that identical rules on overlapping lines collapse into a single finding, while different rule IDs occurring on the same line remain completely distinct.
6. **API Validation & Guardrails**:
   - Unauthenticated request: returns 401.
   - Unsupported language: returns 400 `VALIDATION_ERROR`.
   - Oversized payload ($> 1\text{ MB}$): returns 400 `VALIDATION_ERROR`.
   - Empty or whitespace-only code: returns 400 `VALIDATION_ERROR`.
   - Valid payload: returns 200 with complete `ApiResponse` schema and `transient: true`.

### 10.2 Frontend Test Plan (`client/src/test/staticAnalysis.test.jsx`)
1. **Analyze Button Activation**: Verifies clicking "Analyze Code" sends request to `apiClient.analyzeCode`.
2. **Loading State**: Verifies spinner and disabled state during analysis.
3. **Findings Panel**: Verifies findings render with correct badges, snippets, and rule IDs.
4. **Filter Tabs**: Verifies filtering by Critical, High, etc., filters the list and shows correct counts.
5. **Monaco Line Navigation**: Verifies clicking finding calls `revealLineInCenter` and applies line decorations.
6. **Stale Data Invalidation**: Verifies editing code clears decorations and marks findings stale.
7. **Clean Zero-State**: Verifies Grade A (100) card renders when findings array is empty.
8. **Error Handling**: Verifies error banner and retry button render on API failure.

---

## 11. Acceptance Criteria

Phase 7 implementation will be declared complete when:
1. All 32 rules in the complete registry execute deterministically with zero code execution.
2. The preprocessor implements a deterministic lexical state machine that masks line and block comments, preserves Python triple-quoted docstrings/strings without classifying them as comments, and maintains 1:1 line/column offsets.
3. `malloc` null-check is excluded from Phase 7 to prevent weak heuristic false alarms.
4. Mathematical score calculation adheres to the exact diminishing penalty formula (maximum $1.75 \times$ severity weight per `ruleId`) and grade boundaries.
5. The API `POST /api/v1/analysis/static` is guarded by JWT authentication, Zod validation, and rate limiting (30 req/min).
6. Results are returned strictly in the HTTP 200 JSON envelope with **zero database persistence**.
7. Frontend findings panel renders findings with dynamic filter counts, jump-to-line navigation, and stale data invalidation.
8. All automated backend and frontend tests pass cleanly with exit code 0.
9. Client production build (`npm run build`) succeeds with exit code 0.
10. Zero Gemini API or AI functionality is introduced.
11. Phases 1–6 remain completely intact.
