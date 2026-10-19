import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import RecentReviewsTable from '../components/dashboard/RecentReviewsTable';
import QualityScoreChart from '../components/dashboard/QualityScoreChart';
import IssueRadarChart from '../components/dashboard/IssueRadarChart';
import MetricCard from '../components/dashboard/MetricCard';
import QuickActions from '../components/dashboard/QuickActions';
import GettingStartedGuide from '../components/dashboard/GettingStartedGuide';
import apiClient from '../services/apiClient';

// Mock AuthContext
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      name: 'Ada Lovelace',
      email: 'ada@test.dev',
      role: 'developer'
    },
    isAuthenticated: true
  })
}));

describe('Phase 5: Frontend Dashboard Tests (Tests 6 - 12)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // TEST 6: HTTP 200 Genuine Zero-State & Response Unwrapping
  it('Test 6 (HTTP 200 Genuine Zero-State & Unwrapping): unwraps res.data and renders honest zero states', async () => {
    vi.spyOn(apiClient, 'getUserStats').mockResolvedValue({
      success: true,
      message: 'User statistics retrieved successfully.',
      data: {
        overview: {
          totalReviews: 0,
          averageQualityScore: null,
          criticalSecurityIssues: null,
          performanceBottlenecks: null
        },
        scoreHistory: [],
        languageDistribution: [],
        recentReviews: []
      },
      meta: { timestamp: new Date().toISOString() }
    });

    vi.spyOn(apiClient, 'getV1Health').mockResolvedValue({
      success: true,
      message: 'AI Code Review API is running',
      status: 'healthy',
      database: { connected: true },
      timestamp: new Date().toISOString()
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    // Verify welcome greeting with user name and async DB connection telemetry
    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Ada Lovelace/i)).toBeInTheDocument();
      expect(screen.getByText(/Database Connected/i)).toBeInTheDocument();
    });

    // Verify AI Engine status is unreleased Phase 8
    expect(screen.getByText(/AI Engine: Coming in Phase 8/i)).toBeInTheDocument();

    // Verify Overview KPI cards values
    expect(screen.getByText('Total Code Reviews')).toBeInTheDocument();
    expect(screen.getByText('Mean Quality Score')).toBeInTheDocument();
    expect(screen.getByText('Critical Security Flaws')).toBeInTheDocument();
    expect(screen.getByText('Performance Optimizations')).toBeInTheDocument();

    // Verify honest zero & unreleased states
    expect(screen.getByText('Coming in Phase 7 & 9')).toBeInTheDocument();
    expect(screen.getByText('Coming in Phase 10')).toBeInTheDocument();
  });

  // TEST 7: HTTP 503 Database Unavailable Banner with Retry
  it('Test 7 (HTTP 503 Database Unavailable Banner): renders alert banner and retry button', async () => {
    const statsSpy = vi.spyOn(apiClient, 'getUserStats').mockRejectedValue({
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database service is currently unavailable.'
    });

    vi.spyOn(apiClient, 'getV1Health').mockRejectedValue({
      status: 503,
      data: { database: { connected: false } }
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Database Service Unavailable/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry Connection/i });
    expect(retryBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(statsSpy).toHaveBeenCalledTimes(2);
  });

  // TEST 8: Network Failure Network Unreachable Banner with Retry
  it('Test 8 (Network Failure Network Unreachable Banner): renders unreachable banner and retry button', async () => {
    const statsSpy = vi.spyOn(apiClient, 'getUserStats').mockRejectedValue({
      status: 0,
      code: 'NETWORK_UNAVAILABLE',
      message: 'Unable to connect to the backend API server.'
    });

    vi.spyOn(apiClient, 'getV1Health').mockRejectedValue({
      status: 0,
      code: 'NETWORK_UNAVAILABLE'
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Backend API Unreachable/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry Connection/i });
    expect(retryBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(statsSpy).toHaveBeenCalledTimes(2);
  });

  // TEST 9: RecentReviewsTable Schema Purity & Action Column
  it('Test 9 (RecentReviewsTable Schema Purity & Action Column): displays strictly CodeReview fields and no score/issue columns', () => {
    const mockReviews = [
      {
        _id: 'rev-101',
        title: 'binarySearch.ts',
        language: 'typescript',
        lineCount: 42,
        status: 'completed',
        createdAt: '2026-10-14T10:00:00.000Z'
      }
    ];

    render(
      <MemoryRouter>
        <RecentReviewsTable recentReviews={mockReviews} />
      </MemoryRouter>
    );

    // Verify column headers exist
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Lines of Code')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Date Submitted')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();

    // Verify row values
    expect(screen.getByText('binarySearch.ts')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
    expect(screen.getByText('42 LOC')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();

    // Assert that Issues Count and Quality Score columns DO NOT exist
    expect(screen.queryByText('Issues Count')).not.toBeInTheDocument();
    expect(screen.queryByText('Issues')).not.toBeInTheDocument();
    expect(screen.queryByText('Quality Score')).not.toBeInTheDocument();

    // Verify UI Action control links to /code-review
    const openLink = screen.getByRole('link', { name: /Open Workspace/i });
    expect(openLink).toHaveAttribute('href', '/code-review');
  });

  // TEST 10: Recharts Zero-Mock Rendering
  it('Test 10 (Recharts Zero-Mock Rendering): charts render honest empty states with zero fake points', () => {
    const { container: areaContainer } = render(<QualityScoreChart scoreHistory={[]} />);
    expect(screen.getByText(/No Score History Recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/Historical trajectory curves will render automatically once code reviews are processed in Phase 8./i)).toBeInTheDocument();

    const { container: radarContainer } = render(<IssueRadarChart radarData={[]} />);
    expect(screen.getByText(/Quality Radar Uncalibrated/i)).toBeInTheDocument();
    expect(screen.getByText(/Dimensions \(Bug Safety, Security Hygiene, Runtime Efficiency, Cleanliness, Maintainability\) activate upon completed code analyses in Phase 8./i)).toBeInTheDocument();
  });

  // TEST 11: Honest KPI Overview Cards
  it('Test 11 (Honest KPI Overview Cards): overview cards render correct honest states', () => {
    const { rerender } = render(
      <MetricCard
        title="Total Code Reviews"
        value={0}
        subtext="No reviews submitted yet"
        badgeText="Live DB"
        badgeVariant="emerald"
      />
    );
    expect(screen.getByText('Total Code Reviews')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Live DB')).toBeInTheDocument();

    rerender(
      <MetricCard
        title="Mean Quality Score"
        value={null}
        subtext="Requires completed code reviews (Phase 8)"
        badgeText="Pending Reviews"
        badgeVariant="indigo"
      />
    );
    expect(screen.getByText('--')).toBeInTheDocument();
    expect(screen.getByText('Pending Reviews')).toBeInTheDocument();

    rerender(
      <MetricCard
        title="Critical Security Flaws"
        value="Coming in Phase 7 & 9"
        subtext="Static pattern scanner activates in Phase 7; comprehensive OWASP vulnerability suite activates in Phase 9."
        badgeText="Not Available Yet"
        badgeVariant="amber"
        isUnavailable={true}
      />
    );
    expect(screen.getByText('Coming in Phase 7 & 9')).toBeInTheDocument();
    expect(screen.getByText('Not Available Yet')).toBeInTheDocument();

    rerender(
      <MetricCard
        title="Performance Optimizations"
        value="Coming in Phase 10"
        subtext="Big-O complexity profiler activates in Phase 10."
        badgeText="Not Available Yet"
        badgeVariant="amber"
        isUnavailable={true}
      />
    );
    expect(screen.getByText('Coming in Phase 10')).toBeInTheDocument();
  });

  // TEST 12: Exact AppRoutes Navigation Alignment
  it('Test 12 (Exact AppRoutes Navigation Alignment): quick actions and guide resolve to exact AppRoutes paths', () => {
    render(
      <MemoryRouter>
        <QuickActions />
        <GettingStartedGuide />
      </MemoryRouter>
    );

    // Verify QuickActions links to exact AppRoutes paths
    const quickLinks = screen.getAllByRole('link');
    const hrefs = quickLinks.map((link) => link.getAttribute('href'));

    expect(hrefs).toContain('/code-review');
    expect(hrefs).toContain('/security');
    expect(hrefs).toContain('/performance');
    expect(hrefs).toContain('/history');
    expect(hrefs).toContain('/settings');
    expect(hrefs).toContain('/reports');
  });
});
