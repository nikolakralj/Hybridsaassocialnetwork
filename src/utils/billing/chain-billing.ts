/**
 * Pass-through billing along the supply chain.
 *
 * An approved worker-week is billed once per hop of the billing chain that
 * starts at the worker's employer: Sub -> Agency -> Client gives two
 * invoices, Sub bills Agency and Agency bills Client, each at the rate on
 * that link. Margins are never stored on an invoice; a party sees its margin
 * only by comparing the rates it can already read (see linkMargin).
 */

export type RateType = 'hourly' | 'daily' | 'fixed';

export interface LinkRate {
  id?: string;
  kind: 'supply' | 'employment';
  sellerPartyId: string;
  buyerPartyId: string | null;
  subjectNodeId: string | null;
  amount: number;
  rateType: RateType;
  currency: string;
}

export interface HopRate {
  personId: string;
  rate: number;
  rateType: RateType;
  currency?: string;
  masked: boolean;
  source: 'link-worker' | 'link' | 'legacy-person';
}

export interface ChainParty {
  id: string;
  name?: string;
  partyType?: string;
  billsTo?: string[];
  people?: Array<{ id: string; name?: string }>;
}

export interface ChainHop {
  sellerId: string;
  buyerId: string;
}

/** Party that employs (owns) the worker node. */
export function employerOf(workerNodeId: string, parties: ChainParty[]): ChainParty | undefined {
  return parties.find((party) => (party.people || []).some((person) => person.id === workerNodeId));
}

/**
 * Hops from the worker's employer up the billsTo chain (cycle-safe).
 *
 * A party that bills more than one company on the project (e.g. a sub shared
 * by two agencies) is ambiguous: the worker's buyer is the one with a
 * worker-specific supply rate from that party, when exactly one has it.
 * Otherwise the walk stops there and `ambiguousAt` names the party, so the
 * caller can ask for a per-worker rate instead of guessing a buyer.
 */
export function resolveBillingPath(
  workerNodeId: string,
  parties: ChainParty[],
  linkRates: LinkRate[] = [],
): { hops: ChainHop[]; ambiguousAt?: string } {
  const byId = new Map(parties.map((party) => [party.id, party]));
  const hops: ChainHop[] = [];
  const seen = new Set<string>();
  let current = employerOf(workerNodeId, parties);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const sellerId = current.id;
    const targets = Array.from(new Set((current.billsTo || []).filter((id) => byId.has(id) && id !== sellerId)));
    if (targets.length === 0) break;
    let nextId: string | undefined = targets[0];
    if (targets.length > 1) {
      const pinned = targets.filter((buyerId) => linkRates.some((rate) => rate.kind === 'supply'
        && rate.sellerPartyId === sellerId
        && rate.buyerPartyId === buyerId
        && rate.subjectNodeId === workerNodeId));
      if (pinned.length !== 1) return { hops, ambiguousAt: sellerId };
      nextId = pinned[0];
    }
    hops.push({ sellerId, buyerId: nextId });
    current = byId.get(nextId);
  }
  return { hops };
}

export function billingPathFor(workerNodeId: string, parties: ChainParty[], linkRates: LinkRate[] = []): ChainHop[] {
  return resolveBillingPath(workerNodeId, parties, linkRates).hops;
}

/**
 * Price for one hop: per-worker link rate, else the link rate, else (legacy,
 * only on the hop that ends at the final buyer) the worker's old per-person
 * bill rate, so single-rate projects keep billing exactly as before.
 */
export function resolveHopRate(
  hop: ChainHop,
  workerNodeId: string,
  linkRates: LinkRate[],
  legacyRates: Record<string, { rate: number; rateType?: string; currency?: string; masked?: boolean } | undefined>,
  isFinalHop: boolean,
): HopRate | undefined {
  const supply = linkRates.filter((rate) => rate.kind === 'supply'
    && rate.sellerPartyId === hop.sellerId
    && rate.buyerPartyId === hop.buyerId
    && rate.amount > 0);
  const perWorker = supply.find((rate) => rate.subjectNodeId === workerNodeId);
  const general = supply.find((rate) => !rate.subjectNodeId);
  const chosen = perWorker || general;
  if (chosen) {
    return {
      personId: workerNodeId,
      rate: chosen.amount,
      rateType: chosen.rateType,
      currency: chosen.currency,
      masked: false,
      source: perWorker ? 'link-worker' : 'link',
    };
  }
  if (!isFinalHop) return undefined;
  const legacy = legacyRates[workerNodeId];
  if (!legacy || legacy.masked || !(legacy.rate > 0)) return undefined;
  const legacyType = legacy.rateType === 'daily' || legacy.rateType === 'fixed' ? legacy.rateType : 'hourly';
  return { personId: workerNodeId, rate: legacy.rate, rateType: legacyType, currency: legacy.currency, masked: false, source: 'legacy-person' };
}

export interface ChainInvoiceGroup<W> {
  sellerId: string;
  sellerName?: string;
  buyerId: string;
  buyerName?: string;
  weeks: W[];
  /** keyed by worker graph node id; only this hop's prices */
  rates: Record<string, HopRate>;
}

export interface MissingHopRate {
  sellerId: string;
  sellerName?: string;
  buyerId: string;
  buyerName?: string;
  workerId: string;
}

export interface PlanChainInvoicesInput<W> {
  weeks: W[];
  parties: ChainParty[];
  linkRates: LinkRate[];
  legacyRates: Record<string, { rate: number; rateType?: string; currency?: string; masked?: boolean } | undefined>;
  workerIdOf: (week: W) => string;
  weekKeysOf: (week: W) => string[];
  /** Which sellers the caller may invoice for. */
  canBillSeller: (sellerId: string) => boolean;
  /** Timesheet keys already invoiced, per seller party id. */
  invoicedKeysBySeller: Map<string, Set<string>>;
  /** Keys on old invoices with no seller recorded: treated as invoiced for every hop. */
  unattributedInvoicedKeys?: Set<string>;
}

