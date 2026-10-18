import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  ShieldAlert,
  AlertTriangle,
  Bug,
  Info,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Cpu,
  Layers,
  Wrench,
  FileCode
} from 'lucide-react';

const SEVERITY_CONFIG = {
  CRITICAL: {
    badgeVariant: 'red',
    textColor: 'text-rose-400',
    borderColor: 'border-rose-500/30',
    bgColor: 'bg-rose-500/10'
  },
  HIGH: {
    badgeVariant: 'amber',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/10'
  },
  MEDIUM: {
    badgeVariant: 'amber',
    textColor: 'text-yellow-400',
    borderColor: 'border-yellow-500/30',
    bgColor: 'bg-yellow-500/10'
  },
  LOW: {
    badgeVariant: 'sky',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/10'
  },
  INFO: {
    badgeVariant: 'slate',
    textColor: 'text-text-muted',
    borderColor: 'border-border-subtle',
    bgColor: 'bg-surface-tertiary'
  }
};

const SOURCE_CONFIG = {
  hybrid: {
    label: 'Hybrid Fusion',
    icon: Sparkles,
    badgeVariant: 'emerald'
  },
  static: {
    label: 'Static Rule',
    icon: Cpu,
    badgeVariant: 'indigo'
  },
  gemini: {
    label: 'Gemini AI',
    icon: Layers,
    badgeVariant: 'purple'
  }
};

/**
 * Deterministically formats confidence values.
 * - Numeric (0 to 1): Formatted as percentage e.g. "95%"
 * - String label: Rendered directly e.g. "HIGH"
 * - Null / undefined: "N/A"
 */
function formatConfidence(val) {
  if (typeof val === 'number') {
    if (val >= 0 && val <= 1) {
      return `${Math.round(val * 100)}%`;
    }
    return `${val}%`;
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    return val;
  }
  return 'N/A';
}

