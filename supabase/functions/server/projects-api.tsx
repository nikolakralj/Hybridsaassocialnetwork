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

function canInviteRole(inviterRole: ProjectRole | null, inviteeRole: ProjectRole) {
  if (inviterRole === "Owner") return inviteeRole !== "Owner";
  if (inviterRole === "Editor") {
    return inviteeRole === "Contributor" || inviteeRole === "Commenter" || inviteeRole === "Viewer";
  }
  return false;
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

async function getCallerScope(projectId: string, userId: string): Promise<string | null> {
  const { data } = await db()
    .from("wg_project_members")
    .select("scope")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .maybeSingle();
  return typeof data?.scope === "string" && data.scope ? data.scope : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameStringList(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown) => Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").sort()
    : [];
  return stableJson(normalize(left)) === stableJson(normalize(right));
}

function idSet(values: unknown[]): Set<string> {
  return new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0));
}

function projectParties(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as any).parties)) return (value as any).parties;
  return [];
}

function resolveCreatorPartyId(project: any): string | null {
  const graphNodes = Array.isArray(project?.graph?.nodes) ? project.graph.nodes : [];
  const creatorNode = graphNodes.find((node: any) => node?.type === "party" && node?.data?.isCreator === true);
  if (typeof creatorNode?.id === "string" && creatorNode.id) return creatorNode.id;
  const creatorParty = projectParties(project?.parties).find((party: any) => party?.isCreator === true);
  if (typeof creatorParty?.id === "string" && creatorParty.id) return creatorParty.id;
  return null;
}

function nodeOwnerId(node: any): string | null {
  return (
    (typeof node?.data?.partyId === "string" && node.data.partyId) ||
    (typeof node?.data?.orgId === "string" && node.data.orgId) ||
    null
  );
}

function ownedNodeIds(nodes: any[], callerScope: string): Set<string> {
  const owned = new Set<string>([callerScope]);
  for (const node of nodes) {
    if (node?.id && (node?.id === callerScope || nodeOwnerId(node) === callerScope)) {
      owned.add(node.id);
    }
  }
  return owned;
}

function edgeSignature(edge: any): string {
  return stableJson({
    id: edge?.id,
    type: edge?.type,
    source: edge?.source,
    target: edge?.target,
    data: edge?.data || {},
  });
}

function isPartyConnectionEdge(edge: any, partyIds: Set<string>): boolean {
  return (
    partyIds.has(edge?.source) &&
    partyIds.has(edge?.target) &&
    ["billsTo", "bills_to", "subcontracts"].includes(edge?.data?.edgeType || edge?.type)
  );
}

function edgeCanChange(edge: any, callerScope: string, ownedIds: Set<string>, partyIds: Set<string>): boolean {
  if (isPartyConnectionEdge(edge, partyIds)) return edge?.source === callerScope;
  return ownedIds.has(edge?.source) || ownedIds.has(edge?.target);
}

function assertScopedEdgeUpdates(existingProject: any, body: any, callerScope: string) {
  const currentNodes = Array.isArray(existingProject.graph?.nodes) ? existingProject.graph.nodes : [];
  const nextNodes = Array.isArray(body.graph?.nodes) ? body.graph.nodes : [];
  const currentEdges = Array.isArray(existingProject.graph?.edges) ? existingProject.graph.edges : [];
  const nextEdges = Array.isArray(body.graph?.edges) ? body.graph.edges : [];
  const partyIds = idSet([...projectParties(existingProject.parties).map((party: any) => party?.id)]);
  const ownedIds = new Set([...ownedNodeIds(currentNodes, callerScope), ...ownedNodeIds(nextNodes, callerScope)]);
  const currentBySignature = new Map(currentEdges.map((edge: any) => [edgeSignature(edge), edge]));
  const nextBySignature = new Map(nextEdges.map((edge: any) => [edgeSignature(edge), edge]));

  for (const [signature, edge] of currentBySignature) {
    if (!nextBySignature.has(signature) && !edgeCanChange(edge, callerScope, ownedIds, partyIds)) {
      throw new Error("You cannot change another organization's graph connections");
    }
  }

  for (const [signature, edge] of nextBySignature) {
    if (!currentBySignature.has(signature) && !edgeCanChange(edge, callerScope, ownedIds, partyIds)) {
      throw new Error("You cannot change another organization's graph connections");
    }
  }
}

