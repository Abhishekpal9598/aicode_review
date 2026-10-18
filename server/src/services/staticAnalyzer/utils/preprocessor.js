/**
 * Deterministic Lexical Preprocessor (Finite State Machine)
 *
 * Implements a character-by-character scanner that masks comments with whitespace
 * while preserving 1:1 line numbers, character column offsets, and string literal boundaries.
 *
 * Special language boundary rules:
 * - In Python, triple-quoted blocks ("""...""" and '''...''') are string literals/docstrings,
 *   NOT ordinary comments. They are preserved intact so docstrings and string contents are never masked.
 * - Single and double quoted string literals (and backtick template literals in JS/TS)
 *   are preserved so comment markers inside quotes (e.g. "https://...", '# not a comment') are not masked.
 * - Escaped quotes (\", \', \`, \\) are safely tracked to prevent premature string boundary exits.
 */

export const PreprocessorState = {
  CODE: 'CODE',
  LINE_COMMENT: 'LINE_COMMENT',
  BLOCK_COMMENT: 'BLOCK_COMMENT',
  STRING_SINGLE: 'STRING_SINGLE',
  STRING_DOUBLE: 'STRING_DOUBLE',
  STRING_BACKTICK: 'STRING_BACKTICK',
  PYTHON_TRIPLE_DOUBLE: 'PYTHON_TRIPLE_DOUBLE',
  PYTHON_TRIPLE_SINGLE: 'PYTHON_TRIPLE_SINGLE'
};

/**
 * Preprocesses raw source code into comment-masked code.
 *
 * @param {string} source - Raw source code string
 * @param {string} language - Language identifier ('python', 'javascript', 'typescript', 'java', 'c', 'cpp')
 * @returns {string} - Comment-masked code with identical length and newline positions
 */
