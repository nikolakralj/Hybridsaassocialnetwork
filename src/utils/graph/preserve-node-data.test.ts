import { describe, expect, it } from 'vitest';
import { preserveServerGraphNodes, preserveServerNodeData } from './preserve-node-data';

describe('preserveServerNodeData', () => {
  it('keeps the linked account and hidden email of another org approver', () => {
    const server = { name: 'Cleo', userId: 'auth-uuid', partyId: 'p2', canApprove: true };
    const wizard = { name: 'Cleo', email: '', userId: 'person-1', partyId: 'p2', canApprove: true, role: 'PM' };
    expect(preserveServerNodeData(server, wizard, 'person-1')).toEqual({
      name: 'Cleo', userId: 'auth-uuid', partyId: 'p2', canApprove: true, role: 'PM',
    });
  });

  it('keeps fields the wizard does not edit and applies the ones it does', () => {
    const server = { name: 'Wes', currency: 'EUR', contractType: 'hourly', canViewRates: false };
    const wizard = { name: 'Wes', canViewRates: true };
    expect(preserveServerNodeData(server, wizard, 'n')).toEqual({
      name: 'Wes', currency: 'EUR', contractType: 'hourly', canViewRates: true,
    });
  });

  it('passes new nodes through unchanged', () => {
    const nodes = preserveServerGraphNodes(
      [{ id: 'a', type: 'person', data: { name: 'A' } }] as any,
      [{ id: 'b', type: 'person', data: { name: 'B', email: '' } }] as any,
    );
    expect(nodes[0].data).toEqual({ name: 'B', email: '' });
  });
});
