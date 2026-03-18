// Phase 1: Contracts API — KV-backed CRUD
// KV Schema:
//   contract:{contractId}         → Contract JSON
//   project-contracts:{projectId} → string[] of contractIds
//   user-contracts:{userId}       → string[] of contractIds

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";

const contractsRouter = new Hono();

function generateId(): string {
  return `ctr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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

// ---------- LIST user's contracts ----------
contractsRouter.get("/make-server-f8b491be/api/contracts", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const contractIds: string[] = (await kv.get(`user-contracts:${userId}`)) || [];
    if (contractIds.length === 0) return c.json({ contracts: [] });

    const keys = contractIds.map((id) => `contract:${id}`);
    const contracts = await kv.mget(...keys);
    return c.json({ contracts: contracts.filter(Boolean) });
  } catch (err: any) {
    console.log(`Contracts list error: ${err.message}`);
    return c.json({ error: `Failed to list contracts: ${err.message}` }, 500);
  }
});

// ---------- LIST contracts for a project ----------
contractsRouter.get("/make-server-f8b491be/api/projects/:projectId/contracts", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const contractIds: string[] = (await kv.get(`project-contracts:${projectId}`)) || [];
    if (contractIds.length === 0) return c.json({ contracts: [] });

    const keys = contractIds.map((id) => `contract:${id}`);
    const contracts = await kv.mget(...keys);
    return c.json({ contracts: contracts.filter(Boolean) });
  } catch (err: any) {
    console.log(`Project contracts error: ${err.message}`);
    return c.json({ error: `Failed to list project contracts: ${err.message}` }, 500);
  }
});

// ---------- GET single contract ----------
contractsRouter.get("/make-server-f8b491be/api/contracts/:contractId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const contractId = c.req.param("contractId");
    const contract = await kv.get(`contract:${contractId}`);
    if (!contract) return c.json({ error: "Contract not found" }, 404);

    return c.json({ contract });
  } catch (err: any) {
    console.log(`Contract get error: ${err.message}`);
    return c.json({ error: `Failed to get contract: ${err.message}` }, 500);
  }
});

// ---------- CREATE contract ----------
contractsRouter.post("/make-server-f8b491be/api/contracts", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const now = new Date().toISOString();
    const contractId = generateId();

    const contract = {
      id: contractId,
      projectId: body.projectId || null,
      // Parties
      providerId: body.providerId || userId,
      providerType: body.providerType || "individual",
      providerName: body.providerName || "Provider",
      recipientId: body.recipientId || "",
      recipientType: body.recipientType || "company",
      recipientName: body.recipientName || "Client",
      // Financial
      baseHourlyRate: body.baseHourlyRate || 0,
      workTypeRates: body.workTypeRates || {
        regular: body.baseHourlyRate || 0,
        travel: Math.round((body.baseHourlyRate || 0) * 0.5),
        overtime: Math.round((body.baseHourlyRate || 0) * 1.5),
        oncall: Math.round((body.baseHourlyRate || 0) * 0.75),
      },
      contractNumber: body.contractNumber || `CTR-${Date.now().toString().slice(-6)}`,
      currency: body.currency || "USD",
      billingCycle: body.billingCycle || "monthly",
      status: body.status || "active",
      effectiveDate: body.effectiveDate || now,
      expirationDate: body.expirationDate || null,
      // Visibility
      hideRateFromProvider: body.hideRateFromProvider || false,
      hideRateFromRecipient: body.hideRateFromRecipient || false,
      // Meta
      createdBy: userId,
      createdAt: now,
    };

    await kv.set(`contract:${contractId}`, contract);

    // Update user's contract index
    const userContracts: string[] = (await kv.get(`user-contracts:${userId}`)) || [];
    userContracts.push(contractId);
    await kv.set(`user-contracts:${userId}`, userContracts);

    // Update project's contract index if projectId provided
    if (body.projectId) {
      const projContracts: string[] = (await kv.get(`project-contracts:${body.projectId}`)) || [];
      projContracts.push(contractId);
      await kv.set(`project-contracts:${body.projectId}`, projContracts);
    }

    console.log(`Contract created: ${contractId} by ${userId}`);
    return c.json({ contract }, 201);
  } catch (err: any) {
    console.log(`Contract create error: ${err.message}`);
    return c.json({ error: `Failed to create contract: ${err.message}` }, 500);
  }
});

// ---------- UPDATE contract ----------
contractsRouter.put("/make-server-f8b491be/api/contracts/:contractId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const contractId = c.req.param("contractId");
    const existing = await kv.get(`contract:${contractId}`);
    if (!existing) return c.json({ error: "Contract not found" }, 404);

    const body = await c.req.json();
    const updated = {
      ...existing,
      ...body,
      id: contractId,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`contract:${contractId}`, updated);
    console.log(`Contract updated: ${contractId}`);
    return c.json({ contract: updated });
  } catch (err: any) {
    console.log(`Contract update error: ${err.message}`);
    return c.json({ error: `Failed to update contract: ${err.message}` }, 500);
  }
});

// ---------- DELETE contract ----------
contractsRouter.delete("/make-server-f8b491be/api/contracts/:contractId", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const contractId = c.req.param("contractId");
    const existing = await kv.get(`contract:${contractId}`);
    if (!existing) return c.json({ error: "Contract not found" }, 404);

    // Remove from user's index
    const userContracts: string[] = (await kv.get(`user-contracts:${userId}`)) || [];
    await kv.set(`user-contracts:${userId}`, userContracts.filter((id) => id !== contractId));

    // Remove from project's index
    if (existing.projectId) {
      const projContracts: string[] = (await kv.get(`project-contracts:${existing.projectId}`)) || [];
      await kv.set(`project-contracts:${existing.projectId}`, projContracts.filter((id) => id !== contractId));
    }

    await kv.del(`contract:${contractId}`);
    console.log(`Contract deleted: ${contractId}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`Contract delete error: ${err.message}`);
    return c.json({ error: `Failed to delete contract: ${err.message}` }, 500);
  }
});

export { contractsRouter };
