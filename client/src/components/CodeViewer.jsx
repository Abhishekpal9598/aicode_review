import React, { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

export default function CodeViewer({
  code = '',
  language = 'javascript',
  issues = [],
  selectedIssue = null,
  onSelectIssue
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);

  // Map language string to Monaco recognized language
  const monacoLang =
    language === 'python'
      ? 'python'
      : language === 'java'
      ? 'java'
      : language === 'typescript'
      ? 'typescript'
      : 'javascript';

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Listen to mouse click on glyph margin or editor line
    editor.onMouseDown((e) => {
      const targetLine = e.target?.position?.lineNumber;
      if (!targetLine) return;

      // Find issue matching clicked line
      const matchingIssue = issues.find(
        (issue) => targetLine >= issue.line_start && targetLine <= issue.line_end
      );

      if (matchingIssue && onSelectIssue) {
        onSelectIssue(matchingIssue);
      }
    });

    applyDecorations();
  };

  const applyDecorations = () => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const newDecorations = [];

    // Add decorations for each issue
    issues.forEach((issue) => {
      const sev = String(issue.severity || 'low').toLowerCase();
      const lineClass =
        sev === 'high'
          ? 'high-line-decoration'
          : sev === 'medium'
          ? 'medium-line-decoration'
          : 'low-line-decoration';

      const glyphClass =
        sev === 'high'
          ? 'high-glyph-margin'
          : sev === 'medium'
          ? 'medium-glyph-margin'
          : 'low-glyph-margin';

      const squiggleClass =
        sev === 'high'
          ? 'high-squiggle'
          : sev === 'medium'
          ? 'medium-squiggle'
          : 'low-squiggle';

      newDecorations.push({
        range: new monaco.Range(issue.line_start, 1, issue.line_end, 1),
        options: {
          isWholeLine: true,
          className: lineClass,
          glyphMarginClassName: glyphClass,
          inlineClassName: squiggleClass,
          glyphMarginHoverMessage: { value: `**[${issue.severity.toUpperCase()}]** ${issue.title}` }
        }
      });
    });

    // Add selected issue highlight decoration
    if (selectedIssue) {
      newDecorations.push({
        range: new monaco.Range(selectedIssue.line_start, 1, selectedIssue.line_end, 1),
        options: {
          isWholeLine: true,
          className: 'selected-line-decoration'
        }
      });
    }

    // Apply decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  };

  // Re-apply decorations whenever issues or selectedIssue change
  useEffect(() => {
    applyDecorations();

    // Scroll to selected line
    if (editorRef.current && selectedIssue && monacoRef.current) {
      const line = selectedIssue.line_start;
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setSelection(
        new monacoRef.current.Range(selectedIssue.line_start, 1, selectedIssue.line_end, 100)
      );
    }
  }, [issues, selectedIssue]);

  return (
    <div className="h-full w-full bg-slate-950 flex flex-col">
      <Editor
        height="100%"
        theme="vs-dark"
        language={monacoLang}
        value={code}
        onMount={handleEditorDidMount}
        options={{
          readOnly: true,
          glyphMargin: true,
          lineNumbers: 'on',
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 12, bottom: 12 },
          folding: true,
          automaticLayout: true
        }}
      />
    </div>
  );
}