export function planChainInvoices<W>(input: PlanChainInvoicesInput<W>): {
  groups: ChainInvoiceGroup<W>[];
  missing: MissingHopRate[];
  /** weeks whose worker has no employer/billsTo path at all */
  unrouted: W[];
  /** workers whose chain reaches a party billing several companies, with no per-worker rate to pick one */
  ambiguous: Array<{ workerId: string; partyId: string; partyName?: string }>;
} {
  const nameOf = new Map(input.parties.map((party) => [party.id, party.name]));
  const groups = new Map<string, ChainInvoiceGroup<W>>();
  const missing = new Map<string, MissingHopRate>();
  const unrouted: W[] = [];
  const ambiguous = new Map<string, { workerId: string; partyId: string; partyName?: string }>();

  for (const week of input.weeks) {
    const workerId = input.workerIdOf(week);
    const { hops: path, ambiguousAt } = resolveBillingPath(workerId, input.parties, input.linkRates);
    if (ambiguousAt) {
      // Hops before the ambiguous party are still billed; from there on the
      // buyer is unknown, so nothing is guessed.
      ambiguous.set(`${workerId}>${ambiguousAt}`, { workerId, partyId: ambiguousAt, partyName: nameOf.get(ambiguousAt) });
    }
    if (path.length === 0) {
      if (!ambiguousAt) unrouted.push(week);
      continue;
    }
    const keys = input.weekKeysOf(week);
    path.forEach((hop, index) => {
      if (!input.canBillSeller(hop.sellerId)) return;
      const already = input.invoicedKeysBySeller.get(hop.sellerId);
      if (keys.some((key) => already?.has(key) || input.unattributedInvoicedKeys?.has(key))) return;
      const rate = resolveHopRate(hop, workerId, input.linkRates, input.legacyRates, !ambiguousAt && index === path.length - 1);
      if (!rate) {
        missing.set(`${hop.sellerId}>${hop.buyerId}>${workerId}`, {
          ...hop,
          sellerName: nameOf.get(hop.sellerId),
          buyerName: nameOf.get(hop.buyerId),
          workerId,
        });
        return;
      }
      const groupKey = `${hop.sellerId}>${hop.buyerId}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          ...hop,
          sellerName: nameOf.get(hop.sellerId),
          buyerName: nameOf.get(hop.buyerId),
          weeks: [],
          rates: {},
        });
      }
      const group = groups.get(groupKey)!;
      group.weeks.push(week);
      group.rates[workerId] = rate;
    });
  }

  // A worker with no price on a hop is left out of that hop's invoice (and
  // reported in `missing`); the other workers on the hop are still invoiced.
  // Their weeks stay un-invoiced for that seller, so the next Generate after
  // the rate is set bills them. Blocking the whole hop for one missing rate
  // stopped an agency's entire monthly invoice for one new hire.
  return {
    groups: [...groups.values()],
    missing: [...missing.values()],
    unrouted,
    ambiguous: [...ambiguous.values()],
  };
}

/**
 * Margin a party earns on a worker: what it sells the worker's hour for minus
 * what it pays for it (incoming supply link, or its own employment rate).
 * Returns null unless the caller can read both sides, which RLS only allows
 * for the party in the middle.
 */
export function linkMargin(
  partyId: string,
  workerNodeId: string,
  parties: ChainParty[],
  linkRates: LinkRate[],
): { sell: LinkRate; cost: LinkRate; margin: number } | null {
  const path = billingPathFor(workerNodeId, parties, linkRates);
  const outIndex = path.findIndex((hop) => hop.sellerId === partyId);
  if (outIndex < 0) return null;
  const pick = (hop: ChainHop) => {
    const supply = linkRates.filter((rate) => rate.kind === 'supply' && rate.sellerPartyId === hop.sellerId && rate.buyerPartyId === hop.buyerId);
    return supply.find((rate) => rate.subjectNodeId === workerNodeId) || supply.find((rate) => !rate.subjectNodeId);
  };
  const sell = pick(path[outIndex]);
  const cost = outIndex === 0
    ? linkRates.find((rate) => rate.kind === 'employment' && rate.sellerPartyId === partyId && rate.subjectNodeId === workerNodeId)
    : pick(path[outIndex - 1]);
  if (!sell || !cost || sell.rateType !== cost.rateType || sell.currency !== cost.currency) return null;
  return { sell, cost, margin: Math.round((sell.amount - cost.amount) * 100) / 100 };
}

/**
 * Close readiness: a worker on a billing chain has a billing rate when every
 * hop of the chain has a rate this viewer can read. The rate reported is the
 * final hop's (what the end client is billed). Workers with no chain are
 * left out (the legacy per-person rate decides for them).
 */
export function chainBillingRates(
  workerNodeIds: string[],
  parties: ChainParty[],
  linkRates: LinkRate[],
  legacyRates: Record<string, { rate: number; rateType?: string; currency?: string; masked?: boolean } | undefined>,
): Record<string, HopRate> {
  const result: Record<string, HopRate> = {};
  workerNodeIds.forEach((workerId) => {
    const { hops: path, ambiguousAt } = resolveBillingPath(workerId, parties, linkRates);
    if (path.length === 0 || ambiguousAt) return;
    const hops = path.map((hop, index) => resolveHopRate(hop, workerId, linkRates, legacyRates, index === path.length - 1));
    if (hops.every(Boolean)) result[workerId] = hops[hops.length - 1]!;
  });
  return result;
}
