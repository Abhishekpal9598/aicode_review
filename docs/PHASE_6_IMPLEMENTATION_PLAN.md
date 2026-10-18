# Phase 6 Implementation Plan: Monaco Code Editor Integration

## Document Metadata
- **Project**: AI Code Review — Intelligent AI-Powered Code Analysis & Review Platform
- **Phase**: Phase 6 — Monaco Code Editor Integration
- **Target Route**: `/code-review` (`AppRoutes.jsx`)
- **Status**: Revised & Approved for Implementation (Awaiting Final Confirmation)
- **Author**: Antigravity Assistant & Engineering Team
- **Date**: October 2026
- **Revision**: 2.0 (Self-Hosted Monaco, Lazy Loading, Strict Language Switching & Safety Rules)

---

## 1. Executive Summary & Objective

The objective of **Phase 6** is to deliver a developer-centric, VS Code-inspired browser-based code editing workstation within the existing `/code-review` page. The workstation embeds a **locally bundled, self-hosted Monaco Editor** (`@monaco-editor/react` + `monaco-editor`) styled in the Cybernetic Charcoal & Obsidian dark palette, supporting 6 target programming languages (C, C++, Java, Python, JavaScript, TypeScript), multi-format client-side file upload ingestion ($\le 1\text{ MB}$), real-time telemetry (LOC, character count, byte size), and robust state management with versioned session persistence and code destruction guards.

### Strict Phase Boundaries
- **In-Scope (Phase 6)**:
  - Locally bundled / self-hosted Monaco Editor integration, dark theme, and font/indentation configuration.
  - Component-level lazy loading (`React.lazy`) to prevent bundle bloat on initial application load.
  - Multi-language support and dynamic grammar switching (C, C++, Java, Python, JavaScript, TypeScript) with zero code-loss rules.
  - High-density IDE toolbar with language picker, file name indicator, Upload, Copy, Clear, and Reset actions (with confirmation guard).
  - Client-side file upload validation (extensions, 1 MB cap, non-empty, UTF-8 reading, and `.h` ambiguous header resolution).
  - Versioned session storage state management (`aicode_editor_draft_v1`) resilient to corrupted data and private browsing quotas.
  - Loading skeleton and error fallback.
  - Comprehensive automated tests with Vitest and React Testing Library (12 tests).
  - Production build verification (`npm run build`).
- **Out-of-Scope (Future Phases)**:
  - No Google Gemini API integration (deferred to Phase 8).
  - No deterministic static analysis or AST scanning (deferred to Phase 7).
  - No security scanner or OWASP vulnerability detection (deferred to Phase 7 & 9).
  - No performance/Big-O analysis (deferred to Phase 10).
  - No backend review submission or MongoDB persistence (`POST /api/v1/reviews` deferred to Phase 8).
  - No arbitrary code execution or server sandboxing (explicitly forbidden).

---

## 2. Existing Architecture Assessment & Test Baseline

### 2.1 Frontend Stack & Design Tokens
- **Framework**: React 19 (`^19.0.0`) + Vite 6 (`^6.2.0`).
- **Routing**: React Router 7 (`react-router-dom: ^7.2.0`). Existing route `/code-review` renders `client/src/pages/CodeReview.jsx` inside `MainLayout`.
- **Styling**: Tailwind CSS with custom tokens in `tailwind.config.js`:
  - Canvas: `#0A0D12` (`bg-canvas`)
  - Primary Surface: `#111620` (`bg-surface-primary`)
  - Secondary Surface: `#18202F` (`bg-surface-secondary`)
  - Tertiary Surface: `#222D42` (`bg-surface-tertiary`)
  - Subtle Border: `#263248` (`border-border-subtle`)
  - Primary Brand / Accent: `#6366F1` (`text-brand-primary` / `bg-brand-primary`)
  - Text: Slate 100 `#F1F5F9` (`text-text-primary`), Slate 400 `#94A3B8` (`text-text-secondary`), Slate 500 `#64748B` (`text-text-muted`)
  - Monospace Font: `'JetBrains Mono', 'Fira Code', Consolas, monospace`.
- **Component Primitives**:
  - `client/src/components/ui/`: `Button.jsx`, `Badge.jsx`, `Card.jsx`, `StatusPill.jsx`.
  - `client/src/components/common/`: `PageHeader.jsx`, `EmptyState.jsx`, `ErrorMessage.jsx`, `LoadingSpinner.jsx`.

