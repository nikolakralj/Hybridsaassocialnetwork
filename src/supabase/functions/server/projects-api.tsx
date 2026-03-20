import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";

const projectsRouter = new Hono();

type ProjectRole = "Owner" | "Editor" | "Contributor" | "Commenter" | "Viewer";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface StoredProject {
  id: string;
  name: string;
  description: string;
  region: string;
  currency: string;
  startDate: string;
  endDate: string | null;
  workWeek: Record<string, boolean>;
  status: "active" | "archived" | "draft";
  supplyChainStatus?: "complete" | "incomplete";
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  graph?: Record<string, unknown>;
  parties?: unknown[];
}

interface StoredProjectMember {
  id: string;
  projectId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role: ProjectRole;
  scope?: string;
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string | null;
  invitationId?: string;
}

interface StoredProjectInvitation {
  id: string;
  projectId: string;
  projectName?: string;
  email: string;
  role: ProjectRole;
  scope?: string;
  invitedBy: string;
  invitedByName?: string;
  invitedAt: string;
  expiresAt?: string;
  acceptedAt?: string;
  token?: string;
  status: "pending" | "accepted" | "declined";
  declinedAt?: string;
  acceptedByUserId?: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeEmail(email?: string): string {
  return (email || "").trim().toLowerCase();
}

function sanitizeRole(role?: string): ProjectRole {
  if (role === "Owner" || role === "Editor" || role === "Contributor" || role === "Commenter" || role === "Viewer") {
    return role;
  }
  return "Viewer";
}

function invitationKey(invitationId: string) {
  return `project-invitation:${invitationId}`;
}

function emailInvitationIndexKey(email: string) {
  return `project-invitations-by-email:${normalizeEmail(email)}`;
}

function projectInvitationListKey(projectId: string) {
  return `project-invitations:${projectId}`;
}

async function getAuthUser(c: any): Promise<AuthUser | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id || !data.user.email) return null;

    return {
      id: data.user.id,
      email: normalizeEmail(data.user.email),
      name: data.user.user_metadata?.name || data.user.email.split("@")[0] || "User",
    };
  } catch {
    return null;
  }
}

async function addProjectToUserIndex(userId: string, projectId: string) {
  const projectIds: string[] = (await kv.get(`user-projects:${userId}`)) || [];
  if (!projectIds.includes(projectId)) {
    projectIds.push(projectId);
    await kv.set(`user-projects:${userId}`, projectIds);
  }
}

async function removeProjectFromUserIndex(userId: string, projectId: string) {
  const projectIds: string[] = (await kv.get(`user-projects:${userId}`)) || [];
  await kv.set(
    `user-projects:${userId}`,
    projectIds.filter((id) => id !== projectId)
  );
}

async function addInvitationToEmailIndex(email: string, invitationId: string) {
  const key = emailInvitationIndexKey(email);
  const invitationIds: string[] = (await kv.get(key)) || [];
  if (!invitationIds.includes(invitationId)) {
    invitationIds.push(invitationId);
    await kv.set(key, invitationIds);
  }
}

async function removeInvitationFromEmailIndex(email: string, invitationId: string) {
  const key = emailInvitationIndexKey(email);
  const invitationIds: string[] = (await kv.get(key)) || [];
  await kv.set(
    key,
    invitationIds.filter((id) => id !== invitationId)
  );
}

async function addInvitationToProjectIndex(projectId: string, invitationId: string) {
  const key = projectInvitationListKey(projectId);
  const invitationIds: string[] = (await kv.get(key)) || [];
  if (!invitationIds.includes(invitationId)) {
    invitationIds.push(invitationId);
    await kv.set(key, invitationIds);
  }
}

async function getProjectState(projectId: string) {
  const project = await kv.get(`project:${projectId}`);
  const members: StoredProjectMember[] = (await kv.get(`project-members:${projectId}`)) || [];
  return { project: project as StoredProject | null, members };
}

function getAcceptedMember(members: StoredProjectMember[], userId: string) {
  return members.find((member) => member.userId === userId && !!member.acceptedAt);
}

function getProjectRole(project: StoredProject, members: StoredProjectMember[], userId: string): ProjectRole | null {
  if (project.ownerId === userId) return "Owner";
  return getAcceptedMember(members, userId)?.role || null;
}

