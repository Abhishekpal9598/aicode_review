# Architectural & Technical Decisions (DECISIONS.md)

### 1. Database & Migrations: Knex with MySQL Primary
- **Decision**: Target MySQL 8.0 as the primary production/dev database engine using `knex` and `mysql2`. Knex migrations define tables according to specification. SQLite (`dev.sqlite3` or `:memory:`) is strictly a local dev/testing fallback when a MySQL server is not reachable.
- **Users Schema Extensions**: Added `users.role` (`'user'`, `'admin'`, default `'user'`) and `users.daily_limit` (integer, default `20`).
- **Review Files Schema Extension**: Added `review_files.content_hash` (varchar 64) for deduplication and content caching.

### 2. LLM Provider & Model Configuration
- **Decision**: Read model name dynamically from `LLM_MODEL` in `.env`, defaulting to `claude-sonnet-5-5`. Never hardcode vendor model identifiers.
- **Mock Mode**: When `ANTHROPIC_API_KEY` is absent or set to `mock`, the LLM service enters deterministic mock senior-reviewer mode, returning `mock: true` in review payloads, and displaying a prominent "Mock mode" badge in the UI.

### 3. Review Validation, Scoring & Severity
- **Decision**: Align strictly with the spec's 3-tier severity model: `high`, `medium`, `low`.
  - Severity weights: `high` = 10, `medium` = 4, `low` = 1. Base score 100, floored at 0.
  - Enforce strict JSON output parsing and validation using Zod:
    - Fields: `title`, `line_start`, `line_end`, `severity` (`high`, `medium`, `low`), `category` (`bug`, `security`, `performance`, `style`, `maintainability`), `explanation`, `suggested_fix`.
  - Line Bounds Checking: Any issue reporting a line outside the range `[1, total_lines]` of the target file is dropped immediately before persistence or scoring.

### 4. API Security & Input Validation
- **Decision**: Apply `express-rate-limit` to `/api/auth/login` and `/api/auth/register` (max 20 requests per 15 minutes window) to mitigate brute-force attempts.
- **Request Validation**: All request bodies on auth and review endpoints are validated against Zod schemas before reaching business logic controllers.

### 5. Multi-Language Support
- **Decision**: Supported language options include JavaScript (`javascript`), TypeScript (`typescript`), Python (`python`), and Java (`java`).

### 6. Phase 2 Review Report UI Architecture
- **Two-Panel Layout**: The report page at `/reviews/:id` features a responsive grid (stacked on mobile, side-by-side on desktop). Left panel hosts read-only `CodeViewer` with Monaco editor; right panel hosts `ScoreRing`, summary metrics, `FilterBar`, and `IssueCard` list.
- **Inline Editor Decorations**: Implemented with Monaco's `deltaDecorations`:
  - Gutter icons: `glyphMarginClassName` with colored dots (red for high, amber for medium, blue for low).
  - Line highlighting: `className` with subtle colored backgrounds.
  - Inline squiggles: `inlineClassName` with wavy underline.
  - Active selection: `selected-line-decoration` highlighting the active issue's line range.
- **Bi-Directional Interaction**:
  - Clicking an issue card scrolls the Monaco editor to the issue's `line_start` and sets the editor selection.
  - Clicking on a decorated line or gutter glyph in the editor identifies the issue and scrolls the matching issue card into view, expanding its details.
- **DiffView in Issue Cards**: Embedded Monaco `DiffEditor` compares the original code snippet (the targeted line range) with the suggested fix, with side-by-side / inline toggle.
- **Navigation & History**: Submitting code from `/` automatically redirects to `/reviews/:id`. A dedicated `/history` page displays past reviews with scores, language, and timestamps, allowing users to return to any report.
