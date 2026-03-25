// Documents API — CRUD + signing lifecycle for wg_documents
// Tracks every inter-party document: NDAs, Contracts, SOWs, Invoices,
// POs, Expense Reports, Deliverable Sign-offs, Change Orders, Compliance, Rate Cards
//
// Routes:
//   GET    /documents?projectId=&type=&status=     list documents
//   GET    /documents/:id                           get single document + events
//   POST   /documents                               create document
//   PATCH  /documents/:id                           update metadata/status
//   POST   /documents/:id/sign                      sign (or countersign)
//   POST   /documents/:id/reject                    reject with note
//   DELETE /documents/:id                           soft-delete (sets status=superseded)

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

const documentsRouter = new Hono();

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function getAuthUser(req: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id, email: user.email || "" };
}

function rowToDocument(row: Record<string, unknown>) {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    description: row.description,
    fromParty: row.from_party,
    toParty: row.to_party,
    status: row.status,
    signedBy: row.signed_by || [],
    rejectedBy: row.rejected_by,
    rejectionNote: row.rejection_note,
    signedAt: row.signed_at,
    rejectedAt: row.rejected_at,
    expiresAt: row.expires_at,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileSizeKb: row.file_size_kb,
    data: row.data || {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    documentId: row.document_id,
    eventType: row.event_type,
    actorId: row.actor_id,
    actorNode: row.actor_node,
    note: row.note,
    createdAt: row.created_at,
  };
}

async function logEvent(
  documentId: string,
  eventType: string,
  actorId: string | null,
  actorNode?: string,
  note?: string
) {
  await db().from("wg_document_events").insert({
    document_id: documentId,
    event_type: eventType,
    actor_id: actorId,
    actor_node: actorNode,
    note: note,
  });
}

// ---------------------------------------------------------------------------
// GET /documents — list documents for a project
// ---------------------------------------------------------------------------
documentsRouter.get("/", async (c) => {
  const user = await getAuthUser(c.req.raw);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const projectId = c.req.query("projectId");
  const type = c.req.query("type");
  const status = c.req.query("status");
  const fromParty = c.req.query("fromParty");
  const toParty = c.req.query("toParty");

  if (!projectId) return c.json({ error: "projectId required" }, 400);

  let query = db()
    .from("wg_documents")
    .select("*")
    .eq("project_id", projectId)
    .neq("status", "superseded")
    .order("created_at", { ascending: false });

  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);
  if (fromParty) query = query.eq("from_party", fromParty);
  if (toParty) query = query.eq("to_party", toParty);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json((data || []).map(rowToDocument));
});

// ---------------------------------------------------------------------------
// GET /documents/:id — single document with event history
// ---------------------------------------------------------------------------
documentsRouter.get("/:id", async (c) => {
  const user = await getAuthUser(c.req.raw);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { data: doc, error } = await db()
    .from("wg_documents")
    .select("*")
    .eq("id", c.req.param("id"))
    .single();

  if (error || !doc) return c.json({ error: "Document not found" }, 404);

  const { data: events } = await db()
    .from("wg_document_events")
    .select("*")
    .eq("document_id", doc.id)
    .order("created_at", { ascending: true });

  return c.json({
    document: rowToDocument(doc),
    events: (events || []).map(rowToEvent),
  });
});

