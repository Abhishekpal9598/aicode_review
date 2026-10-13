# Technical Requirements Document (TRD)

## Project Name: AI Code Review
**Project Title**: Intelligent AI-Powered Code Analysis & Review Platform  
**Document Version**: 1.0.0  
**Status**: Architecture Approved  

---

## 1. System Architecture Overview

The **AI Code Review** platform follows a modern, decoupled client-server architecture designed for high throughput, sub-second client responsiveness, and resilient AI orchestration.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT TIER (Vercel)                                     │
│  React 19 + Vite SPA | Tailwind CSS | shadcn/ui | Lucide Icons | Recharts              │
│  Monaco Editor (Syntax Highlighting, Diff Viewer, Custom Dark Charcoal Theme)           │
└───────────────────────────────────────────┬─────────────────────────────────────────────┘
                                            │ HTTPS / WSS / JSON Payloads
                                            │ HttpOnly Secure JWT Cookies
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                BACKEND TIER (Render)                                    │
│  Node.js (LTS) + Express.js (ES Modules)                                                │
│  ┌──────────────────────┬──────────────────────┬──────────────────────────────────────┐ │
│  │ Security Middleware  │ Controllers Layer    │ Service Orchestrator                 │ │
│  │ Helmet, Rate Limit,  │ Auth, Review,        │ • Static Heuristic Engine            │ │
│  │ CORS, Cookie Parser  │ Analysis, Reports    │ • Gemini Prompt Engineering Service  │ │
│  │ Payload Validator    │ History, User        │ • Zod Schema Validator & Normalizer  │ │
│  └──────────────────────┴──────────────────────┴──────────────────────────────────────┘ │
└─────────────────────────────┬─────────────────────────────────┬─────────────────────────┘
                              │                                 │
                 Mongoose ODM │                                 │ Gemini REST / SDK
                              ▼                                 ▼
