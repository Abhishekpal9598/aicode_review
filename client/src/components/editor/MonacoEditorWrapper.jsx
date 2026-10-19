import React, { useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { configureMonaco } from '../../config/monacoWorkers';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { AlertCircle } from 'lucide-react';

// Initialize self-hosted Monaco and worker routing
configureMonaco();

export const CYBERNETIC_THEME_NAME = 'cybernetic-dark';

export function defineCyberneticTheme(monacoInstance) {
  if (!monacoInstance || !monacoInstance.editor) return;

  monacoInstance.editor.defineTheme(CYBERNETIC_THEME_NAME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
      { token: 'keyword', foreground: '818CF8', fontStyle: 'bold' },
      { token: 'string', foreground: '34D399' },
      { token: 'number', foreground: 'F59E0B' },
      { token: 'type', foreground: 'A78BFA' },
      { token: 'class', foreground: 'A78BFA' },
      { token: 'function', foreground: '38BDF8' },
      { token: 'operator', foreground: '94A3B8' },
      { token: 'variable', foreground: 'F1F5F9' },
      { token: 'delimiter', foreground: '94A3B8' }
    ],
    colors: {
      'editor.background': '#0A0D12',
      'editor.foreground': '#F1F5F9',
      'editorLineNumber.foreground': '#64748B',
      'editorLineNumber.activeForeground': '#818CF8',
      'editorCursor.foreground': '#6366F1',
      'editor.selectionBackground': '#222D42',
      'editor.inactiveSelectionBackground': '#18202F',
      'editor.lineHighlightBackground': '#111620',
      'editorGutter.background': '#0A0D12',
      'editorIndentGuide.background': '#18202F',
      'editorIndentGuide.activeBackground': '#263248',
      'diffEditor.insertedTextBackground': '#10B98128',
      'diffEditor.removedTextBackground': '#F43F5E28',
      'diffEditor.insertedLineBackground': '#10B98118',
      'diffEditor.removedLineBackground': '#F43F5E18',
      'diffEditor.diagonalFill': '#18202F',
      'diffEditorGutter.insertedLineBackground': '#10B98130',
      'diffEditorGutter.removedLineBackground': '#F43F5E30'
    }
  });
}
import { EditorLoadingState } from './EditorLoadingState';
export { EditorLoadingState };

export function MonacoEditorWrapper({
  code,
  language,
  onChange,
  onMount,
  height = '100%',
  className = ''
}) {
  const [loadError, setLoadError] = useState(null);

  const handleBeforeMount = useCallback((monacoInstance) => {
    try {
      defineCyberneticTheme(monacoInstance);
    } catch (err) {
      console.warn('[MonacoEditorWrapper] Error defining theme:', err);
    }
  }, []);

  const handleEditorMount = useCallback((editorInstance, monacoInstance) => {
    try {
      monacoInstance.editor.setTheme(CYBERNETIC_THEME_NAME);
      if (onMount) {
        onMount(editorInstance, monacoInstance);
      }
    } catch (err) {
      console.warn('[MonacoEditorWrapper] Error setting theme on mount:', err);
    }
  }, [onMount]);

  const handleEditorChange = useCallback(
    (value) => {
      if (onChange) {
        onChange(value ?? '');
      }
    },
    [onChange]
  );

  const tabSize = language === 'python' || language === 'java' ? 4 : 2;

  if (loadError) {
    return (
      <div className="h-full min-h-[400px] flex flex-col p-4 bg-canvas text-text-primary">
        <div className="flex items-center gap-2 p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs mb-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Monaco Editor failed to initialize. Fallback plain-text editor activated.</span>
        </div>
        <textarea
          data-testid="monaco-fallback-textarea"
          value={code}
          onChange={(e) => handleEditorChange(e.target.value)}
          aria-label="Code editor fallback"
          className="flex-1 w-full bg-surface-primary border border-border-subtle p-3 font-mono text-xs text-text-primary rounded focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
        />
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full bg-canvas overflow-hidden ${className}`}>
      <Editor
        height={height}
        language={language}
        value={code}
        theme={CYBERNETIC_THEME_NAME}
        beforeMount={handleBeforeMount}
        onMount={handleEditorMount}
        onChange={handleEditorChange}
        loading={<EditorLoadingState />}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          fontLigatures: true,
          lineHeight: 22,
          minimap: { enabled: true, maxColumn: 80 },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          wordWrap: 'on',
          tabSize: tabSize,
          insertSpaces: true,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on'
        }}
      />
    </div>
  );
}

export default MonacoEditorWrapper;
