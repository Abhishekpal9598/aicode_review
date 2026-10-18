import React from 'react';
import { Badge } from '../ui/Badge';

export function PageHeader({
  title,
  description,
  icon: Icon,
  badgeText,
  badgeVariant = 'indigo',
  actions
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-border-subtle">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="p-2.5 rounded bg-surface-secondary border border-border-subtle text-brand-primary shrink-0 mt-0.5">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">
              {title}
            </h1>
            {badgeText && (
              <Badge variant={badgeVariant} size="xs" mono>
                {badgeText}
              </Badge>
            )}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export default PageHeader;
