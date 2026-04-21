// Phase 5: Project invitations API
import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendEmail } from "./email.tsx";

type ProjectRole = "Owner" | "Editor" | "Contributor" | "Commenter" | "Viewer";

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface InvitationBody {
  projectId?: string;
  projectName?: string;
  userName?: string;
  userEmail?: string;
  role?: string;
  scope?: string;
  expiresAt?: string;
}

const SMTP_CONFIGURED = Boolean(Deno.env.get("RESEND_API_KEY"));

export const invitationsRouter = new Hono();

function db() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function normalizeEmail(email?: string | null): string {
  return (email || "").trim().toLowerCase();
}

function sanitizeRole(role?: string | null): ProjectRole {
  if (
    role === "Owner" ||
    role === "Editor" ||
    role === "Contributor" ||
    role === "Commenter" ||
    role === "Viewer"
  ) {
    return role;
  }
  return "Viewer";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAppUrl(): string {
  return (
    Deno.env.get("VITE_APP_URL") ||
    Deno.env.get("PUBLIC_URL") ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
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

function rowToProject(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    region: row.region ?? undefined,
    currency: row.currency ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMember(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id ?? "",
    userName: row.user_name ?? undefined,
    userEmail: row.user_email ?? undefined,
    role: row.role,
    scope: row.scope ?? undefined,
    invitedBy: row.invited_by ?? undefined,
    invitedAt: row.invited_at,
    acceptedAt: row.accepted_at ?? null,
    invitationId: row.invitation_id ?? undefined,
  };
}

function rowToInvitation(row: any) {
  return {
    id: row.id,
    token: row.id,
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

async function getCallerRole(
  projectOwnerId: string,
  projectId: string,
  userId: string
): Promise<ProjectRole | null> {
  if (projectOwnerId === userId) return "Owner";

  const { data, error } = await db()
    .from("wg_project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .maybeSingle();

  if (error || !data?.role) return null;
  return sanitizeRole(data.role);
}

async function resolveProjectForInvite(user: AuthUser, body: InvitationBody) {
  const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (projectId) {
    const { data: project, error } = await db()
      .from("wg_projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();

    if (error) throw error;
    if (!project) return { error: "Project not found" as const };

    const role = await getCallerRole(project.owner_id, project.id, user.id);
    if (!canManageMembers(role)) return { error: "Forbidden" as const };
    return { project, role };
  }

  const projectName = typeof body.projectName === "string" ? body.projectName.trim() : "";
  if (!projectName) return { error: "Missing projectName" as const };

  const { data: projects, error } = await db()
    .from("wg_projects")
    .select("*")
    .eq("name", projectName)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  if (!projects || projects.length === 0) return { error: "Project not found" as const };

  for (const project of projects) {
    const role = await getCallerRole(project.owner_id, project.id, user.id);
    if (canManageMembers(role)) return { project, role };
  }

  return { error: "Forbidden" as const };
}

function buildInviteEmail(projectName: string, token: string) {
  const appUrl = getAppUrl();
  const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(token)}`;
  const safeProjectName = escapeHtml(projectName);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:24px;font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;">
        <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">You've been invited to ${safeProjectName} on WorkGraph.</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#475569;">Accept: <a href="${acceptUrl}" style="color:#2563eb;text-decoration:none;">${acceptUrl}</a></p>
      </div>
    </body>
    </html>
  `;

  return { acceptUrl, html };
}

function getInvitationErrorStatus(message: string): number {
  switch (message) {
    case "Missing projectName":
      return 400;
    case "Project not found":
      return 404;
    case "Forbidden":
      return 403;
    default:
      return 400;
  }
}

// ---------------------------------------------------------------------------
// POST /invitations
// ---------------------------------------------------------------------------
invitationsRouter.post("/", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = (await c.req.json()) as InvitationBody;
    const email = normalizeEmail(body.userEmail);

    if (!email || !email.includes("@")) {
      return c.json({ error: "Invalid email address" }, 400);
    }

    if (email === normalizeEmail(user.email)) {
      return c.json({ error: "You cannot invite yourself" }, 400);
    }

    const projectResult = await resolveProjectForInvite(user, body);
    if ("error" in projectResult) {
      return c.json({ error: projectResult.error }, getInvitationErrorStatus(projectResult.error));
    }

    const { project } = projectResult;
    const role = sanitizeRole(body.role);
    const now = new Date().toISOString();
    const token = crypto.randomUUID();
    const invitationData = {
      id: token,
      project_id: project.id,
      project_name: project.name,
      email,
      role,
      scope: body.scope || null,
      invited_by: user.id,
      invited_by_name: user.name,
      invited_at: now,
      expires_at: body.expiresAt || null,
      accepted_at: null,
      declined_at: null,
      accepted_by_user_id: null,
      status: "pending",
    };

    const { data: existingRows, error: existingError } = await db()
      .from("wg_project_invitations")
      .select("id")
      .eq("project_id", project.id)
      .eq("email", email)
      .order("invited_at", { ascending: false })
      .limit(1);

    if (existingError) throw existingError;

    let invitation: any;
    if (existingRows && existingRows.length > 0) {
      const existingId = existingRows[0].id;
      const { data, error } = await db()
        .from("wg_project_invitations")
        .update(invitationData)
        .eq("id", existingId)
        .select("*")
        .single();
      if (error) throw error;
      invitation = data;
    } else {
      const { data, error } = await db()
        .from("wg_project_invitations")
        .insert(invitationData)
        .select("*")
        .single();
      if (error) throw error;
      invitation = data;
    }

    const { acceptUrl, html } = buildInviteEmail(project.name, invitation.id);
    const subject = `You've been invited to ${project.name} on WorkGraph`;
    const payload = { to: email, subject, html };

    let emailStatus: "sent" | "logged" = "logged";
    if (SMTP_CONFIGURED) {
      const emailResult = await sendEmail(payload);
      if (emailResult.success) {
        emailStatus = "sent";
      } else {
        console.warn("[INVITATIONS] Email send failed:", emailResult.error);
        console.log("[INVITATIONS] Invite email payload:", { ...payload, acceptUrl });
      }
    } else {
      console.log("[INVITATIONS] SMTP not configured, invite email payload:", {
        ...payload,
        acceptUrl,
      });
    }

    return c.json({
      invitation: rowToInvitation(invitation),
      project: rowToProject(project),
      emailStatus,
    }, 201);
  } catch (err: any) {
    console.error("[INVITATIONS] Create error:", err);
    return c.json({ error: `Failed to create invitation: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /invitations/:token
// ---------------------------------------------------------------------------
invitationsRouter.get("/:token", async (c) => {
  try {
    const token = c.req.param("token");
    const { data: invitation, error } = await db()
      .from("wg_project_invitations")
      .select("*")
      .eq("id", token)
      .maybeSingle();

    if (error) throw error;
    if (!invitation) return c.json({ error: "Invitation not found" }, 404);

    const { data: project } = await db()
      .from("wg_projects")
      .select("id, name")
      .eq("id", invitation.project_id)
      .maybeSingle();

    const expiry = invitation.expires_at ?? undefined;
    const invitationStatus =
      invitation.status === "pending" &&
      invitation.expires_at &&
      new Date(invitation.expires_at).getTime() < Date.now()
        ? "expired"
        : invitation.status;

    return c.json({
      invitation: {
        token: invitation.id,
        projectId: invitation.project_id,
        projectName: invitation.project_name ?? project?.name ?? undefined,
        inviter: invitation.invited_by_name ?? invitation.invited_by ?? "Unknown",
        role: invitation.role,
        expiry,
        status: invitationStatus,
        email: invitation.email,
      },
    });
  } catch (err: any) {
    console.error("[INVITATIONS] Lookup error:", err);
    return c.json({ error: `Failed to load invitation: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /invitations/:token/accept
// ---------------------------------------------------------------------------
invitationsRouter.post("/:token/accept", async (c) => {
  try {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const token = c.req.param("token");
    const { data: invitation, error } = await db()
      .from("wg_project_invitations")
      .select("*")
      .eq("id", token)
      .maybeSingle();

    if (error) throw error;
    if (!invitation) return c.json({ error: "Invitation not found" }, 404);

    if (invitation.status !== "pending") {
      return c.json({ error: "Invitation already processed" }, 409);
    }

    if (invitation.expires_at && new Date(invitation.expires_at).getTime() < Date.now()) {
      return c.json({ error: "Invitation expired" }, 410);
    }

    const normalizedEmail = normalizeEmail(user.email);
    if (invitation.email && normalizedEmail !== normalizeEmail(invitation.email)) {
      return c.json({ error: "Invitation email does not match signed-in account" }, 403);
    }

    const { data: project, error: projectError } = await db()
      .from("wg_projects")
      .select("id, name, owner_id")
      .eq("id", invitation.project_id)
      .maybeSingle();

    if (projectError) throw projectError;
    if (!project) return c.json({ error: "Project not found" }, 404);

    const now = new Date().toISOString();
    const memberBase = {
      project_id: project.id,
      user_id: user.id,
      user_name: user.name,
      user_email: normalizedEmail,
      role: sanitizeRole(invitation.role),
      scope: invitation.scope ?? null,
      invited_by: invitation.invited_by ?? user.id,
      invited_at: invitation.invited_at ?? now,
      accepted_at: now,
      invitation_id: invitation.id,
    };

    const existingMemberQueries = [
      db()
        .from("wg_project_members")
        .select("*")
        .eq("project_id", project.id)
        .eq("invitation_id", invitation.id)
        .maybeSingle(),
      db()
        .from("wg_project_members")
        .select("*")
        .eq("project_id", project.id)
        .eq("user_email", normalizedEmail)
        .maybeSingle(),
      db()
        .from("wg_project_members")
        .select("*")
        .eq("project_id", project.id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ];

    let member: any | null = null;
    for (const query of existingMemberQueries) {
      const { data, error: memberLookupError } = await query;
      if (memberLookupError) throw memberLookupError;
      if (data) {
        const { data: updatedMember, error: updateError } = await db()
          .from("wg_project_members")
          .update(memberBase)
          .eq("id", data.id)
          .select("*")
          .single();
        if (updateError) throw updateError;
        member = updatedMember;
        break;
      }
    }

    if (!member) {
      const { data: insertedMember, error: insertError } = await db()
        .from("wg_project_members")
        .insert({
          id: crypto.randomUUID(),
          ...memberBase,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      member = insertedMember;
    }

    const { error: updateInvitationError } = await db()
      .from("wg_project_invitations")
      .update({
        status: "accepted",
        accepted_at: now,
        accepted_by_user_id: user.id,
      })
      .eq("id", invitation.id);

    if (updateInvitationError) throw updateInvitationError;

    return c.json({
      success: true,
      invitation: rowToInvitation({
        ...invitation,
        status: "accepted",
        accepted_at: now,
        accepted_by_user_id: user.id,
      }),
      member: rowToMember(member),
      project: rowToProject(project),
    });
  } catch (err: any) {
    console.error("[INVITATIONS] Accept error:", err);
    return c.json({ error: `Failed to accept invitation: ${err.message}` }, 500);
  }
});
