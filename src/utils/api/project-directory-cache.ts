/**
 * Cloud project cache holds directory metadata only. Graph and parties are
 * loaded through wg_get_scoped_graph, never from this cache: a pre-lockdown
 * copy can contain rates and topology the caller is no longer allowed to see.
 */
export function omitCachedGraph<T extends Record<string, any> | null | undefined>(project: T): T {
  if (!project || typeof project !== 'object') return project;
  const next = { ...project };
  delete next.graph;
  delete next.parties;
  return next as T;
}

export function mergeDirectoryProject(
  prior: Record<string, any> | undefined,
  incoming: Record<string, any>,
): Record<string, any> {
  return omitCachedGraph({ ...(prior || {}), ...incoming, storageSource: 'cloud' });
}

function isLocalOnlyProject(project: Record<string, any>): boolean {
  if (project.storageSource === 'local' || project.isLocalOnly === true) return true;
  const id = String(project.id || '');
  return id.includes('_local_');
}

/** What getProject returns from localStorage when the project API is down. */
export function projectReadFromCache(project: Record<string, any>): Record<string, any> {
  if (!project || typeof project !== 'object') return project;
  if (isLocalOnlyProject(project)) return project;
  return omitCachedGraph(project);
}
