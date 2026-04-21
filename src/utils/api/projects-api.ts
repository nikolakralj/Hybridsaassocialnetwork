// Phase 1: Projects Frontend API Client
// Calls KV-backed server endpoints instead of direct Supabase queries
// Direct Supabase writes used as primary path (edge function not deployed)

import { projectId as supabaseProjectId, publicAnonKey } from '../supabase/info';
import { createClient } from '../supabase/client';
const supabase = createClient();

const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be/api`;
const LOCAL_PROJECTS_KEY = 'wg-local-projects-v1';
const ENABLE_LOCAL_FALLBACK = import.meta.env.VITE_ENABLE_LOCAL_FALLBACK === 'true';
export const isLocalProjectFallbackEnabled = ENABLE_LOCAL_FALLBACK;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ProjectStorageSource = 'cloud' | 'local';

function resolveStoredProjectSource(project: Record<string, any>, fallback: ProjectStorageSource): ProjectStorageSource {
  return project?.storageSource === 'cloud' ? 'cloud' : fallback;
}

function withProjectSource(project: Record<string, any>, storageSource: ProjectStorageSource) {
  const resolvedSource = resolveStoredProjectSource(project, storageSource);
  return {
    ...project,
    storageSource: resolvedSource,
    isLocalOnly: resolvedSource === 'local',
  };
}

function sortProjects(a: any, b: any) {
  const sourceRank = (project: any) => (project?.storageSource === 'cloud' ? 0 : 1);
  const rankDiff = sourceRank(a) - sourceRank(b);
  if (rankDiff !== 0) return rankDiff;

  return (
    new Date(b.updatedAt || b.createdAt || 0).getTime() -
    new Date(a.updatedAt || a.createdAt || 0).getTime()
  );
}

function getHeaders(accessToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

function isUuid(value?: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
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
    .map((project) => withProjectSource(project, resolveStoredProjectSource(project, 'local')))
    .filter(Boolean);
}

function hasLocalProject(projectId: string): boolean {
  return readLocalProjects().some((record) => record.project?.id === projectId);
}

function getCachedProjectSource(projectId: string): ProjectStorageSource | null {
  const project = readLocalProjects().find((record) => record.project?.id === projectId)?.project;
  return project?.storageSource === 'cloud' ? 'cloud' : null;
}

function isCloudProjectId(projectId?: string | null): projectId is string {
  if (!projectId) return false;
  if (isUuid(projectId)) return true;
  if (getCachedProjectSource(projectId) === 'cloud') return true;
  if (typeof sessionStorage !== 'undefined') {
    const selectedId = sessionStorage.getItem('currentProjectId');
    const selectedSource = sessionStorage.getItem('currentProjectSource');
    if (selectedId === projectId && selectedSource === 'cloud') {
      return true;
    }
  }
  return false;
}

function mergeProjectsById(primary: any[], secondary: any[]) {
  const merged = new Map<string, any>();
  [...secondary, ...primary].forEach((project) => {
    if (!project?.id) return;
    merged.set(project.id, project);
  });
  return [...merged.values()].sort(sortProjects);
}

function writeLocalProjects(records: LocalProjectRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_PROJECTS_KEY, JSON.stringify(records));
}

function localListProjects() {
  return readLocalProjects()
    .map((record) => record.project)
    .map((project) => withProjectSource(project, resolveStoredProjectSource(project, 'local')))
    .sort(sortProjects);
}

function localGetProject(projectId: string) {
  const record = readLocalProjects().find((r) => r.project?.id === projectId);
  if (!record) throw new Error('Project not found');
  return { project: record.project, members: record.members || [] };
}

function buildLocalProjectStub(projectId: string) {
  const now = new Date().toISOString().slice(0, 10);
  return {
    project: {
      id: projectId,
      name: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('currentProjectName') || 'Project' : 'Project',
      startDate: typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('currentProjectStartDate') || now : now,
      endDate: null,
      workWeek: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
    },
    members: [],
  };
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

// ── Direct Supabase write (primary path — edge function not deployed) ─────────

interface SupabaseProjectInput {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  workWeek?: Record<string, boolean>;
  ownerId: string;
  parties?: any;
  members?: Array<{
    id: string;
    userId?: string;
    userName?: string;
    userEmail?: string;
    role?: string;
    scope?: string;
    graphNodeId?: string;
  }>;
}

function mapSupabaseProjectRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    region: row.region,
    currency: row.currency,
    startDate: row.start_date,
    endDate: row.end_date,
    workWeek: row.work_week,
    status: row.status,
    supplyChainStatus: row.supply_chain_status,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storageSource: 'cloud' as const,
  };
}

function cacheCloudProjectList(projects: Record<string, any>[]) {
  const existing = readLocalProjects();
  const byId = new Map<string, LocalProjectRecord>();

  existing.forEach((record) => {
    if (!record.project?.id) return;
    byId.set(record.project.id, record);
  });

  projects.forEach((project) => {
    const prior = byId.get(project.id);
    byId.set(project.id, {
      project: { ...(prior?.project || {}), ...project, storageSource: 'cloud' as const },
      members: prior?.members || [],
    });
  });

  writeLocalProjects([...byId.values()]);
}

async function supabaseCreateProject(input: SupabaseProjectInput) {
  const now = new Date().toISOString();

  const { data: project, error: projError } = await supabase
    .from('wg_projects')
    .insert({
      id: input.id,
      name: input.name,
      start_date: input.startDate || now.slice(0, 10),
      end_date: input.endDate || null,
      work_week: input.workWeek || { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
      owner_id: input.ownerId,
      status: 'active',
      supply_chain_status: 'complete',
      parties: input.parties || null,
    })
    .select()
    .single();

  if (projError) throw new Error(`Failed to create project in DB: ${projError.message}`);

  if (input.members && input.members.length > 0) {
    const memberRows = input.members.map((m) => ({
      id: m.id,
      project_id: input.id,
      user_id: m.userId || null,
      user_name: m.userName || null,
      user_email: m.userEmail || null,
      role: m.role || 'Viewer',
      scope: m.scope || null,
      invited_by: input.ownerId,
      invited_at: now,
      accepted_at: m.userId ? now : null,
    }));

    const { error: membersError } = await supabase
      .from('wg_project_members')
      .insert(memberRows);

    if (membersError) {
      console.warn('Failed to insert project members:', membersError.message);
    }
  }

  return project;
}

async function supabaseListProjects(accessToken?: string | null) {
  const authResult = accessToken
    ? await supabase.auth.getUser(accessToken)
    : await supabase.auth.getUser();

  if (authResult.error || !authResult.data.user?.id) {
    throw new Error(authResult.error?.message || 'Failed to resolve current user');
  }

  const userId = authResult.data.user.id;
  const projectIds = new Set<string>();

  const { data: ownedProjects, error: ownedError } = await supabase
    .from('wg_projects')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });

  if (ownedError) {
    throw new Error(`Failed to list owned projects: ${ownedError.message}`);
  }

  (ownedProjects || []).forEach((project: any) => {
    if (project?.id) projectIds.add(project.id);
  });

  const { data: membershipRows, error: membersError } = await supabase
    .from('wg_project_members')
    .select('project_id')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null);

  if (membersError) {
    throw new Error(`Failed to list project memberships: ${membersError.message}`);
  }

  (membershipRows || []).forEach((row: any) => {
    if (row?.project_id) projectIds.add(row.project_id);
  });

  const ids = [...projectIds];
  if (ids.length === 0) return [];

  const { data: projects, error: projectsError } = await supabase
    .from('wg_projects')
    .select('*')
    .in('id', ids)
    .order('updated_at', { ascending: false });

  if (projectsError) {
    throw new Error(`Failed to fetch project rows: ${projectsError.message}`);
  }

  const mapped = (projects || []).map(mapSupabaseProjectRow);
  cacheCloudProjectList(mapped);
  return mapped;
}

export async function listProjects(accessToken?: string | null) {
  if (accessToken) {
    try {
      const cloudProjects = await supabaseListProjects(accessToken);
      const cachedProjects = readLocalProjectList();
      const cachedCloudProjects = cachedProjects.filter((project) => project.storageSource === 'cloud');

      if (!ENABLE_LOCAL_FALLBACK) {
        return mergeProjectsById(cloudProjects, cachedCloudProjects);
      }

      return mergeProjectsById(cloudProjects, cachedProjects);
    } catch (dbError) {
      console.warn('Direct Supabase project list failed, falling back to API route:', dbError);
    }
  }

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
    const cloudProjects = (data.projects || []).map((project: Record<string, any>) =>
      withProjectSource(project, 'cloud')
    );
    const cachedProjects = readLocalProjectList();
    const cachedCloudProjects = cachedProjects.filter((project) => project.storageSource === 'cloud');

    if (!ENABLE_LOCAL_FALLBACK) {
      return mergeProjectsById(cloudProjects, cachedCloudProjects);
    }

    return mergeProjectsById(cloudProjects, cachedProjects);
  } catch (error) {
    if (canUseResilientFallback(undefined, accessToken)) {
      return localListProjects();
    }
    throw error;
  }
}

export async function getProject(projectId: string, accessToken?: string | null) {
  if (!isCloudProjectId(projectId)) {
    if (hasLocalProject(projectId)) {
      return localGetProject(projectId);
    }
    return buildLocalProjectStub(projectId);
  }

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
    ownerId?: string;
    parties?: any;
    members?: Array<{ id?: string; userId?: string; userName?: string; userEmail?: string; role?: string; scope?: string; graphNodeId?: string }>;
  },
  accessToken?: string | null
) {
  // Primary path: write directly to Supabase (edge function not deployed)
  if (accessToken && project.ownerId) {
    try {
      const localId = generateId('proj');
      const dbProject = await supabaseCreateProject({
        id: localId,
        name: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        workWeek: project.workWeek,
        ownerId: project.ownerId,
        parties: project.parties,
        members: project.members?.map((m) => ({
          id: m.id || generateId('mem'),
          userId: m.userId,
          userName: m.userName,
          userEmail: m.userEmail,
          role: m.role,
          scope: m.scope,
          graphNodeId: m.graphNodeId,
        })),
      });
      const createdProject = {
        id: localId,
        name: dbProject.name,
        startDate: dbProject.start_date,
        endDate: dbProject.end_date,
        workWeek: dbProject.work_week,
        status: dbProject.status,
        ownerId: dbProject.owner_id,
        createdAt: dbProject.created_at,
        updatedAt: dbProject.updated_at,
        storageSource: 'cloud' as const,
      };
      // Cache locally too
      const records = readLocalProjects().filter((r) => r.project?.id !== localId);
      records.push({ project: createdProject, members: [] });
      writeLocalProjects(records);
      return { project: createdProject, members: [] };
    } catch (dbError: any) {
      // Surface the real DB error instead of silently creating a local-only project.
      // The user needs to know *why* the cloud write failed (RLS? schema? auth?) so
      // they can fix it rather than end up with a ghost project on refresh.
      console.error('[createProject] Direct Supabase write failed:', {
        message: dbError?.message,
        code: dbError?.code,
        details: dbError?.details,
        hint: dbError?.hint,
        raw: dbError,
      });
      const msg = dbError?.message || String(dbError);
      throw new Error(`Failed to save project to the database: ${msg}`);
    }
  }

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
    // Cache the API-created project locally so listProjects mergeProjectsById
    // always has a fallback copy even if the API later returns empty due to RLS/session issues.
    if (data?.project?.id) {
      const records = readLocalProjects().filter((r) => r.project?.id !== data.project.id);
      records.push({
        project: { ...data.project, storageSource: 'cloud' as const },
        members: data.members || [],
      });
      writeLocalProjects(records);
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
  // Local projects never hit the network
  if (!isCloudProjectId(projectId)) {
    if (hasLocalProject(projectId)) {
      return localUpdateProject(projectId, updates);
    }
    throw new Error('Project not found');
  }

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
  if (!isCloudProjectId(projectId)) {
    localDeleteProject(projectId);
    return true;
  }

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
  if (!isCloudProjectId(projectId)) {
    return hasLocalProject(projectId) ? localGetProjectMembers(projectId) : [];
  }

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
  try {
    const res = await fetch(`${BASE}/invitations`, {
      headers: getHeaders(accessToken),
    });
    if (!res.ok) return []; // Edge functions not deployed — silently return empty
    const data = await res.json();
    return data.invitations || [];
  } catch {
    return []; // Network error / edge functions not deployed
  }
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