function canManageMembers(role: ProjectRole | null) {
  return role === "Owner" || role === "Editor";
}

async function createPendingInvitation(
  project: StoredProject,
  projectId: string,
  invitee: any,
  inviter: AuthUser,
  now: string
) {
  const email = normalizeEmail(invitee.userEmail || invitee.email);
  if (!email || email === inviter.email) return null;

  const invitationId = generateId("inv");
  const invitation: StoredProjectInvitation = {
    id: invitationId,
    projectId,
    projectName: project.name,
    email,
    role: sanitizeRole(invitee.role),
    scope: invitee.scope,
    invitedBy: inviter.id,
    invitedByName: inviter.name,
    invitedAt: now,
    expiresAt: invitee.expiresAt,
    token: invitationId,
    status: "pending",
  };

  const member: StoredProjectMember = {
    id: generateId("mem"),
    projectId,
    userId: `pending:${email}`,
    userName: invitee.userName || invitee.name || email,
    userEmail: email,
    role: invitation.role,
    scope: invitee.scope,
    invitedBy: inviter.id,
    invitedAt: now,
    acceptedAt: null,
    invitationId,
  };

  await kv.set(invitationKey(invitationId), invitation);
  await addInvitationToEmailIndex(email, invitationId);
  await addInvitationToProjectIndex(projectId, invitationId);

  return { invitation, member };
}

projectsRouter.get("/make-server-f8b491be/api/projects", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectIds: string[] = (await kv.get(`user-projects:${user.id}`)) || [];
    if (projectIds.length === 0) {
      return c.json({ projects: [] });
    }

    const projects = await kv.mget(...projectIds.map((projectId) => `project:${projectId}`));
    const validProjects = projects.filter(Boolean).sort((a: any, b: any) => {
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

    return c.json({ projects: validProjects });
  } catch (err: any) {
    return c.json({ error: `Failed to list projects: ${err.message}` }, 500);
  }
});

projectsRouter.get("/make-server-f8b491be/api/projects/:projectId", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const { project, members } = await getProjectState(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const role = getProjectRole(project, members, user.id);
    if (!role) return c.json({ error: "Forbidden" }, 403);

    return c.json({ project, members });
  } catch (err: any) {
    return c.json({ error: `Failed to get project: ${err.message}` }, 500);
  }
});

projectsRouter.post("/make-server-f8b491be/api/projects", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const projectId = generateId("proj");
    const status = body.status === "draft" ? "draft" : "active";
    const supplyChainStatus = body.supplyChainStatus === "incomplete" ? "incomplete" : "complete";

    const project: StoredProject = {
      id: projectId,
      name: body.name || "Untitled Project",
      description: body.description || "",
      region: body.region || "US",
      currency: body.currency || "USD",
      startDate: body.startDate || now,
      endDate: body.endDate || null,
      workWeek: body.workWeek || {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      },
      status,
      supplyChainStatus,
      ownerId: user.id,
      createdAt: now,
      updatedAt: now,
      graph: body.graph,
      parties: body.parties,
    };

    const ownerMember: StoredProjectMember = {
      id: generateId("mem"),
      projectId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: "Owner",
      invitedBy: user.id,
      invitedAt: now,
      acceptedAt: now,
    };

    const members: StoredProjectMember[] = [ownerMember];
    const inviteInputs = Array.isArray(body.members) ? body.members : [];

    for (const invitee of inviteInputs) {
      if (invitee.userId && invitee.userId !== user.id) {
        const directMember: StoredProjectMember = {
          id: generateId("mem"),
          projectId,
          userId: invitee.userId,
          userName: invitee.userName || invitee.name || "Member",
          userEmail: normalizeEmail(invitee.userEmail || invitee.email),
          role: sanitizeRole(invitee.role),
          scope: invitee.scope,
          invitedBy: user.id,
          invitedAt: now,
          acceptedAt: now,
        };
        members.push(directMember);
        await addProjectToUserIndex(invitee.userId, projectId);
        continue;
      }

      const pendingInvite = await createPendingInvitation(project, projectId, invitee, user, now);
      if (pendingInvite) {
        members.push(pendingInvite.member);
      }
    }

    await kv.set(`project:${projectId}`, project);
    await kv.set(`project-members:${projectId}`, members);
    await addProjectToUserIndex(user.id, projectId);

    return c.json({ project, members }, 201);
  } catch (err: any) {
    return c.json({ error: `Failed to create project: ${err.message}` }, 500);
  }
});

