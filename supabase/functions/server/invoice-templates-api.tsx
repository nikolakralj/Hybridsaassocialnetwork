// Phase 4: Invoice templates API
import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

const invoiceTemplatesRouter = new Hono();

const DEFAULT_COMPLIANCE = {
  standard: "urn:cen.eu:en16931:2017",
  taxScheme: "VAT",
  idScheme: "9934",
  paymentRefFormat: "HR99",
};

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

function inferLocale(currency?: string): string {
  const normalized = normalizeString(currency).toUpperCase();
  if (normalized === "GBP") return "en-GB";
  return "hr-HR";
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

function rowToTemplate(row: any) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    locale: row.locale,
    layout: row.layout ?? {},
    fieldMap: row.field_map ?? {},
    compliance: row.compliance ?? {},
    branding: row.branding ?? null,
    sourceFile: row.source_file ?? undefined,
    isDefault: row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTemplatePayload(body: any, projectId: string) {
  const legacy = body.template && typeof body.template === "object" ? body.template : null;
  const name = normalizeString(body.name ?? body.templateName ?? body.template_name ?? legacy?.templateName) || "Invoice Template";
  const currency = normalizeString(body.currency ?? legacy?.currency);

  const layout = body.layout
    ?? legacy?.layout
    ?? {
      templateName: legacy?.templateName ?? body.templateName ?? name,
      vendor: legacy?.vendor ?? body.vendor ?? "",
      client: legacy?.client ?? body.client ?? "",
      currency: currency || "EUR",
      notes: legacy?.notes ?? body.notes ?? "",
      dueDateOffsetDays: legacy?.dueDateOffsetDays ?? body.dueDateOffsetDays ?? 30,
      lineDefaults: legacy?.lineDefaults ?? body.lineDefaults ?? [],
    };

  const fieldMap = body.fieldMap ?? body.field_map ?? legacy?.fieldMap ?? legacy?.field_map ?? {};
  const compliance = body.compliance ?? legacy?.compliance ?? DEFAULT_COMPLIANCE;
  const sourceFile = normalizeString(body.sourceFile ?? body.source_file ?? legacy?.sourceFile ?? legacy?.source_file) || null;
  const isDefault = Boolean(body.isDefault ?? body.is_default ?? legacy?.isDefault ?? legacy?.is_default ?? false);
  const branding = body.branding
    ?? legacy?.branding
    ?? {
      source: legacy ? "legacy-project-template" : "manual",
      projectId: projectId || null,
      templateName: legacy?.templateName ?? body.templateName ?? name,
      vendor: legacy?.vendor ?? body.vendor ?? null,
      client: legacy?.client ?? body.client ?? null,
      currency: currency || null,
      notes: legacy?.notes ?? body.notes ?? null,
      dueDateOffsetDays: legacy?.dueDateOffsetDays ?? body.dueDateOffsetDays ?? null,
      lineDefaults: legacy?.lineDefaults ?? body.lineDefaults ?? [],
    };

  return {
    name,
    locale: normalizeString(body.locale ?? legacy?.locale) || inferLocale(currency || "EUR"),
    layout,
    fieldMap,
    compliance,
    branding,
    sourceFile,
    isDefault,
  };
}

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/invoice-templates?owner_id=X
// ---------------------------------------------------------------------------
invoiceTemplatesRouter.get("/", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const ownerId = normalizeString(c.req.query("owner_id") ?? c.req.query("ownerId")) || user.id;
    if (ownerId !== user.id) return c.json({ error: "Forbidden" }, 403);

    const { data, error } = await db()
      .from("wg_invoice_templates")
      .select("*")
      .eq("owner_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return c.json({ templates: (data || []).map(rowToTemplate) });
  } catch (err: any) {
    return c.json({ error: `Failed to list invoice templates: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /make-server-f8b491be/invoice-templates
// ---------------------------------------------------------------------------
invoiceTemplatesRouter.post("/", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const projectId = normalizeString(body.projectId ?? body.project_id);
    const payload = normalizeTemplatePayload(body, projectId);

    if (payload.isDefault) {
      const { error: clearError } = await db()
        .from("wg_invoice_templates")
        .update({ is_default: false })
        .eq("owner_id", user.id)
        .eq("is_default", true);

      if (clearError) throw clearError;
    }

    const insertRow = {
      owner_id: user.id,
      name: payload.name,
      locale: payload.locale,
      layout: payload.layout,
      field_map: payload.fieldMap,
      compliance: payload.compliance,
      branding: payload.branding,
      source_file: payload.sourceFile,
      is_default: payload.isDefault,
    };

    const { data, error } = await db()
      .from("wg_invoice_templates")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) throw error;

    return c.json({ template: rowToTemplate(data) }, 201);
  } catch (err: any) {
    return c.json({ error: `Failed to create invoice template: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /make-server-f8b491be/invoice-templates/:id
// ---------------------------------------------------------------------------
invoiceTemplatesRouter.delete("/:id", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const templateId = c.req.param("id");
    const { data: template, error: fetchError } = await db()
      .from("wg_invoice_templates")
      .select("id, owner_id")
      .eq("id", templateId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!template) return c.json({ error: "Invoice template not found" }, 404);
    if (template.owner_id !== user.id) return c.json({ error: "Forbidden" }, 403);

    const { error: updateError } = await db()
      .from("wg_invoice_templates")
      .update({ is_default: false })
      .eq("id", templateId)
      .eq("owner_id", user.id);

    if (updateError) throw updateError;

    const { error: deleteError } = await db()
      .from("wg_invoice_templates")
      .delete()
      .eq("id", templateId)
      .eq("owner_id", user.id);

    if (deleteError) throw deleteError;

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: `Failed to delete invoice template: ${err.message}` }, 500);
  }
});

export { invoiceTemplatesRouter };
