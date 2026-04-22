// Phase 1: Timesheets Frontend API Client
// Direct Supabase writes used as primary path (edge function not deployed)

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
  if (currentProjectId && !isUuid(currentProjectId)) return [];
  const url = month ? `${BASE}/timesheets?month=${month}` : `${BASE}/timesheets`;
  const res = await fetch(url, {
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
  // Primary path: direct Supabase write (edge function not deployed)
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const ownerId = isUuid(weekData.personId) ? weekData.personId! : user.id;
      const rowId = `${ownerId}:${weekStart}`;
      const now = new Date().toISOString();
      const totalHours =
        typeof weekData.totalHours === 'number'
          ? weekData.totalHours
          : (weekData.days || []).reduce((sum: number, d: any) => {
              const h = Number(d?.totalHours ?? d?.hours ?? 0);
              return sum + (Number.isFinite(h) ? h : 0);
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
      if (weekData.projectId && !weekData.projectId.startsWith('proj_local_')) {
        row.project_id = weekData.projectId;
      }
      if (weekData.status === 'submitted') row.submitted_at = now;

      const { error } = await supabase
        .from('wg_timesheet_weeks')
        .upsert(row, { onConflict: 'id' });
      if (!error) return { weekStart, ...row };
      console.warn('[timesheets] Direct Supabase save failed:', error.message);
    }
  }

  // Fallback: edge function
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
  // Primary path: direct Supabase write (edge function not deployed)
  let rowIdForReconcile: string | null = null;
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const ownerId = isUuid(options?.personId) ? options!.personId : user.id;
      const rowId = `${ownerId}:${weekStart}`;
      rowIdForReconcile = rowId;
      const now = new Date().toISOString();
      const updates: Record<string, any> = {
        status,
        updated_at: now,
      };
      if (status === 'submitted') updates.submitted_at = now;
      if (status === 'approved') {
        updates.approved_at = now;
      }

      const { data: updatedRow, error } = await supabase
        .from('wg_timesheet_weeks')
        .update(updates)
        .eq('id', rowId)
        .select('id, status')
        .maybeSingle();

      if (!error && updatedRow) return { weekStart, status };

      // Row might not exist yet — upsert it
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
      if (options?.projectId && !options.projectId.startsWith('proj_local_')) {
        upsertRow.project_id = options.projectId;
      }
      const { error: upsertError } = await supabase
        .from('wg_timesheet_weeks')
        .upsert(upsertRow, { onConflict: 'id' });

      if (!upsertError) return { weekStart, status };
      console.warn('[timesheets] Direct Supabase status update failed:', upsertError.message);

      // Reconcile before falling back: if row is already in the target status, treat as success.
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

  // Fallback: edge function
  const res = await fetch(`${BASE}/timesheets/${weekStart}/status`, {
    method: 'PATCH',
    headers: getHeaders(accessToken),
    body: JSON.stringify({ status, ...options }),
  });
  const data = await res.json();
  if (!res.ok) {
    // Final idempotency guard: if DB already has requested status, suppress false-negative errors.
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
