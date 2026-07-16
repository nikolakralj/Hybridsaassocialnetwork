// Contracts API — SQL-backed CRUD (wg_contracts)
// Replaces KV store. All HTTP routes and response shapes are identical to the
// previous KV-backed version so the frontend requires zero changes.
import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

const contractsRouter = new Hono();

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function generateId(): string {
  return `ctr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

const CONTRACT_READ_ROLES = new Set(["org_admin", "org_finance", "org_manager"]);
const CONTRACT_RATE_ROLES = new Set(["org_admin", "org_finance", "org_manager"]);
const CONTRACT_MANAGE_ROLES = new Set(["org_admin", "org_finance"]);

async function getUserId(c: any): Promise<string | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  try {
    const { data, error } = await db().auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// DB row → contract shape (matches old KV response)
// Dedicated columns are authoritative; data JSONB carries the richer fields.
function rowToContract(row: any, options: { canViewRates?: boolean } = {}) {
  const extra = row.data || {};
  const canViewRates = options.canViewRates !== false;
  const baseRate = canViewRates ? (extra.baseHourlyRate ?? Number(row.rate) ?? 0) : 0;
  return {
    id: row.id,
    projectId: row.project_id ?? extra.projectId ?? null,
    // Parties
    providerId: extra.providerId ?? row.owner_id,
    providerType: extra.providerType ?? "individual",
    providerName: extra.providerName ?? "Provider",
    recipientId: extra.recipientId ?? "",
    recipientType: extra.recipientType ?? "company",
    recipientName: extra.recipientName ?? row.client_name ?? "Client",
    // Financial
    baseHourlyRate: baseRate,
    workTypeRates: canViewRates
      ? (extra.workTypeRates ?? {
          regular: baseRate,
          travel: Math.round(baseRate * 0.5),
          overtime: Math.round(baseRate * 1.5),
          oncall: Math.round(baseRate * 0.75),
        })
      : {},
    contractNumber: extra.contractNumber ?? `CTR-${row.id.slice(-6)}`,
    currency: row.currency ?? extra.currency ?? "EUR",
    billingCycle: extra.billingCycle ?? "monthly",
    status: row.status,
    effectiveDate: row.start_date ?? extra.effectiveDate ?? null,
    expirationDate: row.end_date ?? extra.expirationDate ?? null,
    // Visibility
    hideRateFromProvider: !canViewRates || Boolean(extra.hideRateFromProvider),
    hideRateFromRecipient: !canViewRates || Boolean(extra.hideRateFromRecipient),
    ratesRestricted: !canViewRates,
    // Meta
    title: row.title,
    description: row.description ?? null,
    createdBy: extra.createdBy ?? row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hasAllowedRole(role: unknown, allowedRoles: Set<string>): boolean {
  return allowedRoles.has(normalizeString(role));
}

async function getProjectAccess(projectId: string, userId: string) {
  const { data: project, error: projectError } = await db()
    .from("wg_projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!project) {
    return {
      project: null,
      isOwner: false,
      isMember: false,
      role: "",
      canManageContracts: false,
    };
  }

  if (project.owner_id === userId) {
    return {
      project,
      isOwner: true,
      isMember: true,
      role: "Owner",
      canManageContracts: true,
    };
  }

  const { data: member, error: memberError } = await db()
    .from("wg_project_members")
    .select("id, role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (memberError) throw memberError;
  const role = normalizeString(member?.role);

  return {
    project,
    isOwner: false,
    isMember: Boolean(member),
    role,
    canManageContracts: role === "Owner" || role === "Editor",
  };
}

async function getVerifiedOrgRole(organizationId: string, userId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("wg_organization_members")
    .select("org_role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("membership_state", "verified")
    .maybeSingle();

  if (error) throw error;
  return data?.org_role ?? null;
}

async function getProjectOrganizationsForParty(
  projectId: string | null,
  partyGraphNodeId: string | null
): Promise<string[]> {
  if (!projectId || !partyGraphNodeId) return [];

  const { data, error } = await db()
    .from("wg_project_organizations")
    .select("organization_id")
    .eq("project_id", projectId)
    .eq("graph_node_id", partyGraphNodeId)
    .eq("status", "active");

  if (error) throw error;
  return (data || [])
    .map((row: any) => row.organization_id)
    .filter((organizationId: unknown): organizationId is string => typeof organizationId === "string" && organizationId.length > 0);
}

async function getContractSignatoryAccess(contract: any, userId: string) {
  if (!contract) {
    return { canRead: false, canManage: false, canViewRates: false };
  }

  if (contract.owner_id === userId) {
    return { canRead: true, canManage: true, canViewRates: true };
  }

  const { data: signatories, error } = await db()
    .from("wg_contract_signatories")
    .select("organization_id, party_graph_node_id")
    .eq("contract_id", contract.id);

  if (error) throw error;

  let canRead = false;
  let canManage = false;
  let canViewRates = false;
  const checkedOrganizations = new Set<string>();

  for (const signatory of signatories || []) {
    const organizationIds = new Set<string>();
    if (typeof signatory.organization_id === "string" && signatory.organization_id) {
      organizationIds.add(signatory.organization_id);
    }

    const mappedOrganizations = await getProjectOrganizationsForParty(
      contract.project_id,
      typeof signatory.party_graph_node_id === "string" ? signatory.party_graph_node_id : null
    );
    mappedOrganizations.forEach((organizationId) => organizationIds.add(organizationId));

    for (const organizationId of organizationIds) {
      if (checkedOrganizations.has(organizationId)) continue;
      checkedOrganizations.add(organizationId);

      const role = await getVerifiedOrgRole(organizationId, userId);
      if (!role) continue;

      canRead = canRead || hasAllowedRole(role, CONTRACT_READ_ROLES);
      canViewRates = canViewRates || hasAllowedRole(role, CONTRACT_RATE_ROLES);
      canManage = canManage || hasAllowedRole(role, CONTRACT_MANAGE_ROLES);
    }
  }

  return { canRead, canManage, canViewRates };
}

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/contracts
// ---------------------------------------------------------------------------
contractsRouter.get("/make-server-f8b491be/api/contracts", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const { data, error } = await db()
      .from("wg_contracts")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return c.json({ contracts: (data || []).map(rowToContract) });
  } catch (err: any) {
    console.log(`Contracts list error: ${err.message}`);
    return c.json({ error: `Failed to list contracts: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/projects/:projectId/contracts
// ---------------------------------------------------------------------------
contractsRouter.get("/make-server-f8b491be/api/projects/:projectId/contracts", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const projectAccess = await getProjectAccess(projectId, userId);
    if (!projectAccess.project) return c.json({ error: "Project not found" }, 404);

    const { data, error } = await db()
      .from("wg_contracts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const visibleContracts = [];
    for (const row of data || []) {
      const access = await getContractSignatoryAccess(row, userId);
      if (access.canRead) {
        visibleContracts.push(rowToContract(row, { canViewRates: access.canViewRates }));
      }
    }

    return c.json({ contracts: visibleContracts });
  } catch (err: any) {
    console.log(`Project contracts error: ${err.message}`);
    return c.json({ error: `Failed to list project contracts: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/contracts/:contractId
// ---------------------------------------------------------------------------
contractsRouter.get("/make-server-f8b491be/api/contracts/:contractId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const contractId = c.req.param("contractId");
    const { data, error } = await db()
      .from("wg_contracts")
      .select("*")
      .eq("id", contractId)
      .single();

    if (error || !data) return c.json({ error: "Contract not found" }, 404);
    const access = await getContractSignatoryAccess(data, userId);
    if (!access.canRead) return c.json({ error: "Forbidden" }, 403);

    return c.json({ contract: rowToContract(data, { canViewRates: access.canViewRates }) });
  } catch (err: any) {
    console.log(`Contract get error: ${err.message}`);
    return c.json({ error: `Failed to get contract: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /make-server-f8b491be/api/contracts
// ---------------------------------------------------------------------------
contractsRouter.post("/make-server-f8b491be/api/contracts", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const contractId = generateId();
    const baseRate = body.baseHourlyRate || 0;
    const projectId = normalizeString(body.projectId) || null;

    if (projectId) {
      const access = await getProjectAccess(projectId, userId);
      if (!access.project) return c.json({ error: "Project not found" }, 404);
      if (!access.canManageContracts) {
        return c.json({ error: "Only project owners/editors can create contracts until company finance roles are wired." }, 403);
      }
    }

    // Rich fields that don't have dedicated columns go in data blob
    const contractData = {
      providerId: body.providerId || userId,
      providerType: body.providerType || "individual",
      providerName: body.providerName || "Provider",
      recipientId: body.recipientId || "",
      recipientType: body.recipientType || "company",
      recipientName: body.recipientName || "Client",
      baseHourlyRate: baseRate,
      workTypeRates: body.workTypeRates || {
        regular: baseRate,
        travel: Math.round(baseRate * 0.5),
        overtime: Math.round(baseRate * 1.5),
        oncall: Math.round(baseRate * 0.75),
      },
      contractNumber: body.contractNumber || `CTR-${Date.now().toString().slice(-6)}`,
      billingCycle: body.billingCycle || "monthly",
      hideRateFromProvider: body.hideRateFromProvider || false,
      hideRateFromRecipient: body.hideRateFromRecipient || false,
      createdBy: userId,
    };

    const row = {
      id: contractId,
      project_id: projectId,
      owner_id: userId,
      title: body.title || body.contractNumber || `Contract ${contractId.slice(-6)}`,
      client_name: body.recipientName || null,
      client_email: body.recipientEmail || null,
      status: body.status || "active",
      rate: baseRate,
      rate_type: body.billingCycle === "fixed" ? "fixed" : "hourly",
      currency: body.currency || "EUR",
      start_date: body.effectiveDate ? body.effectiveDate.slice(0, 10) : now.slice(0, 10),
      end_date: body.expirationDate ? body.expirationDate.slice(0, 10) : null,
      description: body.description || null,
      data: contractData,
    };

    const { data, error } = await db()
      .from("wg_contracts")
      .insert(row)
      .select("*")
      .single();

    if (error) throw error;
    console.log(`Contract created: ${contractId} by ${userId}`);
    return c.json({ contract: rowToContract(data) }, 201);
  } catch (err: any) {
    console.log(`Contract create error: ${err.message}`);
    return c.json({ error: `Failed to create contract: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// PUT /make-server-f8b491be/api/contracts/:contractId
// ---------------------------------------------------------------------------
contractsRouter.put("/make-server-f8b491be/api/contracts/:contractId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const contractId = c.req.param("contractId");
    const { data: existing, error: fe } = await db()
      .from("wg_contracts")
      .select("*")
      .eq("id", contractId)
      .single();

    if (fe || !existing) return c.json({ error: "Contract not found" }, 404);
    const access = await getContractSignatoryAccess(existing, userId);
    if (!access.canManage) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    if (
      !access.canViewRates
      && (
        body.baseHourlyRate !== undefined
        || body.workTypeRates !== undefined
        || body.currency !== undefined
        || body.billingCycle !== undefined
      )
    ) {
      return c.json({ error: "Forbidden: rate terms require finance/admin access." }, 403);
    }

    if (body.projectId !== undefined) {
      const nextProjectId = normalizeString(body.projectId);
      if (!nextProjectId) return c.json({ error: "Clearing a contract project is not supported." }, 400);

      const projectAccess = await getProjectAccess(nextProjectId, userId);
      if (!projectAccess.project) return c.json({ error: "Project not found" }, 404);
      if (!projectAccess.canManageContracts) return c.json({ error: "Forbidden" }, 403);
    }

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.recipientName !== undefined) updateData.client_name = body.recipientName;
    if (body.recipientEmail !== undefined) updateData.client_email = body.recipientEmail;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.baseHourlyRate !== undefined) updateData.rate = body.baseHourlyRate;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.effectiveDate !== undefined) updateData.start_date = body.effectiveDate.slice(0, 10);
    if (body.expirationDate !== undefined) updateData.end_date = body.expirationDate ? body.expirationDate.slice(0, 10) : null;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.projectId !== undefined) updateData.project_id = normalizeString(body.projectId);

    // Merge all body fields into the data blob (preserves unknown fields)
    const { id: _id, createdAt: _ca, createdBy: _cb, ...bodyRest } = body;
    updateData.data = { ...(existing.data || {}), ...bodyRest };

    const { data: updated, error: ue } = await db()
      .from("wg_contracts")
      .update(updateData)
      .eq("id", contractId)
      .select("*")
      .single();

    if (ue) throw ue;
    console.log(`Contract updated: ${contractId}`);
    return c.json({ contract: rowToContract(updated, { canViewRates: access.canViewRates }) });
  } catch (err: any) {
    console.log(`Contract update error: ${err.message}`);
    return c.json({ error: `Failed to update contract: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /make-server-f8b491be/api/contracts/:contractId
// ---------------------------------------------------------------------------
contractsRouter.delete("/make-server-f8b491be/api/contracts/:contractId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const contractId = c.req.param("contractId");
    const { data: existing, error: fe } = await db()
      .from("wg_contracts")
      .select("id, owner_id")
      .eq("id", contractId)
      .single();

    if (fe || !existing) return c.json({ error: "Contract not found" }, 404);
    if (existing.owner_id !== userId) return c.json({ error: "Forbidden" }, 403);

    const { error } = await db().from("wg_contracts").delete().eq("id", contractId);
    if (error) throw error;
    console.log(`Contract deleted: ${contractId}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`Contract delete error: ${err.message}`);
    return c.json({ error: `Failed to delete contract: ${err.message}` }, 500);
  }
});

export { contractsRouter };
