// Pure supply-chain update rules for PUT /projects/:id (no Deno/npm imports,
// so the same file is unit-tested with vitest from src/).
//
// Who may change what:
//   * every manager may change their own organization, its people, and its
//     own billing connections;
//   * only a structure manager (project owner, or an Editor of the creator
//     organization) may ADD or REMOVE organizations. A removed party takes its
//     people and connections with it; other parties' billsTo lists may only
//     lose the removed ids. Whether a party may be removed at all (hours,
//     invoices, accepted members) is checked by the caller against the DB.

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").sort() : [];
}

export function sameStringList(left: unknown, right: unknown): boolean {
  return stableJson(stringList(left)) === stableJson(stringList(right));
}

export function idSet(values: unknown[]): Set<string> {
  return new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0));
}

export function projectParties(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray((value as any).parties)) return (value as any).parties;
  return [];
}

export function nodeOwnerId(node: any): string | null {
  return (
    (typeof node?.data?.partyId === "string" && node.data.partyId) ||
    (typeof node?.data?.orgId === "string" && node.data.orgId) ||
    null
  );
}

function ownedNodeIds(nodes: any[], owners: Set<string>): Set<string> {
  const owned = new Set<string>(owners);
  for (const node of nodes) {
    if (node?.id && (owners.has(node.id) || owners.has(nodeOwnerId(node) || ""))) owned.add(node.id);
  }
  return owned;
}

function edgeSignature(edge: any): string {
  return stableJson({ id: edge?.id, type: edge?.type, source: edge?.source, target: edge?.target, data: edge?.data || {} });
}

function isPartyConnectionEdge(edge: any, partyIds: Set<string>): boolean {
  return (
    partyIds.has(edge?.source) &&
    partyIds.has(edge?.target) &&
    ["billsTo", "bills_to", "subcontracts"].includes(edge?.data?.edgeType || edge?.type)
  );
}

function protectedNodeData(node: any): Record<string, unknown> {
  const data = node?.data && typeof node.data === "object" ? { ...node.data } : {};
  // Layout recalculation can legitimately move the whole chain.
  delete data.chainPosition;
  return data;
}

export function supplyChainStructureDiff(existingProject: any, body: any): { added: string[]; removed: string[] } {
  if (!Array.isArray(body?.parties)) return { added: [], removed: [] };
  const current = idSet(projectParties(existingProject?.parties).map((party: any) => party?.id));
  const next = idSet(body.parties.map((party: any) => party?.id));
  return {
    added: [...next].filter((id) => !current.has(id)),
    removed: [...current].filter((id) => !next.has(id)),
  };
}

export interface SupplyChainGuardOptions {
  /** Project owner, or Editor of the creator organization. */
  allowStructure?: boolean;
}

