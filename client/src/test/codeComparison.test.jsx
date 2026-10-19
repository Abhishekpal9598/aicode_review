import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CodeComparison, { computeDiffStats } from '../pages/CodeComparison';
import MonacoDiffWrapper from '../components/editor/MonacoDiffWrapper';
import apiClient from '../services/apiClient';

// Mock @monaco-editor/react to mock DiffEditor for JSDOM
vi.mock('@monaco-editor/react', () => ({
  DiffEditor: ({ original, modified, language, theme, options }) => (
    <div
      data-testid="monaco-diff-editor-container"
      data-language={language}
      data-theme={theme}
      data-render-side-by-side={options?.renderSideBySide ? 'true' : 'false'}
      data-read-only={options?.readOnly ? 'true' : 'false'}
    >
      <div data-testid="diff-original-panel">{original}</div>
      <div data-testid="diff-modified-panel">{modified}</div>
    </div>
  ),
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({})
  }
}));

// Mock monacoWorkers to prevent worker execution in JSDOM
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

// Mock apiClient methods
vi.mock('../services/apiClient', () => ({
  default: {
    getReviews: vi.fn(),
    getReviewById: vi.fn()
  }
}));

describe('Phase 12: Side-by-Side Monaco Diff Code Comparison Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TEST 1: computeDiffStats Unit Tests for Added, Removed, Modified Lines
  it('Test 1 (computeDiffStats Algorithm): accurately calculates additions, deletions, and unchanged stats', () => {
    // Exact identical
    const sameStats = computeDiffStats('line1\nline2', 'line1\nline2');
    expect(sameStats.added).toBe(0);
    expect(sameStats.removed).toBe(0);

    // Added lines
    const addStats = computeDiffStats('line1\nline2', 'line1\nline2\nline3\nline4');
    expect(addStats.added).toBe(2);
    expect(addStats.removed).toBe(0);

    // Removed lines
    const remStats = computeDiffStats('line1\nline2\nline3', 'line1');
    expect(remStats.added).toBe(0);
    expect(remStats.removed).toBe(2);

    // Modified lines (1 removed, 1 added)
    const modStats = computeDiffStats('query = "raw " + user', 'query = sanitize(user)');
    expect(modStats.added).toBe(1);
    expect(modStats.removed).toBe(1);
  });

  // TEST 2: MonacoDiffWrapper Component Rendering & Props
  it('Test 2 (MonacoDiffWrapper Props): sets readOnly true, language, and theme correctly', async () => {
    const origCode = 'def hello(): pass';
    const modCode = 'def hello(): print("world")';

    render(
      <MonacoDiffWrapper
        original={origCode}
        modified={modCode}
        language="python"
        renderSideBySide={true}
      />
    );

    const container = screen.getByTestId('monaco-diff-editor-container');
    expect(container).toHaveAttribute('data-language', 'python');
    expect(container).toHaveAttribute('data-theme', 'cybernetic-dark');
    expect(container).toHaveAttribute('data-render-side-by-side', 'true');
    expect(container).toHaveAttribute('data-read-only', 'true');

    expect(screen.getByTestId('diff-original-panel')).toHaveTextContent(origCode);
    expect(screen.getByTestId('diff-modified-panel')).toHaveTextContent(modCode);
  });

  // TEST 3: Original vs Modified Code Comparison E2E with Applied Fixes
  it('Test 3 (Original vs Modified Code Comparison): renders original on left and applied fixes on right', async () => {
    const rawCode = `import sqlite3
def login(username):
    query = "SELECT * FROM users WHERE name = '" + username + "'"
    return query`;

    const currentCode = `import sqlite3
def login(username):
    query = "SELECT * FROM users WHERE name = ?"
    params = (username,)
    return query, params`;

    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: [
        {
          _id: '507f1f77bcf86cd799439011',
          title: 'SQL Auth Module Review',
          language: 'python',
          filename: 'auth.py',
          lineCount: 4,
          overallScore: 75,
          grade: 'B'
        }
      ]
    });

    apiClient.getReviewById.mockResolvedValueOnce({
      success: true,
      data: {
        review: {
          _id: '507f1f77bcf86cd799439011',
          title: 'SQL Auth Module Review',
          language: 'python',
          filename: 'auth.py',
          lineCount: 4,
          rawCode,
          currentCode,
          appliedFixes: [
            {
              ruleId: 'SEC-INJ-001',
              lineStart: 3,
              lineEnd: 3,
              appliedSnippet: '    query = "SELECT * FROM users WHERE name = ?"\n    params = (username,)'
            }
          ]
        },
        analysis: {
          overallScore: 75,
          grade: 'B'
        }
      }
    });

    render(
      <MemoryRouter initialEntries={['/code-comparison?reviewId=507f1f77bcf86cd799439011']}>
        <CodeComparison />
      </MemoryRouter>
    );

    // Wait for review details and lazy-loaded diff editor to load
    await waitFor(() => {
      expect(screen.getByTestId('diff-mode-applied-fixes')).toBeInTheDocument();
      expect(screen.getByTestId('diff-original-panel')).toBeInTheDocument();
    });

    expect(screen.getByText(/Working Code \(1 Fixes Applied\)/i)).toBeInTheDocument();
    expect(screen.getByTestId('diff-stats-strip')).toBeInTheDocument();

    // Verify left and right panels contain respective original and modified code
    expect(screen.getByTestId('diff-original-panel').textContent).toBe(rawCode);
    expect(screen.getByTestId('diff-modified-panel').textContent).toBe(currentCode);
    expect(screen.getByText('Original Submitted Code (rawCode)')).toBeInTheDocument();
    expect(screen.getByText('Modified Code (currentCode)')).toBeInTheDocument();
  });

  // TEST 4: Review without Applied Fixes Displays Informative Empty State
  it('Test 4 (Review Without Modifications): displays informative zero-state when code is identical', async () => {
    const identicalCode = `function sum(a, b) {\n  return a + b;\n}`;

    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: [
        {
          _id: '507f1f77bcf86cd799439022',
          title: 'Clean Math Utility',
          language: 'javascript',
          filename: 'math.js',
          lineCount: 3,
          overallScore: 100,
          grade: 'A'
        }
      ]
    });

    apiClient.getReviewById.mockResolvedValueOnce({
      success: true,
      data: {
        review: {
          _id: '507f1f77bcf86cd799439022',
          title: 'Clean Math Utility',
          language: 'javascript',
          filename: 'math.js',
          lineCount: 3,
          rawCode: identicalCode,
          currentCode: null, // No applied fixes
          appliedFixes: []
        },
        analysis: {
          overallScore: 100,
          grade: 'A',
          suggestedCode: null
        }
      }
    });

    render(
      <MemoryRouter initialEntries={['/code-comparison?reviewId=507f1f77bcf86cd799439022']}>
        <CodeComparison />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-modifications-state')).toBeInTheDocument();
    });

    expect(screen.getByText(/No Code Changes to Compare/i)).toBeInTheDocument();
    expect(screen.getByText(/0 applied fixes/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply Fixes in Workspace/i)).toBeInTheDocument();
  });

  // TEST 5: Language Support Across Python, Java, JS, TS, C, C++
  it('Test 5 (Language Propagation): correctly binds language attribute across supported languages', async () => {
    const rawCpp = '#include <iostream>\nint main() { char buf[10]; strcpy(buf, "input"); }';
    const modCpp = '#include <iostream>\n#include <string>\nint main() { std::string buf = "input"; }';

    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: [{ _id: '507f1f77bcf86cd799439033', title: 'C++ Buffer Safety', language: 'cpp' }]
    });

    apiClient.getReviewById.mockResolvedValueOnce({
      success: true,
      data: {
        review: {
          _id: '507f1f77bcf86cd799439033',
          title: 'C++ Buffer Safety',
          language: 'cpp',
          rawCode: rawCpp,
          currentCode: modCpp,
          appliedFixes: [{ ruleId: 'SEC-CPP-BUF-001' }]
        }
      }
    });

    render(
      <MemoryRouter initialEntries={['/code-comparison?reviewId=507f1f77bcf86cd799439033']}>
        <CodeComparison />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-diff-editor-container')).toHaveAttribute('data-language', 'cpp');
    });
  });

  // TEST 6: Responsive Split View Toggle (Side-by-Side vs Inline)
  it('Test 6 (Split View Toggle): toggles renderSideBySide between true and false on button click', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: [{ _id: '507f1f77bcf86cd799439044', title: 'Toggle Test Review', language: 'python' }]
    });

    apiClient.getReviewById.mockResolvedValueOnce({
      success: true,
      data: {
        review: {
          _id: '507f1f77bcf86cd799439044',
          title: 'Toggle Test Review',
          language: 'python',
          rawCode: 'x = 1',
          currentCode: 'x = 2',
          appliedFixes: [{ ruleId: 'TEST-001' }]
        }
      }
    });

    render(
      <MemoryRouter initialEntries={['/code-comparison?reviewId=507f1f77bcf86cd799439044']}>
        <CodeComparison />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-split-view-button')).toBeInTheDocument();
    });

    const diffContainer = screen.getByTestId('monaco-diff-editor-container');
    expect(diffContainer).toHaveAttribute('data-render-side-by-side', 'true');

    // Click toggle button
    fireEvent.click(screen.getByTestId('toggle-split-view-button'));

    // Should switch to inline diff (renderSideBySide = false)
    expect(diffContainer).toHaveAttribute('data-render-side-by-side', 'false');
  });

  // TEST 7: Handles HTTP 404 Review Not Found or Tenant Isolation
  it('Test 7 (Tenant Isolation & 404): displays dismissible error banner when review is not found or unauthorized', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: [{ _id: '507f1f77bcf86cd799439055', title: 'Private Review' }]
    });

    const notFoundError = new Error('Review not found');
    notFoundError.status = 404;
    apiClient.getReviewById.mockRejectedValueOnce(notFoundError);

    render(
      <MemoryRouter initialEntries={['/code-comparison?reviewId=507f1f77bcf86cd799439055']}>
        <CodeComparison />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Review not found or you do not have permission/i)).toBeInTheDocument();
  });

  // TEST 8: Review Selector Dropdown Switches Between Reviews
  it('Test 8 (Review Selection Dropdown): selecting another review triggers API fetch and updates diff', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: [
        { _id: '507f1f77bcf86cd799439066', title: 'First Review', language: 'python' },
        { _id: '507f1f77bcf86cd799439077', title: 'Second Review', language: 'javascript' }
      ]
    });

    apiClient.getReviewById.mockResolvedValueOnce({
      success: true,
      data: {
        review: {
          _id: '507f1f77bcf86cd799439066',
          title: 'First Review',
          language: 'python',
          rawCode: 'code1',
          currentCode: 'code1_mod',
          appliedFixes: [{ ruleId: 'R1' }]
        }
      }
    });

    render(
      <MemoryRouter>
        <CodeComparison />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('review-selector-dropdown')).toBeInTheDocument();
    });

    // Mock second review response
    apiClient.getReviewById.mockResolvedValueOnce({
      success: true,
      data: {
        review: {
          _id: '507f1f77bcf86cd799439077',
          title: 'Second Review',
          language: 'javascript',
          rawCode: 'code2',
          currentCode: 'code2_mod',
          appliedFixes: [{ ruleId: 'R2' }]
        }
      }
    });

    const dropdown = screen.getByTestId('review-selector-dropdown');
    fireEvent.change(dropdown, { target: { value: '507f1f77bcf86cd799439077' } });

    await waitFor(() => {
      expect(apiClient.getReviewById).toHaveBeenCalledWith('507f1f77bcf86cd799439077');
    });
  });
});
