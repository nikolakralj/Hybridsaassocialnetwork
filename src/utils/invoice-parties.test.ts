import { describe, expect, it } from 'vitest';
import { resolveInvoiceParties } from './invoice-parties';

describe('resolveInvoiceParties', () => {
  it('keeps the consolidated draft seller and buyer', () => {
    expect(resolveInvoiceParties(
      { fromPartyId: 'party_agency', toPartyId: 'party_client', fromPartyName: 'Agency', toPartyName: 'Client' },
      { fromPartyId: 'party_other', toPartyId: 'party_end', fromPartyName: 'Other', toPartyName: 'End' },
    )).toEqual({
      fromPartyId: 'party_agency',
      toPartyId: 'party_client',
      fromPartyName: 'Agency',
      toPartyName: 'Client',
    });
  });

  it('does not substitute the project id when no party is known', () => {
    expect(resolveInvoiceParties({}, {})).toEqual({
      fromPartyId: '',
      toPartyId: '',
      fromPartyName: '',
      toPartyName: '',
    });
  });
});
