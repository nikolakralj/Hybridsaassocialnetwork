/**
 * Rates present on a graph payload the server already scoped.
 * A missing rate stays missing. Nothing here fills in a number.
 */

export type ScopedRateType = 'hourly' | 'daily' | 'fixed' | 'unknown';

export interface ScopedPersonRate {
  personId: string;
  personName?: string;
  rate: number;
  rateType: ScopedRateType;
  currency?: string;
  masked: boolean;
}

const MASK_PLACEHOLDER = '••••';

function asNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() && value !== MASK_PLACEHOLDER) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function rateFromScopedNode(node: unknown): ScopedPersonRate | null {
  if (!node || typeof node !== 'object') return null;
  const record = node as { id?: unknown; type?: unknown; data?: unknown };
  if (record.type !== 'person' || typeof record.id !== 'string' || !record.id) return null;
  const data = record.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : null;
  if (!data) return null;

  const hourlyRaw = data.hourlyRate;
  const dailyRaw = data.dailyRate;
  const fixedRaw = data.fixedAmount;
  const masked = hourlyRaw === MASK_PLACEHOLDER || dailyRaw === MASK_PLACEHOLDER || fixedRaw === MASK_PLACEHOLDER;
  const contractType = text(data.contractType).toLowerCase();

  let rateType: ScopedRateType = 'unknown';
  let rate = 0;
  if ((contractType === 'hourly' || !contractType) && asNumber(hourlyRaw) > 0) {
    rateType = 'hourly';
    rate = asNumber(hourlyRaw);
  } else if (contractType === 'daily' && asNumber(dailyRaw) > 0) {
    rateType = 'daily';
    rate = asNumber(dailyRaw);
  } else if (contractType === 'fixed' && asNumber(fixedRaw) > 0) {
    rateType = 'fixed';
    rate = asNumber(fixedRaw);
  } else if (asNumber(dailyRaw) > 0) {
    rateType = 'daily';
    rate = asNumber(dailyRaw);
  } else if (asNumber(hourlyRaw) > 0) {
    rateType = 'hourly';
    rate = asNumber(hourlyRaw);
  } else if (asNumber(fixedRaw) > 0) {
    rateType = 'fixed';
    rate = asNumber(fixedRaw);
  }

  if (rate <= 0 && !masked) return null;

  const personName = text(data.name ?? data.label);
  const currency = text(data.currency).toUpperCase();
  return {
    personId: record.id,
    personName: personName || undefined,
    rate,
    rateType,
    currency: currency || undefined,
    masked,
  };
}

export function ratesFromScopedGraph(graph: { nodes?: unknown } | null | undefined): Record<string, ScopedPersonRate> {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const rates: Record<string, ScopedPersonRate> = {};
  nodes.forEach((node) => {
    const personRate = rateFromScopedNode(node);
    if (!personRate || personRate.rate <= 0) return;
    rates[personRate.personId] = personRate;
  });
  return rates;
}
