import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Code2,
  ShieldCheck,
  Cpu,
  History,
  GitCompare,
  FileBarChart2,
  Settings,
  Terminal,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-react';

export const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/code-review', label: 'Code Review', icon: Code2 },
  { path: '/security', label: 'Security Analysis', icon: ShieldCheck },
  { path: '/performance', label: 'Performance Analysis', icon: Cpu },
  { path: '/history', label: 'Review History', icon: History },
  { path: '/comparison', label: 'Code Comparison', icon: GitCompare },
  { path: '/reports', label: 'Reports', icon: FileBarChart2 },
  { path: '/settings', label: 'Settings', icon: Settings }
];

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile
}) {
  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface-primary border-r border-border-subtle select-none">
      {/* Brand Identity */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-border-subtle">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="p-1.5 rounded bg-brand-primary/10 border border-brand-primary/20 text-brand-primary shrink-0">
            <Terminal className="w-4 h-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-sm font-semibold text-text-primary truncate tracking-tight">
                AI Code Review
              </span>
              <span className="text-[10px] text-text-muted font-mono leading-none">
                Workstation v1.0
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        {isMobileOpen && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded hover:bg-surface-secondary text-text-secondary hover:text-text-primary cursor-pointer"
            aria-label="Close mobile navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={isMobileOpen ? onCloseMobile : undefined}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2.5 py-2 rounded text-xs font-medium transition-colors cursor-pointer group ${
                  isActive
                    ? 'bg-brand-primary/15 text-brand-primary font-semibold shadow-sm shadow-brand-primary/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                } ${isCollapsed ? 'justify-center px-2' : ''}`
              }
            >
              <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Footer with collapse toggle (Desktop only) */}
      <div className="p-2 border-t border-border-subtle hidden md:block">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded text-xs text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors cursor-pointer"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span className="truncate text-[11px] font-mono">Collapse Rail</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 transition-all duration-200 ${
          isCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
