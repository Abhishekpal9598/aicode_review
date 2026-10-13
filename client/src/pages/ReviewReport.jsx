import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import CodeViewer from '../components/CodeViewer';
import IssueCard from '../components/IssueCard';
import ScoreRing from '../components/ScoreRing';
import FilterBar from '../components/FilterBar';
import {
  FileCode,
  ArrowLeft,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';

export default function ReviewReport() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const [file, setFile] = useState(null);
  const [issues, setIssues] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const [selectedIssue, setSelectedIssue] = useState(null);
  const [selectedSeverities, setSelectedSeverities] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/reviews/${id}`);
        setReview(res.data.review);
        setIssues(res.data.issues || []);
        setMetrics(res.data.metrics || null);
        const firstFile = res.data.files?.[0] || {
          content: '// No source code file attached',
          language: res.data.review.language || 'javascript',
          path: 'snippet.js'
        };
        setFile(firstFile);

        // Pre-select first issue if available
        if (res.data.issues?.length > 0) {
          setSelectedIssue(res.data.issues[0]);
        }
      } catch (err) {
        console.error('Fetch review report error:', err);
        setError(
          err.response?.status === 404
            ? 'Review report not found. It may have been deleted or does not exist.'
            : err.response?.status === 403
            ? 'You do not have permission to view this review report.'
            : 'Failed to load code review report. Please check your connection.'
        );
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [id]);

  // Extract relevant original code lines for an issue to display in DiffView
  const getOriginalSnippetForIssue = (issue) => {
    if (!file?.content) return '';
    const lines = file.content.split('\n');
    const startIdx = Math.max(0, (issue.line_start || 1) - 1);
    const endIdx = Math.min(lines.length, issue.line_end || issue.line_start || 1);
    return lines.slice(startIdx, endIdx).join('\n');
  };

  // Filter issues based on active chips
  const filteredIssues = issues.filter((issue) => {
    if (
      selectedSeverities.length > 0 &&
      !selectedSeverities.includes(issue.severity?.toLowerCase())
    ) {
      return false;
    }
    if (
      selectedCategories.length > 0 &&
      !selectedCategories.includes(issue.category?.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  // Loading Skeleton State
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse space-y-6">
        <div className="h-10 bg-slate-800/60 rounded-xl w-1/3" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[600px]">
          <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl" />
          <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="h-28 bg-slate-800/40 rounded-xl" />
            <div className="h-20 bg-slate-800/40 rounded-xl" />
            <div className="h-32 bg-slate-800/40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Friendly Error State
  if (error || !review) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-2">
          <AlertTriangle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Review Unavailable</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{error}</p>
        <div className="pt-4">
          <Link
            to="/history"
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Review History</span>
          </Link>
        </div>
      </div>
    );
  }

  const isMockReview = review.content_hash?.includes('mock') || review.source === 'paste';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Metadata */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <Link
              to="/history"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Back to History"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-white tracking-tight">Code Review Report</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-800 text-indigo-400 border border-slate-700">
              {review.language}
            </span>
          </div>

          <div className="flex items-center space-x-4 text-xs text-slate-400 pl-8">
            <div className="flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>{new Date(review.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>{file?.line_count || file?.content?.split('\n').length || 0} lines analyzed</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to="/"
            className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Review</span>
          </Link>
        </div>
      </div>

      {/* Main Two-Panel Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
        {/* Left Panel: Monaco CodeViewer with Inline Markers */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[640px]">
          <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              <span className="font-mono text-slate-200">{file?.path || 'snippet'}</span>
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="text-rose-400">● High</span>
              <span className="text-amber-400">● Medium</span>
              <span className="text-blue-400">● Low</span>
            </div>
          </div>

          <div className="flex-1 relative">
            <CodeViewer
              code={file?.content || ''}
              language={review.language || 'javascript'}
              issues={issues}
              selectedIssue={selectedIssue}
              onSelectIssue={(issue) => setSelectedIssue(issue)}
            />
          </div>
        </div>

        {/* Right Panel: Score Ring, Summary, Filters & Issue Cards */}
        <div className="lg:col-span-5 flex flex-col h-[640px] bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          {/* Header Score & Summary Card */}
          <div className="p-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Overall Quality
              </span>
              <div className="text-sm font-semibold text-white">
                {issues.length} {issues.length === 1 ? 'issue' : 'issues'} found in {file?.line_count || 0} lines
              </div>
              <p className="text-xs text-slate-400">
                Weighted penalty scoring: High -10, Medium -4, Low -1
              </p>
            </div>

            <ScoreRing score={review.score !== null ? review.score : 100} size={92} strokeWidth={8} />
          </div>

          {/* Filter Bar */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/40">
            <FilterBar
              selectedSeverities={selectedSeverities}
              setSelectedSeverities={setSelectedSeverities}
              selectedCategories={selectedCategories}
              setSelectedCategories={setSelectedCategories}
              issues={issues}
            />
          </div>

          {/* Issue Cards Scrollable List */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
            {filteredIssues.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/60 mb-2" />
                <p className="text-sm font-semibold text-slate-300">No issues match current filters</p>
                <p className="text-xs text-slate-500 mt-1">Try clearing severity or category filters</p>
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <IssueCard
                  key={issue.id || `${issue.title}-${issue.line_start}`}
                  issue={issue}
                  originalSnippet={getOriginalSnippetForIssue(issue)}
                  isSelected={selectedIssue?.id === issue.id || (selectedIssue?.title === issue.title && selectedIssue?.line_start === issue.line_start)}
                  onSelect={(iss) => setSelectedIssue(iss)}
                  language={review.language}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
