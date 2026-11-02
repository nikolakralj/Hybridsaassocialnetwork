import { describe, expect, it } from 'vitest';
import { explicitPositiveRate, explicitWorkTypeRates } from '../../supabase/functions/server/contract-rate';

describe('contract rates', () => {
  it('does not turn a missing rate into a number', () => {
    expect(explicitPositiveRate(undefined)).toBeNull();
    expect(explicitPositiveRate(0)).toBeNull();
    expect(explicitPositiveRate('')).toBeNull();
    expect(explicitPositiveRate(95)).toBe(95);
  });

  it('keeps only rates a person sent and does not add travel, overtime or on-call', () => {
    expect(explicitWorkTypeRates(undefined)).toBeNull();
    expect(explicitWorkTypeRates({ regular: 40 })).toEqual({ regular: 40 });
    expect(explicitWorkTypeRates({ regular: 40, travel: 0 })).toEqual({ regular: 40 });
    const sent = explicitWorkTypeRates({ overtime: 60 });
    expect(sent).toEqual({ overtime: 60 });
    expect(sent).not.toHaveProperty('travel');
    expect(sent).not.toHaveProperty('onCall');
  });
});
