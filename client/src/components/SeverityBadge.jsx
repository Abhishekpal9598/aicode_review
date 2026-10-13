import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

export default function SeverityBadge({ severity, count, size = 'sm' }) {
  const sev = String(severity || 'low').toLowerCase();

  const config = {
    high: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
      icon: AlertCircle,
      label: 'HIGH'
    },
    medium: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      icon: AlertTriangle,
      label: 'MEDIUM'
    },
    low: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      icon: Info,
      label: 'LOW'
    }
  };

  const current = config[sev] || config.low;
  const IconComponent = current.icon;
  const sizeClasses = size === 'xs'
    ? 'px-2 py-0.5 text-[10px]'
    : size === 'lg'
    ? 'px-3 py-1 text-sm'
    : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      data-testid={`severity-badge-${sev}`}
      className={`inline-flex items-center space-x-1.5 font-semibold rounded-full border ${current.bg} ${current.text} ${current.border} ${sizeClasses}`}
    >
      <IconComponent className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
      <span>{current.label}</span>
      {count !== undefined && (
        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-900/60 text-[11px] font-mono">
          {count}
        </span>
      )}
    </span>
  );
}
