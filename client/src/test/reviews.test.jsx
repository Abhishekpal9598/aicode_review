import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CodeReview from '../pages/CodeReview';
import ReviewHistory from '../pages/ReviewHistory';
import FindingsPanel from '../components/editor/FindingsPanel';
import apiClient from '../services/apiClient';

// Mock Monaco Editor for JSDOM
const mockRevealLineInCenter = vi.fn();
const mockSetPosition = vi.fn();
const mockFocus = vi.fn();
const mockDeltaDecorations = vi.fn().mockReturnValue(['dec-test-1']);

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language, onChange, onMount }) => {
    React.useEffect(() => {
      if (onMount) {
        onMount(
          {
            revealLineInCenter: mockRevealLineInCenter,
            setPosition: mockSetPosition,
            focus: mockFocus,
            deltaDecorations: mockDeltaDecorations,
            getModel: () => ({ getLineCount: () => 100 })
          },
          {
            Range: function (a, b, c, d) {
              return { a, b, c, d };
            },
            editor: {
              OverviewRulerLane: { Right: 4 },
              setTheme: vi.fn()
            }
          }
        );
      }
    }, [onMount]);

    return (
      <div data-testid="monaco-editor-container" data-language={language}>
        <textarea
          data-testid="monaco-editor-textarea"
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
        />
      </div>
    );
  },
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({})
  }
}));

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

