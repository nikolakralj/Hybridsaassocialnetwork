// ============================================================================
// StatCard - Reusable stat display card
// ============================================================================

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'text-blue-600',
  onClick,
}: StatCardProps) {
  const hasPositiveTrend = trend !== undefined && trend > 0;
  const hasNegativeTrend = trend !== undefined && trend < 0;

  return (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {trend !== undefined && (
                <div className={`flex items-center gap-1 ${hasPositiveTrend ? 'text-green-600' : hasNegativeTrend ? 'text-red-600' : 'text-gray-500'}`}>
                  {hasPositiveTrend && <TrendingUp className="w-4 h-4" />}
                  {hasNegativeTrend && <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm font-medium">
                    {Math.abs(trend).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className={`p-3 rounded-lg bg-gray-50 ${color}`}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
