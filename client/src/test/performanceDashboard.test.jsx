import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PerformanceAnalysis from '../pages/PerformanceAnalysis';
import apiClient from '../services/apiClient';

// Mock apiClient methods
vi.mock('../services/apiClient', () => {
  return {
    default: {
      getReviews: vi.fn(),
      getPerformanceReview: vi.fn()
    }
  };
});

const mockReviewsList = [
  {
    _id: '507f1f77bcf86cd799439011',
    title: 'Bubble Sort Test',
    filename: 'bubble.py',
    language: 'python',
    createdAt: new Date().toISOString()
  },
  {
    _id: '507f1f77bcf86cd799439012',
    title: 'Binary Search Test',
    filename: 'search.py',
    language: 'python',
    createdAt: new Date().toISOString()
  }
];

const mockPerformanceData = {
  reviewId: '507f1f77bcf86cd799439011',
  title: 'Bubble Sort Test',
  language: 'python',
  performanceScore: 70,
  performanceGrade: 'C',
  timeComplexity: 'O(n²)',
  spaceComplexity: 'O(1)',
  complexityType: 'deterministic',
  confidence: 'HIGH',
  hasCriticalBottleneck: false,
  totalPerformanceIssues: 1,
  filteredCount: 1,
  severityCounts: {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0
  },
  sourceCounts: {
    static: 1,
    gemini: 0,
    hybrid: 0
  },
  complexityDistribution: {
    'O(n²)': 1
  },
  suggestedCode: null,
  refactoringRationale: null,
  summary: 'Identified 1 performance bottlenecks. Overall algorithmic worst-case: O(n²) time.',
  issues: [
    {
      _id: 'issue-1',
      reviewId: '507f1f77bcf86cd799439011',
      category: 'performance',
      severity: 'HIGH',
      title: 'Quadratic Nested Loop (O(n²))',
      description: 'Nested loop detected where an inner iteration executes for every outer step.',
      lineStart: 4,
      lineEnd: 7,
      originalSnippet: 'for i in range(n):\n    for j in range(n):\n        pass',
      suggestedSnippet: '# Use Set/Map for O(1) lookups',
      explanation: 'Nested loops produce quadratic O(n²) runtime.',
      remediation: 'Replace inner loop with hash map lookup.',
      complexityEstimate: 'O(n²)',
      confidence: 'HIGH',
      source: 'static'
    }
  ]
};

const renderWithRouter = (initialEntries = ['/performance']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/performance" element={<PerformanceAnalysis />} />
        <Route path="/code-review" element={<div data-testid="workspace-mock">Workspace</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Phase 10: Frontend Performance Analysis Dashboard Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Renders page header, title, and initial loading indicators', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });
    apiClient.getPerformanceReview.mockResolvedValueOnce({
      success: true,
      data: mockPerformanceData
    });

    renderWithRouter();

    expect(screen.getByText('Performance & Algorithmic Analysis')).toBeInTheDocument();
    expect(screen.getByText('Roadmap Phase 10')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiClient.getReviews).toHaveBeenCalledTimes(1);
      expect(apiClient.getPerformanceReview).toHaveBeenCalledTimes(1);
    });
  });

  it('2. Renders review selector dropdown with past reviews', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });
    apiClient.getPerformanceReview.mockResolvedValueOnce({
      success: true,
      data: mockPerformanceData
    });

    renderWithRouter();

    await waitFor(() => {
      const select = screen.getByTestId('review-selector');
      expect(select).toBeInTheDocument();
      expect(select.children.length).toBe(2);
    });
  });

  it('3. Renders Big-O Time Complexity badge with deterministic indicator', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });
    apiClient.getPerformanceReview.mockResolvedValueOnce({
      success: true,
      data: mockPerformanceData
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Time Complexity')).toBeInTheDocument();
      expect(screen.getByText('Deterministic')).toBeInTheDocument();
      const badges = screen.getAllByTestId('complexity-badge');
      expect(badges.some((b) => b.textContent.includes('O(n²)'))).toBe(true);
    });
  });

  it('4. Renders Space Complexity badge and Performance Health Score', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });
    apiClient.getPerformanceReview.mockResolvedValueOnce({
      success: true,
      data: mockPerformanceData
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Space Complexity')).toBeInTheDocument();
      expect(screen.getByText('Performance Score')).toBeInTheDocument();
      expect(screen.getByText('Grade C')).toBeInTheDocument();
      expect(screen.getByText('70')).toBeInTheDocument();
    });
  });

  it('5. Renders Algorithmic Efficiency Spectrum track', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });
    apiClient.getPerformanceReview.mockResolvedValueOnce({
      success: true,
      data: mockPerformanceData
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Algorithmic Efficiency Spectrum')).toBeInTheDocument();
    });
  });

  it('6. Renders bottleneck card with exact line numbers and code snippets', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });
    apiClient.getPerformanceReview.mockResolvedValueOnce({
      success: true,
      data: mockPerformanceData
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Quadratic Nested Loop (O(n²))')).toBeInTheDocument();
      expect(screen.getAllByText(/Line 4/).length).toBeGreaterThan(0);
      expect(screen.getByText('Problematic Code (Before)')).toBeInTheDocument();
      expect(screen.getByText('Optimized Alternative (After)')).toBeInTheDocument();
      expect(screen.getByText('Copy Fix')).toBeInTheDocument();
    });
  });

  it('7. Filters bottlenecks by severity pills', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });
    apiClient.getPerformanceReview.mockResolvedValueOnce({
      success: true,
      data: mockPerformanceData
    });
    apiClient.getPerformanceReview.mockResolvedValueOnce({
      success: true,
      data: {
        ...mockPerformanceData,
        issues: []
      }
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Quadratic Nested Loop (O(n²))')).toBeInTheDocument();
    });

    // Click "CRITICAL (0)" filter button
    const critBtn = screen.getByText(/CRITICAL \(0\)/i);
    fireEvent.click(critBtn);

    await waitFor(() => {
      expect(apiClient.getPerformanceReview).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ severity: 'CRITICAL' })
      );
    });
  });

  it('8. Renders zero-bottleneck clean state when issues list is empty', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: [mockReviewsList[1]]
    });
    apiClient.getPerformanceReview.mockResolvedValueOnce({
      success: true,
      data: {
        ...mockPerformanceData,
        totalPerformanceIssues: 0,
        severityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
        issues: []
      }
    });

    renderWithRouter();

    await waitFor(() => {
      expect(
        screen.getByText('Clean Algorithmic Profile — Zero Bottlenecks')
      ).toBeInTheDocument();
    });
  });

  it('9. Handles HTTP error gracefully with dismissible retry banner', async () => {
    apiClient.getReviews.mockResolvedValueOnce({
      success: true,
      data: mockReviewsList
    });
    apiClient.getPerformanceReview.mockRejectedValueOnce(
      new Error('Performance service timeout')
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Performance service timeout')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
