import { buildViewerOptions } from '../../components/workgraph/graph-visibility';
import type { BaseEdge, BaseNode } from '../../types/workgraph';
import type { ApprovalParty } from './approval-fallback';

export interface ScopedNameDirectoryEntry {
  name: string;
  type: string;
  orgId?: string;
}

export function buildScopedGraphDirectories(nodes: BaseNode[], edges: BaseEdge[]) {
  const viewerOptions = buildViewerOptions(nodes, edges);
  const nameDirectory: Record<string, ScopedNameDirectoryEntry> = {};
  const personOrgFromViewers = new Map<string, string>();

  viewerOptions.forEach((viewer) => {
    if (viewer.nodeId === '__admin__') return;
    nameDirectory[viewer.nodeId] = {
      name: viewer.name,
      type: viewer.type,
      orgId: viewer.orgId,
    };
    if (viewer.orgId) personOrgFromViewers.set(viewer.nodeId, viewer.orgId);
  });

  nodes.forEach((node) => {
    if (node.type === 'party' && node.data?.name && !nameDirectory[node.id]) {
      nameDirectory[node.id] = { name: node.data.name, type: 'party' };
    }
  });

  const approvalDirectory = nodes
    .filter((node) => node.type === 'party')
    .map((partyNode) => {
      const partyId = partyNode.id;
      const people = nodes
        .filter((node) => node.type === 'person' && (
          node.data?.partyId === partyId ||
          node.data?.orgId === partyId ||
          personOrgFromViewers.get(node.id) === partyId
        ))
        .map((personNode) => ({
          id: personNode.id,
          name: personNode.data?.name || personNode.id,
          canApprove: personNode.data?.canApprove === true,
        }));

      const billsTo = edges
        .filter((edge) => (
          edge.source === partyId &&
          ['billsTo', 'subcontracts', 'bills_to'].includes(String(edge.data?.edgeType || edge.type))
        ))
        .map((edge) => edge.target);

      return {
        id: partyId,
        name: partyNode.data?.name || partyId,
        partyType: partyNode.data?.partyType || 'company',
        billsTo,
        people,
        isCreator: partyNode.data?.isCreator === true,
        isProjectOwner: partyNode.data?.isProjectOwner === true,
      } satisfies ApprovalParty;
    });

  return { nameDirectory, approvalDirectory };
}
