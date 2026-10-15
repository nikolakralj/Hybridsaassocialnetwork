// Timesheets API — SQL-backed CRUD (wg_timesheet_weeks)
// Replaces KV store. All HTTP routes and response shapes are identical to the
// previous KV-backed version so the frontend requires zero changes.
import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";

const timesheetsRouter = new Hono();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value?: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Client that runs as the caller, so RLS (migration 034) decides which weeks
// they may read.
function userDb(c: any) {
  const token = c.req.header("Authorization")?.split(" ")[1];
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// The week guard trigger (034) raises 42501 for locked weeks and for status
// changes outside the approval workflow. Surface those as 409, not 500.
function lockedWeekResponse(c: any, err: any) {
  if (err?.code === "42501") {
    return c.json({ error: err.message, code: "timesheet_locked" }, 409);
  }
  return null;
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

async function canReviewTimesheet(reviewerId: string, weekRow: any): Promise<boolean> {
  const projectId = weekRow?.project_id;
  if (!projectId) return false;

  const client = db();
  const { data: project, error: projectError } = await client
    .from("wg_projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) throw projectError;
  if (project?.owner_id === reviewerId) return true;

  const { data: member, error: memberError } = await client
    .from("wg_project_members")
    .select("role, can_approve")
    .eq("project_id", projectId)
    .eq("user_id", reviewerId)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (memberError) throw memberError;
  if (!member) return false;

  return member.can_approve === true || member.role === "Owner" || member.role === "Editor";
}

// ---------------------------------------------------------------------------
// GET /make-server-f8b491be/api/timesheets?month=YYYY-MM
// ---------------------------------------------------------------------------
timesheetsRouter.get("/make-server-f8b491be/api/timesheets", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const month = c.req.query("month");
    const projectId = c.req.query("project_id") || c.req.query("projectId");

    // Runs as the caller: the worker sees their own weeks, the project owner
    // sees the project, an assigned approver sees the weeks they approve, and
    // verified admins of the worker's party see that party's weeks.
    let query = userDb(c)
      .from("wg_timesheet_weeks")
      .select("*")
      .order("week_start", { ascending: false });

    if (month) {
      const [year, mon] = month.split("-").map(Number);
      const nextMonth = mon === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
      query = query.gte("week_start", `${month}-01`).lt("week_start", nextMonth);
    }

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const graphNodeByUserId = new Map<string, string>();
    if (projectId && (data || []).length > 0) {
      const userIds = Array.from(new Set((data || []).map((row: any) => row.user_id).filter(Boolean)));
      const { data: memberRows, error: memberError } = await db()
        .from("wg_project_members")
        .select("user_id, graph_node_id")
        .eq("project_id", projectId)
        .in("user_id", userIds);
      if (memberError) throw memberError;
      (memberRows || []).forEach((member: any) => {
        if (member.user_id && member.graph_node_id) {
          graphNodeByUserId.set(member.user_id, member.graph_node_id);
        }
      });
    }

    return c.json({
      weeks: (data || []).map((row: any) => ({
        ...rowToWeek(row),
        graphNodeId: graphNodeByUserId.get(row.user_id),
      })),
    });
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

    // Status comes from the approval workflow, never from this body: a new row
    // is a draft and an existing row keeps its status.
    const { data: existing, error: existingError } = await db()
      .from("wg_timesheet_weeks")
      .select("status")
      .eq("id", rowId)
      .maybeSingle();
    if (existingError) throw existingError;

    const { status: _ignoredStatus, ...content } = body || {};
    const upsertRow = {
      id: rowId,
      user_id: user.id,
      project_id: body.projectId || null,
      week_start: weekStart,
      status: existing?.status || "draft",
      // Full StoredWeek blob: ensures any frontend fields survive round-trips
      data: { ...content, personId: user.id, weekStart },
    };

    const { data, error } = await db()
      .from("wg_timesheet_weeks")
      .upsert(upsertRow, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      const locked = lockedWeekResponse(c, error);
      if (locked) return locked;
      throw error;
    }
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
    const requestedStatus = body.status;
    if (!["draft", "submitted", "approved", "rejected"].includes(requestedStatus)) {
      return c.json({ error: `Invalid status: ${requestedStatus}` }, 400);
    }
    // Since 034, submit/recall/approve/reject are database RPCs that compute
    // the approval route on the server (wg_submit_timesheet,
    // wg_recall_timesheet, wg_decide_approval). This route only reopens your
    // own rejected week.
    if (requestedStatus !== "draft") {
      return c.json({
        error: "Submit, approve and reject timesheets through the approval workflow.",
        code: "use_approval_workflow",
      }, 409);
    }

    // Approvers pass the submitter's auth user id when syncing someone else's week.
    const requestedPersonId = isUuid(body.personId) ? body.personId : null;
    const targetUserId = requestedPersonId || user.id;
    const targetsAnotherUser = targetUserId !== user.id;

    if (targetsAnotherUser && (requestedStatus === "submitted" || requestedStatus === "draft")) {
      return c.json({ error: "You cannot submit or reopen a timesheet for another user." }, 403);
    }

    if (!targetsAnotherUser && (requestedStatus === "approved" || requestedStatus === "rejected")) {
      return c.json({ error: "You cannot approve or reject your own timesheet." }, 403);
    }

    const { data: existing, error: fe } = await db()
      .from("wg_timesheet_weeks")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (fe) throw fe;
    if (!existing) return c.json({ error: "Timesheet week not found" }, 404);

    if (targetsAnotherUser && !(await canReviewTimesheet(user.id, existing))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const now = new Date().toISOString();
    const statusUpdate: any = { status: requestedStatus };
    const dataUpdate = { ...(existing.data || {}) };

    switch (requestedStatus) {
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
    }

    statusUpdate.data = dataUpdate;

    const { data: updated, error: ue } = await db()
      .from("wg_timesheet_weeks")
      .update(statusUpdate)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (ue) {
      const locked = lockedWeekResponse(c, ue);
      if (locked) return locked;
      throw ue;
    }
    console.log(`Timesheet status: ${targetUserId} week ${weekStart} -> ${requestedStatus}`);
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

    if (error) {
      const locked = lockedWeekResponse(c, error);
      if (locked) return locked;
      throw error;
    }
    console.log(`Timesheet deleted: ${user.id} week ${weekStart}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`Timesheet delete error: ${err.message}`);
    return c.json({ error: `Failed to delete timesheet: ${err.message}` }, 500);
  }
});

export { timesheetsRouter };
