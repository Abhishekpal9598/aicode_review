import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  FileCode,
  FolderOpen,
  ArrowRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

import apiClient from '../services/apiClient';
import SecurityMetricCards from '../components/security/SecurityMetricCards';
import OwaspDistributionChart from '../components/security/OwaspDistributionChart';
import CweDistributionChart from '../components/security/CweDistributionChart';
import SecurityFilterToolbar from '../components/security/SecurityFilterToolbar';
import SecurityFindingCard from '../components/security/SecurityFindingCard';

export function SecurityAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Review Selection State
  const reviewIdParam = searchParams.get('reviewId') || '';
  const [reviewsList, setReviewsList] = useState([]);
  const [selectedReviewId, setSelectedReviewId] = useState(reviewIdParam);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  // Security Analysis State
  const [securityData, setSecurityData] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorState, setErrorState] = useState(null);

  // Filter & Sort State
  const [filters, setFilters] = useState({
    severity: searchParams.get('severity') || '',
    source: searchParams.get('source') || '',
    cwe: searchParams.get('cwe') || '',
    owasp: searchParams.get('owasp') || '',
    sort: searchParams.get('sort') || 'severity_desc'
  });

  const abortControllerRef = useRef(null);

  /**
   * 1. Load User Reviews for Selector Dropdown
   */
  const loadUserReviews = useCallback(async () => {
    setIsLoadingReviews(true);
    try {
      const response = await apiClient.getReviews({ limit: 50 });
      if (response && response.success && Array.isArray(response.data)) {
        setReviewsList(response.data);

        // If no reviewId selected yet and reviews exist, select the first one
        if (!reviewIdParam && response.data.length > 0) {
          const firstId = response.data[0]._id;
          setSelectedReviewId(firstId);
        }
      }
    } catch (err) {
      console.warn('[SecurityAnalysis] Failed to load reviews list:', err);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [reviewIdParam, setSearchParams]);

  useEffect(() => {
    loadUserReviews();
  }, [loadUserReviews]);

  // Synchronize state when URL param changes externally
  useEffect(() => {
    if (reviewIdParam && reviewIdParam !== selectedReviewId) {
      setSelectedReviewId(reviewIdParam);
    }
  }, [reviewIdParam, selectedReviewId]);

  /**
   * 2. Fetch Dedicated Security Analysis from GET /api/v1/reviews/:id/security
   */
  const fetchSecurityAnalysis = useCallback(
    async (id, activeFilters) => {
      if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return;
      }

      setIsLoadingData(true);
      setErrorState(null);

      try {
        const queryParams = {};
        if (activeFilters.severity) queryParams.severity = activeFilters.severity;
        if (activeFilters.source) queryParams.source = activeFilters.source;
        if (activeFilters.cwe) queryParams.cwe = activeFilters.cwe;
        if (activeFilters.owasp) queryParams.owasp = activeFilters.owasp;
        if (activeFilters.sort) queryParams.sort = activeFilters.sort;

        const response = await apiClient.getSecurityReview(id, queryParams);

        if (response && response.success && response.data) {
          setSecurityData(response.data);
        } else {
          throw new Error(response?.message || 'Failed to retrieve security analysis');
        }
      } catch (err) {
        console.error('[SecurityAnalysis] API Error:', err);
        const status = err.status;
        let errorMessage =
          'An unexpected server error occurred while retrieving security analysis. Please try again later.';
        let errorType = 'generic';

        if (status === 401) {
          errorMessage =
            'Your authentication session has expired. Please log in again to access security analysis.';
          errorType = 'auth';
        } else if (status === 403) {
          errorMessage =
            'You do not have permission to view this review\'s security analysis.';
          errorType = 'forbidden';
        } else if (status === 404) {
          errorMessage =
            'Security review not found or it may have been deleted.';
          errorType = 'not_found';
        } else if (status === 422) {
          errorMessage =
            'Invalid filter or parameter requested. Resetting filters to default.';
          errorType = 'validation';
        } else if (status === 429) {
          errorMessage =
            'Too many security analysis requests. Please wait a moment before trying again.';
          errorType = 'rate_limit';
        } else if (status === 500 || status === 503) {
          errorMessage =
            'An unexpected server error occurred while retrieving security analysis. Please try again later.';
          errorType = 'server';
        } else if (status === 0 || err.code === 'NETWORK_UNAVAILABLE') {
          errorMessage =
            'Unable to connect to the backend server. Please check your network connection.';
          errorType = 'network';
        }

        setErrorState({
          message: errorMessage,
          type: errorType,
          status
        });
      } finally {
        setIsLoadingData(false);
      }
    },
    []
  );

  // Trigger fetch when selected review or filters change
  useEffect(() => {
    if (selectedReviewId) {
      fetchSecurityAnalysis(selectedReviewId, filters);
    }
  }, [selectedReviewId, filters, fetchSecurityAnalysis]);

  /**
   * 3. Handle Review Selection Change
   */
  const handleSelectReview = (e) => {
    const newId = e.target.value;
    if (!newId) return;
    setSelectedReviewId(newId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('reviewId', newId);
      return next;
    });
  };

  /**
   * 4. Handle Filter Changes
   */
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setSearchParams((prevParams) => {
      const next = new URLSearchParams(prevParams);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleResetFilters = () => {
    const reset = {
      severity: '',
      source: '',
      cwe: '',
      owasp: '',
      sort: 'severity_desc'
    };
    setFilters(reset);
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      if (selectedReviewId) {
        next.set('reviewId', selectedReviewId);
      }
      return next;
    });
  };

  const handleRefresh = () => {
    if (selectedReviewId) {
      fetchSecurityAnalysis(selectedReviewId, filters);
    }
  };

  // Find active review details from reviewsList
  const currentReview = reviewsList.find((r) => r._id === selectedReviewId);

  return (
    <div
      data-testid="security-analysis-page"
      className="space-y-6 pb-12 max-w-7xl mx-auto"
    >
      {/* Page Header with Review Selector */}
      <PageHeader
        title="Security Vulnerability Analysis"
        description="Automated static heuristic scanning and Google Gemini AI evaluation mapped against OWASP Top 10 and CWE standards."
        icon={ShieldAlert}
        badgeText="Phase 9 Analysis"
        badgeVariant="indigo"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Review Selector Dropdown */}
            {reviewsList.length > 0 && (
              <div className="relative">
                <select
                  aria-label="Select code review"
                  data-testid="review-selector"
                  value={selectedReviewId || ''}
                  onChange={handleSelectReview}
                  className="pl-3 pr-8 py-1.5 rounded-lg bg-surface-secondary border border-border-subtle text-xs font-mono text-text-primary focus:outline-none focus:border-brand-primary appearance-none cursor-pointer max-w-[240px] truncate"
                >
                  {reviewsList.map((rev) => (
                    <option key={rev._id} value={rev._id}>
                      {rev.title || rev.filename || rev._id} (
                      {rev.language ? rev.language.toUpperCase() : 'CODE'})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              data-testid="refresh-security-btn"
              disabled={isLoadingData || !selectedReviewId}
              className="p-1.5 rounded-lg bg-surface-secondary hover:bg-surface-tertiary border border-border-subtle text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh security analysis"
              aria-label="Refresh security analysis"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        }
      />

      {/* Global Error Banner */}
      {errorState && (
        <div
          role="alert"
          data-testid="security-error-banner"
          className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorState.message}</span>
          </div>

          {errorState.type === 'auth' ? (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium cursor-pointer"
            >
              Log In
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRefresh}
              className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-medium cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoadingData && !securityData && (
        <div
          data-testid="security-loading-state"
          className="flex flex-col items-center justify-center py-20 space-y-3"
        >
          <LoadingSpinner size="lg" />
          <p className="text-xs text-text-secondary font-mono">
            Loading security vulnerability analysis...
          </p>
        </div>
      )}

      {/* Zero Reviews Empty State */}
      {!isLoadingReviews && reviewsList.length === 0 && (
        <Card
          data-testid="no-reviews-empty-state"
          className="p-12 text-center bg-surface-secondary/60 border-border-subtle flex flex-col items-center justify-center max-w-lg mx-auto"
        >
          <div className="w-12 h-12 rounded-xl bg-surface-tertiary border border-border-subtle flex items-center justify-center text-text-muted mb-4">
            <FolderOpen className="w-6 h-6 text-brand-primary" />
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">
            No Reviews Available
          </h3>
          <p className="text-xs text-text-secondary max-w-sm mb-6 leading-relaxed">
            Submit a code snippet in the Code Review workspace to generate your first
            security analysis.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/code-review')}
            className="inline-flex items-center gap-1.5"
          >
            <span>Start New Review</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Card>
      )}

      {/* Main Security Analysis View */}
      {securityData && (
        <div className="space-y-6">
          {/* Active Review Metadata Strip */}
          {currentReview && (
            <div className="flex items-center justify-between gap-3 text-xs text-text-secondary p-3 rounded-lg bg-surface-secondary/40 border border-border-subtle/60 flex-wrap">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-brand-primary" />
                <span className="font-semibold text-text-primary">
                  {currentReview.title || currentReview.filename || 'Pasted Code'}
                </span>
                {currentReview.language && (
                  <Badge variant="indigo" size="xs" mono>
                    {currentReview.language.toUpperCase()}
                  </Badge>
                )}
                {currentReview.lineCount && (
                  <span className="text-[11px] text-text-muted font-mono">
                    ({currentReview.lineCount} LOC)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/code-review?reviewId=${selectedReviewId}`)
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-brand-primary hover:underline cursor-pointer"
                >
                  <span>Open in Workspace</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* 1. Metric Cards (Score, Critical Status, Total Findings, Engine Distribution) */}
          <SecurityMetricCards
            securityScore={securityData.securityScore}
            securityGrade={securityData.securityGrade}
            hasCriticalVulnerability={securityData.hasCriticalVulnerability}
            totalSecurityIssues={securityData.totalSecurityIssues}
            filteredCount={securityData.filteredCount}
            severityCounts={securityData.severityCounts}
            sourceCounts={securityData.sourceCounts}
          />

          {/* 2. Visualizations Grid: OWASP Top 10 & CWE Distribution Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OwaspDistributionChart
              owaspDistribution={securityData.owaspDistribution}
              selectedOwasp={filters.owasp}
              onSelectOwasp={(prefix) => handleFilterChange('owasp', prefix)}
            />
            <CweDistributionChart
              cweDistribution={securityData.cweDistribution}
              selectedCwe={filters.cwe}
              onSelectCwe={(cweId) => handleFilterChange('cwe', cweId)}
            />
          </div>

          {/* 3. Filter & Sort Toolbar */}
          <SecurityFilterToolbar
            filters={filters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            totalIssues={securityData.totalSecurityIssues}
            filteredCount={securityData.filteredCount}
          />

          {/* 4. Findings Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary tracking-tight">
                Vulnerability Findings & Remediations
              </h3>
              <span className="text-xs font-mono text-text-muted">
                {securityData.filteredCount} of {securityData.totalSecurityIssues} displayed
              </span>
            </div>

            {/* Empty Findings State (Genuine Zero Security Issues) */}
            {securityData.totalSecurityIssues === 0 && (
              <Card
                data-testid="no-findings-empty-state"
                className="p-10 text-center bg-surface-secondary/50 border-emerald-500/30 flex flex-col items-center justify-center"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-text-primary mb-1">
                  No Security Findings Detected
                </h4>
                <p className="text-xs text-text-secondary max-w-md leading-relaxed mb-3">
                  No security findings were identified by the configured security
                  analysis rules and AI review for this code submission.
                </p>
                <p className="text-[11px] text-text-muted font-mono">
                  Periodic audits and defensive secure coding practices should remain part of standard CI/CD verification.
                </p>
              </Card>
            )}

            {/* Filter-Empty State (Issues exist, but none match filters) */}
            {securityData.totalSecurityIssues > 0 &&
              securityData.filteredCount === 0 && (
                <Card
                  data-testid="filter-empty-state"
                  className="p-8 text-center bg-surface-secondary/50 border-border-subtle flex flex-col items-center justify-center"
                >
                  <p className="text-sm font-semibold text-text-primary mb-1">
                    No Findings Match Current Filters
                  </p>
                  <p className="text-xs text-text-secondary mb-4">
                    There are {securityData.totalSecurityIssues} security findings in
                    this review, but none match your selected severity, source, or
                    CWE filters.
                  </p>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleResetFilters}
                  >
                    Reset Filters
                  </Button>
                </Card>
              )}

            {/* Security Finding Cards List */}
            {securityData.issues && securityData.issues.length > 0 && (
              <div
                data-testid="security-findings-list"
                className="space-y-4"
              >
                {securityData.issues.map((issue, idx) => (
                  <SecurityFindingCard
                    key={issue._id || `security-issue-${idx}`}
                    issue={issue}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SecurityAnalysis;
