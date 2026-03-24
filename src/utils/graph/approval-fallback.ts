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
}

export interface ApprovalStep {
  step: number;
  partyId: string;
  partyType: PartyType;
  approverIds: string[];
  mode: 'same-company' | 'upstream' | 'client';
}

function getApprovers(party: ApprovalParty): ApprovalPerson[] {
  return party.people.filter((p) => p.canApprove);
}

export function getApprovalStepsForParty(
  submitterPartyId: string,
  parties: ApprovalParty[],
): ApprovalStep[] {
  const partyMap = new Map(parties.map((p) => [p.id, p]));
  const submitterParty = partyMap.get(submitterPartyId);
  if (!submitterParty) return [];

  const steps: ApprovalStep[] = [];
  let step = 1;

  const seenParties = new Set<string>([submitterPartyId]);
  const localApprovers = getApprovers(submitterParty);
  if (localApprovers.length > 0) {
    steps.push({
      step: step++,
      partyId: submitterParty.id,
      partyType: submitterParty.partyType,
      approverIds: localApprovers.map((p) => p.id),
      mode: 'same-company',
    });
  }

  // Upstream fallback: closest ancestor(s) with approvers.
  let frontier = [...submitterParty.billsTo];
  while (frontier.length > 0) {
    const next: string[] = [];
    const levelMatches: ApprovalStep[] = [];

    for (const partyId of frontier) {
      if (seenParties.has(partyId)) continue;
      seenParties.add(partyId);
      const party = partyMap.get(partyId);
      if (!party) continue;

      const approvers = getApprovers(party);
      if (approvers.length > 0) {
        levelMatches.push({
          step,
          partyId: party.id,
          partyType: party.partyType,
          approverIds: approvers.map((p) => p.id),
          mode: 'upstream',
        });
      } else {
        next.push(...party.billsTo);
      }
    }

    if (levelMatches.length > 0) {
      steps.push(...levelMatches);
      step += 1;
      break;
    }

    frontier = next;
  }

  // Final client fallback if no client approver already in steps.
  const hasClientStep = steps.some((s) => s.partyType === 'client');
  if (!hasClientStep) {
    const clientSteps: ApprovalStep[] = parties
      .filter((party) => party.partyType === 'client')
      .map((party) => {
        const approvers = getApprovers(party);
        if (approvers.length === 0) return null;
        return {
          step,
          partyId: party.id,
          partyType: party.partyType,
          approverIds: approvers.map((p) => p.id),
          mode: 'client' as const,
        };
      })
      .filter((v): v is ApprovalStep => Boolean(v));

    if (clientSteps.length > 0) {
      steps.push(...clientSteps);
    }
  }

  return steps;
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
