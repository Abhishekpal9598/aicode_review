/**
 * Multi-Factor Hybrid Security Finding Fusion Service
 * server/src/services/hybridFusion.service.js
 *
 * Implements Phase 9 Step 3:
 * - Complete-source-buffer lexical scanner with global UTF-16 offsets
 * - Multiline sink call and balanced argument extraction
 * - Global source occurrence identity and conservative language-aware lexing
 * - Stack-based nested template literal handling (${...})
 * - Pre-redacted AI coordinate validation and single CoordinateMapper mapping
 * - Tier 1 Reciprocal-Unique-Best candidate matching
 * - Strict 13-field ReviewIssue content validation & zero code truncation
 * - Native Mongoose/BSON relational parent integrity assertion & abort invariant
 * - Telemetry conservation: finalFindingsCount = |S| + |A| - K - D
 */

import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

// =============================================================================
// 1. CONSTANTS & REGISTRIES
// =============================================================================

export const ALLOWED_CATEGORIES = new Set(['bug', 'security', 'performance', 'maintainability', 'style']);
export const ALLOWED_SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
export const ALLOWED_SOURCES = new Set(['static', 'gemini', 'hybrid']);

export const SEVERITY_RANK = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4
};

export const SOURCE_RANK = {
  hybrid: 0,
  static: 1,
  gemini: 2
};

// Supported Hazardous Sink Operation Names
const SINK_OPERATIONS = new Set([
  'execute', 'query',
  'exec', 'spawn', 'Popen', 'call', 'check_call', 'check_output', 'run', 'system',
  'eval', 'Function'
]);

// =============================================================================
// 2. WHITESPACE & STRING UTILITIES
// =============================================================================

/**
 * Trims only horizontal whitespace (spaces, tabs, non-breaking spaces)
 * from the outer boundaries of a string, preserving all internal whitespace,
 * line breaks, and quote contents.
 *
 * @param {string} str
 * @returns {string}
 */
export function trimHorizontal(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/^[\t\u0020\u00A0]+|[\t\u0020\u00A0]+$/g, '');
}

/**
 * Normalizes newlines across platforms (Windows CRLF \r\n, Mac CR \r -> Unix LF \n)
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeNewlines(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\r\n|\r/g, '\n');
}

/**
 * Deterministically extracts the exact source slice for single-line or multi-line findings.
 *
 * @param {string[]} lines - Array of source lines split by canonical line breaks
 * @param {number} lineStart - 1-based start line
 * @param {number} columnStart - 1-based start column
 * @param {number} lineEnd - 1-based end line
 * @param {number} columnEnd - 1-based exclusive end column
 * @returns {string}
 */
export function extractSourceSlice(lines, lineStart, columnStart, lineEnd, columnEnd) {
  if (!Array.isArray(lines) || lines.length === 0) return '';
  if (lineStart < 1 || lineEnd < lineStart || lineStart > lines.length) return '';

  // Case A: Single-line finding
  if (lineStart === lineEnd) {
    const line = lines[lineStart - 1] || '';
    const startOffset = Math.max(0, columnStart - 1);
    const endOffset = Math.min(line.length, columnEnd - 1);
    if (startOffset >= endOffset) return '';
    return line.slice(startOffset, endOffset);
  }

  // Case B: Multi-line finding
  const resultLines = [];

  // 1. First line: from (columnStart - 1) to the end of the line
  const firstLine = lines[lineStart - 1] || '';
  const firstStartOffset = Math.max(0, columnStart - 1);
  resultLines.push(firstLine.slice(firstStartOffset));

  // 2. Intermediate complete lines: full line content
  for (let l = lineStart + 1; l < lineEnd; l++) {
    resultLines.push(lines[l - 1] || '');
  }

  // 3. Last line: from index 0 to (columnEnd - 1)
  const lastLine = lines[lineEnd - 1] || '';
  const lastEndOffset = Math.min(lastLine.length, columnEnd - 1);
  resultLines.push(lastLine.slice(0, lastEndOffset));

  return resultLines.join('\n');
}

// =============================================================================
// 3. COMPLETE-SOURCE-BUFFER LEXICAL SCANNER
// =============================================================================

/**
 * Pre-computes 0-based character offsets for the start of every line.
 *
 * @param {string} source
 * @returns {number[]}
 */
export function computeLineStarts(source) {
  const lineStarts = [0];
  const len = source.length;
  for (let i = 0; i < len; i++) {
    const ch = source[i];
    if (ch === '\n') {
      lineStarts.push(i + 1);
    } else if (ch === '\r') {
      if (i + 1 < len && source[i + 1] === '\n') {
        lineStarts.push(i + 2);
        i++; // skip LF
      } else {
        lineStarts.push(i + 1);
      }
    }
  }
  return lineStarts;
}

/**
 * Converts (line, column) 1-based coordinates to 0-based global UTF-16 offset.
 */
export function coordinateToGlobalOffset(line, column, lineStarts) {
  const lineIdx = Math.max(1, Math.min(line, lineStarts.length)) - 1;
  return lineStarts[lineIdx] + Math.max(0, column - 1);
}

/**
 * Converts 0-based global UTF-16 offset to 1-based (line, column) coordinates.
 */
export function globalOffsetToCoordinate(offset, lineStarts) {
  let low = 0;
  let high = lineStarts.length - 1;
  let lineIdx = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= offset) {
      lineIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return {
    line: lineIdx + 1,
    column: offset - lineStarts[lineIdx] + 1
  };
}

/**
 * Deterministic Complete-Source-Buffer Lexical Scanner
 * Operates across the continuous buffer [0, N) with global UTF-16 offsets.
 * Tracks nested template literals via templateStack, delimiter depths across newlines,
 * and extracts multi-line sink calls and primary arguments.
 *
 * @param {string} sourceText - Full canonical source text
 * @param {string} language - Programming language (javascript, python, java, c, cpp, etc.)
 * @returns {Array<object>} Array of detected sink occurrences
 */
