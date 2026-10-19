/**
 * Deterministic Source Code Language Signature Detector
 * server/src/services/staticAnalyzer/utils/detector.js
 *
 * Inspects source code for distinctive language syntax signatures, keywords,
 * directives, and type annotations to detect language mismatches.
 */

export const SUPPORTED_LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'c', 'cpp'];

const LANGUAGE_SIGNATURES = {
  python: [
    { pattern: /\bdef\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*:/, weight: 3, label: 'def function():' },
    { pattern: /\belif\s+.*:/, weight: 3, label: 'elif condition:' },
    { pattern: /\bimport\s+(?:sys|os|sqlite3|math|re|json|typing|requests|collections|datetime|random|hashlib)\b/, weight: 3, label: 'import <python_module>' },
    { pattern: /\bfrom\s+[a-zA-Z_]\w*\s+import\b/, weight: 3, label: 'from <mod> import' },
    { pattern: /if\s+__name__\s*==\s*["']__main__["']:/, weight: 4, label: 'if __name__ == "__main__":' },
    { pattern: /\bprint\s*\([^)]*\)\s*(?:\n|$)(?!;)/, weight: 2, label: 'print(...) without semicolon' },
    { pattern: /\bexcept\s+[a-zA-Z_]\w*\s+as\s+[a-zA-Z_]\w*\s*:/, weight: 3, label: 'except Exception as e:' },
    { pattern: /\bself\.[a-zA-Z_]\w*/, weight: 2, label: 'self.attribute' }
  ],
  cpp: [
    { pattern: /#include\s*<iostream>|#include\s*<vector>|#include\s*<string>|#include\s*<map>|#include\s*<algorithm>/, weight: 4, label: '#include <stl_header>' },
    { pattern: /\bstd::(?:cout|cin|endl|vector|string|map|unordered_map|unique_ptr|shared_ptr)\b/, weight: 4, label: 'std:: namespace' },
    { pattern: /\bcout\s*<<|\bcin\s*>>/, weight: 3, label: 'cout << / cin >>' },
    { pattern: /\bconstexpr\b|\bnullptr\b|\btemplate\s*<class|\btemplate\s*<typename/, weight: 3, label: 'C++ keyword (nullptr/constexpr/template)' }
  ],
  c: [
    { pattern: /#include\s*<stdio\.h>|#include\s*<stdlib\.h>|#include\s*<string\.h>/, weight: 4, label: '#include <c_header.h>' },
    { pattern: /\bprintf\s*\(|\bscanf\s*\(/, weight: 2, label: 'printf/scanf' },
    { pattern: /\bmalloc\s*\(|\bfree\s*\(/, weight: 2, label: 'malloc/free' }
  ],
  java: [
    { pattern: /\bpublic\s+class\s+[a-zA-Z_]\w*/, weight: 4, label: 'public class' },
    { pattern: /\bpublic\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]/, weight: 4, label: 'public static void main(String[])' },
    { pattern: /\bSystem\.(?:out|err)\.print(?:ln)?\s*\(/, weight: 4, label: 'System.out.println' },
    { pattern: /\bpackage\s+[a-zA-Z0-9_.]+\s*;/, weight: 3, label: 'package declaration' },
    { pattern: /\bimport\s+java\.[a-zA-Z0-9_.*]+\s*;/, weight: 3, label: 'import java.*' }
  ],
  javascript: [
    { pattern: /\bconsole\.(?:log|warn|error|info)\s*\(/, weight: 2, label: 'console.log' },
    { pattern: /\bconst\s+[a-zA-Z_]\w*\s*=\s*(?:require\s*\(|\([^)]*\)\s*=>|function\b)/, weight: 3, label: 'JS variable/arrow function' },
    { pattern: /\bexport\s+(?:default|const|function|class)\b/, weight: 2, label: 'export statement' },
    { pattern: /\bmodule\.exports\s*=/, weight: 3, label: 'module.exports' }
  ],
  typescript: [
    { pattern: /\binterface\s+[a-zA-Z_]\w*\s*\{/, weight: 3, label: 'interface declaration' },
    { pattern: /\btype\s+[a-zA-Z_]\w*\s*=\s*\{/, weight: 3, label: 'type declaration' },
    { pattern: /:\s*(?:string|number|boolean|any|unknown|never|void)\s*(?:\[\s*\])?\s*[,)=;]/, weight: 3, label: 'TS primitive type annotation' }
  ]
};

/**
 * Computes language signature scores for the provided code.
 *
 * @param {string} code - Untrusted source code
 * @returns {Record<string, { score: number, matches: string[] }>}
 */
export function scoreLanguages(code) {
  if (typeof code !== 'string' || code.trim().length === 0) {
    return {};
  }

  const results = {};

  for (const [lang, signatures] of Object.entries(LANGUAGE_SIGNATURES)) {
    let score = 0;
    const matches = [];

    for (const sig of signatures) {
      if (sig.pattern.test(code)) {
        score += sig.weight;
        matches.push(sig.label);
      }
    }

    if (score > 0) {
      results[lang] = { score, matches };
    }
  }

  return results;
}

/**
 * Checks whether the submitted code strongly mismatches the declared language.
 *
 * @param {string} code - Untrusted source code
 * @param {string} declaredLanguage - Language identifier passed in request
 * @returns {{ isMismatch: boolean, detectedLanguage: string|null, evidence: string[] }}
 */
export function detectLanguageMismatch(code, declaredLanguage) {
  const normDeclared = (declaredLanguage || '').toLowerCase().trim();
  const scores = scoreLanguages(code);

  const declaredScore = (scores[normDeclared] && scores[normDeclared].score) || 0;

  // Find candidate language with highest signature score
  let bestLang = null;
  let highestScore = 0;

  for (const [lang, data] of Object.entries(scores)) {
    if (data.score > highestScore) {
      highestScore = data.score;
      bestLang = lang;
    }
  }

  // Mismatch criteria:
  // 1. A candidate language has significant score (>= 3)
  // 2. Candidate is NOT the declared language
  // 3. For C and C++, don't flag C/C++ cross-matching as a hard mismatch unless std/iostream is present in C
  if (highestScore >= 3 && bestLang && bestLang !== normDeclared) {
    if ((normDeclared === 'c' && bestLang === 'cpp') || (normDeclared === 'cpp' && bestLang === 'c')) {
      // Permit benign C/C++ overlap unless std:: or iostream in C
      if (normDeclared === 'c' && /#include\s*<iostream>|\bstd::/.test(code)) {
        return {
          isMismatch: true,
          detectedLanguage: 'cpp',
          evidence: scores.cpp.matches
        };
      }
      return { isMismatch: false, detectedLanguage: null, evidence: [] };
    }

    if (normDeclared === 'javascript' && bestLang === 'typescript') {
      return { isMismatch: false, detectedLanguage: null, evidence: [] };
    }

    // Strong mismatch (e.g. Python code pasted into C++, Java into Python, etc.)
    if (declaredScore === 0 || highestScore >= declaredScore + 3) {
      return {
        isMismatch: true,
        detectedLanguage: bestLang,
        evidence: scores[bestLang].matches
      };
    }
  }

  return { isMismatch: false, detectedLanguage: null, evidence: [] };
}

export default {
  scoreLanguages,
  detectLanguageMismatch,
  SUPPORTED_LANGUAGES
};
