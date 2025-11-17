// ============================================================================
// EarningsChart - Visual earnings over time
// ============================================================================

import React from 'react';
import {
  LineChart,
  Line,
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
  const formattedData = data.map(point => ({
    ...point,
    displayDate: format(new Date(point.date), 'MMM d'),
    displayAmount: `$${point.amount.toLocaleString()}`,
  }));

  const maxAmount = Math.max(...data.map(d => d.amount));
  const minAmount = Math.min(...data.map(d => d.amount));

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Earnings Trend</h3>
            <p className="text-sm text-gray-500 mt-1">Last 30 days</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              ${data.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">Total</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={formattedData}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="displayDate"
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'Earned']}
              labelFormatter={(label) => label}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorAmount)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
