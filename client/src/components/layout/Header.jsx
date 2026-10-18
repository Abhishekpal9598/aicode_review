import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Terminal, LogOut, User as UserIcon } from 'lucide-react';
import { StatusPill } from '../ui/StatusPill';
import { Badge } from '../ui/Badge';
import { navItems } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export function Header({ onOpenMobile, healthStatus, onRetryHealth }) {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  // Find active navigation item title
  const currentNavItem = navItems.find((item) => item.path === location.pathname);
  const currentTitle = currentNavItem ? currentNavItem.label : 'Workstation';

  return (
    <header className="h-14 border-b border-border-subtle bg-surface-primary/80 backdrop-blur sticky top-0 z-40 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobile}
          className="md:hidden p-1.5 rounded hover:bg-surface-secondary text-text-secondary hover:text-text-primary cursor-pointer"
          aria-label="Open mobile navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile brand indicator */}
        <div className="flex md:hidden items-center gap-2">
          <Terminal className="w-4 h-4 text-brand-primary" />
          <span className="text-sm font-semibold text-text-primary">AI Code Review</span>
        </div>

        {/* Desktop Context Breadcrumb */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-text-secondary">
          <span className="text-text-muted">workstation</span>
          <span>/</span>
          <span className="text-text-primary font-medium">{currentTitle.toLowerCase()}</span>
        </div>
      </div>

      {/* Right Header Area: Live System Health & User Session */}
      <div className="flex items-center gap-3">
        <StatusPill status={healthStatus} onRetry={onRetryHealth} />

        {/* Authenticated User Session Badge & Logout */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-2 pl-3 border-l border-border-subtle/70">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center font-mono text-xs font-bold border border-brand-primary/30">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="text-xs font-medium text-text-primary max-w-[120px] truncate">
                {user.name}
              </span>
              <Badge variant="indigo" size="xs" mono>
                {user.role || 'developer'}
              </Badge>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded hover:bg-surface-secondary text-text-muted hover:text-status-critical transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
