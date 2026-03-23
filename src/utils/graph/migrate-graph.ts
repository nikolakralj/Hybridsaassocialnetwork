import type { BaseEdge, BaseNode } from '../../types/workgraph';

export interface GraphMigrationSummary {
  personPartyLinksAdded: number;
  employsEdgesAdded: number;
}

export interface GraphMigrationResult {
  nodes: BaseNode[];
  edges: BaseEdge[];
  changed: boolean;
  summary: GraphMigrationSummary;
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isPerson(node: BaseNode): boolean {
  return node.type === 'person';
}

function isParty(node: BaseNode): boolean {
  return node.type === 'party';
}

function isEmploysEdge(edge: BaseEdge): boolean {
  return edge.data?.edgeType === 'employs' || edge.data?.edgeType === 'assigns' || edge.type === 'assigns';
}

export function migrateGraphForVisibility(nodes: BaseNode[], edges: BaseEdge[]): GraphMigrationResult {
  const partyIds = new Set(nodes.filter(isParty).map((n) => n.id));
  const partyNameToId = new Map<string, string>();
  nodes.filter(isParty).forEach((party) => {
    const normalized = normalizeName(party.data?.name);
    if (normalized && !partyNameToId.has(normalized)) {
      partyNameToId.set(normalized, party.id);
    }
  });

  const personToParty = new Map<string, string>();
  edges.forEach((edge) => {
    if (!isEmploysEdge(edge)) return;
    if (partyIds.has(edge.source)) {
      personToParty.set(edge.target, edge.source);
    }
  });

  nodes.filter(isPerson).forEach((person) => {
    if (personToParty.has(person.id)) return;
    const directPartyId =
      person.data?.partyId ||
      person.data?.orgId ||
      person.data?.organizationId ||
      person.data?.organization_id ||
      person.data?.companyId;

    if (typeof directPartyId === 'string' && partyIds.has(directPartyId)) {
      personToParty.set(person.id, directPartyId);
      return;
    }

    const byName = normalizeName(person.data?.company || person.data?.organizationName || person.data?.orgName);
    const matchedPartyId = partyNameToId.get(byName);
    if (matchedPartyId) {
      personToParty.set(person.id, matchedPartyId);
    }
  });

  const nextNodes = nodes.map((node) => {
    if (!isPerson(node)) return node;
    const partyId = personToParty.get(node.id);
    if (!partyId || node.data?.partyId === partyId) return node;
    return {
      ...node,
      data: {
        ...node.data,
        partyId,
      },
    };
  });

  const existingMembershipKeys = new Set(
    edges
      .filter(isEmploysEdge)
      .map((edge) => `${edge.source}::${edge.target}`)
  );

  const membershipEdges: BaseEdge[] = [...edges];
  let employsEdgesAdded = 0;
  personToParty.forEach((partyId, personId) => {
    const key = `${partyId}::${personId}`;
    if (existingMembershipKeys.has(key)) return;
    membershipEdges.push({
      id: `edge-employs-${partyId}-${personId}`,
      type: 'assigns',
      source: partyId,
      target: personId,
      data: {
        edgeType: 'employs',
        label: 'employs',
      },
    });
    existingMembershipKeys.add(key);
    employsEdgesAdded += 1;
  });

  const personPartyLinksAdded = nextNodes.filter((node, idx) => {
    if (!isPerson(node)) return false;
    return nodes[idx].data?.partyId !== node.data?.partyId;
  }).length;

  const changed = personPartyLinksAdded > 0 || employsEdgesAdded > 0;
  return {
    nodes: nextNodes,
    edges: membershipEdges,
    changed,
    summary: {
      personPartyLinksAdded,
      employsEdgesAdded,
    },
  };
}
