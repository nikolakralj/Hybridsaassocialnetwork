// Phase 1: Timesheets API — KV-backed CRUD
// KV Schema:
//   timesheet-week:{userId}:{weekStart}  → StoredWeek JSON
//   user-timesheet-weeks:{userId}        → string[] of weekStart dates

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";

const timesheetsRouter = new Hono();

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

// ---------- LIST user's timesheets (optionally by month) ----------
// GET /make-server-f8b491be/api/timesheets?month=YYYY-MM
timesheetsRouter.get("/make-server-f8b491be/api/timesheets", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const month = c.req.query("month"); // optional filter
    const weekKeys: string[] = (await kv.get(`user-timesheet-weeks:${userId}`)) || [];

    if (weekKeys.length === 0) return c.json({ weeks: [] });

    const keys = weekKeys.map((ws) => `timesheet-week:${userId}:${ws}`);
    const allWeeks = await kv.mget(...keys);
    let weeks = allWeeks.filter(Boolean);

    // Filter by month if provided
    if (month) {
      weeks = weeks.filter((w: any) => w.weekStart && w.weekStart.startsWith(month));
    }

    return c.json({ weeks });
  } catch (err: any) {
    console.log(`Timesheets list error: ${err.message}`);
    return c.json({ error: `Failed to list timesheets: ${err.message}` }, 500);
  }
});

// ---------- GET a specific week ----------
// GET /make-server-f8b491be/api/timesheets/:weekStart
timesheetsRouter.get("/make-server-f8b491be/api/timesheets/:weekStart", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const weekStart = c.req.param("weekStart");
    const week = await kv.get(`timesheet-week:${userId}:${weekStart}`);
    if (!week) return c.json({ error: "Timesheet week not found" }, 404);

    return c.json({ week });
  } catch (err: any) {
    console.log(`Timesheet get error: ${err.message}`);
    return c.json({ error: `Failed to get timesheet: ${err.message}` }, 500);
  }
});

// ---------- CREATE / UPDATE a timesheet week ----------
// PUT /make-server-f8b491be/api/timesheets/:weekStart
timesheetsRouter.put("/make-server-f8b491be/api/timesheets/:weekStart", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const weekStart = c.req.param("weekStart");
    const body = await c.req.json();
    const now = new Date().toISOString();

    const existing = await kv.get(`timesheet-week:${userId}:${weekStart}`);

    const week = {
      ...(existing || {}),
      ...body,
      personId: userId,
      weekStart,
      updatedAt: now,
      createdAt: existing?.createdAt || now,
    };

    await kv.set(`timesheet-week:${userId}:${weekStart}`, week);

    // Update index if new week
    if (!existing) {
      const weekKeys: string[] = (await kv.get(`user-timesheet-weeks:${userId}`)) || [];
      if (!weekKeys.includes(weekStart)) {
        weekKeys.push(weekStart);
        weekKeys.sort(); // Keep chronologically sorted
        await kv.set(`user-timesheet-weeks:${userId}`, weekKeys);
      }
    }

    console.log(`Timesheet saved: ${userId} week ${weekStart}`);
    return c.json({ week });
  } catch (err: any) {
    console.log(`Timesheet save error: ${err.message}`);
    return c.json({ error: `Failed to save timesheet: ${err.message}` }, 500);
  }
});

// ---------- UPDATE timesheet status ----------
// PATCH /make-server-f8b491be/api/timesheets/:weekStart/status
timesheetsRouter.patch("/make-server-f8b491be/api/timesheets/:weekStart/status", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const weekStart = c.req.param("weekStart");
    // For approvals, the target personId may differ from the current user
    const body = await c.req.json();
    const targetUserId = body.personId || userId;

    const week = await kv.get(`timesheet-week:${targetUserId}:${weekStart}`);
    if (!week) return c.json({ error: "Timesheet week not found" }, 404);

    const now = new Date().toISOString();
    const updated = { ...week };

    switch (body.status) {
      case "submitted":
        updated.status = "submitted";
        updated.submittedAt = now;
        break;
      case "approved":
        updated.status = "approved";
        updated.approvedBy = body.approverName || userId;
        updated.approvedAt = now;
        break;
      case "rejected":
        updated.status = "rejected";
        updated.rejectedBy = body.approverName || userId;
        updated.rejectionNote = body.note || "";
        updated.rejectedAt = now;
        break;
      case "draft":
        updated.status = "draft";
        updated.submittedAt = undefined;
        updated.approvedBy = undefined;
        updated.rejectedBy = undefined;
        updated.rejectionNote = undefined;
        break;
      default:
        return c.json({ error: `Invalid status: ${body.status}` }, 400);
    }

    updated.updatedAt = now;
    await kv.set(`timesheet-week:${targetUserId}:${weekStart}`, updated);

    console.log(`Timesheet status: ${targetUserId} week ${weekStart} → ${body.status}`);
    return c.json({ week: updated });
  } catch (err: any) {
    console.log(`Timesheet status error: ${err.message}`);
    return c.json({ error: `Failed to update status: ${err.message}` }, 500);
  }
});

// ---------- DELETE a timesheet week ----------
// DELETE /make-server-f8b491be/api/timesheets/:weekStart
timesheetsRouter.delete("/make-server-f8b491be/api/timesheets/:weekStart", async (c) => {
  try {
    const userId = await getUserId(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const weekStart = c.req.param("weekStart");
    await kv.del(`timesheet-week:${userId}:${weekStart}`);

    // Update index
    const weekKeys: string[] = (await kv.get(`user-timesheet-weeks:${userId}`)) || [];
    await kv.set(`user-timesheet-weeks:${userId}`, weekKeys.filter((k) => k !== weekStart));

    console.log(`Timesheet deleted: ${userId} week ${weekStart}`);
    return c.json({ success: true });
  } catch (err: any) {
    console.log(`Timesheet delete error: ${err.message}`);
    return c.json({ error: `Failed to delete timesheet: ${err.message}` }, 500);
  }
});

export { timesheetsRouter };
