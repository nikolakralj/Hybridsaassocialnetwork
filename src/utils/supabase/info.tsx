const fallbackProjectId = "gcdtimasyknakdojiufl";
const fallbackAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZHRpbWFzeWtuYWtkb2ppdWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjk2MjksImV4cCI6MjA3NjIwNTYyOX0.uEeE-mYaV6L00Ta_-KNbz96XghmD30M90luptRJaxAM";

const env = (typeof import.meta !== "undefined" ? import.meta.env : {}) as Record<string, string | undefined>;
const envProjectId = env.VITE_SUPABASE_PROJECT_ID?.trim();
const envAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

export const projectId = envProjectId || fallbackProjectId;
export const publicAnonKey = envAnonKey || fallbackAnonKey;
