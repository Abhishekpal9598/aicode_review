import React from 'react';
import { Filter, RotateCcw, X, ArrowUpDown } from 'lucide-react';
import { Badge } from '../ui/Badge';

export function SecurityFilterToolbar({
  filters = {
    severity: '',
    source: '',
    cwe: '',
    owasp: '',
    sort: 'severity_desc'
  },
  onFilterChange = () => {},
  onResetFilters = () => {},
  totalIssues = 0,
  filteredCount = 0
}) {
  const isFiltered = Boolean(
    filters.severity ||
    filters.source ||
    filters.cwe ||
    filters.owasp ||
    (filters.sort && filters.sort !== 'severity_desc')
  );

  return (
    <div
      data-testid="security-filter-toolbar"
      className="p-3 sm:p-4 rounded-lg bg-surface-secondary/80 border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
    >
      {/* Controls Section */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 text-text-muted font-medium mr-1">
          <Filter className="w-3.5 h-3.5 text-brand-primary" />
          <span>Filter Findings:</span>
        </div>

        {/* Severity Select */}
        <select
          aria-label="Filter by severity"
          data-testid="filter-severity"
          value={filters.severity || ''}
          onChange={(e) => onFilterChange('severity', e.target.value)}
          className="px-2.5 py-1.5 rounded bg-surface-primary border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-brand-primary cursor-pointer font-mono"
        >
          <option value="">All Severities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
          <option value="INFO">INFO</option>
        </select>

        {/* Source Select */}
        <select
          aria-label="Filter by source"
          data-testid="filter-source"
          value={filters.source || ''}
          onChange={(e) => onFilterChange('source', e.target.value)}
          className="px-2.5 py-1.5 rounded bg-surface-primary border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-brand-primary cursor-pointer font-mono"
        >
          <option value="">All Sources</option>
          <option value="hybrid">Hybrid (Static + AI)</option>
          <option value="static">Static Scanner</option>
          <option value="gemini">Gemini AI</option>
        </select>

        {/* Sort Select */}
        <div className="flex items-center gap-1">
          <ArrowUpDown className="w-3 h-3 text-text-muted ml-1" />
          <select
            aria-label="Sort security findings"
            data-testid="filter-sort"
            value={filters.sort || 'severity_desc'}
            onChange={(e) => onFilterChange('sort', e.target.value)}
            className="px-2.5 py-1.5 rounded bg-surface-primary border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-brand-primary cursor-pointer font-mono"
          >
            <option value="severity_desc">Highest Severity First</option>
            <option value="severity_asc">Lowest Severity First</option>
            <option value="line_asc">Line Number (Ascending)</option>
            <option value="line_desc">Line Number (Descending)</option>
          </select>
        </div>

        {/* Active OWASP Filter Pill */}
        {filters.owasp && (
          <span
            data-testid="active-owasp-pill"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-brand-primary/15 text-brand-primary border border-brand-primary/30 font-mono text-[11px]"
          >
            <span>OWASP: {filters.owasp}</span>
            <button
              type="button"
              onClick={() => onFilterChange('owasp', '')}
              aria-label="Remove OWASP filter"
              className="hover:text-text-primary cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {/* Active CWE Filter Pill */}
        {filters.cwe && (
          <span
            data-testid="active-cwe-pill"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[11px]"
          >
            <span>CWE: {filters.cwe}</span>
            <button
              type="button"
              onClick={() => onFilterChange('cwe', '')}
              aria-label="Remove CWE filter"
              className="hover:text-text-primary cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}

        {/* Reset Button */}
        {isFiltered && (
          <button
            type="button"
            data-testid="reset-filters-btn"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-surface-tertiary hover:bg-surface-primary text-text-secondary hover:text-text-primary border border-border-subtle transition-colors cursor-pointer"
            title="Reset all filters to default"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Counter Summary */}
      <div className="flex items-center gap-2 self-end md:self-auto shrink-0 font-mono text-xs">
        <span className="text-text-muted">Displaying:</span>
        <Badge variant={filteredCount > 0 ? 'indigo' : 'slate'} size="xs" mono>
          {filteredCount} / {totalIssues} Findings
        </Badge>
      </div>
    </div>
  );
}

export default SecurityFilterToolbar;
