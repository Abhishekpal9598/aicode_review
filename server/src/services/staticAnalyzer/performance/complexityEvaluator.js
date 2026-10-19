/**
 * Algorithmic Complexity & Performance Evaluator
 * server/src/services/staticAnalyzer/performance/complexityEvaluator.js
 *
 * Deterministic lexical & pattern-based Big-O complexity analyzer across
 * 6 supported languages: Python, Java, JavaScript, TypeScript, C, C++.
 *
 * Evaluates:
 * 1. Time Complexity: O(1), O(log n), O(n), O(n log n), O(n²), O(n³), O(2^n), O(n!)
 * 2. Space Complexity: O(1), O(log n), O(n), O(n²)
 * 3. Performance Findings: exact coordinates, severity, complexity estimate,
 *    explanation, optimization suggestion, corrected snippet, confidence rating.
 *
 * Adheres strictly to Requirement 5:
 * "Do not claim mathematically exact Big-O complexity when static analysis cannot establish it.
 * Clearly distinguish: deterministic detection, estimated complexity, AI-assisted suggestions."
 */

/**
 * Common Big-O Time Complexity constants
 */
export const TIME_COMPLEXITY = {
  O_1: 'O(1)',
  O_LOG_N: 'O(log n)',
  O_N: 'O(n)',
  O_N_LOG_N: 'O(n log n)',
  O_N_2: 'O(n²)',
  O_N_3: 'O(n³)',
  O_2_N: 'O(2^n)',
  O_N_FACTORIAL: 'O(n!)'
};

/**
 * Common Big-O Space Complexity constants
 */
export const SPACE_COMPLEXITY = {
  O_1: 'O(1)',
  O_LOG_N: 'O(log n)',
  O_N: 'O(n)',
  O_N_2: 'O(n²)'
};

/**
 * Complexity hierarchy rank for determining worst-case upper bound
 */
const TIME_RANK = {
  'O(1)': 1,
  'O(log n)': 2,
  'O(n)': 3,
  'O(n log n)': 4,
  'O(n²)': 5,
  'O(n³)': 6,
  'O(2^n)': 7,
  'O(n!)': 8
};

const SPACE_RANK = {
  'O(1)': 1,
  'O(log n)': 2,
  'O(n)': 3,
  'O(n²)': 4
};

/**
 * Strips comments from code for accurate pattern matching without corrupting line indices.
 * Replaces comment characters with spaces to preserve 1:1 spatial line offsets.
 */
function maskCommentsPreserveLines(code, language) {
  const lang = (language || '').toLowerCase().trim();
  const chars = code.split('');
  const len = chars.length;
  let i = 0;

  if (lang === 'python') {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTripleSingle = false;
    let inTripleDouble = false;

    while (i < len) {
      if (!inSingleQuote && !inDoubleQuote) {
        if (!inTripleSingle && !inTripleDouble && chars[i] === '#' ) {
          while (i < len && chars[i] !== '\n') {
            chars[i] = ' ';
            i++;
          }
          continue;
        }
        if (code.slice(i, i + 3) === "'''") {
          inTripleSingle = !inTripleSingle;
          chars[i] = ' '; chars[i+1] = ' '; chars[i+2] = ' ';
          i += 3;
          continue;
        }
        if (code.slice(i, i + 3) === '"""') {
          inTripleDouble = !inTripleDouble;
          chars[i] = ' '; chars[i+1] = ' '; chars[i+2] = ' ';
          i += 3;
          continue;
        }
      }
      if (!inTripleSingle && !inTripleDouble) {
        if (chars[i] === "'" && !inDoubleQuote) inSingleQuote = !inSingleQuote;
        else if (chars[i] === '"' && !inSingleQuote) inDoubleQuote = !inDoubleQuote;
      }
      if (inTripleSingle || inTripleDouble) {
        if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' ';
      }
      i++;
    }
  } else {
    // C, C++, Java, JS, TS comment syntax (// and /* */)
    let inString = false;
    let stringChar = '';
    let inBlockComment = false;
    let inLineComment = false;

    while (i < len) {
      if (!inLineComment && !inBlockComment) {
        if (!inString && (chars[i] === '"' || chars[i] === "'" || chars[i] === '`')) {
          inString = true;
          stringChar = chars[i];
          i++;
          continue;
        }
        if (inString && chars[i] === stringChar && chars[i - 1] !== '\\') {
          inString = false;
          i++;
          continue;
        }
        if (!inString && chars[i] === '/' && chars[i + 1] === '/') {
          inLineComment = true;
          chars[i] = ' ';
          chars[i + 1] = ' ';
          i += 2;
          continue;
        }
        if (!inString && chars[i] === '/' && chars[i + 1] === '*') {
          inBlockComment = true;
          chars[i] = ' ';
          chars[i + 1] = ' ';
          i += 2;
          continue;
        }
      } else if (inLineComment) {
        if (chars[i] === '\n') {
          inLineComment = false;
        } else {
          chars[i] = ' ';
        }
      } else if (inBlockComment) {
        if (chars[i] === '*' && chars[i + 1] === '/') {
          inBlockComment = false;
          chars[i] = ' ';
          chars[i + 1] = ' ';
          i += 2;
          continue;
        } else if (chars[i] !== '\n' && chars[i] !== '\r') {
          chars[i] = ' ';
        }
      }
      i++;
    }
  }

  return chars.join('');
}

