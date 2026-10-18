import { RefreshCw, AlertCircle } from 'lucide-react';

export function StatusPill({ status, onRetry, compact = false }) {
  if (status === 'checking') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-secondary border border-border-subtle text-xs font-mono text-text-secondary">
        <RefreshCw className="w-3 h-3 text-status-warning animate-spin" />
        {!compact && <span>Checking API...</span>}
      </div>
    );
  }

  if (status === 'online') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-success-bg border border-status-success/30 text-xs font-mono text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>API Online</span>
      </div>
    );
  }

  // Unavailable state
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-critical-bg border border-status-critical/30 text-xs font-mono text-rose-400">
      <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
      <span>API Unavailable</span>
      {onRetry && (
        <button
          onClick={onRetry}
          title="Retry connection"
          className="ml-1 p-0.5 rounded hover:bg-surface-tertiary transition-colors cursor-pointer text-text-primary"
          aria-label="Retry connection"
        >
          <RefreshCw className="w-3 h-3 hover:rotate-180 transition-transform duration-300" />
        </button>
      )}
    </div>
  );
}

export default StatusPill;
