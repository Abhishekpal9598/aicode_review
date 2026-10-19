import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Cpu,
  Zap,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Filter,
  Layers,
  ChevronDown,
  Sparkles
} from 'lucide-react';

import apiClient from '../services/apiClient';
import ComplexityBadge from '../components/performance/ComplexityBadge';
import ComplexityScale from '../components/performance/ComplexityScale';
import BottleneckCard from '../components/performance/BottleneckCard';

const GRADE_COLORS = {
  A: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  B: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  C: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  D: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  F: 'text-rose-400 border-rose-500/40 bg-rose-500/10'
};

export function PerformanceAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Review Selection State
  const reviewIdParam = searchParams.get('reviewId') || '';
  const [reviewsList, setReviewsList] = useState([]);
  const [selectedReviewId, setSelectedReviewId] = useState(reviewIdParam);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  // Performance Analysis State
  const [perfData, setPerfData] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorState, setErrorState] = useState(null);

  // Filters State
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [sortOption, setSortOption] = useState('severity_desc');

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
      console.warn('[PerformanceAnalysis] Failed to load reviews list:', err);
    } finally {
      setIsLoadingReviews(false);
    }
  }, [reviewIdParam]);

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
   * 2. Fetch Performance Analysis from GET /api/v1/reviews/:id/performance
   */
  const fetchPerformanceAnalysis = useCallback(
    async (id) => {
      if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return;
      }

      setIsLoadingData(true);
      setErrorState(null);

      try {
        const queryParams = {
          sort: sortOption
        };
        if (severityFilter !== 'ALL') {
          queryParams.severity = severityFilter;
        }
        if (sourceFilter !== 'ALL') {
          queryParams.source = sourceFilter;
        }

        const res = await apiClient.getPerformanceReview(id, queryParams);

        if (res && res.success && res.data) {
          setPerfData(res.data);
        } else {
          throw new Error(res?.message || 'Failed to retrieve performance analysis');
        }
      } catch (err) {
        console.error('[PerformanceAnalysis] Fetch error:', err);
        setErrorState(
          err.message || 'Failed to load performance telemetry. Please check server connection.'
        );
      } finally {
        setIsLoadingData(false);
      }
    },
    [severityFilter, sourceFilter, sortOption]
  );

  useEffect(() => {
    if (selectedReviewId) {
      fetchPerformanceAnalysis(selectedReviewId);
    }
  }, [selectedReviewId, fetchPerformanceAnalysis]);

  const handleSelectReview = (e) => {
    const newId = e.target.value;
    setSelectedReviewId(newId);
    setSearchParams(newId ? { reviewId: newId } : {});
  };

  const handleRefresh = () => {
    if (selectedReviewId) {
      fetchPerformanceAnalysis(selectedReviewId);
    }
  };

  const selectedReviewMeta = reviewsList.find((r) => r._id === selectedReviewId);

  return (
    <div className="space-y-6" data-testid="performance-analysis-page">
      <PageHeader
        title="Performance & Algorithmic Analysis"
        description="Deep Big-O complexity evaluation, memory allocation audits, and runtime bottlenecks detection."
        icon={Cpu}
        badgeText="Roadmap Phase 10"
        badgeVariant="sky"
      />

      {/* Review Selector Toolbar */}
      <Card className="p-4 bg-surface-secondary/70 border-border-subtle">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <FolderOpen className="w-4 h-4 text-brand-primary shrink-0" />
            <span className="text-xs font-medium text-text-secondary whitespace-nowrap">
              Active Review:
            </span>

            {isLoadingReviews ? (
              <div className="text-xs text-text-muted flex items-center gap-1.5">
                <LoadingSpinner size="sm" />
                <span>Loading review catalog...</span>
              </div>
            ) : reviewsList.length === 0 ? (
              <span className="text-xs text-text-muted">
                No past reviews found.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/code-review')}
                  className="text-brand-primary hover:underline"
                >
                  Analyze your first file
                </button>
              </span>
            ) : (
              <div className="relative flex-1 max-w-md">
                <select
                  value={selectedReviewId}
                  onChange={handleSelectReview}
                  data-testid="review-selector"
                  className="w-full bg-surface-primary border border-border-subtle rounded-md px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary cursor-pointer pr-8"
                >
                  {reviewsList.map((rev) => (
                    <option key={rev._id} value={rev._id}>
                      {rev.title || `Review of ${rev.filename || 'snippet'}`} ({rev.language.toUpperCase()}) —{' '}
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {selectedReviewId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoadingData}
                className="text-xs"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 mr-1.5 ${isLoadingData ? 'animate-spin' : ''}`}
                />
                <span>Refresh</span>
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/code-review')}
              className="text-xs"
            >
              <span>New Review</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {isLoadingData && (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-xs text-text-muted">
            Evaluating algorithmic Big-O complexity and memory allocations...
          </p>
        </div>
      )}

      {/* Error Banner */}
      {!isLoadingData && errorState && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorState}</span>
          </div>
          <Button variant="outline" size="xs" onClick={handleRefresh}>
            Retry
          </Button>
        </div>
      )}

      {/* Main Performance Telemetry Dashboard */}
      {!isLoadingData && !errorState && perfData && (
        <div className="space-y-6">
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Time Complexity Card */}
            <Card className="p-4 border-status-info/20 bg-surface-secondary/70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Clock className="w-4 h-4 text-status-info" />
                  <span>Time Complexity</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-tertiary text-text-muted border border-border-subtle">
                  {perfData.complexityType === 'ai-assisted'
                    ? 'AI-Assisted'
                    : 'Deterministic'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <ComplexityBadge
                  complexity={perfData.timeComplexity}
                  size="lg"
                  showLabel
                />
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                Worst-case asymptotic runtime upper bound
              </p>
            </Card>

            {/* Space Complexity Card */}
            <Card className="p-4 border-status-info/20 bg-surface-secondary/70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Activity className="w-4 h-4 text-status-info" />
                  <span>Space Complexity</span>
                </div>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-tertiary text-text-muted border border-border-subtle">
                  Auxiliary
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <ComplexityBadge
                  complexity={perfData.spaceComplexity}
                  size="lg"
                />
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                Heap buffers, collections & recursive stack
              </p>
            </Card>

            {/* Performance Health Score Card */}
            <Card className="p-4 border-status-info/20 bg-surface-secondary/70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Zap className="w-4 h-4 text-status-warning" />
                  <span>Performance Score</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-mono font-bold ${
                    GRADE_COLORS[perfData.performanceGrade] || GRADE_COLORS.C
                  }`}
                >
                  Grade {perfData.performanceGrade}
                </span>
              </div>
              <div className="text-2xl font-bold font-mono text-text-primary">
                {perfData.performanceScore}
                <span className="text-xs text-text-muted font-normal"> / 100</span>
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                Algorithmic efficiency & loop optimization rating
              </p>
            </Card>

            {/* Bottlenecks Count Card */}
            <Card className="p-4 border-status-info/20 bg-surface-secondary/70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <AlertTriangle className="w-4 h-4 text-status-danger" />
                  <span>Bottlenecks Detected</span>
                </div>
                <Badge
                  variant={perfData.totalPerformanceIssues > 0 ? 'amber' : 'emerald'}
                  size="xs"
                >
                  {perfData.totalPerformanceIssues} Total
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold font-mono text-text-primary">
                  {perfData.severityCounts.CRITICAL + perfData.severityCounts.HIGH}
                </span>
                <span className="text-xs text-rose-400 font-medium">Critical/High</span>
              </div>
              <p className="text-[11px] text-text-muted mt-2">
                {perfData.severityCounts.MEDIUM} Medium, {perfData.severityCounts.LOW} Low
              </p>
            </Card>
          </div>

          {/* Complexity Spectrum Visualization */}
          <ComplexityScale currentComplexity={perfData.timeComplexity} />

          {/* Filter & Sort Toolbar */}
          <Card className="p-3 bg-surface-secondary/70 border-border-subtle">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Severity Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Filter className="w-3.5 h-3.5 text-text-muted mr-1" />
                <span className="text-text-muted mr-1">Severity:</span>
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      severityFilter === sev
                        ? 'bg-brand-primary text-white'
                        : 'bg-surface-primary text-text-secondary hover:text-text-primary border border-border-subtle'
                    }`}
                  >
                    {sev === 'ALL'
                      ? `All (${perfData.totalPerformanceIssues})`
                      : `${sev} (${perfData.severityCounts[sev] || 0})`}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Sort:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="bg-surface-primary border border-border-subtle rounded px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-brand-primary cursor-pointer"
                >
                  <option value="severity_desc">Severity (Highest First)</option>
                  <option value="line_asc">Line Number (Ascending)</option>
                  <option value="line_desc">Line Number (Descending)</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Bottlenecks List / Empty State */}
          <div className="space-y-3">
            {perfData.issues.length === 0 ? (
              <Card className="p-8 text-center bg-surface-secondary/40 border-border-subtle space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-text-primary">
                  {severityFilter !== 'ALL'
                    ? `No ${severityFilter} Bottlenecks Found`
                    : 'Clean Algorithmic Profile — Zero Bottlenecks'}
                </h3>
                <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
                  {severityFilter !== 'ALL'
                    ? 'No performance issues match the selected severity filter. Try choosing "All".'
                    : `This file contains no polynomial loops, quadratic string operations, or recursive stack overflows. Execution profile operates in ${perfData.timeComplexity} time.`}
                </p>
              </Card>
            ) : (
              perfData.issues.map((finding) => (
                <BottleneckCard
                  key={finding._id || `${finding.ruleId}-${finding.lineStart}`}
                  finding={finding}
                  reviewId={perfData.reviewId}
                  language={perfData.language}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PerformanceAnalysis;
