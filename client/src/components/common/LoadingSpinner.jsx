import React from 'react';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({
  message = 'Loading...',
  size = 'md',
  className = ''
}) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-10 text-text-secondary ${className}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={`${sizes[size] || sizes.md} animate-spin text-brand-primary`} />
      {message && <p className="text-xs font-mono">{message}</p>}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default LoadingSpinner;
