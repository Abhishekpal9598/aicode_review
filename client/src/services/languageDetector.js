/**
 * Smart Programming Language Detection Service
 * client/src/services/languageDetector.js
 *
 * Deterministic detection for:
 * - Python (.py)
 * - JavaScript (.js, .jsx, .mjs, .cjs)
 * - TypeScript (.ts, .tsx, .mts, .cts)
 * - Java (.java)
 * - C (.c, .h)
 * - C++ (.cpp, .cc, .cxx, .hpp, .hh, .hxx)
 *
 * Capabilities:
 * 1. File extension mapping (fast path)
 * 2. Lexical & syntax pattern heuristic scoring for pasted/raw code
 * 3. Disambiguation between C and C++
 * 4. Disambiguation between JavaScript and TypeScript
 * 5. Confidence rating: 'HIGH', 'MEDIUM', 'UNCERTAIN'
 * 6. Explanations / matched tokens for transparent reasoning
 */

export const SUPPORTED_LANGUAGE_IDS = [
  'python',
  'javascript',
  'typescript',
  'java',
  'c',
  'cpp'
];

export const CONFIDENCE_LEVELS = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  UNCERTAIN: 'UNCERTAIN'
};

/**
 * File extension mapping table
 */
export const EXTENSION_MAP = {
  // Python
  '.py': 'python',
  '.pyw': 'python',
  // JavaScript
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  // TypeScript
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  // Java
  '.java': 'java',
  // C
  '.c': 'c',
  '.h': 'c', // Ambiguous header: defaults to C, refined by content inspection if provided
  // C++
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',
  '.hxx': 'cpp'
};

/**
 * Detect language from file extension.
 * If file is a .h header and code content is supplied, checks for C++ markers.
 *
 * @param {string} fileName - File name or path
 * @param {string} [code=''] - Optional content to refine ambiguous extensions like .h
 * @returns {{ language: string|null, confidence: string, extension: string|null }}
 */
