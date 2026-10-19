import React, { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, useInRouterContext } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  GitCompare,
  Split,
  CheckCheck,
  FileDiff,
  FolderOpen,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  FileCode2,
  CheckCircle2
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { EditorLoadingState } from '../components/editor/EditorLoadingState';

// Lazy-load MonacoDiffWrapper to avoid bundling Monaco in the initial page load
const MonacoDiffWrapper = React.lazy(
  () => import('../components/editor/MonacoDiffWrapper')
);

const GRADE_COLORS = {
  A: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  B: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  C: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  D: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  F: 'text-rose-400 border-rose-500/40 bg-rose-500/10'
};

export function computeDiffStats(originalStr = '', modifiedStr = '') {
  if (!originalStr && !modifiedStr) return { added: 0, removed: 0 };
  if (originalStr === modifiedStr) return { added: 0, removed: 0 };

  const origLines = originalStr ? originalStr.split(/\r?\n/) : [];
  const modLines = modifiedStr ? modifiedStr.split(/\r?\n/) : [];

  const origSet = new Set(origLines);
  const modSet = new Set(modLines);

  let added = 0;
  for (const line of modLines) {
    if (!origSet.has(line)) added++;
  }
  let removed = 0;
  for (const line of origLines) {
    if (!modSet.has(line)) removed++;
  }

  return { added, removed };
}

export function CodeComparison(props) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <CodeComparisonRouterWrapper {...props} />;
  }
  const defaultParams = new URLSearchParams();
  return <CodeComparisonContent {...props} searchParams={defaultParams} setSearchParams={() => {}} />;
}

function CodeComparisonRouterWrapper(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  return <CodeComparisonContent {...props} searchParams={searchParams} setSearchParams={setSearchParams} />;
}

