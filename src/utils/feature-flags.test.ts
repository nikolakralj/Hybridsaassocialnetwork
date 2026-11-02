import { describe, expect, it } from 'vitest';
import { hiddenRouteTarget, PILOT_HIDDEN_MODULE_IDS } from './feature-flags';

describe('hidden pilot routes', () => {
  it('sends a direct link to the project workspace', () => {
    expect(hiddenRouteTarget(null)).toBe('/app/project-workspace');
    expect(hiddenRouteTarget('proj-alpha')).toBe('/app/project-workspace');
    expect(hiddenRouteTarget('proj_1776')).toBe('/app/project-workspace?projectId=proj_1776');
  });

  it('names the in-project modules a pilot does not see', () => {
    expect(PILOT_HIDDEN_MODULE_IDS).toEqual([
      'contracts',
      'documents',
      'tasks',
      'analytics',
      'messages',
    ]);
  });
});