export function detectLanguageFromExtension(fileName, code = '') {
  if (!fileName || typeof fileName !== 'string') {
    return { language: null, confidence: CONFIDENCE_LEVELS.UNCERTAIN, extension: null };
  }

  const cleanName = fileName.trim().toLowerCase();
  const lastDot = cleanName.lastIndexOf('.');
  if (lastDot === -1 || lastDot === cleanName.length - 1) {
    return { language: null, confidence: CONFIDENCE_LEVELS.UNCERTAIN, extension: null };
  }

  const ext = cleanName.slice(lastDot);
  const matchedLang = EXTENSION_MAP[ext];

  if (!matchedLang) {
    return { language: null, confidence: CONFIDENCE_LEVELS.UNCERTAIN, extension: ext };
  }

  // Refine ambiguous .h file with C++ content check if code is available
  if (ext === '.h' && typeof code === 'string' && code.trim().length > 0) {
    const hasCppMarkers =
      /#include\s*<(?:iostream|vector|string|map|memory|algorithm|utility)>/.test(code) ||
      /\bstd::/.test(code) ||
      /\bclass\s+\w+\s*\{[\s\S]*?(?:public|private|protected)\s*:/.test(code) ||
      /\btemplate\s*<\s*(?:typename|class)\b/.test(code) ||
      /\bnamespace\s+\w+\s*\{/.test(code);

    if (hasCppMarkers) {
      return { language: 'cpp', confidence: CONFIDENCE_LEVELS.HIGH, extension: ext };
    }
    return { language: 'c', confidence: CONFIDENCE_LEVELS.HIGH, extension: ext };
  }

  return {
    language: matchedLang,
    confidence: CONFIDENCE_LEVELS.HIGH,
    extension: ext
  };
}

/**
 * Syntax heuristic definitions for pasted code detection.
 */
const LANGUAGE_PATTERNS = {
  python: [
    { pattern: /\bdef\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*:/g, weight: 12, reason: 'def function(): definition' },
    { pattern: /\b(?:import\s+[a-zA-Z_]\w*|from\s+[a-zA-Z_]\w*\s+import)\b/g, weight: 10, reason: 'import/from statement' },
    { pattern: /\belif\s+.*:/g, weight: 10, reason: 'elif block statement' },
    { pattern: /if\s+__name__\s*==\s*['"]__main__['"]\s*:/g, weight: 14, reason: 'main entry guard' },
    { pattern: /\bclass\s+[a-zA-Z_]\w*(?:\([^)]*\))?\s*:/g, weight: 10, reason: 'class definition with colon' },
    { pattern: /\bself\.[a-zA-Z_]\w*/g, weight: 8, reason: 'self instance access' },
    { pattern: /@[a-zA-Z_]\w*(?:\([^)]*\))?/g, weight: 6, reason: 'decorator syntax' },
    { pattern: /\b(?:None|True|False)\b/g, weight: 5, reason: 'Python boolean/None literal' },
    { pattern: /(?:"""[\s\S]*?"""|'''[\s\S]*?''')/g, weight: 8, reason: 'triple-quoted docstring' },
    { pattern: /\bfor\s+[a-zA-Z_]\w*\s+in\s+.*:/g, weight: 8, reason: 'for ... in ...: loop' },
    { pattern: /\bexcept\s+(?:[a-zA-Z_]\w*(?:\s+as\s+[a-zA-Z_]\w*)?)?\s*:/g, weight: 10, reason: 'except block' },
    { pattern: /\bwith\s+.*?\s+as\s+[a-zA-Z_]\w*\s*:/g, weight: 8, reason: 'with context manager' },
    { pattern: /\bprint\s*\(/g, weight: 4, reason: 'print() function' },
    { pattern: /(?:^|\n)\s*#[^#\n!].*$/gm, weight: 3, reason: 'Python comment (#)' }
  ],

  java: [
    { pattern: /\bpublic\s+class\s+[A-Z]\w*/g, weight: 14, reason: 'public class declaration' },
    { pattern: /\bpublic\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]/g, weight: 16, reason: 'public static void main entry' },
    { pattern: /\bSystem\.(?:out|err)\.(?:println|print|printf)\b/g, weight: 14, reason: 'System.out.println' },
    { pattern: /\bpackage\s+[a-z0-9_.]+\s*;/g, weight: 12, reason: 'package declaration' },
    { pattern: /\bimport\s+java\.[a-z0-9_.]+\s*;/g, weight: 12, reason: 'java.* import' },
    { pattern: /@(?:Override|Deprecated|SuppressWarnings)\b/g, weight: 8, reason: 'Java standard annotation' },
    { pattern: /\b(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?(?:int|boolean|void|String|long|double|float|char|byte|short)\s+[a-zA-Z_]\w*\s*\(/g, weight: 10, reason: 'Java method signature' },
    { pattern: /\b(?:throws|implements|extends)\s+[A-Z]\w*/g, weight: 8, reason: 'class inheritance/exception declaration' },
    { pattern: /\b(?:ArrayList|HashMap|HashSet|LinkedList|List|Map|Set)<[A-Z]\w*>/g, weight: 8, reason: 'Java Collections generic' }
  ],

  cpp: [
    { pattern: /#include\s*<(?:iostream|vector|string|map|unordered_map|memory|algorithm|queue|deque|stack|sstream|fstream|utility|cmath|thread|mutex|set|array)>/g, weight: 16, reason: 'C++ standard library header' },
    { pattern: /\bstd::[a-zA-Z_]\w*/g, weight: 14, reason: 'std:: namespace qualification' },
    { pattern: /\busing\s+namespace\s+std\s*;/g, weight: 14, reason: 'using namespace std' },
    { pattern: /\b(?:cout|cin)\s*(?:<<|>>)|\bendl\b/g, weight: 12, reason: 'C++ stream operators' },
    { pattern: /\bclass\s+[A-Z]\w*(?:\s*:\s*(?:public|private|protected)\s+\w+)?\s*\{[\s\S]*?(?:public|private|protected)\s*:/g, weight: 14, reason: 'C++ class with access specifier' },
    { pattern: /\btemplate\s*<\s*(?:typename|class)\b/g, weight: 14, reason: 'C++ template declaration' },
    { pattern: /\b(?:nullptr|constexpr|decltype|noexcept|static_cast|dynamic_cast|reinterpret_cast)\b/g, weight: 12, reason: 'C++ modern keyword' },
    { pattern: /\bnew\s+[a-zA-Z_]\w*(?:\s*\[|\s*\()|\bdelete(?:\[\])?\s+[a-zA-Z_]\w*/g, weight: 8, reason: 'C++ new/delete memory operator' },
    { pattern: /\bnamespace\s+[a-zA-Z_]\w*\s*\{/g, weight: 10, reason: 'namespace definition' },
    { pattern: /::/g, weight: 5, reason: 'scope resolution operator ::' }
  ],

  c: [
    { pattern: /#include\s*<(?:stdio\.h|stdlib\.h|string\.h|unistd\.h|fcntl\.h|sys\/|stdbool\.h|stddef\.h|stdint\.h|time\.h|errno\.h)>/g, weight: 14, reason: 'C standard library header' },
    { pattern: /\b(?:printf|scanf|fprintf|sprintf|snprintf)\s*\(/g, weight: 10, reason: 'C I/O function (printf/scanf)' },
    { pattern: /\b(?:malloc|calloc|realloc|free)\s*\(/g, weight: 10, reason: 'C heap memory management' },
    { pattern: /\bint\s+main\s*\(\s*(?:void|int\s+argc,\s*char\s*\*+\s*argv\[?\]?)\s*\)/g, weight: 10, reason: 'C main signature' },
    { pattern: /\bstruct\s+[a-zA-Z_]\w*\s*\*\s*[a-zA-Z_]\w*/g, weight: 8, reason: 'C-style struct pointer' },
    { pattern: /\btypedef\s+struct\b/g, weight: 10, reason: 'typedef struct definition' },
    { pattern: /\bNULL\b/g, weight: 6, reason: 'NULL pointer macro' },
    { pattern: /\bsize_t\b/g, weight: 4, reason: 'size_t type definition' }
  ],

  typescript: [
    { pattern: /\binterface\s+[A-Z]\w*(?:\s*<[^>]+>)?\s*\{/g, weight: 16, reason: 'TypeScript interface declaration' },
    { pattern: /\btype\s+[A-Z]\w*(?:\s*<[^>]+>)?\s*=/g, weight: 16, reason: 'TypeScript type alias' },
    { pattern: /\benum\s+[A-Z]\w*\s*\{/g, weight: 14, reason: 'TypeScript enum declaration' },
    { pattern: /:\s*(?:string|number|boolean|any|unknown|never|void|object|Record<|Array<|Promise<|T\[\])\b/g, weight: 12, reason: 'TypeScript explicit type annotation' },
    { pattern: /\b(?:public|private|protected|readonly)\s+[a-zA-Z_]\w*\s*:/g, weight: 12, reason: 'TypeScript parameter/property visibility modifier' },
    { pattern: /\)\s*:\s*(?:string|number|boolean|void|Promise<|Record<|[A-Z]\w*)\s*(?:=>|\{)/g, weight: 12, reason: 'TypeScript function return type annotation' },
    { pattern: /\bas\s+(?:const|string|number|boolean|[A-Z]\w*)\b/g, weight: 10, reason: 'TypeScript type assertion (as ...)' },
    { pattern: /\bimplements\s+[A-Z]\w*/g, weight: 10, reason: 'TypeScript implements keyword' },
    { pattern: /\bfunction\s+[a-zA-Z_]\w*<[A-Z]\w*>/g, weight: 12, reason: 'TypeScript generic function signature' }
  ],

  javascript: [
    { pattern: /\b(?:const|let|var)\s+[a-zA-Z_]\w*\s*=/g, weight: 8, reason: 'variable declaration (const/let/var)' },
    { pattern: /\bconsole\.(?:log|error|warn|info|debug|trace)\s*\(/g, weight: 10, reason: 'console.log statement' },
    { pattern: /\bfunction\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*\{/g, weight: 8, reason: 'function declaration' },
    { pattern: /=>\s*\{?/g, weight: 6, reason: 'ES6 arrow function' },
    { pattern: /\bexport\s+(?:default\s+)?(?:function|class|const|let|var)\b/g, weight: 8, reason: 'ES6 export' },
    { pattern: /\bimport\s+.*?\s+from\s+['"][^'"]+['"]/g, weight: 8, reason: 'ES6 import ... from ...' },
    { pattern: /\brequire\s*\(['"][^'"]+['"]\)/g, weight: 10, reason: 'CommonJS require()' },
    { pattern: /\bmodule\.exports\s*=/g, weight: 10, reason: 'CommonJS module.exports' },
    { pattern: /\b(?:document\.|window\.|localStorage\.|sessionStorage\.)/g, weight: 8, reason: 'Browser DOM global' },
    { pattern: /\b(?:async\s+function|await\s+)/g, weight: 6, reason: 'async/await syntax' }
  ]
};

/**
 * Detects programming language directly from source code text using deterministic heuristic analysis.
 *
 * @param {string} code - Source code to analyze
 * @returns {{
 *   language: string|null,
 *   confidence: 'HIGH'|'MEDIUM'|'UNCERTAIN',
 *   score: number,
 *   scores: Record<string, number>,
 *   reasons: string[],
 *   isAmbiguous: boolean
 * }}
 */
export function detectLanguageFromContent(code) {
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return {
      language: null,
      confidence: CONFIDENCE_LEVELS.UNCERTAIN,
      score: 0,
      scores: { python: 0, javascript: 0, typescript: 0, java: 0, c: 0, cpp: 0 },
      reasons: ['Buffer is empty or contains only whitespace'],
      isAmbiguous: true
    };
  }

  const cleanCode = code.trim();

  // Very short snippets (< 10 chars) cannot reliably identify language
  if (cleanCode.length < 10) {
    return {
      language: null,
      confidence: CONFIDENCE_LEVELS.UNCERTAIN,
      score: 0,
      scores: { python: 0, javascript: 0, typescript: 0, java: 0, c: 0, cpp: 0 },
      reasons: ['Code snippet is too short for reliable identification (< 10 chars)'],
      isAmbiguous: true
    };
  }

  const scores = {
    python: 0,
    javascript: 0,
    typescript: 0,
    java: 0,
    c: 0,
    cpp: 0
  };

  const matchedReasons = {
    python: [],
    javascript: [],
    typescript: [],
    java: [],
    c: [],
    cpp: []
  };

  // Evaluate pattern weights for each language
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    for (const { pattern, weight, reason } of patterns) {
      pattern.lastIndex = 0; // Reset regex state
      const matches = cleanCode.match(pattern);
      if (matches && matches.length > 0) {
        // Multiplier bounded to at most 3 to avoid single-pattern spam
        const multiplier = Math.min(matches.length, 3);
        const addedScore = weight * multiplier;
        scores[lang] += addedScore;
        matchedReasons[lang].push(`${reason} (${matches.length}x)`);
      }
    }
  }

  // Domain-specific disambiguation penalties & reinforcements

  // 1. Python specific disambiguation:
  // If code heavily uses semicolons at line ends or curly brace blocks, penalize Python
  const semicolonLineEnds = (cleanCode.match(/;\s*(?:\/\/[^\n]*)?$/gm) || []).length;
  const curlyBraceBlocks = (cleanCode.match(/\{[\s\S]*?\}/g) || []).length;
  if (semicolonLineEnds > 1 || curlyBraceBlocks > 1) {
    scores.python = Math.max(0, scores.python - (semicolonLineEnds * 4 + curlyBraceBlocks * 3));
  }

  // 2. Disambiguate C vs C++:
  // If any C++ exclusive features are present, C++ takes clear precedence over C
  const hasCppExclusive =
    /#include\s*<(?:iostream|vector|string|map|memory|algorithm|queue|stack|utility)>/.test(cleanCode) ||
    /\bstd::/.test(cleanCode) ||
    /\busing\s+namespace\s+std\s*;/.test(cleanCode) ||
    /\bcout\s*<<|\bcin\s*>>/.test(cleanCode) ||
    /\bclass\s+[A-Z]\w*\s*\{[\s\S]*?(?:public|private|protected)\s*:/.test(cleanCode) ||
    /\btemplate\s*<\s*(?:typename|class)\b/.test(cleanCode) ||
    /\b(?:nullptr|constexpr|decltype|static_cast)\b/.test(cleanCode);

  if (hasCppExclusive) {
    // Strongly reinforce C++ and suppress plain C
    scores.cpp += 15;
    scores.c = Math.max(0, scores.c - 20);
  } else if (scores.c > 0 && scores.cpp > 0 && !hasCppExclusive) {
    // Has C markers (e.g., #include <stdio.h>, printf) and no C++ markers -> C takes precedence
    scores.c += 10;
  }

  // 3. Disambiguate JavaScript vs TypeScript:
  // If TypeScript type syntax is present, TypeScript wins over plain JavaScript
  const hasTypeScriptExclusive =
    /\binterface\s+[A-Z]\w*/.test(cleanCode) ||
    /\btype\s+[A-Z]\w*\s*=/.test(cleanCode) ||
    /\benum\s+[A-Z]\w*\s*\{/.test(cleanCode) ||
    /:\s*(?:string|number|boolean|any|unknown|never|void|Record<|Array<|Promise<|T\[\])\b/.test(cleanCode) ||
    /\bas\s+(?:const|string|number|boolean|[A-Z]\w*)\b/.test(cleanCode) ||
    /\b(?:public|private|protected|readonly)\s+[a-zA-Z_]\w*\s*:/.test(cleanCode);

  if (hasTypeScriptExclusive) {
    scores.typescript += 20;
  } else if (scores.javascript > 0 && scores.typescript > 0 && !hasTypeScriptExclusive) {
    // Plain JS patterns without any TS types -> JavaScript wins
    scores.javascript += 15;
  }

  // Sort scores descending
  const sortedLangs = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topLang, topScore] = sortedLangs[0];
  const [, secondScore] = sortedLangs[1];

  // Ambiguity and confidence threshold evaluation
  // Thresholds:
  // HIGH: score >= 18 AND margin >= 6
  // MEDIUM: score >= 10 AND margin >= 4
  // UNCERTAIN: below thresholds or top score is zero
  const margin = topScore - secondScore;

  if (topScore === 0) {
    return {
      language: null,
      confidence: CONFIDENCE_LEVELS.UNCERTAIN,
      score: 0,
      scores,
      reasons: ['No known syntax patterns matched for supported languages'],
      isAmbiguous: true
    };
  }

  if (topScore < 10 || margin < 3) {
    return {
      language: topLang,
      confidence: CONFIDENCE_LEVELS.UNCERTAIN,
      score: topScore,
      scores,
      reasons: matchedReasons[topLang] || [],
      isAmbiguous: true
    };
  }

  if (topScore >= 18 && margin >= 6) {
    return {
      language: topLang,
      confidence: CONFIDENCE_LEVELS.HIGH,
      score: topScore,
      scores,
      reasons: matchedReasons[topLang] || [],
      isAmbiguous: false
    };
  }

  return {
    language: topLang,
    confidence: CONFIDENCE_LEVELS.MEDIUM,
    score: topScore,
    scores,
    reasons: matchedReasons[topLang] || [],
    isAmbiguous: false
  };
}

/**
 * Unified detector that attempts detection via filename/extension first,
 * then falls back to content analysis.
 *
 * @param {string} code - Source code
 * @param {string} [fileName] - Optional filename
 * @returns {{
 *   language: string|null,
 *   confidence: 'HIGH'|'MEDIUM'|'UNCERTAIN',
 *   source: 'extension'|'content'|'none',
 *   score?: number,
 *   reasons?: string[],
 *   isAmbiguous: boolean
 * }}
 */
export function detectLanguage(code, fileName) {
  // 1. If filename is supplied and has supported extension, use it
  if (fileName && typeof fileName === 'string') {
    const extResult = detectLanguageFromExtension(fileName, code);
    if (extResult.language) {
      return {
        language: extResult.language,
        confidence: extResult.confidence,
        source: 'extension',
        isAmbiguous: false
      };
    }
  }

  // 2. Fall back to content-based detection
  const contentResult = detectLanguageFromContent(code);
  return {
    language: contentResult.language,
    confidence: contentResult.confidence,
    source: contentResult.language ? 'content' : 'none',
    score: contentResult.score,
    scores: contentResult.scores,
    reasons: contentResult.reasons,
    isAmbiguous: contentResult.isAmbiguous
  };
}

export default {
  SUPPORTED_LANGUAGE_IDS,
  CONFIDENCE_LEVELS,
  EXTENSION_MAP,
  detectLanguageFromExtension,
  detectLanguageFromContent,
  detectLanguage
};
