import React from 'react';

export function Card({ children, className = '', hover = false, ...props }) {
  const hoverStyles = hover
    ? 'hover:border-border-focus/50 hover:bg-surface-secondary/40 transition-all duration-200'
    : '';

  return (
    <div
      className={`bg-surface-primary border border-border-subtle rounded-md p-5 text-text-primary ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`}>
      <div>
        {title && <h3 className="text-base font-semibold text-text-primary tracking-tight">{title}</h3>}
        {subtitle && <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export default Card;
