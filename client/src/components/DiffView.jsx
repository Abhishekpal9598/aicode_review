import React, { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Columns, SplitSquareVertical } from 'lucide-react';

export default function DiffView({ original = '', modified = '', language = 'javascript' }) {
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  // Map language aliases
  const monacoLang = language === 'python' ? 'python' : language === 'java' ? 'java' : language === 'typescript' ? 'typescript' : 'javascript';

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center space-x-3">
          <span className="text-rose-400 font-mono">Original Code</span>
          <span className="text-slate-500">→</span>
          <span className="text-emerald-400 font-mono">Suggested Fix</span>
        </div>
        <button
          onClick={() => setRenderSideBySide(!renderSideBySide)}
          className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 transition"
          title={renderSideBySide ? 'Switch to inline diff' : 'Switch to side-by-side diff'}
        >
          {renderSideBySide ? (
            <>
              <SplitSquareVertical className="w-3 h-3" />
              <span>Inline</span>
            </>
          ) : (
            <>
              <Columns className="w-3 h-3" />
              <span>Side-by-side</span>
            </>
          )}
        </button>
      </div>

      <div className="h-44">
        <DiffEditor
          original={original}
          modified={modified}
          language={monacoLang}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide,
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 6, bottom: 6 },
            diffWordWrap: 'on'
          }}
        />
      </div>
    </div>
  );
}