function CodeComparisonContent({ searchParams, setSearchParams }) {
  const navigate = useNavigate();
  const reviewIdParam = searchParams.get('reviewId') || '';

  // Review Selection State
  const [reviewsList, setReviewsList] = useState([]);
  const [selectedReviewId, setSelectedReviewId] = useState(reviewIdParam);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  // Review Details State
  const [reviewData, setReviewData] = useState(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // View Options State
  const [renderSideBySide, setRenderSideBySide] = useState(true);
  const [copiedModified, setCopiedModified] = useState(false);

  /**
   * 1. Load User's Reviews for Selector Dropdown
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
      console.warn('[CodeComparison] Failed to load reviews list:', err);
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
   * 2. Fetch Review Details by ID
   */
  const fetchReviewDetails = useCallback(async (id) => {
    if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return;
    }

    setIsLoadingReview(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.getReviewById(id);
      if (res && res.success && res.data) {
        setReviewData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to retrieve review details');
      }
    } catch (err) {
      console.error('[CodeComparison] Fetch error:', err);
      setErrorMessage(
        err.status === 404
          ? 'Review not found or you do not have permission to view it.'
          : err.message || 'Failed to load code comparison.'
      );
    } finally {
      setIsLoadingReview(false);
    }
  }, []);

  useEffect(() => {
    if (selectedReviewId) {
      fetchReviewDetails(selectedReviewId);
    }
  }, [selectedReviewId, fetchReviewDetails]);

  // Handle Review Selector Change
  const handleSelectReview = (e) => {
    const newId = e.target.value;
    setSelectedReviewId(newId);
    if (setSearchParams) {
      setSearchParams({ reviewId: newId });
    }
  };

  // Extract Comparison Code
  const review = reviewData?.review || null;
  const analysis = reviewData?.analysis || null;

  const originalCode = review?.rawCode || '';
  const modifiedCode = review?.currentCode || analysis?.suggestedCode || null;

  const hasModifications = Boolean(
    modifiedCode && modifiedCode.trim().length > 0 && modifiedCode !== originalCode
  );

  const diffMode = review?.currentCode && review.currentCode !== review.rawCode
    ? 'applied-fixes'
    : analysis?.suggestedCode && analysis.suggestedCode !== review.rawCode
    ? 'ai-refactored'
    : 'none';

  const diffStats = useMemo(
    () => computeDiffStats(originalCode, modifiedCode || originalCode),
    [originalCode, modifiedCode]
  );

  const handleCopyModified = async () => {
    if (!modifiedCode) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(modifiedCode);
        setCopiedModified(true);
        setTimeout(() => setCopiedModified(false), 2000);
      }
    } catch (err) {
      console.warn('[CodeComparison] Copy failed:', err);
    }
  };

  const handleOpenWorkspace = () => {
    if (selectedReviewId) {
      navigate(`/code-review?reviewId=${selectedReviewId}`);
    }
  };

  const grade = analysis?.grade || review?.grade || 'A';
  const gradeBadgeStyle = GRADE_COLORS[grade] || GRADE_COLORS.C;
  const score = analysis?.overallScore ?? review?.overallScore ?? 100;

  return (
    <div className="space-y-4" data-testid="code-comparison-page">
      {/* Page Header */}
      <PageHeader
        title="Side-by-Side Code Comparison"
        description="Dual-pane visual diff comparison contrasting original submitted source code against applied fixes and refactored implementations."
        icon={GitCompare}
        badgeText="Interactive Monaco Diff Engine"
        badgeVariant="indigo"
      />

      {/* Review Selector Dropdown Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-surface-secondary border border-border-subtle shadow-elevated">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <FolderOpen className="w-4 h-4 text-brand-primary shrink-0" />
          <span className="text-xs font-semibold text-text-primary shrink-0">
            Select Review:
          </span>

          {isLoadingReviews ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <LoadingSpinner size="xs" />
              <span>Loading review archives...</span>
            </div>
          ) : reviewsList.length === 0 ? (
            <span className="text-xs text-text-muted italic">
              No saved reviews found in audit history
            </span>
          ) : (
            <div className="relative flex-1 max-w-md">
              <select
                aria-label="Select review for comparison"
                data-testid="review-selector-dropdown"
                value={selectedReviewId}
                onChange={handleSelectReview}
                className="w-full appearance-none bg-surface-primary border border-border-subtle rounded-md px-3 py-1.5 pr-8 text-xs font-mono text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer truncate"
              >
                {reviewsList.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.title} ({r.language?.toUpperCase()} • {r.filename || 'snippet'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Global Action Shortcuts */}
        <div className="flex items-center gap-2 shrink-0">
          {selectedReviewId && (
            <button
              type="button"
              onClick={handleOpenWorkspace}
              data-testid="open-workspace-btn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              title="Open review in full workspace"
            >
              <span>Open in Workspace</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => selectedReviewId && fetchReviewDetails(selectedReviewId)}
            disabled={isLoadingReview || !selectedReviewId}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh review diff"
            aria-label="Refresh comparison"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReview ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
            className="p-1 rounded hover:bg-rose-500/20 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Diff Content Container */}
      {isLoadingReview ? (
        <div className="h-96 flex flex-col items-center justify-center p-8 text-center bg-surface-secondary border border-border-subtle rounded-lg shadow-elevated">
          <LoadingSpinner size="md" />
          <p className="text-xs text-text-secondary mt-3 font-medium">
            Loading side-by-side diff models and syntax tokenizer...
          </p>
        </div>
      ) : !selectedReviewId || reviewsList.length === 0 ? (
        <div className="p-8 text-center bg-surface-secondary border border-border-subtle rounded-lg shadow-elevated">
          <div className="w-12 h-12 rounded-full bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary mx-auto mb-3">
            <GitCompare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">No Reviews to Compare</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto leading-relaxed">
            Run a code review in the workspace first to generate review records, apply fixes, and inspect side-by-side code diffs.
          </p>
          <button
            type="button"
            onClick={() => navigate('/code-review')}
            className="mt-4 px-3.5 py-1.5 rounded bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold cursor-pointer shadow-sm shadow-brand-primary/20 transition-colors"
          >
            Launch Review Workspace
          </button>
        </div>
      ) : !hasModifications ? (
        /* Review with zero applied fixes or refactorings */
        <div
          data-testid="no-modifications-state"
          className="p-8 text-center bg-surface-secondary border border-border-subtle rounded-lg shadow-elevated space-y-3"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">
            No Code Changes to Compare
          </h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto leading-relaxed">
            The code in <strong className="text-text-primary">{review?.title}</strong> matches the original submission exactly with <strong className="text-text-primary">0 applied fixes</strong>.
          </p>

          {/* Review Metadata Chip Row */}
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            <Badge variant="indigo" size="xs" mono>
              {review?.language || 'python'}
            </Badge>
            <span className="text-xs text-text-muted font-mono">
              {review?.lineCount || 0} LOC
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${gradeBadgeStyle}`}>
              Grade {grade} ({score}%)
            </span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenWorkspace}
              className="px-4 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold cursor-pointer shadow-sm shadow-brand-primary/20 transition-colors"
            >
              Apply Fixes in Workspace
            </button>
          </div>
        </div>
      ) : (
        /* Active Diff Comparison Workstation */
        <div className="flex flex-col rounded-lg border border-border-subtle bg-surface-primary shadow-elevated overflow-hidden">
          {/* Top Diff Command Bar */}
          <div className="h-12 bg-surface-secondary border-b border-border-subtle px-4 flex items-center justify-between gap-3 overflow-x-auto select-none shrink-0">
            {/* Left: Metadata & Diff Type Badge */}
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="font-semibold text-xs text-text-primary font-mono truncate max-w-[200px] sm:max-w-[280px]">
                {review?.title}
              </span>

              <Badge variant="indigo" size="xs" mono>
                {review?.language}
              </Badge>

              {diffMode === 'applied-fixes' ? (
                <span
                  data-testid="diff-mode-applied-fixes"
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>Working Code ({review?.appliedFixes?.length || 1} Fixes Applied)</span>
                </span>
              ) : (
                <span
                  data-testid="diff-mode-ai-refactored"
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-accent/15 text-indigo-300 border border-brand-accent/40"
                >
                  <Sparkles className="w-3 h-3 text-brand-accent" />
                  <span>AI Refactored Recommendation</span>
                </span>
              )}
            </div>

            {/* Right: Diff Stats & Layout Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Diff Stats (Added / Removed) */}
              <div
                data-testid="diff-stats-strip"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-primary border border-border-subtle/80 text-xs font-mono"
              >
                <span className="text-emerald-400 font-semibold" title="Lines added">
                  +{diffStats.added}
                </span>
                <span className="text-text-muted">/</span>
                <span className="text-rose-400 font-semibold" title="Lines removed">
                  -{diffStats.removed}
                </span>
              </div>

              {/* Side-by-Side vs Inline Toggle */}
              <button
                type="button"
                onClick={() => setRenderSideBySide(!renderSideBySide)}
                data-testid="toggle-split-view-button"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  renderSideBySide
                    ? 'bg-brand-primary/15 border-brand-primary/40 text-brand-primary'
                    : 'bg-surface-primary hover:bg-surface-tertiary border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
                title={renderSideBySide ? 'Switch to inline diff view' : 'Switch to split side-by-side view'}
              >
                <Split className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {renderSideBySide ? 'Side-by-Side' : 'Inline'}
                </span>
              </button>

              {/* Copy Modified Code */}
              <button
                type="button"
                onClick={handleCopyModified}
                data-testid="copy-modified-code-button"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                  copiedModified
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-surface-primary hover:bg-surface-tertiary border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
                title="Copy modified code to clipboard"
                aria-label="Copy modified code"
              >
                {copiedModified ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-text-muted" />
                    <span className="hidden sm:inline">Copy Fix</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Panel Column Headers */}
          <div className="grid grid-cols-2 bg-surface-secondary/50 border-b border-border-subtle text-xs font-mono select-none shrink-0">
            <div className="px-4 py-2 border-r border-border-subtle flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span className="text-text-secondary font-semibold">
                  Original Submitted Code (rawCode)
                </span>
              </div>
              <span className="text-[10px] text-text-muted uppercase">Read-Only</span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-text-secondary font-semibold">
                  Modified Code (currentCode)
                </span>
              </div>
              <span className="text-[10px] text-text-muted uppercase">Read-Only</span>
            </div>
          </div>

          {/* Monaco Diff Editor Workstation Canvas */}
          <div className="h-[calc(100vh-17.5rem)] min-h-[520px] relative w-full bg-canvas">
            <Suspense fallback={<EditorLoadingState />}>
              <MonacoDiffWrapper
                original={originalCode}
                modified={modifiedCode}
                language={review?.language || 'python'}
                renderSideBySide={renderSideBySide}
                height="100%"
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* Contextual Architecture & Safety Guides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        <Card className="text-xs p-3.5">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-1.5">
            <Split className="w-4 h-4 text-brand-primary" />
            <span>Dual-Pane Viewport</span>
          </div>
          <p className="text-text-secondary leading-relaxed text-[11px]">
            Side-by-side comparison displaying original baseline code on the left and active modified code on the right with synchronised line scroll.
          </p>
        </Card>

        <Card className="text-xs p-3.5">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-1.5">
            <FileDiff className="w-4 h-4 text-brand-accent" />
            <span>Visual Hunk Markers</span>
          </div>
          <p className="text-text-secondary leading-relaxed text-[11px]">
            Red highlights signal vulnerable or suboptimal lines removed; emerald green highlights represent applied secure replacements.
          </p>
        </Card>

        <Card className="text-xs p-3.5">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Data Integrity Protection</span>
          </div>
          <p className="text-text-secondary leading-relaxed text-[11px]">
            Both panes operate strictly read-only. Comparing code never mutates database records, review scores, or original submission audits.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default CodeComparison;
