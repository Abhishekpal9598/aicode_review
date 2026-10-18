# Phase 9 — Step 3 Implementation Plan: Security Finding Normalization, Static/AI Finding Fusion, and Security Result Integration
## Authoritative Technical Specification & Execution Roadmap — Revision 2.7.0

---

## Document Metadata & Revision History
- **Project**: AI Code Review — Intelligent AI-Powered Code Analysis & Review Platform
- **Phase & Step**: Phase 9 Step 3 — Multi-Factor Hybrid Fusion Service & Security Result Integration
- **Specification Version**: 2.7.0 (Global Offset Scanner, Complete Occurrence Identity & Relational Abort Architecture)
- **Status**: Planning Stage — Strict Plan-Only Mode — Awaiting Explicit User Authorization Before Implementation
- **Author**: Antigravity Assistant (Principal Security Architect, Static Analysis Engineer, Full-Stack Reviewer)
- **Date**: October 2026
- **Authoritative Baseline**: `docs/PHASE_9_IMPLEMENTATION_PLAN.md` (Revision 2.1.0)
- **Supporting Specifications**: `docs/PHASE_8_IMPLEMENTATION_PLAN.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/DATABASE_SCHEMA.md`
- **Target Implementation Files (Strictly Five Files)**:
  1. `server/src/services/hybridFusion.service.js` (CREATE)
  2. `server/src/services/review.service.js` (MODIFY)
  3. `server/src/services/gemini.service.js` (MODIFY — prompt instructions only)
  4. `server/src/services/reviewPersistence.service.js` (MODIFY — final projected-object validation & abort guard only)
  5. `server/tests/hybridFusion.test.js` (CREATE)

### Revision History
| Revision | Date | Summary of Changes |
|---|---|---|
| **1.0.0**–**2.5.0** | Oct 2026 | Progressive architectural iterations establishing coordinate validation, directed pair-score lookup, telemetry equations, 8-group sink registry, schema audit, persistence boundary alignment, balanced delimiter tracking, and 0-indexed internal offsets. |
| **2.6.0** | Oct 2026 | Unified 8 occurrence identity conditions; explicit multi-line slice extraction; native Mongoose ObjectId checks; exhaustive 13-content-field schema constraints; 60 proposed tests. |
| **2.7.0** | Oct 2026 | **Authoritative Global Scanner, Occurrence Identity & Relational Abort Specification**: <br>1. *Complete-Source-Buffer Scanner*: Specified character-by-character scanner operating on global UTF-16 code unit offsets across the entire canonical source buffer $[0, \text{sourceText.length})$; maintained lexical state, delimiter depth, and source offsets across newlines; formally defined support and extraction for multi-line sink calls.<br>2. *Global Source Occurrence Identity*: Replaced ambiguous line-relative indices with unique `globalSinkId` and `opTokenGlobalSpan` $[opStartOffset, opEndOffset)$; defined exact mapping for static and Gemini findings into the canonical source coordinate frame; rejected ambiguous overlaps.<br>3. *Stack-Based Template Literal State Machine*: Defined formal stack frames `templateStack: Array<{ braceDepth: number }>` for nested template literals and interpolations; included concrete execution traces for $\ge 2$ levels of nested templates.<br>4. *Language-Aware Lexing*: Specified separate comment and literal syntax for Python (`#`, triple quotes), JS/TS (`//`, `/* */`, regex literals vs division), Java/C/C++ (`//`, `/* */`); defined safe fail-safe rejection of macros and unsupported constructs.<br>5. *Horizontal Whitespace Trimming*: Replaced generic `.trim()` with `trimHorizontal()` (tabs, spaces, non-breaking spaces); preserved 100% of internal whitespace, quoted strings, template contents, and line breaks.<br>6. *Relational Abort Invariant*: Strictly separated candidate content validation from relational parent validation; candidate content failures drop 1 candidate ($D{++}$), whereas missing, null, wrong-type, malformed, or mismatched parent IDs **abort the entire persistence operation** immediately without partial persistence.<br>7. *Exhaustive Content Fields & Non-Truncation*: Specified all 13 content fields matching `ReviewIssue` Mongoose schema; rejected whitespace-only titles/descriptions; enforced zero code truncation on snippets/ruleId while permitting safe prose clamping; separated single-line ($columnEnd > columnStart$) vs multi-line coordinate rules.<br>8. *Telemetry Conservation Lifecycle*: Defined end-to-end lifecycle for every input finding ($S \uplus A$); verified that $D$ counts each rejected candidate exactly once without double-counting; established single validation boundary preventing duplicate drops.<br>9. *Expanded 64-Test Matrix*: Recalculated proposed test matrix to **exactly 64 proposed automated tests** (0 executed) covering all architectural features. |

---

## 1. Executive Architecture & Processing Pipeline

Phase 9 Step 3 implements the **Multi-Factor Hybrid Fusion Engine** for the AI Code Review platform. It coordinates deterministic static analyzer findings (from Step 1 & Step 2) and Google Gemini AI semantic analysis (from Phase 8) into a unified, deduplicated issue stream.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            INPUT ANALYSIS STREAMS                            │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ Deterministic Static Analysis Engine │ Google Gemini AI Semantic Model       │
│ • 79 Total Registered Rules          │ • Pre-redacted source analysis        │
│ • Sub-15ms lexical pattern matching  │ • Multi-line taint/context evaluation │
│ • S = S_sec ⊎ S_non-sec              │ • A = A_sec ⊎ A_non-sec               │
└──────────────────┬───────────────────┴───────────────────┬───────────────────┘
                   │                                       │
                   ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 1: COORDINATE VALIDATION & MAPPING                  │
