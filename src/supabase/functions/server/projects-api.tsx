// Phase 1: Projects API — KV-backed CRUD
// KV Schema:
//   project:{projectId}         → Project JSON
//   user-projects:{userId}      → string[] of projectIds
//   project-members:{projectId} → ProjectMember[] array

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";

const projectsRouter = new Hono();

// ---------- Helpers ----------

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function memberId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function getUserId(c: any): Promise<string | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// ---------- LIST user's projects ----------
// GET /make-server-f8b491be/api/projects
projectsRouter.get("/make-server-f8b491be/api/projects", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    // Get user's project IDs
    const projectIds: string[] = (await kv.get(`user-projects:${userId}`)) || [];

    if (projectIds.length === 0) {
      return c.json({ projects: [] });
    }

    // Fetch each project
    const keys = projectIds.map((id) => `project:${id}`);
    const projects = await kv.mget(...keys);

    // Filter out nulls (deleted projects)
    const validProjects = projects.filter(Boolean);

    return c.json({ projects: validProjects });
  } catch (err: any) {
    console.log(`Projects list error: ${err.message}`);
    return c.json({ error: `Failed to list projects: ${err.message}` }, 500);
  }
});

// ---------- GET single project ----------
// GET /make-server-f8b491be/api/projects/:projectId
projectsRouter.get("/make-server-f8b491be/api/projects/:projectId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const project = await kv.get(`project:${projectId}`);
    if (!project) return c.json({ error: "Project not found" }, 404);

    // Also get members
    const members = (await kv.get(`project-members:${projectId}`)) || [];

    return c.json({ project, members });
  } catch (err: any) {
    console.log(`Project get error: ${err.message}`);
    return c.json({ error: `Failed to get project: ${err.message}` }, 500);
  }
});

// ---------- CREATE project ----------
// POST /make-server-f8b491be/api/projects
projectsRouter.post("/make-server-f8b491be/api/projects", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const projectId = generateId();

    const project = {
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
      status: "active",
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    };

    // Owner is first member
    const ownerMember = {
      id: memberId(),
      projectId,
      userId,
      userName: body.ownerName || "Project Owner",
      userEmail: body.ownerEmail || "",
      role: "Owner",
      invitedBy: userId,
      invitedAt: now,
      acceptedAt: now,
    };

    // Additional members from wizard
    const additionalMembers = (body.members || []).map((m: any) => ({
      id: memberId(),
      projectId,
      userId: m.userId || `invited_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userName: m.userName || m.name || "Unknown",
      userEmail: m.userEmail || m.email || "",
      role: m.role || "Viewer",
      invitedBy: userId,
      invitedAt: now,
      acceptedAt: null,
    }));

    const allMembers = [ownerMember, ...additionalMembers];

    // Store project + members + update user index
    await kv.set(`project:${projectId}`, project);
    await kv.set(`project-members:${projectId}`, allMembers);

    // Add to user's project list
    const userProjects: string[] = (await kv.get(`user-projects:${userId}`)) || [];
    userProjects.push(projectId);
    await kv.set(`user-projects:${userId}`, userProjects);

    // Also add invited members to their project lists
    for (const m of additionalMembers) {
      if (m.userId && !m.userId.startsWith("invited_")) {
        const mProjects: string[] = (await kv.get(`user-projects:${m.userId}`)) || [];
        mProjects.push(projectId);
        await kv.set(`user-projects:${m.userId}`, mProjects);
      }
    }

    console.log(`Project created: ${projectId} by ${userId}`);
    return c.json({ project, members: allMembers }, 201);
  } catch (err: any) {
    console.log(`Project create error: ${err.message}`);
    return c.json({ error: `Failed to create project: ${err.message}` }, 500);
  }
});

// ---------- UPDATE project ----------
// PUT /make-server-f8b491be/api/projects/:projectId
projectsRouter.put("/make-server-f8b491be/api/projects/:projectId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const existing = await kv.get(`project:${projectId}`);
    if (!existing) return c.json({ error: "Project not found" }, 404);

    const body = await c.req.json();
    const updated = {
      ...existing,
      ...body,
      id: projectId, // prevent ID override
      ownerId: existing.ownerId, // prevent owner override
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`project:${projectId}`, updated);
    console.log(`Project updated: ${projectId}`);
    return c.json({ project: updated });
  } catch (err: any) {
    console.log(`Project update error: ${err.message}`);
    return c.json({ error: `Failed to update project: ${err.message}` }, 500);
  }
});

// ---------- DELETE project ----------
// DELETE /make-server-f8b491be/api/projects/:projectId
projectsRouter.delete("/make-server-f8b491be/api/projects/:projectId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const existing = await kv.get(`project:${projectId}`);
    if (!existing) return c.json({ error: "Project not found" }, 404);

    // Only owner can delete
    if (existing.ownerId !== userId) {
      return c.json({ error: "Only the project owner can delete" }, 403);
    }

    // Remove from all members' project lists
    const members: any[] = (await kv.get(`project-members:${projectId}`)) || [];
    for (const m of members) {
      if (m.userId) {
        const mProjects: string[] = (await kv.get(`user-projects:${m.userId}`)) || [];
        const filtered = mProjects.filter((id) => id !== projectId);
        await kv.set(`user-projects:${m.userId}`, filtered);
      }
    }

    // Delete project + members
    await kv.del(`project:${projectId}`);
    await kv.del(`project-members:${projectId}`);

    console.log(`Project deleted: ${projectId}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`Project delete error: ${err.message}`);
    return c.json({ error: `Failed to delete project: ${err.message}` }, 500);
  }
});

