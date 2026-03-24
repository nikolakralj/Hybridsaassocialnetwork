export interface DayTask {
  id: string;
  description: string;
  hours: number;
  category?: string;
}

export type TimeCategory =
  | 'regular'
  | 'overtime'
  | 'travel'
  | 'on_call'
  | 'training'
  | 'admin'
  | 'sick'
  | 'vacation'
  | 'public_holiday';

export interface TimeEntryMetadata {
  distanceKm?: number;
  vehicleType?: string;
  location?: string;
}

export interface TimeEntry {
  id: string;
  category: TimeCategory;
  hours: number;
  description?: string;
  billable: boolean;
  rateMultiplier?: number;
  metadata?: TimeEntryMetadata;
}

export interface StoredDay {
  day: string;
  hours: number;
  totalHours?: number;
  entries?: TimeEntry[];
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  notes?: string;
  tasks?: DayTask[];
}

export type WeekStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface StoredWeek {
  personId: string;
  weekLabel: string;
  weekStart: string;
  days: StoredDay[];
  tasks: string[];
  status: WeekStatus;
  submittedAt?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionNote?: string;
}

export type SubmissionEnvelopeType = 'weekly' | 'monthly' | 'custom';

export interface SubmissionEnvelope {
  id: string;
  type: SubmissionEnvelopeType;
  personId: string;
  projectId: string;
  period: {
    start: string;
    end: string;
  };
  weekIds: string[];
  status: WeekStatus;
  submittedAt?: string;
  approvedBy?: string;
  totalHours: number;
  totalBillableHours: number;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
  day?: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationOptions {
  maxDailyHours?: number;
  maxWeeklyHours?: number;
  requireEntryDescription?: boolean;
  warnOnMissingDays?: boolean;
  blockFutureDates?: boolean;
}

const NON_BILLABLE_CATEGORIES = new Set<TimeCategory>([
  'training',
  'admin',
  'sick',
  'vacation',
  'public_holiday',
]);

export function defaultBillableForCategory(category: TimeCategory): boolean {
  return !NON_BILLABLE_CATEGORIES.has(category);
}

export function makeRegularEntry(hours: number, description?: string): TimeEntry {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    category: 'regular',
    hours,
    description,
    billable: true,
  };
}

export function computeDayHours(day: StoredDay): number {
  if (Array.isArray(day.entries) && day.entries.length > 0) {
    return day.entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
  }
  if (typeof day.totalHours === 'number') {
    return day.totalHours;
  }
  return day.hours || 0;
}

export function normalizeStoredDay(day: StoredDay): StoredDay {
  const normalizedEntries =
    Array.isArray(day.entries) && day.entries.length > 0
      ? day.entries.map((entry) => ({
          ...entry,
          billable:
            typeof entry.billable === 'boolean'
              ? entry.billable
              : defaultBillableForCategory(entry.category),
        }))
      : day.tasks && day.tasks.length > 0
      ? day.tasks.map((task) => ({
          id: task.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          category: 'regular' as const,
          hours: task.hours || 0,
          description: task.description,
          billable: true,
        }))
      : day.hours > 0
      ? [makeRegularEntry(day.hours)]
      : [];

  const totalHours = normalizedEntries.reduce((sum, entry) => sum + (entry.hours || 0), 0);

  return {
    ...day,
    entries: normalizedEntries,
    totalHours,
    hours: totalHours,
  };
}

export function normalizeStoredWeek(week: StoredWeek): StoredWeek {
  return {
    ...week,
    days: (week.days || []).map((day) => normalizeStoredDay(day)),
  };
}

export function sumWeekHours(week: StoredWeek): number {
  return (week.days || []).reduce((sum, day) => sum + computeDayHours(day), 0);
}

export function sumWeekBillableHours(week: StoredWeek): number {
  return (week.days || []).reduce((sum, day) => {
    const normalized = normalizeStoredDay(day);
    return (
      sum +
      normalized.entries!.reduce((entrySum, entry) => {
        if (!entry.billable) return entrySum;
        return entrySum + (entry.hours || 0);
      }, 0)
    );
  }, 0);
}

function weekDayDate(weekStart: string, dayIndex: number): Date {
  const start = new Date(`${weekStart}T00:00:00`);
  const result = new Date(start);
  result.setDate(start.getDate() + dayIndex);
  return result;
}

export function validateTimesheetWeek(
  week: StoredWeek,
  options?: ValidationOptions
): ValidationResult {
  const maxDailyHours = options?.maxDailyHours ?? 12;
  const maxWeeklyHours = options?.maxWeeklyHours ?? 60;
  const requireEntryDescription = options?.requireEntryDescription ?? false;
  const warnOnMissingDays = options?.warnOnMissingDays ?? true;
  const blockFutureDates = options?.blockFutureDates ?? true;

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  week.days.forEach((day, dayIndex) => {
    const normalized = normalizeStoredDay(day);
    const dayHours = normalized.totalHours || 0;

    if (dayHours > maxDailyHours) {
      errors.push({
        code: 'MAX_DAILY_HOURS_EXCEEDED',
        message: `${day.day} has ${dayHours}h (max ${maxDailyHours}h).`,
        severity: 'error',
        day: day.day,
      });
    }

    if (warnOnMissingDays && dayHours === 0) {
      warnings.push({
        code: 'MISSING_DAY_HOURS',
        message: `${day.day} has no logged hours.`,
        severity: 'warning',
        day: day.day,
      });
    }

    if (blockFutureDates && dayHours > 0) {
      const date = weekDayDate(week.weekStart, dayIndex);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date.getTime() > today.getTime()) {
        errors.push({
          code: 'FUTURE_DATE_HOURS',
          message: `${day.day} is in the future and cannot be submitted.`,
          severity: 'error',
          day: day.day,
        });
      }
    }

    if (requireEntryDescription) {
      normalized.entries?.forEach((entry) => {
        if (entry.hours > 0 && !entry.description?.trim()) {
          warnings.push({
            code: 'ENTRY_DESCRIPTION_MISSING',
            message: `${day.day} has entries without description.`,
            severity: 'warning',
            day: day.day,
          });
        }
      });
    }
  });

  const weeklyHours = sumWeekHours(week);
  if (weeklyHours > maxWeeklyHours) {
    warnings.push({
      code: 'MAX_WEEKLY_HOURS_EXCEEDED',
      message: `Week has ${weeklyHours}h (recommended max ${maxWeeklyHours}h).`,
      severity: 'warning',
    });
  }

  return { errors, warnings };
}
