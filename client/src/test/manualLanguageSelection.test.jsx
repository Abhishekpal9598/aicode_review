import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CodeReview from '../pages/CodeReview';
import apiClient from '../services/apiClient';

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

// Mock apiClient
vi.mock('../services/apiClient', () => ({
  default: {
    analyzeCode: vi.fn(),
    createReview: vi.fn(),
    getReviewById: vi.fn(),
    getReviews: vi.fn()
  },
  apiClient: {
    analyzeCode: vi.fn(),
    createReview: vi.fn(),
    getReviewById: vi.fn(),
    getReviews: vi.fn()
  }
}));

describe('Phase 8: Manual Programming Language Selection & Workspace Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  // Test 1: Default to Auto Detect
  it('1. Renders toolbar language selector with Auto Detect mode as default', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('language-selector-button')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor-container')).toBeInTheDocument();
    });

    const selectorButton = screen.getByTestId('language-selector-button');
    expect(selectorButton).toHaveTextContent(/Auto Detect/i);

    const badge = screen.getByTestId('language-status-badge');
    expect(badge).toHaveTextContent(/Auto Detected/i);

    const container = screen.getByTestId('monaco-editor-container');
    expect(container).toHaveAttribute('data-language', 'python');
  });

  // Test 2: Dropdown displays all 7 options in exact order
  it('2. Dropdown renders Auto Detect and all 6 languages in order (Auto Detect, C, C++, Java, Python, JavaScript, TypeScript)', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('language-selector-button')).toBeInTheDocument();
    });

    const selectorButton = screen.getByTestId('language-selector-button');
    fireEvent.click(selectorButton);

    const listbox = screen.getByTestId('language-selector-dropdown');
    expect(listbox).toBeInTheDocument();

    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(7);

    // Verify exact order
    expect(options[0]).toHaveTextContent(/Auto Detect/i);
    expect(options[1]).toHaveTextContent(/^C\b/);
    expect(options[2]).toHaveTextContent(/^C\+\+/);
    expect(options[3]).toHaveTextContent(/^Java\b/);
    expect(options[4]).toHaveTextContent(/^Python\b/);
    expect(options[5]).toHaveTextContent(/^JavaScript\b/);
    expect(options[6]).toHaveTextContent(/^TypeScript\b/);
  });

  // Test 3: Manual selection of C
  it('3. Selecting C manually updates Monaco language to c and switches badge to Manually Selected', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('language-selector-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-c'));

    const selectorButton = screen.getByTestId('language-selector-button');
    expect(selectorButton).toHaveTextContent(/^C\b/);

    expect(screen.getByTestId('language-status-badge')).toHaveTextContent(/Manually Selected/i);
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'c');
  });

  // Test 4: Manual selection of C++
  it('4. Selecting C++ manually updates Monaco language to cpp and updates starter template', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('language-selector-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-cpp'));

    expect(screen.getByTestId('language-selector-button')).toHaveTextContent(/C\+\+/);
    expect(screen.getByTestId('language-status-badge')).toHaveTextContent(/Manually Selected/i);
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'cpp');
  });

  // Test 5: Manual selection of Java
  it('5. Selecting Java manually updates Monaco language to java', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('language-selector-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-java'));

    expect(screen.getByTestId('language-selector-button')).toHaveTextContent(/^Java\b/);
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'java');
  });

  // Test 6: Manual selection of Python
  it('6. Selecting Python manually updates Monaco language to python', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('language-selector-button')).toBeInTheDocument();
    });

    // First select Java
    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-java'));

    // Then switch back to Python manually
    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-python'));

    expect(screen.getByTestId('language-selector-button')).toHaveTextContent(/^Python\b/);
    expect(screen.getByTestId('language-status-badge')).toHaveTextContent(/Manually Selected/i);
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'python');
  });

  // Test 7: Manual selection of JavaScript
  it('7. Selecting JavaScript manually updates Monaco language to javascript', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('language-selector-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-javascript'));

    expect(screen.getByTestId('language-selector-button')).toHaveTextContent(/JavaScript/);
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'javascript');
  });

  // Test 8: Manual selection of TypeScript
  it('8. Selecting TypeScript manually updates Monaco language to typescript', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('language-selector-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-typescript'));

    expect(screen.getByTestId('language-selector-button')).toHaveTextContent(/TypeScript/);
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'typescript');
  });

  // Test 9: Manual selection strictly preserved while editing code
  it('9. Manual language selection is strictly preserved while editing code', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    // Select C++ manually
    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-cpp'));

    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'cpp');

    // Type Python-like code into editor
    const textarea = screen.getByTestId('monaco-editor-textarea');
    fireEvent.change(textarea, {
      target: {
        value: 'def calculate_sum(items):\n    return sum(items)\n'
      }
    });

    // Manual mode MUST remain C++
    expect(screen.getByTestId('language-selector-button')).toHaveTextContent(/C\+\+/);
    expect(screen.getByTestId('language-status-badge')).toHaveTextContent(/Manually Selected/i);
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'cpp');
  });

  // Test 10: Switch back to Auto Detect
  it('10. Allows user to switch back to Auto Detect mode from manual selection', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    // Choose C manually
    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-c'));
    expect(screen.getByTestId('language-status-badge')).toHaveTextContent(/Manually Selected/i);

    // Switch back to Auto Detect
    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-auto'));

    expect(screen.getByTestId('language-selector-button')).toHaveTextContent(/Auto Detect/i);
    expect(screen.getByTestId('language-status-badge')).toHaveTextContent(/Auto Detected/i);
  });

  // Test 11: Submits manual language to static analysis and review endpoints
  it('11. Passes manual language to apiClient.analyzeCode and apiClient.createReview', async () => {
    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: {
        transient: true,
        findings: [],
        scoring: { overallScore: 100 }
      }
    });

    apiClient.createReview.mockResolvedValueOnce({
      success: true,
      data: {
        review: { _id: 'rev_123', language: 'c' },
        analysis: {},
        issues: []
      }
    });

    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    // Select C manually
    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-c'));

    // Trigger Analyze
    const analyzeBtn = screen.getByRole('button', { name: /Analyze Code/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(apiClient.analyzeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'c'
        })
      );
    });

    // Trigger Review
    const reviewBtn = screen.getByRole('button', { name: /Submit AI Review/i });
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(apiClient.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'c'
        })
      );
    });
  });

  // Test 12: Preserves user-modified code when switching manual language
  it('12. Preserves custom user code buffer when switching languages manually after editing', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const customCode = 'int my_custom_var = 42; // Do not wipe this';
    const textarea = screen.getByTestId('monaco-editor-textarea');
    fireEvent.change(textarea, { target: { value: customCode } });

    // Switch to C++
    fireEvent.click(screen.getByTestId('language-selector-button'));
    fireEvent.click(screen.getByTestId('language-option-cpp'));

    // Textarea must preserve the custom code buffer exactly
    expect(screen.getByTestId('monaco-editor-textarea')).toHaveValue(customCode);
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'cpp');
  });
});