export function preprocessCode(source, language) {
  if (!source || typeof source !== 'string') {
    return '';
  }

  const lang = (language || '').toLowerCase();
  const isPython = lang === 'python';
  const isJsOrTs = lang === 'javascript' || lang === 'typescript';

  const len = source.length;
  const out = new Array(len);

  let state = PreprocessorState.CODE;
  let i = 0;

  while (i < len) {
    const ch = source[i];
    const nextCh = i + 1 < len ? source[i + 1] : '';

    switch (state) {
      case PreprocessorState.CODE: {
        // 1. Python comments and triple-quoted strings
        if (isPython) {
          // Check for triple double-quotes """
          if (ch === '"' && nextCh === '"' && i + 2 < len && source[i + 2] === '"') {
            state = PreprocessorState.PYTHON_TRIPLE_DOUBLE;
            out[i] = ch;
            out[i + 1] = source[i + 1];
            out[i + 2] = source[i + 2];
            i += 3;
            continue;
          }
          // Check for triple single-quotes '''
          if (ch === "'" && nextCh === "'" && i + 2 < len && source[i + 2] === "'") {
            state = PreprocessorState.PYTHON_TRIPLE_SINGLE;
            out[i] = ch;
            out[i + 1] = source[i + 1];
            out[i + 2] = source[i + 2];
            i += 3;
            continue;
          }
          // Check for Python line comment #
          if (ch === '#') {
            state = PreprocessorState.LINE_COMMENT;
            out[i] = ' ';
            i++;
            continue;
          }
        } else {
          // 2. C / C++ / Java / JS / TS comments
          // Line comment //
          if (ch === '/' && nextCh === '/') {
            state = PreprocessorState.LINE_COMMENT;
            out[i] = ' ';
            out[i + 1] = ' ';
            i += 2;
            continue;
          }
          // Block comment /*
          if (ch === '/' && nextCh === '*') {
            state = PreprocessorState.BLOCK_COMMENT;
            out[i] = ' ';
            out[i + 1] = ' ';
            i += 2;
            continue;
          }
        }

        // 3. String literal boundaries
        if (ch === "'") {
          state = PreprocessorState.STRING_SINGLE;
          out[i] = ch;
          i++;
          continue;
        }

        if (ch === '"') {
          state = PreprocessorState.STRING_DOUBLE;
          out[i] = ch;
          i++;
          continue;
        }

        if (isJsOrTs && ch === '`') {
          state = PreprocessorState.STRING_BACKTICK;
          out[i] = ch;
          i++;
          continue;
        }

        // Default code character
        out[i] = ch;
        i++;
        break;
      }

      case PreprocessorState.LINE_COMMENT: {
        // Line comment ends at newline
        if (ch === '\n' || ch === '\r') {
          state = PreprocessorState.CODE;
          out[i] = ch; // preserve exact newline
        } else {
          out[i] = ' '; // mask comment character
        }
        i++;
        break;
      }

      case PreprocessorState.BLOCK_COMMENT: {
        // Block comment ends at */
        if (ch === '*' && nextCh === '/') {
          state = PreprocessorState.CODE;
          out[i] = ' ';
          out[i + 1] = ' ';
          i += 2;
          continue;
        }
        // Preserve newlines, mask everything else
        if (ch === '\n' || ch === '\r') {
          out[i] = ch;
        } else {
          out[i] = ' ';
        }
        i++;
        break;
      }

      case PreprocessorState.STRING_SINGLE: {
        out[i] = ch;
        // Escape sequence \' or \\
        if (ch === '\\' && i + 1 < len) {
          out[i + 1] = source[i + 1];
          i += 2;
          continue;
        }
        if (ch === "'") {
          state = PreprocessorState.CODE;
        } else if (ch === '\n' && !isPython) {
          // Unclosed single-line string on newline
          state = PreprocessorState.CODE;
        }
        i++;
        break;
      }

      case PreprocessorState.STRING_DOUBLE: {
        out[i] = ch;
        // Escape sequence \" or \\
        if (ch === '\\' && i + 1 < len) {
          out[i + 1] = source[i + 1];
          i += 2;
          continue;
        }
        if (ch === '"') {
          state = PreprocessorState.CODE;
        } else if (ch === '\n' && !isPython) {
          // Unclosed single-line string on newline
          state = PreprocessorState.CODE;
        }
        i++;
        break;
      }

      case PreprocessorState.STRING_BACKTICK: {
        out[i] = ch;
        // Escape sequence \` or \\
        if (ch === '\\' && i + 1 < len) {
          out[i + 1] = source[i + 1];
          i += 2;
          continue;
        }
        if (ch === '`') {
          state = PreprocessorState.CODE;
        }
        i++;
        break;
      }

      case PreprocessorState.PYTHON_TRIPLE_DOUBLE: {
        out[i] = ch;
        // Escape sequence in docstrings
        if (ch === '\\' && i + 1 < len) {
          out[i + 1] = source[i + 1];
          i += 2;
          continue;
        }
        // Check for closing """
        if (ch === '"' && nextCh === '"' && i + 2 < len && source[i + 2] === '"') {
          out[i + 1] = source[i + 1];
          out[i + 2] = source[i + 2];
          state = PreprocessorState.CODE;
          i += 3;
          continue;
        }
        i++;
        break;
      }

      case PreprocessorState.PYTHON_TRIPLE_SINGLE: {
        out[i] = ch;
        // Escape sequence in docstrings
        if (ch === '\\' && i + 1 < len) {
          out[i + 1] = source[i + 1];
          i += 2;
          continue;
        }
        // Check for closing '''
        if (ch === "'" && nextCh === "'" && i + 2 < len && source[i + 2] === "'") {
          out[i + 1] = source[i + 1];
          out[i + 2] = source[i + 2];
          state = PreprocessorState.CODE;
          i += 3;
          continue;
        }
        i++;
        break;
      }

      default:
        out[i] = ch;
        i++;
        break;
    }
  }

  return out.join('');
}

export default preprocessCode;