┌───────────────────────────────────────────────┐ ┌───────────────────────────────────────┐
│              DATABASE TIER                    │ │            EXTERNAL AI TIER           │
│              MongoDB Atlas                    │ │           Google Gemini API           │
│  Collections: Users, CodeReviews,             │ │  • Structured JSON Mode               │
│  AnalysisResults, ReviewIssues, Reports       │ │  • gemini-1.5-pro / gemini-1.5-flash  │
│  Compound & Text Indexing, Query Optimization │ │  • Deterministic Temperature (0.2)    │
└───────────────────────────────────────────────┘ └───────────────────────────────────────┘
```

---

## 2. Technology Stack & Package Versions

The stack balances bleeding-edge UI features with rock-solid server stability. Exact dependencies are curated to avoid peer-dependency conflicts.

### 2.1 Frontend Stack
| Layer / Tool | Technology & Package | Version | Justification |
|---|---|---|---|
| **Core Framework** | `react`, `react-dom` | `^19.0.0` | Latest concurrent features, optimized rendering, modern Hooks standard |
| **Build Tool** | `vite` | `^6.0.0` | Instant HMR, lightweight bundling, native ES module support |
| **Styling** | `tailwindcss`, `postcss`, `autoprefixer` | `^3.4.0` | Utility-first, predictable dark-theme ergonomics, fast build times |
| **UI Components** | `shadcn/ui` (Radix UI primitives) | Modern compatible | Accessible, unstyled primitives customizable to custom developer aesthetics |
| **Code Editor** | `@monaco-editor/react`, `monaco-editor` | `^4.6.0` | Production standard editor powering VS Code; syntax highlighting & side-by-side diff |
| **Routing** | `react-router-dom` | `^7.0.0` | Modern layout routing, loader hooks, and nested route boundaries |
| **Data Visualization** | `recharts` | `^2.15.0` | Highly customizable SVG charts for code metrics, score distributions, and radar graphs |
| **Icons** | `lucide-react` | `^0.460.0` | Crisp, developer-focused vector icon system |
| **HTTP Client** | `axios` | `^1.7.0` | Clean interceptor management for credentials, CSRF, and unified error handling |

### 2.2 Backend Stack
| Layer / Tool | Technology & Package | Version | Justification |
|---|---|---|---|
| **Runtime** | Node.js LTS | `>= 20.x` | Stable modern V8 engine, native fetch, crypto, and ES modules |
| **Server Framework**| `express` | `^4.21.0` | Mature, lightweight, modular HTTP routing with robust middleware ecosystem |
| **Database ODM** | `mongoose` | `^8.8.0` | Strict schema validation, middleware hooks, indexes, and aggregation pipelines |
| **AI Client SDK** | `@google/genai` or `@google/generative-ai` | `^0.21.0` | Official Google Gemini client with structured output schema enforcement |
| **Schema Validation**| `zod` | `^3.23.0` | Type-safe runtime schema validation for requests and Gemini AI structured responses |
| **Authentication** | `jsonwebtoken`, `bcryptjs` | `^9.0.2`, `^2.4.3` | Industry-standard stateless token authentication and salted password hashing |
| **Security & Parser**| `helmet`, `cors`, `cookie-parser`, `express-rate-limit` | Latest | Complete HTTP defense, safe cookie access, DDoS mitigation |
| **File Handling** | `multer` | `^1.4.5-lts.1` | In-memory buffer ingestion for source code uploads (max 1 MB; strictly text) |

### 2.3 Testing & Tooling
- **Frontend / Unit Testing**: `vitest` with `@testing-library/react`.
- **Backend API Testing**: `supertest` with `vitest`.
- **API Spec & Verification**: Postman collection + OpenAPI 3.1 schema.

---

## 3. Frontend Architecture

### 3.1 Client Directory & Component Structure
```
client/src/
├── assets/                  # Static SVGs, logos, graphic assets
├── components/
│   ├── common/              # Global Navbar, Sidebar, Footer, LoadingSpinners, StatusBadge
│   ├── ui/                  # shadcn/ui components (Button, Dialog, Dropdown, Tabs, Tooltip, etc.)
│   ├── editor/              # MonacoEditorWrapper, DiffViewerModal, LanguageSelector, EditorToolbar
│   ├── dashboard/           # MetricCard, QualityScoreChart, IssueRadarChart, RecentReviewsTable
│   ├── review/              # ReviewHeader, IssueCard, IssueListFilter, CodeSnippetViewer, FixExplanation
│   └── reports/             # ReportExporter, ExecutiveSummaryCard, CategoryScoreBreakdown
├── context/
│   ├── AuthContext.jsx      # Authentication state, login, logout, current user profile
│   └── ThemeContext.jsx     # Dark developer theme token management
├── hooks/
│   ├── useReview.js         # Review creation, polling/state orchestration, quick analysis
│   ├── useHistory.js        # History filtering, search, pagination, delete handlers
│   └── useStats.js          # Dashboard metric fetching and caching
├── pages/
│   ├── LandingPage.jsx      # Modern developer marketing page
│   ├── LoginPage.jsx        # Developer sign-in
│   ├── RegisterPage.jsx     # Developer registration
│   ├── DashboardPage.jsx    # Analytics & overview
│   ├── WorkspacePage.jsx    # The core IDE review workstation
│   ├── ReviewDetailPage.jsx # Full deep-dive audit results & side-by-side diff
│   ├── HistoryPage.jsx      # Historical reviews archive
│   └── ProfilePage.jsx      # User profile & preferences
├── routes/
│   └── AppRoutes.jsx        # Protected & public route definitions
├── services/
│   ├── api.js               # Axios instance with baseUrl and withCredentials: true
│   ├── authService.js       # Auth API client
│   └── reviewService.js     # Review & report API client
└── utils/
    ├── languageMap.js       # File extension to Monaco language mapping
    └── formatters.js        # Date, score color coding, and complexity badge helpers
