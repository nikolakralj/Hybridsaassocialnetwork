import { describe, expect, it } from 'vitest';
import { formatKnownMoney, moneyFromHours } from './dashboard-earnings';

describe('dashboard earnings', () => {
  it('does not invent 100 or a currency when no rate is saved', () => {
    expect(moneyFromHours(40, [])).toEqual({ amount: 0, currency: '', known: false });
    expect(moneyFromHours(40, [{ baseHourlyRate: 0, currency: 'USD' }])).toEqual({
      amount: 0,
      currency: '',
      known: false,
    });
    expect(moneyFromHours(40, [{ baseHourlyRate: 80 }])).toEqual({ amount: 0, currency: '', known: false });
  });

  it('uses the saved rate and its currency', () => {
    expect(moneyFromHours(8, [{ baseHourlyRate: 12.5, currency: 'eur' }])).toEqual({
      amount: 100,
      currency: 'EUR',
      known: true,
    });
    expect(formatKnownMoney(100, 'EUR')).toBe('100.00 EUR');
  });

  it('does not mix two currencies into one total', () => {
    expect(moneyFromHours(8, [
      { baseHourlyRate: 10, currency: 'EUR' },
      { baseHourlyRate: 20, currency: 'USD' },
    ])).toEqual({ amount: 0, currency: '', known: false });
  });
});
