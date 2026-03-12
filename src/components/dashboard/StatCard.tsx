// ============================================================================
// StatCard - Clean stat display with colored icon backgrounds
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
  bgColor?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'text-accent-brand',
  bgColor = 'bg-muted/50',
  onClick,
}: StatCardProps) {
  const hasPositiveTrend = trend !== undefined && trend > 0;
  const hasNegativeTrend = trend !== undefined && trend < 0;

  return (
    <Card
      className={`border-border/60 transition-all duration-150 ${onClick ? 'cursor-pointer hover:border-border hover:shadow-sm' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <p className="text-xl font-semibold text-foreground tracking-tight m-0">{value}</p>
              {trend !== undefined && (
                <div className={`flex items-center gap-0.5 ${hasPositiveTrend ? 'text-emerald-600' : hasNegativeTrend ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {hasPositiveTrend && <TrendingUp className="w-3 h-3" />}
                  {hasNegativeTrend && <TrendingDown className="w-3 h-3" />}
                  <span className="text-[11px] font-medium">
                    {hasPositiveTrend ? '+' : ''}{Math.abs(trend).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className={`p-2 rounded-lg ${bgColor} ${color} flex-shrink-0`}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