projectsRouter.put("/make-server-f8b491be/api/projects/:projectId", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const { project, members } = await getProjectState(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const role = getProjectRole(project, members, user.id);
    if (!role || (role !== "Owner" && role !== "Editor")) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const body = await c.req.json();
    const updated: StoredProject = {
      ...project,
      ...body,
      id: projectId,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`project:${projectId}`, updated);
    return c.json({ project: updated });
  } catch (err: any) {
    return c.json({ error: `Failed to update project: ${err.message}` }, 500);
  }
});

projectsRouter.delete("/make-server-f8b491be/api/projects/:projectId", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const { project, members } = await getProjectState(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);
    if (project.ownerId !== user.id) {
      return c.json({ error: "Only the project owner can delete" }, 403);
    }

    for (const member of members) {
      if (member.acceptedAt && member.userId && !member.userId.startsWith("pending:")) {
        await removeProjectFromUserIndex(member.userId, projectId);
      }
    }

    const invitationIds: string[] = (await kv.get(projectInvitationListKey(projectId))) || [];
    if (invitationIds.length > 0) {
      const invitations = await kv.mget(...invitationIds.map((invitationId) => invitationKey(invitationId)));
      for (const invitation of invitations as StoredProjectInvitation[]) {
        if (!invitation) continue;
        await removeInvitationFromEmailIndex(invitation.email, invitation.id);
        await kv.del(invitationKey(invitation.id));
      }
    }

    await kv.del(projectInvitationListKey(projectId));
    await kv.del(`project:${projectId}`);
    await kv.del(`project-members:${projectId}`);

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: `Failed to delete project: ${err.message}` }, 500);
  }
});

projectsRouter.get("/make-server-f8b491be/api/projects/:projectId/members", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const { project, members } = await getProjectState(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const role = getProjectRole(project, members, user.id);
    if (!role) return c.json({ error: "Forbidden" }, 403);

    return c.json({ members });
  } catch (err: any) {
    return c.json({ error: `Failed to list members: ${err.message}` }, 500);
  }
});

projectsRouter.post("/make-server-f8b491be/api/projects/:projectId/members", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const body = await c.req.json();
    const { project, members } = await getProjectState(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const role = getProjectRole(project, members, user.id);
    if (!canManageMembers(role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const now = new Date().toISOString();

    if (body.userId) {
      const directMember: StoredProjectMember = {
        id: generateId("mem"),
        projectId,
        userId: body.userId,
        userName: body.userName || body.name || "Member",
        userEmail: normalizeEmail(body.userEmail || body.email),
        role: sanitizeRole(body.role),
        scope: body.scope,
        invitedBy: user.id,
        invitedAt: now,
        acceptedAt: now,
      };

      members.push(directMember);
      await kv.set(`project-members:${projectId}`, members);
      await addProjectToUserIndex(body.userId, projectId);
      return c.json({ member: directMember }, 201);
    }

    const pendingInvite = await createPendingInvitation(project, projectId, body, user, now);
    if (!pendingInvite) {
      return c.json({ error: "A valid invite email is required" }, 400);
    }

    members.push(pendingInvite.member);
    await kv.set(`project-members:${projectId}`, members);
    return c.json({ member: pendingInvite.member, invitation: pendingInvite.invitation }, 201);
  } catch (err: any) {
    return c.json({ error: `Failed to add member: ${err.message}` }, 500);
  }
});

projectsRouter.delete("/make-server-f8b491be/api/projects/:projectId/members/:memberId", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const targetMemberId = c.req.param("memberId");
    const { project, members } = await getProjectState(projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const role = getProjectRole(project, members, user.id);
    if (!canManageMembers(role)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const targetMember = members.find((member) => member.id === targetMemberId);
    if (!targetMember) return c.json({ error: "Member not found" }, 404);
    if (targetMember.role === "Owner") {
      return c.json({ error: "The project owner cannot be removed" }, 400);
    }

    const filteredMembers = members.filter((member) => member.id !== targetMemberId);
    await kv.set(`project-members:${projectId}`, filteredMembers);

    if (targetMember.acceptedAt && targetMember.userId && !targetMember.userId.startsWith("pending:")) {
      await removeProjectFromUserIndex(targetMember.userId, projectId);
    }

    if (targetMember.invitationId) {
      const invitation = await kv.get(invitationKey(targetMember.invitationId));
      if (invitation) {
        await removeInvitationFromEmailIndex((invitation as StoredProjectInvitation).email, targetMember.invitationId);
        await kv.del(invitationKey(targetMember.invitationId));
      }
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: `Failed to remove member: ${err.message}` }, 500);
  }
});

