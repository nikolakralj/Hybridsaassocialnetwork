/**
 * TimesheetStore - Single source of truth for ALL timesheet data
 *
 * Replaces: inline PERSON_TIMESHEETS in NodeDetailDrawer, broken DB calls in ProjectTimesheetsView
 *
 * Data model: weekly periods with Mon-Fri daily breakdowns.
 * Weekly status drives the workflow (draft -> submitted -> approved | rejected).
 * Both the graph drawer and the Timesheets tab read/write the same state.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

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

  /** Monotonically increasing version — subscribe to re-render on changes */
  version: number;
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

// ============================================================================
// Seed Data
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
// Context
// ============================================================================

const TimesheetStoreContext = createContext<TimesheetStoreAPI | null>(null);

export function TimesheetStoreProvider({ children }: { children: React.ReactNode }) {
  const [weeks, setWeeks] = useState<StoredWeek[]>(createSeedData);
  const [version, setVersion] = useState(0);

  const bump = useCallback(() => setVersion(v => v + 1), []);

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

  // --- Write ---

  const updateWeekDays = useCallback((personId: string, weekStart: string, days: StoredDay[]) => {
    setWeeks(prev => prev.map(w =>
      w.personId === personId && w.weekStart === weekStart
        ? { ...w, days: days.map(d => ({ ...d })) }
        : w
    ));
    bump();
  }, [bump]);

  const updateSingleDay = useCallback((personId: string, weekStart: string, dayIndex: number, day: StoredDay) => {
    setWeeks(prev => prev.map(w =>
      w.personId === personId && w.weekStart === weekStart
        ? { ...w, days: w.days.map((d, i) => i === dayIndex ? { ...day } : d) }
        : w
    ));
    bump();
  }, [bump]);

  const updateWeekTasks = useCallback((personId: string, weekStart: string, tasks: string[]) => {
    setWeeks(prev => prev.map(w =>
      w.personId === personId && w.weekStart === weekStart
        ? { ...w, tasks: [...tasks] }
        : w
    ));
    bump();
  }, [bump]);

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
    bump();
  }, [bump]);

  const batchApproveMonth = useCallback((personId: string, month: string, approverName: string): number => {
    let count = 0;
    setWeeks(prev => prev.map(w => {
      if (w.personId === personId && monthOf(w.weekStart) === month && w.status === 'submitted') {
        count++;
        return { ...w, status: 'approved' as const, approvedBy: approverName };
      }
      return w;
    }));
    bump();
    return count;
  }, [bump]);

  const api = useMemo<TimesheetStoreAPI>(() => ({
    getWeeksForPerson,
    getAllWeeksForMonth,
    getPersonIds,
    updateWeekDays,
    updateSingleDay,
    updateWeekTasks,
    setWeekStatus,
    batchApproveMonth,
    version,
  }), [getWeeksForPerson, getAllWeeksForMonth, getPersonIds, updateWeekDays, updateSingleDay, updateWeekTasks, setWeekStatus, batchApproveMonth, version]);

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