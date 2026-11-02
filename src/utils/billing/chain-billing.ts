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

/** Hops from the worker's employer up the billsTo chain (first billsTo target per party, cycle-safe). */
export function billingPathFor(workerNodeId: string, parties: ChainParty[]): ChainHop[] {
  const byId = new Map(parties.map((party) => [party.id, party]));
  const hops: ChainHop[] = [];
  const seen = new Set<string>();
  let current = employerOf(workerNodeId, parties);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const nextId = (current.billsTo || []).find((id) => byId.has(id) && id !== current!.id);
    if (!nextId) break;
    hops.push({ sellerId: current.id, buyerId: nextId });
    current = byId.get(nextId);
  }
  return hops;
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
} {
  const nameOf = new Map(input.parties.map((party) => [party.id, party.name]));
  const groups = new Map<string, ChainInvoiceGroup<W>>();
  const missing = new Map<string, MissingHopRate>();
  const unrouted: W[] = [];

  for (const week of input.weeks) {
    const workerId = input.workerIdOf(week);
    const path = billingPathFor(workerId, input.parties);
    if (path.length === 0) {
      unrouted.push(week);
      continue;
    }
    const keys = input.weekKeysOf(week);
    path.forEach((hop, index) => {
      if (!input.canBillSeller(hop.sellerId)) return;
      const already = input.invoicedKeysBySeller.get(hop.sellerId);
      if (keys.some((key) => already?.has(key) || input.unattributedInvoicedKeys?.has(key))) return;
      const rate = resolveHopRate(hop, workerId, input.linkRates, input.legacyRates, index === path.length - 1);
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

  // A seller invoice with a missing worker price is not generated at all: no
  // partial invoices that silently under-bill.
  const blocked = new Set([...missing.values()].map((item) => `${item.sellerId}>${item.buyerId}`));
  return {
    groups: [...groups.entries()].filter(([key]) => !blocked.has(key)).map(([, group]) => group),
    missing: [...missing.values()],
    unrouted,
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
  const path = billingPathFor(workerNodeId, parties);
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