│ • Validate Raw AI Coordinates against redactedCode (1-indexed half-open)     │
│ • Extract slice via Multi-Line Algorithm and compare verbatim (CRLF/CR norm) │
│ • If slice > 2000 chars: drop from fusion, preserve gemini independently     │
│ • Map valid AI coordinates ONCE via root CoordinateMapper.mapToOriginal()    │
│ • Validate Mapped Coordinates against canonical sourceCode boundaries        │
│ • Retain pre-redacted snippet asterisks (Secret Non-Reintroduction)          │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│       STAGE 2: GLOBAL-BUFFER SCANNER & EXACT OCCURRENCE MATCHING             │
│ • Complete Canonical Source Buffer Scanning: Global UTF-16 offsets [0, N)    │
│ • State Machine: CODE, QUOTE, TEMPLATE (stack frames), COMMENTS, REGEX       │
│ • Support for Multi-Line Sink Calls: Delimiter depth maintained across \n    │
│ • Unique Source Occurrence Identity: opTokenGlobalSpan [opStart, opEnd)      │
│ • Verbatim Argument Matching: Whitespace inside quotes preserved 100%        │
│ • Exactly 8 Occurrence Identity Conditions verified                          │
│ • Reciprocal-Unique-Best matching rounds (Tied/ambiguous remain un-fused)    │
│ • Synthesize K committed Hybrid issues (source: 'hybrid')                    │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 3: MULTISET TELEMETRY & PERSISTENCE GUARD           │
│ • Non-security findings concatenated: P_non-sec = S_non-sec ⊎ A_non-sec      │
│ • Content Validation: Invalid content drops candidate (D++, single drop)     │
│ • Zero silent code truncation: Snippets > 2000 chars dropped with warning    │
│ • Telemetry Conservation Identity: finalFindingsCount = |S| + |A| - K - D    │
│ • 17-field normalized total comparator for deterministic ordering            │
│ • In reviewPersistence.service.js: Inject reviewId, analysisResultId, userId │
│ • RELATIONAL ABORT GUARD: Missing/malformed/mismatched parent IDs ABORT      │
│   persistence completely — zero silent partial persistence permitted         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete-Source-Buffer Scanner Architecture

### 2.1 Global UTF-16 Offset Scanner Specification

Rather than scanning lines in isolation, the lexical scanner processes the entire canonical source text buffer as a continuous sequence of UTF-16 code units:
$$\text{sourceText}[0 \dots N-1] \quad \text{where } N = \text{sourceText.length}$$

The scanner maintains a persistent parsing state across newlines, tracking:
- `globalOffset`: 0-indexed integer $i \in [0, N-1]$.
- `currentLine`: 1-based line counter (incremented upon encountering `\n`, or `\r` not followed by `\n`).
- `currentCol`: 1-based column counter (incremented per character, reset to 1 after newlines).
- `lexicalState`: Current parser state.
- `parenDepth`: Unmatched `(` count.
- `bracketDepth`: Unmatched `[` count.
- `braceDepth`: Unmatched `{` count.
- `templateStack`: Call stack of nested template literal frames.

### 2.2 Support for Multi-Line Sink Invocations

Multi-line sink calls (e.g. SQL executions or process spawns spanning multiple lines) are **fully supported**:
```javascript
// Example: Multi-line sink call across 4 lines
cursor.execute(
  "SELECT * FROM users WHERE id = %s",
  [userId]
);
```

#### Multi-Line Execution & Argument Extraction Rules:
1. When a registered operation name (e.g. `execute`, `query`, `exec`) is matched in state `CODE`, its exact global token span is recorded:
   $$\text{opTokenGlobalSpan} = [opStartOffset, opEndOffset)$$
2. The scanner traverses forward across whitespace and newlines until encountering `(`.
3. Starting at `(`, the primary argument begins at the first non-whitespace character ($argStartOffset$).
4. The scanner advances character-by-character across newlines, maintaining delimiter depths:
   - String literals, comments, template literals, and regex literals are parsed atomically across newlines.
   - At top-level argument depth (`parenDepth === 1` relative to the call), the first unquoted comma `,` marks $argEndOffset$.
   - If no comma is present, the matching closing parenthesis `)` marks $argEndOffset$.
5. The call ends immediately following the matching closing parenthesis `)`:
   $$\text{callGlobalSpan} = [callStartOffset, callEndOffset) \quad \text{where } callEndOffset = closeParenOffset + 1$$
6. Newlines within the extracted argument slice are normalized to LF (`\n`). All indentation, spaces, and line breaks within quoted strings or templates are preserved 100% verbatim.

---

## 3. Global Source Occurrence Identity

### 3.1 Resolving Static and Gemini Findings to the Same Occurrence

To eliminate ambiguities caused by line-relative indexing, source occurrence identity is anchored strictly to **global UTF-16 offsets** within the canonical source buffer:

1. **Canonical Buffer Unification**:
   - Static findings are generated on the raw canonical source buffer `sourceCode`.
   - Raw Gemini findings (generated on `redactedCode`) are validated against `redactedCode` boundaries, then mapped to original source coordinates **exactly once** using root `coordinateMapper.mapToOriginal()`.
   - Both finding streams now reference the identical canonical source text `sourceCode`.
2. **Coordinate-to-Global-Offset Conversion**:
   Using the pre-computed line-offset index of `sourceCode` ($\text{lineStarts}[L-1]$):
   $$\text{globalOffset}(L, C) = \text{lineStarts}[L - 1] + (C - 1)$$
   - Finding $f$ maps to global interval $[findStartOffset, findEndOffset)$:
     $$findStartOffset = \text{globalOffset}(f.lineStart, f.columnStart)$$
     $$findEndOffset = \text{globalOffset}(f.lineEnd, f.columnEnd)$$
