import React from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Activity, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

export function QualityScoreChart({ scoreHistory = [] }) {
  const hasData = Array.isArray(scoreHistory) && scoreHistory.length > 0;

  return (
    <Card className="flex flex-col justify-between p-5 bg-surface-secondary/60 border-border-subtle">
      <div className="flex items-center justify-between gap-2 mb-4">
        <CardHeader
          title="Score Progression Trajectory"
          subtitle="Chronological code quality trend over time"
        />
        <Badge variant={hasData ? 'emerald' : 'slate'} size="xs" mono>
          {hasData ? 'Live Data' : 'Phase 8 Engine'}
        </Badge>
      </div>

      <div className="min-h-[280px] w-full flex items-center justify-center">
        {hasData ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={scoreHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#263248" />
              <XAxis
                dataKey="date"
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                fontFamily="JetBrains Mono, monospace"
              />
              <YAxis
                domain={[0, 100]}
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                fontFamily="JetBrains Mono, monospace"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111620',
                  borderColor: '#263248',
                  borderRadius: '6px',
                  color: '#F1F5F9',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px'
                }}
              />
              <Area
                type="monotone"
                dataKey="averageScore"
                stroke="#6366F1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#scoreGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-border-subtle rounded-md bg-surface-primary/40 w-full h-full min-h-[260px]">
            <div className="p-3 rounded-full bg-surface-secondary border border-border-subtle text-text-muted mb-3">
              <Activity className="w-6 h-6 text-brand-primary" />
            </div>
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              No Score History Recorded
            </h4>
            <p className="text-xs text-text-secondary max-w-sm leading-relaxed mb-3">
              Historical trajectory curves will render automatically once code reviews are processed in Phase 8.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Awaiting review submissions</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default QualityScoreChart;
