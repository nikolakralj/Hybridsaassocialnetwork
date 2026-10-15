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
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import {
  listTimesheets,
  recallTimesheet,
  reopenRejectedTimesheet,
  saveTimesheetWeek,
  submitTimesheetForApproval,
} from '../utils/api/timesheets-api';
import { getMyProjectMembership, getProject } from '../utils/api/projects-api';
import {
  approveItem,
  getLatestPendingApproval,
  rejectItem,
  type ApprovalSubjectSnapshot,
} from '../utils/api/approvals-supabase';
import type { SubmissionEnvelope, TimeEntry } from '../types/timesheets';
import type { ApprovalParty } from '../utils/graph/approval-fallback';
import {
  normalizeStoredDay,
  normalizeStoredWeek,
  sumWeekHours,
  sumWeekBillableHours,
  validateTimesheetWeek,
} from '../types/timesheets';

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
  totalHours?: number;
  entries?: TimeEntry[];
  startTime?: string;  // HH:mm — only editable in full editor
  endTime?: string;
  breakMinutes?: number;
  notes?: string;
  tasks?: DayTask[];   // Multiple tasks per day
}

export type WeekStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface StoredWeek {
  personId: string;
  /** Project graph identity used for names, party grouping, and private rates. */
  graphNodeId?: string;
  weekLabel: string;   // 'Nov 3-7'
  weekStart: string;   // '2025-11-03' ISO date (Monday)
  days: StoredDay[];   // always 5 (Mon-Fri)
  tasks: string[];
  status: WeekStatus;
  submittedAt?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionNote?: string;
  /** Project this week belongs to. Weeks without a projectId are legacy/unscoped. */
  projectId?: string;
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
  }) => Promise<void>;
  /** Batch approve all submitted weeks for a person in a month */
  batchApproveMonth: (personId: string, month: string, approverName: string) => number;
  /** Ensure a person has draft week rows for all Mondays in the given month (YYYY-MM) */
  seedMonthForPerson: (personId: string, month: string) => number;
  submitMonthForPerson: (personId: string, month: string, projectId?: string) => SubmissionEnvelope | null;
  getSubmissionEnvelopes: (personId?: string, month?: string) => SubmissionEnvelope[];

  /** Monotonically increasing version — subscribe to re-render on changes */
  version: number;

  /** Whether data is being loaded from the API */
  isLoading: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
// Never invent a project when no workspace has been selected. A synthetic ID
// produces requests that look valid but are disconnected from the real route.
const DEFAULT_PROJECT_ID = '';
type NameDirEntry = { name?: string; type?: string; orgId?: string };

function mkDays(hours: number[]): StoredDay[] {
  return DAY_LABELS.map((day, i) => normalizeStoredDay({ day, hours: hours[i] ?? 0 }));
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

function normalizeIsoDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatISODateLocal(parsed);
}

function weekEndIso(weekStart: string): string {
  const end = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(end.getTime())) return weekStart;
  end.setDate(end.getDate() + 4);
  return formatISODateLocal(end);
}

function dayIsoFromWeek(weekStart: string, dayIndex: number): string {
  const date = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return weekStart;
  date.setDate(date.getDate() + dayIndex);
  return formatISODateLocal(date);
}

function weekIsFullyBeforeProjectStart(weekStart: string, projectStartDate: string): boolean {
  return weekEndIso(weekStart) < projectStartDate;
}

function weekHasHoursBeforeProjectStart(week: StoredWeek, projectStartDate: string): boolean {
  return week.days.some((day, index) => {
    const hours = typeof day.totalHours === 'number' ? day.totalHours : day.hours || 0;
    if (hours <= 0) return false;
    return dayIsoFromWeek(week.weekStart, index) < projectStartDate;
  });
}

/** Return Monday dates whose week overlaps a month key (YYYY-MM).
 *  Includes the prior-month Monday when the month starts mid-week (e.g. Apr 1 = Wed
 *  → the Mar 30 week has Apr days and must appear in the April view).
 *  Exported so month-close uses the same weeks as the timesheet grid. */
