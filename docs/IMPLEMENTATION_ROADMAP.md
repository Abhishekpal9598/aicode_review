# Implementation Roadmap (IMPLEMENTATION_ROADMAP.md)

## Project Name: AI Code Review
**Project Title**: Intelligent AI-Powered Code Analysis & Review Platform  
**Document Version**: 1.0.0  
**Status**: Roadmap Approved  

---

## Roadmap Overview & Phase Index

```
Phase 1: Project Initialization & Structure
Phase 2: Backend Foundation & Express Setup
Phase 3: Frontend Foundation & Tailwind/Vite Setup
Phase 4: Authentication & User Session Management
Phase 5: Developer Dashboard & Analytics Visualizations
Phase 6: Monaco Code Editor & Ingestion Workspace
Phase 7: Deterministic Static Code Analysis Engine
Phase 8: Google Gemini AI Integration & Zod Schema Pipeline
Phase 9: Security Vulnerability & Hardcoded Secret Detection
Phase 10: Performance & Big-O Algorithmic Analysis
Phase 11: Review History, Search & Filtering
Phase 12: Side-by-Side Monaco Diff Code Comparison
Phase 13: Audit Reports & Multi-Format Exporters
Phase 14: Automated Testing & Security Hardening
Phase 15: Cloud Deployment & Production Verification
```

---

## Phase 1: Project Initialization & Directory Structure

- **Objectives**: Establish clean monorepo/split-directory architecture, configure Git ignore rules, setup base root package scripts, and establish environment templates.
- **Tasks**:
  1. Audit root structure for `client/`, `server/`, and `docs/`.
  2. Create comprehensive `.gitignore` filtering `node_modules`, `.env`, build dists, and debug logs.
  3. Create root `.env.example` defining MongoDB, JWT, and Gemini API keys.
  4. Create root `package.json` with convenience scripts (`npm run dev`, `npm run build`).
- **Files to Create or Modify**:
  - `/.gitignore`
  - `/.env.example`
  - `/package.json`
- **Dependencies**: Node.js $\ge 20$, npm $\ge 10$.
- **Testing Requirements**: Run `git status` to ensure zero tracking of ignored artifacts.
- **Acceptance Criteria**: Clean project directory with standard documentation and git configuration.

---

## Phase 2: Backend Foundation & Express Setup

- **Objectives**: Construct modular Express.js ES-modules backend with Mongoose ODM, centralized configuration, and standard error handling envelopes.
- **Tasks**:
  1. Initialize `server/package.json` with `"type": "module"`.
  2. Configure Mongoose Atlas connection with auto-reconnect in `server/config/db.js`.
  3. Implement standardized API response helper `server/utils/apiResponse.js`.
  4. Implement global error handling middleware `server/middleware/errorMiddleware.js`.
  5. Setup `server/app.js` with `helmet`, `cors`, `cookieParser`, and JSON body parsers.
  6. Implement health check route `GET /api/v1/health`.
- **Files to Create or Modify**:
  - `server/package.json`
  - `server/config/db.js`
  - `server/config/env.js`
  - `server/utils/apiResponse.js`
  - `server/middleware/errorMiddleware.js`
  - `server/app.js`
  - `server/server.js`
- **Dependencies**: `express`, `mongoose`, `dotenv`, `cors`, `helmet`, `cookie-parser`.
- **Testing Requirements**: Automated curl or Supertest hitting `/api/v1/health` returning `200 OK`.
- **Acceptance Criteria**: Server starts up cleanly, connects to MongoDB, and responds with standardized JSON envelopes.

---

## Phase 3: Frontend Foundation & Tailwind/Vite Setup

- **Objectives**: Configure React 19 single-page application using Vite, setup Tailwind CSS with custom Charcoal/Slate theme tokens, and integrate Lucide React icons.
- **Tasks**:
  1. Initialize `client/package.json` with React 19, Vite, and React Router.
  2. Configure `client/tailwind.config.js` with exact Charcoal/Slate/Indigo color tokens defined in `UI_UX.md`.
  3. Configure global CSS styles and fonts (`Inter` and `JetBrains Mono`) in `client/src/index.css`.
  4. Setup core layout shell: Persistent Sidebar, Topbar, and Main Content viewport.
  5. Configure Axios instance with `baseURL` and `withCredentials: true`.
- **Files to Create or Modify**:
  - `client/package.json`
  - `client/vite.config.js`
  - `client/tailwind.config.js`
  - `client/src/index.css`
  - `client/src/services/api.js`
  - `client/src/components/common/Sidebar.jsx`
  - `client/src/components/common/Navbar.jsx`