// ---------- GET project members ----------
// GET /make-server-f8b491be/api/projects/:projectId/members
projectsRouter.get("/make-server-f8b491be/api/projects/:projectId/members", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const members = (await kv.get(`project-members:${projectId}`)) || [];
    return c.json({ members });
  } catch (err: any) {
    console.log(`Members list error: ${err.message}`);
    return c.json({ error: `Failed to list members: ${err.message}` }, 500);
  }
});

// ---------- ADD member to project ----------
// POST /make-server-f8b491be/api/projects/:projectId/members
projectsRouter.post("/make-server-f8b491be/api/projects/:projectId/members", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const body = await c.req.json();
    const now = new Date().toISOString();

    const newMember = {
      id: memberId(),
      projectId,
      userId: body.userId || `invited_${Date.now()}`,
      userName: body.userName || "Unknown",
      userEmail: body.userEmail || "",
      role: body.role || "Viewer",
      invitedBy: userId,
      invitedAt: now,
      acceptedAt: null,
    };

    const members: any[] = (await kv.get(`project-members:${projectId}`)) || [];
    members.push(newMember);
    await kv.set(`project-members:${projectId}`, members);

    // Add to invited user's project list
    if (body.userId && !body.userId.startsWith("invited_")) {
      const mProjects: string[] = (await kv.get(`user-projects:${body.userId}`)) || [];
      if (!mProjects.includes(projectId)) {
        mProjects.push(projectId);
        await kv.set(`user-projects:${body.userId}`, mProjects);
      }
    }

    console.log(`Member added to ${projectId}: ${newMember.userName}`);
    return c.json({ member: newMember }, 201);
  } catch (err: any) {
    console.log(`Add member error: ${err.message}`);
    return c.json({ error: `Failed to add member: ${err.message}` }, 500);
  }
});

// ---------- REMOVE member from project ----------
// DELETE /make-server-f8b491be/api/projects/:projectId/members/:memberId
projectsRouter.delete("/make-server-f8b491be/api/projects/:projectId/members/:memberId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const targetMemberId = c.req.param("memberId");

    const members: any[] = (await kv.get(`project-members:${projectId}`)) || [];
    const target = members.find((m) => m.id === targetMemberId);
    if (!target) return c.json({ error: "Member not found" }, 404);

    const filtered = members.filter((m) => m.id !== targetMemberId);
    await kv.set(`project-members:${projectId}`, filtered);

    // Remove from user's project list
    if (target.userId) {
      const mProjects: string[] = (await kv.get(`user-projects:${target.userId}`)) || [];
      await kv.set(`user-projects:${target.userId}`, mProjects.filter((id) => id !== projectId));
    }

    console.log(`Member removed from ${projectId}: ${target.userName}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`Remove member error: ${err.message}`);
    return c.json({ error: `Failed to remove member: ${err.message}` }, 500);
  }
});

export { projectsRouter };
