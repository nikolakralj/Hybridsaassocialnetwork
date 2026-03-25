import type { PartyType } from '../../types/workgraph';

export interface ApprovalPerson {
  id: string;
  name: string;
  canApprove?: boolean;
}

export interface ApprovalParty {
  id: string;
  name: string;
  partyType: PartyType;
  billsTo: string[];
  people: ApprovalPerson[];
  /** Optional metadata from graph generation / persisted approval payloads. */
  isCreator?: boolean;
  isProjectOwner?: boolean;
}

export interface ApprovalStep {
  step: number;
  partyId: string;
  partyType: PartyType;
  approverIds: string[];
  mode: 'same-company' | 'upstream' | 'project-owner' | 'client';
}

function sortDeterministically<T extends { name: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function sortIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function getApprovers(party: ApprovalParty): ApprovalPerson[] {
  return sortDeterministically(party.people.filter((p) => p.canApprove));
}

function logFallbackDecision(message: string, details: Record<string, unknown>): void {
  if (typeof console === 'undefined' || typeof console.debug !== 'function') return;
  console.debug(`[approval-fallback] ${message}`, details);
}

function logFallbackWarning(message: string, details: Record<string, unknown>): void {
  if (typeof console === 'undefined' || typeof console.warn !== 'function') return;
  console.warn(`[approval-fallback] ${message}`, details);
}

function buildTraversal(
  submitterPartyId: string,
  partyMap: Map<string, ApprovalParty>,
): {
  reachableParties: ApprovalParty[];
  depthByPartyId: Map<string, number>;
} {
  const depthByPartyId = new Map<string, number>([[submitterPartyId, 0]]);
  const reachableParties: ApprovalParty[] = [];
  const seen = new Set<string>([submitterPartyId]);
  let frontier = [submitterPartyId];
  let depth = 0;

  while (frontier.length > 0) {
    const next: string[] = [];
    const orderedFrontier = frontier.sort((a, b) => a.localeCompare(b));

    for (const partyId of orderedFrontier) {
      const party = partyMap.get(partyId);
      if (!party) continue;

      if (partyId !== submitterPartyId) reachableParties.push(party);

      const billsTo = sortDeterministically(
        party.billsTo
          .map((targetId) => partyMap.get(targetId))
          .filter((value): value is ApprovalParty => Boolean(value)),
      );

      for (const target of billsTo) {
        if (!depthByPartyId.has(target.id)) {
          depthByPartyId.set(target.id, depth + 1);
        }
        if (seen.has(target.id)) continue;
        seen.add(target.id);
        next.push(target.id);
      }
    }

    frontier = next;
    depth += 1;
  }

  return { reachableParties, depthByPartyId };
}

function pickDeterministicParty(parties: ApprovalParty[], depthByPartyId?: Map<string, number>): ApprovalParty | null {
  if (parties.length === 0) return null;
  const sorted = sortDeterministically(parties);

  if (!depthByPartyId) return sorted[0];

  const maxDepth = Math.max(...sorted.map((party) => depthByPartyId.get(party.id) ?? 0));
  return sortDeterministically(sorted.filter((party) => (depthByPartyId.get(party.id) ?? 0) === maxDepth))[0] ?? null;
}

function getProjectOwnerParty(
  submitterPartyId: string,
  traversal: { reachableParties: ApprovalParty[]; depthByPartyId: Map<string, number> },
): ApprovalParty | null {
  const explicitOwner = traversal.reachableParties.filter((party) => party.isProjectOwner || party.isCreator);
  const explicitChoice = pickDeterministicParty(explicitOwner);
  if (explicitChoice) {
    logFallbackDecision('Project owner selected from explicit graph metadata', {
      submitterPartyId,
      ownerPartyId: explicitChoice.id,
    });
    return explicitChoice;
  }

  const reachableIds = new Set<string>([submitterPartyId, ...traversal.reachableParties.map((party) => party.id)]);
  const rootCandidates = traversal.reachableParties.filter((party) =>
    party.billsTo.filter((targetId) => reachableIds.has(targetId)).length === 0
  );
  const rootChoice = pickDeterministicParty(rootCandidates, traversal.depthByPartyId);
  if (rootChoice) {
    logFallbackDecision('Project owner inferred from furthest reachable upstream party', {
      submitterPartyId,
      ownerPartyId: rootChoice.id,
    });
    return rootChoice;
  }

  const fallbackChoice = pickDeterministicParty(traversal.reachableParties, traversal.depthByPartyId);
  if (fallbackChoice) {
    logFallbackDecision('Project owner fallback resolved via deterministic graph ordering', {
      submitterPartyId,
      ownerPartyId: fallbackChoice.id,
    });
  }
  return fallbackChoice;
}

function findNearestUpstreamApproverParty(
  submitterPartyId: string,
  partyMap: Map<string, ApprovalParty>,
): { party: ApprovalParty; depth: number } | null {
  const submitterParty = partyMap.get(submitterPartyId);
  if (!submitterParty) return null;

  const seen = new Set<string>([submitterPartyId]);
  let frontier = sortDeterministically(
    submitterParty.billsTo
      .map((targetId) => partyMap.get(targetId))
      .filter((value): value is ApprovalParty => Boolean(value)),
  );
  let depth = 1;

  while (frontier.length > 0) {
    const levelApprovers = frontier
      .map((party) => ({ party, approvers: getApprovers(party) }))
      .filter((entry) => entry.approvers.length > 0);

    if (levelApprovers.length > 0) {
      const selected = pickDeterministicParty(levelApprovers.map((entry) => entry.party));
      if (selected) {
        logFallbackDecision('Nearest upstream approver party selected', {
          submitterPartyId,
          depth,
          partyId: selected.id,
        });
        return { party: selected, depth };
      }
    }

    const nextIds: string[] = [];
    for (const party of frontier) {
      for (const targetId of sortIds(party.billsTo)) {
        if (seen.has(targetId)) continue;
        seen.add(targetId);
        const target = partyMap.get(targetId);
        if (!target) continue;
        nextIds.push(target.id);
      }
    }

    frontier = sortDeterministically(nextIds.map((id) => partyMap.get(id)).filter((value): value is ApprovalParty => Boolean(value)));
    depth += 1;
  }

  return null;
}

export function getApprovalStepsForParty(
  submitterPartyId: string,
  parties: ApprovalParty[],
): ApprovalStep[] {
  const partyMap = new Map(parties.map((p) => [p.id, p]));
  const submitterParty = partyMap.get(submitterPartyId);
  if (!submitterParty) {
    logFallbackWarning('Unable to resolve submitter party for approval routing', {
      submitterPartyId,
      availableParties: parties.length,
    });
    return [];
  }

  const localApprovers = getApprovers(submitterParty);
  if (localApprovers.length > 0) {
    return [{
      step: 1,
      partyId: submitterParty.id,
      partyType: submitterParty.partyType,
      approverIds: localApprovers.map((p) => p.id),
      mode: 'same-company',
    }];
  }

  logFallbackDecision('No approvers in submitter org; checking upstream routing', {
    submitterPartyId,
    submitterPartyType: submitterParty.partyType,
    submitterPartyName: submitterParty.name,
  });

  const upstreamChoice = findNearestUpstreamApproverParty(submitterPartyId, partyMap);
  if (upstreamChoice) {
    return [{
      step: 1,
      partyId: upstreamChoice.party.id,
      partyType: upstreamChoice.party.partyType,
      approverIds: getApprovers(upstreamChoice.party).map((p) => p.id),
      mode: 'upstream',
    }];
  }

  logFallbackDecision('No upstream approver found; checking project owner fallback', {
    submitterPartyId,
    submitterPartyType: submitterParty.partyType,
    submitterPartyName: submitterParty.name,
  });

  const traversal = buildTraversal(submitterPartyId, partyMap);
  const ownerChoice = getProjectOwnerParty(submitterPartyId, traversal);
  if (ownerChoice) {
    const ownerApprovers = getApprovers(ownerChoice);
    if (ownerApprovers.length > 0) {
      return [{
        step: 1,
        partyId: ownerChoice.id,
        partyType: ownerChoice.partyType,
        approverIds: ownerApprovers.map((p) => p.id),
        mode: 'project-owner',
      }];
    }

    logFallbackWarning('Project owner fallback party has no approvers configured', {
      submitterPartyId,
      ownerPartyId: ownerChoice.id,
      ownerPartyName: ownerChoice.name,
    });
  }

  logFallbackWarning('No deterministic approval path could be resolved', {
    submitterPartyId,
    submitterPartyName: submitterParty.name,
  });
  return [];
}

export function canViewerApproveSubmitter(
  viewerId: string | undefined,
  submitterPersonId: string,
  parties: ApprovalParty[],
): boolean {
  if (!viewerId) return false;

  const submitterParty = parties.find((p) => p.people.some((person) => person.id === submitterPersonId));
  if (!submitterParty) return false;

  const steps = getApprovalStepsForParty(submitterParty.id, parties);
  return steps.some((s) => s.approverIds.includes(viewerId));
}
