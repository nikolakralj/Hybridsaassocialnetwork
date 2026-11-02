import { describe, expect, it } from 'vitest';
import { mergeDirectoryProject, projectReadFromCache } from './project-directory-cache';

describe('mergeDirectoryProject', () => {
  it('drops a previously cached graph and parties when the directory row omits them', () => {
    const merged = mergeDirectoryProject(
      { id: 'proj_1', name: 'Old', graph: { nodes: [{ data: { hourlyRate: 80 } }] }, parties: [{ id: 'party_a' }] },
      { id: 'proj_1', name: 'Agency pilot' },
    );
    expect(merged.name).toBe('Agency pilot');
    expect(merged.graph).toBeUndefined();
    expect(merged.parties).toBeUndefined();
  });

  it('drops graph and parties even when the directory payload still contains them', () => {
    const merged = mergeDirectoryProject(
      { id: 'proj_1', name: 'Old' },
      { id: 'proj_1', name: 'Agency pilot', graph: { nodes: [{ secret: true }] }, parties: [{ id: 'party_a' }] },
    );
    expect(merged.name).toBe('Agency pilot');
    expect(merged.graph).toBeUndefined();
    expect(merged.parties).toBeUndefined();
  });
});

describe('projectReadFromCache', () => {
  it('does not return a cached unscoped graph when the project API is unavailable', () => {
    const visible = projectReadFromCache({
      id: '11111111-1111-4111-8111-111111111111',
      storageSource: 'cloud',
      name: 'Pilot',
      graph: { nodes: [{ data: { hourlyRate: 80 } }] },
      parties: [{ id: 'party_a' }],
    });
    expect(visible.name).toBe('Pilot');
    expect(visible.graph).toBeUndefined();
    expect(visible.parties).toBeUndefined();
  });

  it('keeps a browser-only project graph', () => {
    const graph = { nodes: [{ id: 'local' }] };
    const visible = projectReadFromCache({
      id: 'proj_local_1',
      storageSource: 'local',
      name: 'Scratch',
      graph,
    });
    expect(visible.graph).toBe(graph);
  });
});
