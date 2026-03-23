/**
 * TimesheetStore - Single source of truth for ALL timesheet data
 *
 * Phase 1: Now wired to KV-backed Timesheets API for persistence.
 * - On mount, loads the authenticated user's timesheets from the API
 * - Writes are persisted to the API with debouncing
 * - Seed data is used for demo/non-authenticated users and as initial fallback
 *
 * Data model: weekly periods with Mon-Fri daily breakdowns.
 * Weekly status drives the workflow (draft -> submitted -> approved | rejected).
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  listTimesheets,
  saveTimesheetWeek,
  updateTimesheetStatus,
} from '../utils/api/timesheets-api';

// ============================================================================
// Types
// ============================================================================

export interface DayTask {
  id: string;
  description: string;
  hours: number;
  category?: string; // 'Development', 'Meeting', 'Code Review', etc.
}

export interface StoredDay {
  day: string;       // 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'
  hours: number;
  startTime?: string;  // HH:mm — only editable in full editor
  endTime?: string;
  breakMinutes?: number;
  notes?: string;
  tasks?: DayTask[];   // Multiple tasks per day
}

export type WeekStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface StoredWeek {
  personId: string;
  weekLabel: string;   // 'Nov 3-7'
  weekStart: string;   // '2025-11-03' ISO date (Monday)
  days: StoredDay[];   // always 5 (Mon-Fri)
  tasks: string[];
  status: WeekStatus;
  submittedAt?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionNote?: string;
}

export interface TimesheetStoreAPI {
  // --- Read ---
  /** Get weeks for a person in a given month (e.g. '2025-11') */
  getWeeksForPerson: (personId: string, month: string) => StoredWeek[];
  /** Get all weeks for all people in a month */
  getAllWeeksForMonth: (month: string) => StoredWeek[];
  /** Get all unique person IDs that have data */
  getPersonIds: () => string[];

  // --- Write ---
  /** Replace the days array for a specific week */
  updateWeekDays: (personId: string, weekStart: string, days: StoredDay[]) => void;
  /** Update a single day within a week (dayIndex 0=Mon, 4=Fri) */
  updateSingleDay: (personId: string, weekStart: string, dayIndex: number, day: StoredDay) => void;
  /** Update tasks list for a week */
  updateWeekTasks: (personId: string, weekStart: string, tasks: string[]) => void;
  /** Change week status (submit, approve, reject, recall) */
  setWeekStatus: (personId: string, weekStart: string, status: WeekStatus, meta?: {
    note?: string;
    by?: string;
  }) => void;
  /** Batch approve all submitted weeks for a person in a month */
  batchApproveMonth: (personId: string, month: string, approverName: string) => number;
  /** Ensure a person has draft week rows for all Mondays in the given month (YYYY-MM) */
  seedMonthForPerson: (personId: string, month: string) => number;

  /** Monotonically increasing version — subscribe to re-render on changes */
  version: number;

  /** Whether data is being loaded from the API */
  isLoading: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

function mkDays(hours: number[]): StoredDay[] {
  return DAY_LABELS.map((day, i) => ({ day, hours: hours[i] ?? 0 }));
}

export function sumWeekHours(week: StoredWeek): number {
  return week.days.reduce((s, d) => s + d.hours, 0);
}

/** Derive which month a week belongs to from its weekStart (YYYY-MM) */
function monthOf(weekStart: string): string {
  return weekStart.slice(0, 7);
}

/** Generate a weekLabel from a weekStart date like '2025-11-03' -> 'Nov 3-7' */
function generateWeekLabel(weekStart: string): string {
  try {
    const start = new Date(weekStart + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 4); // Friday
    const monthName = start.toLocaleDateString('en-US', { month: 'short' });
    return `${monthName} ${start.getDate()}-${end.getDate()}`;
  } catch {
    return weekStart;
  }
}

function formatISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return Monday dates that fall inside a month key (YYYY-MM). */
function getMondaysForMonth(monthKey: string): string[] {
  const [yearRaw, monthRaw] = monthKey.split('-').map(Number);
  if (!yearRaw || !monthRaw || monthRaw < 1 || monthRaw > 12) return [];

  const monthIndex = monthRaw - 1;
  const date = new Date(yearRaw, monthIndex, 1);
  const mondays: string[] = [];

  while (date.getMonth() === monthIndex) {
    if (date.getDay() === 1) {
      mondays.push(formatISODateLocal(date));
    }
    date.setDate(date.getDate() + 1);
  }

  return mondays;
}

// ============================================================================
// Seed Data (used for demo/non-authenticated users)
// ============================================================================

function createSeedData(): StoredWeek[] {
  return [
    // --- Sarah Johnson (user-sarah) ---
    { personId: 'user-sarah', weekLabel: 'Nov 3-7',   weekStart: '2025-11-03', days: mkDays([8,7,8,7,6]), tasks: ['Frontend dev','Code review'], status: 'approved' },
    { personId: 'user-sarah', weekLabel: 'Nov 10-14',  weekStart: '2025-11-10', days: mkDays([8,8,8,8,8]), tasks: ['API integration','Testing'], status: 'approved' },
    { personId: 'user-sarah', weekLabel: 'Nov 17-21',  weekStart: '2025-11-17', days: mkDays([7,6,7,6,6]), tasks: ['Bug fixes','Documentation'], status: 'submitted' },
    { personId: 'user-sarah', weekLabel: 'Nov 24-28',  weekStart: '2025-11-24', days: mkDays([8,8,8,8,0]), tasks: ['Sprint planning'], status: 'draft' },
    { personId: 'user-sarah', weekLabel: 'Oct 6-10',   weekStart: '2025-10-06', days: mkDays([8,8,8,8,8]), tasks: ['Sprint 1','Architecture'], status: 'approved' },
    { personId: 'user-sarah', weekLabel: 'Oct 13-17',  weekStart: '2025-10-13', days: mkDays([9,9,9,9,8]), tasks: ['Sprint 1','Frontend'], status: 'approved' },
    { personId: 'user-sarah', weekLabel: 'Oct 20-24',  weekStart: '2025-10-20', days: mkDays([8,8,8,8,8]), tasks: ['Sprint 2','API dev'], status: 'approved' },
    { personId: 'user-sarah', weekLabel: 'Oct 27-31',  weekStart: '2025-10-27', days: mkDays([9,9,9,9,8]), tasks: ['Sprint 2','Testing'], status: 'approved' },

    // --- Alex Chen (user-alex) ---
    { personId: 'user-alex', weekLabel: 'Nov 3-7',   weekStart: '2025-11-03', days: mkDays([5,5,5,5,4]), tasks: ['UX research','Wireframes'], status: 'approved' },
    { personId: 'user-alex', weekLabel: 'Nov 10-14',  weekStart: '2025-11-10', days: mkDays([5,5,5,5,4]), tasks: ['Prototype','User testing'], status: 'approved' },
    { personId: 'user-alex', weekLabel: 'Nov 17-21',  weekStart: '2025-11-17', days: mkDays([4,4,4,4,4]), tasks: ['Design iteration'], status: 'submitted' },
    { personId: 'user-alex', weekLabel: 'Nov 24-28',  weekStart: '2025-11-24', days: mkDays([5,5,5,5,4]), tasks: ['Final mockups'], status: 'draft' },
    { personId: 'user-alex', weekLabel: 'Oct 6-10',   weekStart: '2025-10-06', days: mkDays([5,5,5,5,4]), tasks: ['Discovery'], status: 'approved' },
    { personId: 'user-alex', weekLabel: 'Oct 13-17',  weekStart: '2025-10-13', days: mkDays([5,5,5,5,4]), tasks: ['Research'], status: 'approved' },
    { personId: 'user-alex', weekLabel: 'Oct 20-24',  weekStart: '2025-10-20', days: mkDays([4,4,4,4,4]), tasks: ['Wireframes'], status: 'approved' },
    { personId: 'user-alex', weekLabel: 'Oct 27-31',  weekStart: '2025-10-27', days: mkDays([4,4,4,4,4]), tasks: ['Prototype'], status: 'approved' },

    // --- Mike Chen (user-mike) ---
    { personId: 'user-mike', weekLabel: 'Nov 3-7',   weekStart: '2025-11-03', days: mkDays([8,8,8,8,8]), tasks: ['Backend services'], status: 'approved' },
    { personId: 'user-mike', weekLabel: 'Nov 10-14',  weekStart: '2025-11-10', days: mkDays([8,7,7,7,7]), tasks: ['Database optimization'], status: 'approved' },
    { personId: 'user-mike', weekLabel: 'Nov 17-21',  weekStart: '2025-11-17', days: mkDays([8,8,8,8,8]), tasks: ['API endpoints'], status: 'submitted' },
    { personId: 'user-mike', weekLabel: 'Nov 24-28',  weekStart: '2025-11-24', days: mkDays([8,7,7,7,7]), tasks: ['Integration testing'], status: 'draft' },

    // --- Lisa Anderson (user-lisa) ---
    { personId: 'user-lisa', weekLabel: 'Nov 3-7',   weekStart: '2025-11-03', days: mkDays([0,0,0,0,0]), tasks: ['Onboarding'], status: 'draft' },
    { personId: 'user-lisa', weekLabel: 'Nov 10-14',  weekStart: '2025-11-10', days: mkDays([0,0,4,6,6]), tasks: ['Training','Setup'], status: 'submitted' },
    { personId: 'user-lisa', weekLabel: 'Nov 17-21',  weekStart: '2025-11-17', days: mkDays([5,5,5,5,4]), tasks: ['First tasks'], status: 'draft' },

    // --- Sophia Martinez (user-sophia) ---
    { personId: 'user-sophia', weekLabel: 'Nov 3-7',   weekStart: '2025-11-03', days: mkDays([7,7,6,6,6]), tasks: ['Brand strategy','Client calls'], status: 'approved' },
    { personId: 'user-sophia', weekLabel: 'Nov 10-14',  weekStart: '2025-11-10', days: mkDays([6,6,6,5,5]), tasks: ['Design system','Prototypes'], status: 'approved' },
    { personId: 'user-sophia', weekLabel: 'Nov 17-21',  weekStart: '2025-11-17', days: mkDays([7,7,6,6,6]), tasks: ['Visual design','Handoff'], status: 'submitted' },
    { personId: 'user-sophia', weekLabel: 'Nov 24-28',  weekStart: '2025-11-24', days: mkDays([6,6,6,5,5]), tasks: ['Design QA'], status: 'draft' },

    // --- Oliver Anderson (user-oliver) ---
    { personId: 'user-oliver', weekLabel: 'Nov 3-7',   weekStart: '2025-11-03', days: mkDays([5,5,5,5,4]), tasks: ['Motion design'], status: 'approved' },
    { personId: 'user-oliver', weekLabel: 'Nov 10-14',  weekStart: '2025-11-10', days: mkDays([6,6,6,5,5]), tasks: ['Animation assets'], status: 'approved' },
    { personId: 'user-oliver', weekLabel: 'Nov 17-21',  weekStart: '2025-11-17', days: mkDays([5,5,5,5,4]), tasks: ['Interactive prototypes'], status: 'submitted' },
    { personId: 'user-oliver', weekLabel: 'Nov 24-28',  weekStart: '2025-11-24', days: mkDays([5,5,5,5,4]), tasks: ['Final animations'], status: 'draft' },

    // --- Emma Thomas (user-emma) ---
    { personId: 'user-emma', weekLabel: 'Nov 3-7',   weekStart: '2025-11-03', days: mkDays([4,4,4,4,4]), tasks: ['UI components'], status: 'approved' },
    { personId: 'user-emma', weekLabel: 'Nov 10-14',  weekStart: '2025-11-10', days: mkDays([4,4,4,4,4]), tasks: ['Design tokens'], status: 'approved' },
    { personId: 'user-emma', weekLabel: 'Nov 17-21',  weekStart: '2025-11-17', days: mkDays([4,4,4,4,4]), tasks: ['Accessibility audit'], status: 'submitted' },
    { personId: 'user-emma', weekLabel: 'Nov 24-28',  weekStart: '2025-11-24', days: mkDays([4,4,4,4,4]), tasks: ['Documentation'], status: 'draft' },

    // --- Robert Garcia (user-robert) ---
    { personId: 'user-robert', weekLabel: 'Nov 3-7',   weekStart: '2025-11-03', days: mkDays([8,8,8,8,8]), tasks: ['DevOps setup'], status: 'approved' },
    { personId: 'user-robert', weekLabel: 'Nov 10-14',  weekStart: '2025-11-10', days: mkDays([8,8,8,8,8]), tasks: ['CI/CD pipeline'], status: 'approved' },
    { personId: 'user-robert', weekLabel: 'Nov 17-21',  weekStart: '2025-11-17', days: mkDays([8,8,8,8,8]), tasks: ['Infrastructure'], status: 'submitted' },
    { personId: 'user-robert', weekLabel: 'Nov 24-28',  weekStart: '2025-11-24', days: mkDays([8,8,8,8,8]), tasks: ['Monitoring setup'], status: 'draft' },

    // --- Jordan Rivera (user-jordan) ---
    { personId: 'user-jordan', weekLabel: 'Nov 3-7',   weekStart: '2025-11-03', days: mkDays([4,4,4,4,0]), tasks: ['Security audit'], status: 'approved' },
    { personId: 'user-jordan', weekLabel: 'Nov 10-14',  weekStart: '2025-11-10', days: mkDays([4,4,4,4,4]), tasks: ['Pen testing'], status: 'approved' },
    { personId: 'user-jordan', weekLabel: 'Nov 17-21',  weekStart: '2025-11-17', days: mkDays([4,4,4,4,4]), tasks: ['Report writing'], status: 'submitted' },
    { personId: 'user-jordan', weekLabel: 'Nov 24-28',  weekStart: '2025-11-24', days: mkDays([5,5,5,5,4]), tasks: ['Remediation'], status: 'draft' },
  ];
}

