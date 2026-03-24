// Timesheets API — SQL-backed CRUD (wg_timesheet_weeks)
// Replaces KV store. All HTTP routes and response shapes are identical to the
// previous KV-backed version so the frontend requires zero changes.
import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

const timesheetsRouter = new Hono();

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getAuthUser(c: any): Promise<{ id: string; email: string } | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  try {
    const { data, error } = await db().auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return { id: data.user.id, email: data.user.email ?? "" };
  } catch {
    return null;
  }
}

// DB row → StoredWeek shape (matches old KV response)
// The full client-facing JSON lives in row.data; scalar columns override it.
function rowToWeek(row: any) {
  const stored = row.data || {};
  return {
    ...stored,
    id: row.id,
    personId: row.user_id,
    weekStart: row.week_start,
    projectId: row.project_id ?? undefined,
    status: row.status,
    submittedAt: row.submitted_at ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/timesheets?month=YYYY-MM
// ---------------------------------------------------------------------------
timesheetsRouter.get("/make-server-f8b491be/api/timesheets", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const month = c.req.query("month");
    let query = db()
      .from("wg_timesheet_weeks")
      .select("*")
      .eq("user_id", user.id)
      .order("week_start", { ascending: false });

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      const nextMonth = mon === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
      query = query.gte("week_start", `${month}-01`).lt("week_start", nextMonth);
    }

    const { data, error } = await query;
    if (error) throw error;
    return c.json({ weeks: (data || []).map(rowToWeek) });
  } catch (err: any) {
    console.log(`Timesheets list error: ${err.message}`);
    return c.json({ error: `Failed to list timesheets: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/timesheets/:weekStart
// ---------------------------------------------------------------------------
timesheetsRouter.get("/make-server-f8b491be/api/timesheets/:weekStart", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const weekStart = c.req.param("weekStart");
    const { data, error } = await db()
      .from("wg_timesheet_weeks")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (error) throw error;
    if (!data) return c.json({ error: "Timesheet week not found" }, 404);
    return c.json({ week: rowToWeek(data) });
  } catch (err: any) {
    console.log(`Timesheet get error: ${err.message}`);
    return c.json({ error: `Failed to get timesheet: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// PUT /make-server-f8b491be/api/timesheets/:weekStart  (upsert)
// ---------------------------------------------------------------------------
timesheetsRouter.put("/make-server-f8b491be/api/timesheets/:weekStart", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const weekStart = c.req.param("weekStart");
    const body = await c.req.json();

    // Row ID encodes user + week for O(1) lookup, matching original KV key pattern
    const rowId = `${user.id}:${weekStart}`;

    const upsertRow = {
      id: rowId,
      user_id: user.id,
      project_id: body.projectId || null,
      week_start: weekStart,
      status: body.status || "draft",
      // Full StoredWeek blob: ensures any frontend fields survive round-trips
      data: { ...body, personId: user.id, weekStart },
    };

    const { data, error } = await db()
      .from("wg_timesheet_weeks")
      .upsert(upsertRow, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw error;
    console.log(`Timesheet saved: ${user.id} week ${weekStart}`);
    return c.json({ week: rowToWeek(data) });
  } catch (err: any) {
    console.log(`Timesheet save error: ${err.message}`);
    return c.json({ error: `Failed to save timesheet: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// PATCH /make-server-f8b491be/api/timesheets/:weekStart/status
// ---------------------------------------------------------------------------
timesheetsRouter.patch("/make-server-f8b491be/api/timesheets/:weekStart/status", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const weekStart = c.req.param("weekStart");
    const body = await c.req.json();
    // Approvers pass personId of the submitter they are approving
    const targetUserId = body.personId || user.id;

    const { data: existing, error: fe } = await db()
      .from("wg_timesheet_weeks")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (fe) throw fe;
    if (!existing) return c.json({ error: "Timesheet week not found" }, 404);

    const now = new Date().toISOString();
    const statusUpdate: any = { status: body.status };
    const dataUpdate = { ...(existing.data || {}) };

    switch (body.status) {
      case "submitted":
        statusUpdate.submitted_at = now;
        dataUpdate.submittedAt = now;
        break;
      case "approved":
        statusUpdate.approved_at = now;
        statusUpdate.approved_by = user.id;
        dataUpdate.approvedBy = body.approverName || user.id;
        dataUpdate.approvedAt = now;
        break;
      case "rejected":
        dataUpdate.rejectedBy = body.approverName || user.id;
        dataUpdate.rejectedAt = now;
        dataUpdate.rejectionNote = body.note || "";
        break;
      case "draft":
        statusUpdate.submitted_at = null;
        statusUpdate.approved_at = null;
        statusUpdate.approved_by = null;
        delete dataUpdate.submittedAt;
        delete dataUpdate.approvedBy;
        delete dataUpdate.approvedAt;
        delete dataUpdate.rejectedBy;
        delete dataUpdate.rejectionNote;
        break;
      default:
        return c.json({ error: `Invalid status: ${body.status}` }, 400);
    }

    statusUpdate.data = dataUpdate;

    const { data: updated, error: ue } = await db()
      .from("wg_timesheet_weeks")
      .update(statusUpdate)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (ue) throw ue;
    console.log(`Timesheet status: ${targetUserId} week ${weekStart} → ${body.status}`);
    return c.json({ week: rowToWeek(updated) });
  } catch (err: any) {
    console.log(`Timesheet status error: ${err.message}`);
    return c.json({ error: `Failed to update status: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /make-server-f8b491be/api/timesheets/:weekStart
// ---------------------------------------------------------------------------
timesheetsRouter.delete("/make-server-f8b491be/api/timesheets/:weekStart", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const weekStart = c.req.param("weekStart");
    const { error } = await db()
      .from("wg_timesheet_weeks")
      .delete()
      .eq("user_id", user.id)
      .eq("week_start", weekStart);

    if (error) throw error;
    console.log(`Timesheet deleted: ${user.id} week ${weekStart}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`Timesheet delete error: ${err.message}`);
    return c.json({ error: `Failed to delete timesheet: ${err.message}` }, 500);
  }
});

export { timesheetsRouter };
