import React, { Suspense, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useInRouterContext } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/ui/Card';
import {
  Code2,
  AlertCircle,
  X,
  Keyboard,
  FileCheck,
  ShieldCheck,
  Sparkles,
  Bot,
  AlertTriangle,
  Check
} from 'lucide-react';
import useEditorState from '../hooks/useEditorState';
import EditorToolbar from '../components/editor/EditorToolbar';
import EditorStatusBar from '../components/editor/EditorStatusBar';
import FileUploadZone from '../components/editor/FileUploadZone';
import FindingsPanel from '../components/editor/FindingsPanel';
import ApplyFixModal from '../components/editor/ApplyFixModal';
import { EditorLoadingState } from '../components/editor/EditorLoadingState';
import apiClient from '../services/apiClient';
import { detectLanguageMismatch, SUPPORTED_LANGUAGES } from '../utils/languageMap';

// Lazy-load MonacoEditorWrapper to keep Monaco out of the initial application bundle
const MonacoEditorWrapper = React.lazy(
  () => import('../components/editor/MonacoEditorWrapper')
);

export function CodeReview(props) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <CodeReviewRouterWrapper {...props} />;
  }
  const defaultParams = new URLSearchParams();
  return <CodeReviewContent {...props} searchParams={defaultParams} setSearchParams={() => {}} />;
}

function CodeReviewRouterWrapper(props) {
  const [searchParams, setSearchParams] = useSearchParams();
  return <CodeReviewContent {...props} searchParams={searchParams} setSearchParams={setSearchParams} />;
}

