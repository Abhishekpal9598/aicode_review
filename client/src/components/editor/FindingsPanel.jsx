import React, { useState } from 'react';
import { useNavigate, useInRouterContext } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  X,
  FileCode,
  Layers,
  ArrowRight,
  Bot,
  Clock,
  Cpu,
  RotateCw,
  Code2
} from 'lucide-react';
import { Badge } from '../ui/Badge';

const SEVERITY_COLORS = {
  CRITICAL: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    badge: 'rose'
  },
  HIGH: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'amber'
  },
  MEDIUM: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    badge: 'yellow'
  },
  LOW: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    badge: 'blue'
  },
  INFO: {
    bg: 'bg-surface-tertiary',
    border: 'border-border-subtle',
    text: 'text-text-muted',
    badge: 'slate'
  }
};

const GRADE_COLORS = {
  A: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  B: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  C: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  D: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  F: 'text-rose-400 border-rose-500/40 bg-rose-500/10'
};

export function FindingsPanel(props) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <FindingsPanelWithRouter {...props} />;
  }
  return <FindingsPanelBase {...props} navigate={null} />;
}

function FindingsPanelWithRouter(props) {
  const navigate = useNavigate();
  return <FindingsPanelBase {...props} navigate={navigate} />;
}

function FindingsPanelBase({
  analysisResult,
  isStale = false,
  onSelectFinding,
  onClose,
  activeFindingId,
  onRetryReview,
  onRequestApplyFix,
  appliedFixIds = [],
  onUndoFix,
  navigate
}) {
  const [activeTab, setActiveTab] = useState('findings'); // 'findings' | 'refactoring'
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedRefactoredCode, setCopiedRefactoredCode] = useState(false);

  if (!analysisResult) return null;

  // Extract and validate persistent reviewId for security dashboard navigation
  const persistedReviewId = (
    analysisResult?.review?._id?.toString?.() ||
    analysisResult?.review?.id?.toString?.() ||
    analysisResult?.analysis?.reviewId?.toString?.() ||
    null
  );
  const hasValidPersistedId = typeof persistedReviewId === 'string' && /^[0-9a-fA-F]{24}$/.test(persistedReviewId);

  const handleSecurityNav = (e) => {
    if (navigate && hasValidPersistedId) {
      e.preventDefault();
      navigate(`/security?reviewId=${encodeURIComponent(persistedReviewId)}`);
    }
  };

  const handlePerformanceNav = (e) => {
    if (navigate && hasValidPersistedId) {
      e.preventDefault();
      navigate(`/performance?reviewId=${encodeURIComponent(persistedReviewId)}`);
    }
  };

  // Normalization: Support both Phase 8 persistent result ({ review, analysis, issues })
  // and Phase 7 transient static result ({ scoring, metrics, findings })
  const isPersistent = Boolean(analysisResult.analysis);

  let overallScore = 100;
  let grade = 'A';
  let staticScore = 100;
  let aiAvailable = false;
  let reviewMode = 'static';
  let summary = null;
  let timeComplexity = null;
  let spaceComplexity = null;
  let suggestedCode = null;
  let refactoringRationale = null;
  let totalLines = 0;
  let executionTimeMs = 0;
  let rawFindings = [];
  let severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let aiCategoryScores = null;

  if (isPersistent) {
    const analysis = analysisResult.analysis;
    const review = analysisResult.review || {};
    overallScore = analysis.overallScore ?? 100;
    grade = analysis.grade || 'A';
    staticScore = analysis.staticScore ?? 100;
    aiAvailable = Boolean(analysis.aiAvailable);
    reviewMode = review.reviewMode || (aiAvailable ? 'hybrid' : 'static-fallback');
    summary = analysis.summary || null;
    timeComplexity = analysis.timeComplexity || null;
    spaceComplexity = analysis.spaceComplexity || null;
    suggestedCode = analysis.suggestedCode || null;
    refactoringRationale = analysis.refactoringRationale || null;
    totalLines = review.lineCount || 0;
    executionTimeMs = analysis.executionTimeMs || 0;
    aiCategoryScores = analysis.metrics || null;

    rawFindings = (analysisResult.issues || []).map((issue, idx) => ({
      id: issue._id || issue.id || `issue-${idx}`,
      ruleId: issue.ruleId || null,
      source: issue.source || (issue.ruleId ? 'static' : 'gemini'),
      category: issue.category || 'quality',
      severity: (issue.severity || 'INFO').toUpperCase(),
      title: issue.title || 'Code Issue',
      explanation: issue.explanation || issue.description || '',
      lineStart: issue.lineStart || 1,
      lineEnd: issue.lineEnd || issue.lineStart || 1,
      columnStart: issue.columnStart || 1,
      columnEnd: issue.columnEnd || 1,
      originalSnippet: issue.originalSnippet || '',
      suggestedSnippet: issue.suggestedSnippet || '',
      cwe: issue.cwe || null,
      owaspCategory: issue.owaspCategory || null,
      confidence: issue.confidence || null,
      remediation: issue.remediation || ''
    }));

    if (analysis.metrics?.issueCounts) {
      severityCounts = {
        critical: analysis.metrics.issueCounts.critical || 0,
        high: analysis.metrics.issueCounts.high || 0,
        medium: analysis.metrics.issueCounts.medium || 0,
        low: analysis.metrics.issueCounts.low || 0,
        info: analysis.metrics.issueCounts.info || 0
      };
    }
  } else {
    // Phase 7 transient static structure
    const scoring = analysisResult.scoring || {};
    const metrics = analysisResult.metrics || {};
    overallScore = scoring.overallScore ?? 100;
    grade = scoring.grade || 'A';
    staticScore = overallScore;
    aiAvailable = false;
    reviewMode = 'static';
    totalLines = metrics.totalLines || 0;
    executionTimeMs = metrics.executionTimeMs || 1;
    rawFindings = (analysisResult.findings || []).map((f, idx) => ({
      ...f,
      id: f.id || `${f.ruleId || 'finding'}-${f.lineStart || idx}`,
      source: 'static',
      cwe: f.cwe || null,
      owaspCategory: f.owaspCategory || null,
      confidence: f.confidence || null,
      remediation: f.remediation || ''
    }));
    severityCounts = metrics.severityCounts || {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };
  }

  // Calculate counts if not pre-populated
  if (
    severityCounts.critical === 0 &&
    severityCounts.high === 0 &&
    severityCounts.medium === 0 &&
    severityCounts.low === 0 &&
    severityCounts.info === 0 &&
    rawFindings.length > 0
  ) {
    rawFindings.forEach((f) => {
      const s = (f.severity || '').toLowerCase();
      if (severityCounts[s] !== undefined) {
        severityCounts[s] += 1;
      }
    });
  }

  const handleCopyFix = async (e, finding) => {
    e.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText && finding.suggestedSnippet) {
        await navigator.clipboard.writeText(finding.suggestedSnippet);
        setCopiedId(finding.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (err) {
      console.warn('[FindingsPanel] Copy fix failed:', err);
    }
  };

  const handleCopyRefactoredCode = async () => {
    if (!suggestedCode) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(suggestedCode);
        setCopiedRefactoredCode(true);
        setTimeout(() => setCopiedRefactoredCode(false), 2000);
      }
    } catch (err) {
      console.warn('[FindingsPanel] Copy refactored code failed:', err);
    }
  };

  // Filter findings based on active filters
  const filteredFindings = rawFindings.filter((f) => {
    if (severityFilter !== 'ALL' && f.severity?.toUpperCase() !== severityFilter) {
      return false;
    }
    if (categoryFilter !== 'ALL' && (f.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  const gradeColor = GRADE_COLORS[grade] || GRADE_COLORS.C;
  const hasRefactoring = Boolean(suggestedCode || refactoringRationale);

  return (
    <div
      data-testid="findings-panel"
      className="flex flex-col h-full bg-surface-secondary border-l border-border-subtle w-full max-w-md lg:max-w-lg xl:max-w-xl select-none"
    >
      {/* Top Header Strip */}
      <div className="p-4 border-b border-border-subtle bg-surface-primary/80 backdrop-blur-sm flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-lg border flex flex-col items-center justify-center font-bold text-lg shrink-0 ${gradeColor}`}
            title={`Overall Grade: ${grade}`}
          >
            <span>{grade}</span>
            <span className="text-[9px] -mt-1 font-mono font-medium opacity-80">
              {overallScore}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-semibold text-text-primary">
                {isPersistent ? 'Review Results' : 'Static Analysis Results'}
              </h3>
              {isPersistent && (
                <span
                  data-testid="review-mode-badge"
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${
                    reviewMode === 'hybrid'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {reviewMode === 'hybrid' ? 'Hybrid Mode' : 'Static Fallback'}
                </span>
              )}
              {isPersistent && (
                <span
                  data-testid="ai-status-badge"
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    aiAvailable
                      ? 'bg-brand-accent/15 text-indigo-300 border-brand-accent/40'
                      : 'bg-surface-tertiary text-text-muted border-border-subtle'
                  }`}
                >
                  {aiAvailable ? 'AI Active' : 'AI Offline'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {totalLines > 0 ? `Analyzed ${totalLines} lines` : 'Completed'} in {executionTimeMs || 1}ms
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasValidPersistedId && (
            <>
              <a
                href={`/security?reviewId=${encodeURIComponent(persistedReviewId)}`}
                onClick={handleSecurityNav}
                data-testid="view-security-dashboard-btn"
                title="Open dedicated Security Dashboard for this review"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs text-rose-300 font-medium transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Security</span>
              </a>

              <a
                href={`/performance?reviewId=${encodeURIComponent(persistedReviewId)}`}
                onClick={handlePerformanceNav}
                data-testid="view-performance-dashboard-btn"
                title="Open dedicated Performance & Big-O Dashboard for this review"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-xs text-sky-300 font-medium transition-colors cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Performance</span>
              </a>
            </>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close findings panel"
              className="p-1.5 rounded hover:bg-surface-tertiary text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Fallback Warning Notice (When Gemini was unavailable or failed) */}
      {isPersistent && !aiAvailable && (
        <div
          role="status"
          data-testid="fallback-alert-banner"
          className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] leading-relaxed">
              AI analysis was unavailable (timeout/quota). Deterministic static audit was completed and saved.
            </span>
          </div>
          {onRetryReview && (
            <button
              type="button"
              onClick={onRetryReview}
              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-semibold text-amber-200 transition-colors cursor-pointer shrink-0"
            >
              Retry AI Review
            </button>
          )}
        </div>
      )}

      {/* Stale Warning Notice */}
      {isStale && (
        <div
          role="status"
          className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2 shrink-0"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[11px]">
              Source modified since analysis. Findings may be outdated.
            </span>
          </div>
        </div>
      )}

      {/* Dual Score / Category Metrics Strip */}
      {isPersistent ? (
        <div className="p-3 bg-surface-tertiary/40 border-b border-border-subtle shrink-0">
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div className="p-2 rounded bg-surface-primary border border-border-subtle/80 flex flex-col">
              <span className="text-[10px] text-text-muted uppercase font-semibold">Static Engine</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base font-bold text-text-primary" data-testid="static-score-display">
                  {staticScore}%
                </span>
                <span className="text-[10px] text-text-secondary">40% weight</span>
              </div>
            </div>

            <div className="p-2 rounded bg-surface-primary border border-border-subtle/80 flex flex-col">
              <span className="text-[10px] text-text-muted uppercase font-semibold">Gemini AI</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-base font-bold text-brand-accent" data-testid="ai-score-display">
                  {aiAvailable && aiCategoryScores?.aiCompositeScore !== null && aiCategoryScores?.aiCompositeScore !== undefined
                    ? `${aiCategoryScores.aiCompositeScore}%`
                    : 'N/A'}
                </span>
                <span className="text-[10px] text-text-secondary">
                  {aiAvailable ? '60% weight' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* AI Category Sub-scores */}
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
            <div className="p-1.5 rounded bg-surface-primary/70 border border-border-subtle/50">
              <span className="text-[9px] text-text-muted uppercase block">Bug</span>
              <span className="text-xs font-semibold text-text-primary mt-0.5 block" data-testid="bug-score-display">
                {aiAvailable && aiCategoryScores?.bugScore !== null && aiCategoryScores?.bugScore !== undefined
                  ? `${aiCategoryScores.bugScore}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="p-1.5 rounded bg-surface-primary/70 border border-border-subtle/50">
              <span className="text-[9px] text-text-muted uppercase block">Security</span>
              <span className="text-xs font-semibold text-text-primary mt-0.5 block" data-testid="security-score-display">
                {aiAvailable && aiCategoryScores?.securityScore !== null && aiCategoryScores?.securityScore !== undefined
                  ? `${aiCategoryScores.securityScore}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="p-1.5 rounded bg-surface-primary/70 border border-border-subtle/50">
              <span className="text-[9px] text-text-muted uppercase block">Perf</span>
              <span className="text-xs font-semibold text-text-primary mt-0.5 block" data-testid="perf-score-display">
                {aiAvailable && aiCategoryScores?.performanceScore !== null && aiCategoryScores?.performanceScore !== undefined
                  ? `${aiCategoryScores.performanceScore}%`
                  : 'N/A'}
              </span>
            </div>
            <div className="p-1.5 rounded bg-surface-primary/70 border border-border-subtle/50">
              <span className="text-[9px] text-text-muted uppercase block">Maint</span>
              <span className="text-xs font-semibold text-text-primary mt-0.5 block" data-testid="maint-score-display">
                {aiAvailable && aiCategoryScores?.maintainabilityScore !== null && aiCategoryScores?.maintainabilityScore !== undefined
                  ? `${aiCategoryScores.maintainabilityScore}%`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Phase 7 Category Score Overview Cards */
        <div className="grid grid-cols-3 gap-2 p-3 bg-surface-tertiary/40 border-b border-border-subtle text-xs shrink-0">
          <div className="p-2 rounded bg-surface-primary border border-border-subtle/80 flex flex-col">
            <span className="text-[10px] text-text-muted uppercase font-semibold">Security</span>
            <span className="text-sm font-bold text-text-primary mt-0.5">
              {analysisResult.scoring?.categoryScores?.security ?? 100}%
            </span>
            <span className="text-[10px] text-text-secondary mt-0.5">
              {analysisResult.metrics?.securityFindings || 0} issues
            </span>
          </div>

          <div className="p-2 rounded bg-surface-primary border border-border-subtle/80 flex flex-col">
            <span className="text-[10px] text-text-muted uppercase font-semibold">Risky Code</span>
            <span className="text-sm font-bold text-text-primary mt-0.5">
              {analysisResult.scoring?.categoryScores?.risk ?? 100}%
            </span>
            <span className="text-[10px] text-text-secondary mt-0.5">
              {analysisResult.metrics?.riskFindings || 0} issues
            </span>
          </div>

          <div className="p-2 rounded bg-surface-primary border border-border-subtle/80 flex flex-col">
            <span className="text-[10px] text-text-muted uppercase font-semibold">Code Quality</span>
            <span className="text-sm font-bold text-text-primary mt-0.5">
              {analysisResult.scoring?.categoryScores?.quality ?? 100}%
            </span>
            <span className="text-[10px] text-text-secondary mt-0.5">
              {analysisResult.metrics?.qualityFindings || 0} issues
            </span>
          </div>
        </div>
      )}

      {/* Algorithmic Complexity Chips (When available) */}
      {(timeComplexity || spaceComplexity) && (
        <div className="px-4 py-2 bg-surface-primary border-b border-border-subtle flex items-center gap-2 text-xs shrink-0" data-testid="complexity-chips">
          <span className="text-[10px] text-text-muted uppercase font-semibold">Complexity:</span>
          {timeComplexity && (
            <span
              data-testid="time-complexity-chip"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-primary/10 border border-brand-primary/30 text-brand-primary text-xs font-mono font-medium"
            >
              <Clock className="w-3 h-3 text-brand-primary shrink-0" />
              <span>Time: {timeComplexity}</span>
            </span>
          )}
          {spaceComplexity && (
            <span
              data-testid="space-complexity-chip"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-accent/10 border border-brand-accent/30 text-indigo-300 text-xs font-mono font-medium"
            >
              <Cpu className="w-3 h-3 text-brand-accent shrink-0" />
              <span>Space: {spaceComplexity}</span>
            </span>
          )}
        </div>
      )}

      {/* Main Drawer Tabs: Audit Findings vs. Suggested Refactoring */}
      {hasRefactoring && (
        <div className="flex border-b border-border-subtle bg-surface-primary shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('findings')}
            className={`flex-1 py-2.5 px-3 text-center font-semibold transition-colors cursor-pointer border-b-2 ${
              activeTab === 'findings'
                ? 'border-brand-primary text-text-primary bg-surface-secondary/40'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            Audit Findings ({rawFindings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('refactoring')}
            data-testid="tab-suggested-refactoring"
            className={`flex-1 py-2.5 px-3 text-center font-semibold transition-colors cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === 'refactoring'
                ? 'border-brand-accent text-indigo-300 bg-surface-secondary/40'
                : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-accent shrink-0" />
            <span>Suggested Refactoring</span>
          </button>
        </div>
      )}

      {/* TAB 1: AUDIT FINDINGS */}
      {activeTab === 'findings' && (
        <>
          {/* Summary Callout (If AI generated a summary) */}
          {summary && (
            <div className="px-3.5 py-2.5 bg-surface-primary/70 border-b border-border-subtle text-xs shrink-0">
              <span className="text-[10px] text-text-muted uppercase font-semibold block mb-0.5">
                AI Summary
              </span>
              <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-3">
                {summary}
              </p>
            </div>
          )}

          {/* Severity & Category Filter Bar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border-subtle bg-surface-primary/50 overflow-x-auto text-xs shrink-0">
            <button
              type="button"
              onClick={() => setSeverityFilter('ALL')}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                severityFilter === 'ALL'
                  ? 'bg-brand-primary text-white font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
              }`}
            >
              All ({rawFindings.length})
            </button>

            {severityCounts.critical > 0 && (
              <button
                type="button"
                onClick={() => setSeverityFilter('CRITICAL')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  severityFilter === 'CRITICAL'
                    ? 'bg-rose-500 text-white font-semibold'
                    : 'text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                Critical ({severityCounts.critical})
              </button>
            )}

            {severityCounts.high > 0 && (
              <button
                type="button"
                onClick={() => setSeverityFilter('HIGH')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  severityFilter === 'HIGH'
                    ? 'bg-amber-500 text-white font-semibold'
                    : 'text-amber-400 hover:bg-amber-500/10'
                }`}
              >
                High ({severityCounts.high})
              </button>
            )}

            {severityCounts.medium > 0 && (
              <button
                type="button"
                onClick={() => setSeverityFilter('MEDIUM')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  severityFilter === 'MEDIUM'
                    ? 'bg-yellow-500 text-text-primary font-semibold'
                    : 'text-yellow-400 hover:bg-yellow-500/10'
                }`}
              >
                Med ({severityCounts.medium})
              </button>
            )}

            {severityCounts.low > 0 && (
              <button
                type="button"
                onClick={() => setSeverityFilter('LOW')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  severityFilter === 'LOW'
                    ? 'bg-blue-500 text-white font-semibold'
                    : 'text-blue-400 hover:bg-blue-500/10'
                }`}
              >
                Low ({severityCounts.low})
              </button>
            )}

            {severityCounts.info > 0 && (
              <button
                type="button"
                onClick={() => setSeverityFilter('INFO')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  severityFilter === 'INFO'
                    ? 'bg-surface-tertiary text-text-primary font-semibold'
                    : 'text-text-muted hover:bg-surface-tertiary'
                }`}
              >
                Info ({severityCounts.info})
              </button>
            )}
          </div>

          {/* Findings List Container */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
            {rawFindings.length === 0 ? (
              /* Clean Code Zero-State */
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-text-primary">
                  {!aiAvailable && reviewMode === 'static-fallback'
                    ? 'Deterministic Static Audit Complete'
                    : 'No Issues Detected'}
                </h4>
                <p className="text-xs text-text-secondary mt-1 max-w-xs leading-relaxed">
                  {!aiAvailable && reviewMode === 'static-fallback'
                    ? 'Static analysis detected no rule violations. Note: AI semantic analysis was unavailable (quota/timeout); findings reflect deterministic static audit only.'
                    : 'Analysis passed with a clean Grade A rating. No dangerous patterns, security violations, or code hygiene issues found.'}
                </p>
              </div>
            ) : filteredFindings.length === 0 ? (
              /* Empty Filter State */
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-10 h-10 rounded-full bg-surface-tertiary border border-border-subtle flex items-center justify-center text-text-muted mb-2.5">
                  <Info className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-text-primary">
                  No {severityFilter} Findings
                </h4>
                <p className="text-[11px] text-text-secondary mt-1 mb-3">
                  No violations matched the currently selected filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSeverityFilter('ALL');
                    setCategoryFilter('ALL');
                  }}
                  className="px-2.5 py-1 rounded bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-xs text-brand-primary font-medium transition-colors cursor-pointer"
                >
                  Show All Findings ({rawFindings.length})
                </button>
              </div>
            ) : (
              /* Findings Cards */
              filteredFindings.map((finding) => {
                const sevStyle = SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.INFO;
                const isSelected = activeFindingId === finding.id;

                return (
                  <div
                    key={finding.id}
                    data-testid={`finding-card-${finding.id}`}
                    onClick={() => onSelectFinding && onSelectFinding(finding)}
                    className={`p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-surface-primary border-brand-primary ring-1 ring-brand-primary shadow-elevated'
                        : 'bg-surface-primary hover:bg-surface-tertiary/70 border-border-subtle/80'
                    }`}
                  >
                    {/* Finding Header with Source Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Severity Badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${sevStyle.bg} ${sevStyle.text} border ${sevStyle.border}`}
                        >
                          {finding.severity}
                        </span>

                        {/* Source Origin Badge */}
                        {finding.source === 'gemini' ? (
                          <span
                            data-testid="badge-source-gemini"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-accent/15 text-indigo-300 border border-brand-accent/40"
                          >
                            <Bot className="w-2.5 h-2.5" />
                            <span>Gemini AI</span>
                          </span>
                        ) : finding.source === 'hybrid' ? (
                          <span
                            data-testid="badge-source-hybrid"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                          >
                            <span>Hybrid</span>
                          </span>
                        ) : (
                          <span
                            data-testid="badge-source-static"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30"
                          >
                            <span>Static</span>
                          </span>
                        )}

                        {/* Rule ID (if static or present) */}
                        {finding.ruleId && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-text-muted border border-border-subtle">
                            {finding.ruleId}
                          </span>
                        )}

                        {/* CWE Badge */}
                        {finding.cwe && (
                          <span
                            data-testid="badge-cwe"
                            className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30"
                          >
                            {finding.cwe}
                          </span>
                        )}

                        {/* OWASP Category Badge */}
                        {finding.owaspCategory && (
                          <span
                            data-testid="badge-owasp"
                            className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                          >
                            {finding.owaspCategory}
                          </span>
                        )}

                        {/* Confidence Badge */}
                        {finding.confidence && (
                          <span
                            data-testid="badge-confidence"
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-tertiary text-text-secondary border border-border-subtle"
                          >
                            {finding.confidence} Confidence
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-brand-primary font-medium">
                          Line {finding.lineStart}:{finding.columnStart}
                        </span>
                      </div>

                      <span className="text-[10px] text-text-muted shrink-0 uppercase tracking-wide">
                        {finding.category}
                      </span>
                    </div>

                    {/* Finding Title & Explanation */}
                    <h4 className="text-xs font-semibold text-text-primary mt-1.5">
                      {finding.title}
                    </h4>
                    <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                      {finding.explanation}
                    </p>

                    {/* Matched Original Vulnerable Snippet */}
                    {finding.originalSnippet && (
                      <div className="mt-2 p-2 rounded bg-canvas border border-rose-500/30 text-rose-300">
                        <div className="text-[9px] uppercase tracking-wider text-rose-400 font-sans font-bold mb-1">
                          Vulnerable Code (Line {finding.lineStart})
                        </div>
                        <pre className="font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                          <code>{finding.originalSnippet}</code>
                        </pre>
                      </div>
                    )}

                    {/* Suggested Fix Code Block */}
                    {finding.suggestedSnippet && (
                      <div className="mt-2.5 p-2 rounded bg-surface-secondary border border-emerald-500/30">
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold font-sans">
                            Corrected Code Suggestion
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Copy Fix Button */}
                            <button
                              type="button"
                              onClick={(e) => handleCopyFix(e, finding)}
                              aria-label="Copy suggested fix"
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                                copiedId === finding.id
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-surface-primary hover:bg-surface-tertiary text-text-secondary hover:text-text-primary border border-border-subtle'
                              }`}
                            >
                              {copiedId === finding.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-text-muted" />
                                  <span>Copy Fix</span>
                                </>
                              )}
                            </button>

                            {/* Phase 11: Apply Fix Button or Applied Badge & Undo */}
                            {appliedFixIds.includes(finding.id) ? (
                              <div className="flex items-center gap-1">
                                <span
                                  data-testid={`badge-applied-${finding.id}`}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Applied</span>
                                </span>
                                {onUndoFix && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUndoFix(finding.id);
                                    }}
                                    data-testid={`undo-fix-${finding.id}`}
                                    aria-label="Undo applied fix"
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                                  >
                                    Undo
                                  </button>
                                )}
                              </div>
                            ) : onRequestApplyFix ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRequestApplyFix(finding);
                                }}
                                data-testid={`apply-fix-btn-${finding.id}`}
                                aria-label="Apply suggested fix to editor"
                                className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-brand-primary hover:bg-brand-hover text-white transition-colors cursor-pointer shadow-sm shadow-brand-primary/20"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>Apply Fix</span>
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <pre className="p-2 rounded bg-canvas font-mono text-[11px] text-emerald-300 border border-border-subtle/50 overflow-x-auto whitespace-pre-wrap">
                          <code>{finding.suggestedSnippet}</code>
                        </pre>
                      </div>
                    )}

                    {/* Explanation of Why the Correction Works */}
                    {finding.remediation && (
                      <div className="mt-2 p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200 leading-relaxed">
                        <strong className="text-indigo-300 font-semibold block mb-0.5">
                          Why this correction works:
                        </strong>
                        {finding.remediation}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* TAB 2: SUGGESTED REFACTORING (READ-ONLY, NEVER MUTATES MONACO) */}
      {activeTab === 'refactoring' && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5" data-testid="refactoring-tab-content">
          {/* Non-mutation Safety Notice */}
          <div className="p-3 rounded-lg bg-surface-primary border border-border-subtle/80 flex items-start gap-2.5 text-xs text-text-secondary">
            <Info className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Suggested refactoring is displayed for reference and will <strong className="text-text-primary font-semibold">never automatically overwrite your active editor buffer</strong>. Copy the code and apply changes at your discretion.
            </p>
          </div>

          {/* Refactoring Rationale */}
          {refactoringRationale && (
            <div className="p-3 rounded-lg bg-surface-primary border border-border-subtle/80 text-xs">
              <span className="text-[10px] text-text-muted uppercase font-semibold block mb-1">
                Refactoring Rationale
              </span>
              <p className="text-text-primary text-[11px] leading-relaxed whitespace-pre-wrap">
                {refactoringRationale}
              </p>
            </div>
          )}

          {/* Suggested Refactored Code Block */}
          {suggestedCode ? (
            <div className="rounded-lg border border-border-subtle bg-canvas overflow-hidden">
              <div className="px-3 py-2 bg-surface-primary border-b border-border-subtle flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                  <Code2 className="w-3.5 h-3.5 text-brand-accent" />
                  <span>Refactored Source Code</span>
                </div>

                <button
                  type="button"
                  onClick={handleCopyRefactoredCode}
                  data-testid="copy-refactored-code-button"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    copiedRefactoredCode
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-surface-secondary hover:bg-surface-tertiary text-text-primary border border-border-subtle'
                  }`}
                  aria-label="Copy Refactored Code"
                >
                  {copiedRefactoredCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-text-muted" />
                      <span>Copy Refactored Code</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3 font-mono text-[11px] text-text-primary overflow-x-auto whitespace-pre max-h-96">
                <code>{suggestedCode}</code>
              </pre>
            </div>
          ) : (
            <div className="p-6 text-center text-text-muted text-xs">
              No full refactored code provided for this review.
            </div>
          )}
        </div>
      )}

      {/* Footer Disclaimer */}
      <div className="p-2.5 border-t border-border-subtle bg-surface-primary/60 text-[10px] text-text-muted text-center shrink-0">
        Dual-layer deterministic static & Gemini AI evaluation. Does not guarantee 100% exploit freedom.
      </div>
    </div>
  );
}

export default FindingsPanel;
