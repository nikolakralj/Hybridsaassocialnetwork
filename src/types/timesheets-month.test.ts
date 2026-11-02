import { describe, expect, it } from 'vitest';
import { storedDayIsoDate, sumWeekHoursInMonth } from './timesheets';

const week = {
  personId: 'p1',
  weekLabel: 'Nov 30-Dec 4',
  weekStart: '2026-11-30',
  tasks: [],
  status: 'draft' as const,
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => ({ day, hours: 8 })),
};

describe('sumWeekHoursInMonth', () => {
  it('maps day names to dates from the week start', () => {
    expect(storedDayIsoDate('2026-11-30', { day: 'Mon', hours: 0 }, 0)).toBe('2026-11-30');
    expect(storedDayIsoDate('2026-11-30', { day: 'Wed', hours: 0 }, 2)).toBe('2026-12-02');
  });

  it('counts only the days inside the month for a week spanning two months', () => {
    expect(sumWeekHoursInMonth(week as any, '2026-11')).toBe(8);
    expect(sumWeekHoursInMonth(week as any, '2026-12')).toBe(32);
  });
});
