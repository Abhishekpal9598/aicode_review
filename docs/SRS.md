# Software Requirements Specification (SRS)

## Project Name: AI Code Review
**Project Title**: Intelligent AI-Powered Code Analysis & Review Platform  
**Document Standard**: IEEE 830 / ISO/IEC/IEEE 29148 Compliant  
**Document Version**: 1.0.0  
**Status**: Formal Specification Approved  

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) establishes the complete, authoritative functional, non-functional, interface, and behavioral requirements for the **AI Code Review Platform**. It serves as the formal baseline for developers, architects, testers, and maintainers.

### 1.2 Scope of the System
The system is an AI-augmented source code review workstation. It accepts code inputs (via in-browser typing or file uploads across C, C++, Java, Python, JavaScript, and TypeScript), parses and inspects the code using hybrid static rules and Google Gemini AI, produces deterministic quality ratings (0–100), itemizes security and performance defects, and produces full side-by-side diff comparisons with copyable fixes.

### 1.3 Definitions, Acronyms, and Abbreviations
- **AST**: Abstract Syntax Tree.
- **CWE**: Common Weakness Enumeration.
- **LOC**: Lines of Code.
- **Monaco**: Microsoft’s browser-based code editor core.
- **OWASP**: Open Web Application Security Project.
- **RCE**: Remote Code Execution.
- **Zod**: TypeScript/JavaScript schema validation library with static type inference.

---

## 2. Overall System Description

### 2.1 Product Perspective
The platform is a decoupled client-server web application. The frontend runs as a single-page application (SPA) on modern evergreen browsers. The backend runs as a containerized RESTful API server connected to MongoDB Atlas for persistence and Google Gemini Cloud for generative reasoning.

```
[ User Browser ] <---> [ React 19 SPA ] <---> [ Express Backend ] <---> [ MongoDB Atlas ]
                                                      |
                                                      +---> [ Google Gemini API ]
```

### 2.2 System Interfaces
1. **User Interface (UI)**: Web-based, responsive interface adhering to Cybernetic Charcoal Developer Dark Mode standards with Monaco Editor integration.
2. **Software Interfaces (External)**:
   - *Google Gemini API*: HTTPS REST endpoint (`generativelanguage.googleapis.com`) transmitting structured JSON system instructions.
   - *MongoDB Atlas*: TLS 1.3 encrypted connection string using Mongoose driver.
3. **Communications Interfaces**: Secure HTTPS/TLS 1.3 encryption on all public endpoints. Secure HTTP cookies configured with `HttpOnly`, `SameSite=Strict`, `Secure`.

---

## 3. Specific Functional Requirements (FR)

### Module 1: Authentication & User Management
- **FR-AUTH-01 (Registration)**: System shall register users with name, unique email, and password. Passwords must be hashed using `bcrypt` (work factor $\ge 12$).
- **FR-AUTH-02 (Login)**: System shall verify user credentials and return a short-lived JWT access token along with an `HttpOnly` refresh token cookie.
- **FR-AUTH-03 (Session Validation)**: System shall validate user sessions on page loads via `GET /api/v1/auth/me`.
- **FR-AUTH-04 (Logout)**: System shall terminate active sessions and clear all authentication cookies on request.
- **FR-AUTH-05 (Tenant Isolation)**: System shall enforce strict tenant isolation, guaranteeing that users can only access code, reviews, and reports belonging to their own `userId`.

### Module 2: Code Ingestion & Editor Workspace
- **FR-ING-01 (Monaco Integration)**: System shall embed Monaco Editor supporting syntax highlighting, line numbers, code folding, and minimap.
- **FR-ING-02 (Language Support & Auto-Detection)**:
  - System shall support `Python`, `JavaScript`, `TypeScript`, `Java`, `C`, and `C++`.
  - System shall provide Auto Detect as the default mode, dynamically identifying the language via deterministic syntax scoring without remote AI calls.
  - System shall allow developers to manually select and lock any supported language; manual selections must strictly override auto-detection and remain fixed when code changes.
  - System shall provide visual status indicators (`Auto Detected`, `Manually Selected`, `Detection Uncertain`).
- **FR-ING-03 (Direct Input)**: System shall allow developers to paste or type up to 2,500 lines of code or 1,000,000 bytes.
- **FR-ING-04 (File Upload & Auto-Detection)**: System shall allow users to upload single source files with extensions (`.c`, `.cpp`, `.cc`, `.cxx`, `.java`, `.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.h`, `.hpp`) up to 1 MB in size, automatically setting the editor language and detecting ambiguous header extensions.
- **FR-ING-05 (Realtime Telemetry)**: Editor workspace shall display line count, character count, and file size in real time.