### 2.2 Verified Client Test Baseline
The existing client test suite has been inspected and verified:
- `client/src/test/ScoreRing.test.jsx`: 4 tests
- `client/src/test/filter.test.jsx`: 4 tests
- `client/src/test/dashboard.test.jsx`: 7 tests
- **Total Existing Client Tests**: **15 tests** (all currently passing).
- **Phase 6 Addition**: 12 new automated tests (`codeReview.test.jsx`).
- **Target Client Test Suite After Phase 6**: **27 tests** ($15 + 12 = 27$).

---

## 3. Monaco Loading & Performance Strategy

### 3.1 CDN vs. Locally Bundled Evaluation

| Evaluation Criteria | CDN-Based Loading (`@monaco-editor/loader` default) | Locally Bundled / Self-Hosted (`monaco-editor` npm) |
|---|---|---|
| **Production Reliability** | Dependent on external CDN uptime (`jsdelivr.net`). Third-party outages break editor. | **100% self-hosted & immune to external CDN downtime.** |
| **Offline Capability** | Fails completely in air-gapped, offline, or restricted networks. | **Works 100% offline without internet connection.** |
| **Security & CSP** | Requires relaxing Content Security Policy (`script-src`, `connect-src`, `worker-src` allowing CDN). | **Strict CSP compliant (`script-src 'self'`, `worker-src 'self' blob:`). Zero 3rd-party origins.** |
| **Version Determinism** | Dynamic CDN resolution risks unintended patch version shifts. | **Strictly locked via `package-lock.json`.** |
| **Vite 6 Compatibility** | Simple wrapper setup, but violates local bundle integrity. | **Native Vite worker bundling using `?worker` query parameters.** |

### 3.2 Selected Strategy: Self-Hosted Monaco with Native Vite Workers
We adopt the **locally bundled, self-hosted approach**:
1. Install `monaco-editor` alongside `@monaco-editor/react`.
2. Configure `@monaco-editor/react` to use the locally imported `monaco` instance via `loader.config({ monaco })`.
3. Configure Vite web workers using Vite's native `?worker` syntax in a dedicated worker configuration module (`client/src/config/monacoWorkers.js`):
   ```javascript
   import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
   import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
   import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
   import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
   import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';

   window.MonacoEnvironment = {
     getWorker(_workerId, label) {
       if (label === 'typescript' || label === 'javascript') {
         return new tsWorker();
       }
       if (label === 'json') return new jsonWorker();
       if (label === 'css') return new cssWorker();
       if (label === 'html') return new htmlWorker();
       return new editorWorker();
     }
   };
   ```
4. This completely eliminates external CDN reliance, ensures deterministic builds, and adheres to strict enterprise CSP directives.

### 3.3 Performance Optimization: Component-Level Lazy Loading
Monaco Editor is a substantial library (~2–3 MB unminified). To guarantee that the initial application load (e.g. `/dashboard`, `/login`) remains exceptionally fast:
- `MonacoEditorWrapper` is **lazy-loaded** in `client/src/pages/CodeReview.jsx` using `React.lazy`:
  ```javascript
  const MonacoEditorWrapper = React.lazy(() => import('../components/editor/MonacoEditorWrapper'));
  ```
- Wrapped in `<React.Suspense fallback={<EditorLoadingSkeleton />}>`.
- Result: Vite and Rollup isolate Monaco and its web workers into asynchronous chunks that are fetched **only** when the user navigates to `/code-review`.

---

## 4. Language Switching & Buffer Preservation Rules

To guarantee that user-written code is **never silently destroyed**, language switching follows strict deterministic rules:

| Condition | State Trigger | Editor Buffer Behavior | Filename Behavior | Rationale |
|---|---|---|---|---|
| **Case 1: Empty Editor** | `code.trim() === ''` | Buffer remains empty (`""`). | Updates default filename to new language (e.g. `main.py` $\rightarrow$ `index.js`). | User has cleared or not yet typed; maintains empty state. |
| **Case 2: Untouched Starter Template** | `!isDirty` | Buffer updates to the new language's default starter template. | Updates default filename to new language. | User is browsing language presets before writing code. |
| **Case 3: User-Modified Code** | `isDirty === true` and `code.trim() !== ''` | **PRESERVE CODE BUFFER EXACTLY.** Monaco updates syntax tokenization to the new language. | Preserves base filename, updates extension only if original was default filename. | **Absolute protection against accidental data loss.** |

---

## 5. File Extension Mapping & Ambiguous Header Resolution

