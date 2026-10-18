/**
 * Coordinate and Line Mapping Utilities
 * Converts raw character indices into 1-indexed line and column coordinates,
 * and extracts corresponding code snippets for findings.
 */

export class LineMapper {
  /**
   * @param {string} source - Source code string
   */
  constructor(source = '') {
    this.source = source;
    this.lines = source.split(/\r?\n/);
    this.lineOffsets = [];

    // Precalculate character start offset for each line
    let offset = 0;
    const len = source.length;
    let i = 0;
    this.lineOffsets.push(0);

    while (i < len) {
      if (source[i] === '\r' && i + 1 < len && source[i + 1] === '\n') {
        offset = i + 2;
        this.lineOffsets.push(offset);
        i += 2;
      } else if (source[i] === '\n' || source[i] === '\r') {
        offset = i + 1;
        this.lineOffsets.push(offset);
        i++;
      } else {
        i++;
      }
    }
  }

  /**
   * Find 1-based line number for a character index using binary search.
   * @param {number} index
   * @returns {number} 1-based line number
   */
  getLineNumber(index) {
    if (index < 0) return 1;
    let low = 0;
    let high = this.lineOffsets.length - 1;
    let result = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.lineOffsets[mid] <= index) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result + 1; // 1-based
  }

  /**
   * Map character span [startIndex, endIndex] to coordinates and snippet.
   * @param {number} startIndex
   * @param {number} endIndex
   * @returns {{ lineStart: number, lineEnd: number, columnStart: number, columnEnd: number, originalSnippet: string }}
   */
  mapCoordinates(startIndex, endIndex) {
    const safeStart = Math.max(0, Math.min(startIndex, this.source.length));
    const safeEnd = Math.max(safeStart, Math.min(endIndex, this.source.length));

    const lineStart = this.getLineNumber(safeStart);
    const lineEnd = this.getLineNumber(safeEnd);

    const startLineOffset = this.lineOffsets[lineStart - 1] || 0;
    const endLineOffset = this.lineOffsets[lineEnd - 1] || 0;

    const columnStart = safeStart - startLineOffset + 1;
    const columnEnd = safeEnd - endLineOffset + 1;

    // Extract snippet representing the matched range
    let originalSnippet = '';
    if (lineStart === lineEnd) {
      originalSnippet = (this.lines[lineStart - 1] || '').trim();
    } else {
      const snippetLines = this.lines.slice(lineStart - 1, Math.min(lineEnd, lineStart + 4));
      originalSnippet = snippetLines.map((l) => l.trimEnd()).join('\n');
    }

    // Fallback if snippet is empty
    if (!originalSnippet) {
      originalSnippet = this.source.substring(safeStart, safeEnd).trim();
    }

    // Limit snippet to a reasonable length for safety
    if (originalSnippet.length > 300) {
      originalSnippet = originalSnippet.substring(0, 297) + '...';
    }

    return {
      lineStart,
      lineEnd,
      columnStart,
      columnEnd,
      originalSnippet
    };
  }
}

export default LineMapper;