export function scanGlobalSourceBuffer(sourceText, language = 'javascript') {
  const safeLang = (language || '').toLowerCase().trim();
  const text = typeof sourceText === 'string' ? sourceText : '';
  const len = text.length;
  const lineStarts = computeLineStarts(text);

  const isPython = safeLang === 'python';
  const isJsTs = safeLang === 'javascript' || safeLang === 'typescript';

  const occurrences = [];

  let state = 'CODE';
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  // Stack of template literal frames: Array<{ braceDepthAtEntry: number }>
  const templateStack = [];

  // Helper to check what preceded a slash for JS/TS regex literal vs division
  function isRegexContext(pos) {
    let p = pos - 1;
    while (p >= 0 && (text[p] === ' ' || text[p] === '\t' || text[p] === '\r' || text[p] === '\n')) {
      p--;
    }
    if (p < 0) return true;
    const prevChar = text[p];
    // Tokens that expect an expression: operators, punctuation, opening delimiters
    if ('(=+-*&|?!:,;{[~^%<>'.includes(prevChar)) return true;

    // Check keyword preceding (return, case, throw, await, typeof, etc.)
    let wordEnd = p + 1;
    while (p >= 0 && /[a-zA-Z0-9_$]/.test(text[p])) {
      p--;
    }
    const word = text.slice(p + 1, wordEnd);
    if (['return', 'case', 'throw', 'await', 'typeof', 'instanceof', 'void', 'delete', 'in', 'of', 'yield'].includes(word)) {
      return true;
    }
    return false;
  }

  let i = 0;
  while (i < len) {
    const ch = text[i];
    const nextCh = i + 1 < len ? text[i + 1] : '';

    // =========================================================================
    // STATE: SINGLE_QUOTE
    // =========================================================================
    if (state === 'SINGLE_QUOTE') {
      if (ch === '\\') {
        i += 2; // skip escaped character
        continue;
      }
      if (ch === "'") {
        state = 'CODE';
      }
      i++;
      continue;
    }

    // =========================================================================
    // STATE: DOUBLE_QUOTE
    // =========================================================================
    if (state === 'DOUBLE_QUOTE') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '"') {
        state = 'CODE';
      }
      i++;
      continue;
    }

    // =========================================================================
    // STATE: TRIPLE_QUOTE (Python docstrings)
    // =========================================================================
    if (state === 'TRIPLE_QUOTE_SINGLE' || state === 'TRIPLE_QUOTE_DOUBLE') {
      const delim = state === 'TRIPLE_QUOTE_SINGLE' ? "'''" : '"""';
      if (text.startsWith(delim, i)) {
        state = 'CODE';
        i += 3;
        continue;
      }
      if (ch === '\\') {
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // =========================================================================
    // STATE: LINE_COMMENT
    // =========================================================================
    if (state === 'LINE_COMMENT') {
      if (ch === '\n' || ch === '\r') {
        state = 'CODE';
      }
      i++;
      continue;
    }

    // =========================================================================
    // STATE: BLOCK_COMMENT
    // =========================================================================
    if (state === 'BLOCK_COMMENT') {
      if (ch === '*' && nextCh === '/') {
        state = 'CODE';
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    // =========================================================================
    // STATE: REGEX_LITERAL (JS/TS)
    // =========================================================================
    if (state === 'REGEX_LITERAL') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '[') {
        // character class in regex
        let j = i + 1;
        while (j < len && text[j] !== ']') {
          if (text[j] === '\\') j++;
          j++;
        }
        i = j + 1;
        continue;
      }
      if (ch === '/') {
        // Regex ended, skip optional flags
        i++;
        while (i < len && /[a-z]/i.test(text[i])) {
          i++;
        }
        state = 'CODE';
        continue;
      }
      if (ch === '\n' || ch === '\r') {
        // Unterminated regex literal on newline; fail-safe to CODE
        state = 'CODE';
      }
      i++;
      continue;
    }

    // =========================================================================
    // STATE: TEMPLATE_LITERAL (JS/TS backticks)
    // =========================================================================
    if (state === 'TEMPLATE_LITERAL') {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '$' && nextCh === '{') {
        // Push frame and transition to CODE
        templateStack.push({ braceDepthAtEntry: braceDepth });
        braceDepth++;
        state = 'CODE';
        i += 2;
        continue;
      }
      if (ch === '`') {
        // Closes this template literal
        state = 'CODE';
        i++;
        continue;
      }
      i++;
      continue;
    }

    // =========================================================================
    // STATE: CODE (Default evaluation state)
    // =========================================================================
    if (state === 'CODE') {
      // 1. Check Python Comments & Triple Quotes
      if (isPython) {
        if (text.startsWith("'''", i)) {
          state = 'TRIPLE_QUOTE_SINGLE';
          i += 3;
          continue;
        }
        if (text.startsWith('"""', i)) {
          state = 'TRIPLE_QUOTE_DOUBLE';
          i += 3;
          continue;
        }
        if (ch === '#') {
          state = 'LINE_COMMENT';
          i++;
          continue;
        }
      }

      // 2. Check JS/TS / C / C++ / Java Comments
      if (!isPython) {
        if (ch === '/' && nextCh === '/') {
          state = 'LINE_COMMENT';
          i += 2;
          continue;
        }
        if (ch === '/' && nextCh === '*') {
          state = 'BLOCK_COMMENT';
          i += 2;
          continue;
        }
      }

      // 3. String Literals
      if (ch === "'") {
        state = 'SINGLE_QUOTE';
        i++;
        continue;
      }
      if (ch === '"') {
        state = 'DOUBLE_QUOTE';
        i++;
        continue;
      }

      // 4. JS/TS Template Literals
      if (isJsTs && ch === '`') {
        state = 'TEMPLATE_LITERAL';
        i++;
        continue;
      }

      // 5. JS/TS Regex Literal vs Division
      if (isJsTs && ch === '/' && isRegexContext(i)) {
        state = 'REGEX_LITERAL';
        i++;
        continue;
      }

      // 6. Delimiter Tracking
      if (ch === '(') {
        parenDepth++;
        i++;
        continue;
      }
      if (ch === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
        i++;
        continue;
      }
      if (ch === '[') {
        bracketDepth++;
        i++;
        continue;
      }
      if (ch === ']') {
        bracketDepth = Math.max(0, bracketDepth - 1);
        i++;
        continue;
      }
      if (ch === '{') {
        braceDepth++;
        i++;
        continue;
      }
      if (ch === '}') {
        // Check if this closes a template interpolation
        if (templateStack.length > 0) {
          const top = templateStack[templateStack.length - 1];
          if (braceDepth === top.braceDepthAtEntry + 1) {
            templateStack.pop();
            braceDepth--;
            state = 'TEMPLATE_LITERAL';
            i++;
            continue;
          }
        }
        braceDepth = Math.max(0, braceDepth - 1);
        i++;
        continue;
      }

      // 7. Check for Identifier / Sink Call
      if (/[a-zA-Z_$]/.test(ch)) {
        const idStart = i;
        while (i < len && /[a-zA-Z0-9_$]/.test(text[i])) {
          i++;
        }
        const idEnd = i;
        const opName = text.slice(idStart, idEnd);

        if (SINK_OPERATIONS.has(opName)) {
          // Check backwards for receiver
          let p = idStart - 1;
          while (p >= 0 && (text[p] === ' ' || text[p] === '\t' || text[p] === '\r' || text[p] === '\n')) {
            p--;
          }

          let receiver = null;
          let recStartOffset = null;
          let recEndOffset = null;
          let hasComplexReceiver = false;

          if (p >= 0 && text[p] === '.') {
            const dotPos = p;
            p--;
            while (p >= 0 && (text[p] === ' ' || text[p] === '\t' || text[p] === '\r' || text[p] === '\n')) {
              p--;
            }

            if (p >= 0 && (text[p] === ')' || text[p] === ']')) {
              // Chained call like getDb().query() or connections[0].execute()
              hasComplexReceiver = true;
            } else if (p >= 0 && /[a-zA-Z0-9_$]/.test(text[p])) {
              const recEnd = p + 1;
              while (p >= 0 && /[a-zA-Z0-9_$]/.test(text[p])) {
                p--;
              }
              const recStart = p + 1;
              let recId = text.slice(recStart, recEnd);

              // Check if preceded by child_process.
              if (p >= 0 && text[p] === '.') {
                let pp = p - 1;
                while (pp >= 0 && (text[pp] === ' ' || text[pp] === '\t')) pp--;
                let cEnd = pp + 1;
                while (pp >= 0 && /[a-zA-Z0-9_$]/.test(text[pp])) pp--;
                let cStart = pp + 1;
                if (text.slice(cStart, cEnd) === 'child_process') {
                  recId = 'child_process';
                  recStartOffset = cStart;
                  recEndOffset = dotPos;
                }
              }

              if (!recStartOffset) {
                recStartOffset = recStart;
                recEndOffset = recEnd;
              }
              receiver = recId;
            }
          }

          // Advance forward to find call opening '('
          let f = idEnd;
          while (f < len && (text[f] === ' ' || text[f] === '\t' || text[f] === '\r' || text[f] === '\n')) {
            f++;
          }

          if (f < len && text[f] === '(') {
            const callStartOffset = recStartOffset !== null ? recStartOffset : idStart;
            const openParenPos = f;

            // Scan inside call to find primary argument and closing ')'
            let callParenDepth = 1;
            let callBracketDepth = 0;
            let callBraceDepth = 0;
            let callState = 'CODE';
            let argStartOffset = null;
            let argEndOffset = null;
            let closeParenPos = null;

            let k = openParenPos + 1;
            // Skip leading whitespace inside '('
            while (k < len && (text[k] === ' ' || text[k] === '\t' || text[k] === '\r' || text[k] === '\n')) {
              k++;
            }
            argStartOffset = k;

            while (k < len && callParenDepth > 0) {
              const c = text[k];
              const nc = k + 1 < len ? text[k + 1] : '';

              if (callState === 'SINGLE_QUOTE') {
                if (c === '\\') { k += 2; continue; }
                if (c === "'") callState = 'CODE';
                k++;
                continue;
              }
              if (callState === 'DOUBLE_QUOTE') {
                if (c === '\\') { k += 2; continue; }
                if (c === '"') callState = 'CODE';
                k++;
                continue;
              }
              if (callState === 'TEMPLATE_LITERAL') {
                if (c === '\\') { k += 2; continue; }
                if (c === '`') callState = 'CODE';
                k++;
                continue;
              }

              if (callState === 'CODE') {
                if (c === "'") { callState = 'SINGLE_QUOTE'; k++; continue; }
                if (c === '"') { callState = 'DOUBLE_QUOTE'; k++; continue; }
                if (isJsTs && c === '`') { callState = 'TEMPLATE_LITERAL'; k++; continue; }

                if (c === '(') {
                  callParenDepth++;
                  k++;
                  continue;
                }
                if (c === ')') {
                  callParenDepth--;
                  if (callParenDepth === 0) {
                    closeParenPos = k;
                    if (argEndOffset === null) {
                      argEndOffset = k;
                    }
                    k++;
                    break;
                  }
                  k++;
                  continue;
                }
                if (c === '[') { callBracketDepth++; k++; continue; }
                if (c === ']') { callBracketDepth = Math.max(0, callBracketDepth - 1); k++; continue; }
                if (c === '{') { callBraceDepth++; k++; continue; }
                if (c === '}') { callBraceDepth = Math.max(0, callBraceDepth - 1); k++; continue; }

                // Top-level argument comma
                if (c === ',' && callParenDepth === 1 && callBracketDepth === 0 && callBraceDepth === 0) {
                  if (argEndOffset === null) {
                    argEndOffset = k;
                  }
                }
              }
              k++;
            }

            if (closeParenPos !== null && argStartOffset !== null && argEndOffset !== null) {
              const rawArgSlice = text.slice(argStartOffset, argEndOffset);
              const primaryArgSlice = trimHorizontal(normalizeNewlines(rawArgSlice));
              const callEndOffset = closeParenPos + 1;

              const startCoord = globalOffsetToCoordinate(callStartOffset, lineStarts);
              const endCoord = globalOffsetToCoordinate(callEndOffset, lineStarts);

              occurrences.push({
                globalSinkId: occurrences.length,
                opName,
                opTokenGlobalSpan: [idStart, idEnd],
                receiver,
                receiverGlobalSpan: recStartOffset !== null ? [recStartOffset, recEndOffset] : null,
                primaryArgSlice,
                callGlobalSpan: [callStartOffset, callEndOffset],
                hasComplexReceiver,
                lineStart: startCoord.line,
                columnStart: startCoord.column,
                lineEnd: endCoord.line,
                columnEnd: endCoord.column
              });
            }
          }
        }
        continue;
      }
    }

    i++;
  }

  return occurrences;
}

