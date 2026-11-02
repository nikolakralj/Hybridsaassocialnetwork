import { describe, expect, it } from 'vitest';
import { mergeDirectoryProject } from './project-directory-cache';

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

  it('keeps graph only when this payload actually contains it', () => {
    const graph = { nodes: [] };
    const merged = mergeDirectoryProject({ id: 'proj_1', graph: { nodes: [{ secret: true }] } }, { id: 'proj_1', graph });
    expect(merged.graph).toBe(graph);
  });
});
