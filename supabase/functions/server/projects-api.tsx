// Projects API — SQL-backed CRUD (wg_projects, wg_project_members, wg_project_invitations)
// Replaces KV store. All HTTP routes and response shapes are identical to the previous
// KV-backed version so the frontend requires zero changes.
import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

const projectsRouter = new Hono();

type ProjectRole = "Owner" | "Editor" | "Contributor" | "Commenter" | "Viewer";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
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

async function getAuthUser(c: any): Promise<AuthUser | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  try {
    const { data, error } = await db().auth.getUser(token);
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

// DB row → camelCase response shape (matches old KV StoredProject)
function rowToProject(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    region: row.region,
    currency: row.currency,
    startDate: row.start_date,
    endDate: row.end_date ?? null,
    workWeek: row.work_week,
    status: row.status,
    supplyChainStatus: row.supply_chain_status ?? undefined,
    ownerId: row.owner_id,
    graph: row.graph ?? undefined,
    parties: row.parties ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMember(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id ?? `pending:${row.user_email}`,
    userName: row.user_name ?? undefined,
    userEmail: row.user_email ?? undefined,
    role: row.role,
    scope: row.scope ?? undefined,
    invitedBy: row.invited_by ?? undefined,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at ?? null,
    invitationId: row.invitation_id ?? undefined,
    graphNodeId: row.graph_node_id ?? undefined,
    canApprove: row.can_approve ?? false,
    canViewRates: row.can_view_rates ?? true,
    canEditTimesheets: row.can_edit_timesheets ?? true,
    visibleToChain: row.visible_to_chain ?? true,
  };
}

function rowToInvitation(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name ?? undefined,
    email: row.email,
    role: row.role,
    scope: row.scope ?? undefined,
    invitedBy: row.invited_by ?? undefined,
    invitedByName: row.invited_by_name ?? undefined,
    invitedAt: row.invited_at,
    expiresAt: row.expires_at ?? undefined,
    acceptedAt: row.accepted_at ?? undefined,
    declinedAt: row.declined_at ?? undefined,
    acceptedByUserId: row.accepted_by_user_id ?? undefined,
    status: row.status,
  };
}

function canManageMembers(role: ProjectRole | null) {
  return role === "Owner" || role === "Editor";
}

