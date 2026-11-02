import type { BaseNode } from '../../types/workgraph';

type NodeData = Record<string, unknown>;

/**
 * The Edit Supply Chain wizard regenerates every node from its own form state,
 * which only knows a subset of the fields stored on the server. Saving that
 * snapshot as-is would drop fields the wizard never shows (billing fields on a
 * worker, the real auth userId of a linked approver, an email the scoped graph
 * hides from this viewer) and, for another organization's people, the server
 * rejects it as an edit of records this user does not own.
 *
 * Merge each regenerated node over the node the server has: wizard values win
 * for the fields it actually edits; server values are kept for everything else.
 */
export function preserveServerNodeData(
  serverData: NodeData | undefined,
  wizardData: NodeData | undefined,
  nodeId: string,
): NodeData {
  const prev = serverData || {};
  const next = wizardData || {};
  const merged: NodeData = { ...prev, ...next };

  // The wizard falls back to the node id when it does not know the account.
  if (prev.userId && (!next.userId || next.userId === nodeId)) {
    merged.userId = prev.userId;
  }

  for (const [key, value] of Object.entries(next)) {
    if (value !== '' && value !== undefined && value !== null) continue;
    if (key in prev) {
      // An empty wizard field for something the server has (e.g. an email
      // hidden from this viewer) means "unknown here", not "clear it".
      if (key === 'email' || key === 'userId') merged[key] = prev[key];
    } else {
      // Don't introduce empty keys the server never had.
      delete merged[key];
    }
  }

  return merged;
}

export function preserveServerGraphNodes<T extends Pick<BaseNode, 'id' | 'type' | 'data'>>(
  serverNodes: T[],
  wizardNodes: T[],
): T[] {
  const serverById = new Map(serverNodes.map((node) => [node.id, node]));
  return wizardNodes.map((node) => {
    const prev = serverById.get(node.id);
    if (!prev || prev.type !== node.type) return node;
    return {
      ...node,
      data: preserveServerNodeData(prev.data as NodeData, node.data as NodeData, node.id),
    };
  });
}
