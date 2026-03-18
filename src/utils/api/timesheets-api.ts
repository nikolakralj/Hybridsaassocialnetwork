// Phase 1: Timesheets Frontend API Client

import { projectId as supabaseProjectId, publicAnonKey } from '../supabase/info';

const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be/api`;

function getHeaders(accessToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

export async function listTimesheets(month?: string, accessToken?: string | null) {
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
  },
  accessToken?: string | null
) {
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
  },
  accessToken?: string | null
) {
  const res = await fetch(`${BASE}/timesheets/${weekStart}/status`, {
    method: 'PATCH',
    headers: getHeaders(accessToken),
    body: JSON.stringify({ status, ...options }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update status');
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