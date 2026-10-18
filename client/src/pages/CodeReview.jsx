import React, { Suspense, useRef, useState, useCallback, useEffect } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import useEditorState from '../hooks/useEditorState';
import EditorToolbar from '../components/editor/EditorToolbar';
import EditorStatusBar from '../components/editor/EditorStatusBar';
import FileUploadZone from '../components/editor/FileUploadZone';
import FindingsPanel from '../components/editor/FindingsPanel';
import { EditorLoadingState } from '../components/editor/EditorLoadingState';
import apiClient from '../services/apiClient';

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

  const {
    code,
    language,
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
  }, []);

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

  // Apply Monaco line decorations for detected findings
  const applyDecorations = useCallback((findings) => {
    if (!editorRef.current || !monacoRef.current || !Array.isArray(findings)) return;

    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const newDecorations = findings.map((finding) => {
      const isCrit = finding.severity === 'CRITICAL';
      const isHigh = finding.severity === 'HIGH';

      return {
        range: new monaco.Range(
          Math.max(1, finding.lineStart || 1),
          Math.max(1, finding.columnStart || 1),
          Math.max(1, finding.lineEnd || finding.lineStart || 1),
          Math.max(1, finding.columnEnd || 100)
        ),
        options: {
          isWholeLine: true,
          className: isCrit
            ? 'bg-rose-500/15'
            : isHigh
            ? 'bg-amber-500/15'
            : 'bg-yellow-500/10',
          glyphMarginClassName: isCrit ? 'text-rose-400' : 'text-amber-400',
          overviewRuler: {
            color: isCrit ? '#F43F5E' : isHigh ? '#F59E0B' : '#EAB308',
            position: monaco.editor.OverviewRulerLane.Right
          }
        }
      };
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, []);

  // Safe Monaco line navigation when user clicks finding card
  const handleSelectFinding = (finding) => {
    if (!finding) return;
    setActiveFindingId(finding.id);

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
          if (review?.rawCode) {
            updateCode(review.rawCode);
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
          }}
          onRequestReset={requestReset}
          onConfirmReset={() => {
            confirmReset();
            setAnalysisResult(null);
            setIsStale(false);
            setIsFindingsOpen(false);
            clearDecorations();
          }}
          onCancelReset={cancelReset}
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