export function assertScopedSupplyChainUpdate(
  existingProject: any,
  body: any,
  callerScope: string | null,
  options: SupplyChainGuardOptions = {},
) {
  if (body.graph === undefined && body.parties === undefined) return;
  if (!callerScope) throw new Error("Map your active membership to an organization before editing the supply chain");
  if (!body.graph || !Array.isArray(body.graph.nodes) || !Array.isArray(body.graph.edges) || !Array.isArray(body.parties)) {
    throw new Error("Supply-chain updates require a complete graph and party snapshot");
  }

  const currentById = new Map<any, any>(projectParties(existingProject.parties).map((party: any) => [party?.id, party]));
  const nextById = new Map<any, any>(body.parties.map((party: any) => [party?.id, party]));
  if (!currentById.has(callerScope)) throw new Error("Your organization is not part of this project supply chain");

  const { added, removed } = supplyChainStructureDiff(existingProject, body);
  const addedSet = new Set(added);
  const removedSet = new Set(removed);
  if (removedSet.has(callerScope)) throw new Error("You cannot remove your own organization from the project");
  if (!options.allowStructure) {
    if (removed.length > 0) {
      throw new Error("Organizations are archived through a governed project workflow, not removed from another party's editor");
    }
    if (added.length > 0) throw new Error("Adding an organization requires a governed project-structure workflow");
  }

  for (const [partyId, currentParty] of currentById) {
    if (removedSet.has(partyId)) continue;
    const nextParty = nextById.get(partyId);
    if (partyId === callerScope) {
      if (nextParty?.partyType !== currentParty?.partyType) {
        throw new Error("An organization type cannot be changed after the project is active");
      }
      continue;
    }
    // Another existing party: unchanged, except that it stops billing a
    // party that is being removed.
    const expectedBillsTo = stringList(currentParty?.billsTo).filter((id) => !removedSet.has(id));
    if (
      nextParty?.name !== currentParty?.name ||
      nextParty?.partyType !== currentParty?.partyType ||
      !sameStringList(nextParty?.billsTo, expectedBillsTo)
    ) {
      throw new Error("You can only change your own organization and its billing connection");
    }
  }

  const currentNodes = Array.isArray(existingProject.graph?.nodes) ? existingProject.graph.nodes : [];
  const nextNodeById = new Map<any, any>(body.graph.nodes.map((node: any) => [node?.id, node]));
  const currentNodeIds = new Set(currentNodes.map((node: any) => node?.id));
  for (const node of currentNodes) {
    const nextNode = nextNodeById.get(node?.id);
    const owner = node?.type === "party" ? node?.id : nodeOwnerId(node);
    if (owner && removedSet.has(owner)) {
      if (nextNode) throw new Error("A removed organization's records must be removed with it");
      continue;
    }
    if (node?.type === "party") {
      if (node?.id === callerScope) continue;
      if (!nextNode || stableJson(protectedNodeData(nextNode)) !== stableJson(protectedNodeData(node))) {
        throw new Error("You cannot edit another organization's party node");
      }
      continue;
    }
    if (owner === callerScope) continue;
    if (!nextNode || stableJson((nextNode as any).data || {}) !== stableJson(node.data || {})) {
      throw new Error("You cannot edit people or records owned by another organization");
    }
  }

  for (const node of body.graph.nodes) {
    if (currentNodeIds.has(node?.id)) continue;
    if (node?.type === "party") {
      if (!addedSet.has(node?.id)) throw new Error("Adding an organization requires a governed project-structure workflow");
      continue;
    }
    const owner = nodeOwnerId(node);
    if (owner !== callerScope && !(owner && addedSet.has(owner))) {
      throw new Error("You can only add people or records owned by your organization");
    }
  }

  // Connections: the caller's own records, plus anything touching an added
  // or removed organization (structure managers only, checked above).
  const currentEdges = Array.isArray(existingProject.graph?.edges) ? existingProject.graph.edges : [];
  const nextEdges = body.graph.edges;
  const partyIds = idSet([
    ...projectParties(existingProject.parties).map((party: any) => party?.id),
    ...added,
  ]);
  const ownedIds = new Set([
    ...ownedNodeIds(currentNodes, new Set([callerScope])),
    ...ownedNodeIds(body.graph.nodes, new Set([callerScope])),
  ]);
  const structuralIds = new Set([
    ...ownedNodeIds(currentNodes, new Set([...added, ...removed])),
    ...ownedNodeIds(body.graph.nodes, new Set([...added, ...removed])),
  ]);
  const edgeCanChange = (edge: any) => {
    if (structuralIds.has(edge?.source) || structuralIds.has(edge?.target)) return true;
    if (isPartyConnectionEdge(edge, partyIds)) return edge?.source === callerScope;
    return ownedIds.has(edge?.source) || ownedIds.has(edge?.target);
  };
  const currentBySignature = new Map(currentEdges.map((edge: any) => [edgeSignature(edge), edge]));
  const nextBySignature = new Map(nextEdges.map((edge: any) => [edgeSignature(edge), edge]));
  for (const [signature, edge] of currentBySignature) {
    if (!nextBySignature.has(signature) && !edgeCanChange(edge)) {
      throw new Error("You cannot change another organization's graph connections");
    }
  }
  for (const [signature, edge] of nextBySignature) {
    if (!currentBySignature.has(signature) && !edgeCanChange(edge)) {
      throw new Error("You cannot change another organization's graph connections");
    }
  }
}

function positiveNumber(value: unknown): boolean {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0;
}

/**
 * A timesheet week that records real work: anything past draft, or a draft
 * with hours on any day. Opening the Timesheets tab creates empty draft weeks;
 * those must not count as activity that blocks removing a company.
 */
export function isTimesheetWeekWithWork(row: { status?: string | null; data?: unknown }): boolean {
  if (row?.status && row.status !== "draft") return true;
  const data = row?.data && typeof row.data === "object" ? row.data as Record<string, unknown> : {};
  const days = Array.isArray(data.days) ? data.days : [];
  return days.some((day: any) => (
    positiveNumber(day?.hours)
    || positiveNumber(day?.totalHours)
    || (Array.isArray(day?.entries) && day.entries.some((entry: any) => positiveNumber(entry?.hours)))
  ));
}

/** Why a party cannot be removed; empty when removal is allowed. */
export function partyRemovalBlockers(activity: {
  acceptedMembers: number;
  timesheetWeeks: number;
  invoices: number;
}): string[] {
  const reasons: string[] = [];
  if (activity.timesheetWeeks > 0) reasons.push(`${activity.timesheetWeeks} timesheet week(s)`);
  if (activity.invoices > 0) reasons.push(`${activity.invoices} invoice(s)`);
  if (activity.acceptedMembers > 0) reasons.push(`${activity.acceptedMembers} member(s) who already joined`);
  return reasons;
}