// =============================================================================
// 4. PAIR-SCORE TABLE & RECIPROCAL-UNIQUE-BEST MATCHING
// =============================================================================

/**
 * Type-safe 2D lookup table for finding pair match scores.
 */
export class PairScoreTable {
  constructor() {
    this._scores = new Map();
  }

  set(s, a, score) {
    if (!this._scores.has(s)) {
      this._scores.set(s, new Map());
    }
    this._scores.get(s).set(a, score);
  }

  get(s, a) {
    return this._scores.get(s)?.get(a) ?? 0;
  }
}

/**
 * Calculates Tier 1 match score between static finding s and mapped AI finding a.
 * Returns score > 0 if candidate is authorized, or 0 if ineligible.
 */
export function calculateTier1MatchScore(s, a, occurrence) {
  // 1. Positive Line Overlap
  const lineOverlapStart = Math.max(s.lineStart, a.lineStart);
  const lineOverlapEnd = Math.min(s.lineEnd, a.lineEnd);
  if (lineOverlapStart > lineOverlapEnd) return 0;

  // 2. Positive Call Column Overlap
  const colOverlap = Math.max(0, Math.min(s.columnEnd, a.columnEnd) - Math.max(s.columnStart, a.columnStart));
  if (colOverlap <= 0) return 0;

  // 3. Line IoU
  const lineUnion = Math.max(s.lineEnd, a.lineEnd) - Math.min(s.lineStart, a.lineStart) + 1;
  const lineIntersection = lineOverlapEnd - lineOverlapStart + 1;
  const lineIoU = lineIntersection / lineUnion;

  // Base score 105.0 + up to 10.0 based on line overlap
  return 105.0 + 10.0 * lineIoU;
}

