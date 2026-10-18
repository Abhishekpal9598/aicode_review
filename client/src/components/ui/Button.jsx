import React from 'react';
import { Loader2 } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  icon: Icon,
  type = 'button',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50 disabled:pointer-events-none rounded select-none cursor-pointer';

  const variants = {
    primary: 'bg-brand-primary hover:bg-brand-primary/90 text-white shadow-sm',
    secondary: 'bg-surface-secondary hover:bg-surface-tertiary text-text-primary border border-border-subtle',
    outline: 'border border-border-subtle hover:bg-surface-tertiary text-text-primary',
    ghost: 'hover:bg-surface-secondary text-text-secondary hover:text-text-primary',
    danger: 'bg-status-critical hover:bg-status-critical/90 text-white'
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5'
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0 text-current" />
      ) : null}
      {children}
    </button>
  );
}

export default Button;