Supported file extensions and their deterministic language mappings:

| Extension | Language | Monaco Language ID | Default Filename | Notes |
|---|---|---|---|---|
| `.py` | Python | `python` | `main.py` | Full syntax & indentation |
| `.js`, `.jsx`, `.mjs`, `.cjs` | JavaScript | `javascript` | `index.js` | ES6+, JSX grammar |
| `.ts`, `.tsx` | TypeScript | `typescript` | `index.ts` | Type definitions, TSX |
| `.java` | Java | `java` | `Solution.java` | Standard class template |
| `.c` | C | `c` | `main.c` | Standard C syntax |
| **`.h`** | **C (Default)** | **`c`** | **`header.h`** | **Ambiguous Header Resolution: Defaults to C. The user can manually switch the language selector to C++ at any time with one click, preserving code.** |
| `.cpp`, `.hpp`, `.cc`, `.cxx` | C++ | `cpp` | `solution.cpp` | Modern C++ grammar |

### Rejection Policy for Unsupported Formats
- Files with extensions outside this table (e.g., `.txt`, `.pdf`, `.exe`, `.json`, `.csv`) are rejected client-side before reading.
- Rejection message: *"Unsupported file format '.xyz'. Supported formats: .c, .h, .cpp, .hpp, .java, .py, .js, .jsx, .ts, .tsx"*.
- Buffer remains untouched upon rejection.

---

## 6. Initial State, Actions & Safety Guardrails

### 6.1 First-Time Initial State
- Default Language: `python`.
- Default Filename: `main.py`.
- Buffer: High-quality starter snippet demonstrating functions, type hints, docstrings, and algorithmic comments.
- Dirty State: `isDirty = false`.

### 6.2 Editor Actions & Safety Guardrails
1. **Upload Code**:
   - Triggers native file browser or accepts drag-and-drop.
   - Enforces 1 MB limit ($1,048,576\text{ bytes}$).
   - Enforces non-empty ($> 0\text{ bytes}$).
   - Validates extension, reads as UTF-8 string via `FileReader`, updates language, updates filename, marks `isDirty = true`.
2. **Clear Code**:
   - Empties buffer (`code = ""`).
   - Marks `isDirty = true`.
3. **Reset Editor**:
   - Restores default starter template for the active language and sets `isDirty = false`.
   - **Destruction Guard**: If `isDirty === true` and `code.trim() !== ''`, clicking Reset does **not** silently overwrite code. It prompts the user for confirmation (inline modal or popover confirm) before restoring the template.
4. **Copy Code**:
   - Copies current buffer to clipboard using `navigator.clipboard.writeText`.
   - Displays transient visual confirmation (`Check` icon and "Copied!" badge) for 2.0 seconds.

---

## 7. Versioned Session Storage & Resilient Persistence

To prevent accidental code loss when developers navigate between sidebar routes (e.g. checking Dashboard stats and returning to Code Review):

- **Storage Key**: `aicode_editor_draft_v1`
- **Persisted Payload**:
  ```json
  {
    "version": 1,
    "code": "def example():\n    pass",
    "language": "python",
    "fileName": "main.py",
    "isDirty": true,
    "updatedAt": "2026-10-14T18:00:00.000Z"
  }
  ```
- **Error Handling & Resilience**:
  - `readDraft()`: Wrapped in `try / catch`. If `sessionStorage` is disabled (e.g., private browsing `SecurityError`), quota is restricted, or the JSON is corrupted/malformed, it removes the corrupted key and falls back cleanly to the default initial state without crashing the UI.
  - `saveDraft()`: Wrapped in `try / catch`. If `QuotaExceededError` occurs, degrades silently to in-memory state.

---

## 8. Component Architecture & Directory Structure

```
client/src/
├── config/
│   └── monacoWorkers.js               # Self-hosted Monaco Web Worker configuration for Vite
├── components/
│   └── editor/
│       ├── MonacoEditorWrapper.jsx    # Self-hosted Monaco instance, cybernetic-dark theme, loading & fallback
│       ├── EditorToolbar.jsx          # Top action bar: language picker, filename, upload, copy, clear, reset
│       ├── LanguageSelector.jsx       # Dropdown with icons & extension badges for 6 languages
│       ├── EditorStatusBar.jsx        # Bottom telemetry bar: LOC, characters, byte size, encoding, indentation
│       └── FileUploadZone.jsx         # Hidden file input and drop-target listener with validation
├── hooks/
│   └── useEditorState.js              # Centralized hook: code, language, filename, isDirty, error, versioned draft sync
├── utils/
│   └── languageMap.js                 # Language definitions, starter templates, extension mapping, validators
├── pages/
│   └── CodeReview.jsx                 # IDE workspace page with React.lazy MonacoWrapper and shortcuts card
└── test/
    └── codeReview.test.jsx            # Vitest suite covering all 12 test specifications
```

