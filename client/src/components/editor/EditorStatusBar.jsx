import React from 'react';
import { formatBytes } from '../../utils/languageMap';
import { FileText, Cpu, CheckCircle2 } from 'lucide-react';

export function EditorStatusBar({ telemetry, language, fileName, isDirty }) {
  const { lines, chars, bytes } = telemetry || { lines: 0, chars: 0, bytes: 0 };

  const indentation = language === 'python' || language === 'java' ? 'Spaces: 4' : 'Spaces: 2';

  return (
    <footer
      aria-label="Editor Status Bar"
      className="h-7 bg-surface-secondary/90 border-t border-border-subtle px-3 flex items-center justify-between text-[11px] font-mono text-text-muted select-none overflow-x-auto"
    >
      {/* Left side: Telemetry metrics */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5" title="Lines of Code">
          <FileText className="w-3 h-3 text-text-muted" />
          <span>
            <strong className="text-text-primary font-semibold">{lines}</strong> {lines === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <span className="text-border-subtle">|</span>

        <div title="Character Count">
          <span>
            <strong className="text-text-primary font-semibold">{chars.toLocaleString()}</strong> chars
          </span>
        </div>

        <span className="text-border-subtle">|</span>

        <div title="UTF-8 Byte Size">
          <span>
            <strong className="text-text-primary font-semibold">{formatBytes(bytes)}</strong>
          </span>
        </div>
      </div>

      {/* Right side: Language, Encoding, Indentation, and Draft status */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-text-secondary" title="Storage State">
          {isDirty ? (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Draft (Session)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Template Ready</span>
            </span>
          )}
        </div>

        <span className="hidden sm:inline text-border-subtle">|</span>

        <span className="hidden md:inline" title="Indentation Standard">
          {indentation}
        </span>

        <span className="hidden md:inline text-border-subtle">|</span>

        <span title="File Encoding">UTF-8</span>

        <span className="text-border-subtle">|</span>

        <div className="flex items-center gap-1 uppercase tracking-wider text-brand-primary font-semibold" title="Active Language">
          <Cpu className="w-3 h-3" />
          <span>{language}</span>
        </div>
      </div>
    </footer>
  );
}

export default EditorStatusBar;
