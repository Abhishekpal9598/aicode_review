import React from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { EmptyState } from '../components/common/EmptyState';
import { Card } from '../components/ui/Card';
import { FileBarChart2, FileText, Download, Printer } from 'lucide-react';

export function Reports() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Reports & Exports"
        description="Generate, inspect, and export comprehensive code quality summaries for team leads, security auditors, or client deliverables."
        icon={FileBarChart2}
        badgeText="Roadmap Phase 13"
        badgeVariant="emerald"
      />

      <EmptyState
        icon={FileBarChart2}
        title="No Exported Reports"
        description="You have not generated any code audit reports yet. Once code analyses are executed in future phases, you will be able to export findings in Markdown, JSON, and print-optimized PDF formats."
        roadmapPhase="Phase 13: Audit Reports & Multi-Format Exporters"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="text-xs">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-2">
            <FileText className="w-4 h-4 text-brand-primary" />
            <span>Markdown Summary</span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            GitHub-ready Markdown summaries formatted for instant pasting into Pull Request review comments.
          </p>
        </Card>

        <Card className="text-xs">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-2">
            <Download className="w-4 h-4 text-brand-primary" />
            <span>Structured JSON</span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Machine-readable JSON telemetry for CI/CD pipeline integration and programmatic test suites.
          </p>
        </Card>

        <Card className="text-xs">
          <div className="flex items-center gap-2 text-text-primary font-semibold mb-2">
            <Printer className="w-4 h-4 text-brand-primary" />
            <span>Print-Optimized PDF</span>
          </div>
          <p className="text-text-secondary leading-relaxed">
            Executive audit documents with color-coded score badges and categorized vulnerability tables.
          </p>
        </Card>
      </div>
    </div>
  );
}

export default Reports;