---

## 9. Testing Plan (12 Automated Tests)

The test suite in `client/src/test/codeReview.test.jsx` will execute 12 tests against the full workstation:

| # | Test Title | Scope & Verification |
|---|---|---|
| **1** | **Monaco Editor Mount & Theme** | Verifies editor renders with `cybernetic-dark` theme, JetBrains Mono font, and default template. |
| **2** | **Language Selector Rendering** | Verifies selector renders all 6 supported languages: C, C++, Java, Python, JavaScript, TypeScript. |
| **3** | **Language Switching Rules** | Verifies: (a) untouched starter template updates to new template, (b) user-modified code is preserved when changing language, (c) empty editor remains empty. |
| **4** | **Code Typing & Real-time Telemetry** | Simulates typing; verifies code buffer updates, LOC counter updates, and character count updates. |
| **5** | **Valid File Upload (.py / .ts)** | Simulates uploading valid `.py` file; verifies buffer loads text, language switches to Python, filename updates. |
| **6** | **Ambiguous .h File Upload** | Simulates uploading `defs.h`; verifies default mapping to C, and manual switch to C++ preserves code. |
| **7** | **Unsupported Format Rejection** | Uploading `.pdf` or `.exe` triggers error banner with supported extensions list; editor buffer is untouched. |
| **8** | **Oversized File Rejection (> 1 MB)** | Uploading 1.2 MB file triggers "exceeds 1 MB limit" error banner; buffer is untouched. |
| **9** | **Empty File Rejection (0 Bytes)** | Uploading 0-byte file triggers "file is empty" error banner. |
| **10** | **Clear Code Action** | Clicking Clear button empties buffer and marks dirty state. |
| **11** | **Reset Editor with Destruction Guard** | Modifying code and clicking Reset prompts for confirmation before reverting to starter template. |
| **12** | **Versioned Session Persistence & Resilience** | Verifies state restores from `aicode_editor_draft_v1`; verifies graceful recovery from corrupted storage JSON. |

---

## 10. Security & Phase Boundary Guarantees

1. **Client-Side Isolation**: Uploaded source files are processed purely in-browser via `FileReader.readAsText('UTF-8')`. Zero network payload is transmitted to the server.
2. **Zero Remote Code Execution (RCE)**: Code is handled strictly as raw text. Code is never evaluated, compiled, or executed via `eval`, `new Function`, or DOM injection (`dangerouslySetInnerHTML`).
3. **No External Network Dependencies**: Self-hosted Monaco eliminates CDN dependencies and enforces strict `script-src 'self'` CSP.
4. **Future Phase Boundaries**:
   - No Gemini API calls (Phase 8).
   - No review submission or MongoDB persistence (`POST /api/v1/reviews` in Phase 8).
   - No static analysis or security scanning (Phase 7 & 9).
   - No performance diagnostics (Phase 10).
5. **Phase 1–5 Preservation**: All authentication, JWT cookies, CSRF protection, rate limiting, and Phase 5 dashboard components remain 100% intact.

---

## 11. Acceptance Criteria

Phase 6 implementation will be declared complete when:
1. Monaco Editor embeds smoothly on `/code-review` in the Cybernetic Charcoal dark theme using locally bundled assets.
2. Initial application load is optimized via `React.lazy` on the editor component.
3. All 6 languages can be selected, each updating syntax highlighting according to the zero code-loss rules.
4. `.h` files default to C while allowing seamless one-click switching to C++.
5. Upload handles valid files up to 1 MB, rejects $> 1\text{ MB}$, rejects empty files, and rejects invalid formats with clear error banners.
6. Real-time telemetry accurately computes LOC, characters, and byte size.
7. Draft code persists across navigation via `aicode_editor_draft_v1` with resilient error handling.
8. Reset action guards against accidental destruction of modified code.
9. All 12 automated tests in `codeReview.test.jsx` pass.
10. The complete client test suite has **27 passing tests** ($15\text{ existing} + 12\text{ new} = 27$) with exit code 0.
11. Production build (`npm run build`) succeeds with exit code 0.