function assertScopedSupplyChainUpdate(existingProject: any, body: any, callerScope: string | null) {
  if (body.graph === undefined && body.parties === undefined) return;
  if (!callerScope) throw new Error("Map your active membership to an organization before editing the supply chain");
  if (!body.graph || !Array.isArray(body.graph.nodes) || !Array.isArray(body.graph.edges) || !Array.isArray(body.parties)) {
    throw new Error("Supply-chain updates require a complete graph and party snapshot");
  }

  const currentById = new Map(projectParties(existingProject.parties).map((party: any) => [party?.id, party]));
  const nextById = new Map(body.parties.map((party: any) => [party?.id, party]));
  if (!currentById.has(callerScope)) throw new Error("Your organization is not part of this project supply chain");
  if (currentById.size !== nextById.size || [...currentById.keys()].some((id) => !nextById.has(id))) {
    throw new Error("Organizations are archived through a governed project workflow, not removed from another party's editor");
  }
  if ([...nextById.keys()].some((id) => !currentById.has(id))) {
    throw new Error("Adding an organization requires a governed project-structure workflow");
  }

  for (const [partyId, currentParty] of currentById) {
    const nextParty = nextById.get(partyId);
    if (partyId === callerScope) {
      if (nextParty?.partyType !== currentParty?.partyType) {
        throw new Error("An organization type cannot be changed after the project is active");
      }
      continue;
    }
    if (
      nextParty?.name !== currentParty?.name ||
      nextParty?.partyType !== currentParty?.partyType ||
      !sameStringList(nextParty?.billsTo, currentParty?.billsTo)
    ) {
      throw new Error("You can only change your own organization and its billing connection");
    }
  }

  const nextNodeById = new Map(body.graph.nodes.map((node: any) => [node?.id, node]));
  const currentNodeIds = new Set((Array.isArray(existingProject.graph?.nodes) ? existingProject.graph.nodes : []).map((node: any) => node?.id));
  for (const node of (Array.isArray(existingProject.graph?.nodes) ? existingProject.graph.nodes : [])) {
    if (node?.type === "party" || node?.data?.partyId === callerScope || node?.data?.orgId === callerScope) continue;
    const nextNode = nextNodeById.get(node?.id);
    if (!nextNode || stableJson(nextNode.data || {}) !== stableJson(node.data || {})) {
      throw new Error("You cannot edit people or records owned by another organization");
    }
  }

  for (const node of body.graph.nodes) {
    if (currentNodeIds.has(node?.id)) continue;
    if (node?.type === "party") throw new Error("Adding an organization requires a governed project-structure workflow");
    if (nodeOwnerId(node) !== callerScope) {
      throw new Error("You can only add people or records owned by your organization");
    }
  }

  assertScopedEdgeUpdates(existingProject, body, callerScope);
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

    const creatorPartyId = resolveCreatorPartyId(projectRow);
    const membersToInsert: any[] = [{
      id: generateId("mem"),
      project_id: projectId,
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      role: "Owner",
      scope: creatorPartyId,
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
      .select("owner_id, graph, parties")
      .eq("id", projectId)
      .single();

    if (pe || !projectRow) return c.json({ error: "Project not found" }, 404);

    const role = await getCallerRole(projectRow.owner_id, projectId, user.id);
    if (role !== "Owner" && role !== "Editor") return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const callerScope = await getCallerScope(projectId, user.id);
    const scopedPartyId = callerScope || (projectRow.owner_id === user.id ? resolveCreatorPartyId(projectRow) : null);
    assertScopedSupplyChainUpdate(projectRow, body, scopedPartyId);
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

    const role = await getCallerRole(projectRow.owner_id, projectId, user.id);
    if (role !== "Owner") return c.json({ error: "Forbidden" }, 403);

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
    const inviteeRole = sanitizeRole(body.role);
    if (!canInviteRole(callerRole, inviteeRole)) {
      return c.json({ error: "Your project role cannot invite members with that role" }, 403);
    }

    if (body.userId) {
      const newMember = {
        id: generateId("mem"),
        project_id: projectId,
        user_id: body.userId,
        user_name: body.userName || body.name || "Member",
        user_email: normalizeEmail(body.userEmail || body.email),
        role: inviteeRole,
        scope: body.scope || null,
        invited_by: user.id,
        invited_at: now,
        accepted_at: now,
        can_approve: false,
        can_view_rates: false,
        can_edit_timesheets: false,
        visible_to_chain: true,
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
      role: inviteeRole,
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
      role: inviteeRole,
      scope: body.scope || null,
      invited_by: user.id,
      invited_at: now,
      accepted_at: null,
      invitation_id: invitationId,
      can_approve: false,
      can_view_rates: false,
      can_edit_timesheets: false,
      visible_to_chain: true,
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
        can_approve: false,
        can_view_rates: false,
        can_edit_timesheets: false,
        visible_to_chain: true,
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
