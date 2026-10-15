/**
 * Money rounding shared by invoice generation, the invoice API body, and the
 * print view, so the same invoice never shows two different totals.
 *
 * Rule: round each line to the cent, half away from zero (commercial rounding),
 * subtotal = sum of rounded lines, VAT = rounded(subtotal × rate), total =
 * subtotal + VAT.
 *
 * Math.round(x * 100) / 100 is not used: 10.005 * 100 is 1000.4999… in binary
 * floating point, which would round 10.005 down to 10.00.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? -1 : 1;
  // toFixed(10) settles representation noise (10.005 -> "10.0050000000")
  // before shifting by two decimal places in decimal, not binary.
  const shifted = Number(`${Math.abs(value).toFixed(10)}e2`);
  const rounded = Number(`${Math.round(shifted)}e-2`);
  return sign * rounded || 0;
}

export function lineAmount(quantity: number, unitPrice: number): number {
  return roundMoney((Number(quantity) || 0) * (Number(unitPrice) || 0));
}

export function sumMoney(amounts: number[]): number {
  return roundMoney(amounts.reduce((acc, amount) => acc + roundMoney(amount), 0));
}

/** VAT on an already-rounded subtotal; taxRatePercent is e.g. 25 for 25 %. */
export function taxOn(subtotal: number, taxRatePercent: number): number {
  return roundMoney((Number(subtotal) || 0) * (Number(taxRatePercent) || 0) / 100);
}
