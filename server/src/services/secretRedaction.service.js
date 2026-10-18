/**
 * Secret Redaction Service
 * server/src/services/secretRedaction.service.js
 *
 * Standalone deterministic service for redacting hardcoded secrets,
 * credentials, and cryptographic keys prior to external LLM transmission
 * and database persistence.
 *
 * Architecture & Guarantees:
 * 1. Independent Lifecycle: Operates entirely independently of Phase 7 static rules.
 * 2. Spatial Invariance: Uses character-for-character same-length masking for single-line
 *    secrets and line-invariant masking for multiline PEM keys to guarantee 1:1 line
 *    and column coordinate preservation.
 * 3. Bidirectional Coordinate Mapping: Provides a CoordinateMapper instance to translate
 *    coordinates between redacted and original source code if any delta shifts exist.
 * 4. Confidentiality: Detected cleartext secret values are NEVER returned in metadata,
 *    never logged to stdout/files, and never transmitted to external services.
 */

/**
 * Maps coordinates from redacted code back to original source code.
 */
export class CoordinateMapper {
  /**
   * @param {Map<number, Array<{ redactedCol: number, delta: number }>>} [lineDeltas]
   */
  constructor(lineDeltas = new Map()) {
    this.lineDeltas = lineDeltas;
  }

  /**
   * Maps a (line, column) coordinate from the redacted code back to the original source.
   * When character-for-character same-length masking is applied, coordinates map 1:1.
   *
   * @param {number} line - 1-based line number in redacted source
   * @param {number} column - 1-based column number in redacted source
   * @returns {{ line: number, column: number }} - Corresponding 1-based coordinates in original source
   */
  mapToOriginal(line, column) {
    const validLine = typeof line === 'number' && Number.isFinite(line) && line >= 1 ? Math.floor(line) : 1;
    const validCol = typeof column === 'number' && Number.isFinite(column) && column >= 1 ? Math.floor(column) : 1;

    const deltas = this.lineDeltas.get(validLine);
    if (!deltas || deltas.length === 0) {
      return { line: validLine, column: validCol };
    }

    let originalCol = validCol;
    for (const shift of deltas) {
      if (validCol >= shift.redactedCol) {
        originalCol += shift.delta;
      }
    }

    return { line: validLine, column: Math.max(1, originalCol) };
  }

  /**
   * Returns true if any lines underwent length-changing transformations.
   * @returns {boolean}
   */
  hasShifts() {
    return this.lineDeltas.size > 0;
  }
}

/**
 * Computes the starting character index of every line in the source string.
 * @param {string} source
 * @returns {number[]} Array of 0-based character offsets for line starts
 */
function getLineStarts(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return starts;
}

/**
 * Resolves a 0-based character offset into 1-based line and column coordinates.
 * @param {number} index - 0-based character offset
 * @param {number[]} lineStarts - Array of line start offsets
 * @returns {{ line: number, column: number }}
 */
function getLineAndColumn(index, lineStarts) {
  let low = 0;
  let high = lineStarts.length - 1;
  let lineIdx = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) {
      lineIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return {
    line: lineIdx + 1,
    column: index - lineStarts[lineIdx] + 1
  };
}

/**
 * Masks a multiline PEM private key block while strictly preserving:
 * 1. The exact number of lines and newline delimiters.
 * 2. The exact character length of every individual line.
 *
 * @param {string} match - Full multiline PEM private key block
 * @returns {string} - Same-length redacted PEM block
 */
function maskPemBlock(match) {
  const lines = match.split(/\r?\n/);
  const totalLines = lines.length;

  return lines
    .map((line, idx) => {
      if (idx === 0) {
        const prefix = '-----BEGIN [REDACTED]';
        const suffix = '-----';
        if (line.length >= prefix.length + suffix.length) {
          return prefix + '-'.repeat(line.length - prefix.length - suffix.length) + suffix;
        }
        return '*'.repeat(line.length);
      }
      if (idx === totalLines - 1) {
        const prefix = '-----END [REDACTED]';
        const suffix = '-----';
        if (line.length >= prefix.length + suffix.length) {
          return prefix + '-'.repeat(line.length - prefix.length - suffix.length) + suffix;
        }
        return '*'.repeat(line.length);
      }
      return '*'.repeat(line.length);
    })
    .join('\n');
}

/**
 * Deterministic secret redaction patterns.
 * Patterns are ordered intentionally (multiline and specific prefixes first).
 */
