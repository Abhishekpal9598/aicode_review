import React from 'react';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Shield, Filter } from 'lucide-react';
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

export function OwaspDistributionChart({
  owaspDistribution = {},
  selectedOwasp = '',
  onSelectOwasp = () => {}
}) {
  // Normalize distribution into chart data
  const chartData = Object.entries(owaspDistribution || {}).map(([category, count]) => {
    // Short prefix for compact Y-axis display (e.g., "A03: Injection" from "A03:2021-Injection")
    const shortLabel = category.length > 24 ? `${category.slice(0, 22)}…` : category;
    const prefix = category.split(':')[0] || category;

    return {
      category,
      shortLabel,
      prefix,
      count: Number(count) || 0
    };
  });

  const totalCount = chartData.reduce((acc, item) => acc + item.count, 0);
  const activeItems = chartData.filter((item) => item.count > 0);

  // If there are zero non-zero items, still display top 5 categories with 0 count
  const displayData = activeItems.length > 0 ? chartData : chartData.slice(0, 5);

  const handleBarClick = (entry) => {
    if (!entry || !entry.category) return;
    if (selectedOwasp && (selectedOwasp === entry.prefix || selectedOwasp === entry.category)) {
      onSelectOwasp(''); // Toggle off
    } else {
      onSelectOwasp(entry.prefix);
    }
  };

  return (
    <Card
      data-testid="owasp-distribution-chart"
      className="flex flex-col justify-between p-5 bg-surface-secondary/70 border-border-subtle"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-primary shrink-0" />
          <CardHeader
            title="OWASP Top 10 (2021) Distribution"
            subtitle="Standardized vulnerability classification mapping"
          />
        </div>
        <Badge variant={totalCount > 0 ? 'rose' : 'slate'} size="xs" mono>
          {totalCount > 0 ? `${totalCount} Detected` : '0 Hazards'}
        </Badge>
      </div>

      <div className="min-h-[260px] w-full flex items-center justify-center">
        {chartData.length === 0 ? (
          <div className="text-center text-xs text-text-muted py-8">
            No OWASP distribution data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={displayData}
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
                dataKey="shortLabel"
                stroke="#94A3B8"
                fontSize={10}
                tickLine={false}
                width={140}
                fontFamily="JetBrains Mono, monospace"
              />
              <Tooltip
                cursor={{ fill: 'rgba(99, 102, 241, 0.08)' }}
                contentStyle={{
                  backgroundColor: '#111620',
                  borderColor: '#263248',
                  borderRadius: '6px',
                  color: '#F1F5F9',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px'
                }}
                formatter={(val, name, props) => [
                  `${val} issue(s)`,
                  props.payload.category
                ]}
              />
              <Bar
                dataKey="count"
                radius={[0, 4, 4, 0]}
                onClick={handleBarClick}
                className="cursor-pointer"
              >
                {displayData.map((entry) => {
                  const isSelected =
                    selectedOwasp &&
                    (selectedOwasp === entry.prefix ||
                      entry.category.toLowerCase().includes(selectedOwasp.toLowerCase()));
                  return (
                    <Cell
                      key={`owasp-cell-${entry.category}`}
                      fill={
                        isSelected
                          ? '#F43F5E'
                          : entry.count > 0
                          ? '#6366F1'
                          : '#263248'
                      }
                      fillOpacity={entry.count > 0 ? 0.9 : 0.4}
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
          Click any bar to filter findings by OWASP category
        </span>
        {selectedOwasp && (
          <span className="font-mono text-brand-primary">
            Filtered: {selectedOwasp}
          </span>
        )}
      </div>
    </Card>
  );
}

export default OwaspDistributionChart;