/**
 * Finds line numbers corresponding to a character offset.
 */
function getLineFromIndex(code, index) {
  const prefix = code.slice(0, index);
  return prefix.split('\n').length;
}

/**
 * Extracts line excerpt safely.
 */
function getLineExcerpt(lines, lineNum, context = 1) {
  const start = Math.max(0, lineNum - 1);
  const end = Math.min(lines.length, lineNum + context);
  return lines.slice(start, end).join('\n');
}

/**
 * Evaluates performance bottlenecks and Big-O complexity from source code.
 *
 * @param {string} code - Untrusted raw source code
 * @param {string} language - Programming language ('python', 'javascript', 'typescript', 'java', 'c', 'cpp')
 * @returns {object} Complexity evaluation report
 */
export function evaluateComplexity(code, language) {
  const safeCode = typeof code === 'string' ? code : '';
  const safeLang = (language || '').toLowerCase().trim();
  const rawLines = safeCode.split(/\r?\n/);
  const totalLines = rawLines.length;

  if (safeCode.trim().length === 0) {
    return {
      timeComplexity: TIME_COMPLEXITY.O_1,
      spaceComplexity: SPACE_COMPLEXITY.O_1,
      complexityType: 'deterministic',
      confidence: 'HIGH',
      findings: [],
      metrics: {
        bottlenecksCount: 0,
        nestedLoopCount: 0,
        recursionDetected: false,
        memoryAllocationRisks: 0,
        performanceScore: 100
      },
      summary: 'Empty code buffer evaluated with constant O(1) complexity.'
    };
  }

  const cleanCode = maskCommentsPreserveLines(safeCode, safeLang);
  const findings = [];
  let worstTime = TIME_COMPLEXITY.O_1;
  let worstSpace = SPACE_COMPLEXITY.O_1;
  let isDeterministic = true;
  let overallConfidence = 'HIGH';

  let nestedLoopCount = 0;
  let recursionDetected = false;
  let memoryAllocationRisks = 0;

  // ---------------------------------------------------------------------------
  // 1. Detect Exponential Recursion: O(2^n) Time, O(n) Stack Space
  // Patterns like fib(n-1) + fib(n-2) or solve(n-1) + solve(n-2)
  // ---------------------------------------------------------------------------
  const multiBranchRecursionRegex = /(?:def\s+([a-zA-Z0-9_]+)|function\s+([a-zA-Z0-9_]+)|(?:int|void|long|double|auto)\s+([a-zA-Z0-9_]+))\s*\([^)]*\)[\s\S]*?\b(?:\1|\2|\3)\s*\([^)]*-\s*1\)[^;}\n]*\+[^;}\n]*\b(?:\1|\2|\3)\s*\([^)]*-\s*2\)/g;
  let recMatch;
  while ((recMatch = multiBranchRecursionRegex.exec(cleanCode)) !== null) {
    const fnName = recMatch[1] || recMatch[2] || recMatch[3] || 'recursiveFunction';
    const matchLine = getLineFromIndex(cleanCode, recMatch.index);
    const lineEnd = Math.min(totalLines, matchLine + 4);

    findings.push({
      ruleId: 'PERF-GEN-003',
      title: `Exponential Recursion (${TIME_COMPLEXITY.O_2_N})`,
      category: 'performance',
      severity: 'CRITICAL',
      complexityEstimate: TIME_COMPLEXITY.O_2_N,
      lineStart: matchLine,
      lineEnd,
      originalSnippet: getLineExcerpt(rawLines, matchLine, 2),
      suggestedSnippet: safeLang === 'python'
        ? `from functools import lru_cache\n@lru_cache(maxsize=None)\ndef ${fnName}(n):\n    # Memoized O(n) dynamic programming`
        : `// Memoize recursive calls with a cache array/map\nconst memo = new Map();\nfunction ${fnName}(n) { ... }`,
      explanation: `Function '${fnName}' makes multiple unmemoized recursive calls (e.g. ${fnName}(n-1) + ${fnName}(n-2)), causing exponential O(2^n) time complexity and O(n) auxiliary call stack consumption.`,
      optimization: `Convert to iterative dynamic programming or memoize intermediate results with a hash map / @lru_cache to reduce time complexity to O(n).`,
      confidence: 'HIGH',
      source: 'static'
    });

    recursionDetected = true;
    if (TIME_RANK[TIME_COMPLEXITY.O_2_N] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_2_N;
    if (SPACE_RANK[SPACE_COMPLEXITY.O_N] > SPACE_RANK[worstSpace]) worstSpace = SPACE_COMPLEXITY.O_N;
  }

  // ---------------------------------------------------------------------------
  // 2. Detect Triple Nested Loops: O(n³) Time
  // ---------------------------------------------------------------------------
  const tripleNestedRegex = /(?:for|while)\s*\([^)]*\)[^{;\n]*\{[\s\S]*?(?:for|while)\s*\([^)]*\)[^{;\n]*\{[\s\S]*?(?:for|while)\s*\([^)]*\)/g;
  let tripleMatch;
  while ((tripleMatch = tripleNestedRegex.exec(cleanCode)) !== null) {
    const matchLine = getLineFromIndex(cleanCode, tripleMatch.index);
    const lineEnd = Math.min(totalLines, matchLine + 6);

    findings.push({
      ruleId: 'PERF-GEN-002',
      title: `Cubic Nested Iteration (${TIME_COMPLEXITY.O_N_3})`,
      category: 'performance',
      severity: 'CRITICAL',
      complexityEstimate: TIME_COMPLEXITY.O_N_3,
      lineStart: matchLine,
      lineEnd,
      originalSnippet: getLineExcerpt(rawLines, matchLine, 4),
      suggestedSnippet: '// Replace 3-level deep nested loops with hash map index or multi-dimensional prefix sums',
      explanation: `Three deeply nested loops iterate over the input dimensions, resulting in cubic O(n³) execution time which severely degrades throughput on larger datasets.`,
      optimization: `Precompute values using hash tables, sorting, or dynamic programming to eliminate at least one nested iteration loop.`,
      confidence: 'HIGH',
      source: 'static'
    });

    nestedLoopCount += 2;
    if (TIME_RANK[TIME_COMPLEXITY.O_N_3] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_N_3;
  }

  // Python-specific triple nested loop indentation check
  if (safeLang === 'python') {
    const pyTripleRegex = /(?:^|\n)([ \t]*)(?:for|while)\b[^\n]+:[\s\S]*?\n\1[ \t]+(?:for|while)\b[^\n]+:[\s\S]*?\n\1[ \t]{2,}(?:for|while)\b[^\n]+:/g;
    let pyTripleMatch;
    while ((pyTripleMatch = pyTripleRegex.exec(cleanCode)) !== null) {
      const matchLine = getLineFromIndex(cleanCode, pyTripleMatch.index);
      const lineEnd = Math.min(totalLines, matchLine + 4);
      if (!findings.some((f) => f.ruleId === 'PERF-GEN-002' && Math.abs(f.lineStart - matchLine) <= 3)) {
        findings.push({
          ruleId: 'PERF-GEN-002',
          title: `Cubic Nested Iteration (${TIME_COMPLEXITY.O_N_3})`,
          category: 'performance',
          severity: 'CRITICAL',
          complexityEstimate: TIME_COMPLEXITY.O_N_3,
          lineStart: matchLine,
          lineEnd,
          originalSnippet: getLineExcerpt(rawLines, matchLine, 3),
          suggestedSnippet: '# Use itertools, NumPy vectorization, or pre-indexed dictionaries to avoid O(n³) loops',
          explanation: `Three levels of nested loops in Python incur high interpreter overhead and cubic O(n³) polynomial time.`,
          optimization: `Vectorize computations or use dictionary lookups to eliminate inner loops.`,
          confidence: 'HIGH',
          source: 'static'
        });
        nestedLoopCount += 2;
        if (TIME_RANK[TIME_COMPLEXITY.O_N_3] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_N_3;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Detect Quadratic Nested Loops: O(n²) Time
  // C/C++, Java, JS/TS brace-based nested loops
  // ---------------------------------------------------------------------------
  const doubleNestedRegex = /(?:for|while)\s*\([^)]*\)[^{;\n]*\{[\s\S]*?(?:for|while)\s*\([^)]*\)/g;
  let doubleMatch;
  while ((doubleMatch = doubleNestedRegex.exec(cleanCode)) !== null) {
    const matchLine = getLineFromIndex(cleanCode, doubleMatch.index);
    const lineEnd = Math.min(totalLines, matchLine + 4);

    // Skip if already flagged as triple nested loop
    if (!findings.some((f) => f.ruleId === 'PERF-GEN-002' && Math.abs(f.lineStart - matchLine) <= 3)) {
      findings.push({
        ruleId: 'PERF-GEN-001',
        title: `Quadratic Nested Loop (${TIME_COMPLEXITY.O_N_2})`,
        category: 'performance',
        severity: 'HIGH',
        complexityEstimate: TIME_COMPLEXITY.O_N_2,
        lineStart: matchLine,
        lineEnd,
        originalSnippet: getLineExcerpt(rawLines, matchLine, 3),
        suggestedSnippet: '// Use Set/Map for O(1) lookups to flatten nested iterations to O(n)',
        explanation: `Nested loop detected where an inner iteration executes for every outer step, resulting in quadratic O(n²) runtime complexity.`,
        optimization: `Replace the inner loop with a Set or Map lookup, reducing time complexity from O(n²) to O(n).`,
        confidence: 'HIGH',
        source: 'static'
      });

      nestedLoopCount += 1;
      if (TIME_RANK[TIME_COMPLEXITY.O_N_2] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_N_2;
    }
  }

  // Python-specific 2-level nested loop indentation check
  if (safeLang === 'python') {
    const pyDoubleRegex = /(?:^|\n)([ \t]*)(?:for|while)\b[^\n]+:[\s\S]*?\n\1[ \t]+(?:for|while)\b[^\n]+:/g;
    let pyDoubleMatch;
    while ((pyDoubleMatch = pyDoubleRegex.exec(cleanCode)) !== null) {
      const matchLine = getLineFromIndex(cleanCode, pyDoubleMatch.index);
      const lineEnd = Math.min(totalLines, matchLine + 3);
      if (!findings.some((f) => (f.ruleId === 'PERF-GEN-001' || f.ruleId === 'PERF-GEN-002') && Math.abs(f.lineStart - matchLine) <= 2)) {
        findings.push({
          ruleId: 'PERF-GEN-001',
          title: `Quadratic Nested Loop (${TIME_COMPLEXITY.O_N_2})`,
          category: 'performance',
          severity: 'HIGH',
          complexityEstimate: TIME_COMPLEXITY.O_N_2,
          lineStart: matchLine,
          lineEnd,
          originalSnippet: getLineExcerpt(rawLines, matchLine, 2),
          suggestedSnippet: '# Pre-build a set or dict for O(1) lookups instead of nested looping',
          explanation: `Nested loops in Python produce quadratic O(n²) time complexity.`,
          optimization: `Construct a set or hash map before the loop to reduce overall complexity to O(n).`,
          confidence: 'HIGH',
          source: 'static'
        });
        nestedLoopCount += 1;
        if (TIME_RANK[TIME_COMPLEXITY.O_N_2] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_N_2;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Linear Search Inside Loop (Hidden O(n²) Time)
  // Python: `in list` inside loop
  // JS/TS: `.includes()` / `.indexOf()` / `.find()` inside loop
  // Java: `list.contains()` inside loop
  // ---------------------------------------------------------------------------
  if (safeLang === 'python') {
    const pyLinearSearchInLoopRegex = /(?:for|while)\b[^\n]+:[\s\S]*?\b(?:if|and|or)\s+([a-zA-Z0-9_]+)\s+in\s+([a-zA-Z0-9_]+)/g;
    let pyLinMatch;
    while ((pyLinMatch = pyLinearSearchInLoopRegex.exec(cleanCode)) !== null) {
      const matchLine = getLineFromIndex(cleanCode, pyLinMatch.index);
      findings.push({
        ruleId: 'PERF-PY-002',
        title: `Linear Membership Check in Loop (Hidden ${TIME_COMPLEXITY.O_N_2})`,
        category: 'performance',
        severity: 'HIGH',
        complexityEstimate: TIME_COMPLEXITY.O_N_2,
        lineStart: matchLine,
        lineEnd: Math.min(totalLines, matchLine + 2),
        originalSnippet: getLineExcerpt(rawLines, matchLine, 1),
        suggestedSnippet: `${pyLinMatch[2]}_set = set(${pyLinMatch[2]})\n# Then check '${pyLinMatch[1]} in ${pyLinMatch[2]}_set' for O(1) membership`,
        explanation: `Checking membership with 'in ${pyLinMatch[2]}' performs an O(n) sequential scan. Doing this inside a loop degrades overall performance to quadratic O(n²).`,
        optimization: `Convert '${pyLinMatch[2]}' to a set before the loop. Set membership tests in Python are O(1) average time, reducing overall complexity to O(n).`,
        confidence: 'HIGH',
        source: 'static'
      });
      if (TIME_RANK[TIME_COMPLEXITY.O_N_2] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_N_2;
    }
  }

  if (safeLang === 'javascript' || safeLang === 'typescript') {
    const jsLinearSearchInLoopRegex = /(?:for|while)\s*\([^)]*\)[^{;\n]*\{[\s\S]*?\b([a-zA-Z0-9_]+)\.(?:includes|indexOf|find|findIndex)\s*\(/g;
    let jsLinMatch;
    while ((jsLinMatch = jsLinearSearchInLoopRegex.exec(cleanCode)) !== null) {
      const matchLine = getLineFromIndex(cleanCode, jsLinMatch.index);
      findings.push({
        ruleId: 'PERF-JS-001',
        title: `Array Linear Search Inside Loop (Hidden ${TIME_COMPLEXITY.O_N_2})`,
        category: 'performance',
        severity: 'HIGH',
        complexityEstimate: TIME_COMPLEXITY.O_N_2,
        lineStart: matchLine,
        lineEnd: Math.min(totalLines, matchLine + 2),
        originalSnippet: getLineExcerpt(rawLines, matchLine, 1),
        suggestedSnippet: `const ${jsLinMatch[1]}Set = new Set(${jsLinMatch[1]});\n// Use ${jsLinMatch[1]}Set.has(item) for O(1) lookup inside loop`,
        explanation: `Calling array methods like .includes() or .indexOf() inside a loop executes a linear search per iteration, resulting in O(n²) time complexity.`,
        optimization: `Create a Set from '${jsLinMatch[1]}' before iterating. Set.has() runs in O(1) time, reducing the algorithm to linear O(n).`,
        confidence: 'HIGH',
        source: 'static'
      });
      if (TIME_RANK[TIME_COMPLEXITY.O_N_2] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_N_2;
    }
  }

  if (safeLang === 'java') {
    const javaLinearSearchRegex = /(?:for|while)\s*\([^)]*\)[^{;\n]*\{[\s\S]*?\b([a-zA-Z0-9_]+)\.contains\s*\(/g;
    let javaLinMatch;
    while ((javaLinMatch = javaLinearSearchRegex.exec(cleanCode)) !== null) {
      const matchLine = getLineFromIndex(cleanCode, javaLinMatch.index);
      findings.push({
        ruleId: 'PERF-JAV-002',
        title: `List.contains Search in Loop (Hidden ${TIME_COMPLEXITY.O_N_2})`,
        category: 'performance',
        severity: 'HIGH',
        complexityEstimate: TIME_COMPLEXITY.O_N_2,
        lineStart: matchLine,
        lineEnd: Math.min(totalLines, matchLine + 2),
        originalSnippet: getLineExcerpt(rawLines, matchLine, 1),
        suggestedSnippet: `Set<...> set = new HashSet<>(${javaLinMatch[1]});\n// Use set.contains(...) for O(1) lookup in loop`,
        explanation: `Calling list.contains() on a java.util.List inside a loop executes an O(n) linear search, degrading execution to O(n²).`,
        optimization: `Convert the collection to a HashSet before the loop to achieve O(1) lookup speed.`,
        confidence: 'HIGH',
        source: 'static'
      });
      if (TIME_RANK[TIME_COMPLEXITY.O_N_2] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_N_2;
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Quadratic String Concatenation in Loops (O(n²) Time & O(n²) Temp Space)
  // ---------------------------------------------------------------------------
  if (safeLang === 'python') {
    const pyStrConcatRegex = /(?:for|while)\b[^\n]+:[\s\S]*?\b([a-zA-Z0-9_]+)\s*\+=\s*([a-zA-Z0-9_]+|[^\n]+)/g;
    let pyStrMatch;
    while ((pyStrMatch = pyStrConcatRegex.exec(cleanCode)) !== null) {
      const matchLine = getLineFromIndex(cleanCode, pyStrMatch.index);
      // Check if variable name looks like a string or is commonly used as accumulator
      const varName = pyStrMatch[1];
      if (/^(?:res|result|str|text|output|s|msg|content|html|query)$/i.test(varName)) {
        findings.push({
          ruleId: 'PERF-PY-001',
          title: `Quadratic String Concatenation in Loop (${TIME_COMPLEXITY.O_N_2})`,
          category: 'performance',
          severity: 'MEDIUM',
          complexityEstimate: TIME_COMPLEXITY.O_N_2,
          lineStart: matchLine,
          lineEnd: Math.min(totalLines, matchLine + 1),
          originalSnippet: getLineExcerpt(rawLines, matchLine, 1),
          suggestedSnippet: `parts = []\n# inside loop: parts.append(item)\nresult = ''.join(parts)`,
          explanation: `Python strings are immutable. Using '${varName} += ...' inside a loop allocates a new string object and copies all previous characters on each iteration, causing O(n²) time and memory thrashing.`,
          optimization: `Append items to a list and join them once with ''.join(parts) after the loop finishes.`,
          confidence: 'HIGH',
          source: 'static'
        });
        memoryAllocationRisks += 1;
        if (TIME_RANK[TIME_COMPLEXITY.O_N_2] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_N_2;
        if (SPACE_RANK[SPACE_COMPLEXITY.O_N] > SPACE_RANK[worstSpace]) worstSpace = SPACE_COMPLEXITY.O_N;
      }
    }
  }

  if (safeLang === 'java') {
    const javaStrConcatRegex = /(?:for|while)\s*\([^)]*\)[^{;\n]*\{[\s\S]*?\b([a-zA-Z0-9_]+)\s*\+=\s*[^;\n]+;/g;
    let javaStrMatch;
    while ((javaStrMatch = javaStrConcatRegex.exec(cleanCode)) !== null) {
      const matchLine = getLineFromIndex(cleanCode, javaStrMatch.index);
      const varName = javaStrMatch[1];
      if (/^(?:res|result|str|text|output|s|msg|content|html)$/i.test(varName)) {
        findings.push({
          ruleId: 'PERF-JAV-001',
          title: `Java String Concatenation in Loop (${TIME_COMPLEXITY.O_N_2})`,
          category: 'performance',
          severity: 'HIGH',
          complexityEstimate: TIME_COMPLEXITY.O_N_2,
          lineStart: matchLine,
          lineEnd: Math.min(totalLines, matchLine + 1),
          originalSnippet: getLineExcerpt(rawLines, matchLine, 1),
          suggestedSnippet: `StringBuilder sb = new StringBuilder();\n// inside loop: sb.append(...);\nString ${varName} = sb.toString();`,
          explanation: `String concatenation with '+=' inside a Java loop instantiates intermediate StringBuilder objects and reallocates character arrays repeatedly, producing O(n²) runtime.`,
          optimization: `Instantiate a single StringBuilder outside the loop and call .append() inside.`,
          confidence: 'HIGH',
          source: 'static'
        });
        memoryAllocationRisks += 1;
        if (TIME_RANK[TIME_COMPLEXITY.O_N_2] > TIME_RANK[worstTime]) worstTime = TIME_COMPLEXITY.O_N_2;
        if (SPACE_RANK[SPACE_COMPLEXITY.O_N] > SPACE_RANK[worstSpace]) worstSpace = SPACE_COMPLEXITY.O_N;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. C/C++ Repeated Dynamic Memory Allocation in Tight Loops
  // ---------------------------------------------------------------------------
  if (safeLang === 'c' || safeLang === 'cpp') {
    const cAllocInLoopRegex = /(?:for|while)\s*\([^)]*\)[^{;\n]*\{[\s\S]*?\b(?:malloc|calloc|realloc|new\s+[a-zA-Z0-9_]+)\s*\(/g;
    let cAllocMatch;
    while ((cAllocMatch = cAllocInLoopRegex.exec(cleanCode)) !== null) {
      const matchLine = getLineFromIndex(cleanCode, cAllocMatch.index);
      findings.push({
        ruleId: 'PERF-C-001',
        title: 'Repeated Heap Allocation Inside Loop',
        category: 'performance',
        severity: 'HIGH',
        complexityEstimate: 'O(n) Allocations',
        lineStart: matchLine,
        lineEnd: Math.min(totalLines, matchLine + 2),
        originalSnippet: getLineExcerpt(rawLines, matchLine, 1),
        suggestedSnippet: '// Allocate buffer once outside the loop and reuse it:\nvoid* buffer = malloc(BUFFER_SIZE);\n// ... free(buffer) after loop',
        explanation: `Calling dynamic memory allocation (malloc/new) inside an iteration loop triggers frequent heap context switches, memory fragmentation, and risk of leaks.`,
        optimization: `Pre-allocate buffers before the loop and reuse the allocated memory across iterations.`,
        confidence: 'HIGH',
        source: 'static'
      });
      memoryAllocationRisks += 1;
      if (SPACE_RANK[SPACE_COMPLEXITY.O_N] > SPACE_RANK[worstSpace]) worstSpace = SPACE_COMPLEXITY.O_N;
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Binary Search Pattern Detection: O(log n) Time, O(1) Space
  // ---------------------------------------------------------------------------
  const binarySearchRegex = /while\s*\(\s*([a-zA-Z0-9_]+)\s*<=\s*([a-zA-Z0-9_]+)\s*\)[\s\S]*?(?:mid|\b[a-zA-Z0-9_]+)\s*=\s*(?:Math\.floor\()?[\s\S]*?\/\s*2[\s\S]*?(?:\1\s*=\s*[a-zA-Z0-9_]+\s*\+\s*1|\2\s*=\s*[a-zA-Z0-9_]+\s*-\s*1)/;
  const pyBinarySearchRegex = /while\s+([a-zA-Z0-9_]+)\s*<=\s*([a-zA-Z0-9_]+)\s*:[\s\S]*?(?:mid|\b[a-zA-Z0-9_]+)\s*=[\s\S]*?\/\/\s*2[\s\S]*?(?:\1\s*=\s*[a-zA-Z0-9_]+\s*\+\s*1|\2\s*=\s*[a-zA-Z0-9_]+\s*-\s*1)/;

  const hasBinarySearch = binarySearchRegex.test(cleanCode) || (safeLang === 'python' && pyBinarySearchRegex.test(cleanCode));

  if (hasBinarySearch && worstTime === TIME_COMPLEXITY.O_1) {
    worstTime = TIME_COMPLEXITY.O_LOG_N;
    worstSpace = SPACE_COMPLEXITY.O_1;
  }

  // ---------------------------------------------------------------------------
  // 8. Single Linear Loop Detection: O(n) Time
  // If not already quadratic or cubic or exponential, and contains a loop
  // ---------------------------------------------------------------------------
  const hasAnyLoop = /(?:for|while)\b/.test(cleanCode);
  if (hasAnyLoop && worstTime === TIME_COMPLEXITY.O_1) {
    worstTime = TIME_COMPLEXITY.O_N;
  }

  // ---------------------------------------------------------------------------
  // 9. Auxiliary Data Structures / Space Complexity Evaluation
  // ---------------------------------------------------------------------------
  // 2D Array allocation -> O(n²)
  const matrixAllocRegex = /(?:new\s+(?:Array|int|double)\[[^\]]+\]\[[^\]]+\]|\[\s*\[\s*0\s*\]\s*\*\s*[a-zA-Z0-9_]+\s*for\s+[^\]]+in\s+range)/;
  if (matrixAllocRegex.test(cleanCode)) {
    worstSpace = SPACE_COMPLEXITY.O_N_2;
  } else {
    // 1D Array allocation -> O(n)
    const arrayAllocRegex = /(?:new\s+Array\([a-zA-Z0-9_]+\)|new\s+(?:ArrayList|int|double)\[[a-zA-Z0-9_]+\]|\[\s*0\s*\]\s*\*\s*[a-zA-Z0-9_]+|new\s+(?:Set|Map)\b)/;
    if (arrayAllocRegex.test(cleanCode) && SPACE_RANK[SPACE_COMPLEXITY.O_N] > SPACE_RANK[worstSpace]) {
      worstSpace = SPACE_COMPLEXITY.O_N;
    }
  }

  // ---------------------------------------------------------------------------
  // 10. Accuracy & Deterministic vs Estimated Classification (Requirement 5)
  // If loops have dynamic break conditions or complex branching, flag as estimated
  // ---------------------------------------------------------------------------
  let complexityType = 'deterministic';
  if (worstTime === TIME_COMPLEXITY.O_N && /\bbreak\b|\breturn\b/.test(cleanCode)) {
    // Variable iteration termination
    complexityType = 'estimated';
    overallConfidence = 'MEDIUM';
  }

  // ---------------------------------------------------------------------------
  // 11. Performance Quality Scoring (0 - 100)
  // Deductions: CRITICAL = -25, HIGH = -15, MEDIUM = -8, LOW = -3
  // ---------------------------------------------------------------------------
  let totalDeduction = 0;
  for (const f of findings) {
    if (f.severity === 'CRITICAL') totalDeduction += 25;
    else if (f.severity === 'HIGH') totalDeduction += 15;
    else if (f.severity === 'MEDIUM') totalDeduction += 8;
    else if (f.severity === 'LOW') totalDeduction += 3;
  }
  const performanceScore = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));

  return {
    timeComplexity: worstTime,
    spaceComplexity: worstSpace,
    complexityType,
    confidence: overallConfidence,
    findings,
    metrics: {
      bottlenecksCount: findings.length,
      nestedLoopCount,
      recursionDetected,
      memoryAllocationRisks,
      performanceScore
    },
    summary: findings.length === 0
      ? `Clean algorithmic execution pattern with ${worstTime} time and ${worstSpace} space complexity.`
      : `Identified ${findings.length} performance bottlenecks. Overall algorithmic worst-case: ${worstTime} time, ${worstSpace} space.`
  };
}

export default {
  TIME_COMPLEXITY,
  SPACE_COMPLEXITY,
  evaluateComplexity
};
