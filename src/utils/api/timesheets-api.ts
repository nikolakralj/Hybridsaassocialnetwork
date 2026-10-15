// Phase 1: Timesheets Frontend API Client
// Direct Supabase writes are kept for own-row draft content only.
// Status changes (submit, recall, approve, reject) go through the database RPCs
// from migration 034; the database rejects any other status write.

import { projectId as supabaseProjectId, publicAnonKey } from '../supabase/info';
import { createClient } from '../supabase/client';

const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be/api`;
const supabase = createClient();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value?: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function getHeaders(accessToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

export async function listTimesheets(month?: string, accessToken?: string | null, projectId?: string | null) {
  const currentProjectId = projectId || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('currentProjectId') : null);
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  if (currentProjectId) params.set('project_id', currentProjectId);
  const query = params.toString();
  const res = await fetch(`${BASE}/timesheets${query ? `?${query}` : ''}`, {
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list timesheets');
  return data.weeks || [];
}

export async function getTimesheetWeek(weekStart: string, accessToken?: string | null) {
  const res = await fetch(`${BASE}/timesheets/${weekStart}`, {
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get timesheet');
  return data.week;
}

export async function saveTimesheetWeek(
  weekStart: string,
  weekData: {
    days?: any[];
    tasks?: string[];
    status?: string;
    projectId?: string;
    contractId?: string;
    notes?: string;
    personId?: string;
    totalHours?: number;
  },
  accessToken?: string | null
) {
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      if (isUuid(weekData.personId) && weekData.personId !== user.id) {
        throw new Error('You cannot save a timesheet for another user.');
      }

      const ownerId = user.id;
      const rowId = `${ownerId}:${weekStart}`;
      const now = new Date().toISOString();
      const totalHours =
        typeof weekData.totalHours === 'number'
          ? weekData.totalHours
          : (weekData.days || []).reduce((sum: number, day: any) => {
              const hours = Number(day?.totalHours ?? day?.hours ?? 0);
              return sum + (Number.isFinite(hours) ? hours : 0);
            }, 0);

      // Status is never sent: new rows default to draft, and existing rows keep
      // the status the approval workflow gave them.
      const row: Record<string, any> = {
        id: rowId,
        user_id: ownerId,
        week_start: weekStart,
        data: {
          totalHours,
          days: weekData.days || [],
          tasks: weekData.tasks || [],
          notes: weekData.notes,
        },
        updated_at: now,
      };
      if (weekData.projectId) row.project_id = weekData.projectId;

      const { error } = await supabase
        .from('wg_timesheet_weeks')
        .upsert(row, { onConflict: 'id' });

      if (!error) return { weekStart, ...row };
      console.warn('[timesheets] Direct Supabase save failed:', error.message);
    }
  }

  const res = await fetch(`${BASE}/timesheets/${weekStart}`, {
    method: 'PUT',
    headers: getHeaders(accessToken),
    body: JSON.stringify(weekData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save timesheet');
  return data.week;
}

export interface TimesheetDecisionResult {
  weekStatus: 'draft' | 'submitted' | 'approved' | 'rejected' | null;
}

function rpcErrorMessage(error: { message?: string } | null, fallback: string): string {
  return error?.message || fallback;
}

/**
 * Submit your own week for approval. The database computes the full approval
 * route from the project graph, creates the first step, and marks the week
 * submitted in one transaction (wg_submit_timesheet).
 */
export async function submitTimesheetForApproval(
  projectId: string,
  weekStart: string,
  subjectId: string,
  snapshot: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc('wg_submit_timesheet', {
    p_project_id: projectId,
    p_week_start: weekStart,
    p_subject_id: subjectId,
    p_snapshot: snapshot,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not submit the timesheet.'));
  return data as { approval: Record<string, any>; route: Array<Record<string, any>> };
}

/** Pull your own submitted week back to draft before anyone has approved it. */
export async function recallTimesheet(projectId: string, weekStart: string): Promise<TimesheetDecisionResult> {
  const { data, error } = await supabase.rpc('wg_recall_timesheet', {
    p_project_id: projectId,
    p_week_start: weekStart,
  });
  if (error) throw new Error(rpcErrorMessage(error, 'Could not recall the timesheet.'));
  return { weekStatus: (data as any)?.weekStatus ?? 'draft' };
}

/**
 * Move your own rejected week back to draft so it can be edited. Every other
 * status change goes through submitTimesheetForApproval, recallTimesheet, or
 * the approval queue.
 */
export async function reopenRejectedTimesheet(weekStart: string, projectId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to edit this timesheet.');
  let query = supabase
    .from('wg_timesheet_weeks')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .eq('status', 'rejected');
  if (projectId) query = query.eq('project_id', projectId);
  const { data, error } = await query.select('id');
  if (error) throw new Error(rpcErrorMessage(error, 'Could not reopen the timesheet.'));
  if (!data || data.length === 0) throw new Error('Only a rejected week can be reopened.');
  return { weekStart, status: 'draft' as const };
}

export async function deleteTimesheetWeek(weekStart: string, accessToken?: string | null) {
  const res = await fetch(`${BASE}/timesheets/${weekStart}`, {
    method: 'DELETE',
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete timesheet');
  return true;
}
