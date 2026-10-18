import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';

const steps = [
  {
    title: 'Account Initialized & Authenticated',
    desc: 'Session active with HttpOnly JWT token and CSRF protection.',
    completed: true,
    link: null
  },
  {
    title: 'Configure Workspace Preferences',
    desc: 'Customize default indentation, editor theme, and default language.',
    completed: false,
    link: '/settings',
    linkLabel: 'Go to Settings'
  },
  {
    title: 'Open Code Review Workspace',
    desc: 'Explore the Phase 6 Monaco code buffer and language switcher.',
    completed: false,
    link: '/code-review',
    linkLabel: 'Open Workspace'
  },
  {
    title: 'Inspect Reports & Audit Logs',
    desc: 'Review exported quality summaries and security findings.',
    completed: false,
    link: '/reports',
    linkLabel: 'View Reports'
  }
];

export function GettingStartedGuide() {
  return (
    <Card className="p-5 bg-surface-secondary/60 border-border-subtle flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <CardHeader
            title="Developer Onboarding"
            subtitle="Follow these steps to configure and master your workstation"
          />
          <Badge variant="indigo" size="xs" mono className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-brand-primary" />
            <span>Guide</span>
          </Badge>
        </div>

        <div className="space-y-3.5">
          {steps.map((step, idx) => (
            <div
              key={step.title}
              className={`p-3 rounded-md border text-xs transition-colors ${
                step.completed
                  ? 'bg-status-success-bg/30 border-status-success/30 text-text-primary'
                  : 'bg-surface-primary/40 border-border-subtle text-text-secondary hover:border-brand-primary/40'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {step.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text-primary truncate">
                      {idx + 1}. {step.title}
                    </span>
                    {step.completed && (
                      <span className="text-[10px] uppercase font-mono text-status-success font-semibold shrink-0">
                        Done
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">
                    {step.desc}
                  </p>
                  {step.link && (
                    <div className="mt-2">
                      <Link
                        to={step.link}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
                      >
                        <span>{step.linkLabel}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default GettingStartedGuide;