```

### 3.2 State Management & Data Flow
1. **Auth State**: Centralized in React Context (`AuthContext`). On initial load, performs a silent session verification (`GET /api/v1/auth/me`).
2. **Review Workspace State**: Local state with optimistic UI updates. Code editor contents, selected language, and uploaded file metadata are tracked in `WorkspacePage`.
3. **Async Operations**: Axios interceptors intercept 401 Unauthorized responses to trigger session invalidation and redirect to login.

### 3.3 Monaco Editor Integration Details
- Integrated using `@monaco-editor/react`.
- Configuration options:
  ```javascript
  {
    theme: 'vs-dark', // Customized with brand charcoal hexes via monaco.editor.defineTheme
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
    fontLigatures: true,
    minimap: { enabled: true, maxColumn: 80 },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    wordWrap: 'on',
    automaticLayout: true
  }
  ```
- **Monaco Diff Viewer**: Used in the code comparison view to render `originalCode` vs. `suggestedCode` with inline side-by-side highlighting, enabling developers to visually confirm suggested patches before copying.

---

## 4. Backend Architecture

### 4.1 Server Directory Structure
```
server/
├── config/
│   ├── db.js                # MongoDB Atlas connection manager with Mongoose
│   ├── env.js               # Validated environment configuration (dotenv + Zod)
│   └── constants.js         # Language definitions, score weights, limits
├── controllers/
│   ├── authController.js    # Register, login, logout, me, updateProfile
│   ├── reviewController.js  # Create review, get reviews, get review by ID, delete
│   ├── analysisController.js# Orchestrate static + Gemini analysis pipeline
│   ├── historyController.js # Search, filter, pagination, batch delete
│   └── reportController.js  # Formatted report generation and export
├── middleware/
│   ├── authMiddleware.js    # JWT verification from HttpOnly cookie
│   ├── errorMiddleware.js   # Global catch-all error handler with normalized JSON
│   ├── rateLimitMiddleware.js# IP & User-based window rate limiters
│   ├── uploadMiddleware.js  # Multer memory storage configuration & file validation
│   └── validateMiddleware.js# Generic Zod request schema validation middleware
├── models/
│   ├── User.js              # User Mongoose model
│   ├── CodeReview.js        # Master review record model
│   ├── AnalysisResult.js    # Overall quality score, metrics, summaries
│   ├── ReviewIssue.js       # Discrete issue finding model
│   └── Report.js            # Pre-compiled exportable report model
├── routes/
│   ├── authRoutes.js        # /api/v1/auth
│   ├── reviewRoutes.js      # /api/v1/reviews
│   ├── historyRoutes.js     # /api/v1/history
│   ├── reportRoutes.js      # /api/v1/reports
│   └── userRoutes.js        # /api/v1/users
├── services/
│   ├── geminiService.js     # Google Gemini API client with structured JSON output
│   ├── staticAnalyzer.js    # Deterministic regex, pattern & AST sanity rules
│   ├── scoringService.js    # Weighted mathematical scoring engine (0–100)
│   └── diffService.js       # Hunk generator and side-by-side patch builder
├── utils/
│   ├── logger.js            # Structured Winston / Console logger
│   └── apiResponse.js       # Standardized response envelopes { success, data, error }
├── app.js                   # Express app setup and middleware chain
└── server.js                # Server entry point and graceful shutdown listeners
```

### 4.2 Middleware Pipeline Execution Order
1. **Security**: `helmet()` (secure headers) $\to$ `cors({ credentials: true, origin })`.
2. **Body Parsers**: `express.json({ limit: '2mb' })` $\to$ `cookieParser()`.
3. **Rate Limiting**: `rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })` on global routes; custom stricter limits (`10 / min`) on `/analyze`.
4. **Authentication**: `authMiddleware` reads JWT from `req.cookies.access_token` and attaches `req.user`.
5. **Route Controllers**: Validated via `validateMiddleware(schema)`.
6. **Error Handler**: Catch-all `errorMiddleware` sanitizes stack traces in production and returns standard error objects.

---

## 5. Dual-Layer Code Analysis Architecture

To ensure speed, prevent AI hallucination, and maintain absolute safety, code analysis is decoupled into two coordinated stages:

```
[ Raw Untrusted User Code ]
            │
            ├───────────────────────────────────────────────┐
            ▼                                               ▼
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│  STAGE 1: Deterministic Static Engine │       │   STAGE 2: Gemini AI Semantic Engine │
│  • Memory safety scan (C/C++)        │       │  • Algorithmic bug detection         │
│  • Hardcoded secrets & tokens regex  │       │  • Time & Space complexity (Big-O)   │
│  • Known vulnerable syntax patterns  │       │  • Logic flaws & boundary violations │
│  • AST-safe token syntax sanity      │       │  • Idiomatic refactored code patch   │
│  • Deterministic issue generation    │       │  • Deep architectural explanation    │
└──────────────────┬───────────────────┘       └──────────────────┬───────────────────┘
                   │                                              │
                   └──────────────────────┬───────────────────────┘
                                          ▼
                      ┌───────────────────────────────────────┐
                      │  STAGE 3: Merging & Deduplication     │
                      │  • Deduplicate overlapping line bugs  │
                      │  • Normalize severity ratings         │
                      │  • Discard invalid line numbers       │
                      └───────────────────┬───────────────────┘
                                          ▼
                      ┌───────────────────────────────────────┐
                      │  STAGE 4: Scoring Engine (0 - 100)    │
                      │  • Penalty deduction formula          │
                      │  • Category score normalization       │
                      └───────────────────────────────────────┘