export function getMondaysForMonth(monthKey: string): string[] {
  const [yearRaw, monthRaw] = monthKey.split('-').map(Number);
  if (!yearRaw || !monthRaw || monthRaw < 1 || monthRaw > 12) return [];

  const monthIndex = monthRaw - 1;
  const firstOfMonth = new Date(yearRaw, monthIndex, 1);
  const mondays: string[] = [];

  // If the month doesn't start on Monday, include the prior Monday whose week
  // overlaps into this month (its Friday falls on or after the 1st).
  const firstDayOfWeek = firstOfMonth.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const daysToLastMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  if (daysToLastMonday > 0) {
    const prevMonday = new Date(firstOfMonth);
    prevMonday.setDate(prevMonday.getDate() - daysToLastMonday);
    mondays.push(formatISODateLocal(prevMonday));
  }

  // All Mondays whose date falls inside this month.
  const date = new Date(yearRaw, monthIndex, 1);
  while (date.getMonth() === monthIndex) {
    if (date.getDay() === 1) {
      mondays.push(formatISODateLocal(date));
    }
    date.setDate(date.getDate() + 1);
  }

  return mondays;
}

/** True when any day of the Mon–Fri week touches the given month. */
export function weekOverlapsMonth(weekStart: string, month: string): boolean {
  if (monthOf(weekStart) === month) return true;
  const friday = weekEndIso(weekStart);
  return monthOf(friday) === month;
}

function readSessionJson<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function activeProjectId(): string {
  if (typeof sessionStorage === 'undefined') return DEFAULT_PROJECT_ID;
  return sessionStorage.getItem('currentProjectId') || DEFAULT_PROJECT_ID;
}

/** Returns true if a week belongs to the given project (or has no projectId — legacy data). */
function matchesProject(week: StoredWeek, projectId: string): boolean {
  if (!week.projectId) return true; // Legacy weeks without projectId are shown everywhere
  return week.projectId === projectId;
}

function readNameDir(projectId: string): Record<string, NameDirEntry> {
  if (!projectId) return {};
  return readSessionJson<Record<string, NameDirEntry>>(`workgraph-name-dir:${projectId}`) || {};
}

function readApprovalParties(projectId: string): ApprovalParty[] {
  if (!projectId) return [];
  const parsed = readSessionJson<{ parties?: ApprovalParty[] }>(`workgraph-approval-dir:${projectId}`);
  if (Array.isArray(parsed?.parties) && parsed!.parties.length > 0) return parsed!.parties;
  return [];
}

/** Persist only the current signed-in session's server-scoped directory. */
function buildTimesheetSubjectId(personId: string, weekStart: string): string {
  return `${personId}:${weekStart}`;
}

function formatActionError(action: string, error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return `Failed to ${action} timesheet`;
}

// ============================================================================
// Seed Data (used for demo/non-authenticated users)
// ============================================================================

function createSeedData(): StoredWeek[] {
  if (!import.meta.env.DEV) return [];
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

/** Convert API week data to StoredWeek format. */
function apiWeekToStored(
  apiWeek: any,
  ownIdentity?: { authUserId: string; graphNodeId?: string },
): StoredWeek {
  const apiPersonId = apiWeek.personId || '';
  const personId =
    ownIdentity?.graphNodeId && apiPersonId === ownIdentity.authUserId
      ? ownIdentity.graphNodeId
      : apiPersonId;

  return normalizeStoredWeek({
    personId,
    graphNodeId: apiWeek.graphNodeId || ownIdentity?.graphNodeId,
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
  });
}

// ============================================================================
// Context
// ============================================================================

const TimesheetStoreContext = createContext<TimesheetStoreAPI | null>(null);

// --- localStorage fallback persistence ---
const LS_KEY = 'workgraph-timesheet-weeks';
const isDemoPersonId = (personId: string) => personId.startsWith('user-');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadFromLocalStorage(): StoredWeek[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const realWeeks = parsed.filter((week): week is StoredWeek => {
        return Boolean(week && typeof week === 'object' && typeof week.personId === 'string' && !isDemoPersonId(week.personId));
      });
      return realWeeks.length > 0 ? realWeeks : null;
    }
    return null;
  } catch { return null; }
}

/**
 * Remove all persisted data for a given project.
 * Call this when deleting a project so timesheet/approval/viewer data doesn't leak.
 */
export function clearProjectData(projectId: string): void {
  if (!projectId) return;

  // 1. Remove project-specific sessionStorage/localStorage keys
  const keysToRemove = [
    `workgraph-approval-dir:${projectId}`,
    `workgraph-name-dir:${projectId}`,
    `workgraph-viewer-meta:${projectId}`,
    `workgraph-viewer:${projectId}`,
  ];
  for (const key of keysToRemove) {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  // 2. Remove timesheet weeks belonging to this project from localStorage
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((w: any) => w?.projectId !== projectId);
        localStorage.setItem(LS_KEY, JSON.stringify(filtered));
      }
    }
  } catch { /* ignore */ }

  // 3. Clear active project session if it matches the deleted project
  try {
    if (sessionStorage.getItem('currentProjectId') === projectId) {
      sessionStorage.removeItem('currentProjectId');
      sessionStorage.removeItem('currentProjectName');
      sessionStorage.removeItem('currentProjectStartDate');
    }
  } catch { /* ignore */ }

  // 4. Notify in-memory store to drop these weeks
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('workgraph-project-deleted', { detail: { projectId } }));
  }
}

