import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FilterBar from '../components/FilterBar';

const mockIssues = [
  { id: 1, title: 'SQL Injection', severity: 'high', category: 'security' },
  { id: 2, title: 'Unused Variable', severity: 'low', category: 'style' },
  { id: 3, title: 'Slow Query', severity: 'medium', category: 'performance' },
  { id: 4, title: 'Null Pointer', severity: 'high', category: 'bug' }
];

function FilterBarWrapper() {
  const [selectedSeverities, setSelectedSeverities] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Compute filtered issues
  const filtered = mockIssues.filter((issue) => {
    if (
      selectedSeverities.length > 0 &&
      !selectedSeverities.includes(issue.severity.toLowerCase())
    ) {
      return false;
    }
    if (
      selectedCategories.length > 0 &&
      !selectedCategories.includes(issue.category.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <FilterBar
        selectedSeverities={selectedSeverities}
        setSelectedSeverities={setSelectedSeverities}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        issues={mockIssues}
      />
      <div data-testid="filtered-count">{filtered.length}</div>
      <div data-testid="filtered-titles">
        {filtered.map((i) => i.title).join(', ')}
      </div>
    </div>
  );
}

describe('FilterBar & Issue Filtering Logic', () => {
  it('renders accurate issue counts per severity chip', () => {
    render(<FilterBarWrapper />);

    // High: 2, Medium: 1, Low: 1
    const highBtn = screen.getByTestId('filter-severity-high');
    expect(highBtn).toHaveTextContent('High');
    expect(highBtn).toHaveTextContent('2');

    const medBtn = screen.getByTestId('filter-severity-medium');
    expect(medBtn).toHaveTextContent('Medium');
    expect(medBtn).toHaveTextContent('1');

    const lowBtn = screen.getByTestId('filter-severity-low');
    expect(lowBtn).toHaveTextContent('Low');
    expect(lowBtn).toHaveTextContent('1');
  });

  it('filters issues when severity chip is clicked', () => {
    render(<FilterBarWrapper />);

    // Initially all 4 issues present
    expect(screen.getByTestId('filtered-count')).toHaveTextContent('4');

    // Click High severity filter
    fireEvent.click(screen.getByTestId('filter-severity-high'));

    // Should now only show 2 high severity issues
    expect(screen.getByTestId('filtered-count')).toHaveTextContent('2');
    expect(screen.getByTestId('filtered-titles')).toHaveTextContent('SQL Injection, Null Pointer');
  });

  it('supports multi-select filters and combined category filter', () => {
    render(<FilterBarWrapper />);

    // Click High severity
    fireEvent.click(screen.getByTestId('filter-severity-high'));
    // Click Security category
    fireEvent.click(screen.getByTestId('filter-category-security'));

    // Only SQL Injection matches both high severity and security
    expect(screen.getByTestId('filtered-count')).toHaveTextContent('1');
    expect(screen.getByTestId('filtered-titles')).toHaveTextContent('SQL Injection');
  });

  it('clears all filters when Clear Filters button is clicked', () => {
    render(<FilterBarWrapper />);

    fireEvent.click(screen.getByTestId('filter-severity-high'));
    expect(screen.getByTestId('filtered-count')).toHaveTextContent('2');

    const clearBtn = screen.getByTestId('clear-filters-btn');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(screen.getByTestId('filtered-count')).toHaveTextContent('4');
  });
});
