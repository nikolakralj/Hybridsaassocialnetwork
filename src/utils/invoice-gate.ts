/** HTTP status for an invoice the database refused. Null means not a gate error. */

export function invoiceGateStatus(code: string | null | undefined): number | null {
  if (code === '42501') return 403;
  if (code === '23514' || code === '23505') return 422;
  return null;
}
