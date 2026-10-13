import React, { useState, useEffect, useRef } from 'react';
import SeverityBadge from './SeverityBadge';
import DiffView from './DiffView';
import api from '../services/api';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  AlertOctagon,
  Sparkles
} from 'lucide-react';

export default function IssueCard({
  issue,
  originalSnippet = '',
  isSelected = false,
  onSelect,
  language = 'javascript'
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackState, setFeedbackState] = useState(null);
  const cardRef = useRef(null);

  // Auto-expand and scroll card into view when selected from editor
  useEffect(() => {
    if (isSelected) {
      setExpanded(true);
      if (cardRef.current) {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [isSelected]);

  const handleCopyFix = (e) => {
    e.stopPropagation();
    if (!issue.suggested_fix) return;
    navigator.clipboard.writeText(issue.suggested_fix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (e, rating) => {
    e.stopPropagation();
    try {
      await api.post(`/reviews/issues/${issue.id}/feedback`, { rating });
      setFeedbackState(rating);
    } catch (err) {
      // If endpoint is mock or fails, still show visual confirmation
      setFeedbackState(rating);
    }
  };

  const getSeverityBorder = (sev) => {
    switch (sev?.toLowerCase()) {
      case 'high':
        return isSelected ? 'border-rose-500 ring-1 ring-rose-500/40 bg-rose-500/5' : 'hover:border-rose-500/40';
      case 'medium':
        return isSelected ? 'border-amber-500 ring-1 ring-amber-500/40 bg-amber-500/5' : 'hover:border-amber-500/40';
      default:
        return isSelected ? 'border-blue-500 ring-1 ring-blue-500/40 bg-blue-500/5' : 'hover:border-blue-500/40';
    }
  };

  return (
    <div
      ref={cardRef}
      data-testid={`issue-card-${issue.id || issue.title}`}
      onClick={() => onSelect && onSelect(issue)}
      className={`border rounded-xl bg-slate-900 transition cursor-pointer select-none ${
        isSelected ? 'bg-slate-900/90' : 'bg-slate-900/60 border-slate-800'
      } ${getSeverityBorder(issue.severity)}`}
    >
      {/* Card Header */}
      <div className="p-3.5 flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <SeverityBadge severity={issue.severity} size="xs" />
            <span className="text-[11px] font-mono text-indigo-400 font-semibold px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-900/40">
              Lines {issue.line_start}{issue.line_end && issue.line_end !== issue.line_start ? `-${issue.line_end}` : ''}
            </span>
            <span className="text-[11px] capitalize text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
              {issue.category}
            </span>
          </div>

          <h3 className="text-sm font-semibold text-slate-100 truncate">
            {issue.title}
          </h3>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
          aria-label={expanded ? 'Collapse issue' : 'Expand issue'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-slate-800/70 text-xs">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Why it matters
            </div>
            <p className="text-slate-300 leading-relaxed whitespace-pre-line">
              {issue.explanation}
            </p>
          </div>

          {/* Suggested Fix & Diff */}
          {issue.suggested_fix && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-indigo-400 font-semibold text-[11px] uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Suggested Fix</span>
                </div>
                <button
                  onClick={handleCopyFix}
                  data-testid="copy-fix-btn"
                  className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Fix</span>
                    </>
                  )}
                </button>
              </div>

              {/* Side-by-side Diff View */}
              <DiffView
                original={originalSnippet || '// Original code'}
                modified={issue.suggested_fix}
                language={language}
              />
            </div>
          )}

          {/* Feedback Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/70 text-[11px] text-slate-400">
            <span>Was this helpful?</span>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={(e) => handleFeedback(e, 'helpful')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded transition ${
                  feedbackState === 'helpful'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'hover:bg-slate-800 hover:text-slate-200'
                }`}
                title="Helpful"
              >
                <ThumbsUp className="w-3 h-3" />
                <span>Helpful</span>
              </button>
              <button
                onClick={(e) => handleFeedback(e, 'not_helpful')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded transition ${
                  feedbackState === 'not_helpful'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'hover:bg-slate-800 hover:text-slate-200'
                }`}
                title="Not helpful"
              >
                <ThumbsDown className="w-3 h-3" />
                <span>Unhelpful</span>
              </button>
              <button
                onClick={(e) => handleFeedback(e, 'false_positive')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded transition ${
                  feedbackState === 'false_positive'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'hover:bg-slate-800 hover:text-slate-200'
                }`}
                title="False positive"
              >
                <AlertOctagon className="w-3 h-3" />
                <span>False positive</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
