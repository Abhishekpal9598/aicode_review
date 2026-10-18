/**
 * Language definitions, starter templates, extension mappings, and telemetry formatters.
 */

export const PYTHON_STARTER = `"""
AI Code Review Platform — Python Review Workspace
Analyze algorithms, time/space complexity, and security vulnerabilities.
"""

def two_sum(nums: list[int], target: int) -> list[int]:
    """Finds two distinct indices such that their values sum to target."""
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

if __name__ == "__main__":
    sample = [2, 7, 11, 15]
    print(two_sum(sample, 9))  # Output: [0, 1]
`;

export const JAVASCRIPT_STARTER = `/**
 * AI Code Review Platform — JavaScript Review Workspace
 * Evaluates ES6+ patterns, performance bottlenecks, and async safety.
 */

function debounce(fn, delayMs = 300) {
  let timerId = null;
  return function (...args) {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn.apply(this, args);
      timerId = null;
    }, delayMs);
  };
}

// Example usage
const logSearch = debounce((query) => {
  console.log('Searching for:', query);
}, 250);
`;

export const TYPESCRIPT_STARTER = `/**
 * AI Code Review Platform — TypeScript Review Workspace
 * Strict type safety, interface cleanliness, and memory optimization.
 */

interface ReviewFinding {
  id: string;
  category: 'bug' | 'security' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  lineRange: [number, number];
  description: string;
}

export function filterCriticalFindings(findings: ReviewFinding[]): ReviewFinding[] {
  return findings.filter(
    (finding) => finding.severity === 'critical' || finding.category === 'security'
  );
}
`;

export const JAVA_STARTER = `/**
 * AI Code Review Platform — Java Review Workspace
 * Concurrency safety, OOP encapsulation, and memory efficiency.
 */

import java.util.HashMap;
import java.util.Map;

public class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        return new int[0];
    }
}
`;

export const C_STARTER = `/**
 * AI Code Review Platform — C Review Workspace
 * Memory safety, buffer overflow prevention, and pointer hygiene.
 */

#include <stdio.h>
#include <stdlib.h>

int binary_search(const int* arr, size_t size, int target) {
    if (!arr || size == 0) return -1;
    
    size_t low = 0;
    size_t high = size - 1;
    
    while (low <= high) {
        size_t mid = low + (high - low) / 2;
        if (arr[mid] == target) return (int)mid;
        if (arr[mid] < target) low = mid + 1;
        else if (mid == 0) break;
        else high = mid - 1;
    }
    return -1;
}

int main(void) {
    int data[] = {1, 3, 5, 7, 9, 11};
    int idx = binary_search(data, sizeof(data) / sizeof(data[0]), 7);
    printf("Target index: %d\\n", idx);
    return 0;
}
`;

export const CPP_STARTER = `/**
 * AI Code Review Platform — C++ Review Workspace
 * Modern RAII, STL algorithmic complexity, and exception safety.
 */

#include <iostream>
#include <vector>
#include <unordered_map>

class Solution {
public:
    std::vector<int> twoSum(const std::vector<int>& nums, int target) {
        std::unordered_map<int, int> seen;
        for (int i = 0; i < static_cast<int>(nums.size()); ++i) {
            int complement = target - nums[i];
            auto it = seen.find(complement);
            if (it != seen.end()) {
                return { it->second, i };
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};

int main() {
    Solution solver;
    std::vector<int> nums = {2, 7, 11, 15};
    auto result = solver.twoSum(nums, 9);
    for (int idx : result) std::cout << idx << " ";
    std::cout << "\\n";
    return 0;
}
`;

export const SUPPORTED_LANGUAGES = [
  {
    id: 'python',
    label: 'Python',
    monacoLang: 'python',
    defaultFileName: 'main.py',
    extensions: ['.py'],
    starterCode: PYTHON_STARTER
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    monacoLang: 'javascript',
    defaultFileName: 'index.js',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    starterCode: JAVASCRIPT_STARTER
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    monacoLang: 'typescript',
    defaultFileName: 'index.ts',
    extensions: ['.ts', '.tsx'],
    starterCode: TYPESCRIPT_STARTER
  },
  {
    id: 'java',
    label: 'Java',
    monacoLang: 'java',
    defaultFileName: 'Solution.java',
    extensions: ['.java'],
    starterCode: JAVA_STARTER
  },
  {
    id: 'c',
    label: 'C',
    monacoLang: 'c',
    defaultFileName: 'main.c',
    // Note: Ambiguous .h defaults to C; user can manually switch to C++ without losing code
    extensions: ['.c', '.h'],
    starterCode: C_STARTER
  },
  {
    id: 'cpp',
    label: 'C++',
    monacoLang: 'cpp',
    defaultFileName: 'solution.cpp',
    extensions: ['.cpp', '.hpp', '.cc', '.cxx'],
    starterCode: CPP_STARTER
  }
];

export const ALL_SUPPORTED_EXTENSIONS = [
  '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
  '.java', '.py', '.js', '.jsx', '.mjs', '.cjs',
  '.ts', '.tsx'
];

/**
 * Maps a filename to its supported language configuration.
 * Ambiguous .h files map to C by default.
 * @param {string} fileName
 * @returns {object|null}
 */
export function getLanguageFromFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') return null;

  const lowerName = fileName.toLowerCase().trim();
  const dotIndex = lowerName.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const ext = lowerName.slice(dotIndex);

  // Ambiguous .h defaults to C
  if (ext === '.h') {
    return SUPPORTED_LANGUAGES.find((l) => l.id === 'c') || null;
  }

  return (
    SUPPORTED_LANGUAGES.find((lang) => lang.extensions.includes(ext)) || null
  );
}

/**
 * Checks whether a given filename has a supported extension.
 * @param {string} fileName
 * @returns {boolean}
 */
export function isSupportedExtension(fileName) {
  if (!fileName || typeof fileName !== 'string') return false;
  const lowerName = fileName.toLowerCase().trim();
  const dotIndex = lowerName.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = lowerName.slice(dotIndex);
  return ALL_SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Formats a byte number to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Computes live editor telemetry: LOC, characters, and UTF-8 byte count.
 * @param {string} text
 * @returns {{ lines: number, chars: number, bytes: number }}
 */
export function computeTelemetry(text) {
  const safeText = typeof text === 'string' ? text : '';
  const lines = safeText.length === 0 ? 0 : safeText.split('\n').length;
  const chars = safeText.length;
  // Calculate UTF-8 byte length
  let bytes = 0;
  if (typeof TextEncoder !== 'undefined') {
    bytes = new TextEncoder().encode(safeText).length;
  } else {
    bytes = new Blob([safeText]).size;
  }
  return { lines, chars, bytes };
}
