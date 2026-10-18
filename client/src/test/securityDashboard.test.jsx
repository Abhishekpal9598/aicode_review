import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import SecurityAnalysis from '../pages/SecurityAnalysis';
import ReviewHistory from '../pages/ReviewHistory';
import FindingsPanel from '../components/editor/FindingsPanel';
import SecurityMetricCards from '../components/security/SecurityMetricCards';
import OwaspDistributionChart from '../components/security/OwaspDistributionChart';
import CweDistributionChart from '../components/security/CweDistributionChart';
import SecurityFindingCard from '../components/security/SecurityFindingCard';
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

// Mock ResizeObserver for Recharts in jsdom
beforeEach(() => {
  vi.restoreAllMocks();

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock clipboard
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn().mockResolvedValue(undefined)
    }
  });
});

const VALID_REVIEW_ID = '670da1b2c45e8f1234567890';

const createMockSecurityPayload = (overrides = {}) => ({
  success: true,
  message: 'Security analysis retrieved successfully',
  data: {
    reviewId: VALID_REVIEW_ID,
    securityScore: 85,
    securityGrade: 'B',
    hasCriticalVulnerability: false,
    totalSecurityIssues: 3,
    filteredCount: 3,
    severityCounts: {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 0,
      INFO: 0
    },
    sourceCounts: {
      static: 1,
      gemini: 1,
      hybrid: 1
    },
    owaspDistribution: {
      'A01:2021-Broken Access Control': 1,
      'A02:2021-Cryptographic Failures': 0,
      'A03:2021-Injection': 2,
      'A04:2021-Insecure Design': 0,
      'A05:2021-Security Misconfiguration': 0,
      'A06:2021-Vulnerable and Outdated Components': 0,
      'A07:2021-Identification and Authentication Failures': 0,
      'A08:2021-Software and Data Integrity Failures': 0,
      'A09:2021-Security Logging and Monitoring Failures': 0,
      'A10:2021-Server-Side Request Forgery': 0,
      Uncategorized: 0
    },
    cweDistribution: {
      'CWE-89': 2,
      'CWE-798': 1
    },
    issues: [
      {
        _id: '670da1b2c45e8f1234567891',
        reviewId: VALID_REVIEW_ID,
        userId: '670da1b2c45e8f1234567800',
        ruleId: 'sec-sql-injection',
        category: 'security',
        severity: 'HIGH',
        title: 'Potential SQL Injection',
        description: 'Raw concatenation in SQL query',
        explanation: 'Values concatenated directly into SQL statement',
        lineStart: 42,
        lineEnd: 42,
        columnStart: 5,
        columnEnd: 55,
        source: 'hybrid',
        cwe: 'CWE-89',
        owaspCategory: 'A03:2021-Injection',
        confidence: 0.95,
        remediation: 'Use parameterized queries or prepared statements',
        originalSnippet: 'db.query(`SELECT * FROM users WHERE id = ${id}`);',
        suggestedSnippet: "db.query('SELECT * FROM users WHERE id = $1', [id]);",
        createdAt: '2026-10-16T12:00:00.000Z'
      }
    ],
    ...overrides
  },
  meta: { timestamp: new Date().toISOString() }
});

const mockReviewsList = [
  {
    _id: VALID_REVIEW_ID,
    title: 'authController.js',
    filename: 'authController.js',
    language: 'javascript',
    lineCount: 120,
    status: 'completed',
    createdAt: '2026-10-16T10:00:00.000Z'
  }
];

