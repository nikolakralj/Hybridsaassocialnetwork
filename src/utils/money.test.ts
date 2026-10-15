import { describe, expect, it } from 'vitest';
import { lineAmount, roundMoney, sumMoney, taxOn } from './money';

describe('roundMoney', () => {
  it('rounds half away from zero at the cent, including binary-trap values', () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.675)).toBe(2.68);
    expect(roundMoney(-10.005)).toBe(-10.01);
    expect(roundMoney(10.004)).toBe(10);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('treats non-finite input as zero instead of propagating NaN', () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('invoice arithmetic', () => {
  it('rounds each line, sums rounded lines, and rounds VAT on that subtotal', () => {
    const lines = [lineAmount(1, 10.005), lineAmount(3, 33.333)];
    expect(lines).toEqual([10.01, 100]);
    const subtotal = sumMoney(lines);
    expect(subtotal).toBe(110.01);
    expect(taxOn(subtotal, 25)).toBe(27.5);
    expect(taxOn(100.01, 25)).toBe(25);
  });
});
