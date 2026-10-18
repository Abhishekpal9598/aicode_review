import React from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Compass, ShieldCheck } from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

export function IssueRadarChart({ radarData = [] }) {
  const hasData = Array.isArray(radarData) && radarData.length > 0;

  return (
    <Card className="flex flex-col justify-between p-5 bg-surface-secondary/60 border-border-subtle">
      <div className="flex items-center justify-between gap-2 mb-4">
        <CardHeader
          title="Code Quality Radar"
          subtitle="5-dimensional architectural health distribution"
        />
        <Badge variant={hasData ? 'emerald' : 'slate'} size="xs" mono>
          {hasData ? 'Calibrated' : 'Phase 8 Engine'}
        </Badge>
      </div>

      <div className="min-h-[280px] w-full flex items-center justify-center">
        {hasData ? (
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke="#263248" />
              <PolarAngleAxis
                dataKey="dimension"
                stroke="#94A3B8"
                fontSize={11}
                fontFamily="JetBrains Mono, monospace"
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                stroke="#64748B"
                fontSize={10}
                fontFamily="JetBrains Mono, monospace"
              />
              <Radar
                name="Quality Score"
                dataKey="score"
                stroke="#6366F1"
                fill="#6366F1"
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-border-subtle rounded-md bg-surface-primary/40 w-full h-full min-h-[260px]">
            <div className="p-3 rounded-full bg-surface-secondary border border-border-subtle text-text-muted mb-3">
              <Compass className="w-6 h-6 text-brand-primary" />
            </div>
            <h4 className="text-sm font-semibold text-text-primary mb-1">
              Quality Radar Uncalibrated
            </h4>
            <p className="text-xs text-text-secondary max-w-sm leading-relaxed mb-3">
              Dimensions (Bug Safety, Security Hygiene, Runtime Efficiency, Cleanliness, Maintainability) activate upon completed code analyses in Phase 8.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Awaiting 5-axis telemetry</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default IssueRadarChart;
