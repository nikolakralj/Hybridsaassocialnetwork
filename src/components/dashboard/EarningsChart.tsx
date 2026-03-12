// ============================================================================
// EarningsChart - Clean earnings visualization
// ============================================================================

import React, { useId, memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardContent } from '../ui/card';
import type { EarningsDataPoint } from '../../types/dashboard';
import { format } from 'date-fns';

interface EarningsChartProps {
  data: EarningsDataPoint[];
  currency?: string;
}

export const EarningsChart = memo(function EarningsChart({ data, currency = 'USD' }: EarningsChartProps) {
  const total = data.reduce((sum, d) => sum + d.amount, 0);
  const gradientId = useId().replace(/:/g, '');

  const formattedData = data.map((point, index) => ({
    ...point,
    displayDate: format(new Date(point.date), 'MMM d'),
    displayAmount: `$${point.amount.toLocaleString()}`,
    _key: `${point.date}-${index}`,
  }));

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Earnings Trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-foreground tracking-tight">
              ${total.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground">Total</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-2 px-2">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={formattedData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id={`earnings-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-brand)" stopOpacity={0.12} />
                <stop offset="95%" stopColor="var(--accent-brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              strokeOpacity={0.4}
              vertical={false}
            />
            <XAxis
              dataKey="displayDate"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Earned']}
              labelFormatter={(label) => label}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--accent-brand)"
              strokeWidth={2}
              fill={`url(#earnings-grad-${gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)', fill: 'var(--accent-brand)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});