import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CodeReview from '../pages/CodeReview';
import {
  detectLanguageFromContent,
  detectLanguageFromExtension,
  detectLanguage,
  CONFIDENCE_LEVELS
} from '../services/languageDetector';
import { SUPPORTED_LANGUAGES } from '../utils/languageMap';

// Mock monaco-editor and @monaco-editor/react for JSDOM
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language, theme, onChange, options }) => (
    <div
      data-testid="monaco-editor-container"
      data-language={language}
      data-theme={theme}
      data-font={options?.fontFamily}
    >
      <textarea
        data-testid="monaco-editor-textarea"
        aria-label="Code Editor"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
      />
    </div>
  ),
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({})
  }
}));

// Mock monacoWorkers
vi.mock('../config/monacoWorkers', () => ({
  configureMonaco: vi.fn(),
  monaco: {
    editor: {
      defineTheme: vi.fn(),
      setTheme: vi.fn()
    }
  },
  default: vi.fn()
}));

describe('Smart Programming Language Detection Service (Unit Tests)', () => {
  // 1. Python Detection
  it('detects Python code with HIGH confidence', () => {
    const code = `
"""Module docstring"""
import os
import sys

def calculate_sum(items: list) -> int:
    total = 0
    for item in items:
        total += item
    return total

if __name__ == "__main__":
    print(calculate_sum([1, 2, 3]))
`;
    const result = detectLanguageFromContent(code);
    expect(result.language).toBe('python');
    expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    expect(result.scores.python).toBeGreaterThan(20);
  });

  // 2. JavaScript Detection
  it('detects JavaScript code with HIGH confidence and distinguishes from TypeScript', () => {
    const code = `
const debounce = (fn, delay = 300) => {
  let timerId = null;
  return function (...args) {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn.apply(this, args);
      console.log('Debounced call completed');
    }, delay);
  };
};

module.exports = { debounce };
`;
    const result = detectLanguageFromContent(code);
    expect(result.language).toBe('javascript');
    expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    expect(result.scores.javascript).toBeGreaterThan(result.scores.typescript);
  });

  // 3. TypeScript Detection
  it('detects TypeScript code with HIGH confidence when type annotations and interfaces exist', () => {
    const code = `
interface UserProfile {
  id: string;
  username: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

export function formatUser(user: UserProfile): string {
  const adminTag = user.role as string;
  return user.username + ':' + adminTag;
}
`;
    const result = detectLanguageFromContent(code);
    expect(result.language).toBe('typescript');
    expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    expect(result.scores.typescript).toBeGreaterThan(result.scores.javascript);
  });

  // 4. Java Detection
  it('detects Java code with HIGH confidence', () => {
    const code = `
package com.aicode.example;

import java.util.ArrayList;
import java.util.List;

public class Solution {
    public static void main(String[] args) {
        System.out.println("Processing numbers...");
        List<String> list = new ArrayList<>();
    }
}
`;
    const result = detectLanguageFromContent(code);
    expect(result.language).toBe('java');
    expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    expect(result.scores.java).toBeGreaterThan(20);
  });

  // 5. C Detection
  it('detects C code with HIGH confidence and avoids C++ false positives', () => {
    const code = `
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char** argv) {
    int* buffer = (int*)malloc(10 * sizeof(int));
    if (buffer == NULL) return 1;
    printf("Allocated memory successfully\\n");
    free(buffer);
    return 0;
}
`;
    const result = detectLanguageFromContent(code);
    expect(result.language).toBe('c');
    expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    expect(result.scores.c).toBeGreaterThan(result.scores.cpp);
  });

  // 6. C++ Detection
  it('detects C++ code with HIGH confidence using stream operators, std:: and classes', () => {
    const code = `
#include <iostream>
#include <vector>
#include <string>

using namespace std;

class Solution {
public:
    std::vector<int> process(const std::vector<int>& data) {
        cout << "Items: " << data.size() << endl;
        return data;
    }
};

int main() {
    Solution s;
    return 0;
}
`;
    const result = detectLanguageFromContent(code);
    expect(result.language).toBe('cpp');
    expect(result.confidence).toBe(CONFIDENCE_LEVELS.HIGH);
    expect(result.scores.cpp).toBeGreaterThan(result.scores.c);
  });

  // 7. File Extension Detection
  it('maps all standard file extensions accurately', () => {
    expect(detectLanguageFromExtension('main.py').language).toBe('python');
    expect(detectLanguageFromExtension('index.js').language).toBe('javascript');
    expect(detectLanguageFromExtension('App.jsx').language).toBe('javascript');
    expect(detectLanguageFromExtension('service.ts').language).toBe('typescript');
    expect(detectLanguageFromExtension('Component.tsx').language).toBe('typescript');
    expect(detectLanguageFromExtension('Solution.java').language).toBe('java');
    expect(detectLanguageFromExtension('program.c').language).toBe('c');
    expect(detectLanguageFromExtension('main.cpp').language).toBe('cpp');
    expect(detectLanguageFromExtension('driver.cc').language).toBe('cpp');
    expect(detectLanguageFromExtension('solver.cxx').language).toBe('cpp');
    expect(detectLanguageFromExtension('header.hpp').language).toBe('cpp');
  });

  // 8. Ambiguous .h Header Disambiguation
  it('disambiguates .h header between C and C++ based on content inspection', () => {
    const cppHeader = `
#include <iostream>
class Buffer {
public:
    std::string name;
};
`;
    const cHeader = `
#include <stdio.h>
struct Node {
    int data;
    struct Node* next;
};
`;
    expect(detectLanguageFromExtension('buffer.h', cppHeader).language).toBe('cpp');
    expect(detectLanguageFromExtension('node.h', cHeader).language).toBe('c');
    expect(detectLanguageFromExtension('header.h').language).toBe('c'); // defaults to C when empty
  });

  // 9. Unknown Extension & Ambiguous Code Detection
  it('returns UNCERTAIN for unknown extensions or ambiguous short code', () => {
    expect(detectLanguageFromExtension('file.unknown').language).toBeNull();
    expect(detectLanguageFromExtension('file.unknown').confidence).toBe(CONFIDENCE_LEVELS.UNCERTAIN);

    const emptyResult = detectLanguageFromContent('');
    expect(emptyResult.language).toBeNull();
    expect(emptyResult.confidence).toBe(CONFIDENCE_LEVELS.UNCERTAIN);

    const shortResult = detectLanguageFromContent('x = 10;');
    expect(shortResult.confidence).toBe(CONFIDENCE_LEVELS.UNCERTAIN);
    expect(shortResult.isAmbiguous).toBe(true);
  });
});

