import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const authRouter = new Hono();

// POST /make-server-f8b491be/auth/signup
authRouter.post("/make-server-f8b491be/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }

    if (password.length < 6) {
      return c.json({ error: "Password must be at least 6 characters" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log(`Signup error for ${email}: ${error.message}`);
      // Handle duplicate user
      if (error.message?.includes("already been registered") || error.message?.includes("already exists")) {
        return c.json({ error: "An account with this email already exists. Please sign in instead." }, 409);
      }
      return c.json({ error: error.message }, 400);
    }

    console.log(`User created successfully: ${email} (${data.user.id})`);
    return c.json({ user: { id: data.user.id, email: data.user.email } }, 201);
  } catch (err: any) {
    console.log(`Unexpected signup error: ${err.message}`);
    return c.json({ error: `Signup failed: ${err.message}` }, 500);
  }
});

// GET /make-server-f8b491be/api/profile/:userId - Public profile endpoint
authRouter.get("/make-server-f8b491be/api/profile/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    // Try to fetch profile from KV store
    const profileKey = `profile:${userId}`;
    const profile = await kv.get(profileKey);

    if (profile) {
      // Return public-safe fields only (strip email for privacy)
      const publicProfile = {
        id: userId,
        name: profile.name || "WorkGraph User",
        headline: profile.headline || "",
        bio: profile.bio || "",
        location: profile.location || "",
        website: profile.website || "",
        persona_type: profile.persona_type || "freelancer",
        skills: profile.skills || [],
        created_at: profile.created_at || new Date().toISOString(),
        // Intentionally omit email for privacy
      };
      return c.json(publicProfile);
    }

    // If no KV profile, try to get basic info from Supabase auth
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user) {
      return c.json({ error: "Profile not found" }, 404);
    }

    const publicProfile = {
      id: userId,
      name: data.user.user_metadata?.name || "WorkGraph User",
      headline: "",
      bio: "",
      location: "",
      website: "",
      persona_type: data.user.user_metadata?.persona_type || "freelancer",
      skills: [],
      created_at: data.user.created_at,
    };

    return c.json(publicProfile);
  } catch (err: any) {
    console.log(`Error fetching public profile: ${err.message}`);
    return c.json({ error: `Failed to load profile: ${err.message}` }, 500);
  }
});

export { authRouter };