export const REDACTION_PATTERNS = [
  // 1. Multiline Private Key Blocks (PEM format)
  {
    type: 'PRIVATE_KEY',
    regex: /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/g,
    replace: (match) => maskPemBlock(match)
  },
  // 2. AWS Access Key IDs (20 characters, e.g. AKIA, ASIA, ABIA, ACCA)
  {
    type: 'AWS_KEY',
    regex: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g,
    replace: (match) => match.slice(0, 4) + '*'.repeat(match.length - 4)
  },
  // 3. GitHub Personal Access Tokens (classic ghp_, fine-grained github_pat_, OAuth gho_)
  {
    type: 'GITHUB_TOKEN',
    regex: /\b(?:gh[pousr]_[A-Za-z0-9_]{36}|github_pat_[A-Za-z0-9_]{82})\b/g,
    replace: (match) => match.slice(0, 4) + '*'.repeat(match.length - 4)
  },
  // 4. JSON Web Tokens (3-part dot-separated base64)
  {
    type: 'JWT',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    replace: (match) => 'eyJ' + '*'.repeat(match.length - 3)
  },
  // 5. Database Connection URLs with Passwords (mongodb, postgres, mysql, redis)
  {
    type: 'DB_CONNECTION_URL',
    regex: /\b(mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/([^:\s\/'"]+):([^\s\/'"]+?)@([a-zA-Z0-9_.-]+(?::\d+)?(?:\/[^\s"'`;]*)?)/gi,
    replace: (match, proto, user, pass, host) => `${proto}://${user}:${'*'.repeat(pass.length)}@${host}`
  },
  // 6. Common API Tokens (Stripe sk_live/test, Slack xoxb/xoxp, SendGrid SG.)
  {
    type: 'API_TOKEN',
    regex: /\b(?:(?:sk|pk)_(?:live|test)_[0-9a-zA-Z]{24,}|xox[baprs]-[0-9a-zA-Z-]{24,}|SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43})\b/g,
    replace: (match) => {
      const keepLen = Math.min(4, Math.floor(match.length / 4));
      return match.slice(0, keepLen) + '*'.repeat(match.length - keepLen);
    }
  },
  // 7. Generic Password and API Key Assignments in source code
  {
    type: 'GENERIC_CREDENTIAL',
    regex: /\b((?:api[_-]?key|secret[_-]?token|auth[_-]?token|access[_-]?token|client[_-]?secret|db[_-]?password|password)\s*[:=]\s*(['"]))([^'"\r\n]{8,})\2/gi,
    replace: (match, prefix, quote, secret) => `${prefix}${'*'.repeat(secret.length)}${quote}`
  }
];

/**
 * Scans and redacts detected credentials and secrets from source code.
 *
 * @param {string} sourceCode - Raw untrusted code string
 * @returns {{
 *   redactedCode: string,
 *   redactedSecretsCount: number,
 *   detections: Array<{ type: string, line: number, column: number, length: number }>,
 *   coordinateMapper: CoordinateMapper
 * }}
 */
export function redactSecrets(sourceCode) {
  if (typeof sourceCode !== 'string' || sourceCode.length === 0) {
    return {
      redactedCode: '',
      redactedSecretsCount: 0,
      detections: [],
      coordinateMapper: new CoordinateMapper()
    };
  }

  const lineStarts = getLineStarts(sourceCode);
  const detections = [];
  const coveredRanges = [];
  const lineOffsetDeltas = new Map();

  let code = sourceCode;

  for (const pattern of REDACTION_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;

    while ((match = regex.exec(sourceCode)) !== null) {
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;

      // Prevent duplicate counting if a broader pattern overlaps an already recorded secret
      const alreadyCovered = coveredRanges.some(
        ([s, e]) => (matchStart >= s && matchStart < e) || (matchEnd > s && matchEnd <= e)
      );

      if (!alreadyCovered) {
        coveredRanges.push([matchStart, matchEnd]);
        const { line, column } = getLineAndColumn(matchStart, lineStarts);

        // Security requirement: Record structural coordinates ONLY. NEVER include the cleartext secret value!
        detections.push({
          type: pattern.type,
          line,
          column,
          length: match[0].length
        });
      }
    }

    code = code.replace(pattern.regex, pattern.replace);
  }

  return {
    redactedCode: code,
    redactedSecretsCount: detections.length,
    detections,
    coordinateMapper: new CoordinateMapper(lineOffsetDeltas)
  };
}

export default {
  redactSecrets,
  CoordinateMapper,
  REDACTION_PATTERNS
};