async function getCallerRole(projectOwnerId: string, projectId: string, userId: string): Promise<ProjectRole | null> {
  if (projectOwnerId === userId) return "Owner";
  const { data } = await db()
    .from("wg_project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .maybeSingle();
  return (data?.role as ProjectRole) ?? null;
}

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/projects
// ---------------------------------------------------------------------------
projectsRouter.get("/make-server-f8b491be/api/projects", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { data, error } = await db()
      .from("wg_projects")
      .select("*")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return c.json({ projects: (data || []).map(rowToProject) });
  } catch (err: any) {
    return c.json({ error: `Failed to list projects: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/projects/:projectId
// ---------------------------------------------------------------------------
projectsRouter.get("/make-server-f8b491be/api/projects/:projectId", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const { data: projectRow, error: pe } = await db()
      .from("wg_projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (pe || !projectRow) return c.json({ error: "Project not found" }, 404);

    const role = await getCallerRole(projectRow.owner_id, projectId, user.id);
    if (!role) return c.json({ error: "Forbidden" }, 403);

    const { data: memberRows } = await db()
      .from("wg_project_members")
      .select("*")
      .eq("project_id", projectId);

    return c.json({ project: rowToProject(projectRow), members: (memberRows || []).map(rowToMember) });
  } catch (err: any) {
    return c.json({ error: `Failed to get project: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /make-server-f8b491be/api/projects
// ---------------------------------------------------------------------------
projectsRouter.post("/make-server-f8b491be/api/projects", async (c) => {
  let createdProjectId: string | null = null;
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const projectId = generateId("proj");

    const projectRow = {
      id: projectId,
      name: body.name || "Untitled Project",
      description: body.description || null,
      region: body.region || "EU",
      currency: body.currency || "EUR",
      start_date: body.startDate ? body.startDate.slice(0, 10) : now.slice(0, 10),
      end_date: body.endDate ? body.endDate.slice(0, 10) : null,
      work_week: body.workWeek || { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
      status: body.status === "draft" ? "draft" : "active",
      supply_chain_status: body.supplyChainStatus === "incomplete" ? "incomplete" : "complete",
      owner_id: user.id,
      graph: body.graph || null,
      parties: body.parties || null,
    };

    const client = db();

    const { error: insertError } = await client.from("wg_projects").insert(projectRow);
    if (insertError) throw insertError;
    createdProjectId = projectId;

    const membersToInsert: any[] = [{
      id: generateId("mem"),
      project_id: projectId,
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      role: "Owner",
      scope: null,
      graph_node_id: user.id,
      invitation_id: null,
      can_approve: false,
      can_view_rates: true,
      can_edit_timesheets: true,
      visible_to_chain: true,
      invited_by: user.id,
      invited_at: now,
      accepted_at: now,
    }];
    const invitationsToInsert: any[] = [];

    for (const invitee of (Array.isArray(body.members) ? body.members : [])) {
      if (invitee.userId && invitee.userId !== user.id) {
        membersToInsert.push({
          id: generateId("mem"),
          project_id: projectId,
          user_id: invitee.userId,
          user_name: invitee.userName || invitee.name || "Member",
          user_email: normalizeEmail(invitee.userEmail || invitee.email),
          role: sanitizeRole(invitee.role),
          scope: invitee.scope || null,
          graph_node_id: invitee.graphNodeId || null,
          invitation_id: invitee.invitationId || null,
          can_approve: invitee.canApprove ?? false,
          can_view_rates: invitee.canViewRates ?? true,
          can_edit_timesheets: invitee.canEditTimesheets ?? true,
          visible_to_chain: invitee.visibleToChain ?? true,
          invited_by: user.id,
          invited_at: now,
          accepted_at: now,
        });
        continue;
      }
      const email = normalizeEmail(invitee.userEmail || invitee.email);
      if (!email || email === user.email) continue;

      const invitationId = generateId("inv");
      invitationsToInsert.push({
        id: invitationId,
        project_id: projectId,
        project_name: body.name || "Untitled Project",
        email,
        role: sanitizeRole(invitee.role),
        scope: invitee.scope || null,
        invited_by: user.id,
        invited_by_name: user.name,
        invited_at: now,
        expires_at: invitee.expiresAt || null,
        status: "pending",
      });
      membersToInsert.push({
        id: generateId("mem"),
        project_id: projectId,
        user_id: null,
        user_name: invitee.userName || invitee.name || email,
        user_email: email,
        role: sanitizeRole(invitee.role),
        scope: invitee.scope || null,
        graph_node_id: invitee.graphNodeId || null,
        invited_by: user.id,
        invited_at: now,
        accepted_at: null,
        invitation_id: invitationId,
        can_approve: invitee.canApprove ?? false,
        can_view_rates: invitee.canViewRates ?? true,
        can_edit_timesheets: invitee.canEditTimesheets ?? true,
        visible_to_chain: invitee.visibleToChain ?? true,
      });
    }

    if (invitationsToInsert.length > 0) {
      const { error: ie } = await client.from("wg_project_invitations").insert(invitationsToInsert);
      if (ie) throw ie;
    }
    if (membersToInsert.length > 0) {
      const { error: me } = await client.from("wg_project_members").insert(membersToInsert);
      if (me) throw me;
    }

    const { data: finalProject } = await client.from("wg_projects").select("*").eq("id", projectId).single();
    const { data: finalMembers } = await client.from("wg_project_members").select("*").eq("project_id", projectId);

    return c.json({
      project: rowToProject(finalProject || projectRow),
      members: (finalMembers || membersToInsert).map(rowToMember),
    }, 201);
  } catch (err: any) {
    const message = err?.message || String(err);
    if (createdProjectId) {
      try {
        await db().from("wg_projects").delete().eq("id", createdProjectId);
      } catch {
        // best-effort rollback
      }
    }
    return c.json({ error: `Failed to create project: ${message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// PUT /make-server-f8b491be/api/projects/:projectId
// ---------------------------------------------------------------------------
projectsRouter.put("/make-server-f8b491be/api/projects/:projectId", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const { data: projectRow, error: pe } = await db()
      .from("wg_projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (pe || !projectRow) return c.json({ error: "Project not found" }, 404);

    const role = await getCallerRole(projectRow.owner_id, projectId, user.id);
    if (role !== "Owner" && role !== "Editor") return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.region !== undefined) updateData.region = body.region;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.startDate !== undefined) updateData.start_date = body.startDate.slice(0, 10);
    if (body.endDate !== undefined) updateData.end_date = body.endDate ? body.endDate.slice(0, 10) : null;
    if (body.workWeek !== undefined) updateData.work_week = body.workWeek;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.supplyChainStatus !== undefined) updateData.supply_chain_status = body.supplyChainStatus;
    if (body.graph !== undefined) updateData.graph = body.graph;
    if (body.parties !== undefined) updateData.parties = body.parties;

    const { data: updated, error: ue } = await db()
      .from("wg_projects")
      .update(updateData)
      .eq("id", projectId)
      .select("*")
      .single();

    if (ue) throw ue;
    return c.json({ project: rowToProject(updated) });
  } catch (err: any) {
    return c.json({ error: `Failed to update project: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /make-server-f8b491be/api/projects/:projectId
// ---------------------------------------------------------------------------
projectsRouter.delete("/make-server-f8b491be/api/projects/:projectId", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const { data: projectRow, error: pe } = await db()
      .from("wg_projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (pe || !projectRow) return c.json({ error: "Project not found" }, 404);
    if (projectRow.owner_id !== user.id) return c.json({ error: "Only the project owner can delete" }, 403);

    // ON DELETE CASCADE handles wg_project_members and wg_project_invitations
    const { error: de } = await db().from("wg_projects").delete().eq("id", projectId);
    if (de) throw de;

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: `Failed to delete project: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/projects/:projectId/members
// ---------------------------------------------------------------------------
projectsRouter.get("/make-server-f8b491be/api/projects/:projectId/members", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const { data: projectRow, error: pe } = await db()
      .from("wg_projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (pe || !projectRow) return c.json({ error: "Project not found" }, 404);

    const role = await getCallerRole(projectRow.owner_id, projectId, user.id);
    if (!role) return c.json({ error: "Forbidden" }, 403);

    const { data: rows, error: me } = await db()
      .from("wg_project_members")
      .select("*")
      .eq("project_id", projectId);

    if (me) throw me;
    return c.json({ members: (rows || []).map(rowToMember) });
  } catch (err: any) {
    return c.json({ error: `Failed to list members: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /make-server-f8b491be/api/projects/:projectId/members
// ---------------------------------------------------------------------------
projectsRouter.post("/make-server-f8b491be/api/projects/:projectId/members", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const body = await c.req.json();

    const { data: projectRow, error: pe } = await db()
      .from("wg_projects")
      .select("owner_id, name")
      .eq("id", projectId)
      .single();

    if (pe || !projectRow) return c.json({ error: "Project not found" }, 404);

    const callerRole = await getCallerRole(projectRow.owner_id, projectId, user.id);
    if (!canManageMembers(callerRole)) return c.json({ error: "Forbidden" }, 403);

    const now = new Date().toISOString();

    if (body.userId) {
      const newMember = {
        id: generateId("mem"),
        project_id: projectId,
        user_id: body.userId,
        user_name: body.userName || body.name || "Member",
        user_email: normalizeEmail(body.userEmail || body.email),
        role: sanitizeRole(body.role),
        scope: body.scope || null,
        invited_by: user.id,
        invited_at: now,
        accepted_at: now,
      };
      const { error: ie } = await db().from("wg_project_members").insert(newMember);
      if (ie) throw ie;
      return c.json({ member: rowToMember(newMember) }, 201);
    }

    const email = normalizeEmail(body.userEmail || body.email);
    if (!email || email === user.email) return c.json({ error: "A valid invite email is required" }, 400);

    const invitationId = generateId("inv");
    const invitation = {
      id: invitationId,
      project_id: projectId,
      project_name: projectRow.name,
      email,
      role: sanitizeRole(body.role),
      scope: body.scope || null,
      invited_by: user.id,
      invited_by_name: user.name,
      invited_at: now,
      expires_at: body.expiresAt || null,
      status: "pending",
    };
    const pendingMember = {
      id: generateId("mem"),
      project_id: projectId,
      user_id: null,
      user_name: body.userName || body.name || email,
      user_email: email,
      role: sanitizeRole(body.role),
      scope: body.scope || null,
      invited_by: user.id,
      invited_at: now,
      accepted_at: null,
      invitation_id: invitationId,
    };

    const { error: invErr } = await db().from("wg_project_invitations").insert(invitation);
    if (invErr) throw invErr;
    const { error: memErr } = await db().from("wg_project_members").insert(pendingMember);
    if (memErr) throw memErr;

    return c.json({ member: rowToMember(pendingMember), invitation: rowToInvitation(invitation) }, 201);
  } catch (err: any) {
    return c.json({ error: `Failed to add member: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /make-server-f8b491be/api/projects/:projectId/members/:memberId
// ---------------------------------------------------------------------------
projectsRouter.delete("/make-server-f8b491be/api/projects/:projectId/members/:memberId", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const targetMemberId = c.req.param("memberId");

    const { data: projectRow, error: pe } = await db()
      .from("wg_projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (pe || !projectRow) return c.json({ error: "Project not found" }, 404);

    const callerRole = await getCallerRole(projectRow.owner_id, projectId, user.id);
    if (!canManageMembers(callerRole)) return c.json({ error: "Forbidden" }, 403);

    const { data: targetRow, error: te } = await db()
      .from("wg_project_members")
      .select("*")
      .eq("id", targetMemberId)
      .single();

    if (te || !targetRow) return c.json({ error: "Member not found" }, 404);
    if (targetRow.role === "Owner") return c.json({ error: "The project owner cannot be removed" }, 400);

    if (targetRow.invitation_id) {
      await db().from("wg_project_invitations").delete().eq("id", targetRow.invitation_id);
    }

    const { error: de } = await db().from("wg_project_members").delete().eq("id", targetMemberId);
    if (de) throw de;

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: `Failed to remove member: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/invitations
// ---------------------------------------------------------------------------
projectsRouter.get("/make-server-f8b491be/api/invitations", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { data, error } = await db()
      .from("wg_project_invitations")
      .select("*")
      .eq("email", user.email)
      .eq("status", "pending")
      .is("accepted_at", null)
      .order("invited_at", { ascending: false });

    if (error) throw error;
    return c.json({ invitations: (data || []).map(rowToInvitation) });
  } catch (err: any) {
    return c.json({ error: `Failed to load invitations: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /make-server-f8b491be/api/invitations/:invitationId/accept
// ---------------------------------------------------------------------------
projectsRouter.post("/make-server-f8b491be/api/invitations/:invitationId/accept", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const invitationId = c.req.param("invitationId");
    const { data: invRow, error: ie } = await db()
      .from("wg_project_invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (ie || !invRow) return c.json({ error: "Invitation not found" }, 404);
    if (normalizeEmail(invRow.email) !== user.email) return c.json({ error: "Forbidden" }, 403);
    if (invRow.status !== "pending") return c.json({ error: "Invitation is no longer pending" }, 409);

    const { data: projectRow, error: pe } = await db()
      .from("wg_projects")
      .select("*")
      .eq("id", invRow.project_id)
      .single();

    if (pe || !projectRow) return c.json({ error: "Project not found" }, 404);

    const now = new Date().toISOString();

    // Upgrade pending member row if it exists
    const { data: pendingMember } = await db()
      .from("wg_project_members")
      .select("id")
      .eq("invitation_id", invitationId)
      .maybeSingle();

    if (pendingMember) {
      await db().from("wg_project_members").update({
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        accepted_at: now,
      }).eq("id", pendingMember.id);
    } else {
      await db().from("wg_project_members").insert({
        id: generateId("mem"),
        project_id: invRow.project_id,
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        role: invRow.role,
        scope: invRow.scope,
        invited_by: invRow.invited_by,
        invited_at: invRow.invited_at,
        accepted_at: now,
        invitation_id: invitationId,
      });
    }

    const { data: acceptedInv } = await db()
      .from("wg_project_invitations")
      .update({ status: "accepted", accepted_at: now, accepted_by_user_id: user.id })
      .eq("id", invitationId)
      .select("*")
      .single();

    return c.json({ invitation: rowToInvitation(acceptedInv || invRow), project: rowToProject(projectRow) });
  } catch (err: any) {
    return c.json({ error: `Failed to accept invitation: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /make-server-f8b491be/api/invitations/:invitationId/decline
// ---------------------------------------------------------------------------
projectsRouter.post("/make-server-f8b491be/api/invitations/:invitationId/decline", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const invitationId = c.req.param("invitationId");
    const { data: invRow, error: ie } = await db()
      .from("wg_project_invitations")
      .select("*")
      .eq("id", invitationId)
      .single();

    if (ie || !invRow) return c.json({ error: "Invitation not found" }, 404);
    if (normalizeEmail(invRow.email) !== user.email) return c.json({ error: "Forbidden" }, 403);
    if (invRow.status !== "pending") return c.json({ error: "Invitation is no longer pending" }, 409);

    const now = new Date().toISOString();
    await db().from("wg_project_members").delete().eq("invitation_id", invitationId);

    const { data: declinedInv } = await db()
      .from("wg_project_invitations")
      .update({ status: "declined", declined_at: now })
      .eq("id", invitationId)
      .select("*")
      .single();

    return c.json({ success: true, invitation: rowToInvitation(declinedInv || invRow) });
  } catch (err: any) {
    return c.json({ error: `Failed to decline invitation: ${err.message}` }, 500);
  }
});

export { projectsRouter };
