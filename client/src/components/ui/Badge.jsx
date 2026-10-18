import React from 'react';

export function Badge({
  children,
  variant = 'slate',
  size = 'sm',
  mono = false,
  className = ''
}) {
  const variants = {
    indigo: 'bg-brand-primary/10 text-indigo-400 border-brand-primary/20',
    emerald: 'bg-status-success-bg text-emerald-400 border-status-success/20',
    amber: 'bg-status-warning-bg text-amber-400 border-status-warning/20',
    red: 'bg-status-critical-bg text-rose-400 border-status-critical/20',
    sky: 'bg-status-info-bg text-sky-400 border-status-info/20',
    slate: 'bg-surface-secondary text-text-secondary border-border-subtle'
  };

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded ${variants[variant] || variants.slate} ${sizes[size] || sizes.sm} ${mono ? 'font-mono' : ''} ${className}`}
    >
      {children}
    </span>
  );
}

export default Badge;