describe('Phase 9 Step 5: Security Dashboard Frontend Integration Tests', () => {
  // TEST 1: Loading Spinner
  it('1. renders loading spinner during security analysis fetch', async () => {
    let resolvePromise;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockReturnValue(pendingPromise);

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    expect(screen.getByTestId('security-loading-state')).toBeInTheDocument();

    // Resolve promise to prevent dangling operations
    await act(async () => {
      resolvePromise(createMockSecurityPayload());
    });
  });

  // TEST 2: Complete Telemetry, Score, and Grade
  it('2. renders security dashboard with complete telemetry, score, and grade', async () => {
    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockResolvedValue(createMockSecurityPayload());

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('security-metric-cards')).toBeInTheDocument();
    });

    // Score and grade assertions
    expect(screen.getByTestId('security-score-value')).toHaveTextContent('85');
    expect(screen.getByTestId('security-grade-badge')).toHaveTextContent('B');

    // Total findings pre-filter count
    expect(screen.getByTestId('total-findings-value')).toHaveTextContent('3');

    // Critical status compliant
    expect(screen.getByTestId('critical-status-badge')).toHaveTextContent('COMPLIANT');

    // Origin breakdown
    expect(screen.getByText('Hybrid Fusion:')).toBeInTheDocument();
    expect(screen.getByText('Static Scanner:')).toBeInTheDocument();
    expect(screen.getByText('Gemini AI:')).toBeInTheDocument();
  });

  // TEST 3: Honest N/A for Missing Security Score
  it('3. handles missing security score honestly by rendering N/A', async () => {
    const payload = createMockSecurityPayload({
      securityScore: null,
      securityGrade: null
    });

    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockResolvedValue(payload);

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('security-score-value')).toBeInTheDocument();
    });

    // Must render N/A and NEVER convert null to 0 or 0%
    expect(screen.getByTestId('security-score-value')).toHaveTextContent('N/A');
    expect(screen.getByTestId('security-grade-badge')).toHaveTextContent('N/A');
    expect(screen.getByText('Score Not Available')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  // TEST 4: No Static Fallback Badge When Omitted
  it('4. does NOT display Static Fallback badge when reviewMode is omitted', async () => {
    const payload = createMockSecurityPayload({
      securityScore: null,
      securityGrade: null
    });
    // Ensure no reviewMode property exists in payload
    delete payload.data.reviewMode;

    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockResolvedValue(payload);

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('security-metric-cards')).toBeInTheDocument();
    });

    // Static Fallback badge must NOT be displayed
    expect(screen.queryByText(/Static Fallback/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('static-fallback-badge')).not.toBeInTheDocument();
  });

  // TEST 5: Honest Empty Findings State Without Overclaiming
  it('5. renders honest empty findings state without overclaiming', async () => {
    const emptyPayload = createMockSecurityPayload({
      totalSecurityIssues: 0,
      filteredCount: 0,
      hasCriticalVulnerability: false,
      severityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 },
      sourceCounts: { static: 0, gemini: 0, hybrid: 0 },
      issues: []
    });

    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockResolvedValue(emptyPayload);

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-findings-empty-state')).toBeInTheDocument();
    });

    // Exact approved copy
    expect(screen.getByText('No Security Findings Detected')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No security findings were identified by the configured security analysis rules and AI review for this code submission.'
      )
    ).toBeInTheDocument();

    // Must NOT claim zero vulnerabilities exist
    expect(screen.queryByText(/Zero Security Vulnerabilities/i)).not.toBeInTheDocument();
  });

  // TEST 6: Pre-filter Telemetry Remains Invariant After Filters
  it('6. pre-filter telemetry remains invariant when query filters are applied', async () => {
    // When filtered by severity=HIGH, filteredCount becomes 1, but totalSecurityIssues remains 3
    const filteredPayload = createMockSecurityPayload({
      totalSecurityIssues: 3,
      filteredCount: 1,
      issues: [
        {
          _id: '670da1b2c45e8f1234567891',
          ruleId: 'sec-sql-injection',
          severity: 'HIGH',
          title: 'Potential SQL Injection',
          source: 'hybrid',
          cwe: 'CWE-89'
        }
      ]
    });

    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    const securitySpy = vi
      .spyOn(apiClient, 'getSecurityReview')
      .mockResolvedValue(filteredPayload);

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('security-filter-toolbar')).toBeInTheDocument();
    });

    // Apply HIGH severity filter
    const severitySelect = screen.getByTestId('filter-severity');
    fireEvent.change(severitySelect, { target: { value: 'HIGH' } });

    await waitFor(() => {
      expect(securitySpy).toHaveBeenCalledWith(
        VALID_REVIEW_ID,
        expect.objectContaining({ severity: 'HIGH' })
      );
    });

    // Total findings remains 3 (pre-filter count), while showing text reflects filtered subset
    expect(screen.getByTestId('total-findings-value')).toHaveTextContent('3');
    expect(screen.getByTestId('filtered-subtext')).toHaveTextContent('Showing 1 of 3 findings');
  });

  // TEST 7: Critical Vulnerability Alert
  it('7. renders critical vulnerability alert banner when hasCriticalVulnerability is true', async () => {
    const critPayload = createMockSecurityPayload({
      hasCriticalVulnerability: true,
      severityCounts: { CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 0, INFO: 0 }
    });

    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockResolvedValue(critPayload);

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('metric-critical-status')).toBeInTheDocument();
    });

    expect(screen.getByTestId('critical-status-badge')).toHaveTextContent('ACTION REQUIRED');
    expect(screen.getByText('1 Critical')).toBeInTheDocument();
    expect(
      screen.getByText('Requires immediate remediation before deployment')
    ).toBeInTheDocument();
  });

  // TEST 8: OWASP Distribution Chart
  it('8. renders OWASP Top 10 distribution chart with category labels', async () => {
    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockResolvedValue(createMockSecurityPayload());

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('owasp-distribution-chart')).toBeInTheDocument();
    });

    expect(screen.getByText(/OWASP Top 10 \(2021\) Distribution/i)).toBeInTheDocument();
    expect(screen.getByText('3 Detected')).toBeInTheDocument();
  });

  // TEST 9: CWE Distribution Chart
  it('9. renders CWE distribution chart with CWE labels', async () => {
    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockResolvedValue(createMockSecurityPayload());

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('cwe-distribution-chart')).toBeInTheDocument();
    });

    expect(screen.getByText(/Common Weakness Enumeration \(CWE\)/i)).toBeInTheDocument();
    expect(screen.getByText('2 CWE Types')).toBeInTheDocument();
  });

  // TEST 10: Security Findings Card Details
  it('10. displays security findings with rule ID, severity badge, source pill, and lines', async () => {
    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockResolvedValue(createMockSecurityPayload());

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('security-finding-card-670da1b2c45e8f1234567891')
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId('finding-severity-badge')).toHaveTextContent('HIGH');
    expect(screen.getByTestId('finding-source-pill')).toHaveTextContent('Hybrid Fusion');
    expect(screen.getByTestId('finding-rule-id')).toHaveTextContent('sec-sql-injection');
    expect(screen.getByTestId('finding-line-range')).toHaveTextContent('Line 42:5 - 42:55');
    expect(screen.getByTestId('finding-owasp-badge')).toHaveTextContent('OWASP: A03:2021-Injection');
    expect(screen.getByTestId('finding-cwe-badge')).toHaveTextContent('CWE: CWE-89');
    expect(screen.getByTestId('finding-confidence-badge')).toHaveTextContent('Confidence: 95%');
  });

  // TEST 11: Remediation Guidance and Clipboard Copy
  it('11. renders remediation advice and copies suggested snippet to clipboard', async () => {
    const singleIssue = {
      _id: 'issue-101',
      title: 'SQL Injection',
      severity: 'HIGH',
      remediation: 'Use parameterized queries or prepared statements',
      suggestedSnippet: "db.query('SELECT * FROM users WHERE id = $1', [id]);"
    };

    render(<SecurityFindingCard issue={singleIssue} />);

    expect(screen.getByTestId('remediation-section')).toBeInTheDocument();
    expect(
      screen.getByText('Use parameterized queries or prepared statements')
    ).toBeInTheDocument();

    const copyBtn = screen.getByTestId('copy-suggested-fix-btn');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "db.query('SELECT * FROM users WHERE id = $1', [id]);"
    );
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  // TEST 12: HTTP 404 Review Not Found
  it('12. handles HTTP 404 review not found error gracefully', async () => {
    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockRejectedValue({
      status: 404,
      message: 'Review not found'
    });

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('security-error-banner')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Security review not found or it may have been deleted.')
    ).toBeInTheDocument();
  });

  // TEST 13: HTTP 401 Unauthorized
  it('13. handles HTTP 401 unauthorized session expiration', async () => {
    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockRejectedValue({
      status: 401,
      message: 'Unauthorized'
    });

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('security-error-banner')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Your authentication session has expired. Please log in again to access security analysis.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log In/i })).toBeInTheDocument();
  });

  // TEST 14: Status 0 Network Failure
  it('14. handles status 0 network failure with user-safe message', async () => {
    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList
    });
    vi.spyOn(apiClient, 'getSecurityReview').mockRejectedValue({
      status: 0,
      code: 'NETWORK_UNAVAILABLE',
      message: 'Network request failed'
    });

    render(
      <MemoryRouter initialEntries={[`/security?reviewId=${VALID_REVIEW_ID}`]}>
        <SecurityAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('security-error-banner')).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        'Unable to connect to the backend server. Please check your network connection.'
      )
    ).toBeInTheDocument();
  });

  // TEST 15: FindingsPanel Navigation Guard
  it('15. FindingsPanel renders Security Dashboard link ONLY with valid 24-hex reviewId', () => {
    // 15a: Valid 24-hex persistent reviewId -> Renders button
    const persistentResult = {
      review: { _id: VALID_REVIEW_ID, reviewMode: 'hybrid' },
      analysis: {
        overallScore: 90,
        grade: 'A',
        aiAvailable: true,
        metrics: { securityScore: 90 }
      },
      issues: []
    };

    const { rerender } = render(
      <MemoryRouter>
        <FindingsPanel analysisResult={persistentResult} />
      </MemoryRouter>
    );

    const securityBtn = screen.getByTestId('view-security-dashboard-btn');
    expect(securityBtn).toBeInTheDocument();
    expect(securityBtn).toHaveAttribute(
      'href',
      `/security?reviewId=${VALID_REVIEW_ID}`
    );

    // 15b: Transient static result (no review._id) -> Must NOT render button
    const transientResult = {
      scoring: { overallScore: 80, grade: 'B' },
      metrics: { totalLines: 50 },
      findings: []
    };

    rerender(
      <MemoryRouter>
        <FindingsPanel analysisResult={transientResult} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('view-security-dashboard-btn')).not.toBeInTheDocument();

    // 15c: Invalid non-hex ID -> Must NOT render button
    const invalidIdResult = {
      review: { _id: 'not-a-valid-hex-id-123' },
      analysis: { overallScore: 70, grade: 'C' },
      issues: []
    };

    rerender(
      <MemoryRouter>
        <FindingsPanel analysisResult={invalidIdResult} />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('view-security-dashboard-btn')).not.toBeInTheDocument();
  });

  // TEST 16: ReviewHistory Navigation Button
  it('16. ReviewHistory renders Security navigation link with valid review ID', async () => {
    vi.spyOn(apiClient, 'getReviews').mockResolvedValue({
      success: true,
      data: mockReviewsList,
      meta: { pagination: { page: 1, limit: 10, total: 1, pages: 1 } }
    });

    render(
      <MemoryRouter>
        <ReviewHistory />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(`view-security-${VALID_REVIEW_ID}`)
      ).toBeInTheDocument();
    });

    const secBtn = screen.getByTestId(`view-security-${VALID_REVIEW_ID}`);
    expect(secBtn).toHaveTextContent('Security');
  });
});
