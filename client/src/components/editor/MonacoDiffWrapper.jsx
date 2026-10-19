import React, { useCallback, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { configureMonaco } from '../../config/monacoWorkers';
import { CYBERNETIC_THEME_NAME, defineCyberneticTheme } from './MonacoEditorWrapper';
import { EditorLoadingState } from './EditorLoadingState';
import { AlertCircle } from 'lucide-react';

// Ensure self-hosted Monaco workers and routing are initialized
configureMonaco();

export function MonacoDiffWrapper({
  original = '',
  modified = '',
  language = 'python',
  renderSideBySide = true,
  onMount,
  height = '100%',
  className = ''
}) {
  const [loadError, setLoadError] = useState(null);

  const handleBeforeMount = useCallback((monacoInstance) => {
    try {
      defineCyberneticTheme(monacoInstance);
    } catch (err) {
      console.warn('[MonacoDiffWrapper] Error defining theme:', err);
    }
  }, []);

  const handleEditorMount = useCallback(
    (diffEditorInstance, monacoInstance) => {
      try {
        if (monacoInstance && monacoInstance.editor) {
          monacoInstance.editor.setTheme(CYBERNETIC_THEME_NAME);
        }
        if (onMount) {
          onMount(diffEditorInstance, monacoInstance);
        }
      } catch (err) {
        console.warn('[MonacoDiffWrapper] Error setting theme on mount:', err);
      }
    },
    [onMount]
  );

  const diffOptions = {
    readOnly: true,
    renderSideBySide,
    lineNumbers: 'on',
    folding: true,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
    fontSize: 13,
    lineHeight: 20,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    diffAlgorithm: 'advanced',
    renderIndicators: true,
    ignoreTrimWhitespace: false,
    originalEditable: false,
    automaticLayout: true,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10
    }
  };

  if (loadError) {
    return (
      <div
        data-testid="monaco-diff-fallback"
        className="h-full min-h-[400px] flex flex-col p-4 bg-canvas text-text-primary"
      >
        <div className="flex items-center gap-2 p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs mb-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Monaco Diff Editor failed to initialize. Displaying structured fallback comparison.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          <div className="flex flex-col border border-border-subtle rounded bg-surface-primary p-3">
            <span className="text-xs font-semibold text-rose-400 mb-2">Original Source Code</span>
            <pre data-testid="diff-original-panel" className="font-mono text-xs overflow-auto flex-1">
              <code>{original}</code>
            </pre>
          </div>
          <div className="flex flex-col border border-border-subtle rounded bg-surface-primary p-3">
            <span className="text-xs font-semibold text-emerald-400 mb-2">Modified Code</span>
            <pre data-testid="diff-modified-panel" className="font-mono text-xs overflow-auto flex-1">
              <code>{modified}</code>
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="monaco-diff-editor-wrapper"
      data-language={language}
      data-theme={CYBERNETIC_THEME_NAME}
      className={`h-full w-full relative ${className}`}
    >
      <DiffEditor
        height={height}
        language={language}
        original={original}
        modified={modified}
        theme={CYBERNETIC_THEME_NAME}
        options={diffOptions}
        beforeMount={handleBeforeMount}
        onMount={handleEditorMount}
        loading={<EditorLoadingState />}
      />
    </div>
  );
}

export default MonacoDiffWrapper;
