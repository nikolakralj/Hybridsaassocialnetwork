// The signed-in user's name for UI labels. AuthContext exposes a UserProfile
// (`name` = the Full name given at sign-up), not the raw Supabase user, so
// reading `user.user_metadata` there is always undefined and fell back to the
// email prefix.
export function userDisplayName(
  user: { name?: string | null; email?: string | null } | null | undefined,
  fallback = '',
): string {
  const name = typeof user?.name === 'string' ? user.name.trim() : '';
  if (name) return name;
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  return email || fallback;
}
