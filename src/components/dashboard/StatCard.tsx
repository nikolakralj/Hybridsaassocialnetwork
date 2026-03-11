// ============================================================================
// StatCard - Apple-minimalistic stat display
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
  color = 'text-accent-brand',
  onClick,
}: StatCardProps) {
  const hasPositiveTrend = trend !== undefined && trend > 0;
  const hasNegativeTrend = trend !== undefined && trend < 0;

  return (
    <Card 
      className={`border-border/60 ${onClick ? 'cursor-pointer hover:shadow-md transition-all duration-200' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
              {trend !== undefined && (
                <div className={`flex items-center gap-0.5 ${hasPositiveTrend ? 'text-emerald-600' : hasNegativeTrend ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {hasPositiveTrend && <TrendingUp className="w-3.5 h-3.5" />}
                  {hasNegativeTrend && <TrendingDown className="w-3.5 h-3.5" />}
                  <span className="text-xs font-medium">
                    {Math.abs(trend).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {icon && (
            <div className={`p-2.5 rounded-xl bg-muted/50 ${color}`}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
