/**
 * A directory row has no graph or parties. Merging it must drop any older
 * cached copy of those fields, which can hold rates the caller may not see.
 */
export function mergeDirectoryProject(
  prior: Record<string, any> | undefined,
  incoming: Record<string, any>,
): Record<string, any> {
  const merged: Record<string, any> = { ...(prior || {}), ...incoming, storageSource: 'cloud' };
  if (!Object.prototype.hasOwnProperty.call(incoming, 'graph')) delete merged.graph;
  if (!Object.prototype.hasOwnProperty.call(incoming, 'parties')) delete merged.parties;
  return merged;
}