3. **Occurrence Descriptor (`globalSinkOccurrence`)**:
   Every sink occurrence detected by the global scanner is defined by:
   - `globalSinkId`: Unique integer $k \in [0, M-1]$ representing its chronological order in the file.
   - `opName`: Operation identifier string (e.g. `execute`, `query`, `exec`).
   - `opTokenGlobalSpan`: $[opStartOffset, opEndOffset)$.
   - `receiver`: Preceding receiver identifier string or `null`.
   - `receiverGlobalSpan`: $[recStartOffset, recEndOffset)$ or `null`.
   - `primaryArgSlice`: Verbatim extracted argument string (outer horizontal whitespace trimmed).
   - `callGlobalSpan`: $[callStartOffset, callEndOffset)$.
4. **Unique Occurrence Assignment**:
   A finding $f$ (static or mapped AI) associates with occurrence $\text{occ}$ if and only if:
   $$\max(f.findStartOffset, \text{occ}.opStartOffset) < \min(f.findEndOffset, \text{occ}.opEndOffset)$$
   and $f$ overlaps **zero other occurrences** in the entire file.
   - If a finding overlaps zero occurrences or multiple occurrences $\implies$ **Ambiguous Match** $\implies$ strictly rejected from fusion; preserved independently.
5. **Exact Occurrence Identity Verification**:
   Static finding $s$ and mapped AI finding $a$ resolve to the same source occurrence if and only if **all eight of the following conditions** hold:
   1. **Category Equality**: $s.\text{category} === \text{'security'} \land a.\text{category} === \text{'security'}$.
   2. **Positive Line Overlap**: $\max(s.lineStart, a.lineStart) \le \min(s.lineEnd, a.lineEnd)$.
   3. **Operation Identifier Identity**: $\text{opName}(s) === \text{opName}(a)$.
   4. **Identical Global Sink Occurrence**: Both $s$ and $a$ uniquely overlap the identical `opTokenGlobalSpan` ($\text{occId}(s) === \text{occId}(a)$).
   5. **Receiver Expression Identity**: $\text{receiver}(s) === \text{receiver}(a)$ (both null or identical string).
   6. **Verbatim Primary Argument Match**: $\text{trimHorizontal}(\text{norm}(arg_s)) === \text{trimHorizontal}(\text{norm}(arg_a))$ with internal quote whitespace preserved.
   7. **Verbatim Sink Appearance in AI Snippet**: Gemini's `originalSnippet` must contain the sink call text.
   8. **Positive Call Span Overlap**: $\max(s.findStartOffset, a.findStartOffset) < \min(s.findEndOffset, a.findEndOffset)$.

> [!IMPORTANT]
> **No Schema Additions**: Occurrence identity descriptors (`globalSinkId`, `opTokenGlobalSpan`) are **purely ephemeral in-memory structures** used during the fusion pipeline. Zero fields are added to the Mongoose `ReviewIssue` schema.

---

## 4. Stack-Based Template Literal State Machine

### 4.1 Formal Stack Frame Specification

To parse JavaScript and TypeScript template literals with arbitrary levels of nested interpolations and sub-templates without delimiter corruption:

```
Template Frame Structure:
  templateStack: Array<{
    braceDepthAtEntry: number,  // braceDepth at the moment '${' was encountered
    parentState: string         // Lexical state prior to interpolation
  }>
```

