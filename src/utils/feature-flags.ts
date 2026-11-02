import { projectWorkspacePath } from './workspace-link';

/** Off unless VITE_SHOW_SOCIAL_FEATURES=true. Pilot builds leave it unset. */
export const SHOW_SOCIAL_FEATURES = import.meta.env.VITE_SHOW_SOCIAL_FEATURES === 'true';

export const PILOT_HIDDEN_MODULE_IDS = [
  'contracts',
  'documents',
  'tasks',
  'analytics',
  'messages',
] as const;

/** Where a hidden route sends a pilot user. No project goes to the project list. */
export function hiddenRouteTarget(projectId?: string | null): string {
  return projectWorkspacePath(projectId);
}