- **Dependencies**: `react`, `react-dom`, `vite`, `tailwindcss`, `lucide-react`, `axios`, `react-router-dom`.
- **Testing Requirements**: Launch Vite dev server and verify CSS token rendering in browser.
- **Acceptance Criteria**: App displays responsive shell with Cybernetic Charcoal dark theme and working navigation links.

---

## Phase 4: Authentication & User Session Management

- **Objectives**: Implement end-to-end registration, login, logout, and persistent session validation using bcrypt and JWT HttpOnly cookies.
- **Tasks**:
  1. Define Mongoose `User` schema in `server/models/User.js`.
  2. Implement auth controllers in `server/controllers/authController.js` (register, login, logout, me).
  3. Implement `server/middleware/authMiddleware.js` for JWT verification.
  4. Create `client/src/context/AuthContext.jsx` for global user state.
  5. Build Developer `LoginPage.jsx` and `RegisterPage.jsx` with input validation and loading spinners.
  6. Setup protected route wrapper `client/src/routes/ProtectedRoute.jsx`.
- **Files to Create or Modify**:
  - `server/models/User.js`
  - `server/controllers/authController.js`
  - `server/routes/authRoutes.js`
  - `server/middleware/authMiddleware.js`
  - `client/src/context/AuthContext.jsx`
  - `client/src/pages/LoginPage.jsx`
  - `client/src/pages/RegisterPage.jsx`
  - `client/src/routes/AppRoutes.jsx`
- **Dependencies**: `bcryptjs`, `jsonwebtoken`.
- **Testing Requirements**: Supertest unit tests verifying 201 on registration, 401 on bad password, and cookie validation on `/me`.
- **Acceptance Criteria**: Users can register, log in, remain logged in across page reloads, and securely log out.

---

## Phase 5: Developer Dashboard & Analytics Visualizations

- **Objectives**: Build the central developer dashboard displaying KPI metric cards, Recharts score trends, defect radar charts, and recent reviews.
- **Tasks**:
  1. Implement `GET /api/v1/users/stats` endpoint in `server/controllers/userController.js`.
  2. Create reusable metric cards (`MetricCard.jsx`) in `client/src/components/dashboard/`.
  3. Create historical score area chart using Recharts in `QualityScoreChart.jsx`.
  4. Create category defect breakdown radar chart in `IssueRadarChart.jsx`.
  5. Build `RecentReviewsTable.jsx` with status badges and quick review links.
  6. Assemble complete `client/src/pages/DashboardPage.jsx`.
- **Files to Create or Modify**:
  - `server/controllers/userController.js`
  - `server/routes/userRoutes.js`
  - `client/src/pages/DashboardPage.jsx`
  - `client/src/components/dashboard/MetricCard.jsx`
  - `client/src/components/dashboard/QualityScoreChart.jsx`
  - `client/src/components/dashboard/IssueRadarChart.jsx`
  - `client/src/components/dashboard/RecentReviewsTable.jsx`
- **Dependencies**: `recharts`.
- **Testing Requirements**: Verify responsive rendering across mobile, tablet, and desktop viewports.
- **Acceptance Criteria**: Dashboard displays live metrics, charts render without SVG overflow, and empty states handle zero-review accounts gracefully.

---

## Phase 6: Monaco Code Editor & Ingestion Workspace

- **Objectives**: Embed the Monaco Editor in the Workspace view with language selection, character counters, file upload drag-and-drop, and clean reset.
- **Tasks**:
  1. Install and configure `@monaco-editor/react`.
  2. Implement custom dark editor theme matching the Cybernetic Charcoal palette.
  3. Build `WorkspacePage.jsx` layout with split-screen viewport.
  4. Build `EditorToolbar.jsx` with Language Dropdown (C, C++, Java, Python, JS, TS) and metrics strip.
  5. Implement `FileUploadZone.jsx` accepting `.c`, `.cpp`, `.java`, `.py`, `.js`, `.ts` files ($\le 1\text{ MB}$).
  6. Implement UTF-8 client file reading and auto-populating Monaco editor buffer.
- **Files to Create or Modify**:
  - `client/src/pages/WorkspacePage.jsx`
  - `client/src/components/editor/MonacoEditorWrapper.jsx`
  - `client/src/components/editor/EditorToolbar.jsx`
  - `client/src/components/editor/FileUploadZone.jsx`
  - `client/src/utils/languageMap.js`
- **Dependencies**: `@monaco-editor/react`.
- **Testing Requirements**: Test pasting 1,500 LOC and uploading various file extensions; verify file size validator rejects files $> 1\text{ MB}$.
- **Acceptance Criteria**: Monaco Editor mounts with smooth syntax highlighting, switching languages alters token coloring, and file upload loads clean text into editor.