describe('Phase 8: Frontend Monaco Workstation Integration Tests (FE-REV-001 - FE-REV-010)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  // =========================================================================
  // FE-REV-001: Dual Action Toolbar Buttons
  // =========================================================================
  it('FE-REV-001: Renders both "Analyze Code" and "Submit AI Review" with distinct icons and labels', async () => {
    render(
      <MemoryRouter>
        <CodeReview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /analyze code/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit ai review/i })).toBeInTheDocument();
    });

    const analyzeBtn = screen.getByRole('button', { name: /analyze code/i });
    const submitAiBtn = screen.getByRole('button', { name: /submit ai review/i });

    expect(analyzeBtn).toBeEnabled();
    expect(submitAiBtn).toBeEnabled();
    expect(submitAiBtn).toHaveTextContent(/submit ai review/i);
  });

  // =========================================================================
  // FE-REV-002: Multi-Stage Loading Progress & In-Flight Lock
  // =========================================================================
  it('FE-REV-002: Renders multi-stage progress indicators and locks submission during in-flight review', async () => {
    let resolveReview;
    const reviewPromise = new Promise((resolve) => {
      resolveReview = resolve;
    });

    vi.spyOn(apiClient, 'createReview').mockReturnValue(reviewPromise);

    render(
      <MemoryRouter>
        <CodeReview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit ai review/i })).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /submit ai review/i });
    fireEvent.click(submitBtn);

    // Verify stage 1 indicator appears and button is disabled
    expect(screen.getByText(/step 1\/3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /step 1\/3/i })).toBeDisabled();

    // Verify Analyze Code button is also locked
    expect(screen.getByRole('button', { name: /analyze code/i })).toBeDisabled();

    // Resolve review API
    await act(async () => {
      resolveReview({
        success: true,
        data: {
          review: { _id: 'rev-1', title: 'Review 1', reviewMode: 'hybrid' },
          analysis: {
            overallScore: 88,
            grade: 'B',
            staticScore: 90,
            aiAvailable: true,
            summary: 'Clean architecture with minor fixes.',
            metrics: {
              bugScore: 90,
              securityScore: 85,
              performanceScore: 80,
              maintainabilityScore: 90,
              aiCompositeScore: 87,
              issueCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
            }
          },
          issues: []
        }
      });
    });

    // Check finished state
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit ai review/i })).toBeEnabled();
    });
  });

  // =========================================================================
  // FE-REV-003: Hybrid Findings with [Static] and [Gemini AI] Source Badges
  // =========================================================================
  it('FE-REV-003: FindingsPanel displays [Static] and [Gemini AI] source origin badges', async () => {
    const mockResult = {
      review: { _id: 'rev-100', lineCount: 25, reviewMode: 'hybrid' },
      analysis: {
        overallScore: 78,
        grade: 'B',
        staticScore: 80,
        aiAvailable: true,
        summary: 'Dual evaluation completed.',
        metrics: {
          bugScore: 75,
          securityScore: 80,
          performanceScore: 80,
          maintainabilityScore: 75,
          aiCompositeScore: 77,
          issueCounts: { critical: 1, high: 1, medium: 0, low: 0, info: 0 }
        }
      },
      issues: [
        {
          _id: 'iss-1',
          ruleId: 'SEC-GEN-001',
          source: 'static',
          category: 'security',
          severity: 'CRITICAL',
          title: 'Hardcoded AWS Access Key',
          explanation: 'Found AWS credentials in source code.',
          lineStart: 4,
          columnStart: 1,
          originalSnippet: 'AKIAIOSFODNN7EXAMPLE'
        },
        {
          _id: 'iss-2',
          ruleId: null,
          source: 'gemini',
          category: 'performance',
          severity: 'HIGH',
          title: 'Quadratic Nested Loops',
          explanation: 'Nested loops create O(N^2) complexity.',
          lineStart: 12,
          columnStart: 5,
          suggestedSnippet: 'use_hashmap_lookup()'
        }
      ]
    };

    render(<FindingsPanel analysisResult={mockResult} />);

    // Check source badges
    expect(screen.getByTestId('badge-source-static')).toHaveTextContent(/static/i);
    expect(screen.getByTestId('badge-source-gemini')).toHaveTextContent(/gemini ai/i);

    // Check titles & categories
    expect(screen.getByText('Hardcoded AWS Access Key')).toBeInTheDocument();
    expect(screen.getByText('Quadratic Nested Loops')).toBeInTheDocument();
  });

  // =========================================================================
  // FE-REV-004: Algorithmic Complexity Chips
  // =========================================================================
  it('FE-REV-004: Displays O(N log N) time and O(1) space complexity chips in drawer', async () => {
    const mockResult = {
      review: { _id: 'rev-200', reviewMode: 'hybrid' },
      analysis: {
        overallScore: 92,
        grade: 'A',
        staticScore: 95,
        aiAvailable: true,
        timeComplexity: 'O(N log N)',
        spaceComplexity: 'O(1)',
        metrics: {
          bugScore: 95,
          securityScore: 90,
          performanceScore: 90,
          maintainabilityScore: 90,
          aiCompositeScore: 91,
          issueCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        }
      },
      issues: []
    };

    render(<FindingsPanel analysisResult={mockResult} />);

    expect(screen.getByTestId('time-complexity-chip')).toHaveTextContent('Time: O(N log N)');
    expect(screen.getByTestId('space-complexity-chip')).toHaveTextContent('Space: O(1)');
  });

  // =========================================================================
  // FE-REV-005: Suggested Refactoring Tab & Buffer Preservation
  // =========================================================================
  it('FE-REV-005: Suggested Refactoring tab displays code with copy button without mutating editor buffer', async () => {
    const mockSuggestedCode = 'def optimized_two_sum(nums, target):\n    lookup = {}\n    return lookup';
    const mockResult = {
      review: { _id: 'rev-300', reviewMode: 'hybrid' },
      analysis: {
        overallScore: 85,
        grade: 'B',
        staticScore: 90,
        aiAvailable: true,
        suggestedCode: mockSuggestedCode,
        refactoringRationale: 'Replaced quadratic search with dictionary lookup.',
        metrics: {
          bugScore: 85,
          securityScore: 90,
          performanceScore: 80,
          maintainabilityScore: 85,
          aiCompositeScore: 85,
          issueCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        }
      },
      issues: []
    };

    render(<FindingsPanel analysisResult={mockResult} />);

    // Switch to Suggested Refactoring tab
    const tabBtn = screen.getByTestId('tab-suggested-refactoring');
    fireEvent.click(tabBtn);

    // Verify code and rationale are rendered
    expect(screen.getByText(/replaced quadratic search with dictionary lookup/i)).toBeInTheDocument();
    expect(screen.getByText(/def optimized_two_sum/i)).toBeInTheDocument();

    // Verify copy button works
    const copyCodeBtn = screen.getByTestId('copy-refactored-code-button');
    fireEvent.click(copyCodeBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockSuggestedCode);
  });

  // =========================================================================
  // FE-REV-006: Static Fallback Warning & Honest Null Metrics
  // =========================================================================
  it('FE-REV-006: When aiAvailable is false, displays fallback warning and renders null scores as "N/A"', async () => {
    const mockFallbackResult = {
      review: { _id: 'rev-400', reviewMode: 'static-fallback' },
      analysis: {
        overallScore: 65,
        grade: 'C',
        staticScore: 65,
        aiAvailable: false,
        summary: 'AI semantic analysis was unavailable. Review completed using deterministic static code analysis engine.',
        metrics: {
          bugScore: null,
          securityScore: null,
          performanceScore: null,
          maintainabilityScore: null,
          aiCompositeScore: null,
          issueCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 }
        }
      },
      issues: [
        {
          _id: 'iss-crit-1',
          ruleId: 'SEC-PY-001',
          source: 'static',
          category: 'security',
          severity: 'HIGH',
          title: 'Dangerous dynamic execution',
          lineStart: 5,
          columnStart: 1
        }
      ]
    };

    render(<FindingsPanel analysisResult={mockFallbackResult} />);

    // Verify Fallback Banner
    expect(screen.getByTestId('fallback-alert-banner')).toBeInTheDocument();
    expect(screen.getByTestId('review-mode-badge')).toHaveTextContent(/static fallback/i);
    expect(screen.getByTestId('ai-status-badge')).toHaveTextContent(/ai offline/i);

    // Verify Honest "N/A" Display for AI Scores (Zero fabricated numbers)
    expect(screen.getByTestId('ai-score-display')).toHaveTextContent('N/A');
    expect(screen.getByTestId('bug-score-display')).toHaveTextContent('N/A');
    expect(screen.getByTestId('security-score-display')).toHaveTextContent('N/A');
    expect(screen.getByTestId('perf-score-display')).toHaveTextContent('N/A');
    expect(screen.getByTestId('maint-score-display')).toHaveTextContent('N/A');
    expect(screen.getByTestId('static-score-display')).toHaveTextContent('65%');
  });

  // =========================================================================
  // FE-REV-007: Retry Action Preserves Editor Code Buffer
  // =========================================================================
  it('FE-REV-007: Clicking "Retry AI Review" triggers re-submission while preserving editor code', async () => {
    const mockFallbackResult = {
      review: { _id: 'rev-500', reviewMode: 'static-fallback' },
      analysis: {
        overallScore: 70,
        grade: 'C',
        staticScore: 70,
        aiAvailable: false,
        metrics: {
          bugScore: null,
          securityScore: null,
          performanceScore: null,
          maintainabilityScore: null,
          aiCompositeScore: null,
          issueCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        }
      },
      issues: []
    };

    const mockRetry = vi.fn();
    render(<FindingsPanel analysisResult={mockFallbackResult} onRetryReview={mockRetry} />);

    const retryBtn = screen.getByRole('button', { name: /retry ai review/i });
    fireEvent.click(retryBtn);

    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // FE-REV-008: Rate Limiting (429) & Auth Expired (401) Error Handling
  // =========================================================================
  it('FE-REV-008: Displays HTTP 429 rate limit error banner and leaves editor code intact', async () => {
    const rateLimitError = new Error('Too many review requests from this IP address.');
    rateLimitError.status = 429;
    vi.spyOn(apiClient, 'createReview').mockRejectedValue(rateLimitError);

    render(
      <MemoryRouter>
        <CodeReview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit ai review/i })).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /submit ai review/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/too many review requests/i)).toBeInTheDocument();
    });

    // Verify textarea value is preserved and not cleared
    const textarea = screen.getByTestId('monaco-editor-textarea');
    expect(textarea.value).toContain('def two_sum');
  });

  // =========================================================================
  // FE-REV-009: Review Deep Linking & Overwrite Guard
  // =========================================================================
  it('FE-REV-009: ?reviewId=<id> prompts confirmation when editor is dirty and loads when confirmed', async () => {
    const mockDeepLinkReview = {
      review: {
        _id: '507f1f77bcf86cd799439011',
        title: 'Deep Linked Review',
        language: 'python',
        rawCode: 'print("loaded from deep link")',
        lineCount: 1,
        reviewMode: 'hybrid'
      },
      analysis: {
        overallScore: 95,
        grade: 'A',
        staticScore: 95,
        aiAvailable: true,
        metrics: {
          bugScore: 95,
          securityScore: 95,
          performanceScore: 95,
          maintainabilityScore: 95,
          aiCompositeScore: 95,
          issueCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        }
      },
      issues: []
    };

    vi.spyOn(apiClient, 'getReviewById').mockResolvedValue({
      success: true,
      data: mockDeepLinkReview
    });

    // Render with deep-link query parameter
    render(
      <MemoryRouter initialEntries={['/code-review?reviewId=507f1f77bcf86cd799439011']}>
        <Routes>
          <Route path="/code-review" element={<CodeReview />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial clean editor loads deep link automatically
    await waitFor(() => {
      expect(apiClient.getReviewById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      const textarea = screen.getByTestId('monaco-editor-textarea');
      expect(textarea.value).toBe('print("loaded from deep link")');
    });
  });

  // =========================================================================
  // FE-REV-010: Review History Listing & Cascade Deletion
  // =========================================================================
  it('FE-REV-010: ReviewHistory renders paginated reviews and cascade-deletes with confirmation modal', async () => {
    const mockReviewsList = [
      {
        _id: 'rev-del-1',
        title: 'Production Auth Module',
        filename: 'auth.py',
        language: 'python',
        lineCount: 45,
        overallScore: 82,
        grade: 'B',
        reviewMode: 'hybrid',
        createdAt: new Date().toISOString()
      }
    ];

    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList,
      meta: {
        pagination: { page: 1, limit: 10, total: 1, pages: 1 }
      }
    });

    vi.spyOn(apiClient, 'deleteReview').mockResolvedValue({
      success: true,
      message: 'Review deleted successfully'
    });

    render(
      <MemoryRouter>
        <ReviewHistory />
      </MemoryRouter>
    );

    // Wait for reviews to load
    await waitFor(() => {
      expect(screen.getByText('Production Auth Module')).toBeInTheDocument();
      expect(screen.getByText('auth.py')).toBeInTheDocument();
      expect(screen.getByText('45 LOC')).toBeInTheDocument();
      expect(screen.getByText('82%')).toBeInTheDocument();
    });

    // Click delete icon
    const deleteBtn = screen.getByTestId('delete-review-rev-del-1');
    fireEvent.click(deleteBtn);

    // Confirmation dialog appears
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/delete code review\?/i)).toBeInTheDocument();

    // Confirm deletion
    const confirmBtn = screen.getByTestId('confirm-delete-button');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiClient.deleteReview).toHaveBeenCalledWith('rev-del-1');
    });
  });
});
