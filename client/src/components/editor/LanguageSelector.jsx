import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Code, Sparkles, AlertTriangle } from 'lucide-react';
import { SUPPORTED_LANGUAGES, AUTO_DETECT_OPTION } from '../../utils/languageMap';

export function LanguageSelector({
  currentLanguage,
  selectedMode = 'auto',
  detectedLanguage = null,
  detectionConfidence = 'HIGH',
  detectionStatus = 'auto',
  onLanguageChange
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedConfig =
    SUPPORTED_LANGUAGES.find((lang) => lang.id === currentLanguage) ||
    SUPPORTED_LANGUAGES[0];

  const detectedConfig = detectedLanguage
    ? SUPPORTED_LANGUAGES.find((lang) => lang.id === detectedLanguage)
    : null;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select programming language"
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-primary hover:bg-surface-tertiary border border-border-subtle hover:border-brand-primary/60 text-text-primary text-xs font-medium transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-primary"
      >
        {selectedMode === 'auto' ? (
          <Sparkles className="w-3.5 h-3.5 text-brand-accent shrink-0" />
        ) : (
          <Code className="w-3.5 h-3.5 text-brand-primary shrink-0" />
        )}

        <div className="flex items-center gap-1.5 truncate">
          {selectedMode === 'auto' ? (
            <>
              <span className="font-semibold">Auto Detect</span>
              {detectedConfig && detectionConfidence !== 'UNCERTAIN' ? (
                <span className="text-[11px] text-brand-primary font-mono font-medium">
                  ({detectedConfig.label})
                </span>
              ) : detectionConfidence === 'UNCERTAIN' ? (
                <span className="text-[10px] text-amber-400 font-mono">
                  (?)
                </span>
              ) : null}
            </>
          ) : (
            <span className="font-semibold">{selectedConfig.label}</span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Available languages"
          className="absolute left-0 mt-1.5 w-56 rounded-md bg-surface-secondary border border-border-subtle shadow-elevated py-1 z-50 focus:outline-none animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Option: Auto Detect */}
          <button
            type="button"
            role="option"
            aria-label="Auto Detect"
            aria-selected={selectedMode === 'auto'}
            onClick={() => {
              onLanguageChange('auto');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
              selectedMode === 'auto'
                ? 'bg-brand-primary/15 text-brand-primary font-semibold'
                : 'text-text-primary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Sparkles className="w-3.5 h-3.5 text-brand-accent shrink-0" />
              <span>Auto Detect</span>
              {detectedConfig && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface-primary text-text-muted border border-border-subtle">
                  Auto: {detectedConfig.label}
                </span>
              )}
            </div>
            {selectedMode === 'auto' && (
              <Check className="w-3.5 h-3.5 text-brand-primary shrink-0" />
            )}
          </button>

          <div className="border-t border-border-subtle/60 my-1 mx-1.5" />

          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-muted">
            Languages (6)
          </div>

          {SUPPORTED_LANGUAGES.map((lang) => {
            const isCurrent = selectedMode === 'manual' && lang.id === selectedConfig.id;
            return (
              <button
                key={lang.id}
                role="option"
                aria-selected={isCurrent}
                onClick={() => {
                  onLanguageChange(lang.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-brand-primary/15 text-brand-primary font-semibold'
                    : 'text-text-primary hover:bg-surface-tertiary hover:text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span>{lang.label}</span>
                  <span className="text-[10px] font-mono text-text-muted">
                    {lang.extensions[0]}
                  </span>
                </div>
                {isCurrent && <Check className="w-3.5 h-3.5 text-brand-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
