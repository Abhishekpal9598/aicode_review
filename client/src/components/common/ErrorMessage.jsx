import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

export function ErrorMessage({
  title = 'An error occurred',
  message,
  onRetry,
  className = ''
}) {
  return (
    <div
      role="alert"
      className={`p-4 rounded-md border border-status-critical/30 bg-status-critical-bg text-text-primary ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-rose-300">{title}</h4>
          {message && <p className="text-xs text-text-secondary mt-1">{message}</p>}
          {onRetry && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                icon={RefreshCw}
                onClick={onRetry}
                className="text-xs"
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ErrorMessage;
