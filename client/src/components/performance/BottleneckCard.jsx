import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Cpu,
  Zap,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import ComplexityBadge from './ComplexityBadge';

const SEVERITY_COLORS = {
  CRITICAL: {
    badge: 'rose',
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/10'
  },
  HIGH: {
    badge: 'amber',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10'
  },
  MEDIUM: {
    badge: 'sky',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/10'
  },
  LOW: {
    badge: 'slate',
    border: 'border-border-subtle',
    bg: 'bg-surface-tertiary'
  }
};

export function BottleneckCard({
  finding,
  reviewId,
  language = 'python'
}) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const severity = (finding.severity || 'MEDIUM').toUpperCase();
  const theme = SEVERITY_COLORS[severity] || SEVERITY_COLORS.MEDIUM;
  const complexityEst = finding.complexityEstimate || 'O(n)';

  const handleCopyCode = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  };

  const handleOpenInEditor = () => {
    if (!reviewId) return;
    const targetLine = finding.lineStart || 1;
    navigate(`/code-review?reviewId=${reviewId}&line=${targetLine}`);
  };

  return (
    <Card
      className={`p-4 border transition-all ${theme.border} bg-surface-secondary/70 hover:border-border-focus`}
      data-testid="bottleneck-card"
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-border-subtle/60">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={theme.badge} size="xs">
            {severity}
          </Badge>

          {complexityEst && (
            <ComplexityBadge complexity={complexityEst} size="xs" />
          )}

          <span className="font-mono text-xs text-text-muted">
            Line {finding.lineStart}
            {finding.lineEnd && finding.lineEnd > finding.lineStart
              ? `–${finding.lineEnd}`
              : ''}
          </span>

          {finding.source && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-tertiary text-text-secondary border border-border-subtle">
              {finding.source === 'static' ? 'Deterministic Engine' : 'AI Analysis'}
            </span>
          )}

          {finding.confidence && (
            <span className="text-[10px] text-text-muted">
              Confidence:{' '}
              <span className="font-semibold text-text-secondary">
                {finding.confidence}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {reviewId && (
            <button
              type="button"
              onClick={handleOpenInEditor}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-primary hover:text-brand-secondary rounded hover:bg-brand-primary/10 transition-colors"
              title="Jump to source line in Code Review workstation"
            >
              <span>View Line {finding.lineStart}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-tertiary transition-colors"
            aria-label={isExpanded ? 'Collapse finding' : 'Expand finding'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="mt-3 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary mb-1">
            {finding.title}
          </h4>
          <p className="text-xs text-text-secondary leading-relaxed">
            {finding.explanation || finding.description}
          </p>
        </div>

        {isExpanded && (
          <div className="space-y-3 pt-2">
            {/* Optimization Recommendation */}
            {(finding.remediation || finding.optimization) && (
              <div className="p-2.5 rounded-md bg-status-info/10 border border-status-info/20 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-status-info mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Optimization Strategy</span>
                </div>
                <p className="text-text-secondary text-[11px] leading-relaxed">
                  {finding.remediation || finding.optimization}
                </p>
              </div>
            )}

            {/* Code Snippets: Problematic vs Optimized */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {finding.originalSnippet && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-text-muted font-mono">
                    <span>Problematic Code (Before)</span>
                  </div>
                  <pre className="p-2.5 rounded bg-surface-primary border border-rose-500/20 text-text-secondary font-mono text-[11px] overflow-x-auto">
                    <code>{finding.originalSnippet}</code>
                  </pre>
                </div>
              )}

              {finding.suggestedSnippet && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Optimized Alternative (After)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(finding.suggestedSnippet)}
                      className="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-emerald-400 font-sans"
                    >
                      {copiedSnippet ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Fix</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-surface-primary border border-emerald-500/30 text-emerald-300 font-mono text-[11px] overflow-x-auto">
                    <code>{finding.suggestedSnippet}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default BottleneckCard;
