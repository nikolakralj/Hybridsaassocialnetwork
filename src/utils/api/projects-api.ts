// Phase 1: Projects Frontend API Client
// Calls KV-backed server endpoints instead of direct Supabase queries

import { projectId as supabaseProjectId, publicAnonKey } from '../supabase/info';

const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be/api`;
const LOCAL_PROJECTS_KEY = 'wg-local-projects-v1';
const ENABLE_LOCAL_FALLBACK = import.meta.env.VITE_ENABLE_LOCAL_FALLBACK === 'true';
export const isLocalProjectFallbackEnabled = ENABLE_LOCAL_FALLBACK;

function getHeaders(accessToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

type LocalProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role: string;
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string | null;
};

type LocalProjectRecord = {
  project: Record<string, any>;
  members: LocalProjectMember[];
};

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function canUseLocalFallback(status?: number, accessToken?: string | null): boolean {
  if (!ENABLE_LOCAL_FALLBACK) return false;
  if (!accessToken) return true;
  return status === 401 || status === 403;
}

// Resilient fallback for demo/prototype workflows:
// if backend is temporarily unavailable, keep the user unblocked with local storage.
function canUseResilientFallback(status?: number, accessToken?: string | null): boolean {
  if (canUseLocalFallback(status, accessToken)) return true;
  if (typeof window === 'undefined') return false;
  if (status === undefined) return true; // network/parse/runtime fetch failure
  return status >= 500 || status === 404 || status === 429;
}

function readLocalProjects(): LocalProjectRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLocalProjectList() {
  return readLocalProjects()
    .map((record) => record.project)
    .filter(Boolean);
}

function hasLocalProject(projectId: string): boolean {
  return readLocalProjects().some((record) => record.project?.id === projectId);
}

function mergeProjectsById(primary: any[], secondary: any[]) {
  const merged = new Map<string, any>();
  [...secondary, ...primary].forEach((project) => {
    if (!project?.id) return;
    merged.set(project.id, project);
  });
  return [...merged.values()].sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt || 0).getTime() -
      new Date(a.updatedAt || a.createdAt || 0).getTime()
  );
}

function writeLocalProjects(records: LocalProjectRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(records));
}

function localListProjects() {
  return readLocalProjects()
    .map((record) => record.project)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

function localGetProject(projectId: string) {
  const record = readLocalProjects().find((r) => r.project?.id === projectId);
  if (!record) throw new Error('Project not found');
  return { project: record.project, members: record.members || [] };
}

function localCreateProject(project: {
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
}) {
  const now = new Date().toISOString();
  const projectId = generateId('proj_local');
  const ownerId = 'local-user';

  const createdProject = {
    id: projectId,
    name: project.name || 'Untitled Project',
    description: project.description || '',
    region: project.region || 'US',
    currency: project.currency || 'USD',
    startDate: project.startDate || now,
    endDate: project.endDate || null,
    workWeek: project.workWeek || {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
    status: project.status === 'draft' ? 'draft' : 'active',
    supplyChainStatus: project.supplyChainStatus === 'incomplete' ? 'incomplete' : 'complete',
    ownerId,
    createdAt: now,
    updatedAt: now,
  };

  const members: LocalProjectMember[] = [
    {
      id: generateId('mem_local'),
      projectId,
      userId: ownerId,
      userName: project.ownerName || 'Local Owner',
      userEmail: project.ownerEmail || 'local@example.com',
      role: 'Owner',
      invitedBy: ownerId,
      invitedAt: now,
      acceptedAt: now,
    },
    ...((project.members || []).map((m) => ({
      id: generateId('mem_local'),
      projectId,
      userId: generateId('user_local'),
      userName: m.userName || m.userEmail || 'Member',
      userEmail: m.userEmail || '',
      role: m.role || 'Viewer',
      invitedBy: ownerId,
      invitedAt: now,
      acceptedAt: null,
    }))),
  ];

  const records = readLocalProjects();
  records.push({ project: createdProject, members });
  writeLocalProjects(records);
  return { project: createdProject, members };
}

function localUpdateProject(projectId: string, updates: Record<string, any>) {
  const records = readLocalProjects();
  const idx = records.findIndex((r) => r.project?.id === projectId);
  if (idx < 0) throw new Error('Project not found');
  const existing = records[idx];
  const updatedProject = {
    ...existing.project,
    ...updates,
    id: projectId,
    updatedAt: new Date().toISOString(),
  };
  records[idx] = { ...existing, project: updatedProject };
  writeLocalProjects(records);
  return updatedProject;
}

function localDeleteProject(projectId: string) {
  const records = readLocalProjects().filter((r) => r.project?.id !== projectId);
  writeLocalProjects(records);
}

function localGetProjectMembers(projectId: string) {
  const record = readLocalProjects().find((r) => r.project?.id === projectId);
  if (!record) throw new Error('Project not found');
  return record.members || [];
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
  try {
    const res = await fetch(`${BASE}/projects`, {
      headers: getHeaders(accessToken),
    });
    const data = await res.json();
    if (!res.ok) {
      if (canUseResilientFallback(res.status, accessToken)) {
        return localListProjects();
      }
      console.error('listProjects error:', data);
      throw new Error(data.error || 'Failed to list projects');
    }
    return mergeProjectsById(data.projects || [], readLocalProjectList());
  } catch (error) {
    if (canUseResilientFallback(undefined, accessToken)) {
      return localListProjects();
    }
    throw error;
  }
}

export async function getProject(projectId: string, accessToken?: string | null) {
  try {
    const res = await fetch(`${BASE}/projects/${projectId}`, {
      headers: getHeaders(accessToken),
    });
    const data = await res.json();
    if (!res.ok) {
      if (hasLocalProject(projectId)) {
        return localGetProject(projectId);
      }
      if (canUseLocalFallback(res.status, accessToken)) {
        return localGetProject(projectId);
      }
      throw new Error(data.error || 'Failed to get project');
    }
    return data;
  } catch (error) {
    if (hasLocalProject(projectId)) {
      return localGetProject(projectId);
    }
    if (canUseLocalFallback(undefined, accessToken)) {
      return localGetProject(projectId);
    }
    throw error;
  }
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
  try {
    const res = await fetch(`${BASE}/projects`, {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify(project),
    });
    const data = await res.json();
    if (!res.ok) {
      if (canUseResilientFallback(res.status, accessToken)) {
        return localCreateProject(project);
      }
      throw new Error(data.error || 'Failed to create project');
    }
    return data;
  } catch (error) {
    if (canUseResilientFallback(undefined, accessToken)) {
      return localCreateProject(project);
    }
    throw error;
  }
}

export async function updateProject(
  projectId: string,
  updates: Record<string, any>,
  accessToken?: string | null
) {
  try {
    const res = await fetch(`${BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: getHeaders(accessToken),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) {
      if (hasLocalProject(projectId)) {
        return localUpdateProject(projectId, updates);
      }
      if (canUseLocalFallback(res.status, accessToken)) {
        return localUpdateProject(projectId, updates);
      }
      throw new Error(data.error || 'Failed to update project');
    }
    return data.project;
  } catch (error) {
    if (hasLocalProject(projectId)) {
      return localUpdateProject(projectId, updates);
    }
    if (canUseLocalFallback(undefined, accessToken)) {
      return localUpdateProject(projectId, updates);
    }
    throw error;
  }
}

