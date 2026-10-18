import React, { useState } from 'react';
import {
  UploadCloud,
  Copy,
  Check,
  Trash2,
  RotateCcw,
  Sparkles,
  FileCode,
  AlertTriangle,
  X,
  Bot
} from 'lucide-react';
import LanguageSelector from './LanguageSelector';

export function EditorToolbar({
  language,
  fileName,
  isDirty,
  code,
  isResetConfirmOpen,
  onLanguageChange,
  onUploadClick,
  onClear,
  onRequestReset,
  onConfirmReset,
  onCancelReset,
  onAnalyze,
  isAnalyzing = false,
  isStale = false,
  onSubmitReview,
  isSubmittingReview = false,
  submissionStage = ''
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.warn('[EditorToolbar] Copy failed:', err);
    }
  };

  return (
    <div
      aria-label="Editor Toolbar"
      className="h-12 bg-surface-secondary border-b border-border-subtle px-3 sm:px-4 flex items-center justify-between gap-2 overflow-x-auto select-none"
    >
      {/* Left section: Language Selector & File Name display */}
      <div className="flex items-center gap-3 shrink-0">
        <LanguageSelector
          currentLanguage={language}
          onLanguageChange={onLanguageChange}
        />

        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-primary border border-border-subtle/80 text-xs font-mono text-text-primary"
          title={`Active file: ${fileName}`}
        >
          <FileCode className="w-3.5 h-3.5 text-brand-primary shrink-0" />
          <span className="truncate max-w-[140px] sm:max-w-[200px]">{fileName}</span>
          {isDirty && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
              title="Modified (Unsaved to disk)"
            />
          )}
        </div>
      </div>

      {/* Right section: Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Upload Code Button */}
        <button
          type="button"
          onClick={onUploadClick}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-medium transition-colors cursor-pointer"
          title="Upload source file (.py, .js, .ts, .java, .c, .cpp) max 1 MB"
          aria-label="Upload code"
        >
          <UploadCloud className="w-3.5 h-3.5 text-text-muted" />
          <span className="hidden sm:inline">Upload</span>
        </button>

        {/* Copy Code Button */}
        <button
          type="button"
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
            copied
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-surface-primary hover:bg-surface-tertiary border-border-subtle text-text-secondary hover:text-text-primary'
          }`}
          title="Copy code to clipboard"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-text-muted" />
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>

        {/* Clear Code Button */}
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-surface-primary hover:bg-rose-500/10 border border-border-subtle hover:border-rose-500/30 text-text-secondary hover:text-rose-400 text-xs font-medium transition-colors cursor-pointer"
          title="Clear editor buffer"
          aria-label="Clear code"
        >
          <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-rose-400" />
          <span className="hidden sm:inline">Clear</span>
        </button>

        {/* Reset Editor Button */}
        <button
          type="button"
          onClick={onRequestReset}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-text-secondary hover:text-text-primary text-xs font-medium transition-colors cursor-pointer"
          title="Reset to default language starter template"
          aria-label="Reset editor"
        >
          <RotateCcw className="w-3.5 h-3.5 text-text-muted" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Analyze Code Trigger Button (Phase 7 Static Engine) */}
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isAnalyzing || isSubmittingReview || !code || code.trim().length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
            isAnalyzing
              ? 'bg-brand-primary/40 border border-brand-primary/50 text-white cursor-wait opacity-80'
              : !code || code.trim().length === 0 || isSubmittingReview
              ? 'bg-surface-primary border border-border-subtle text-text-muted cursor-not-allowed opacity-60'
              : isStale
              ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/10'
              : 'bg-brand-primary hover:bg-brand-hover border border-brand-primary text-white shadow-sm shadow-brand-primary/20'
          }`}
          title={isStale ? 'Source modified. Click to re-run static analysis' : 'Run static code analysis'}
          aria-label={isAnalyzing ? 'Analyzing code...' : 'Analyze code'}
        >
          {isAnalyzing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Analyze Code</span>
              {isStale && (
                <span className="hidden md:inline text-[9px] px-1 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-400/30">
                  Re-run
                </span>
              )}
            </>
          )}
        </button>

        {/* Submit AI Review Button (Phase 8 Dual-Layer & Persistence) */}
        <button
          type="button"
          onClick={onSubmitReview}
          disabled={isAnalyzing || isSubmittingReview || !code || code.trim().length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
            isSubmittingReview
              ? 'bg-brand-accent/40 border border-brand-accent/50 text-white cursor-wait opacity-90'
              : !code || code.trim().length === 0 || isAnalyzing
              ? 'bg-surface-primary border border-border-subtle text-text-muted cursor-not-allowed opacity-60'
              : 'bg-gradient-to-r from-brand-primary to-brand-accent hover:from-brand-hover hover:to-indigo-500 border border-brand-accent/50 text-white shadow-sm shadow-brand-accent/25'
          }`}
          title="Submit code for dual static and Gemini AI analysis and persistent review"
          aria-label={isSubmittingReview ? (submissionStage || 'Submitting AI review...') : 'Submit AI Review'}
        >
          {isSubmittingReview ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
              <span>{submissionStage || 'Reviewing...'}</span>
            </>
          ) : (
            <>
              <Bot className="w-3.5 h-3.5 shrink-0" />
              <span>Submit AI Review</span>
            </>
          )}
        </button>
      </div>

      {/* Reset Confirmation Dialog / Popover Guard */}
      {isResetConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in-50 duration-150"
        >
          <div className="bg-surface-secondary border border-border-subtle rounded-lg max-w-sm w-full p-4 shadow-modal">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-amber-500/10 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 id="reset-dialog-title" className="text-sm font-semibold text-text-primary">
                  Reset Editor?
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Your current code has been modified. Resetting will discard these changes and restore the clean starter template.
                </p>
              </div>
              <button
                type="button"
                onClick={onCancelReset}
                className="text-text-muted hover:text-text-primary"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border-subtle/60">
              <button
                type="button"
                onClick={onCancelReset}
                className="px-3 py-1.5 rounded text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmReset}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-sm shadow-rose-500/20"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorToolbar;
