import { describe, expect, it } from 'vitest';
import { computeGraphMonthTimeStats } from './month-time-stats';

const week = (personId: string, status: string, hours: number[], graphNodeId?: string) => ({
  personId, graphNodeId, weekStart: '2026-11-02', status,
  days: hours.map((h) => ({ hours: h, totalHours: h })),
});

describe('computeGraphMonthTimeStats', () => {
  const weeks = [week('ana', 'approved', [8, 0, 0, 0, 0]), week('will', 'approved', [8, 0, 0, 0, 0])];

  it('counts weeks the server returned for workers the scoped graph hides (end client view)', () => {
    // Client sees only the agency and its own people in the graph.
    const visible = new Set(['cara', 'ola']);
    const stats = computeGraphMonthTimeStats(weeks, '2026-11', visible, new Set(['cara', 'ola']));
    expect(stats).toEqual({ peopleWithHours: 2, hoursSubmitted: 16, hoursApproved: 16, pendingWeeks: 0 });
  });

  it('still hides people who are in the graph but filtered out of the current view', () => {
    const stats = computeGraphMonthTimeStats(weeks, '2026-11', new Set(['ana']), new Set(['ana', 'will']));
    expect(stats.peopleWithHours).toBe(1);
    expect(stats.hoursApproved).toBe(8);
  });

  it('keeps the old behaviour when the full graph is not passed', () => {
    expect(computeGraphMonthTimeStats(weeks, '2026-11', new Set()).peopleWithHours).toBe(0);
  });
});
