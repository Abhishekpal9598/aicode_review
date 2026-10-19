import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Reports from '../pages/Reports';
import apiClient from '../services/apiClient';

// Mock apiClient methods
vi.mock('../services/apiClient', () => ({
  default: {
    getReviews: vi.fn(),
    exportReview: vi.fn()
  }
}));

describe('Phase 13: Audit Reports & Multi-Format Exporters Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockReviewsList = [
    {
      _id: '507f1f77bcf86cd799439011',
      title: 'Authentication Security Audit',
      filename: 'auth.py',
      language: 'python'
    },
    {
      _id: '507f1f77bcf86cd799439022',
      title: 'Clean Utility Module',
      filename: 'utils.js',
      language: 'javascript'
    }
  ];

  const mockExportJson = {
    exportMetadata: {
      version: '1.0.0',
      exportedAt: '2026-10-19T08:00:00.000Z',
      generator: 'AI Code Review Platform — Audit Exporter'
    },
    review: {
      id: '507f1f77bcf86cd799439011',
      title: 'Authentication Security Audit',
      filename: 'auth.py',
      language: 'python',
      lineCount: 15,
      createdAt: '2026-10-19T07:30:00.000Z'
    },
    qualityScore: {
      overall: 82,
      grade: 'B',
      securityScore: 70,
      performanceScore: 94
    },
    algorithmicComplexity: {
      timeComplexity: 'O(1)',
      spaceComplexity: 'O(1)',
      complexityType: 'deterministic'
    },
    summary: 'Dynamic string concatenation exposes login function to authentication bypass via SQL Injection.',
    severityBreakdown: {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 0,
      LOW: 1,
      INFO: 0
    },
    findings: {
      total: 2,
      security: [
        {
          id: 'sec-1',
          ruleId: 'SEC-PY-SQL-002',
          category: 'security',
          severity: 'HIGH',
          title: 'SQL Injection via String Concatenation',
          description: 'Dynamic query built with string interpolation.',
          lineStart: 6,
          lineEnd: 7,
          cwe: 'CWE-89',
          owaspCategory: 'A03:2021-Injection',
          confidence: 'HIGH',
          remediation: 'Use parameterized queries.'
        }
      ],
      performance: [
        {
          id: 'perf-1',
          ruleId: 'PERF-PY-001',
          category: 'performance',
          severity: 'LOW',
          title: 'Database Cursor Reinitialization',
          explanation: 'Cursor initialization overhead.',
          lineStart: 3,
          lineEnd: 3,
          complexityEstimate: 'O(1)',
          remediation: 'Reuse shared cursor.'
        }
      ]
    },
    appliedFixes: [
      {
        ruleId: 'SEC-PY-SQL-002',
        lineStart: 6,
        lineEnd: 7,
        previousSnippet: 'cursor.execute(query)',
        appliedSnippet: 'cursor.execute("SELECT * FROM users WHERE id = ?", (uid,))',
        appliedAt: '2026-10-19T07:45:00.000Z'
      }
    ],
    code: {
      original: 'def login(): pass',
      current: 'def login(): query = ?',
      hasModifications: true,
      diffSummary: {
        addedLines: 2,
        removedLines: 1,
        unchangedLines: 13
      }
    }
  };

  const mockExportMarkdown = `# AI Code Review — Audit & Security Inspection Report
> **Target File:** \`auth.py\` (\`python\`)
> **Review ID:** \`507f1f77bcf86cd799439011\`
> **Overall Quality:** **Grade B** (82 / 100)
## 1. Executive Summary
Dynamic string concatenation exposes login function.
`;

  // TEST 1: Renders Page and Dropdown with Pre-selected Review via query parameter
  it('Test 1 (Review Selection & Dropdown): preselects review from URL query and populates dropdown options', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });

    apiClient.exportReview.mockImplementation((id, format) => {
      if (format === 'markdown') return Promise.resolve(mockExportMarkdown);
      return Promise.resolve(mockExportJson);
    });

    render(
      <MemoryRouter initialEntries={['/reports?reviewId=507f1f77bcf86cd799439011']}>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('report-review-selector')).toBeInTheDocument();
    });

    const selector = screen.getByTestId('report-review-selector');
    expect(selector.value).toBe('507f1f77bcf86cd799439011');
    expect(screen.getByRole('heading', { name: /Authentication Security Audit/ })).toBeInTheDocument();
  });

  // TEST 2: Renders Quality Score, Grade, and Executive Summary
  it('Test 2 (Report Header & Summary): displays score, letter grade pill, and executive summary', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });

    apiClient.exportReview.mockImplementation((id, format) => {
      if (format === 'markdown') return Promise.resolve(mockExportMarkdown);
      return Promise.resolve(mockExportJson);
    });

    render(
      <MemoryRouter initialEntries={['/reports?reviewId=507f1f77bcf86cd799439011']}>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('audit-report-document')).toBeInTheDocument();
    });

    expect(screen.getByText('Grade B')).toBeInTheDocument();
    expect(screen.getByText('(82%)')).toBeInTheDocument();
    expect(screen.getByText(/Dynamic string concatenation exposes login function/)).toBeInTheDocument();
  });

  // TEST 3: Renders Security Findings Table with CWE, OWASP, and Remediation
  it('Test 3 (Security Findings Table): renders security findings with CWE link, OWASP category, and remediation', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });

    apiClient.exportReview.mockImplementation((id, format) => {
      if (format === 'markdown') return Promise.resolve(mockExportMarkdown);
      return Promise.resolve(mockExportJson);
    });

    render(
      <MemoryRouter initialEntries={['/reports?reviewId=507f1f77bcf86cd799439011']}>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/SQL Injection via String Concatenation/)).toBeInTheDocument();
    });

    expect(screen.getAllByText('SEC-PY-SQL-002').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('CWE-89')).toBeInTheDocument();
    expect(screen.getByText('A03:2021-Injection')).toBeInTheDocument();
    expect(screen.getByText(/Use parameterized queries\./)).toBeInTheDocument();
  });

  // TEST 4: Renders Performance Analysis & Complexity Badges
  it('Test 4 (Performance Complexity): renders Big-O metrics and bottleneck cards', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });

    apiClient.exportReview.mockImplementation((id, format) => {
      if (format === 'markdown') return Promise.resolve(mockExportMarkdown);
      return Promise.resolve(mockExportJson);
    });

    render(
      <MemoryRouter initialEntries={['/reports?reviewId=507f1f77bcf86cd799439011']}>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('3. Algorithmic Performance & Complexity Analysis')).toBeInTheDocument();
    });

    expect(screen.getByText('Line 3: Database Cursor Reinitialization')).toBeInTheDocument();
  });

  // TEST 5: Renders Applied Fixes History Table
  it('Test 5 (Applied Fixes History): renders applied fixes with rule ID, coordinates, and snippet', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });

    apiClient.exportReview.mockImplementation((id, format) => {
      if (format === 'markdown') return Promise.resolve(mockExportMarkdown);
      return Promise.resolve(mockExportJson);
    });

    render(
      <MemoryRouter initialEntries={['/reports?reviewId=507f1f77bcf86cd799439011']}>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('4. Applied Fixes History (1)')).toBeInTheDocument();
    });

    expect(screen.getByText('6 - 7')).toBeInTheDocument();
    expect(screen.getByText(/cursor\.execute/)).toBeInTheDocument();
  });

  // TEST 6: Trigger Download Actions for JSON and Markdown
  it('Test 6 (Download Actions): clicking JSON and Markdown download triggers browser download creation', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });

    apiClient.exportReview.mockImplementation((id, format) => {
      if (format === 'markdown') return Promise.resolve(mockExportMarkdown);
      return Promise.resolve(mockExportJson);
    });

    // Mock URL.createObjectURL and URL.revokeObjectURL
    const createObjectUrlMock = vi.fn().mockReturnValue('blob:http://localhost/test-blob');
    const revokeObjectUrlMock = vi.fn();
    global.URL.createObjectURL = createObjectUrlMock;
    global.URL.revokeObjectURL = revokeObjectUrlMock;

    render(
      <MemoryRouter initialEntries={['/reports?reviewId=507f1f77bcf86cd799439011']}>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('download-json-button')).toBeEnabled();
    });

    // Click JSON download
    fireEvent.click(screen.getByTestId('download-json-button'));
    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(screen.getByText('JSON report downloaded successfully')).toBeInTheDocument();

    // Click Markdown download
    fireEvent.click(screen.getByTestId('download-markdown-button'));
    expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Markdown report downloaded successfully')).toBeInTheDocument();
  });

  // TEST 7: Trigger Print Action
  it('Test 7 (Print Action): clicking Print / PDF calls window.print', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });

    apiClient.exportReview.mockImplementation((id, format) => {
      if (format === 'markdown') return Promise.resolve(mockExportMarkdown);
      return Promise.resolve(mockExportJson);
    });

    const printSpy = vi.fn();
    window.print = printSpy;

    render(
      <MemoryRouter initialEntries={['/reports?reviewId=507f1f77bcf86cd799439011']}>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('print-report-button')).toBeEnabled();
    });

    fireEvent.click(screen.getByTestId('print-report-button'));
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  // TEST 8: Handles Empty Account State (Zero Reviews)
  it('Test 8 (Zero Reviews State): renders informative empty state when user has no reviews', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: []
    });

    render(
      <MemoryRouter initialEntries={['/reports']}>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No Audit Reports Found')).toBeInTheDocument();
    });

    expect(screen.getByText('Launch Review Workspace')).toBeInTheDocument();
  });

  // TEST 9: Handles 404 / Network Error Gracefully
  it('Test 9 (Error Handling): renders dismissible alert banner when report API returns an error', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });

    const notFoundError = new Error('Review not found');
    notFoundError.status = 404;
    apiClient.exportReview.mockRejectedValue(notFoundError);

    render(
      <MemoryRouter initialEntries={['/reports?reviewId=507f1f77bcf86cd799439011']}>
        <Reports />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Review not found')).toBeInTheDocument();

    // Dismiss error
    fireEvent.click(screen.getByLabelText('Dismiss error'));
    expect(screen.queryByText('Review not found')).not.toBeInTheDocument();
  });
});
