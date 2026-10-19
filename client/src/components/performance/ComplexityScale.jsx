import React from 'react';

const SCALE_STEPS = [
  { notation: 'O(1)', label: 'Excellent', color: 'bg-emerald-500', text: 'text-emerald-400' },
  { notation: 'O(log n)', label: 'Good', color: 'bg-emerald-400', text: 'text-emerald-400' },
  { notation: 'O(n)', label: 'Fair', color: 'bg-blue-400', text: 'text-blue-400' },
  { notation: 'O(n log n)', label: 'Moderate', color: 'bg-cyan-400', text: 'text-cyan-400' },
  { notation: 'O(n²)', label: 'Poor', color: 'bg-amber-400', text: 'text-amber-400' },
  { notation: 'O(n³)', label: 'Critical', color: 'bg-rose-500', text: 'text-rose-400' },
  { notation: 'O(2^n)', label: 'Horrible', color: 'bg-rose-600', text: 'text-rose-500' }
];

export function ComplexityScale({ currentComplexity = 'O(1)' }) {
  const normalized = (currentComplexity || 'O(1)').trim();
  const activeIndex = SCALE_STEPS.findIndex((s) => s.notation === normalized);

  return (
    <div className="p-4 rounded-lg bg-surface-secondary/70 border border-border-subtle space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary font-medium">Algorithmic Efficiency Spectrum</span>
        <span className="text-text-muted text-[11px]">
          Current Position:{' '}
          <span className="font-mono font-semibold text-text-primary">{normalized}</span>
        </span>
      </div>

      {/* Scale Track */}
      <div className="grid grid-cols-7 gap-1">
        {SCALE_STEPS.map((step, idx) => {
          const isActive = idx === activeIndex || (activeIndex === -1 && idx === 0);
          return (
            <div key={step.notation} className="space-y-1.5 text-center">
              <div
                className={`h-2 rounded-full transition-all ${step.color} ${
                  isActive ? 'ring-2 ring-white/80 scale-y-125' : 'opacity-40'
                }`}
              />
              <div
                className={`font-mono text-[10px] ${
                  isActive ? `${step.text} font-bold` : 'text-text-muted'
                }`}
              >
                {step.notation}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ComplexityScale;
