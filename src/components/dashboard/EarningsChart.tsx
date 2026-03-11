// ============================================================================
// EarningsChart - Apple-minimalistic earnings visualization
// ============================================================================

import React from 'react';
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

export function EarningsChart({ data, currency = 'USD' }: EarningsChartProps) {
  const formattedData = data.map((point, index) => ({
    ...point,
    // Use index suffix to guarantee uniqueness even if dates format the same
    displayDate: format(new Date(point.date), 'MMM d'),
    displayAmount: `$${point.amount.toLocaleString()}`,
    _key: `${point.date}-${index}`,
  }));

  return (
    <Card className="border-border/60">
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Earnings Trend</h3>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-foreground tracking-tight">
              ${data.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={formattedData}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop key="stop-top" offset="5%" stopColor="var(--accent-brand)" stopOpacity={0.15} />
                <stop key="stop-bottom" offset="95%" stopColor="var(--accent-brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="displayDate"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
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
                padding: '10px 14px',
                fontSize: '13px',
                boxShadow: 'var(--shadow-lg)',
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Earned']}
              labelFormatter={(label) => label}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--accent-brand)"
              strokeWidth={2}
              fill="url(#colorAmount)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}