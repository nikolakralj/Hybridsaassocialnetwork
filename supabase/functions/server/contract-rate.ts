/**
 * A contract rate is only a number a person sent.
 * Travel, overtime and on-call percentages are not filled in.
 */

export function explicitPositiveRate(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function explicitWorkTypeRates(
  value: unknown,
): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const rates: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const rate = explicitPositiveRate(raw);
    if (!key.trim() || rate == null) continue;
    rates[key] = rate;
  }
  return Object.keys(rates).length > 0 ? rates : null;
}
