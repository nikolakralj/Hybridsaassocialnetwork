import type { StoredDay, StoredWeek } from '../types/timesheets';

/**
 * Month-close billing works on calendar days: a week that crosses a month
 * boundary is billed in two parts, each month invoicing only its own dates.
 *
 * Billing keys:
 *   - a week whose days all fall in one month keeps the whole-week key
 *     `${personId}:${weekStart}` (unchanged from before, so old invoices match);
 *   - a week that crosses months is keyed per month part:
 *     `${personId}:${weekStart}@${YYYY-MM}`.
 * A whole-week key on an older invoice blocks both parts, so a week invoiced
 * before this change is never billed again.
 */

const DAY_OFFSETS: Record<string, number> = {
  mon: 0, monday: 0,
  tue: 1, tues: 1, tuesday: 1,
  wed: 2, wednesday: 2,
  thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4,
  sat: 5, saturday: 5,
  sun: 6, sunday: 6,
};

export interface BillableWeek extends StoredWeek {
  /** Dedup key for this billable part (see module comment). */
  billingKey: string;
  /** Month this part is billed in (YYYY-MM). */
  billingMonth: string;
  /** First and last calendar date of this part (YYYY-MM-DD). */
  billingPeriod: { start: string; end: string };
  /** True when the week crosses months and this is one part of it. */
  isPartialWeek: boolean;
}

function parseIsoDate(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

function isoFromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Calendar date of a day in the week: by its name when known, else by position. */
export function dateOfWeekDay(weekStart: string, day: Pick<StoredDay, 'day'>, index: number): string {
  const offset = DAY_OFFSETS[String(day?.day || '').trim().toLowerCase()];
  const days = Number.isInteger(offset) ? offset : index;
  return isoFromUtc(parseIsoDate(weekStart) + days * 86_400_000);
}

export function wholeWeekKey(personId: string, weekStart: string): string {
  return `${personId}:${weekStart}`;
}

export function monthPartKey(personId: string, weekStart: string, monthKey: string): string {
  return `${personId}:${weekStart}@${monthKey}`;
}

function dayHours(day: StoredDay): number {
  const value = typeof day.totalHours === 'number' ? day.totalHours : day.hours;
  return Number.isFinite(value) ? Number(value) : 0;
}

/**
 * The part of `week` that belongs to `monthKey`, or null when none of its
 * days fall in that month. Days outside the month are zeroed, not removed, so
 * day order and labels stay intact.
 */
export function sliceWeekToMonth(week: StoredWeek, monthKey: string): BillableWeek | null {
  const days = Array.isArray(week.days) ? week.days : [];
  const dated = days.map((day, index) => ({ day, date: dateOfWeekDay(week.weekStart, day, index) }));
  const months = new Set(dated.map((entry) => entry.date.slice(0, 7)));
  if (months.size === 0) months.add(week.weekStart.slice(0, 7));

  const inMonth = dated.filter((entry) => entry.date.slice(0, 7) === monthKey);
  if (inMonth.length === 0) return null;

  const crossesMonths = months.size > 1;
  const slicedDays = dated.map(({ day, date }) => (
    date.slice(0, 7) === monthKey
      ? day
      : { ...day, hours: 0, totalHours: 0, entries: [] }
  ));
  const totalHours = slicedDays.reduce((sum, day) => sum + dayHours(day), 0);
  const personId = week.personId;

  return {
    ...week,
    days: slicedDays,
    totalHours,
    billingKey: crossesMonths
      ? monthPartKey(personId, week.weekStart, monthKey)
      : wholeWeekKey(personId, week.weekStart),
    billingMonth: monthKey,
    billingPeriod: { start: inMonth[0].date, end: inMonth[inMonth.length - 1].date },
    isPartialWeek: crossesMonths,
  };
}

/** Keys that, if already invoiced, mean this part must not be billed again. */
export function blockingKeysFor(week: BillableWeek): string[] {
  const whole = wholeWeekKey(week.personId, week.weekStart);
  return week.billingKey === whole ? [whole] : [week.billingKey, whole];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatBillingPeriod(period: { start: string; end: string }): string {
  const [, sm, sd] = period.start.split('-').map(Number);
  const [, em, ed] = period.end.split('-').map(Number);
  if (period.start === period.end) return `${sd} ${MONTHS[sm - 1]}`;
  if (sm === em) return `${sd}–${ed} ${MONTHS[sm - 1]}`;
  return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]}`;
}