export async function deleteProject(projectId: string, accessToken?: string | null) {
  try {
    const res = await fetch(`${BASE}/projects/${projectId}`, {
      method: 'DELETE',
      headers: getHeaders(accessToken),
    });
    const data = await res.json();
    if (!res.ok) {
      if (hasLocalProject(projectId)) {
        localDeleteProject(projectId);
        return true;
      }
      if (canUseLocalFallback(res.status, accessToken)) {
        localDeleteProject(projectId);
        return true;
      }
      throw new Error(data.error || 'Failed to delete project');
    }
    return true;
  } catch (error) {
    if (hasLocalProject(projectId)) {
      localDeleteProject(projectId);
      return true;
    }
    if (canUseLocalFallback(undefined, accessToken)) {
      localDeleteProject(projectId);
      return true;
    }
    throw error;
  }
}

// ---------- Members ----------

export async function getProjectMembers(projectId: string, accessToken?: string | null) {
  try {
    const res = await fetch(`${BASE}/projects/${projectId}/members`, {
      headers: getHeaders(accessToken),
    });
    const data = await res.json();
    if (!res.ok) {
      if (hasLocalProject(projectId)) {
        return localGetProjectMembers(projectId);
      }
      if (canUseLocalFallback(res.status, accessToken)) {
        return localGetProjectMembers(projectId);
      }
      throw new Error(data.error || 'Failed to get members');
    }
    return data.members || [];
  } catch (error) {
    if (hasLocalProject(projectId)) {
      return localGetProjectMembers(projectId);
    }
    if (canUseLocalFallback(undefined, accessToken)) {
      return localGetProjectMembers(projectId);
    }
    throw error;
  }
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
