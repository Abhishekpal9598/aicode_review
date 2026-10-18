import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  badgeVariant = 'indigo',
  badgeText,
  isUnavailable = false
}) {
  return (
    <Card hover className="flex flex-col justify-between p-5 bg-surface-secondary/60 border-border-subtle">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary font-mono">
            {title}
          </span>
          {Icon && (
            <div className="p-2 rounded bg-surface-primary/80 border border-border-subtle/80 text-brand-primary shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-1.5">
          {isUnavailable ? (
            <span className="text-lg font-bold text-text-muted font-mono tracking-tight">
              {value}
            </span>
          ) : value === null ? (
            <span className="text-3xl font-bold text-text-muted font-mono">
              --
            </span>
          ) : (
            <span className="text-3xl font-extrabold text-text-primary font-mono tracking-tight">
              {value}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border-subtle/60 flex items-center justify-between gap-2 text-xs">
        <span className="text-text-muted truncate max-w-[200px]" title={subtext}>
          {subtext}
        </span>
        {badgeText && (
          <Badge variant={badgeVariant} size="xs" mono className="shrink-0">
            {badgeText}
          </Badge>
        )}
      </div>
    </Card>
  );
}

export default MetricCard;