projectsRouter.get("/make-server-f8b491be/api/invitations", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const invitationIds: string[] = (await kv.get(emailInvitationIndexKey(user.email))) || [];
    if (invitationIds.length === 0) {
      return c.json({ invitations: [] });
    }

    const invitations = await kv.mget(...invitationIds.map((invitationId) => invitationKey(invitationId)));
    const pendingInvitations = (invitations as StoredProjectInvitation[])
      .filter((invitation) => invitation && invitation.status === "pending" && !invitation.acceptedAt)
      .sort((a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime());

    return c.json({ invitations: pendingInvitations });
  } catch (err: any) {
    return c.json({ error: `Failed to load invitations: ${err.message}` }, 500);
  }
});

projectsRouter.post("/make-server-f8b491be/api/invitations/:invitationId/accept", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const invitationId = c.req.param("invitationId");
    const invitation = await kv.get(invitationKey(invitationId)) as StoredProjectInvitation | null;
    if (!invitation) return c.json({ error: "Invitation not found" }, 404);
    if (normalizeEmail(invitation.email) !== user.email) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (invitation.status !== "pending") {
      return c.json({ error: "Invitation is no longer pending" }, 409);
    }

    const { project, members } = await getProjectState(invitation.projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const now = new Date().toISOString();
    const existingMemberIndex = members.findIndex((member) => member.invitationId === invitationId);

    if (existingMemberIndex >= 0) {
      members[existingMemberIndex] = {
        ...members[existingMemberIndex],
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        acceptedAt: now,
      };
    } else if (!getAcceptedMember(members, user.id)) {
      members.push({
        id: generateId("mem"),
        projectId: invitation.projectId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        role: invitation.role,
        scope: invitation.scope,
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.invitedAt,
        acceptedAt: now,
        invitationId,
      });
    }

    const acceptedInvitation: StoredProjectInvitation = {
      ...invitation,
      status: "accepted",
      acceptedAt: now,
      acceptedByUserId: user.id,
    };

    await kv.set(`project-members:${invitation.projectId}`, members);
    await kv.set(invitationKey(invitationId), acceptedInvitation);
    await addProjectToUserIndex(user.id, invitation.projectId);

    return c.json({ invitation: acceptedInvitation, project });
  } catch (err: any) {
    return c.json({ error: `Failed to accept invitation: ${err.message}` }, 500);
  }
});

projectsRouter.post("/make-server-f8b491be/api/invitations/:invitationId/decline", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const invitationId = c.req.param("invitationId");
    const invitation = await kv.get(invitationKey(invitationId)) as StoredProjectInvitation | null;
    if (!invitation) return c.json({ error: "Invitation not found" }, 404);
    if (normalizeEmail(invitation.email) !== user.email) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (invitation.status !== "pending") {
      return c.json({ error: "Invitation is no longer pending" }, 409);
    }

    const members: StoredProjectMember[] = (await kv.get(`project-members:${invitation.projectId}`)) || [];
    const filteredMembers = members.filter((member) => member.invitationId !== invitationId);
    const declinedInvitation: StoredProjectInvitation = {
      ...invitation,
      status: "declined",
      declinedAt: new Date().toISOString(),
    };

    await kv.set(`project-members:${invitation.projectId}`, filteredMembers);
    await kv.set(invitationKey(invitationId), declinedInvitation);

    return c.json({ success: true, invitation: declinedInvitation });
  } catch (err: any) {
    return c.json({ error: `Failed to decline invitation: ${err.message}` }, 500);
  }
});

export { projectsRouter };
