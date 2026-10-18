import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Code } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../utils/languageMap';

export function LanguageSelector({ currentLanguage, onLanguageChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selected =
    SUPPORTED_LANGUAGES.find((lang) => lang.id === currentLanguage) ||
    SUPPORTED_LANGUAGES[0];

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
        <Code className="w-3.5 h-3.5 text-brand-primary" />
        <span className="font-semibold">{selected.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Available languages"
          className="absolute left-0 mt-1.5 w-48 rounded-md bg-surface-secondary border border-border-subtle shadow-elevated py-1 z-50 focus:outline-none animate-in fade-in-50 zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-muted border-b border-border-subtle/50 mb-1">
            Languages (6)
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isCurrent = lang.id === selected.id;
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