describe('Auto Detect & Manual Selection UI Integration (Component Tests)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  // 10. Auto Detect is Default & Renders Status Badge
  it('defaults to Auto Detect mode with Auto Detected status badge on starter Python template', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-container')).toBeInTheDocument();
    });

    // Language selector shows Auto Detect (Python)
    const selectorButton = screen.getByLabelText(/Select programming language/i);
    expect(selectorButton).toHaveTextContent(/Auto Detect/i);
    expect(selectorButton).toHaveTextContent(/Python/i);

    // Status badge shows Auto Detected
    const badge = screen.getByTestId('language-status-badge');
    expect(badge).toHaveTextContent(/Auto Detected/i);
  });

  // 11. Pasting code in Auto Detect mode switches language automatically
  it('automatically detects and switches Monaco language mode when JavaScript code is pasted', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('monaco-editor-textarea');
    const jsSnippet = `
function calculateFactorial(n) {
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  console.log('Result is:', result);
  return result;
}
`;

    fireEvent.change(textarea, { target: { value: jsSnippet } });

    // Selector should now reflect Auto Detect (JavaScript)
    const selectorButton = screen.getByLabelText(/Select programming language/i);
    expect(selectorButton).toHaveTextContent(/Auto Detect/i);
    expect(selectorButton).toHaveTextContent(/JavaScript/i);

    // Monaco container language should now be javascript
    const container = screen.getByTestId('monaco-editor-container');
    expect(container).toHaveAttribute('data-language', 'javascript');
  });

  // 12. Manual Selection Overrides Auto Detect
  it('allows manual language selection that strictly overrides automatic detection', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const selectorButton = screen.getByLabelText(/Select programming language/i);
    fireEvent.click(selectorButton);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    // Select Java manually (use exact regex to distinguish from JavaScript)
    const javaOption = within(listbox).getByRole('option', { name: /^Java\b/i });
    fireEvent.click(javaOption);

    // Selector now displays Java
    expect(selectorButton).toHaveTextContent('Java');

    // Status badge switches to Manually Selected
    const badge = screen.getByTestId('language-status-badge');
    expect(badge).toHaveTextContent(/Manually Selected/i);

    // Now type Python code into the editor
    const textarea = screen.getByTestId('monaco-editor-textarea');
    fireEvent.change(textarea, {
      target: {
        value: `
def my_python_func():
    print("This is Python code")
`
      }
    });

    // Manual selection MUST NOT be overridden automatically
    expect(selectorButton).toHaveTextContent('Java');
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'java');
  });

  // 13. User can switch back to Auto Detect from Manual selection
  it('allows user to switch back to Auto Detect mode from manual selection', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const selectorButton = screen.getByLabelText(/Select programming language/i);
    fireEvent.click(selectorButton);

    // Choose TypeScript manually
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByRole('option', { name: /TypeScript/i }));

    expect(screen.getByTestId('language-status-badge')).toHaveTextContent(/Manually Selected/i);

    // Open dropdown again and click Auto Detect
    fireEvent.click(selectorButton);
    const updatedListbox = screen.getByRole('listbox');
    const autoOption = within(updatedListbox).getByRole('option', { name: /Auto Detect/i });
    fireEvent.click(autoOption);

    // Mode is back to Auto Detect
    expect(selectorButton).toHaveTextContent(/Auto Detect/i);
    expect(screen.getByTestId('language-status-badge')).toHaveTextContent(/Auto Detected/i);
  });
});