### Module 3: Dual-Layer Code Analysis
- **FR-ANA-01 (Static Pre-scan)**: System shall run regex and lexical heuristics prior to AI invocation to immediately identify hardcoded secrets and known unsafe system calls (e.g., `strcpy`, `eval`).
- **FR-ANA-02 (Gemini Semantic Analysis)**: System shall submit code with line numbers to Google Gemini API using structured JSON schema.
- **FR-ANA-03 (Schema Enforcement)**: System shall validate all AI outputs using Zod schema before processing. Malformed responses must trigger auto-repair or structured fallbacks.
- **FR-ANA-04 (Bug & Logic Detection)**: System shall identify null dereferences, infinite loops, boundary condition violations, race hazards, and variable shadowing.
- **FR-ANA-05 (Security Scanning)**: System shall identify injection vulnerabilities, insecure memory manipulation, and OWASP Top 10 patterns with severity classification (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`).
- **FR-ANA-06 (Performance & Complexity Analysis)**: System shall compute Big-O Time and Space complexities, flag inefficient iteration patterns, and recommend algorithmic improvements.
- **FR-ANA-07 (Maintainability & Clean Code)**: System shall analyze code readability, naming conventions, and modularity.

### Module 4: Scoring & Code Improvement Suggestions
- **FR-SCR-01 (Score Computation)**: System shall compute a deterministic Code Quality Score (0–100) using weighted penalty deductions normalized by code length.
- **FR-SCR-02 (Categorical Breakdown)**: System shall provide individual sub-scores for Bug Safety, Security, Performance, and Maintainability.
- **FR-SCR-03 (Actionable Explanations)**: System shall provide a technical explanation for each issue detailing why the issue is harmful and how the suggested fix resolves it.
- **FR-SCR-04 (Complete Refactored Code)**: System shall generate full, syntactically complete refactored replacement code without placeholder ellipses.

### Module 5: Side-by-Side Diff & Review Results
- **FR-DIF-01 (Interactive Findings List)**: System shall display issues categorized by severity and domain, with line range indicators.
- **FR-DIF-02 (Line Navigation)**: Clicking an issue card shall scroll the Monaco Editor directly to the relevant line range and display a highlight decoration.
- **FR-DIF-03 (Monaco Diff Viewer)**: System shall provide a side-by-side diff modal rendering original code on the left and refactored code on the right with inline additions/deletions.
- **FR-DIF-04 (Copy to Clipboard)**: System shall provide a one-click button to copy the refactored code to the user's clipboard.

### Module 6: History & Reports
- **FR-HIS-01 (Review Persistence)**: System shall automatically save completed reviews to MongoDB Atlas.
- **FR-HIS-02 (Search & Filtering)**: System shall provide search by title/filename and filtering by language, date, and score threshold.
- **FR-HIS-03 (Deletion)**: System shall allow users to delete individual reviews or batch clear history with confirmation.
- **FR-REP-01 (Report Export)**: System shall export review audits in JSON, Markdown, and print/PDF-optimized formats.

---

## 4. Non-Functional Requirements (NFR)

### 4.1 Performance & Latency (NFR-PERF)
- **NFR-PERF-01**: Static heuristic engine must complete analysis within 50 ms for any valid input ($\le 1\text{ MB}$).
- **NFR-PERF-02**: End-to-end review latency (static + Gemini + database persistence) must complete within 8.0 seconds for $\le 500$ LOC under normal network conditions.
- **NFR-PERF-03**: All non-analysis API endpoints (history list, stats, auth) must respond within 200 ms (p95).

### 4.2 Security & Threat Defense (NFR-SEC)
- **NFR-SEC-01 (Zero Code Execution)**: The server shall treat all user-submitted code strictly as untrusted plain text. Code shall NEVER be passed to `eval`, shell exec, or a compiler on the server.
- **NFR-SEC-02 (HTTP Headers)**: Helmet shall enforce strict security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and a restrictive Content Security Policy.
- **NFR-SEC-03 (Rate Limiting)**: Express-rate-limit shall restrict review generation calls to a maximum of 10 requests per minute per IP/user.
- **NFR-SEC-04 (Secret Protection)**: All API keys and JWT signing secrets must reside strictly in server environment variables.

### 4.3 Reliability & Availability (NFR-REL)
- **NFR-REL-01**: The platform shall maintain 99.9% monthly service availability.
- **NFR-REL-02**: In the event of an upstream Gemini API error (503/429/504), the server shall return a structured, graceful error response instructing the client to retry without crashing the server process.

### 4.4 Usability & Accessibility (NFR-USE)
- **NFR-USE-01**: Contrast ratios for all text in the Charcoal/Indigo theme must meet WCAG 2.1 AA standards ($\ge 4.5:1$).
- **NFR-USE-02**: All critical editor actions must be keyboard-accessible (e.g., `Ctrl+Enter` to analyze, `Esc` to close modal).

---

## 5. System Constraints

1. **Static Analysis Only**: No containerized sandbox runtime (e.g., Docker-in-Docker) is deployed in MVP v1.0. The platform is an analytical linter and reviewer, not a remote code runner.
2. **File Size Boundaries**: Ingested files are hard-capped at 1,048,576 bytes ($1\text{ MB}$) and 2,500 lines of code.
3. **Language Scope**: Restricted to 6 initial languages: C, C++, Java, Python, JavaScript, TypeScript.
4. **LLM Context Budget**: Prompts are constrained to standard Gemini 1.5 token limits ($\le 128\text{k}$ tokens).

---

## 6. Verification & Acceptance Criteria

| Req ID | Acceptance Test Scenario | Pass Criteria |
|---|---|---|
| **FR-AUTH-01** | Register user with existing email | Returns 409 Conflict with clear error message |
| **FR-AUTH-02** | Login with valid credentials | Sets HttpOnly cookie, returns 200 OK with user object |
| **FR-ING-04** | Upload `.py` file of 500 KB | File contents load into Monaco Editor with language set to Python |
| **FR-ING-04b**| Upload `.exe` or file $> 1\text{ MB}$ | Upload rejected on client and server with 400 Bad Request |
| **FR-ANA-01** | Submit C snippet with `strcpy` | Static engine flags `CWE-120` without waiting for AI response |
| **FR-ANA-02** | Submit Python bubble sort snippet | Gemini returns time complexity $O(n^2)$ with optimized suggestion |
| **FR-SCR-01** | Submit code with 1 Critical + 1 Medium issue | Quality score computes to $100 - (25 + 8) = 67$ (Grade C) |
| **FR-DIF-03** | Open Diff modal on completed review | Side-by-side Monaco diff shows red deletion and green addition hunks |
| **FR-HIS-03** | Delete past review as owner | Review and child issues deleted; foreign user receives 404/403 |
