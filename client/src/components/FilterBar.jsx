import React from 'react';
import { Filter, X, ShieldAlert, Bug, Zap, Palette, Wrench } from 'lucide-react';

const CATEGORY_ICONS = {
  bug: Bug,
  security: ShieldAlert,
  performance: Zap,
  style: Palette,
  maintainability: Wrench
};

export default function FilterBar({
  selectedSeverities = [],
  setSelectedSeverities,
  selectedCategories = [],
  setSelectedCategories,
  issues = []
}) {
  // Count by severity
  const severityCounts = {
    high: issues.filter((i) => i.severity?.toLowerCase() === 'high').length,
    medium: issues.filter((i) => i.severity?.toLowerCase() === 'medium').length,
    low: issues.filter((i) => i.severity?.toLowerCase() === 'low').length
  };

  // Count by category
  const categories = ['bug', 'security', 'performance', 'style', 'maintainability'];
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = issues.filter((i) => i.category?.toLowerCase() === cat).length;
    return acc;
  }, {});

  const toggleSeverity = (sev) => {
    if (selectedSeverities.includes(sev)) {
      setSelectedSeverities(selectedSeverities.filter((s) => s !== sev));
    } else {
      setSelectedSeverities([...selectedSeverities, sev]);
    }
  };

  const toggleCategory = (cat) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const hasActiveFilters = selectedSeverities.length > 0 || selectedCategories.length > 0;

  const clearFilters = () => {
    setSelectedSeverities([]);
    setSelectedCategories([]);
  };

  return (
    <div className="space-y-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
          <Filter className="w-3.5 h-3.5 text-indigo-400" />
          <span>Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            data-testid="clear-filters-btn"
            className="flex items-center space-x-1 text-slate-400 hover:text-rose-400 transition"
          >
            <X className="w-3 h-3" />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      {/* Severity Chips */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
          Severity
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'high', label: 'High', color: 'rose', count: severityCounts.high },
            { id: 'medium', label: 'Medium', color: 'amber', count: severityCounts.medium },
            { id: 'low', label: 'Low', color: 'blue', count: severityCounts.low }
          ].map(({ id, label, color, count }) => {
            const isSelected = selectedSeverities.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleSeverity(id)}
                data-testid={`filter-severity-${id}`}
                className={`px-2.5 py-1 rounded-lg border font-medium flex items-center space-x-1.5 transition ${
                  isSelected
                    ? id === 'high'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : id === 'medium'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/50'
                    : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-slate-900/80 text-white' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Chips */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
          Category
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => {
            const isSelected = selectedCategories.includes(cat);
            const count = categoryCounts[cat] || 0;
            const Icon = CATEGORY_ICONS[cat] || Bug;

            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                data-testid={`filter-category-${cat}`}
                className={`px-2 py-1 rounded-lg border capitalize font-medium flex items-center space-x-1.5 transition ${
                  isSelected
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{cat}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-slate-900/80 text-white' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