```

### 5.1 Stage 1: Deterministic Static Analysis
- **Execution Target**: Pure regular expression heuristics and lexical token lookups running in memory.
- **Safety**: Code is parsed strictly as string buffers. It is **never** passed to an `eval`, compiler, or runtime execution container.
- **Rules Evaluated**:
  - *Hardcoded Secrets*: AWS keys (`AKIA...`), GitHub personal access tokens (`ghp_...`), private keys (`BEGIN PRIVATE KEY`), Generic JWTs, hardcoded database URIs.
  - *Unsafe Memory & Calls*: `strcpy`, `gets`, `scanf` without width limits in C/C++; `eval()`, `document.write()`, `innerHTML` without sanitization in JS; raw SQL string concatenations.
  - *Dead Code / Empty Handlers*: Empty `catch` blocks, empty `except:` clauses.

### 5.2 Stage 2: Google Gemini AI Integration
- **Model**: `gemini-1.5-pro` (or `gemini-1.5-flash` for high-throughput fast passes).
- **Inference Configuration**:
  - `temperature`: `0.2` (low temperature ensures deterministic, reproducible, non-hallucinatory code reviews).
  - `responseMimeType`: `"application/json"`.
  - `responseSchema`: Statically enforced JSON schema ensuring output maps 1:1 with Zod validation.
- **Prompt Structure**:
  - System instruction establishes the persona of a Principal Systems Architect and Staff Security Engineer.
  - Code snippet provided with line numbers attached to avoid hallucinations.
  - Pre-identified static findings provided to anchor the LLM to verified issues.
  - Explicit constraint: Must return refactored complete code without truncating ellipses (`// ... same code`).

### 5.3 Stage 3: Zod Validation & Deduplication
If the AI output fails Zod parsing, a safe fallback normalizer attempts repair or issues a structured parsing failure rather than crashing the request.

---

## 6. Scoring Algorithm & Mathematics

The Code Quality Score is an integer from `0` to `100`, calculated using a weighted penalty deduction model:

$$\text{Base Score} = 100$$

$$\text{Deductions} = \sum (\text{Issue Count}_{\text{Severity}} \times \text{Weight}_{\text{Severity}})$$

Where weights are defined as:
- **CRITICAL** (e.g., Remote Code Execution, Leaked Secret, Buffer Overflow): $-25\text{ pts}$
- **HIGH** (e.g., Injection Risk, Uncaught Null Dereference, Infinite Loop): $-15\text{ pts}$
- **MEDIUM** (e.g., Unhandled Edge Case, $O(n^2)$ Bottleneck, Inefficient Query): $-8\text{ pts}$
- **LOW** (e.g., Code Smells, Missing Error Log, High Complexity): $-3\text{ pts}$
- **INFO** (e.g., Naming Convention, Minor Style Polish): $-1\text{ pt}$

To avoid penalizing longer files unfairly, a lines-of-code (LOC) normalization factor $k_{\text{LOC}}$ is applied:
$$k_{\text{LOC}} = \max\left(1.0, \frac{\text{LOC}}{250}\right)$$

