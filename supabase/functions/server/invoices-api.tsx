// Phase 4: Invoice records API
import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

const invoicesRouter = new Hono();

const ALLOWED_STATUSES = new Set([
  "draft",
  "issued",
  "paid",
  "partially_paid",
  "overdue",
]);

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

function normalizeString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sumLineItems(items: any[]): number {
  return items.reduce((sum, item) => {
    const amount = item?.amount ?? item?.total ?? item?.lineTotal ?? 0;
    return sum + toNumber(amount, 0);
  }, 0);
}

function normalizeStatus(value: unknown): string | null {
  const status = normalizeString(value).toLowerCase();
  if (!status) return null;
  return ALLOWED_STATUSES.has(status) ? status : null;
}

function rowToInvoice(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    templateId: row.template_id ?? undefined,
    invoiceNumber: row.invoice_number,
    fromPartyId: row.from_party_id,
    toPartyId: row.to_party_id,
    fromTaxId: row.from_tax_id ?? undefined,
    toTaxId: row.to_tax_id ?? undefined,
    fromIban: row.from_iban ?? undefined,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    deliveryDate: row.delivery_date ?? undefined,
    currency: row.currency,
    lineItems: Array.isArray(row.line_items) ? row.line_items : [],
    subtotal: toNumber(row.subtotal),
    taxTotal: toNumber(row.tax_total),
    total: toNumber(row.total),
    status: row.status,
    timesheetIds: Array.isArray(row.timesheet_ids) ? row.timesheet_ids : [],
    en16931Xml: row.en16931_xml ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    paymentRef: row.payment_ref ?? undefined,
    notes: row.notes ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAuthUser(c: any): Promise<AuthUser | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;

  try {
    const { data, error } = await db().auth.getUser(token);
    if (error || !data?.user?.id || !data.user.email) return null;
    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name || data.user.email.split("@")[0] || "User",
    };
  } catch {
    return null;
  }
}

