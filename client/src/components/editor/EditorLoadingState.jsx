import React from 'react';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function EditorLoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading editor"
      className="h-full min-h-[400px] w-full flex flex-col items-center justify-center bg-canvas text-text-muted gap-3"
    >
      <LoadingSpinner size="lg" />
      <span className="text-xs font-mono tracking-wide">
        Initializing Monaco Editor...
      </span>
    </div>
  );
}

export default EditorLoadingState;