/**
 * Commits reciprocal-unique-best pairs across multiple deterministic rounds.
 * Findings involved in ties or ambiguous scores remain unassigned.
 *
 * @param {Array} eligiblePairs
 * @param {PairScoreTable} pairScores
 * @param {Array} staticFindings
 * @param {Array} aiFindings
 * @returns {Array<{ staticFinding: object, aiFinding: object, score: number }>}
 */
export function matchReciprocalUniqueBest(eligiblePairs, pairScores, staticFindings, aiFindings) {
  const committedPairs = [];
  const assignedStatic = new Set();
  const assignedAi = new Set();

  let progress = true;
  while (progress) {
    progress = false;
    const roundCandidates = [];

    // 1. Identify unique best AI candidate for each unassigned static finding
    for (const s of staticFindings) {
      if (assignedStatic.has(s)) continue;

      let bestAi = null;
      let maxScore = -1;
      let isTied = false;

      for (const a of aiFindings) {
        if (assignedAi.has(a)) continue;
        const score = pairScores.get(s, a);
        if (score <= 0) continue;

        if (score > maxScore) {
          maxScore = score;
          bestAi = a;
          isTied = false;
        } else if (score === maxScore) {
          isTied = true;
        }
      }

      if (bestAi && !isTied) {
        roundCandidates.push({ s, a: bestAi, score: maxScore });
      }
    }

    // 2. Filter for reciprocal unique best: static finding must also be AI finding's unique best
    for (const { s, a, score } of roundCandidates) {
      if (assignedStatic.has(s) || assignedAi.has(a)) continue;

      let aiBestStatic = null;
      let aiMaxScore = -1;
      let aiIsTied = false;

      for (const otherS of staticFindings) {
        if (assignedStatic.has(otherS)) continue;
        const otherScore = pairScores.get(otherS, a);
        if (otherScore <= 0) continue;

        if (otherScore > aiMaxScore) {
          aiMaxScore = otherScore;
          aiBestStatic = otherS;
          aiIsTied = false;
        } else if (otherScore === aiMaxScore) {
          aiIsTied = true;
        }
      }

      if (aiBestStatic === s && !aiIsTied) {
        committedPairs.push({ staticFinding: s, aiFinding: a, score });
        assignedStatic.add(s);
        assignedAi.add(a);
        progress = true;
      }
    }
  }

  return committedPairs;
}

// =============================================================================
// 5. RELATIONAL PARENT INTEGRITY & CONTENT VALIDATION
// =============================================================================

/**
 * Asserts relational parent integrity on projected ReviewIssue objects.
 * Throws ApiError(500) if ANY parent ID is missing, null, malformed,
 * wrong-type, or mismatched against expected parents.
 * Guarantees zero partial persistence.
 *
 * @param {Array<object>} projectedIssues
 * @param {{ reviewId: *, analysisResultId: *, userId: * }} expectedParents
 */
