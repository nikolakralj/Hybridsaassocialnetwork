// Phase 1: Timesheets Frontend API Client
// Direct Supabase writes are kept for own-row draft/submission operations.
// Cross-user approval/rejection must go through the server path.

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

      const row: Record<string, any> = {
        id: rowId,
        user_id: ownerId,
        week_start: weekStart,
        status: weekData.status || 'draft',
        data: {
          totalHours,
          days: weekData.days || [],
          tasks: weekData.tasks || [],
          notes: weekData.notes,
        },
        updated_at: now,
      };
      if (weekData.projectId) row.project_id = weekData.projectId;
      if (weekData.status === 'submitted') row.submitted_at = now;

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

export async function updateTimesheetStatus(
  weekStart: string,
  status: 'draft' | 'submitted' | 'approved' | 'rejected',
  options?: {
    personId?: string;
    approverName?: string;
    note?: string;
    projectId?: string;
  },
  accessToken?: string | null
) {
  let rowIdForReconcile: string | null = null;

  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const requestedUserId = isUuid(options?.personId) ? options!.personId : null;
      const targetsAnotherUser = Boolean(requestedUserId && requestedUserId !== user.id);

      if (targetsAnotherUser && (status === 'submitted' || status === 'draft')) {
        throw new Error('You cannot submit or reopen a timesheet for another user.');
      }

      if (!targetsAnotherUser && (status === 'approved' || status === 'rejected')) {
        throw new Error('You cannot approve or reject your own timesheet.');
      }

      if (targetsAnotherUser) {
        rowIdForReconcile = `${requestedUserId}:${weekStart}`;
      } else {
        const ownerId = user.id;
        const rowId = `${ownerId}:${weekStart}`;
        rowIdForReconcile = rowId;
        const now = new Date().toISOString();
        const updates: Record<string, any> = {
          status,
          updated_at: now,
        };
        if (status === 'submitted') updates.submitted_at = now;
        if (status === 'approved') updates.approved_at = now;

        const { data: updatedRow, error } = await supabase
          .from('wg_timesheet_weeks')
          .update(updates)
          .eq('id', rowId)
          .select('id, status')
          .maybeSingle();

        if (!error && updatedRow) return { weekStart, status };

        const upsertRow: Record<string, any> = {
          id: rowId,
          user_id: ownerId,
          week_start: weekStart,
          status,
          data: { totalHours: 0, days: [], tasks: [] },
          submitted_at: status === 'submitted' ? now : null,
          approved_at: status === 'approved' ? now : null,
          created_at: now,
          updated_at: now,
        };
        if (options?.projectId) upsertRow.project_id = options.projectId;

        const { error: upsertError } = await supabase
          .from('wg_timesheet_weeks')
          .upsert(upsertRow, { onConflict: 'id' });

        if (!upsertError) return { weekStart, status };
        console.warn('[timesheets] Direct Supabase status update failed:', upsertError.message);

        const { data: reconciledRow, error: reconcileError } = await supabase
          .from('wg_timesheet_weeks')
          .select('status')
          .eq('id', rowId)
          .maybeSingle();

        if (!reconcileError && reconciledRow?.status === status) {
          return { weekStart, status };
        }
      }
    }
  }

  const res = await fetch(`${BASE}/timesheets/${weekStart}/status`, {
    method: 'PATCH',
    headers: getHeaders(accessToken),
    body: JSON.stringify({ status, ...options }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (rowIdForReconcile) {
      const { data: reconciledRow, error: reconcileError } = await supabase
        .from('wg_timesheet_weeks')
        .select('status')
        .eq('id', rowIdForReconcile)
        .maybeSingle();

      if (!reconcileError && reconciledRow?.status === status) {
        return { weekStart, status };
      }
    }
    throw new Error(data.error || 'Failed to update status');
  }
  return data.week;
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
