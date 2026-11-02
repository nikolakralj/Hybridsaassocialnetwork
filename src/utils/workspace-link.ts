/** Open a real project workspace. A missing or demo id goes to the project list. */
export function projectWorkspacePath(projectId: string | null | undefined, tab?: string): string {
  const id = (projectId || '').trim();
  if (!id || id === 'proj-alpha') return '/app/projects';
  const params = new URLSearchParams({ projectId: id });
  if (tab) params.set('tab', tab);
  return `/app/project-workspace?${params.toString()}`;
}