export function assertRelationalParentIntegrity(projectedIssues, expectedParents) {
  if (!expectedParents || typeof expectedParents !== 'object') {
    throw new ApiError(500, 'Persistence aborted: expected parent references are missing or invalid');
  }

  const { reviewId: expReviewId, analysisResultId: expAnalysisId, userId: expUserId } = expectedParents;

  function validateParentId(val, expVal, name) {
    if (val === undefined || val === null) {
      throw new ApiError(500, `Relational parent integrity violation: missing or null ${name}`);
    }
    const isInstance = val instanceof mongoose.Types.ObjectId;
    const is24Hex = typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);
    if (!isInstance && !is24Hex) {
      throw new ApiError(500, `Relational parent integrity violation: wrong-type or malformed ${name}`);
    }
    if (!mongoose.Types.ObjectId.isValid(val)) {
      throw new ApiError(500, `Relational parent integrity violation: invalid ObjectId ${name}`);
    }
    if (expVal && val.toString() !== expVal.toString()) {
      throw new ApiError(500, `Relational parent integrity violation: mismatched ${name}`);
    }
  }

  // Validate expected parent references themselves first
  validateParentId(expReviewId, null, 'expected reviewId');
  validateParentId(expAnalysisId, null, 'expected analysisResultId');
  validateParentId(expUserId, null, 'expected userId');

  // Validate every projected issue
  for (const issue of projectedIssues) {
    validateParentId(issue.reviewId, expReviewId, 'reviewId');
    validateParentId(issue.analysisResultId, expAnalysisId, 'analysisResultId');
    validateParentId(issue.userId, expUserId, 'userId');
  }
}

/**
 * Validates the 13 content fields of an individual ReviewIssue document.
 * Returns { isValid: boolean, sanitizedIssue: object|null }
 * If invalid, increments dropCounters. Diagnostic counters may increment
 * multiple sub-reasons, but dropCounters.total (D) increments exactly once.
 *
 * @param {object} issue
 * @param {string[]} [lines=[]] - Canonical source lines for boundary checks
 * @param {object} [dropCounters=null]
 * @returns {{ isValid: boolean, sanitizedIssue: object|null }}
 */
export function validateCandidateContent(issue, lines = [], dropCounters = null) {
  if (!issue || typeof issue !== 'object') {
    if (dropCounters) { dropCounters.type++; dropCounters.total++; }
    return { isValid: false, sanitizedIssue: null };
  }

  let hasError = false;

  // 1. Category Enum
  if (typeof issue.category !== 'string' || !ALLOWED_CATEGORIES.has(issue.category)) {
    if (dropCounters) dropCounters.enums++;
    hasError = true;
  }

  // 2. Severity Enum
  if (typeof issue.severity !== 'string' || !ALLOWED_SEVERITIES.has(issue.severity)) {
    if (dropCounters) dropCounters.enums++;
    hasError = true;
  }

  // 3. Source Enum
  if (typeof issue.source !== 'string' || !ALLOWED_SOURCES.has(issue.source)) {
    if (dropCounters) dropCounters.enums++;
    hasError = true;
  }

  // 4. Title (Whitespace-only rejected; safe prose clamp to 147 + '...')
  let title = issue.title;
  if (typeof title !== 'string' || title.trim().length === 0) {
    if (dropCounters) dropCounters.type++;
    hasError = true;
  } else {
    title = title.trim();
    if (title.length > 150) {
      title = title.slice(0, 147) + '...';
    }
  }

  // 5. Description (Whitespace-only rejected; safe prose clamp to 997 + '...')
  let description = issue.description;
  if (typeof description !== 'string' || description.trim().length === 0) {
    if (dropCounters) dropCounters.type++;
    hasError = true;
  } else {
    description = description.trim();
    if (description.length > 1000) {
      description = description.slice(0, 997) + '...';
    }
  }

  // 6. Coordinates (Finite positive integers)
  const lineStart = issue.lineStart;
  const lineEnd = issue.lineEnd;
  const columnStart = issue.columnStart !== undefined && issue.columnStart !== null ? issue.columnStart : 1;
  const columnEnd = issue.columnEnd !== undefined && issue.columnEnd !== null ? issue.columnEnd : 1;

  if (!Number.isInteger(lineStart) || !Number.isFinite(lineStart) || lineStart < 1) {
    if (dropCounters) dropCounters.coords++;
    hasError = true;
  }
  if (!Number.isInteger(lineEnd) || !Number.isFinite(lineEnd) || lineEnd < lineStart) {
    if (dropCounters) dropCounters.coords++;
    hasError = true;
  }
  if (!Number.isInteger(columnStart) || !Number.isFinite(columnStart) || columnStart < 1) {
    if (dropCounters) dropCounters.coords++;
    hasError = true;
  }
  if (!Number.isInteger(columnEnd) || !Number.isFinite(columnEnd) || columnEnd < 1) {
    if (dropCounters) dropCounters.coords++;
    hasError = true;
  }

  // Single-line coordinate rule: columnEnd MUST be strictly greater than columnStart
  if (lineStart === lineEnd && columnEnd <= columnStart) {
    if (dropCounters) dropCounters.coords++;
    hasError = true;
  }

  // Boundary checks against lines array if provided
  if (lines.length > 0 && !hasError) {
    if (lineStart > lines.length || lineEnd > lines.length) {
      if (dropCounters) dropCounters.coords++;
      hasError = true;
    } else {
      const startLineLen = (lines[lineStart - 1] || '').length;
      const endLineLen = (lines[lineEnd - 1] || '').length;
      if (columnStart > startLineLen + 1 || columnEnd > endLineLen + 1) {
        if (dropCounters) dropCounters.coords++;
        hasError = true;
      }
    }
  }

  // 7. Snippets (Zero silent code truncation; drop if > 2000)
  let originalSnippet = issue.originalSnippet !== undefined && issue.originalSnippet !== null ? String(issue.originalSnippet) : '';
  if (originalSnippet.length > 2000) {
    if (dropCounters) dropCounters.snippets++;
    hasError = true;
  }

  let suggestedSnippet = issue.suggestedSnippet !== undefined && issue.suggestedSnippet !== null ? String(issue.suggestedSnippet) : '';
  if (suggestedSnippet.length > 2000) {
    if (dropCounters) dropCounters.snippets++;
    hasError = true;
  }

  // 8. Explanation (Safe prose clamp to 1997 + '...')
  let explanation = issue.explanation !== undefined && issue.explanation !== null ? String(issue.explanation) : '';
  if (explanation.length > 2000) {
    explanation = explanation.slice(0, 1997) + '...';
  }

  // 9. RuleId (Zero truncation; drop if > 60)
  let ruleId = issue.ruleId !== undefined && issue.ruleId !== null ? String(issue.ruleId) : null;
  if (ruleId !== null && ruleId.length > 60) {
    if (dropCounters) dropCounters.ruleId++;
    hasError = true;
  }

  if (hasError) {
    if (dropCounters) dropCounters.total++; // Candidate contributes exactly ONCE to D
    return { isValid: false, sanitizedIssue: null };
  }

  const sanitizedIssue = {
    ...issue,
    category: issue.category,
    severity: issue.severity,
    source: issue.source,
    title,
    description,
    lineStart,
    lineEnd,
    columnStart,
    columnEnd,
    originalSnippet,
    suggestedSnippet,
    explanation,
    ruleId
  };

  return { isValid: true, sanitizedIssue };
}