$$\text{Normalized Deductions} = \frac{\text{Deductions}}{k_{\text{LOC}}}$$

$$\text{Final Score} = \max\left(0, \min\left(100, \text{round}(100 - \text{Normalized Deductions})\right)\right)$$

### Quality Grade Mapping:
- **90 – 100**: `A` (Exceptional / Production Ready)
- **75 – 89**: `B` (Good / Minor Fixes Needed)
- **60 – 74**: `C` (Fair / Needs Attention)
- **40 – 59**: `D` (Poor / High Bug/Security Risk)
- **0 – 39**: `F` (Critical / Unsafe for Deployment)

---

## 7. Security Architecture & Threat Mitigation

| Threat Vector | Mitigation Strategy |
|---|---|
| **Remote Code Execution (RCE)** | Strict static analysis only. Submitted code is stored as text in MongoDB and submitted to Gemini API as text prompts. No compiler, runtime, or sandbox is invoked on the host OS. |
| **Cross-Site Scripting (XSS)** | React JSX escapes all rendered content by default. Monaco Editor renders code inside an isolated Canvas/DOM sandbox. Markdown output is sanitized using `DOMPurify` before rendering. |
| **Cross-Site Request Forgery (CSRF)** | `SameSite=Strict` flag on HttpOnly auth cookies, combined with custom custom request headers (`X-Requested-With: XMLHttpRequest`). |
| **Denial of Service (DoS) via Large Payloads**| `express.json` body size capped at $2\text{ MB}$. File uploads capped at $1\text{ MB}$. Total lines of code capped at $2,500$ LOC per submission. |
| **AI Quota Exhaustion / API Key Leakage** | Gemini API keys stored exclusively on the server in `.env`. IP-based rate limiting (express-rate-limit) enforces max 10 analysis calls per 5 minutes per user. |
| **Multi-Tenant Data Isolation** | Mongoose queries enforce `userId: req.user._id` for all CRUD, history, and report endpoints. Users cannot read or delete foreign reviews. |

---

## 8. Deployment & DevOps Architecture

### 8.1 Environments
- **Development**: Local Node.js + Vite dev server with proxy, MongoDB Atlas sandbox cluster.
- **Production**:
  - **Frontend**: Deployed to **Vercel** with automatic preview deployments, Edge CDN caching, and custom header routing.
  - **Backend**: Deployed to **Render** as a web service running Node.js in production mode (`NODE_ENV=production`) with health-check monitoring (`/api/v1/health`).
  - **Database**: Managed **MongoDB Atlas** M0/M10 cluster with automated daily snapshots, TLS 1.3 encryption, and IP whitelist restriction.

### 8.2 Environment Variable Matrix
```bash
# Backend Environment (.env)
PORT=5000
NODE_ENV=production
CLIENT_URL=https://ai-code-review.vercel.app
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/aicode_review?retryWrites=true&w=majority
JWT_SECRET=super_secret_jwt_entropy_key_at_least_32_chars
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=super_secret_refresh_key_entropy_at_least_32_chars
REFRESH_TOKEN_EXPIRES_IN=7d
GEMINI_API_KEY=AIzaSy...your_gemini_api_key
MAX_FILE_SIZE_BYTES=1048576

# Frontend Environment (.env.production)
VITE_API_BASE_URL=https://ai-code-review-api.onrender.com/api/v1
```

---

## 9. Assumptions and Technical Boundaries

1. **Language Scope**: Initial supported languages are strictly: `C`, `C++`, `Java`, `Python`, `JavaScript`, and `TypeScript`.
2. **Synchronous Review Processing**: For files $\le 1,000$ LOC, analysis is executed synchronously within the HTTP request lifecycle ($\sim 4 - 8\text{ s}$). If Gemini takes longer than 25 seconds, an upstream timeout error (504) is caught and handled gracefully with user retry guidance.
3. **Storage Retention**: Reviews are stored indefinitely in MongoDB Atlas until explicitly deleted by the user through the Review History UI.
