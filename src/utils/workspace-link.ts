/**
 * Copy of the workspace query with a new project id and/or tab.
 * Overview is the default tab, so it is omitted from the URL.
 */
export function withWorkspaceSearch(
  current: URLSearchParams,
  update: { projectId?: string; tab?: string | null },
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (update.projectId) next.set('projectId', update.projectId);
  if ('tab' in update) {
    if (!update.tab || update.tab === 'overview') next.delete('tab');
    else next.set('tab', update.tab);
  }
  return next;
}

/** Open a real project workspace. A missing or demo id goes to the project list. */
export function projectWorkspacePath(projectId: string | null | undefined, tab?: string): string {
  const id = (projectId || '').trim();
  if (!id || id === 'proj-alpha') return '/app/projects';
  const params = new URLSearchParams({ projectId: id });
  if (tab) params.set('tab', tab);
  return `/app/project-workspace?${params.toString()}`;
}
