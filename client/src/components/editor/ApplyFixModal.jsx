import React from 'react';
import { Sparkles, AlertTriangle, X, Check, ArrowRight, ShieldAlert, Cpu, Bug, Wrench } from 'lucide-react';

export function ApplyFixModal({
  isOpen,
  finding,
  code = '',
  onConfirm,
  onCancel,
  isApplying = false
}) {
  if (!isOpen || !finding) return null;

  // Extract current lines from code buffer
  const lines = code ? code.split(/\r?\n/) : [];
  const lineStart = Math.max(1, finding.lineStart || 1);
  const lineEnd = Math.max(lineStart, finding.lineEnd || lineStart);
  const totalLines = lines.length;

  const isValidRange = lineStart >= 1 && lineEnd >= lineStart && lineEnd <= Math.max(1, totalLines);

  const currentLinesSnippet = isValidRange && lines.length > 0
    ? lines.slice(lineStart - 1, lineEnd).join('\n')
    : finding.originalSnippet || '';

  const suggestedSnippet = finding.suggestedSnippet || '';

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-fix-modal-title"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in-50 duration-150"
    >
      <div className="bg-surface-secondary border border-border-subtle rounded-xl max-w-2xl w-full p-5 shadow-modal flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="apply-fix-modal-title" className="text-sm font-semibold text-text-primary">
                Review & Apply Proposed Fix
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Target: Lines {lineStart}–{lineEnd} ({lineEnd - lineStart + 1} line{lineEnd > lineStart ? 's' : ''})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-tertiary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          {/* Finding Header Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-primary/10 text-brand-primary border border-brand-primary/30">
              {finding.severity || 'INFO'}
            </span>
            {finding.ruleId && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-text-muted border border-border-subtle">
                {finding.ruleId}
              </span>
            )}
            <span className="text-text-primary font-semibold text-xs">
              {finding.title}
            </span>
          </div>

          {/* Finding Explanation */}
          {finding.explanation && (
            <p className="text-text-secondary leading-relaxed bg-surface-primary p-2.5 rounded-lg border border-border-subtle/80">
              {finding.explanation}
            </p>
          )}

          {/* Range Boundary Validation Warning */}
          {!isValidRange && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>
                Warning: Target lines ({lineStart}–{lineEnd}) exceed current editor buffer length ({totalLines} lines). Range will be adjusted safely.
              </span>
            </div>
          )}

          {/* Side-by-side or Before/After Diff Comparison */}
          <div className="space-y-3">
            {/* Before / Vulnerable Code Block */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-rose-400">
                <span>Current Editor Code (Lines {lineStart}–{lineEnd})</span>
                <span className="text-[10px] text-text-muted">Will be replaced</span>
              </div>
              <pre
                data-testid="preview-current-code"
                className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-36"
              >
                <code>{currentLinesSnippet || '(empty line)'}</code>
              </pre>
            </div>

            {/* Downward replacement arrow indicator */}
            <div className="flex justify-center text-text-muted">
              <div className="px-2 py-0.5 rounded bg-surface-tertiary text-[10px] font-medium flex items-center gap-1 border border-border-subtle">
                <span>Replace with fix</span>
                <ArrowRight className="w-3 h-3 text-emerald-400 rotate-90" />
              </div>
            </div>

            {/* After / Corrected Code Block */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400">
                <span>Proposed Replacement Snippet</span>
                <span className="text-[10px] text-emerald-400/80 font-medium">Safe resolution</span>
              </div>
              <pre
                data-testid="preview-suggested-code"
                className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-36"
              >
                <code>{suggestedSnippet}</code>
              </pre>
            </div>
          </div>

          {/* Remediation Rationale Note */}
          {finding.remediation && (
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 text-[11px] leading-relaxed">
              <strong className="text-indigo-300 font-semibold block mb-0.5">
                Why this fix is safe:
              </strong>
              {finding.remediation}
            </div>
          )}

          {/* Safety Guarantees Notice */}
          <div className="p-2.5 rounded-lg bg-surface-primary border border-border-subtle text-[11px] text-text-muted">
            Safety Assurance: Only lines {lineStart}–{lineEnd} are modified. Surrounding code, imports, and indentation are preserved. You can undo this change anytime via the toolbar.
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={isApplying}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onConfirm(finding)}
            disabled={isApplying || !suggestedSnippet}
            data-testid="confirm-apply-fix-button"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-sm shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApplying ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Applying Fix...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Confirm & Apply Fix</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApplyFixModal;
