/** Off unless VITE_SHOW_SOCIAL_FEATURES=true. Pilot builds leave it unset. */
export const SHOW_SOCIAL_FEATURES = import.meta.env.VITE_SHOW_SOCIAL_FEATURES === 'true';

export const PILOT_HIDDEN_MODULE_IDS = [
  'contracts',
  'documents',
  'tasks',
  'analytics',
  'messages',
] as const;

/** Where a hidden route sends a pilot user. No slug id is invented. */
export function hiddenRouteTarget(projectId?: string | null): string {
  const id = (projectId || '').trim();
  if (!id || id === 'proj-alpha') return '/app/project-workspace';
  return `/app/project-workspace?projectId=${encodeURIComponent(id)}`;
}
