import React from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Tag, Filter } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';

export function CweDistributionChart({
  cweDistribution = {},
  selectedCwe = '',
  onSelectCwe = () => {}
}) {
  const chartData = Object.entries(cweDistribution || {})
    .map(([cwe, count]) => ({
      cwe,
      count: Number(count) || 0
    }))
    .sort((a, b) => b.count - a.count);

  const totalCount = chartData.reduce((acc, item) => acc + item.count, 0);

  const handleBarClick = (entry) => {
    if (!entry || !entry.cwe) return;
    if (selectedCwe && selectedCwe.toUpperCase() === entry.cwe.toUpperCase()) {
      onSelectCwe(''); // Toggle off
    } else {
      onSelectCwe(entry.cwe);
    }
  };

  return (
    <Card
      data-testid="cwe-distribution-chart"
      className="flex flex-col justify-between p-5 bg-surface-secondary/70 border-border-subtle"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-brand-primary shrink-0" />
          <CardHeader
            title="Common Weakness Enumeration (CWE)"
            subtitle="Identified software security weaknesses & flaws"
          />
        </div>
        <Badge variant={totalCount > 0 ? 'amber' : 'slate'} size="xs" mono>
          {totalCount > 0 ? `${chartData.length} CWE Types` : '0 CWEs'}
        </Badge>
      </div>

      <div className="min-h-[260px] w-full flex items-center justify-center">
        {chartData.length === 0 || totalCount === 0 ? (
          <div className="text-center text-xs text-text-muted py-8 font-mono">
            No CWE Mappings Detected
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#263248" horizontal={false} />
              <XAxis
                type="number"
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                allowDecimals={false}
                fontFamily="JetBrains Mono, monospace"
              />
              <YAxis
                type="category"
                dataKey="cwe"
                stroke="#94A3B8"
                fontSize={11}
                tickLine={false}
                width={120}
                fontFamily="JetBrains Mono, monospace"
              />
              <Tooltip
                cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }}
                contentStyle={{
                  backgroundColor: '#111620',
                  borderColor: '#263248',
                  borderRadius: '6px',
                  color: '#F1F5F9',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px'
                }}
                formatter={(val) => [`${val} issue(s)`, 'Frequency']}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                onClick={handleBarClick}
                className="cursor-pointer"
              >
                {chartData.map((entry) => {
                  const isSelected =
                    selectedCwe && selectedCwe.toUpperCase() === entry.cwe.toUpperCase();
                  return (
                    <Cell
                      key={`cwe-cell-${entry.cwe}`}
                      fill={isSelected ? '#F59E0B' : '#06B6D4'}
                      fillOpacity={0.85}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted mt-2 pt-2 border-t border-border-subtle/60">
        <span className="flex items-center gap-1">
          <Filter className="w-3 h-3 text-text-muted" />
          Click any bar to filter findings by CWE ID
        </span>
        {selectedCwe && (
          <span className="font-mono text-amber-400">
            Filtered: {selectedCwe}
          </span>
        )}
      </div>
    </Card>
  );
}

export default CweDistributionChart;
