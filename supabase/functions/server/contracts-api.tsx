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
function rowToContract(row: any) {
  const extra = row.data || {};
  const baseRate = extra.baseHourlyRate ?? Number(row.rate) ?? 0;
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
    workTypeRates: extra.workTypeRates ?? {
      regular: baseRate,
      travel: Math.round(baseRate * 0.5),
      overtime: Math.round(baseRate * 1.5),
      oncall: Math.round(baseRate * 0.75),
    },
    contractNumber: extra.contractNumber ?? `CTR-${row.id.slice(-6)}`,
    currency: row.currency ?? extra.currency ?? "EUR",
    billingCycle: extra.billingCycle ?? "monthly",
    status: row.status,
    effectiveDate: row.start_date ?? extra.effectiveDate ?? null,
    expirationDate: row.end_date ?? extra.expirationDate ?? null,
    // Visibility
    hideRateFromProvider: extra.hideRateFromProvider ?? false,
    hideRateFromRecipient: extra.hideRateFromRecipient ?? false,
    // Meta
    title: row.title,
    description: row.description ?? null,
    createdBy: extra.createdBy ?? row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
    const { data, error } = await db()
      .from("wg_contracts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return c.json({ contracts: (data || []).map(rowToContract) });
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
    return c.json({ contract: rowToContract(data) });
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
      project_id: body.projectId || null,
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

    const body = await c.req.json();
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
    if (body.projectId !== undefined) updateData.project_id = body.projectId;

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
    return c.json({ contract: rowToContract(updated) });
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
