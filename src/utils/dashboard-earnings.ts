import { roundMoney } from './money';

export interface SavedContractRate {
  baseHourlyRate?: number | null;
  currency?: string | null;
}

export interface KnownMoney {
  amount: number;
  currency: string;
  known: boolean;
}

/** Average of saved positive rates, only when they share one currency. */
export function averageSavedRate(contracts: SavedContractRate[]): { rate: number; currency: string } | null {
  const usable = contracts.filter((contract) =>
    typeof contract.baseHourlyRate === 'number' && Number.isFinite(contract.baseHourlyRate) && contract.baseHourlyRate > 0
  );
  if (usable.length === 0) return null;
  if (usable.some((contract) => !(contract.currency || '').trim())) return null;
  const currencies = [...new Set(
    usable.map((contract) => (contract.currency || '').trim().toUpperCase()),
  )];
  if (currencies.length !== 1) return null;
  const rate = usable.reduce((sum, contract) => sum + (contract.baseHourlyRate as number), 0) / usable.length;
  return { rate, currency: currencies[0] };
}

/** Hours times a saved rate. No rate and no currency are filled in. */
export function moneyFromHours(hours: number, contracts: SavedContractRate[]): KnownMoney {
  const saved = averageSavedRate(contracts);
  if (!saved) return { amount: 0, currency: '', known: false };
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
  return { amount: roundMoney(safeHours * saved.rate), currency: saved.currency, known: true };
}

export function formatKnownMoney(amount: number, currency: string): string {
  const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}
