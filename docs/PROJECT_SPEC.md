# AI Code Review Platform - Project Specification

## 1. PRD (Product Requirements Document)
### Problem
Manual code review is slow, inconsistent and depends on reviewer availability. Students and small teams often get no review at all, so bugs, security holes and bad patterns reach production.

### Vision
A web platform that reviews code like a senior engineer: it combines static analysis tools with an LLM to find bugs, security risks and maintainability issues, explains why each matters, and suggests a fix. It works on pasted code, uploaded files and GitHub pull requests.

### Target Users
- **Student/Developer**: quick feedback on assignments and side projects.
- **Team lead**: consistent review standards and quality trends.
- **Open-source maintainer**: automatic first-pass review on PRs.

### Goals
- First review result in under 60 seconds for a typical file or PR.
- At least 70% of reported issues rated useful by users (feedback buttons).
- Fewer than 15% false positives on a labelled test set.

### Core Features (MVP)
1. Signup/login (email + GitHub OAuth).
2. Submit code: paste, upload, or connect a GitHub repo/PR.
3. Hybrid analysis: linters/security scanners plus LLM review.
4. Issue report: severity, category, file and line, explanation, suggested fix (diff).
5. Quality score (0-100) and per-category breakdown.
6. Review history and quality trend dashboard.
7. GitHub integration: auto-review on PR open and post inline comments.
8. Feedback on each issue (helpful / not helpful / false positive).

### Nice-to-have
Custom rulesets per project, team workspaces, IDE extension, auto-fix PR, supported-language expansion.

### Out of Scope (v1)
Running or executing user code, private on-premise deployment, languages beyond JavaScript/TypeScript and Python.

### Success Metrics
Reviews per user per week, helpful-rating rate, false-positive rate, median review latency, PRs reviewed via GitHub.

### Risks and Mitigations
- **LLM hallucinated issues**: ground the LLM in static-tool output and cited line numbers; validate that reported lines exist.
- **Code privacy**: do not store code beyond retention window; allow deletion.
- **Cost**: cap file size, cache by content hash, review only changed hunks of a PR.

---

## 2. TRD (Technical Requirements Document)
### Architecture
Web client, REST API, asynchronous review worker, queue, database, and external services.

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript, Tailwind CSS, Monaco editor |
| API | Node.js + Express, JWT auth, REST API |
| Queue & Workers | Redis + BullMQ for async review jobs |
| Static Analysis | ESLint (JS/TS), Bandit & Pylint (Python), Semgrep |
| LLM | Provider-agnostic API wrapper in `/server/services/llm` (Anthropic / mock fallback), structured JSON output |
| Database | MySQL with migration tool (Knex), schema exactly as specified |
| Cache | Redis (results keyed by content hash) |
| Integrations | GitHub App (webhooks, Checks and PR comments API) |
| Hosting / Local | Docker Compose for MySQL + Redis |

### Review Pipeline
1. Ingest: normalize input into files; ignore binaries, lockfiles and files over 200 KB.
2. Detect language; split large files into chunks by function or class using a parser.
3. Run static tools in a sandboxed worker; collect findings with line numbers.
4. Build the LLM prompt: code chunk, static findings, ruleset and required JSON schema.
5. LLM returns issues: category, severity, line range, explanation, fix.
6. Validate and merge: drop issues with invalid line ranges, de-duplicate with static findings, rank by severity.
7. Score: quality = 100 minus weighted penalties (high=10, medium=4, low=1, normalized by code size), floored at 0.
8. Persist, notify, and (for PRs) post comments through the GitHub API.

### Non-Functional Requirements
- **Security**: Never execute submitted code; encrypt GitHub tokens at rest; hash passwords (bcrypt); verify webhook signatures; rate limit per user.
- **Performance**: p95 review under 90 s for 500 lines; API p95 under 300 ms excluding review.
- **Reliability**: Jobs are idempotent, retried with backoff (3 attempts), dead-letter queue for failures.
- **Observability**: Structured logs, job metrics, error tracking.
- **Privacy**: Retention policy, user data deletion, no training on user code.

---

## 3. App Flow
- **Flow A: Manual Review**: Login -> Dashboard -> New Review -> Paste / Upload / GitHub repo -> Select language and ruleset -> Submit -> Queued -> Analyzing -> Report ready -> View issues -> Mark helpful/false positive -> Copy fix.
- **Flow B: GitHub PR Review**: Connect GitHub App -> Webhook received and verified -> Worker reviews changed hunks -> Inline comments posted -> Re-review on new push.
- **Flow C: Review Pipeline**: Job created -> Worker picks job -> Static analysis -> LLM review -> Validate and score -> Save results. Retry on failure up to 3 times.
- **Flow D: History and Trends**: Dashboard -> Score trend over time, top recurring categories, file hotspots.

---

## 4. UI/UX
- Developer-first, dark mode by default, keyboard-friendly.
- Split view report: Monaco editor with inline markers on left; issues list with severity filters on right.
- Score ring, category breakdown bars, side-by-side diff viewer with copy fix button.

---

## 5. Backend Schema (MySQL)
- `users`: id (PK), email (unique), password_hash, name, github_id, role ('user'|'admin', default 'user'), daily_limit (int, default 20), created_at, updated_at
- `github_installations`: id (PK), user_id (FK), installation_id, access_token_enc, created_at
- `projects`: id (PK), user_id (FK), name, repo_full_name, default_branch, ruleset_id (FK, nullable), auto_review (bool), created_at
- `rulesets`: id (PK), user_id (FK, nullable), name, config (JSON), created_at
- `reviews`: id (PK), project_id (FK, nullable), user_id (FK), source (paste/upload/pr), pr_number, commit_sha, language, status (queued/running/completed/failed), score, total_issues, content_hash, error_message, created_at, completed_at
- `review_files`: id (PK), review_id (FK), path, language, line_count, content (longtext), content_hash (varchar 64), created_at
- `issues`: id (PK), review_id (FK), file_id (FK), category (bug/security/performance/style/maintainability), severity (critical/high/medium/low), line_start, line_end, title, explanation, suggested_fix, source (static/llm), rule_id, created_at
- `issue_feedback`: id (PK), issue_id (FK), user_id (FK), rating (helpful/not_helpful/false_positive), created_at
- `review_metrics`: id (PK), review_id (FK), tokens_in, tokens_out, cost_usd, duration_ms, created_at
- `usage_logs`: id (PK), user_id (FK), action, details (JSON), created_at