// ---------------------------------------------------------------------------
// POST /documents — create document
// ---------------------------------------------------------------------------
documentsRouter.post("/", async (c) => {
  const user = await getAuthUser(c.req.raw);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json();
  const { projectId, type, title, description, fromParty, toParty, expiresAt, data } = body;

  if (!projectId || !type || !title || !fromParty || !toParty) {
    return c.json({ error: "projectId, type, title, fromParty, toParty required" }, 400);
  }

  const id = generateId();

  const { data: doc, error } = await db()
    .from("wg_documents")
    .insert({
      id,
      project_id: projectId,
      type,
      title,
      description,
      from_party: fromParty,
      to_party: toParty,
      status: "draft",
      signed_by: [],
      expires_at: expiresAt || null,
      data: data || {},
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  await logEvent(id, "created", user.id, fromParty);

  return c.json(rowToDocument(doc), 201);
});

// ---------------------------------------------------------------------------
// PATCH /documents/:id — update title, description, data, expiresAt
// ---------------------------------------------------------------------------
documentsRouter.patch("/:id", async (c) => {
  const user = await getAuthUser(c.req.raw);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");
  const body = await c.req.json();
  const { title, description, expiresAt, data, fileUrl, fileName, fileSizeKb } = body;

  const updates: Record<string, unknown> = {};
  if (title !== undefined)       updates.title = title;
  if (description !== undefined) updates.description = description;
  if (expiresAt !== undefined)   updates.expires_at = expiresAt;
  if (data !== undefined)        updates.data = data;
  if (fileUrl !== undefined) {
    updates.file_url = fileUrl;
    updates.file_name = fileName;
    updates.file_size_kb = fileSizeKb;
  }

  const { data: doc, error } = await db()
    .from("wg_documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  if (fileUrl) await logEvent(id, "uploaded", user.id, undefined, fileName);

  return c.json(rowToDocument(doc));
});

// ---------------------------------------------------------------------------
// POST /documents/:id/sign — sign or countersign a document
// ---------------------------------------------------------------------------
documentsRouter.post("/:id/sign", async (c) => {
  const user = await getAuthUser(c.req.raw);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const actorNode: string | undefined = body.actorNode;

  const { data: doc, error: fetchErr } = await db()
    .from("wg_documents")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !doc) return c.json({ error: "Document not found" }, 404);
  if (doc.status === "signed") return c.json({ error: "Already fully signed" }, 409);
  if (doc.status === "rejected") return c.json({ error: "Document was rejected" }, 409);

  const alreadySigned: string[] = doc.signed_by || [];
  if (alreadySigned.includes(user.id)) {
    return c.json({ error: "You have already signed this document" }, 409);
  }

  const newSignedBy = [...alreadySigned, user.id];
  // Status progression: draft/pending → countersigning (first sig) → signed (both sigs)
  // We consider "signed" when at least 2 unique signatures are present
  // (from_party member + to_party member). For now: 1 sig = countersigning, 2+ = signed.
  const newStatus = newSignedBy.length >= 2 ? "signed" : "countersigning";
  const signedAt = newStatus === "signed" ? new Date().toISOString() : doc.signed_at;

  const { data: updated, error: updateErr } = await db()
    .from("wg_documents")
    .update({
      signed_by: newSignedBy,
      status: newStatus,
      signed_at: signedAt,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) return c.json({ error: updateErr.message }, 500);

  const eventType = newStatus === "signed" ? "countersigned" : "signed";
  await logEvent(id, eventType, user.id, actorNode);

  return c.json(rowToDocument(updated));
});

// ---------------------------------------------------------------------------
// POST /documents/:id/reject — reject with optional note
// ---------------------------------------------------------------------------
documentsRouter.post("/:id/reject", async (c) => {
  const user = await getAuthUser(c.req.raw);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { note, actorNode } = body;

  const { data: updated, error } = await db()
    .from("wg_documents")
    .update({
      status: "rejected",
      rejected_by: user.id,
      rejection_note: note || null,
      rejected_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  await logEvent(id, "rejected", user.id, actorNode, note);

  return c.json(rowToDocument(updated));
});

// ---------------------------------------------------------------------------
// DELETE /documents/:id — mark superseded (soft delete)
// ---------------------------------------------------------------------------
documentsRouter.delete("/:id", async (c) => {
  const user = await getAuthUser(c.req.raw);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { error } = await db()
    .from("wg_documents")
    .update({ status: "superseded" })
    .eq("id", c.req.param("id"))
    .eq("created_by", user.id);

  if (error) return c.json({ error: error.message }, 500);

  await logEvent(c.req.param("id"), "superseded", user.id);

  return c.json({ ok: true });
});

export { documentsRouter };