async function getProjectAccess(projectId: string, userId: string) {
  const { data: project, error: projectError } = await db()
    .from("wg_projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (!project) return { project: null, isOwner: false, isMember: false };

  if (project.owner_id === userId) {
    return { project, isOwner: true, isMember: false };
  }

  const { data: member, error: memberError } = await db()
    .from("wg_project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (memberError) throw memberError;
  return { project, isOwner: false, isMember: Boolean(member) };
}

async function canEditInvoice(invoice: any, userId: string): Promise<boolean> {
  if (!invoice) return false;
  if (invoice.created_by === userId) return true;

  const { data: project, error } = await db()
    .from("wg_projects")
    .select("owner_id")
    .eq("id", invoice.project_id)
    .maybeSingle();

  if (error || !project) return false;
  return project.owner_id === userId;
}

function normalizeInvoicePayload(body: any) {
  const lineItems = Array.isArray(body.lineItems)
    ? body.lineItems
    : Array.isArray(body.line_items)
      ? body.line_items
      : [];

  const issueDateInput = body.issueDate ?? body.issue_date;
  const dueDateInput = body.dueDate ?? body.due_date;
  const deliveryDateInput = body.deliveryDate ?? body.delivery_date;
  const status = normalizeStatus(body.status);
  const rawSubtotal = body.subtotal ?? body.sub_total;
  const rawTaxTotal = body.taxTotal ?? body.tax_total;
  const rawTotal = body.total ?? body.total_amount;
  const taxRate = body.taxRate ?? body.vatRate;

  const issueDate = parseDate(issueDateInput) ?? todayIso();
  const dueDate = dueDateInput === undefined || dueDateInput === null || dueDateInput === ""
    ? addDays(issueDate, 30)
    : parseDate(dueDateInput);
  const deliveryDate = parseDate(deliveryDateInput);

  return {
    projectId: normalizeString(body.projectId ?? body.project_id),
    templateId: normalizeString(body.templateId ?? body.template_id) || null,
    invoiceNumber: normalizeString(body.invoiceNumber ?? body.invoice_number),
    fromPartyId: normalizeString(body.fromPartyId ?? body.from_party_id),
    toPartyId: normalizeString(body.toPartyId ?? body.to_party_id),
    fromTaxId: normalizeString(body.fromTaxId ?? body.from_tax_id) || null,
    toTaxId: normalizeString(body.toTaxId ?? body.to_tax_id) || null,
    fromIban: normalizeString(body.fromIban ?? body.from_iban) || null,
    issueDate,
    dueDate,
    deliveryDate,
    currency: normalizeString(body.currency).toUpperCase() || "EUR",
    lineItems,
    subtotal: rawSubtotal !== undefined && rawSubtotal !== null && rawSubtotal !== ""
      ? toNumber(rawSubtotal, Number.NaN)
      : sumLineItems(lineItems),
    taxTotal: rawTaxTotal !== undefined && rawTaxTotal !== null && rawTaxTotal !== ""
      ? toNumber(rawTaxTotal, Number.NaN)
      : taxRate !== undefined && taxRate !== null && taxRate !== ""
        ? Math.round((toNumber(body.subtotal ?? body.sub_total ?? sumLineItems(lineItems), 0) * toNumber(taxRate, 0) / 100) * 100) / 100
        : 0,
    total: rawTotal !== undefined && rawTotal !== null && rawTotal !== ""
      ? toNumber(rawTotal, Number.NaN)
      : null,
    status,
    timesheetIds: Array.isArray(body.timesheetIds)
      ? body.timesheetIds
      : Array.isArray(body.timesheet_ids)
        ? body.timesheet_ids
        : [],
    notes: normalizeString(body.notes) || null,
    en16931Xml: normalizeString(body.en16931Xml ?? body.en16931_xml) || null,
    pdfUrl: normalizeString(body.pdfUrl ?? body.pdf_url) || null,
    paymentRef: normalizeString(body.paymentRef ?? body.payment_ref) || null,
  };
}

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/invoices?project_id=X
// ---------------------------------------------------------------------------
invoicesRouter.get("/", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = normalizeString(c.req.query("project_id") ?? c.req.query("projectId"));
    if (!projectId) return c.json({ error: "project_id is required" }, 400);

    const access = await getProjectAccess(projectId, user.id);
    if (!access.project) return c.json({ error: "Project not found" }, 404);

    let query = db()
      .from("wg_invoices")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (!access.isOwner && !access.isMember) {
      query = query.eq("created_by", user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return c.json({ invoices: (data || []).map(rowToInvoice) });
  } catch (err: any) {
    return c.json({ error: `Failed to list invoices: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /make-server-f8b491be/invoices
// ---------------------------------------------------------------------------
invoicesRouter.post("/", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const payload = normalizeInvoicePayload(body);

    if (!payload.projectId) return c.json({ error: "projectId is required" }, 400);
    if (!payload.invoiceNumber) return c.json({ error: "invoiceNumber is required" }, 400);
    if (!payload.fromPartyId) return c.json({ error: "fromPartyId is required" }, 400);
    if (!payload.toPartyId) return c.json({ error: "toPartyId is required" }, 400);
    if (!payload.dueDate) return c.json({ error: "dueDate is required" }, 400);
    if (!payload.status) return c.json({ error: "Invalid status" }, 400);

    const access = await getProjectAccess(payload.projectId, user.id);
    if (!access.project) return c.json({ error: "Project not found" }, 404);
    if (!access.isOwner && !access.isMember) return c.json({ error: "Forbidden" }, 403);

    if (payload.templateId) {
      const { data: template, error: templateError } = await db()
        .from("wg_invoice_templates")
        .select("id, owner_id")
        .eq("id", payload.templateId)
        .maybeSingle();

      if (templateError) throw templateError;
      if (!template) return c.json({ error: "Invoice template not found" }, 404);
      if (template.owner_id !== user.id) return c.json({ error: "Forbidden" }, 403);
    }

    if (payload.dueDate < payload.issueDate) {
      return c.json({ error: "dueDate must be on or after issueDate" }, 400);
    }

    const subtotal = Number.isFinite(payload.subtotal) ? payload.subtotal : sumLineItems(payload.lineItems);
    const taxTotal = Number.isFinite(payload.taxTotal) ? payload.taxTotal : 0;
    const total = Number.isFinite(payload.total) ? payload.total : Math.round((subtotal + taxTotal) * 100) / 100;

    const insertRow = {
      project_id: payload.projectId,
      template_id: payload.templateId,
      invoice_number: payload.invoiceNumber,
      from_party_id: payload.fromPartyId,
      to_party_id: payload.toPartyId,
      from_tax_id: payload.fromTaxId,
      to_tax_id: payload.toTaxId,
      from_iban: payload.fromIban,
      issue_date: payload.issueDate,
      due_date: payload.dueDate,
      delivery_date: payload.deliveryDate,
      currency: payload.currency,
      line_items: payload.lineItems,
      subtotal,
      tax_total: taxTotal,
      total,
      status: payload.status,
      timesheet_ids: payload.timesheetIds,
      en16931_xml: payload.en16931Xml,
      pdf_url: payload.pdfUrl,
      payment_ref: payload.paymentRef,
      notes: payload.notes,
      created_by: user.id,
    };

    const { data, error } = await db()
      .from("wg_invoices")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return c.json({ error: "Invoice number already exists for this project" }, 409);
      }
      if (error.code === "23503") {
        return c.json({ error: "Referenced project or template not found" }, 400);
      }
      if (error.code === "23514") {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    return c.json({ invoice: rowToInvoice(data) }, 201);
  } catch (err: any) {
    return c.json({ error: `Failed to create invoice: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// PATCH /make-server-f8b491be/invoices/:id
// ---------------------------------------------------------------------------
invoicesRouter.patch("/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const invoiceId = c.req.param("id");
    const body = await c.req.json();
    const nextStatus = normalizeStatus(body.status);

    if (!nextStatus) return c.json({ error: "Invalid status" }, 400);

    const { data: invoice, error: fetchError } = await db()
      .from("wg_invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!invoice) return c.json({ error: "Invoice not found" }, 404);

    const canEdit = await canEditInvoice(invoice, user.id);
    if (!canEdit) return c.json({ error: "Forbidden" }, 403);

    const { data: updated, error } = await db()
      .from("wg_invoices")
      .update({ status: nextStatus })
      .eq("id", invoiceId)
      .select("*")
      .single();

    if (error) throw error;

    return c.json({ invoice: rowToInvoice(updated) });
  } catch (err: any) {
    return c.json({ error: `Failed to update invoice: ${err.message}` }, 500);
  }
});

export { invoicesRouter };
