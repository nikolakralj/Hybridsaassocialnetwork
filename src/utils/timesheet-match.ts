/** A week with no project id does not belong to every project. */
export function matchesProject(week: { projectId?: string | null }, projectId: string): boolean {
  if (!week.projectId || !projectId) return false;
  return week.projectId === projectId;
}
