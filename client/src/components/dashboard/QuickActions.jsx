import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Code2, ShieldCheck, Cpu, History, ArrowRight } from 'lucide-react';

const actions = [
  {
    title: 'Review Workspace',
    path: '/code-review',
    desc: 'In-browser code editor supporting C, C++, Java, Python, JS, TS.',
    icon: Code2,
    phaseBadge: 'Phase 6: Client-Side Workspace'
  },
  {
    title: 'Security Analysis',
    path: '/security',
    desc: 'Detect hardcoded secrets, injection vectors, and memory safety hazards.',
    icon: ShieldCheck,
    phaseBadge: 'Phase 9: Security Scanner'
  },
  {
    title: 'Performance Analysis',
    path: '/performance',
    desc: 'Big-O time & space complexity analysis and loop optimizations.',
    icon: Cpu,
    phaseBadge: 'Phase 10: Performance Profiler'
  },
  {
    title: 'Review History',
    path: '/history',
    desc: 'Browse, filter, and inspect past code reviews and audit diffs.',
    icon: History,
    phaseBadge: 'Phase 11: Review Archive'
  }
];

export function QuickActions() {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
        Workstation Quick Actions
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Card
              key={act.path}
              hover
              className="flex flex-col justify-between p-4 bg-surface-secondary/60 border-border-subtle"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="p-2 rounded bg-surface-primary border border-border-subtle text-brand-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <Badge variant="slate" size="xs" mono>
                    {act.phaseBadge}
                  </Badge>
                </div>
                <h4 className="text-sm font-semibold text-text-primary mb-1">
                  {act.title}
                </h4>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {act.desc}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border-subtle/50">
                <Link
                  to={act.path}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
                >
                  <span>Open Module</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default QuickActions;