// ============================================================================
// API Sync Helpers
// ============================================================================

/** Convert API week data to StoredWeek format */
function apiWeekToStored(apiWeek: any): StoredWeek {
  return {
    personId: apiWeek.personId || '',
    weekLabel: apiWeek.weekLabel || generateWeekLabel(apiWeek.weekStart),
    weekStart: apiWeek.weekStart,
    days: (apiWeek.days || []).map((d: any) => ({
      day: d.day || '',
      hours: d.hours || 0,
      startTime: d.startTime,
      endTime: d.endTime,
      breakMinutes: d.breakMinutes,
      notes: d.notes,
      tasks: d.tasks,
    })),
    tasks: apiWeek.tasks || [],
    status: apiWeek.status || 'draft',
    submittedAt: apiWeek.submittedAt,
    approvedBy: apiWeek.approvedBy,
    rejectedBy: apiWeek.rejectedBy,
    rejectionNote: apiWeek.rejectionNote,
  };
}

// ============================================================================
// Context
// ============================================================================

const TimesheetStoreContext = createContext<TimesheetStoreAPI | null>(null);

export function TimesheetStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const [weeks, setWeeks] = useState<StoredWeek[]>(createSeedData);
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const pendingSyncs = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const bump = useCallback(() => setVersion(v => v + 1), []);

  // --- Load from API on auth ---
  useEffect(() => {
    if (!user?.id || !accessToken || hasLoadedRef.current) return;

    let cancelled = false;
    const loadFromApi = async () => {
      try {
        setIsLoading(true);
        console.log('[TimesheetStore] Loading timesheets from API for user:', user.id);
        const apiWeeks = await listTimesheets(undefined, accessToken);

        if (cancelled) return;

        if (apiWeeks && apiWeeks.length > 0) {
          const converted = apiWeeks.map(apiWeekToStored);
          // Merge: API data for the authenticated user + seed data for demo users
          setWeeks(prev => {
            // Keep seed data for non-authenticated demo personIds
            const demoWeeks = prev.filter(w => !w.personId.match(/^[0-9a-f-]{36}$/));
            // Deduplicate: if API returned data for the same personId+weekStart, use API version
            const apiKeys = new Set(converted.map(w => `${w.personId}:${w.weekStart}`));
            const filteredDemo = demoWeeks.filter(w => !apiKeys.has(`${w.personId}:${w.weekStart}`));
            return [...converted, ...filteredDemo];
          });
          console.log(`[TimesheetStore] Loaded ${converted.length} weeks from API`);
        } else {
          console.log('[TimesheetStore] No API timesheets found, using seed data');
        }

        hasLoadedRef.current = true;
      } catch (err) {
        console.error('[TimesheetStore] Failed to load from API:', err);
        // Keep seed data as fallback
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadFromApi();
    return () => { cancelled = true; };
  }, [user?.id, accessToken]);

  // --- Debounced API persist ---
  const persistWeek = useCallback((personId: string, weekStart: string, weekData: StoredWeek) => {
    // Only persist if this is the authenticated user's data (UUID format)
    if (!accessToken || !personId.match(/^[0-9a-f-]{36}$/)) return;

    const key = `${personId}:${weekStart}`;
    // Cancel any pending sync for this week
    const existing = pendingSyncs.current.get(key);
    if (existing) clearTimeout(existing);

    // Debounce: persist after 500ms of inactivity
    const timeout = setTimeout(async () => {
      try {
        await saveTimesheetWeek(weekStart, {
          days: weekData.days,
          tasks: weekData.tasks,
          status: weekData.status,
          notes: undefined,
        }, accessToken);
        console.log(`[TimesheetStore] Persisted week ${weekStart} to API`);
      } catch (err) {
        console.error(`[TimesheetStore] Failed to persist week ${weekStart}:`, err);
      }
      pendingSyncs.current.delete(key);
    }, 500);

    pendingSyncs.current.set(key, timeout);
  }, [accessToken]);

  const persistStatus = useCallback(async (
    personId: string,
    weekStart: string,
    status: WeekStatus,
    meta?: { note?: string; by?: string }
  ) => {
    if (!accessToken || !personId.match(/^[0-9a-f-]{36}$/)) return;

    try {
      await updateTimesheetStatus(weekStart, status, {
        personId,
        approverName: meta?.by,
        note: meta?.note,
      }, accessToken);
      console.log(`[TimesheetStore] Status updated: ${weekStart} -> ${status}`);
    } catch (err) {
      console.error(`[TimesheetStore] Failed to update status for ${weekStart}:`, err);
    }
  }, [accessToken]);

  // --- Read ---

  const getWeeksForPerson = useCallback((personId: string, month: string): StoredWeek[] => {
    return weeks.filter(w => w.personId === personId && monthOf(w.weekStart) === month);
  }, [weeks]);

  const getAllWeeksForMonth = useCallback((month: string): StoredWeek[] => {
    return weeks.filter(w => monthOf(w.weekStart) === month);
  }, [weeks]);

  const getPersonIds = useCallback((): string[] => {
    return [...new Set(weeks.map(w => w.personId))];
  }, [weeks]);

  // --- Write (local state + API persist) ---

  const updateWeekDays = useCallback((personId: string, weekStart: string, days: StoredDay[]) => {
    setWeeks(prev => {
      const updated = prev.map(w =>
        w.personId === personId && w.weekStart === weekStart
          ? { ...w, days: days.map(d => ({ ...d })) }
          : w
      );
      // Find the updated week and persist
      const updatedWeek = updated.find(w => w.personId === personId && w.weekStart === weekStart);
      if (updatedWeek) persistWeek(personId, weekStart, updatedWeek);
      return updated;
    });
    bump();
  }, [bump, persistWeek]);

  const updateSingleDay = useCallback((personId: string, weekStart: string, dayIndex: number, day: StoredDay) => {
    setWeeks(prev => {
      const updated = prev.map(w =>
        w.personId === personId && w.weekStart === weekStart
          ? { ...w, days: w.days.map((d, i) => i === dayIndex ? { ...day } : d) }
          : w
      );
      const updatedWeek = updated.find(w => w.personId === personId && w.weekStart === weekStart);
      if (updatedWeek) persistWeek(personId, weekStart, updatedWeek);
      return updated;
    });
    bump();
  }, [bump, persistWeek]);

  const updateWeekTasks = useCallback((personId: string, weekStart: string, tasks: string[]) => {
    setWeeks(prev => {
      const updated = prev.map(w =>
        w.personId === personId && w.weekStart === weekStart
          ? { ...w, tasks: [...tasks] }
          : w
      );
      const updatedWeek = updated.find(w => w.personId === personId && w.weekStart === weekStart);
      if (updatedWeek) persistWeek(personId, weekStart, updatedWeek);
      return updated;
    });
    bump();
  }, [bump, persistWeek]);

  const setWeekStatus = useCallback((
    personId: string,
    weekStart: string,
    status: WeekStatus,
    meta?: { note?: string; by?: string }
  ) => {
    setWeeks(prev => prev.map(w => {
      if (w.personId !== personId || w.weekStart !== weekStart) return w;
      const updated: StoredWeek = { ...w, status };
      if (status === 'submitted') updated.submittedAt = new Date().toISOString();
      if (status === 'approved' && meta?.by) updated.approvedBy = meta.by;
      if (status === 'rejected') {
        updated.rejectedBy = meta?.by;
        updated.rejectionNote = meta?.note;
      }
      if (status === 'draft') {
        // Recall — clear workflow metadata
        updated.submittedAt = undefined;
        updated.approvedBy = undefined;
        updated.rejectedBy = undefined;
        updated.rejectionNote = undefined;
      }
      return updated;
    }));
    // Persist status change to API
    persistStatus(personId, weekStart, status, meta);
    bump();
  }, [bump, persistStatus]);

  const batchApproveMonth = useCallback((personId: string, month: string, approverName: string): number => {
    let count = 0;
    const weekStartsToApprove: string[] = [];

    setWeeks(prev => prev.map(w => {
      if (w.personId === personId && monthOf(w.weekStart) === month && w.status === 'submitted') {
        count++;
        weekStartsToApprove.push(w.weekStart);
        return { ...w, status: 'approved' as const, approvedBy: approverName };
      }
      return w;
    }));

    // Persist each approval to API
    weekStartsToApprove.forEach(ws => {
      persistStatus(personId, ws, 'approved', { by: approverName });
    });

    bump();
    return count;
  }, [bump, persistStatus]);

  const seedMonthForPerson = useCallback((personId: string, month: string): number => {
    const mondays = getMondaysForMonth(month);
    if (mondays.length === 0) return 0;

    const existingKeys = new Set(
      weeks
        .filter(w => w.personId === personId)
        .map(w => `${w.personId}:${w.weekStart}`)
    );

    const created = mondays
      .filter(weekStart => !existingKeys.has(`${personId}:${weekStart}`))
      .map<StoredWeek>(weekStart => ({
        personId,
        weekLabel: generateWeekLabel(weekStart),
        weekStart,
        days: mkDays([0, 0, 0, 0, 0]),
        tasks: [],
        status: 'draft',
      }));

    if (created.length === 0) return 0;

    setWeeks(prev => [...prev, ...created].sort((a, b) => a.weekStart.localeCompare(b.weekStart)));
    created.forEach(week => persistWeek(personId, week.weekStart, week));
    bump();

    return created.length;
  }, [bump, persistWeek, weeks]);

  const api = useMemo<TimesheetStoreAPI>(() => ({
    getWeeksForPerson,
    getAllWeeksForMonth,
    getPersonIds,
    updateWeekDays,
    updateSingleDay,
    updateWeekTasks,
    setWeekStatus,
    batchApproveMonth,
    seedMonthForPerson,
    version,
    isLoading,
  }), [getWeeksForPerson, getAllWeeksForMonth, getPersonIds, updateWeekDays, updateSingleDay, updateWeekTasks, setWeekStatus, batchApproveMonth, seedMonthForPerson, version, isLoading]);

  return (
    <TimesheetStoreContext.Provider value={api}>
      {children}
    </TimesheetStoreContext.Provider>
  );
}

export function useTimesheetStore(): TimesheetStoreAPI {
  const ctx = useContext(TimesheetStoreContext);
  if (!ctx) throw new Error('useTimesheetStore must be inside TimesheetStoreProvider');
  return ctx;
}

/** Safe hook that returns null outside provider (for optional consumption) */
export function useTimesheetStoreSafe(): TimesheetStoreAPI | null {
  return useContext(TimesheetStoreContext);
}