export function SecurityFindingCard({ issue, index = 0 }) {
  const [isSnippetExpanded, setIsSnippetExpanded] = useState(true);
  const [copiedFix, setCopiedFix] = useState(false);

  if (!issue) return null;

  const severityKey = (issue.severity || 'INFO').toUpperCase();
  const severityStyle = SEVERITY_CONFIG[severityKey] || SEVERITY_CONFIG.INFO;

  const sourceKey = (issue.source || 'static').toLowerCase();
  const sourceStyle = SOURCE_CONFIG[sourceKey] || SOURCE_CONFIG.static;
  const SourceIcon = sourceStyle.icon;

  const confidenceDisplay = formatConfidence(issue.confidence);

  const hasLineRange =
    (issue.lineEnd !== undefined && issue.lineEnd !== null && issue.lineEnd !== issue.lineStart) ||
    (issue.columnEnd !== undefined && issue.columnEnd !== null && issue.columnEnd !== issue.columnStart);

  let lineDisplay = 'Global Scope';
  if (issue.lineStart !== undefined && issue.lineStart !== null) {
    const startStr = `${issue.lineStart}${issue.columnStart !== undefined && issue.columnStart !== null ? `:${issue.columnStart}` : ''}`;
    if (hasLineRange && issue.lineEnd !== undefined && issue.lineEnd !== null) {
      const endStr = `${issue.lineEnd}${issue.columnEnd !== undefined && issue.columnEnd !== null ? `:${issue.columnEnd}` : ''}`;
      lineDisplay = `Line ${startStr} - ${endStr}`;
    } else {
      lineDisplay = `Line ${startStr}`;
    }
  }

  const handleCopyFix = async () => {
    const textToCopy = issue.suggestedSnippet || issue.remediation;
    if (!textToCopy) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        setCopiedFix(true);
        setTimeout(() => setCopiedFix(false), 2000);
      }
    } catch (err) {
      console.warn('[SecurityFindingCard] Failed to copy fix:', err);
    }
  };

  return (
    <Card
      data-testid={`security-finding-card-${issue._id || index}`}
      className={`p-4 sm:p-5 bg-surface-secondary/80 border-border-subtle hover:border-border-default transition-all duration-150 flex flex-col gap-3.5`}
    >
      {/* Top Header: Severity, Source, Rule ID, Line Reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-border-subtle/60">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity Badge */}
          <span data-testid="finding-severity-badge">
            <Badge
              variant={severityStyle.badgeVariant}
              size="xs"
              mono
            >
              {severityKey}
            </Badge>
          </span>

          {/* Source Origin Pill */}
          <span
            data-testid="finding-source-pill"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-primary border border-border-subtle text-[11px] font-mono text-text-secondary"
          >
            <SourceIcon className="w-3 h-3 text-brand-primary" />
            <span>{sourceStyle.label}</span>
          </span>

          {/* Rule ID */}
          {issue.ruleId ? (
            <span
              data-testid="finding-rule-id"
              className="text-[11px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface-primary border border-border-subtle"
            >
              {issue.ruleId}
            </span>
          ) : (
            <span
              data-testid="finding-rule-id"
              className="text-[11px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface-primary border border-border-subtle"
            >
              AI-SECURITY-DETECTED
            </span>
          )}
        </div>

        {/* Line Reference */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-text-muted">
          <FileCode className="w-3.5 h-3.5 text-text-muted" />
          <span data-testid="finding-line-range">{lineDisplay}</span>
        </div>
      </div>

      {/* Title & Metadata Pills */}
      <div>
        <h4 className="text-sm font-semibold text-text-primary tracking-tight">
          {issue.title || 'Security Vulnerability Detected'}
        </h4>

        {/* Security Standard Tags */}
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {issue.owaspCategory ? (
            <span
              data-testid="finding-owasp-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[11px] font-mono"
            >
              <strong>OWASP:</strong> {issue.owaspCategory}
            </span>
          ) : (
            <span
              data-testid="finding-owasp-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-primary text-text-muted border border-border-subtle text-[11px] font-mono"
            >
              <strong>OWASP:</strong> Uncategorized
            </span>
          )}

          {issue.cwe ? (
            <span
              data-testid="finding-cwe-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-mono"
            >
              <strong>CWE:</strong> {issue.cwe}
            </span>
          ) : (
            <span
              data-testid="finding-cwe-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-primary text-text-muted border border-border-subtle text-[11px] font-mono"
            >
              <strong>CWE:</strong> Uncategorized
            </span>
          )}

          <span
            data-testid="finding-confidence-badge"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-primary text-text-secondary border border-border-subtle text-[11px] font-mono"
          >
            <strong>Confidence:</strong> {confidenceDisplay}
          </span>
        </div>
      </div>

      {/* Explanation & Descriptions */}
      <div className="text-xs text-text-secondary leading-relaxed space-y-1">
        {issue.description && (
          <p className="font-medium text-text-primary">{issue.description}</p>
        )}
        {issue.explanation && issue.explanation !== issue.description && (
          <p className="text-text-secondary">{issue.explanation}</p>
        )}
      </div>

      {/* Original Vulnerable Code Snippet */}
      {issue.originalSnippet && (
        <div className="mt-1">
          <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono text-text-muted">
            <span>Vulnerable Code Context</span>
            <button
              type="button"
              onClick={() => setIsSnippetExpanded(!isSnippetExpanded)}
              className="inline-flex items-center gap-1 hover:text-text-primary transition-colors cursor-pointer"
            >
              <span>{isSnippetExpanded ? 'Collapse' : 'Expand'}</span>
              {isSnippetExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          {isSnippetExpanded && (
            <pre className="p-3 rounded bg-surface-primary border border-border-subtle font-mono text-xs text-rose-300 overflow-x-auto whitespace-pre">
              <code>{issue.originalSnippet}</code>
            </pre>
          )}
        </div>
      )}

      {/* Remediation Guidance & Suggested Fix */}
      {(issue.remediation || issue.suggestedSnippet) && (
        <div
          data-testid="remediation-section"
          className="mt-1 p-3.5 rounded-lg bg-surface-primary/90 border border-emerald-500/25 flex flex-col gap-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
              <Wrench className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Remediation Guidance</span>
            </div>

            {(issue.suggestedSnippet || issue.remediation) && (
              <button
                type="button"
                onClick={handleCopyFix}
                data-testid="copy-suggested-fix-btn"
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-tertiary hover:bg-surface-secondary border border-border-subtle text-[11px] font-mono text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                title="Copy suggested fix to clipboard"
              >
                {copiedFix ? (
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
            )}
          </div>

          {issue.remediation && (
            <p className="text-xs text-text-secondary leading-relaxed">
              {issue.remediation}
            </p>
          )}

          {issue.suggestedSnippet && (
            <pre className="mt-1 p-2.5 rounded bg-surface-secondary border border-border-subtle font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre">
              <code>{issue.suggestedSnippet}</code>
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}

export default SecurityFindingCard;