#### State Transition Rules:
1. **Entering `TEMPLATE_LITERAL`**:
   - When character `` ` `` is encountered in state `CODE`:
     - Transition to `TEMPLATE_LITERAL`.
2. **Entering Interpolation (`${...}`)**:
   - When characters `${` are encountered in state `TEMPLATE_LITERAL` (and not preceded by unescaped `\`):
     - Push new frame onto `templateStack`: `{ braceDepthAtEntry: braceDepth, parentState: 'TEMPLATE_LITERAL' }`.
     - Increment `braceDepth++`.
     - Transition to state `CODE`.
3. **Handling Braces in `CODE`**:
   - Character `{`: increment `braceDepth++`.
   - Character `}`:
     - Check top of stack: `top = templateStack[templateStack.length - 1]`.
     - If `top && braceDepth === top.braceDepthAtEntry + 1`:
       - This `}` closes the active interpolation!
       - Pop frame from `templateStack`.
       - Decrement `braceDepth--`.
       - Transition back to `TEMPLATE_LITERAL`.
     - Else:
       - Normal block or object literal closing brace; decrement `braceDepth--`.
4. **Closing `TEMPLATE_LITERAL`**:
   - When character `` ` `` is encountered in state `TEMPLATE_LITERAL` (and not preceded by unescaped `\`):
     - Transition to state `CODE`.

### 4.2 Concrete Execution Trace: Two Levels of Nested Templates

Consider the source code:
```javascript
const query = `SELECT * FROM ${ `table_${ db.query("SELECT name") }` } WHERE id = 1`;
```

```
Offset | Token / Char | State               | braceDepth | templateStack               | Notes
-------+--------------+---------------------+------------+-----------------------------+---------------------------------------
0      | const query= | CODE                | 0          | []                          | Initial code state
14     | `            | TEMPLATE_LITERAL    | 0          | []                          | Enters Level 1 template literal
29     | ${           | CODE                | 1          | [{depth:0, parent:TEMP}]    | Enters Level 1 interpolation
32     | `            | TEMPLATE_LITERAL    | 1          | [{depth:0, parent:TEMP}]    | Enters Level 2 nested template
41     | ${           | CODE                | 2          | [{...}, {depth:1, parent}]  | Enters Level 2 interpolation
44     | db.query(    | CODE                | 2          | [{...}, {depth:1, parent}]  | SINK DETECTED in valid CODE state!
68     | }            | TEMPLATE_LITERAL    | 1          | [{depth:0, parent:TEMP}]    | Matches Level 2 depth+1 => Exits L2 int
69     | `            | CODE                | 1          | [{depth:0, parent:TEMP}]    | Closes Level 2 template literal
71     | }            | TEMPLATE_LITERAL    | 0          | []                          | Matches Level 1 depth+1 => Exits L1 int
88     | `            | CODE                | 0          | []                          | Closes Level 1 template literal
```
This guarantees that `db.query("SELECT name")` is recognized in state `CODE` with 100% precision, without corrupting delimiter counts or misinterpreting nested backticks.

---

## 5. Language-Aware Lexing & Comment Grammar

The scanner customizes its lexical tokenization per language to prevent comments or string literals from triggering false sink identifications:

### 5.1 Per-Language Comment & Literal Grammar
1. **Python**:
   - Single-line comments: `#` consumes all characters until `\n`.
   - Triple-quoted strings / docstrings: `'''...'''` and `"""..."""` transition to `TRIPLE_QUOTE` state until matching unescaped triple delimiter. Newlines and quotes inside are consumed verbatim.
   - Standard strings: `'...'` and `"..."` with backslash escaping (`\.`).
2. **JavaScript / TypeScript**:
   - Single-line comments: `//` consumes until `\n`.
   - Block comments: `/*` consumes until `*/`.
   - Template literals: `` `...` `` with recursive stack-based `${...}` parsing.
   - String literals: `'...'` and `"..."` with backslash escaping.
   - **Regular Expression Literals**:
     - Disambiguating `/` as a regex literal vs. division operator:
     - If `/` is preceded by an operator, punctuation, or keyword expecting an expression (`(`, `=`, `+`, `-`, `*`, `,`, `:`, `[`, `!`, `&`, `|`, `?`, `{`, `;`, `return`, `case`, `throw`, `await`):
       - `/` initiates `REGEX_LITERAL` state.
       - Inside `REGEX_LITERAL`, character classes `[...]` and escaped slashes `\/` are consumed atomically until the terminating `/` and optional flag characters (`[gimsuy]*`).
     - If `/` is preceded by an identifier, number, `)`, or `]`:
       - `/` is treated as a division arithmetic operator in state `CODE`.
3. **Java, C, and C++**:
   - Single-line comments: `//` consumes until `\n`.
   - Block comments: `/*` consumes until `*/`.
   - String literals: `"..."` with backslash escaping.
   - Character literals: `'...'` with backslash escaping.

### 5.2 Handling of Unsupported Syntactic Constructs
The engine makes **no claim to full AST, CFG, or semantic compilation**. Unsupported constructs are handled safely via **fail-safe rejection**:
- **C/C++ Preprocessor Macros** (e.g. `#define RUN(x) exec(x)`): The scanner flags `UNRESOLVED_MACRO` $\implies$ findings remain independent.
- **Dynamic Method Invocations** (e.g. `getattr(module, 'exec')(cmd)` or `obj[methodName](query)`): Scanner flags `UNRESOLVED_COMPLEX_RECEIVER` $\implies$ findings remain independent.
- **Unbalanced Delimiters**: If source code syntax has unclosed parentheses or quotes on EOF $\implies$ fusion is aborted; findings remain independent.

---

## 6. Horizontal Whitespace Normalization & Verbatim Argument Comparison

### 6.1 Defined Horizontal-Whitespace Trimming (`trimHorizontal`)

Generic `.trim()` is strictly prohibited as it strips newlines (`\n`, `\r`) from multi-line expressions. The engine specifies an exact horizontal trimming function:

```javascript
/**
 * Trims only horizontal whitespace (spaces, tabs, non-breaking spaces)
 * from the outer boundaries of a string, preserving all internal whitespace,
 * line breaks, and quote contents.
 */
export function trimHorizontal(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/^[\t\u0020\u00A0]+|[\t\u0020\u00A0]+$/g, '');
}
```

### 6.2 Comparison Normalization Specification
1. Both static and AI primary argument slices undergo uniform CRLF/CR to LF normalization:
   $$\text{norm}(s) = s.\text{replace}(/\r\n|\r/g, '\n')$$
2. Outer horizontal whitespace is stripped:
   $$arg_A = \text{trimHorizontal}(\text{norm}(\text{primaryArgSlice}_s))$$
   $$arg_B = \text{trimHorizontal}(\text{norm}(\text{primaryArgSlice}_a))$$
3. Exact string comparison:
   $$\mathbf{arg_A === arg_B}$$
4. **Verbatim Invariant**: All spaces, tabs, and newlines inside quotes, template strings, or multi-line parameters (e.g. `"SELECT   *   FROM   users  WHERE  name = 'John  Doe'"`) are preserved 100% character-for-character.

---

## 7. Persistence Invariants & Relational Abort Guard

### 7.1 Separation of Finding Content Validation vs. Relational Parent Validation

To protect data integrity and prevent security boundary violations, the persistence engine enforces a strict separation between **Candidate Content Validation** and **Relational Parent Validation**:

```
                                  INCOMING PROJECTED FINDINGS
                                               │
                                               ▼
                         ┌───────────────────────────────────────────┐
                         │   PHASE A: RELATIONAL PARENT VALIDATION   │
                         │   Checks: reviewId, analysisResultId,     │
                         │           userId                          │
                         └─────────────────────┬─────────────────────┘
                                               │
                       Any Failure? ───────────┴───────────► ALL PASS
                            │                                     │
                            ▼                                     ▼
             ┌─────────────────────────────┐        ┌───────────────────────────┐
             │    ABORT ENTIRE TRANSACTION │        │ PHASE B: CONTENT VALID    │
             │ Throw ApiError.internal()   │        │ Checks 13 content fields  │
             │ ZERO PARTIAL PERSISTENCE    │        └─────────────┬─────────────┘
             └─────────────────────────────┘                      │
                                                                  ▼
                                                    Invalid Field: Drop candidate
                                                    Increment D++ (single drop)
                                                    Persist valid subset
```

### 7.2 Relational Abort Guard Specification
Missing, null, wrong-type, malformed, or mismatched parent IDs indicate a **critical database corruption, broken session context, or cross-tenant tampering attempt**.

> [!CAUTION]
> **Relational Parent Abort Invariant**:
> If ANY projected finding fails relational parent validation (`reviewId`, `analysisResultId`, or `userId`), the persistence service **MUST NOT silently drop the finding and persist the remainder**.
> It **MUST ABORT THE ENTIRE PERSISTENCE OPERATION IMMEDIATELY** with a structured `ApiError.internal('Persistence aborted: Relational parent integrity violation')`.
> Zero partial records may be written to the database.

```javascript
export function assertRelationalParentIntegrity(projectedIssues, expectedParents) {
  for (const issue of projectedIssues) {
    const { reviewId, analysisResultId, userId } = issue;

    // Validate reviewId
    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId) || reviewId.toString() !== expectedParents.reviewId.toString()) {
      throw new ApiError(500, `Relational parent integrity violation: invalid or mismatched reviewId`);
    }

    // Validate analysisResultId
    if (!analysisResultId || !mongoose.Types.ObjectId.isValid(analysisResultId) || analysisResultId.toString() !== expectedParents.analysisResultId.toString()) {
      throw new ApiError(500, `Relational parent integrity violation: invalid or mismatched analysisResultId`);
    }

    // Validate userId (Cross-tenant security check)
    if (!userId || !mongoose.Types.ObjectId.isValid(userId) || userId.toString() !== expectedParents.userId.toString()) {
      throw new ApiError(500, `Relational parent integrity violation: invalid or mismatched userId`);
    }
  }
}
```

### 7.3 Candidate Content Validation & Single-Drop Semantics
Candidate content validation verifies the 13 content fields. If an individual finding has an invalid enum, inverted single-line coordinates, or snippet $> 2000$ characters:
- The individual finding is excluded from persistence.
- It increments $D$ by **exactly ONE** ($D \leftarrow D + 1$).
- Remaining valid findings proceed to database insertion via `ReviewIssue.insertMany()`.

---

## 8. All 13 Content Fields: Schema Constraints & Clamping Rules

Inspection of [`server/src/models/reviewIssue.model.js`](file:///c:/Users/Abhishek%20Pal/OneDrive/Desktop/aiCode%20review/server/src/models/reviewIssue.model.js) confirms the schema mandates **3 parent relational ObjectId fields** and **13 finding content fields** (16 application fields total):

| # | Field Name | Data Type | Nullable? | Mongoose / Validation Constraint | Clamping vs. Dropping Rule |
|---|---|---|---|---|---|
| 1 | `category` | String | No | Enum: `['bug', 'security', 'performance', 'maintainability', 'style']` | **Drop candidate if not in enum** ($D_{\text{enum}}{++}, D{++}$) |
| 2 | `severity` | String | No | Enum: `['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']` | **Drop candidate if not in enum** ($D_{\text{enum}}{++}, D{++}$) |
| 3 | `title` | String | No | `trim: true`, `maxlength: 150`, non-empty | Safe prose clamp to 147 chars + `'...'`; **drop if empty or whitespace-only** ($D_{\text{type}}{++}, D{++}$) |
| 4 | `description` | String | No | `trim: true`, `maxlength: 1000`, non-empty | Safe prose clamp to 997 chars + `'...'`; **drop if empty or whitespace-only** ($D_{\text{type}}{++}, D{++}$) |
| 5 | `lineStart` | Number | No | Finite positive integer $\ge 1$ | **Drop candidate if non-integer / $< 1$** ($D_{\text{coords}}{++}, D{++}$) |
| 6 | `lineEnd` | Number | No | Finite positive integer $\ge lineStart$ | **Drop candidate if $< lineStart$** ($D_{\text{coords}}{++}, D{++}$) |
| 7 | `columnStart` | Number | Yes (def 1) | Finite positive integer $\ge 1$ | **Drop candidate if non-integer / $< 1$** ($D_{\text{coords}}{++}, D{++}$) |
| 8 | `columnEnd` | Number | Yes (def 1) | Finite positive integer $\ge 1$; see coordinate rules below | **Drop candidate if inverted on single-line / $< 1$** ($D_{\text{coords}}{++}, D{++}$) |
| 9 | `originalSnippet` | String | Yes (def '') | `maxlength: 2000` | **Zero code truncation**: Drop candidate if $> 2000$ chars ($D_{\text{snippet}}{++}, D{++}$) |
| 10 | `suggestedSnippet`| String | Yes (def '') | `maxlength: 2000` | **Zero code truncation**: Drop candidate if $> 2000$ chars ($D_{\text{snippet}}{++}, D{++}$) |
| 11 | `explanation` | String | Yes (def '') | `maxlength: 2000` | Safe prose clamp to 1997 chars + `'...'`; default `''` if omitted |
| 12 | `ruleId` | String / Null | Yes (def null)| `maxlength: 60`, string or null | **Zero truncation**: Drop candidate if $> 60$ chars ($D_{\text{ruleId}}{++}, D{++}$) |
| 13 | `source` | String | No | Enum: `['static', 'gemini', 'hybrid']` | **Drop candidate if not in enum** ($D_{\text{enum}}{++}, D{++}$) |

### 8.1 Coordinate Range Rules
- **Single-Line Findings ($lineStart === lineEnd$)**:
  - Requires $columnEnd > columnStart$ (at least 1 character width span). Empty ranges ($columnEnd === columnStart$) and inverted ranges ($columnEnd < columnStart$) are rejected.
  - Requires $columnEnd \le \text{lineLength}(lineStart) + 1$.
- **Multi-Line Findings ($lineStart < lineEnd$)**:
  - Requires $1 \le columnStart \le \text{lineLength}(lineStart) + 1$.
  - Requires $1 \le columnEnd \le \text{lineLength}(lineEnd) + 1$.
  - $columnEnd \le columnStart$ is **EXPLICITLY PERMITTED** across multi-line spans, because start and end columns apply to different physical lines (e.g. line 2 col 40 to line 4 col 5 is completely valid).

### 8.2 Whitespace-Only Text Handling & Code Non-Truncation
- **`title` and `description`**: If `typeof val !== 'string'` or `val.trim().length === 0` (empty or whitespace-only), the candidate is rejected without coercion ($D_{\text{type}}{++}, D{++}$). Whitespace-only is not valid prose.
- **Code Snippets and Identifiers**: `originalSnippet`, `suggestedSnippet`, and `ruleId` represent executable code and rule keys. They must **NEVER BE SILENTLY TRUNCATED**. Any candidate exceeding the schema limit is dropped with a structured warning log ($D_{\text{snippet}}{++}$ or $D_{\text{ruleId}}{++}$, and $D{++}$).

---

## 9. Mathematical Telemetry Accounting & Conservation Theorem

### 9.1 Single Accounting Boundary & Finding Lifecycle

Every finding entering the pipeline belongs to the input multiset $I = S \uplus A$ ($|I| = |S| + |A|$) and follows exactly one of four distinct lifecycle outcomes:

```
                           INPUT FINDINGS ( |S| + |A| )
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 │                                               │
                 ▼                                               ▼
    [1] PRE-FUSION REJECTION                        PASSED PRE-FUSION VALIDATION
    (Invalid AI coords in redactedCode)                          │
    Increments D++                                               │
                                                                 ▼
                                                  ┌──────────────────────────────┐
                                                  │ TIER 1 SINK OCCURRENCE FUSION│
                                                  └──────────────┬───────────────┘
                                                                 │
                                 ┌───────────────────────────────┴───────────────────────────────┐
                                 │                                                               │
                                 ▼                                                               ▼
                     [2] COMMITTED FUSION PAIR                                     [3] UN-FUSED INDEPENDENT FINDING
                     Consumes: 1 static + 1 AI                                     Produces: 1 candidate
                     Produces: 1 hybrid candidate                                  (|S| - K static + |A| - K AI)
                     (Total K candidates)                                                        │
                                 │                                                               │
                                 └───────────────────────────────┬───────────────────────────────┘
                                                                 │
                                                                 ▼
                                                    INTERMEDIATE OUTPUT CANDIDATES
                                                    Total = |S| + |A| - K
                                                                 │
                                 ┌───────────────────────────────┴───────────────────────────────┐
                                 │                                                               │
                                 ▼                                                               ▼
                     [4] PERSISTENCE REJECTION                                       [5] PERSISTED FINDING
                     (Content validation failure)                                    Valid projected document
                     Increments D++ (single drop)                                    Saved to DB: finalFindingsCount
```

### 9.2 Conservation Theorem & Equation

$$\mathbf{\text{finalFindingsCount} = |S| + |A| - K - D}$$

Where:
- **$S$**: Multiset of input static findings.
- **$A$**: Multiset of raw input Gemini AI findings.
- **$K$**: Number of successfully committed one-to-one hybrid fusion pairs.
- **$D$**: Total number of **unique output candidates excluded from the final persisted result**.
- **$\text{finalFindingsCount}$**: Total issues persisted in MongoDB.

#### Single Drop Semantics for Fused Rejections:
If a committed hybrid candidate $h = \text{fuse}(s, a)$ is rejected during persistence validation, it increments $D$ by **exactly ONE** ($D \leftarrow D + 1$), NOT two.
$$\text{finalFindingsCount} = |S| + |A| - K - 1$$

---

## 10. Expanded Proposed Test Suite Matrix (`server/tests/hybridFusion.test.js`)

The proposed test suite is structured into 7 dedicated test suites totaling **exactly 64 proposed automated tests**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ SUITE 1: Pair-Score Table, Directed Lookup & Match Scoring (4 tests)   │
│ 1. [PROPOSED] PairScoreTable stores and retrieves directed scores      │
│ 2. [PROPOSED] matchScores.get(s)?.get(a) returns default 0 for missing │
│ 3. [PROPOSED] Tier 1 matchScore calculation (IoU + positive col overlap│
│ 4. [PROPOSED] Ineligible candidate rejection (zero score if no overlap)│
├────────────────────────────────────────────────────────────────────────┤
│ SUITE 2: Reciprocal-Unique-Best Matching Strategy (4 tests)            │
│ 5. [PROPOSED] Mutual unique-best match commits successfully            │
│ 6. [PROPOSED] Asymmetric candidate scores resolve strictly to best     │
│ 7. [PROPOSED] Tied AI candidates (1 static vs 2 identical AI) remain 3 │
│ 8. [PROPOSED] One-to-one participation invariant verified across rounds│
├────────────────────────────────────────────────────────────────────────┤
│ SUITE 3: Global-Buffer Lexical Scanner & Template Machine (12 tests)   │
│ 9.  [PROPOSED] Global UTF-16 offset scanner parses tokens across \n    │
│ 10. [PROPOSED] Multiline sink call: extracts invocation & args across \n│
│ 11. [PROPOSED] Template literal stack frame: Level 1 interpolation     │
│ 12. [PROPOSED] Template literal stack frame: Level 2 nested templates  │
│ 13. [PROPOSED] Language-aware comments: Python # and triple-quotes     │
│ 14. [PROPOSED] Language-aware comments: JS/TS // and /* */             │
│ 15. [PROPOSED] JS/TS regex literal detection (/pattern/ vs division)   │
│ 16. [PROPOSED] Java/C/C++ comment syntax and string literal handling   │
│ 17. [PROPOSED] Unsupported syntax/macros rejected safely as un-fused   │
│ 18. [PROPOSED] trimHorizontal preserves internal quote whitespace      │
│ 19. [PROPOSED] Multiple identical calls disambiguated by global token  │
│ 20. [PROPOSED] Standalone exec/spawn without verified receiver rejected│
├────────────────────────────────────────────────────────────────────────┤
│ SUITE 4: Source Occurrence Identity & Coordinate Contracts (8 tests)   │
│ 21. [PROPOSED] Occurrence identity established via unique global span  │
│ 22. [PROPOSED] Multi-line source extraction (colStart, full, colEnd)   │
│ 23. [PROPOSED] Newline handling: LF, CRLF, and CR parsed and normalized│
│ 24. [PROPOSED] Single-line coordinate validation requires colEnd>colStart│
│ 25. [PROPOSED] Multi-line validation permits colEnd <= colStart        │
│ 26. [PROPOSED] Pre-mapping validation against redactedCode boundaries  │
│ 27. [PROPOSED] Post-mapping boundary failure via CoordinateMapper drop │
│ 28. [PROPOSED] Secret non-reintroduction: pre-redacted asterisks kept  │
├────────────────────────────────────────────────────────────────────────┤
│ SUITE 5: Content-Field Persistence Validation & Clamping (12 tests)    │
│ 29. [PROPOSED] Rejects invalid category enum (enums++)                 │
│ 30. [PROPOSED] Rejects invalid severity enum (enums++)                 │
│ 31. [PROPOSED] Rejects invalid source enum (enums++)                   │
│ 32. [PROPOSED] Rejects whitespace-only title (type++)                  │
│ 33. [PROPOSED] Safe prose clamping for oversized title (> 150 chars)   │
│ 34. [PROPOSED] Rejects whitespace-only description (type++)            │
│ 35. [PROPOSED] Safe prose clamping for oversized description (> 1000)  │
│ 36. [PROPOSED] Safe prose clamping for explanation (> 2000 chars)      │
│ 37. [PROPOSED] Rejects oversized originalSnippet > 2000 chars (snippet)│
│ 38. [PROPOSED] Rejects oversized suggestedSnippet > 2000 chars (snippet│
│ 39. [PROPOSED] Rejects oversized ruleId > 60 chars (ruleId++)          │
│ 40. [PROPOSED] Default value assignment for optional fields            │
├────────────────────────────────────────────────────────────────────────┤
│ SUITE 6: Relational Parent Ownership & Abort Invariant (16 tests)      │
│ 41. [PROPOSED] Valid projected ReviewIssue with valid ObjectIds passes │
│ 42. [PROPOSED] Missing reviewId aborts persistence operation           │
│ 43. [PROPOSED] Null reviewId aborts persistence operation              │
│ 44. [PROPOSED] Wrong-type reviewId (number/boolean) aborts persistence │
│ 45. [PROPOSED] Malformed reviewId (non-24 hex string) aborts persist   │
│ 46. [PROPOSED] Mismatched reviewId aborts persistence operation        │
│ 47. [PROPOSED] Missing analysisResultId aborts persistence operation   │
│ 48. [PROPOSED] Null analysisResultId aborts persistence operation      │
│ 49. [PROPOSED] Wrong-type analysisResultId (number/bool) aborts persist│
│ 50. [PROPOSED] Malformed analysisResultId (non-24 hex) aborts persist  │
│ 51. [PROPOSED] Mismatched analysisResultId aborts persistence operation│
│ 52. [PROPOSED] Missing userId aborts persistence operation             │
│ 53. [PROPOSED] Null userId aborts persistence operation                │
│ 54. [PROPOSED] Wrong-type userId (number/boolean) aborts persistence   │
│ 55. [PROPOSED] Malformed userId (non-24 hex string) aborts persist     │
│ 56. [PROPOSED] Mismatched userId (cross-user tenancy) aborts persist   │
├────────────────────────────────────────────────────────────────────────┤
│ SUITE 7: Telemetry Accounting & Lifecycle Conservation (8 tests)       │
│ 57. [PROPOSED] Accounting Example 1: Clean fusion (|S|=3, |A|=2, K=1)  │
│ 58. [PROPOSED] Accounting Example 2: Invalid AI coords pre-fusion (D=1)│
│ 59. [PROPOSED] Accounting Example 3: Fused candidate rejected (D=1)    │
│ 60. [PROPOSED] Multiple validation failures on single candidate (D=1)  │
│ 61. [PROPOSED] Non-security findings bypass fusion & keep multiset     │
│ 62. [PROPOSED] Telemetry conservation holds across lifecycle stages    │
│ 63. [PROPOSED] Collision-safe JSON fingerprints immune to collisions   │
│ 64. [PROPOSED] 17-field comparator verifies antisymmetry, transitivity │
└────────────────────────────────────────────────────────────────────────┘
Suite Breakdown: 4 + 4 + 12 + 8 + 12 + 16 + 8 = Exactly 64 proposed automated tests.
```

> [!NOTE]
> **Proposed vs. Executed Test Status**:
> The 64 tests detailed above represent the **proposed verification suite** to be authored during implementation. In accordance with strict Plan-Only Mode constraints, **exactly 0 tests have been executed** during this phase.

---

## 11. Five-File Implementation Boundary & Non-Modification Governance

The implementation scope is explicitly bounded to **strictly five files**:

| Action | Target File Path | Permitted Scope of Modification |
|---|---|---|
| **CREATE** | [`server/src/services/hybridFusion.service.js`](file:///c:/Users/Abhishek%20Pal/OneDrive/Desktop/aiCode%20review/server/src/services/hybridFusion.service.js) | Core fusion coordinator: `PairScoreTable`, `matchReciprocalUniqueBest()`, global-buffer scanner, multi-line slice extractor, 3-stage coordinate validator (Cases A–D), `validateCandidateContent()`, `assertRelationalParentIntegrity()`, 17-field comparator, and multiset telemetry aggregator. |
| **MODIFY** | [`server/src/services/review.service.js`](file:///c:/Users/Abhishek%20Pal/OneDrive/Desktop/aiCode%20review/server/src/services/review.service.js) | Route raw AI issues, `redactedCode`, and root `coordinateMapper` from `redactSecrets()` directly into `fuseFindings()`. Protect database insertion by applying candidate content validation before passing issues to `persistReviewAtomic()`. Preserve static findings in Static Fallback Mode. |
| **MODIFY** | [`server/src/services/gemini.service.js`](file:///c:/Users/Abhishek%20Pal/OneDrive/Desktop/aiCode%20review/server/src/services/gemini.service.js) | Add minimal prompt clarification in `buildGeminiPrompt()` instructing verbatim snippet extraction between 1-based, half-open coordinates. **Zero changes to strict 11-field schema**. |
| **MODIFY** | [`server/src/services/reviewPersistence.service.js`](file:///c:/Users/Abhishek%20Pal/OneDrive/Desktop/aiCode%20review/server/src/services/reviewPersistence.service.js) | **Strictly and exclusively**: Apply `assertRelationalParentIntegrity()` immediately before `ReviewIssue.insertMany()` in Path A and Path B. Abort persistence if relational IDs are invalid or mismatched. Keep all relational assignments (`reviewId`, `analysisResultId`, `userId`), transaction handling, and compensating rollback logic 100% unchanged. |
| **CREATE** | [`server/tests/hybridFusion.test.js`](file:///c:/Users/Abhishek%20Pal/OneDrive/Desktop/aiCode%20review/server/tests/hybridFusion.test.js) | Comprehensive automated test suite implementing all 64 proposed unit and integration tests from Section 10. |

### Explicit Non-Modification Governance:
- ❌ **Zero modifications to `client/`**: Frontend components remain frozen until Step 5.
- ❌ **Zero modifications to `server/src/controllers/review.controller.js` or `review.routes.js`**: Endpoint contracts remain frozen until Step 4.
- ❌ **Zero modifications to `server/src/models/`**: Mongoose schemas (`ReviewIssue.model.js`, `analysisResult.model.js`, `review.model.js`, `user.model.js`) remain 100% frozen.
- ❌ **Zero modifications to `server/src/services/scoring.js`**: Formulas, weightings ($0.40$ static / $0.60$ AI), and the single Critical score cap of $\le 74$ remain frozen.
- ❌ **Zero modifications to `server/src/services/staticAnalyzer/utils/lineMapper.js` or `preprocessor.js`**: Preprocessor and coordinate contracts remain frozen.
- ❌ **Zero modifications to `server/src/services/secretRedaction.service.js`**: Redaction service and `CoordinateMapper` class remain frozen.
- ❌ **Zero modifications to `server/src/schemas/aiResponse.schema.js`**: 11-field Zod schema remains frozen.
- ❌ **Zero external CVE lookups or live compiler/runtime execution**.

---

## 12. Remaining Limitations & Architectural Risks

| Risk / Limitation | Impact | Mitigation Strategy |
|---|---|---|
| **Highly Obfuscated Code Patterns** | Dynamic dispatch, `getattr()`, or eval-like indirection bypass lexical matching | Safely rejected by the scanner; findings are preserved independently without false-positive fusion. |
| **Oversized AI Code Snippets** | Long snippets exceeding 2,000 characters cannot be stored in `ReviewIssue` | Pre-persistence validation rejects findings $> 2000$ chars with structured warning logs, protecting the database transaction from aborting. |
| **Network Latency or Gemini Outage** | Gemini API timeout or rate limit | Deterministic static fallback mode activates automatically, preserving all static findings with honest nulls for AI scores. |

---

> [!IMPORTANT]
> **Strict Plan-Only Mode Confirmation**
> This task was executed strictly in Plan-Only Mode. No application source code has been modified, created, or deleted. Exactly zero automated tests were executed. The authoritative specification document has been updated on disk at [`docs/PHASE_9_STEP_3_IMPLEMENTATION_PLAN.md`](file:///c:/Users/Abhishek%20Pal/OneDrive/Desktop/aiCode%20review/docs/PHASE_9_STEP_3_IMPLEMENTATION_PLAN.md).
> 
> **STATUS: PLAN ONLY — AWAITING REVIEW APPROVAL.**