function saveToLocalStorage(weeks: StoredWeek[]) {
  try {
    // Only save non-demo weeks (skip user- prefixed demo IDs)
    const realWeeks = weeks.filter(w => !isDemoPersonId(w.personId));
    localStorage.setItem(LS_KEY, JSON.stringify(realWeeks));
  } catch { /* ignore quota errors */ }
}

export function TimesheetStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  // Initialize from localStorage if available, otherwise seed data
  const [weeks, setWeeks] = useState<StoredWeek[]>(() => {
    const fromLS = loadFromLocalStorage();
    if (fromLS && fromLS.length > 0) {
      // Merge: localStorage real data + seed demo data (for non-auth fallback)
      const seed = createSeedData();
      return [...fromLS, ...seed];
    }
    return createSeedData();
  });
  const [submissionEnvelopes, setSubmissionEnvelopes] = useState<SubmissionEnvelope[]>([]);
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [projectStartDate, setProjectStartDate] = useState<string | null>(() => {
    if (typeof sessionStorage === 'undefined') return null;
    return normalizeIsoDate(sessionStorage.getItem('currentProjectStartDate'));
  });
  const hasLoadedRef = useRef(false);
  const authLoadKeyRef = useRef<string | null>(null);
  const pendingSyncs = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const bump = useCallback(() => setVersion(v => v + 1), []);

  // One-time migration: tag untagged (legacy) weeks with the current project
  const hasTaggedLegacy = useRef(false);
  useEffect(() => {
    if (hasTaggedLegacy.current) return;
    const currentProject = activeProjectId();
    if (!currentProject || currentProject === DEFAULT_PROJECT_ID) return;
    const hasUntagged = weeks.some(w => !w.projectId && !isDemoPersonId(w.personId));
    if (!hasUntagged) { hasTaggedLegacy.current = true; return; }
    setWeeks(prev => prev.map(w => (!w.projectId && !isDemoPersonId(w.personId)) ? { ...w, projectId: currentProject } : w));
    hasTaggedLegacy.current = true;
  }, [weeks]);

  // Persist to localStorage on every change (debounced)
  const lsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (lsSaveTimer.current) clearTimeout(lsSaveTimer.current);
    lsSaveTimer.current = setTimeout(() => saveToLocalStorage(weeks), 300);
    return () => { if (lsSaveTimer.current) clearTimeout(lsSaveTimer.current); };
  }, [weeks]);

  // When authenticated, strip demo seed rows so project views only show real data.
  useEffect(() => {
    if (!user?.id || !accessToken) return;
    setWeeks(prev => prev.filter(w => !isDemoPersonId(w.personId)));
  }, [user?.id, accessToken]);

  // If auth identity changes, force an API reload for the new session.
  useEffect(() => {
    const authKey = user?.id && accessToken ? `${user.id}:${accessToken.slice(0, 12)}` : null;
    if (authLoadKeyRef.current !== authKey) {
      hasLoadedRef.current = false;
      authLoadKeyRef.current = authKey;
    }
  }, [user?.id, accessToken]);

  const refreshProjectStartDate = useCallback(async (projectIdOverride?: string) => {
    const projectId = projectIdOverride || activeProjectId();
    if (!projectId) {
      setProjectStartDate(null);
      return;
    }
    const cached = typeof sessionStorage !== 'undefined'
      ? normalizeIsoDate(sessionStorage.getItem('currentProjectStartDate'))
      : null;

    if (cached) {
      setProjectStartDate(cached);
    }

    try {
      const payload = await getProject(projectId, accessToken);
      const fetched = normalizeIsoDate(payload?.project?.startDate || payload?.project?.start_date || payload?.startDate || payload?.start_date || null);
      if (fetched) {
        setProjectStartDate(fetched);
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('currentProjectStartDate', fetched);
        }
      }
    } catch (error) {
      if (!cached) {
        console.warn('[TimesheetStore] Failed to resolve project start date for validation:', error);
      }
    }
  }, [accessToken]);

  useEffect(() => {
    void refreshProjectStartDate();
  }, [refreshProjectStartDate, user?.id, accessToken]);

  const loadProjectWeeksFromApi = useCallback(async (projectId: string | null) => {
    if (!user?.id || !accessToken) return [];

    const [apiWeeks, membership] = await Promise.all([
      listTimesheets(undefined, accessToken, projectId),
      projectId
        ? getMyProjectMembership(projectId, user.id).catch((error) => {
            console.warn('[TimesheetStore] Could not resolve graph identity for timesheets:', error);
            return null;
          })
        : Promise.resolve(null),
    ]);

    const ownIdentity = {
      authUserId: user.id,
      graphNodeId: membership?.graphNodeId,
    };

    return apiWeeks.map((week) => ({
      ...apiWeekToStored(week, ownIdentity),
      projectId: projectId || undefined,
    }));
  }, [accessToken, user?.id]);

  const reloadWeeksFromApi = useCallback(async () => {
    if (!user?.id || !accessToken) return;
    const projectId = activeProjectId();
    if (!projectId) return;
    try {
      const tagged = await loadProjectWeeksFromApi(projectId);
      setWeeks(prev => {
        // Replace weeks for this project, keep weeks from other projects.
        const otherProjects = prev.filter(w => !matchesProject(w, projectId) || !w.projectId);
        return [...otherProjects, ...tagged];
      });
    } catch (error) {
      console.warn('[TimesheetStore] Could not refresh weeks from API after approval update:', error);
    }
  }, [accessToken, loadProjectWeeksFromApi, user?.id]);

  // Purge in-memory weeks when a project is deleted
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onProjectDeleted = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (!detail?.projectId) return;
      setWeeks(prev => prev.filter(w => w.projectId !== detail.projectId));
      bump();
    };
    window.addEventListener('workgraph-project-deleted', onProjectDeleted);
    return () => window.removeEventListener('workgraph-project-deleted', onProjectDeleted);
  }, [bump]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncActiveProject = () => {
      void refreshProjectStartDate();
      void reloadWeeksFromApi();
    };
    const refreshStartDateOnFocus = () => {
      void refreshProjectStartDate();
    };
    syncActiveProject();
    window.addEventListener('workgraph-project-selected', syncActiveProject as EventListener);
    window.addEventListener('workgraph-project-changed', syncActiveProject as EventListener);
    window.addEventListener('focus', refreshStartDateOnFocus);
    return () => {
      window.removeEventListener('workgraph-project-selected', syncActiveProject as EventListener);
      window.removeEventListener('workgraph-project-changed', syncActiveProject as EventListener);
      window.removeEventListener('focus', refreshStartDateOnFocus);
    };
  }, [refreshProjectStartDate, reloadWeeksFromApi]);

  useEffect(() => {
    if (!user?.id || !accessToken || typeof window === 'undefined') return;

    const refreshWeeks = () => {
      void reloadWeeksFromApi();
    };

    const onApprovalsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string | null }>).detail;
      const currentProjectId = activeProjectId();
      if (!detail?.projectId || detail.projectId === currentProjectId) {
        refreshWeeks();
      }
    };

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshWeeks();
      }
    };

    window.addEventListener('workgraph-approvals-updated', onApprovalsUpdated as EventListener);
    window.addEventListener('focus', refreshWeeks);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      window.removeEventListener('workgraph-approvals-updated', onApprovalsUpdated as EventListener);
      window.removeEventListener('focus', refreshWeeks);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [accessToken, reloadWeeksFromApi, user?.id]);

  // --- Load from API on auth ---
  useEffect(() => {
    if (!user?.id || !accessToken || hasLoadedRef.current) return;

    let cancelled = false;
    const loadFromApi = async () => {
      try {
        const projectId = activeProjectId();
        if (!projectId) {
          // The project picker has not resolved yet. Keep the existing state
          // rather than fetching a synthetic or empty project route.
          return;
        }
        setIsLoading(true);
        console.log('[TimesheetStore] Loading timesheets from API for user:', user.id);
        const converted = await loadProjectWeeksFromApi(projectId);

        if (cancelled) return;

        if (converted.length > 0) {
          // Authenticated mode: API rows are source of truth (no demo merge).
          setWeeks(converted);
          console.log(`[TimesheetStore] Loaded ${converted.length} weeks from API`);
        } else {
          // Keep local non-demo rows if API is empty (prevents refresh-loss while edge sync catches up).
          setWeeks(prev => {
            const localRealWeeks = prev.filter(w => !isDemoPersonId(w.personId));
            if (localRealWeeks.length > 0) {
              console.log(`[TimesheetStore] API returned 0 rows, keeping ${localRealWeeks.length} local persisted weeks`);
              return localRealWeeks;
            }
            console.log('[TimesheetStore] No API timesheets found and no local rows, using empty authenticated state');
            return [];
          });
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
  }, [user?.id, accessToken, loadProjectWeeksFromApi]);

  // --- Debounced API persist ---
  const persistWeek = useCallback((personId: string, weekStart: string, weekData: StoredWeek) => {
    if (!accessToken || isDemoPersonId(personId)) return;

    const key = `${personId}:${weekStart}`;
    // Cancel any pending sync for this week
    const existing = pendingSyncs.current.get(key);
    if (existing) clearTimeout(existing);

    // Debounce: persist after 500ms of inactivity
    const timeout = setTimeout(async () => {
      try {
        const normalizedWeek = normalizeStoredWeek(weekData);
        await saveTimesheetWeek(weekStart, {
          days: normalizedWeek.days,
          tasks: normalizedWeek.tasks,
          notes: undefined,
          projectId: activeProjectId(),
          personId,
          totalHours: normalizedWeek.totalHours,
        }, accessToken);
        console.log(`[TimesheetStore] Persisted week ${weekStart} to API`);
      } catch (err) {
        console.error(`[TimesheetStore] Failed to persist week ${weekStart}:`, err);
      }
      pendingSyncs.current.delete(key);
    }, 500);

    pendingSyncs.current.set(key, timeout);
  }, [accessToken]);

  // Back to draft: recall a submitted week (before anyone approves it) or reopen
  // a rejected one. Every other status change is an approval-workflow RPC.
  const persistDraftStatus = useCallback(async (
    weekStart: string,
    currentStatus: WeekStatus,
  ) => {
    const projectId = activeProjectId();
    if (currentStatus === 'submitted') {
      if (!projectId) throw new Error('Select a project before recalling time.');
      await recallTimesheet(projectId, weekStart);
      return;
    }
    if (currentStatus === 'rejected') {
      await reopenRejectedTimesheet(weekStart, projectId || undefined);
      return;
    }
    if (currentStatus === 'approved') {
      throw new Error('Approved timesheets are locked and cannot be recalled.');
    }
  }, []);

  // Write the current days now (instead of waiting for the debounced save), so
  // the server submits exactly what the person sees.
  const flushWeekNow = useCallback(async (personId: string, weekStart: string, week: StoredWeek) => {
    const key = `${personId}:${weekStart}`;
    const pending = pendingSyncs.current.get(key);
    if (pending) {
      clearTimeout(pending);
      pendingSyncs.current.delete(key);
    }
    const normalizedWeek = normalizeStoredWeek(week);
    await saveTimesheetWeek(weekStart, {
      days: normalizedWeek.days,
      tasks: normalizedWeek.tasks,
      notes: undefined,
      projectId: activeProjectId(),
      personId,
      totalHours: normalizedWeek.totalHours,
    }, accessToken);
  }, [accessToken]);

  const applyWeekStatusLocally = useCallback((
    personId: string,
    weekStart: string,
    status: WeekStatus,
    meta?: { note?: string; by?: string },
    submittedAt?: string
  ) => {
    setWeeks(prev => prev.map(w => {
      if (w.personId !== personId || w.weekStart !== weekStart) return w;
      const normalizedWeek = normalizeStoredWeek(w);
      const updated: StoredWeek = { ...normalizedWeek, status };

      if (status === 'submitted') {
        updated.submittedAt = submittedAt || new Date().toISOString();
        updated.approvedBy = undefined;
        updated.rejectedBy = undefined;
        updated.rejectionNote = undefined;
      }

      if (status === 'approved') {
        updated.approvedBy = meta?.by;
        updated.rejectedBy = undefined;
        updated.rejectionNote = undefined;
      }

      if (status === 'rejected') {
        updated.rejectedBy = meta?.by;
        updated.rejectionNote = meta?.note;
        updated.approvedBy = undefined;
      }

      if (status === 'draft') {
        updated.submittedAt = undefined;
        updated.approvedBy = undefined;
        updated.rejectedBy = undefined;
        updated.rejectionNote = undefined;
      }

      return updated;
    }));
    bump();
  }, [bump]);

  // --- Read ---

  const getWeeksForPerson = useCallback((personId: string, month: string): StoredWeek[] => {
    const currentProject = activeProjectId();
    return weeks
      .filter(w => w.personId === personId && weekOverlapsMonth(w.weekStart, month) && matchesProject(w, currentProject))
      .map(normalizeStoredWeek);
  }, [weeks]);

  const getAllWeeksForMonth = useCallback((month: string): StoredWeek[] => {
    const currentProject = activeProjectId();
    return weeks
      .filter(w => weekOverlapsMonth(w.weekStart, month) && matchesProject(w, currentProject))
      .map(normalizeStoredWeek);
  }, [weeks]);

  const getPersonIds = useCallback((): string[] => {
    const currentProject = activeProjectId();
    return [...new Set(weeks.filter(w => matchesProject(w, currentProject)).map(w => w.personId))];
  }, [weeks]);

  // --- Write (local state + API persist) ---

  const updateWeekDays = useCallback((personId: string, weekStart: string, days: StoredDay[]) => {
    setWeeks(prev => {
      const updated = prev.map(w =>
        w.personId === personId && w.weekStart === weekStart
          ? { ...w, days: days.map(d => normalizeStoredDay({ ...d })) }
          : w
      );
      // Find the updated week and persist
      const updatedWeek = updated.find(w => w.personId === personId && w.weekStart === weekStart);
      if (updatedWeek) persistWeek(personId, weekStart, normalizeStoredWeek(updatedWeek));
      return updated;
    });
    bump();
  }, [bump, persistWeek]);

  const updateSingleDay = useCallback((personId: string, weekStart: string, dayIndex: number, day: StoredDay) => {
    setWeeks(prev => {
      const updated = prev.map(w =>
        w.personId === personId && w.weekStart === weekStart
          ? { ...w, days: w.days.map((d, i) => i === dayIndex ? normalizeStoredDay({ ...day }) : d) }
          : w
      );
      const updatedWeek = updated.find(w => w.personId === personId && w.weekStart === weekStart);
      if (updatedWeek) persistWeek(personId, weekStart, normalizeStoredWeek(updatedWeek));
      return updated;
    });
    bump();
  }, [bump, persistWeek]);

  const updateWeekTasks = useCallback((personId: string, weekStart: string, tasks: string[]) => {
    setWeeks(prev => {
      const updated = prev.map(w =>
        w.personId === personId && w.weekStart === weekStart
          ? normalizeStoredWeek({ ...w, tasks: [...tasks] })
          : w
      );
      const updatedWeek = updated.find(w => w.personId === personId && w.weekStart === weekStart);
      if (updatedWeek) persistWeek(personId, weekStart, updatedWeek);
      return updated;
    });
    bump();
  }, [bump, persistWeek]);

  const setWeekStatus = useCallback(async (
    personId: string,
    weekStart: string,
    status: WeekStatus,
    meta?: { note?: string; by?: string }
  ) => {
    const targetWeek = weeks.find(w => w.personId === personId && w.weekStart === weekStart);
    if (!targetWeek) {
      const error = new Error(`Timesheet week ${weekStart} was not found for ${personId}`);
      console.error('[TimesheetStore] setWeekStatus failed:', error);
      toast.error('Timesheet update failed', { description: error.message });
      throw error;
    }

    const normalizedWeek = normalizeStoredWeek(targetWeek);
    if (status === 'submitted') {
      if (projectStartDate) {
        if (weekIsFullyBeforeProjectStart(weekStart, projectStartDate)) {
          const message = `Cannot submit a week before project start (${projectStartDate}).`;
          toast.error('Cannot submit timesheet', { description: message });
          throw new Error(message);
        }
        if (weekHasHoursBeforeProjectStart(normalizedWeek, projectStartDate)) {
          const message = `Hours before project start (${projectStartDate}) must be removed before submission.`;
          toast.error('Cannot submit timesheet', { description: message });
          throw new Error(message);
        }
      }
      const validation = validateTimesheetWeek(normalizedWeek);
      if (validation.errors.length > 0) {
        const message = validation.errors[0]?.message || 'Timesheet validation failed';
        console.warn('[TimesheetStore] Submission blocked by validation', validation.errors);
        toast.error('Cannot submit timesheet', { description: message });
        throw new Error(message);
      }
    }

    const projectId = activeProjectId();
    if (!projectId) {
      const message = 'Select a project before submitting time.';
      toast.error('Cannot submit timesheet', { description: message });
      throw new Error(message);
    }
    const isRemoteWorkflow = Boolean(accessToken && !isDemoPersonId(personId));
    if (!isRemoteWorkflow) {
      // Demo/offline weeks have no server approval workflow.
      applyWeekStatusLocally(personId, weekStart, status, meta);
      return;
    }

    try {
      const subjectId = buildTimesheetSubjectId(personId, weekStart);

      if (status === 'submitted') {
        const nameDir = readNameDir(projectId);
        const approvalParties = readApprovalParties(projectId);
        const submitterName = nameDir[personId]?.name || user?.user_metadata?.full_name || normalizedWeek.personId || 'Submitted timesheet';
        const submitterOrgId = nameDir[personId]?.orgId || approvalParties.find((party) =>
          party.people.some((person) => person.id === personId)
        )?.id;
        const submitterOrg = submitterOrgId
          ? approvalParties.find((party) => party.id === submitterOrgId)?.name || nameDir[submitterOrgId]?.name || submitterOrgId
          : undefined;
        const daySummary = normalizedWeek.days.map((day) => ({
          day: day.day,
          hours: typeof day.totalHours === 'number' ? day.totalHours : day.hours || 0,
          notes: day.notes,
        }));
        // Descriptive fields only. The server adds the approval route, the
        // current approver, and the hours stored on the week.
        const approvalSnapshot: ApprovalSubjectSnapshot = {
          kind: 'timesheet',
          title: `${submitterName} · ${normalizedWeek.weekLabel}`,
          summary: `${submitterOrg || 'Unknown organization'} · ${normalizedWeek.weekLabel} · ${sumWeekHours(normalizedWeek)}h`,
          submitterId: personId,
          submitterName,
          submitterOrg,
          periodStart: normalizedWeek.weekStart,
          periodEnd: (() => {
            const end = new Date(`${normalizedWeek.weekStart}T00:00:00`);
            end.setDate(end.getDate() + 4);
            return formatISODateLocal(end);
          })(),
          weekLabel: normalizedWeek.weekLabel,
          billableHours: sumWeekBillableHours(normalizedWeek),
          daySummary,
        };

        await flushWeekNow(personId, weekStart, normalizedWeek);
        const submission = await submitTimesheetForApproval(
          projectId,
          weekStart,
          subjectId,
          approvalSnapshot as Record<string, unknown>,
        );
        applyWeekStatusLocally(personId, weekStart, 'submitted', meta, submission?.approval?.submitted_at);
        return;
      }

      if (status === 'approved' || status === 'rejected') {
        const pendingApproval = await getLatestPendingApproval('timesheet', subjectId, projectId);
        if (!pendingApproval) {
          throw new Error(`No pending approval record was found for ${subjectId}`);
        }

        if (status === 'approved') {
          const approvalResult = await approveItem(pendingApproval.id, {
            approvedBy: meta?.by,
            notes: meta?.note,
          });
          const nextStatus: WeekStatus = approvalResult.weekStatus === 'approved' ? 'approved' : 'submitted';
          applyWeekStatusLocally(personId, weekStart, nextStatus, meta, normalizedWeek.submittedAt);
        } else {
          await rejectItem(pendingApproval.id, {
            rejectedBy: meta?.by,
            reason: meta?.note,
          });
          applyWeekStatusLocally(personId, weekStart, status, meta);
        }
        return;
      }

      if (status === 'draft') {
        await persistDraftStatus(weekStart, normalizedWeek.status);
        applyWeekStatusLocally(personId, weekStart, 'draft', meta);
        return;
      }
    } catch (error) {
      const description = formatActionError(status === 'submitted' ? 'submit' : status, error);
      console.error(`[TimesheetStore] Failed to ${status} week ${weekStart}:`, error);
      toast.error('Timesheet update failed', { description });
      throw error instanceof Error ? error : new Error(description);
    }

  }, [accessToken, applyWeekStatusLocally, flushWeekNow, persistDraftStatus, projectStartDate, user?.id, weeks]);

  // Approves each submitted week of the month through the approval workflow,
  // one at a time. The server refuses weeks this viewer is not assigned to.
  const batchApproveMonth = useCallback((personId: string, month: string, approverName: string): number => {
    const weekStartsToApprove = weeks
      .filter(w => w.personId === personId && monthOf(w.weekStart) === month && w.status === 'submitted')
      .map(w => w.weekStart)
      .sort();

    void (async () => {
      for (const ws of weekStartsToApprove) {
        try {
          await setWeekStatus(personId, ws, 'approved', { by: approverName });
        } catch (err) {
          console.error(`[TimesheetStore] Failed to batch-approve ${ws}:`, err);
          return;
        }
      }
    })();

    return weekStartsToApprove.length;
  }, [setWeekStatus, weeks]);

  const seedMonthForPerson = useCallback((personId: string, month: string): number => {
    const mondays = getMondaysForMonth(month);
    if (mondays.length === 0) return 0;

    const currentProject = activeProjectId();
    const existingKeys = new Set(
      weeks
        .filter(w => w.personId === personId && matchesProject(w, currentProject))
        .map(w => `${w.personId}:${w.weekStart}`)
    );

    const eligibleMondays = projectStartDate
      ? mondays.filter(weekStart => !weekIsFullyBeforeProjectStart(weekStart, projectStartDate))
      : mondays;

    const created = eligibleMondays
      .filter(weekStart => !existingKeys.has(`${personId}:${weekStart}`))
      .map<StoredWeek>(weekStart => ({
        personId,
        weekLabel: generateWeekLabel(weekStart),
        weekStart,
        days: mkDays([0, 0, 0, 0, 0]),
        tasks: [],
        status: 'draft',
        projectId: currentProject,
      }))
      .map(normalizeStoredWeek);

    if (created.length === 0) return 0;

    setWeeks(prev => [...prev, ...created].sort((a, b) => a.weekStart.localeCompare(b.weekStart)));
    created.forEach(week => persistWeek(personId, week.weekStart, week));
    bump();

    return created.length;
  }, [bump, persistWeek, projectStartDate, weeks]);

  const submitMonthForPerson = useCallback((personId: string, month: string, projectId?: string): SubmissionEnvelope | null => {
    const resolvedProjectId = projectId || activeProjectId();
    if (!resolvedProjectId) {
      toast.error('Cannot submit month', { description: 'Select a project before submitting time.' });
      return null;
    }
    const personWeeks = weeks
      .filter(w => w.personId === personId && monthOf(w.weekStart) === month)
      .map(normalizeStoredWeek);

    if (personWeeks.length === 0) return null;

    const submitCandidates = personWeeks.filter(w => w.status === 'draft' || w.status === 'rejected');
    if (submitCandidates.length === 0) return null;

    if (projectStartDate) {
      const blockedWeek = submitCandidates.find((week) =>
        weekIsFullyBeforeProjectStart(week.weekStart, projectStartDate) ||
        weekHasHoursBeforeProjectStart(week, projectStartDate)
      );
      if (blockedWeek) {
        toast.error('Cannot submit month', {
          description: `Week ${blockedWeek.weekLabel} contains dates before project start (${projectStartDate}).`,
        });
        return null;
      }
    }

    const periodStart = submitCandidates
      .map(w => w.weekStart)
      .sort()[0];
    const sortedWeekStarts = submitCandidates.map(w => w.weekStart).sort();
    const periodEndDate = new Date(`${sortedWeekStarts[sortedWeekStarts.length - 1]}T00:00:00`);
    periodEndDate.setDate(periodEndDate.getDate() + 6);
    const periodEnd = formatISODateLocal(periodEndDate);
    const submittedAt = new Date().toISOString();

    const envelope: SubmissionEnvelope = {
      id: `submission_${personId}_${month}_${Date.now()}`,
      type: 'monthly',
      personId,
      projectId: resolvedProjectId,
      period: { start: periodStart, end: periodEnd },
      weekIds: submitCandidates.map(w => w.weekStart),
      status: 'submitted',
      submittedAt,
      totalHours: submitCandidates.reduce((sum, week) => sum + sumWeekHours(week), 0),
      totalBillableHours: submitCandidates.reduce((sum, week) => sum + sumWeekBillableHours(week), 0),
    };

    // Each week goes through the approval workflow in turn; the store marks a
    // week submitted only after the server accepts it.
    void (async () => {
      for (const week of [...submitCandidates].sort((a, b) => a.weekStart.localeCompare(b.weekStart))) {
        try {
          await setWeekStatus(personId, week.weekStart, 'submitted');
        } catch (err) {
          console.error(`[TimesheetStore] Failed to submit ${week.weekStart}:`, err);
          return;
        }
      }
    })();

    setSubmissionEnvelopes(prev => {
      const withoutPrior = prev.filter(
        e => !(e.personId === personId && e.period.start.startsWith(month) && e.type === 'monthly')
      );
      return [...withoutPrior, envelope];
    });

    bump();
    return envelope;
  }, [weeks, setWeekStatus, bump, projectStartDate]);

  const getSubmissionEnvelopes = useCallback((personId?: string, month?: string): SubmissionEnvelope[] => {
    return submissionEnvelopes.filter(envelope => {
      if (personId && envelope.personId !== personId) return false;
      if (month && !envelope.period.start.startsWith(month)) return false;
      return true;
    });
  }, [submissionEnvelopes]);

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
    submitMonthForPerson,
    getSubmissionEnvelopes,
    version,
    isLoading,
  }), [getWeeksForPerson, getAllWeeksForMonth, getPersonIds, updateWeekDays, updateSingleDay, updateWeekTasks, setWeekStatus, batchApproveMonth, seedMonthForPerson, submitMonthForPerson, getSubmissionEnvelopes, version, isLoading]);

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