---

## Phase 7: Deterministic Static Code Analysis Engine

- **Objectives**: Develop server-side regex and AST-safe lexical scanner to detect hardcoded secrets, unsafe memory functions in C/C++, and known insecure patterns before invoking AI.
- **Tasks**:
  1. Implement secret detection regexes (AWS keys, GitHub tokens, JWTs, private keys) in `server/services/staticAnalyzer.js`.
  2. Implement C/C++ memory hazard rules (`strcpy`, `gets`, `sprintf`, uninitialized pointer scans).
  3. Implement JavaScript/TypeScript insecure pattern scans (`eval()`, unescaped `innerHTML`).
  4. Implement Python dangerous pattern checks (bare `except:`, `pickle.loads()`, `shell=True`).
  5. Normalize findings into standard `ReviewIssue` schema objects with exact line ranges.
- **Files to Create or Modify**:
  - `server/services/staticAnalyzer.js`
  - `server/utils/regexPatterns.js`
  - `server/tests/staticAnalyzer.test.js`
- **Dependencies**: Pure Node.js built-ins.
- **Testing Requirements**: Unit test suite passing against known vulnerable snippets (e.g., C `strcpy` triggers CWE-120 in $< 5\text{ ms}$).
- **Acceptance Criteria**: Static analyzer detects 100% of defined vulnerable patterns without executing or compiling code.

---

## Phase 8: Google Gemini AI Integration & Zod Schema Pipeline

- **Objectives**: Connect the backend to Google Gemini API using structured JSON schema mode, validate responses with Zod, and merge with static findings.
- **Tasks**:
  1. Initialize Gemini API client in `server/services/geminiService.js`.
  2. Define rigorous Zod response schema in `server/utils/aiResponseSchema.js`.
  3. Design system instructions forcing Gemini into the role of a Staff Systems Architect.
  4. Implement weighted mathematical scoring algorithm (0–100) in `server/services/scoringService.js`.
  5. Implement `POST /api/v1/reviews` controller orchestrating static scan $\to$ Gemini analysis $\to$ Zod parse $\to$ score calculation $\to$ MongoDB persistence.
- **Files to Create or Modify**:
  - `server/services/geminiService.js`
  - `server/services/scoringService.js`
  - `server/utils/aiResponseSchema.js`
  - `server/controllers/reviewController.js`
  - `server/routes/reviewRoutes.js`
- **Dependencies**: `@google/generative-ai`, `zod`.
- **Testing Requirements**: Mocked and live tests verifying schema compliance, score deduction accuracy, and retry logic on timeout.
- **Acceptance Criteria**: Backend receives code, runs dual-layer analysis, calculates score (0–100), and saves review with child issues.

---

## Phase 9: Security Analysis & Vulnerability Mapping

- **Objectives**: Provide deep security inspection, categorize vulnerabilities under OWASP Top 10 and CWE standards, and generate remediation guidance.
- **Tasks**:
  1. Implement specialized security filtering endpoint `GET /api/v1/reviews/:id/security`.
  2. Build `SecurityAuditTab.jsx` component in client review view.
  3. Render severity badges (`CRITICAL`, `HIGH`, `MEDIUM`) with CWE identifiers.
  4. Implement secret leak prevention guides (e.g., `.env` variable usage).
- **Files to Create or Modify**:
  - `server/controllers/analysisController.js`
  - `client/src/components/review/SecurityAuditTab.jsx`
  - `client/src/components/review/SeverityBadge.jsx`
- **Testing Requirements**: Verify high-severity security issues trigger prominent alert banners.
- **Acceptance Criteria**: Security issues display clear CWE tags, explain attack vectors, and offer secure code replacements.

---

## Phase 10: Performance & Big-O Algorithmic Analysis

- **Objectives**: Evaluate computational complexity, identify memory leaks and inefficient iterations, and present algorithmic improvements.
- **Tasks**:
  1. Configure Gemini prompts to evaluate Big-O Time and Auxiliary Space complexity.
  2. Implement `GET /api/v1/reviews/:id/performance` endpoint.
  3. Build `PerformanceAuditTab.jsx` with complexity chips (e.g., $O(n^2) \to O(n \log n)$).
  4. Provide optimization explanations with side-by-side snippet comparisons.
- **Files to Create or Modify**:
  - `client/src/components/review/PerformanceAuditTab.jsx`
  - `client/src/components/review/ComplexityBadge.jsx`
- **Testing Requirements**: Submit sorting/search algorithms and verify Big-O classifications.
- **Acceptance Criteria**: Performance bottlenecks are flagged with actionable complexity reduction advice.

