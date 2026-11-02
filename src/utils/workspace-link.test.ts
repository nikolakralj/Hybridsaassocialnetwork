import { describe, expect, it } from 'vitest';
import { projectWorkspacePath, withWorkspaceSearch } from './workspace-link';

describe('projectWorkspacePath', () => {
  it('opens the timesheet tab for a real project id', () => {
    expect(projectWorkspacePath('proj_1776', 'timesheets')).toBe(
      '/app/project-workspace?projectId=proj_1776&tab=timesheets',
    );
  });

  it('does not invent a slug id', () => {
    expect(projectWorkspacePath(null)).toBe('/app/projects');
    expect(projectWorkspacePath('proj-alpha', 'timesheets')).toBe('/app/projects');
  });

  it('replaces the tab in the query when the user changes modules', () => {
    const current = new URLSearchParams('projectId=proj_1776&tab=timesheets');
    expect(withWorkspaceSearch(current, { tab: 'approvals' }).toString()).toBe(
      'projectId=proj_1776&tab=approvals',
    );
    expect(withWorkspaceSearch(current, { tab: 'overview' }).toString()).toBe('projectId=proj_1776');
  });
});