// =============================================================================
// 6. TOTAL ORDER 17-FIELD COMPARATOR
// =============================================================================

export function buildCanonicalFindingFingerprint(f) {
  return JSON.stringify({
    lS: f.lineStart,
    cS: f.columnStart,
    lE: f.lineEnd,
    cE: f.columnEnd,
    c: f.category,
    s: f.severity,
    src: f.source,
    r: f.ruleId || null,
    t: f.title || '',
    d: f.description || '',
    os: f.originalSnippet || '',
    ss: f.suggestedSnippet || '',
    e: f.explanation || ''
  });
}

/**
 * Deterministic total comparator for ReviewIssue findings.
 * Satisfies antisymmetry, transitivity, and equality.
 */
export function compareFindingsTotal(a, b) {
  // 1. lineStart (asc)
  if (a.lineStart !== b.lineStart) return a.lineStart - b.lineStart;
  // 2. columnStart (asc)
  if (a.columnStart !== b.columnStart) return a.columnStart - b.columnStart;
  // 3. lineEnd (asc)
  if (a.lineEnd !== b.lineEnd) return a.lineEnd - b.lineEnd;
  // 4. columnEnd (asc)
  if (a.columnEnd !== b.columnEnd) return a.columnEnd - b.columnEnd;
  // 5. severity (CRITICAL > HIGH > MEDIUM > LOW > INFO)
  const sA = SEVERITY_RANK[a.severity] ?? 5;
  const sB = SEVERITY_RANK[b.severity] ?? 5;
  if (sA !== sB) return sA - sB;
  // 6. category (lexicographical)
  const catDiff = (a.category || '').localeCompare(b.category || '');
  if (catDiff !== 0) return catDiff;
  // 7. source priority ('hybrid' > 'static' > 'gemini')
  const srcA = SOURCE_RANK[a.source] ?? 3;
  const srcB = SOURCE_RANK[b.source] ?? 3;
  if (srcA !== srcB) return srcA - srcB;
  // 8. ruleId (nulls last)
  if (a.ruleId !== b.ruleId) {
    if (!a.ruleId) return 1;
    if (!b.ruleId) return -1;
    const rDiff = a.ruleId.localeCompare(b.ruleId);
    if (rDiff !== 0) return rDiff;
  }
  // 9. title (lexicographical)
  const tDiff = (a.title || '').localeCompare(b.title || '');
  if (tDiff !== 0) return tDiff;
  // 10. description (lexicographical)
  const dDiff = (a.description || '').localeCompare(b.description || '');
  if (dDiff !== 0) return dDiff;
  // 11. originalSnippet (lexicographical)
  const osDiff = (a.originalSnippet || '').localeCompare(b.originalSnippet || '');
  if (osDiff !== 0) return osDiff;
  // 12. suggestedSnippet (lexicographical)
  const ssDiff = (a.suggestedSnippet || '').localeCompare(b.suggestedSnippet || '');
  if (ssDiff !== 0) return ssDiff;
  // 13. explanation (lexicographical)
  const eDiff = (a.explanation || '').localeCompare(b.explanation || '');
  if (eDiff !== 0) return eDiff;
  // 14. cwe (nulls last)
  if (a.cwe !== b.cwe) {
    if (!a.cwe) return 1;
    if (!b.cwe) return -1;
    const cDiff = a.cwe.localeCompare(b.cwe);
    if (cDiff !== 0) return cDiff;
  }
  // 15. owaspCategory (nulls last)
  if (a.owaspCategory !== b.owaspCategory) {
    if (!a.owaspCategory) return 1;
    if (!b.owaspCategory) return -1;
    const oDiff = a.owaspCategory.localeCompare(b.owaspCategory);
    if (oDiff !== 0) return oDiff;
  }
  // 16. confidence (descending, nulls last)
  const confA = typeof a.confidence === 'number' ? a.confidence : -1;
  const confB = typeof b.confidence === 'number' ? b.confidence : -1;
  if (confA !== confB) return confB - confA;
  // 17. canonical JSON fingerprint tie-breaker
  return buildCanonicalFindingFingerprint(a).localeCompare(buildCanonicalFindingFingerprint(b));
}

// =============================================================================
// 7. CORE HYBRID FUSION COORDINATOR
// =============================================================================

/**
 * Main Hybrid Fusion Coordinator
 *
 * @param {object} params
 * @param {Array<object>} params.staticFindings - Deterministic static findings
 * @param {Array<object>} params.aiFindings - Raw AI findings from Gemini
 * @param {string} params.sourceCode - Raw canonical source code
 * @param {string} params.redactedCode - Source code after secret redaction
 * @param {object} [params.coordinateMapper] - CoordinateMapper instance
 * @param {string} [params.language='javascript'] - Code language
 * @returns {{ finalFindings: Array<object>, telemetry: object, dropCounters: object }}
 */
