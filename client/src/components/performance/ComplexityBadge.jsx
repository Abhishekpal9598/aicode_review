import React from 'react';

const COMPLEXITY_VARIANTS = {
  'O(1)': {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    label: 'Constant'
  },
  'O(log n)': {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    label: 'Logarithmic'
  },
  'O(n)': {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    label: 'Linear'
  },
  'O(n log n)': {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    label: 'Linearithmic'
  },
  'O(n²)': {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    label: 'Quadratic'
  },
  'O(n³)': {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    label: 'Cubic'
  },
  'O(2^n)': {
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/40',
    text: 'text-rose-400 font-bold',
    label: 'Exponential'
  },
  'O(n!)': {
    bg: 'bg-rose-600/20',
    border: 'border-rose-600/50',
    text: 'text-rose-300 font-bold',
    label: 'Factorial'
  }
};

export function ComplexityBadge({
  complexity = 'O(1)',
  size = 'md',
  showLabel = false,
  className = ''
}) {
  const normalized = (complexity || 'O(1)').trim();
  const theme = COMPLEXITY_VARIANTS[normalized] || {
    bg: 'bg-surface-secondary',
    border: 'border-border-subtle',
    text: 'text-text-primary',
    label: 'Algorithmic'
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm font-mono',
    lg: 'px-3 py-1.5 text-base font-mono font-semibold'
  }[size] || 'px-2.5 py-1 text-sm font-mono';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border font-mono ${theme.bg} ${theme.border} ${theme.text} ${sizeClasses} ${className}`}
      data-testid="complexity-badge"
    >
      <span>{normalized}</span>
      {showLabel && (
        <span className="text-[10px] font-sans opacity-80 uppercase tracking-wider">
          ({theme.label})
        </span>
      )}
    </span>
  );
}

export default ComplexityBadge;
