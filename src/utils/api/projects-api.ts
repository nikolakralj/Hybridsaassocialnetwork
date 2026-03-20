// Phase 1: Projects Frontend API Client
// Calls KV-backed server endpoints instead of direct Supabase queries

import { projectId as supabaseProjectId, publicAnonKey } from '../supabase/info';

const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be/api`;

function getHeaders(accessToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

// Re-export types for convenience
export type { Project, ProjectInvitation, ProjectMember, ProjectRole } from '../../types/collaboration';

export interface StoredProjectInvitation {
  id: string;
  projectId: string;
  projectName?: string;
  email: string;
  role: string;
  scope?: string;
  invitedBy: string;
  invitedByName?: string;
  invitedAt: string;
  expiresAt?: string;
  acceptedAt?: string;
  token?: string;
  status: 'pending' | 'accepted' | 'declined';
  declinedAt?: string;
  acceptedByUserId?: string;
}

// ---------- Projects ----------

export async function listProjects(accessToken?: string | null) {
  const res = await fetch(`${BASE}/projects`, {
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('listProjects error:', data);
    throw new Error(data.error || 'Failed to list projects');
  }
  return data.projects || [];
}

export async function getProject(projectId: string, accessToken?: string | null) {
  const res = await fetch(`${BASE}/projects/${projectId}`, {
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get project');
  return data;
}

export async function createProject(
  project: {
    name: string;
    description?: string;
    region?: string;
    currency?: string;
    startDate?: string;
    endDate?: string;
    workWeek?: Record<string, boolean>;
    status?: 'active' | 'draft';
    supplyChainStatus?: 'complete' | 'incomplete';
    ownerName?: string;
    ownerEmail?: string;
    members?: Array<{ userName?: string; userEmail?: string; role?: string }>;
  },
  accessToken?: string | null
) {
  const res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: getHeaders(accessToken),
    body: JSON.stringify(project),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create project');
  return data;
}

export async function updateProject(
  projectId: string,
  updates: Record<string, any>,
  accessToken?: string | null
) {
  const res = await fetch(`${BASE}/projects/${projectId}`, {
    method: 'PUT',
    headers: getHeaders(accessToken),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update project');
  return data.project;
}

export async function deleteProject(projectId: string, accessToken?: string | null) {
  const res = await fetch(`${BASE}/projects/${projectId}`, {
    method: 'DELETE',
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete project');
  return true;
}

// ---------- Members ----------

export async function getProjectMembers(projectId: string, accessToken?: string | null) {
  const res = await fetch(`${BASE}/projects/${projectId}/members`, {
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get members');
  return data.members || [];
}

export async function addProjectMember(
  projectId: string,
  member: { userName?: string; userEmail?: string; role?: string },
  accessToken?: string | null
) {
  const res = await fetch(`${BASE}/projects/${projectId}/members`, {
    method: 'POST',
    headers: getHeaders(accessToken),
    body: JSON.stringify(member),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add member');
  return data.member;
}

export async function removeProjectMember(
  projectId: string,
  memberId: string,
  accessToken?: string | null
) {
  const res = await fetch(`${BASE}/projects/${projectId}/members/${memberId}`, {
    method: 'DELETE',
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to remove member');
  return true;
}

// ---------- Invitations ----------

export async function listProjectInvitations(accessToken?: string | null): Promise<StoredProjectInvitation[]> {
  const res = await fetch(`${BASE}/invitations`, {
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load invitations');
  return data.invitations || [];
}

export async function acceptProjectInvitation(
  invitationId: string,
  accessToken?: string | null
) {
  const res = await fetch(`${BASE}/invitations/${invitationId}/accept`, {
    method: 'POST',
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to accept invitation');
  return data;
}

export async function declineProjectInvitation(
  invitationId: string,
  accessToken?: string | null
) {
  const res = await fetch(`${BASE}/invitations/${invitationId}/decline`, {
    method: 'POST',
    headers: getHeaders(accessToken),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to decline invitation');
  return data;
}