---

## Phase 11: Review History, Search & Filtering

- **Objectives**: Build filterable historical review archive enabling users to browse, search, and delete previous code reviews.
- **Tasks**:
  1. Implement `GET /api/v1/history` with pagination, text search, and language filters.
  2. Implement `DELETE /api/v1/reviews/:id` and batch delete endpoints.
  3. Build `HistoryPage.jsx` with search bar, language filters, and score badges.
  4. Implement `DeleteConfirmModal.jsx` with confirmation prompt.
- **Files to Create or Modify**:
  - `server/controllers/historyController.js`
  - `server/routes/historyRoutes.js`
  - `client/src/pages/HistoryPage.jsx`
  - `client/src/components/history/HistoryTable.jsx`
  - `client/src/components/history/DeleteConfirmModal.jsx`
- **Testing Requirements**: Verify pagination, search debouncing, and authorization checks (users cannot access others' reviews).
- **Acceptance Criteria**: History displays all user submissions with instant filtering and reliable deletion.

---

## Phase 12: Side-by-Side Monaco Diff Code Comparison

- **Objectives**: Implement interactive side-by-side diff viewer highlighting additions and deletions, with one-click copy functionality.
- **Tasks**:
  1. Embed `MonacoDiffEditor` in `DiffViewerModal.jsx`.
  2. Pass original code to left pane and AI refactored code to right pane.
  3. Configure diff color decorations (emerald additions, crimson deletions).
  4. Add "Copy Refactored Code" button with clipboard animation.
  5. Add inline jump-to-line triggers from review issue cards to Monaco editor.
- **Files to Create or Modify**:
  - `client/src/components/editor/DiffViewerModal.jsx`
  - `client/src/components/review/IssueCard.jsx`
  - `client/src/pages/ReviewDetailPage.jsx`
- **Testing Requirements**: Verify diff markers render correctly for multi-line modifications.
- **Acceptance Criteria**: Developers can inspect complete side-by-side diffs and copy improved code with one click.

---

## Phase 13: Audit Reports & Multi-Format Exporters

- **Objectives**: Enable developers to export formal audit reports in Markdown, JSON, and print/PDF formats.
- **Tasks**:
  1. Implement `GET /api/v1/reports/:reviewId/export` supporting JSON and Markdown.
  2. Build `ReportExporter.jsx` with download options.
  3. Add print-optimized CSS `@media print` rules for clean PDF printing.
  4. Persist export metadata in `Report` Mongoose model.
- **Files to Create or Modify**:
  - `server/controllers/reportController.js`
  - `server/routes/reportRoutes.js`
  - `server/models/Report.js`
  - `client/src/components/reports/ReportExporter.jsx`
- **Testing Requirements**: Download and verify JSON and Markdown files contain complete audit data.
- **Acceptance Criteria**: Reports export cleanly with comprehensive scores, issue summaries, and suggested fixes.

---

## Phase 14: Automated Testing & Security Hardening

- **Objectives**: Conduct comprehensive unit and integration testing, enforce rate limits, and audit security boundaries.
- **Tasks**:
  1. Write backend unit and integration tests using Vitest and Supertest.
  2. Write frontend component tests using Vitest and Testing Library.
  3. Configure `express-rate-limit` on `/api/v1/reviews` (10 requests/min).
  4. Verify OWASP compliance: input sanitization, payload limits, secure headers.
  5. Audit dependency vulnerabilities using `npm audit`.
- **Files to Create or Modify**:
  - `server/tests/auth.test.js`
  - `server/tests/review.test.js`
  - `client/src/tests/Workspace.test.jsx`
- **Dependencies**: `vitest`, `supertest`.
- **Testing Requirements**: $\ge 80\%$ test coverage on core services and middleware.
- **Acceptance Criteria**: All automated test suites pass, and rate limiters reject excessive requests.

---

## Phase 15: Cloud Deployment & Production Verification

- **Objectives**: Deploy frontend to Vercel, backend to Render, and connect to production MongoDB Atlas cluster.
- **Tasks**:
  1. Configure `vercel.json` for client routing and caching headers.
  2. Configure Render web service with environment variables and health check path.
  3. Setup MongoDB Atlas network access and database user privileges.
  4. Perform end-to-end smoke testing: register user, submit code in each of the 6 languages, inspect diff, and export report.
- **Files to Create or Modify**:
  - `client/vercel.json`
  - `render.yaml`
- **Testing Requirements**: Run live smoke tests on production URLs across mobile and desktop.
- **Acceptance Criteria**: Production app operates with full feature parity, secure HTTPS, and sub-8-second review analysis.
