import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/ui/Card';
import { GitCompare, Split, CheckCheck, FileDiff } from 'lucide-react';

export function CodeComparison() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Side-by-Side Code Comparison"
        description="Split-view visual comparison comparing original code against AI-refactored recommendations."
        icon={GitCompare}
        badgeText="Roadmap Phase 12"
        badgeVariant="indigo"
      />

      <EmptyState
        icon={GitCompare}
        title="Monaco Diff Editor"
        description="The side-by-side diff comparison workbench with syntax highlighting, deletion/insertion highlights, next/previous hunk navigation, and one-click copy will be unlocked in Phase 12."
        roadmapPhase="Phase 12: Side-by-Side Monaco Diff Code Comparison"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-xs">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-2">
            <Split className="w-4 h-4 text-brand-primary" />
            <span>Dual-Pane Viewport</span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Side-by-side split comparison displaying original untrusted input alongside corrected implementation.
          </p>
        </Card>

        <Card className="text-xs">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-2">
            <FileDiff className="w-4 h-4 text-brand-primary" />
            <span>Visual Hunk Markers</span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Subtle red deletion backdrops paired with emerald green addition highlights matching IDE standards.
          </p>
        </Card>

        <Card className="text-xs">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-2">
            <CheckCheck className="w-4 h-4 text-status-success" />
            <span>Production-Ready Fixes</span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Copyable refactored code blocks complete with plain-English rationales for why each edit matters.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default CodeComparison;
