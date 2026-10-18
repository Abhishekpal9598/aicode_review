import React from 'react';
import { Badge } from '../ui/Badge';

export function EmptyState({
  icon: Icon,
  title,
  description,
  roadmapPhase,
  action,
  className = ''
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-border-subtle rounded-md bg-surface-primary/50 ${className}`}
    >
      {Icon && (
        <div className="p-3.5 rounded-full bg-surface-secondary border border-border-subtle text-text-muted mb-4">
          <Icon className="w-8 h-8" />
        </div>
      )}
      <h3 className="text-base font-semibold text-text-primary tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-text-secondary max-w-md mb-4 leading-relaxed">
        {description}
      </p>

      {roadmapPhase && (
        <div className="mb-6">
          <Badge variant="indigo" size="xs" mono>
            Scheduled for {roadmapPhase}
          </Badge>
        </div>
      )}

      {action && <div>{action}</div>}
    </div>
  );
}

export default EmptyState;