function CodeReviewContent({ searchParams, setSearchParams }) {
  const reviewIdParam = searchParams.get('reviewId');

  const uploadZoneRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const loadedReviewIdRef = useRef(null);

  const [analysisResult, setAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [submissionStage, setSubmissionStage] = useState('');
  const [analysisError, setAnalysisError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [activeFindingId, setActiveFindingId] = useState(null);
  const [isFindingsOpen, setIsFindingsOpen] = useState(false);
  const [pendingDeepLinkReviewId, setPendingDeepLinkReviewId] = useState(null);

  // Phase 11: Apply Fix & Undo state
  const [undoStack, setUndoStack] = useState([]);
  const [appliedFixIds, setAppliedFixIds] = useState([]);
  const [activeFixToPreview, setActiveFixToPreview] = useState(null);
  const [isApplyingFix, setIsApplyingFix] = useState(false);
  const [fixFeedback, setFixFeedback] = useState(null);

  const {
    code,
    language,
    effectiveLanguage,
    selectedMode,
    manualLanguage,
    detectedLanguage,
    detectionConfidence,
    detectionStatus,
    isManualOverride,
    fileName,
    isDirty,
    error,
    telemetry,
    isResetConfirmOpen,
    updateCode,
    changeLanguage,
    handleFileUpload,
    clearCode,
    requestReset,
    confirmReset,
    cancelReset,
    dismissError
  } = useEditorState();

  const handleUploadClick = () => {
    if (uploadZoneRef.current) {
      uploadZoneRef.current.openFileDialog();
    }
  };

  // Capture editor & monaco instances on mount
  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (typeof window !== 'undefined') {
      window.__codeReviewEditor = editor;
      window.__updateCode = updateCode;
    }
  }, [updateCode]);

  // Clear line decorations helper
  const clearDecorations = useCallback(() => {
    if (editorRef.current && decorationsRef.current.length > 0) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
    }
  }, []);

  // Handle code change: invalidate findings & mark stale (preserves results in state)
  const handleCodeChange = useCallback(
    (newCode) => {
      updateCode(newCode);
      if (analysisResult) {
        setIsStale(true);
        clearDecorations();
      }
    },
    [updateCode, analysisResult, clearDecorations]
  );

  // Handle language change: reset results & clear decorations
  const handleLanguageChange = useCallback(
    (newLang) => {
      changeLanguage(newLang);
      setAnalysisResult(null);
      setIsStale(false);
      setIsFindingsOpen(false);
      setActiveFindingId(null);
      clearDecorations();
    },
    [changeLanguage, clearDecorations]
  );

  const mismatchInfo = useMemo(() => {
    if (selectedMode === 'auto') {
      return { isMismatch: false, detectedLanguage: null, detectedLabel: null };
    }
    return detectLanguageMismatch(code, language);
  }, [code, language, selectedMode]);

  // Apply Monaco line decorations for detected findings
  const applyDecorations = useCallback((findings) => {
    if (!editorRef.current || !monacoRef.current || !Array.isArray(findings)) return;

    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const newDecorations = findings.map((finding) => {
      const isPerf = finding.category === 'performance';
      const isCrit = finding.severity === 'CRITICAL';
      const isHigh = finding.severity === 'HIGH';

      const lineClass = isPerf
        ? (isCrit ? 'monaco-line-perf-critical' : isHigh ? 'monaco-line-perf-high' : 'monaco-line-perf-medium')
        : (isCrit ? 'monaco-line-critical' : isHigh ? 'monaco-line-high' : 'monaco-line-medium');

      const glyphClass = isPerf
        ? (isCrit ? 'monaco-glyph-perf-critical' : isHigh ? 'monaco-glyph-perf-high' : 'monaco-glyph-perf-medium')
        : (isCrit ? 'monaco-glyph-critical' : isHigh ? 'monaco-glyph-high' : 'monaco-glyph-medium');

      return {
        range: new monaco.Range(
          Math.max(1, finding.lineStart || 1),
          1,
          Math.max(1, finding.lineEnd || finding.lineStart || 1),
          1
        ),
        options: {
          isWholeLine: true,
          className: lineClass,
          glyphMarginClassName: glyphClass,
          overviewRuler: {
            color: isPerf
              ? (isCrit ? '#F43F5E' : isHigh ? '#F59E0B' : '#0EA5E9')
              : (isCrit ? '#F43F5E' : isHigh ? '#F59E0B' : '#EAB308'),
            position: monaco.editor.OverviewRulerLane.Full
          }
        }
      };
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, []);

  // Safe Monaco line navigation when user clicks finding card
  const handleSelectFinding = (finding) => {
    if (!finding) return;
    const findingId = finding.id || finding._id || `${finding.ruleId}-${finding.lineStart}`;
    setActiveFindingId(findingId);

    if (editorRef.current) {
      const editor = editorRef.current;
      const lineCount = editor.getModel()?.getLineCount() || 1;
      const targetLine = Math.min(Math.max(1, finding.lineStart || 1), lineCount);
      const targetCol = Math.max(1, finding.columnStart || 1);

      editor.revealLineInCenter(targetLine);
      editor.setPosition({ lineNumber: targetLine, column: targetCol });
      editor.focus();
    }
  };

  // Phase 11: Request to review & apply a fix (validates snippet & line range before opening modal)
  const handleRequestApplyFix = useCallback(
    (finding) => {
      if (!finding) return;
      if (!finding.suggestedSnippet || finding.suggestedSnippet.trim().length === 0) {
        setFixFeedback({
          type: 'error',
          message: 'Cannot apply fix: No suggested code replacement was provided for this finding.'
        });
        return;
      }

      const totalLines = (code || '').split(/\r?\n/).length;
      const lineStart = Math.max(1, finding.lineStart || 1);

      if (lineStart > totalLines) {
        setFixFeedback({
          type: 'error',
          message: `Cannot apply fix: Target line ${lineStart} exceeds current editor line count (${totalLines} lines).`
        });
        return;
      }

      setActiveFixToPreview(finding);
    },
    [code]
  );

  // Phase 11: Confirm and execute the proposed code fix
  const handleConfirmApplyFix = useCallback(
    async (finding) => {
      if (!finding || !finding.suggestedSnippet) return;

      setIsApplyingFix(true);
      setFixFeedback(null);

      const currentCode = code || '';
      const lines = currentCode.split(/\r?\n/);
      const totalLines = lines.length;

      const lineStart = Math.min(Math.max(1, finding.lineStart || 1), totalLines);
      const lineEnd = Math.min(Math.max(lineStart, finding.lineEnd || lineStart), totalLines);

      // Extract original snippet for undo history
      const originalSnippet = lines.slice(lineStart - 1, lineEnd).join('\n');

      // Preserve indentation: if target line has leading indentation, ensure replacement matches it
      const targetFirstLine = lines[lineStart - 1] || '';
      const indentMatch = targetFirstLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '';

      const rawReplacementLines = finding.suggestedSnippet.split(/\r?\n/);
      const replacementLines = (baseIndent && !rawReplacementLines[0].startsWith(baseIndent))
        ? rawReplacementLines.map((l) => (l.trim().length > 0 ? baseIndent + l : l))
        : rawReplacementLines;

      const indentedSnippet = replacementLines.join('\n');

      // Construct new code with multiline support and preserving surrounding code
      const beforeLines = lines.slice(0, lineStart - 1);
      const afterLines = lines.slice(lineEnd);
      const newCode = [...beforeLines, ...replacementLines, ...afterLines].join('\n');

      // Apply via Monaco executeEdits if mounted
      if (editorRef.current && monacoRef.current) {
        try {
          const editor = editorRef.current;
          const monaco = monacoRef.current;
          const model = editor.getModel();
          if (model) {
            const lineCount = model.getLineCount();
            const safeEndLine = Math.min(lineEnd, lineCount);
            const maxCol = model.getLineMaxColumn(safeEndLine);
            editor.executeEdits('apply-fix', [
              {
                range: new monaco.Range(lineStart, 1, safeEndLine, maxCol),
                text: indentedSnippet,
                forceMoveMarkers: true
              }
            ]);
            editor.pushUndoStop();
          }
        } catch (err) {
          console.warn('[CodeReview] Monaco executeEdits error:', err);
        }
      }

      // Update state
      updateCode(newCode);

      const fixRecord = {
        id: `fix-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        findingId: finding.id,
        ruleId: finding.ruleId || null,
        title: finding.title || 'Code Fix',
        previousCode: currentCode,
        appliedCode: newCode,
        lineStart,
        lineEnd,
        previousSnippet: originalSnippet,
        appliedSnippet: indentedSnippet,
        timestamp: new Date().toISOString()
      };

      setUndoStack((prev) => [...prev, fixRecord]);
      setAppliedFixIds((prev) => [...new Set([...prev, finding.id])]);

      // Persist to backend if review is loaded
      const currentReviewId = loadedReviewIdRef.current || (analysisResult?.review?._id?.toString?.() || analysisResult?.review?.id?.toString?.());
      if (currentReviewId && /^[0-9a-fA-F]{24}$/.test(currentReviewId)) {
        try {
          await apiClient.applyFix(currentReviewId, {
            issueId: /^[0-9a-fA-F]{24}$/.test(finding.id) ? finding.id : null,
            ruleId: finding.ruleId || null,
            lineStart,
            lineEnd,
            previousSnippet: originalSnippet,
            appliedSnippet: indentedSnippet,
            updatedCode: newCode
          });
        } catch (err) {
          console.warn('[CodeReview] Persist applied fix to backend error:', err);
        }
      }

      setActiveFixToPreview(null);
      setIsApplyingFix(false);
      setFixFeedback({
        type: 'success',
        message: `Successfully applied fix for "${finding.title}" at lines ${lineStart}–${lineEnd}.`
      });
    },
    [code, updateCode, analysisResult]
  );

  // Phase 11: Undo the most recently applied fix (or specific finding) in LIFO order
  const handleUndoFix = useCallback(
    async (specificFindingId = null) => {
      if (undoStack.length === 0) {
        setFixFeedback({
          type: 'error',
          message: 'No applied fixes available to undo.'
        });
        return;
      }

      // Pop the most recent fix (or find specific if requested)
      const fixToUndo = specificFindingId
        ? undoStack.slice().reverse().find((f) => f.findingId === specificFindingId) || undoStack[undoStack.length - 1]
        : undoStack[undoStack.length - 1];

      const remainingStack = undoStack.filter((f) => f.id !== fixToUndo.id);
      setUndoStack(remainingStack);
      setAppliedFixIds((prev) => prev.filter((id) => id !== fixToUndo.findingId));

      // Restore exact previous editor buffer
      updateCode(fixToUndo.previousCode);

      if (editorRef.current) {
        try {
          editorRef.current.setValue(fixToUndo.previousCode);
        } catch (err) {
          console.warn('[CodeReview] Monaco setValue error on undo:', err);
        }
      }

      // Persist undo to backend if review is loaded
      const currentReviewId = loadedReviewIdRef.current || (analysisResult?.review?._id?.toString?.() || analysisResult?.review?.id?.toString?.());
      if (currentReviewId && /^[0-9a-fA-F]{24}$/.test(currentReviewId)) {
        try {
          await apiClient.undoFix(currentReviewId, {
            restoredCode: fixToUndo.previousCode
          });
        } catch (err) {
          console.warn('[CodeReview] Persist undo fix to backend error:', err);
        }
      }

      setFixFeedback({
        type: 'success',
        message: `Undid fix for "${fixToUndo.title}". Editor code restored.`
      });
    },
    [undoStack, updateCode, analysisResult]
  );

  // Trigger Static Code Analysis via API (Phase 7 transient checks)
  const handleAnalyze = async () => {
    if (!code || code.trim().length === 0 || isAnalyzing || isSubmittingReview) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await apiClient.analyzeCode({
        code,
        language,
        fileName
      });

      if (response && response.success && response.data) {
        setAnalysisResult(response.data);
        setIsStale(false);
        setIsFindingsOpen(true);
        applyDecorations(response.data.findings || []);
      } else {
        throw new Error(response?.message || 'Static analysis failed');
      }
    } catch (err) {
      console.error('[CodeReview] Analysis error:', err);
      setAnalysisError(err.message || 'Failed to analyze code. Please verify server connection.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Trigger Persistent AI Code Review (Phase 8 dual evaluation)
  const handleSubmitReview = async () => {
    if (!code || code.trim().length === 0 || isAnalyzing || isSubmittingReview) return;

    setIsSubmittingReview(true);
    setAnalysisError(null);
    setSubmissionStage('Step 1/3: Redacting secrets & running static checks...');

    const stageTimer1 = setTimeout(() => {
      setSubmissionStage('Step 2/3: Analyzing with Gemini AI...');
    }, 800);

    const stageTimer2 = setTimeout(() => {
      setSubmissionStage('Step 3/3: Persisting review records...');
    }, 2400);

    try {
      const payload = {
        code,
        language,
        title: fileName ? `Review of ${fileName}` : `${language.toUpperCase()} Code Review`,
        fileName: fileName || 'snippet',
        sourceType: 'pasted'
      };

      const response = await apiClient.createReview(payload);

      if (response && response.success && response.data) {
        setAnalysisResult(response.data);
        setIsStale(false);
        setIsFindingsOpen(true);
        applyDecorations(response.data.issues || []);
      } else {
        throw new Error(response?.message || 'Review submission failed');
      }
    } catch (err) {
      console.error('[CodeReview] Review error:', err);
      if (err.status === 401) {
        setAnalysisError('Authentication required or session expired. Please log in again to submit reviews.');
      } else if (err.status === 429) {
        setAnalysisError('Too many review requests from this IP address. Please wait a moment before submitting again.');
      } else if (err.status === 503) {
        setAnalysisError('Database service is currently unavailable. Please try again later.');
      } else {
        setAnalysisError(err.message || 'Failed to submit review. Please verify server connection.');
      }
    } finally {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      setIsSubmittingReview(false);
      setSubmissionStage('');
    }
  };

  // Helper to load an existing review by ID
  const loadReviewById = useCallback(
    async (id) => {
      setAnalysisError(null);
      try {
        const response = await apiClient.getReviewById(id);
        if (response && response.success && response.data) {
          const { review, issues } = response.data;
          if (review?.language && review.language !== language) {
            changeLanguage(review.language);
          }
          if (review?.currentCode) {
            updateCode(review.currentCode);
          } else if (review?.rawCode) {
            updateCode(review.rawCode);
          }
          if (review?.appliedFixes && Array.isArray(review.appliedFixes)) {
            const appliedIds = review.appliedFixes
              .map((f) => f.issueId?.toString() || f.ruleId)
              .filter(Boolean);
            setAppliedFixIds(appliedIds);
          }
          setAnalysisResult(response.data);
          setIsStale(false);
          setIsFindingsOpen(true);
          applyDecorations(issues || []);
          loadedReviewIdRef.current = id;
        } else {
          throw new Error(response?.message || 'Review not found');
        }
      } catch (err) {
        console.error('[CodeReview] Deep-link review load error:', err);
        setAnalysisError(
          err.status === 404
            ? 'Review not found or you do not have permission to access it.'
            : err.message || 'Failed to load review.'
        );
        // Clear param from URL to avoid re-triggering error
        setSearchParams({});
      }
    },
    [updateCode, changeLanguage, applyDecorations, setSearchParams]
  );

  // Effect: Handle deep linking via ?reviewId=<id>
  useEffect(() => {
    if (reviewIdParam && reviewIdParam !== loadedReviewIdRef.current) {
      if (isDirty) {
        // Prompt user confirmation to avoid overwriting modified editor buffer
        setPendingDeepLinkReviewId(reviewIdParam);
      } else {
        loadReviewById(reviewIdParam);
      }
    }
  }, [reviewIdParam, isDirty, loadReviewById]);

  // Effect: Handle line navigation via ?line=<number>
  useEffect(() => {
    const lineParam = searchParams.get('line');
    if (lineParam && editorRef.current) {
      const lineNum = parseInt(lineParam, 10);
      if (!isNaN(lineNum) && lineNum >= 1) {
        editorRef.current.revealLineInCenter(lineNum);
        editorRef.current.setPosition({ lineNumber: lineNum, column: 1 });
        editorRef.current.focus();
      }
    }
  }, [searchParams]);

  const handleConfirmDeepLink = () => {
    if (pendingDeepLinkReviewId) {
      const idToLoad = pendingDeepLinkReviewId;
      setPendingDeepLinkReviewId(null);
      loadReviewById(idToLoad);
    }
  };

  const handleCancelDeepLink = () => {
    setPendingDeepLinkReviewId(null);
    setSearchParams({});
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <PageHeader
        title="Code Review Workspace"
        description="Dual-layer deterministic static code analysis, Gemini AI intelligence, and Monaco workstation."
        icon={Code2}
        badgeText="Dual AI & Static Engine Active"
        badgeVariant="indigo"
      />

      {/* Dismissible Error Banner (Validation, Network, Rate Limit) */}
      {(error || analysisError) && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{error || analysisError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (error) dismissError();
              if (analysisError) setAnalysisError(null);
            }}
            aria-label="Dismiss error"
            className="p-1 rounded hover:bg-rose-500/20 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dismissible Apply/Undo Fix Feedback Banner */}
      {fixFeedback && (
        <div
          role="status"
          aria-live="polite"
          data-testid="fix-feedback-banner"
          className={`flex items-center justify-between p-3.5 rounded-lg border text-xs animate-in fade-in-50 duration-200 ${
            fixFeedback.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {fixFeedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-medium">{fixFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFixFeedback(null)}
            aria-label="Dismiss feedback"
            className={`p-1 rounded transition-colors cursor-pointer ${
              fixFeedback.type === 'error'
                ? 'hover:bg-rose-500/20 text-rose-400 hover:text-rose-200'
                : 'hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-200'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dynamic Language Mismatch Warning Banner */}
      {mismatchInfo.isMismatch && (
        <div
          role="alert"
          data-testid="language-mismatch-banner"
          className="flex items-center justify-between p-3.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium">
              Language Mismatch: The code appears to be written in <strong>{mismatchInfo.detectedLabel}</strong>, but <strong>{SUPPORTED_LANGUAGES.find((l) => l.id === language)?.label || language}</strong> is currently selected.
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleLanguageChange(mismatchInfo.detectedLanguage)}
            className="px-2.5 py-1 rounded bg-amber-500/30 hover:bg-amber-500/40 border border-amber-500/50 text-amber-100 font-semibold transition-colors cursor-pointer shrink-0 ml-2"
          >
            Switch to {mismatchInfo.detectedLabel}
          </button>
        </div>
      )}

      {/* Detection Uncertain Notice Banner */}
      {selectedMode === 'auto' && detectionConfidence === 'UNCERTAIN' && code && code.trim().length > 0 && (
        <div
          role="status"
          data-testid="detection-uncertain-banner"
          className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs animate-in fade-in-50 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Language detection is uncertain. Monaco is using <strong>{SUPPORTED_LANGUAGES.find((l) => l.id === language)?.label || language}</strong> syntax. You can confirm or manually select your language using the selector above.
            </span>
          </div>
        </div>
      )}

      {/* Deep Link Overwrite Confirmation Modal Guard */}
      {pendingDeepLinkReviewId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deeplink-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in-50 duration-150"
        >
          <div className="bg-surface-secondary border border-border-subtle rounded-lg max-w-sm w-full p-4 shadow-modal">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-amber-500/10 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 id="deeplink-dialog-title" className="text-sm font-semibold text-text-primary">
                  Load Saved Review?
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  You have unsaved changes in your editor. Loading this saved review will replace your current editor content.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelDeepLink}
                className="text-text-muted hover:text-text-primary"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border-subtle/60">
              <button
                type="button"
                onClick={handleCancelDeepLink}
                className="px-3 py-1.5 rounded text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors cursor-pointer"
              >
                Cancel & Keep Code
              </button>
              <button
                type="button"
                onClick={handleConfirmDeepLink}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-brand-primary hover:bg-brand-hover text-white transition-colors cursor-pointer shadow-sm shadow-brand-primary/20"
              >
                Load Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main IDE Workstation Container */}
      <FileUploadZone
        ref={uploadZoneRef}
        onFileSelected={handleFileUpload}
        className="rounded-lg border border-border-subtle bg-surface-primary shadow-elevated overflow-hidden flex flex-col min-h-[560px] h-[calc(100vh-14.5rem)]"
      >
        {/* Top Command Strip / Toolbar */}
        <EditorToolbar
          language={language}
          selectedMode={selectedMode}
          detectedLanguage={detectedLanguage}
          detectionConfidence={detectionConfidence}
          detectionStatus={detectionStatus}
          isManualOverride={isManualOverride}
          fileName={fileName}
          isDirty={isDirty}
          code={code}
          isResetConfirmOpen={isResetConfirmOpen}
          onLanguageChange={handleLanguageChange}
          onUploadClick={handleUploadClick}
          onClear={() => {
            clearCode();
            setAnalysisResult(null);
            setIsStale(false);
            setIsFindingsOpen(false);
            clearDecorations();
            setUndoStack([]);
            setAppliedFixIds([]);
            setFixFeedback(null);
          }}
          onRequestReset={requestReset}
          onConfirmReset={() => {
            confirmReset();
            setAnalysisResult(null);
            setIsStale(false);
            setIsFindingsOpen(false);
            clearDecorations();
            setUndoStack([]);
            setAppliedFixIds([]);
            setFixFeedback(null);
          }}
          onCancelReset={cancelReset}
          onUndoFix={() => handleUndoFix()}
          undoStackCount={undoStack.length}
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          isStale={isStale}
          onSubmitReview={handleSubmitReview}
          isSubmittingReview={isSubmittingReview}
          submissionStage={submissionStage}
        />

        {/* Center Workspace: Editor + Optional Findings Panel Split */}
        <div className="flex-1 min-h-0 flex flex-row overflow-hidden relative">
          {/* Monaco Editor Canvas */}
          <div className="flex-1 min-w-0 h-full relative">
            <Suspense fallback={<EditorLoadingState />}>
              <MonacoEditorWrapper
                code={code}
                language={language}
                onChange={handleCodeChange}
                onMount={handleEditorMount}
                height="100%"
              />
            </Suspense>
          </div>

          {/* Interactive Findings Panel Drawer */}
          {analysisResult && isFindingsOpen && (
            <FindingsPanel
              analysisResult={analysisResult}
              isStale={isStale}
              onSelectFinding={handleSelectFinding}
              onClose={() => setIsFindingsOpen(false)}
              activeFindingId={activeFindingId}
              onRetryReview={handleSubmitReview}
              onRequestApplyFix={handleRequestApplyFix}
              appliedFixIds={appliedFixIds}
              onUndoFix={handleUndoFix}
            />
          )}
        </div>

        {/* Bottom Status Bar */}
        <EditorStatusBar
          telemetry={telemetry}
          language={language}
          fileName={fileName}
          isDirty={isDirty}
        />
      </FileUploadZone>

      {/* Phase 11: Apply Fix Confirmation & Preview Modal */}
      {activeFixToPreview && (
        <ApplyFixModal
          isOpen={Boolean(activeFixToPreview)}
          finding={activeFixToPreview}
          code={code}
          onConfirm={handleConfirmApplyFix}
          onCancel={() => setActiveFixToPreview(null)}
          isApplying={isApplyingFix}
        />
      )}

      {/* Contextual Developer Guides & Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        <Card className="text-xs p-3.5">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-1.5">
            <Keyboard className="w-4 h-4 text-brand-primary" />
            <span>Editor Shortcuts</span>
          </div>
          <p className="text-text-secondary leading-relaxed text-[11px]">
            Use standard VS Code shortcuts: <code className="text-brand-primary bg-surface-tertiary px-1 py-0.5 rounded font-mono">Ctrl+F</code> for find, <code className="text-brand-primary bg-surface-tertiary px-1 py-0.5 rounded font-mono">Ctrl+Z</code> undo, and <code className="text-brand-primary bg-surface-tertiary px-1 py-0.5 rounded font-mono">Alt+Click</code> for multi-cursor.
          </p>
        </Card>

        <Card className="text-xs p-3.5">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-1.5">
            <Bot className="w-4 h-4 text-brand-accent" />
            <span>Dual-Layer Review Engine</span>
          </div>
          <p className="text-text-secondary leading-relaxed text-[11px]">
            Static checks identify local vulnerabilities instantly; Gemini AI evaluates logic, architecture, and time/space complexity with atomic persistence.
          </p>
        </Card>

        <Card className="text-xs p-3.5">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Automated Secret Redaction</span>
          </div>
          <p className="text-text-secondary leading-relaxed text-[11px]">
            AWS keys, GitHub tokens, database URLs, and PEM private keys are masked with 1:1 coordinate preservation before transmission or storage.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default CodeReview;
