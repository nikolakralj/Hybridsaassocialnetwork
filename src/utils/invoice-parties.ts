export interface InvoicePartyRef {
  fromPartyId?: string | null;
  toPartyId?: string | null;
  fromPartyName?: string | null;
  toPartyName?: string | null;
}

/** The draft's seller and buyer win. A missing id stays empty. */
export function resolveInvoiceParties(
  draft: InvoicePartyRef,
  fallback: InvoicePartyRef = {},
): Required<Pick<InvoicePartyRef, 'fromPartyId' | 'toPartyId' | 'fromPartyName' | 'toPartyName'>> {
  const pick = (primary?: string | null, secondary?: string | null) => {
    const value = (primary || secondary || '').trim();
    return value;
  };
  return {
    fromPartyId: pick(draft.fromPartyId, fallback.fromPartyId),
    toPartyId: pick(draft.toPartyId, fallback.toPartyId),
    fromPartyName: pick(draft.fromPartyName, fallback.fromPartyName),
    toPartyName: pick(draft.toPartyName, fallback.toPartyName),
  };
}