export function fuseFindings({
  staticFindings = [],
  aiFindings = [],
  sourceCode = '',
  redactedCode = '',
  coordinateMapper = null,
  language = 'javascript'
}) {
  const S_raw = Array.isArray(staticFindings) ? staticFindings : [];
  const A_raw = Array.isArray(aiFindings) ? aiFindings : [];

  const rawSource = typeof sourceCode === 'string' ? sourceCode : '';
  const redactedSource = (typeof redactedCode === 'string' && redactedCode.length > 0) ? redactedCode : rawSource;

  const rawLines = rawSource.split(/\r\n|\r|\n/);
  const redactedLines = redactedSource.split(/\r\n|\r|\n/);

  const rawLineStarts = computeLineStarts(rawSource);

  // Diagnostic Drop Counters
  const dropCounters = {
    total: 0,
    coord_pre: 0,
    coord_post: 0,
    snippets: 0,
    ruleId: 0,
    enums: 0,
    coords: 0,
    type: 0,
    relational: 0
  };

  // ---------------------------------------------------------------------------
  // STAGE 1: PARTITION NON-SECURITY FINDINGS (Multiset Bypass)
  // ---------------------------------------------------------------------------
  // Note: RISK-PY-002 maps to category 'bug' and therefore automatically bypasses
  const S_sec = [];
  const S_nonsec = [];
  for (const s of S_raw) {
    if (s.category === 'security') {
      S_sec.push(s);
    } else {
      S_nonsec.push(s);
    }
  }

  const A_sec_raw = [];
  const A_nonsec_raw = [];
  for (const a of A_raw) {
    if (a.category === 'security') {
      A_sec_raw.push(a);
    } else {
      A_nonsec_raw.push(a);
    }
  }

  // ---------------------------------------------------------------------------
  // STAGE 2: VALIDATE AND MAP AI FINDINGS (Pre-Redaction Validation)
  // ---------------------------------------------------------------------------
  function validateAndMapAiFinding(a) {
    const { lineStart, lineEnd, columnStart, columnEnd, originalSnippet } = a;

    // 1. Pre-mapping coordinate boundary validation against redactedLines
    if (
      !Number.isInteger(lineStart) || !Number.isInteger(lineEnd) ||
      !Number.isInteger(columnStart) || !Number.isInteger(columnEnd) ||
      lineStart < 1 || lineEnd < lineStart || lineStart > redactedLines.length || lineEnd > redactedLines.length ||
      columnStart < 1 || columnEnd < 1
    ) {
      dropCounters.coord_pre++;
      dropCounters.total++;
      return null;
    }

    if (lineStart === lineEnd && columnEnd <= columnStart) {
      dropCounters.coord_pre++;
      dropCounters.total++;
      return null;
    }

    const startLineLen = (redactedLines[lineStart - 1] || '').length;
    const endLineLen = (redactedLines[lineEnd - 1] || '').length;
    if (columnStart > startLineLen + 1 || columnEnd > endLineLen + 1) {
      dropCounters.coord_pre++;
      dropCounters.total++;
      return null;
    }

    const isSecurity = a.category === 'security';

    // 2. Verbatim slice extraction from redactedCode
    let effColEnd = columnEnd;
    let extractedSlice = extractSourceSlice(redactedLines, lineStart, columnStart, lineEnd, effColEnd);
    if (normalizeNewlines(extractedSlice) !== normalizeNewlines(originalSnippet || '')) {
      // Check if AI provided 1-based inclusive columnEnd (where length is columnEnd - columnStart + 1)
      if (columnEnd + 1 <= endLineLen + 1) {
        const inclusiveSlice = extractSourceSlice(redactedLines, lineStart, columnStart, lineEnd, columnEnd + 1);
        if (normalizeNewlines(inclusiveSlice) === normalizeNewlines(originalSnippet || '')) {
          effColEnd = columnEnd + 1;
          extractedSlice = inclusiveSlice;
        }
      }
    }

    if (isSecurity && normalizeNewlines(extractedSlice) !== normalizeNewlines(originalSnippet || '')) {
      dropCounters.coord_pre++;
      dropCounters.total++;
      return null;
    }

    // 3. 2,000-character boundary invariant
    if (extractedSlice.length > 2000) {
      dropCounters.snippets++;
      dropCounters.total++;
      return null;
    }

    // 4. Map coordinates to original source exactly once
    let origLineStart = lineStart;
    let origColStart = columnStart;
    let origLineEnd = lineEnd;
    let origColEnd = effColEnd;

    if (coordinateMapper && typeof coordinateMapper.mapToOriginal === 'function') {
      const start = coordinateMapper.mapToOriginal(lineStart, columnStart);
      const end = coordinateMapper.mapToOriginal(lineEnd, effColEnd);
      origLineStart = start.line;
      origColStart = start.column;
      origLineEnd = end.line;
      origColEnd = end.column;
    }

    // 5. Post-mapping validation against rawLines
    if (
      origLineStart < 1 || origLineEnd < origLineStart || origLineStart > rawLines.length || origLineEnd > rawLines.length ||
      origColStart < 1 || origColEnd < 1
    ) {
      dropCounters.coord_post++;
      dropCounters.total++;
      return null;
    }

    if (origLineStart === origLineEnd && origColEnd <= origColStart) {
      dropCounters.coord_post++;
      dropCounters.total++;
      return null;
    }

    return {
      ...a,
      lineStart: origLineStart,
      columnStart: origColStart,
      lineEnd: origLineEnd,
      columnEnd: origColEnd,
      originalSnippet: a.originalSnippet || '', // Retains pre-redacted asterisks
      ruleId: null,
      source: 'gemini'
    };
  }

  const A_sec_valid = [];
  for (const a of A_sec_raw) {
    const mapped = validateAndMapAiFinding(a);
    if (mapped) A_sec_valid.push(mapped);
  }

  const A_nonsec_valid = [];
  for (const a of A_nonsec_raw) {
    const mapped = validateAndMapAiFinding(a);
    if (mapped) A_nonsec_valid.push(mapped);
  }

  // ---------------------------------------------------------------------------
  // STAGE 3: SCAN CANONICAL SOURCE FOR HAZARDOUS SINK OCCURRENCES
  // ---------------------------------------------------------------------------
  const sinkOccurrences = scanGlobalSourceBuffer(rawSource, language);

  function mapFindingToOccurrence(f) {
    const startOff = coordinateToGlobalOffset(f.lineStart, f.columnStart, rawLineStarts);
    const endOff = coordinateToGlobalOffset(f.lineEnd, f.columnEnd, rawLineStarts);

    let matchedOcc = null;
    let matchCount = 0;

    for (const occ of sinkOccurrences) {
      const [tokStart, tokEnd] = occ.opTokenGlobalSpan;
      if (Math.max(startOff, tokStart) < Math.min(endOff, tokEnd)) {
        matchedOcc = occ;
        matchCount++;
      }
    }

    // Must uniquely overlap exactly one occurrence
    return matchCount === 1 ? matchedOcc : null;
  }

  // ---------------------------------------------------------------------------
  // STAGE 4: CANDIDATE PAIR GENERATION & TIER 1 RECIPROCAL MATCHING
  // ---------------------------------------------------------------------------
  const pairScores = new PairScoreTable();
  const eligiblePairs = [];

  for (const s of S_sec) {
    const sOcc = mapFindingToOccurrence(s);
    if (!sOcc || sOcc.hasComplexReceiver) continue;

    for (const a of A_sec_valid) {
      const aOcc = mapFindingToOccurrence(a);
      if (!aOcc || aOcc !== sOcc) continue;

      // 8 Verifiable Conditions Check
      if (sOcc.opName.toLowerCase() !== aOcc.opName.toLowerCase()) continue;
      if (sOcc.receiver !== aOcc.receiver) continue;

      // Primary argument slice match
      const sArg = trimHorizontal(normalizeNewlines(sOcc.primaryArgSlice));
      const aArg = trimHorizontal(normalizeNewlines(aOcc.primaryArgSlice));
      if (sArg !== aArg) continue;

      // Must appear in AI snippet
      if (a.originalSnippet && !a.originalSnippet.includes(sOcc.opName)) continue;

      const score = calculateTier1MatchScore(s, a, sOcc);
      if (score > 0) {
        pairScores.set(s, a, score);
        eligiblePairs.push({ s, a, score });
      }
    }
  }

  const committedPairs = matchReciprocalUniqueBest(eligiblePairs, pairScores, S_sec, A_sec_valid);
  const K = committedPairs.length;

  const matchedStaticSet = new Set(committedPairs.map((p) => p.staticFinding));
  const matchedAiSet = new Set(committedPairs.map((p) => p.aiFinding));

  // Synthesize Hybrid findings
  const hybridFindings = committedPairs.map(({ staticFinding, aiFinding }) => {
    return {
      category: 'security',
      severity: staticFinding.severity || aiFinding.severity,
      title: aiFinding.title || staticFinding.title,
      description: aiFinding.description || staticFinding.description,
      lineStart: staticFinding.lineStart,
      columnStart: staticFinding.columnStart,
      lineEnd: staticFinding.lineEnd,
      columnEnd: staticFinding.columnEnd,
      originalSnippet: aiFinding.originalSnippet, // Retains pre-redacted asterisks
      suggestedSnippet: aiFinding.suggestedSnippet || staticFinding.suggestedSnippet || '',
      explanation: aiFinding.explanation || staticFinding.explanation || '',
      ruleId: staticFinding.ruleId,
      source: 'hybrid',
      // Metadata heritage preserved strictly from static rule definition
      cwe: staticFinding.cwe || null,
      owaspCategory: staticFinding.owaspCategory || null,
      confidence: staticFinding.confidence || null
    };
  });

  // Collect un-fused security findings
  const unfusedStatic = S_sec.filter((s) => !matchedStaticSet.has(s)).map((s) => ({ ...s, source: 'static' }));
  const unfusedAi = A_sec_valid.filter((a) => !matchedAiSet.has(a)).map((a) => ({ ...a, source: 'gemini' }));

  // ---------------------------------------------------------------------------
  // STAGE 5: CONTENT VALIDATION & TELEMETRY ACCOUNTING
  // ---------------------------------------------------------------------------
  // Combine all candidate streams:
  // Hybrid candidates + un-fused static + un-fused AI + non-sec static + non-sec AI
  const intermediateCandidates = [
    ...hybridFindings,
    ...unfusedStatic,
    ...unfusedAi,
    ...S_nonsec.map((s) => ({ ...s, source: 'static' })),
    ...A_nonsec_valid.map((a) => ({ ...a, source: 'gemini' }))
  ];

  const validatedFindings = [];
  for (const cand of intermediateCandidates) {
    const { isValid, sanitizedIssue } = validateCandidateContent(cand, rawLines, dropCounters);
    if (isValid && sanitizedIssue) {
      validatedFindings.push(sanitizedIssue);
    }
  }

  // Sort deterministically with 17-field comparator
  validatedFindings.sort(compareFindingsTotal);

  const finalFindingsCount = validatedFindings.length;
  const D = dropCounters.total;
  const S_count = S_raw.length;
  const A_count = A_raw.length;

  const telemetry = {
    inputStaticCount: S_count,
    inputAiCount: A_count,
    fusedCount: K,
    droppedCount: D,
    finalFindingsCount,
    isConserved: finalFindingsCount === S_count + A_count - K - D
  };

  if (!telemetry.isConserved) {
    logger.warn('Telemetry finding conservation mismatch', {
      expected: S_count + A_count - K - D,
      actual: finalFindingsCount,
      telemetry
    });
  }

  return {
    finalFindings: validatedFindings,
    telemetry,
    dropCounters
  };
}
