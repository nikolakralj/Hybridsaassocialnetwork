const fallbackProjectId = "gcdtimasyknakdojiufl";
const fallbackAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZHRpbWFzeWtuYWtkb2ppdWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjk2MjksImV4cCI6MjA3NjIwNTYyOX0.uEeE-mYaV6L00Ta_-KNbz96XghmD30M90luptRJaxAM";

/** A Supabase public key is a JWT (eyJ… with exactly two dots) or an sb_publishable_ key. */
function isPlausibleSupabasePublicKey(value: string): boolean {
  if (value.startsWith("sb_publishable_")) return true;
  if (!value.startsWith("eyJ")) return false;
  let dots = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) === 46) dots += 1;
  }
  return dots === 2;
}

const env = (typeof import.meta !== "undefined" ? import.meta.env : {}) as Record<string, string | undefined>;
const envProjectId = env.VITE_SUPABASE_PROJECT_ID?.trim();
const envAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

function resolveAnonKey(candidate: string | undefined): string {
  if (!candidate) return fallbackAnonKey;
  if (isPlausibleSupabasePublicKey(candidate)) return candidate;
  console.warn(
    "Ignoring VITE_SUPABASE_ANON_KEY because it is not a Supabase public key. Using the built-in anon key.",
  );
  return fallbackAnonKey;
}

export const projectId = envProjectId || fallbackProjectId;
export const publicAnonKey = resolveAnonKey(envAnonKey);
