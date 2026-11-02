import { describe, expect, it } from 'vitest';
import { matchesProject } from './timesheet-match';

describe('matchesProject', () => {
  it('does not treat a missing project id as a match', () => {
    expect(matchesProject({ projectId: undefined }, 'proj_1')).toBe(false);
    expect(matchesProject({ projectId: '' }, 'proj_1')).toBe(false);
    expect(matchesProject({ projectId: 'proj_1' }, '')).toBe(false);
  });

  it('matches only the same project', () => {
    expect(matchesProject({ projectId: 'proj_1' }, 'proj_1')).toBe(true);
    expect(matchesProject({ projectId: 'proj_1' }, 'proj_2')).toBe(false);
  });
});
