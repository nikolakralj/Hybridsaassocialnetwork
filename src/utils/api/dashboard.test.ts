import { describe, expect, it } from 'vitest';
import { generateInsights } from './dashboard';
import type { WorkStats } from '../../types/dashboard';

const baseStats: WorkStats = {
  earnings: { current_period: 0, previous_period: 0, currency: 'USD', period: 'month', trend: 0 },
  hours: { total: 0, billable: 0, non_billable: 0, approved: 0, period: 'month' },
  pending_approvals: { count: 0, total_value: 0, currency: 'USD' },
  active_contracts: { count: 0, expiring_soon: 0 },
  invoices: { count: 0 },
};

describe('generateInsights', () => {
  it('shows no money/earning insight when there are no real rates or approved hours', () => {
    const insights = generateInsights(baseStats);
    expect(insights.find((i) => i.type === 'earning')).toBeUndefined();
    expect(insights.some((i) => i.description.includes('$'))).toBe(false);
  });

  it('shows an hours-based (not dollar) insight once hours are approved', () => {
    const insights = generateInsights({ ...baseStats, hours: { ...baseStats.hours, approved: 12 } });
    const earningInsight = insights.find((i) => i.id === 'insight-approved-hours');
    expect(earningInsight).toBeDefined();
    expect(earningInsight!.title).toBe('12h approved');
    expect(earningInsight!.description).not.toContain('$');
  });
});
