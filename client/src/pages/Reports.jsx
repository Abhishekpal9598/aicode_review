import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  FileBarChart2,
  Download,
  Printer,
  FileText,
  FolderOpen,
  ChevronDown,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Gauge,
  Code2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  ArrowRight
} from 'lucide-react';
import apiClient from '../services/apiClient';

const GRADE_STYLES = {
  A: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  B: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  C: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  D: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  F: 'text-rose-400 border-rose-500/40 bg-rose-500/10'
};

const SEVERITY_BADGES = {
  CRITICAL: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  HIGH: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  MEDIUM: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  LOW: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  INFO: 'bg-slate-500/20 text-slate-300 border-slate-500/40'
};

/**
 * Downloads arbitrary content as a browser file.
 */
function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [reviewsList, setReviewsList] = useState([]);
  const [selectedReviewId, setSelectedReviewId] = useState(searchParams.get('reviewId') || '');
  const [reportData, setReportData] = useState(null);
  const [markdownContent, setMarkdownContent] = useState('');
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(null);

  // 1. Fetch user reviews on mount for dropdown
  useEffect(() => {
    let isMounted = true;

    async function loadReviews() {
      setIsLoadingReviews(true);
      try {
        const res = await apiClient.getReviews({ limit: 50 });
        if (!isMounted) return;

        const items = res?.data?.items || res?.data || [];
        setReviewsList(items);

        const paramId = searchParams.get('reviewId');
        if (paramId && items.some((r) => r._id === paramId)) {
          setSelectedReviewId(paramId);
        } else if (items.length > 0 && !selectedReviewId) {
          setSelectedReviewId(items[0]._id);
          setSearchParams({ reviewId: items[0]._id }, { replace: true });
        }
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Failed to load user reviews.');
      } finally {
        if (isMounted) setIsLoadingReviews(false);
      }
    }

    loadReviews();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Report JSON and Markdown whenever selectedReviewId changes
  const fetchReport = useCallback(async (reviewId) => {
    if (!reviewId) {
      setReportData(null);
      setMarkdownContent('');
      return;
    }

    setIsLoadingReport(true);
    setErrorMessage(null);

    try {
      const [jsonRes, mdRes] = await Promise.all([
        apiClient.exportReview(reviewId, 'json'),
        apiClient.exportReview(reviewId, 'markdown')
      ]);

      const jsonPayload = jsonRes?.data || jsonRes;
      setReportData(jsonPayload);
      setMarkdownContent(typeof mdRes === 'string' ? mdRes : (mdRes?.content || JSON.stringify(jsonPayload, null, 2)));
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load audit report.');
      setReportData(null);
      setMarkdownContent('');
    } finally {
      setIsLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    if (selectedReviewId) {
      fetchReport(selectedReviewId);
    }
  }, [selectedReviewId, fetchReport]);

  const handleSelectReview = (e) => {
    const newId = e.target.value;
    setSelectedReviewId(newId);
    setSearchParams(newId ? { reviewId: newId } : {}, { replace: true });
  };

  const safeFileName = useMemo(() => {
    const title = reportData?.review?.title || 'review';
    return `audit-report-${title.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40)}-${selectedReviewId}`;
  }, [reportData, selectedReviewId]);

  const handleDownloadJson = () => {
    if (!reportData) return;
    try {
      const jsonStr = JSON.stringify(reportData, null, 2);
      downloadFile(jsonStr, `${safeFileName}.json`, 'application/json');
      setDownloadSuccess('JSON report downloaded successfully');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      setErrorMessage('Failed to trigger JSON download: ' + err.message);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!markdownContent) return;
    try {
      downloadFile(markdownContent, `${safeFileName}.md`, 'text/markdown;charset=utf-8');
      setDownloadSuccess('Markdown report downloaded successfully');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      setErrorMessage('Failed to trigger Markdown download: ' + err.message);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    }
  };

  const grade = reportData?.qualityScore?.grade || 'A';
  const gradeClass = GRADE_STYLES[grade] || GRADE_STYLES.C;
  const overallScore = reportData?.qualityScore?.overall ?? 100;
  const securityScore = reportData?.qualityScore?.securityScore;
  const performanceScore = reportData?.qualityScore?.performanceScore;
  const severity = reportData?.severityBreakdown || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  const secFindings = reportData?.findings?.security || [];
  const perfFindings = reportData?.findings?.performance || [];
  const appliedFixes = reportData?.appliedFixes || [];

  return (
    <div className="space-y-6 print-container" data-testid="reports-page">
      {/* Page Header (Hidden on Print) */}
      <div className="no-print">
        <PageHeader
          title="Audit Reports & Multi-Format Exports"
          description="Generate, inspect, and export comprehensive code quality summaries for team leads, security auditors, or client deliverables."
          icon={FileBarChart2}
          badgeText="Roadmap Phase 13"
          badgeVariant="emerald"
        />
      </div>

      {/* Control Strip: Review Selector & Action Buttons (Hidden on Print) */}
      <div className="no-print flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3.5 rounded-lg bg-surface-secondary border border-border-subtle shadow-elevated">
        {/* Left: Review Selector Dropdown */}
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
                aria-label="Select review for report export"
                data-testid="report-review-selector"
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

        {/* Right: Export & Print Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadJson}
            disabled={!reportData || isLoadingReport}
            data-testid="download-json-button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
            title="Download structured JSON telemetry"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download JSON</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            disabled={!markdownContent || isLoadingReport}
            data-testid="download-markdown-button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
            title="Download GitHub-Flavored Markdown summary"
          >
            <FileText className="w-3.5 h-3.5 text-brand-primary" />
            <span>Download Markdown</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!reportData || isLoadingReport}
            data-testid="print-report-button"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-brand-primary hover:bg-brand-hover text-white text-xs font-medium transition-colors cursor-pointer shadow-sm shadow-brand-primary/20 disabled:opacity-50"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner (Hidden on Print) */}
      {downloadSuccess && (
        <div
          role="status"
          className="no-print flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs animate-in fade-in-50 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {/* Error Alert Banner (Hidden on Print) */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="no-print flex items-center justify-between p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in-50 duration-200"
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

      {/* Loading State Indicator */}
      {isLoadingReport ? (
        <div className="h-96 flex flex-col items-center justify-center p-8 text-center bg-surface-secondary border border-border-subtle rounded-lg shadow-elevated">
          <LoadingSpinner size="md" />
          <p className="text-xs text-text-secondary mt-3 font-medium">
            Aggregating audit telemetry, complexity models, and formatting report...
          </p>
        </div>
      ) : !selectedReviewId || reviewsList.length === 0 ? (
        <div className="p-8 text-center bg-surface-secondary border border-border-subtle rounded-lg shadow-elevated">
          <div className="w-12 h-12 rounded-full bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary mx-auto mb-3">
            <FileBarChart2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">No Audit Reports Found</h3>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto leading-relaxed">
            Run a code review in the workspace first to generate review records, apply fixes, and export executive quality reports.
          </p>
          <button
            type="button"
            onClick={() => navigate('/code-review')}
            className="mt-4 px-3.5 py-1.5 rounded bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold cursor-pointer shadow-sm shadow-brand-primary/20 transition-colors"
          >
            Launch Review Workspace
          </button>
        </div>
      ) : reportData ? (
        /* Printable Audit Report Document */
        <div
          data-testid="audit-report-document"
          className="space-y-6 print-container"
        >
          {/* Document Header Card */}
          <div className="p-5 rounded-lg bg-surface-primary border border-border-subtle shadow-elevated print-card print-break-inside-avoid">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-text-primary tracking-tight">
                    {reportData.review?.title}
                  </h2>
                  <Badge variant="indigo" size="xs" mono>
                    {reportData.review?.language?.toUpperCase()}
                  </Badge>
                  <span className="text-xs font-mono text-text-muted">
                    {reportData.review?.filename}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">
                  Target File: <strong className="font-mono text-text-primary">{reportData.review?.filename}</strong> ({reportData.review?.lineCount} LOC)
                  • Review ID: <code className="text-text-muted">{reportData.review?.id}</code>
                </p>
              </div>

              {/* Overall Grade Pill */}
              <div className="flex items-center gap-3 shrink-0">
                <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${gradeClass}`}>
                  <span className="text-xl font-bold font-mono">Grade {grade}</span>
                  <span className="text-xs font-mono">({overallScore}%)</span>
                </div>
              </div>
            </div>

            {/* Document Sub-header Metadata */}
            <div className="flex items-center justify-between text-xs text-text-muted flex-wrap gap-2 pt-1 font-mono">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Audited: {reportData.review?.createdAt ? new Date(reportData.review.createdAt).toLocaleDateString() : 'N/A'}</span>
              </span>
              <span>Exporter: {reportData.exportMetadata?.generator}</span>
            </div>
          </div>

          {/* Executive Summary Card */}
          <div className="p-5 rounded-lg bg-surface-primary border border-border-subtle shadow-elevated print-card print-break-inside-avoid">
            <div className="flex items-center gap-2 text-text-primary font-semibold text-xs mb-2">
              <Sparkles className="w-4 h-4 text-brand-primary" />
              <span>1. Executive Summary</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed font-sans">
              {reportData.summary}
            </p>
          </div>

          {/* Metrics & Telemetry Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print-break-inside-avoid">
            {/* Overall Score */}
            <Card className="text-xs p-3.5 print-card">
              <span className="text-text-muted block mb-1">Quality Score</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-text-primary">{overallScore}</span>
                <span className="text-xs text-text-muted font-mono">/ 100</span>
              </div>
              <span className="text-[10px] text-text-secondary block mt-1">Weighted composite</span>
            </Card>

            {/* Security Score */}
            <Card className="text-xs p-3.5 print-card">
              <span className="text-text-muted block mb-1">Security Score</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {securityScore !== null && securityScore !== undefined ? securityScore : 'N/A'}
                </span>
                <span className="text-xs text-text-muted font-mono">/ 100</span>
              </div>
              <span className="text-[10px] text-text-secondary block mt-1">
                {secFindings.length} vulnerabilities
              </span>
            </Card>

            {/* Performance Score */}
            <Card className="text-xs p-3.5 print-card">
              <span className="text-text-muted block mb-1">Performance Score</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-mono text-sky-400">
                  {performanceScore !== null && performanceScore !== undefined ? performanceScore : 'N/A'}
                </span>
                <span className="text-xs text-text-muted font-mono">/ 100</span>
              </div>
              <span className="text-[10px] text-text-secondary block mt-1">
                {perfFindings.length} bottlenecks
              </span>
            </Card>

            {/* Algorithmic Complexity */}
            <Card className="text-xs p-3.5 print-card">
              <span className="text-text-muted block mb-1">Time / Space Complexity</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-bold font-mono text-brand-primary">
                  {reportData.algorithmicComplexity?.timeComplexity}
                </span>
                <span className="text-xs text-text-muted font-mono">/ {reportData.algorithmicComplexity?.spaceComplexity}</span>
              </div>
              <span className="text-[10px] text-text-secondary block mt-1 capitalize">
                {reportData.algorithmicComplexity?.complexityType}
              </span>
            </Card>
          </div>

          {/* Severity Distribution Pills */}
          <div className="p-4 rounded-lg bg-surface-primary border border-border-subtle shadow-elevated print-card print-break-inside-avoid">
            <span className="text-xs font-semibold text-text-primary block mb-3">
              Findings Severity Breakdown ({reportData.findings?.total || 0} Total)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => {
                const count = severity[sev] || 0;
                const badgeStyle = SEVERITY_BADGES[sev];
                return (
                  <div
                    key={sev}
                    className={`flex items-center justify-between p-2 rounded-md border text-xs font-mono ${badgeStyle}`}
                  >
                    <span className="font-semibold">{sev}</span>
                    <span className="font-bold text-sm">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Findings Section */}
          <div className="p-5 rounded-lg bg-surface-primary border border-border-subtle shadow-elevated print-card print-break-inside-avoid space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-text-primary font-semibold text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>2. Security Vulnerabilities ({secFindings.length})</span>
              </div>
            </div>

            {secFindings.length === 0 ? (
              <div className="p-4 text-center rounded bg-surface-secondary/50 border border-border-subtle text-xs text-emerald-400 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Zero security vulnerabilities detected. Code satisfies baseline security policies.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted text-[11px] font-mono">
                      <th className="py-2 px-2">Severity</th>
                      <th className="py-2 px-2">Rule ID</th>
                      <th className="py-2 px-2">Location</th>
                      <th className="py-2 px-2">CWE / OWASP</th>
                      <th className="py-2 px-2">Title & Remediation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {secFindings.map((f, i) => (
                      <tr key={f.id || i} className="hover:bg-surface-secondary/30 transition-colors">
                        <td className="py-2.5 px-2 font-mono">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${SEVERITY_BADGES[f.severity]}`}>
                            {f.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-text-primary font-medium">
                          {f.ruleId || 'SEC-INJ-001'}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-text-secondary">
                          Lines {f.lineStart} - {f.lineEnd}
                        </td>
                        <td className="py-2.5 px-2 text-text-secondary font-mono text-[11px]">
                          <div>{f.cwe || 'N/A'}</div>
                          <div className="text-text-muted truncate max-w-[120px]">{f.owaspCategory || 'N/A'}</div>
                        </td>
                        <td className="py-2.5 px-2 text-text-secondary">
                          <div className="font-semibold text-text-primary">{f.title}</div>
                          <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{f.remediation || f.description}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Performance & Algorithmic Analysis Section */}
          <div className="p-5 rounded-lg bg-surface-primary border border-border-subtle shadow-elevated print-card print-break-inside-avoid space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-semibold text-xs">
              <Gauge className="w-4 h-4 text-sky-400" />
              <span>3. Algorithmic Performance & Complexity Analysis</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded bg-surface-secondary border border-border-subtle text-xs space-y-1">
                <span className="text-text-muted text-[11px]">Time Complexity</span>
                <div className="text-base font-bold font-mono text-text-primary">
                  {reportData.algorithmicComplexity?.timeComplexity}
                </div>
                <span className="text-[10px] text-text-secondary block">
                  Classification: {reportData.algorithmicComplexity?.complexityType}
                </span>
              </div>
              <div className="p-3 rounded bg-surface-secondary border border-border-subtle text-xs space-y-1">
                <span className="text-text-muted text-[11px]">Space Complexity</span>
                <div className="text-base font-bold font-mono text-text-primary">
                  {reportData.algorithmicComplexity?.spaceComplexity}
                </div>
                <span className="text-[10px] text-text-secondary block">
                  Auxiliary memory & structures allocation
                </span>
              </div>
            </div>

            {perfFindings.length === 0 ? (
              <p className="text-xs text-text-muted italic pt-1">
                No algorithmic bottlenecks or nested loops detected.
              </p>
            ) : (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-text-secondary block">
                  Identified Bottlenecks ({perfFindings.length})
                </span>
                {perfFindings.map((pf, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-surface-secondary border border-border-subtle text-xs flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-text-primary flex items-center gap-2">
                        <span>Line {pf.lineStart}: {pf.title}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-surface-tertiary text-text-muted">
                          {pf.complexityEstimate || 'O(n)'}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1">{pf.remediation || pf.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Applied Remediations History */}
          <div className="p-5 rounded-lg bg-surface-primary border border-border-subtle shadow-elevated print-card print-break-inside-avoid space-y-4">
            <div className="flex items-center gap-2 text-text-primary font-semibold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>4. Applied Fixes History ({appliedFixes.length})</span>
            </div>

            {appliedFixes.length === 0 ? (
              <div className="p-3 rounded bg-surface-secondary/40 border border-border-subtle text-xs text-text-muted">
                0 fixes have been applied to this review yet. The original submitted code is preserved. Fixes can be applied in the Code Review workspace.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-border-subtle text-text-muted text-[11px] font-mono">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Rule ID</th>
                      <th className="py-2 px-2">Lines</th>
                      <th className="py-2 px-2">Applied Fix Snippet</th>
                      <th className="py-2 px-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {appliedFixes.map((fix, idx) => (
                      <tr key={idx} className="hover:bg-surface-secondary/30 transition-colors">
                        <td className="py-2 px-2 font-mono text-text-muted">{idx + 1}</td>
                        <td className="py-2 px-2 font-mono text-brand-primary">{fix.ruleId || 'CUSTOM-FIX'}</td>
                        <td className="py-2 px-2 font-mono text-text-secondary">{fix.lineStart} - {fix.lineEnd}</td>
                        <td className="py-2 px-2 font-mono text-xs text-text-primary">
                          <code className="text-emerald-300 bg-surface-secondary px-1.5 py-0.5 rounded">
                            {fix.appliedSnippet?.slice(0, 50)}...
                          </code>
                        </td>
                        <td className="py-2 px-2 font-mono text-[11px] text-text-muted">
                          {fix.appliedAt ? new Date(fix.appliedAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Source Code Summary & LOC Metrics */}
          <div className="p-4 rounded-lg bg-surface-primary border border-border-subtle shadow-elevated print-card print-break-inside-avoid">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-medium text-text-primary">5. Source Code & Diff Statistics</span>
              <span className="font-mono text-text-muted">
                Original LOC: {reportData.review?.lineCount} • Status: {reportData.code?.hasModifications ? 'Modified' : 'Unmodified'}
              </span>
            </div>
            {reportData.code?.diffSummary && (
              <div className="flex items-center gap-3 mt-2 font-mono text-xs">
                <span className="text-emerald-400 font-semibold">
                  +{reportData.code.diffSummary.addedLines} lines added
                </span>
                <span className="text-rose-400 font-semibold">
                  -{reportData.code.diffSummary.removedLines} lines removed
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Reports;
