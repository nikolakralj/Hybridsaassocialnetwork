// Per-link rates (migration 044, wg_link_rates). RLS decides who reads what:
// a company sees only the rates on links it is party to; a worker sees their
// own employment rate. Until 044 is applied the table does not exist and every
// call degrades to "not available" instead of failing the caller.

import { createClient } from '../supabase/client';
import type { LinkRate } from '../billing/chain-billing';

const supabase = createClient();

export interface LinkRatesResult {
  available: boolean;
  rates: LinkRate[];
  error?: string;
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || /wg_link_rates/.test(error.message || '') && /not find|does not exist/i.test(error.message || '');
}

export function rowToLinkRate(row: any): LinkRate {
  return {
    id: String(row.id),
    kind: row.link_kind === 'employment' ? 'employment' : 'supply',
    sellerPartyId: String(row.seller_party_id),
    buyerPartyId: row.buyer_party_id ? String(row.buyer_party_id) : null,
    subjectNodeId: row.subject_graph_node_id ? String(row.subject_graph_node_id) : null,
    amount: Number(row.amount) || 0,
    rateType: row.rate_type === 'daily' || row.rate_type === 'fixed' ? row.rate_type : 'hourly',
    currency: String(row.currency || 'EUR').toUpperCase(),
  };
}

export async function listLinkRates(projectId: string): Promise<LinkRatesResult> {
  if (!projectId) return { available: false, rates: [] };
  const { data, error } = await supabase
    .from('wg_link_rates')
    .select('id, link_kind, seller_party_id, buyer_party_id, subject_graph_node_id, amount, rate_type, currency')
    .eq('project_id', projectId)
    .is('effective_to', null);
  if (error) {
    if (isMissingTable(error)) return { available: false, rates: [] };
    return { available: false, rates: [], error: error.message };
  }
  return { available: true, rates: (data || []).map(rowToLinkRate).filter((rate) => rate.amount > 0) };
}

export interface SaveLinkRateInput {
  projectId: string;
  kind: 'supply' | 'employment';
  sellerPartyId: string;
  buyerPartyId?: string | null;
  subjectNodeId?: string | null;
  amount: number;
  rateType?: 'hourly' | 'daily' | 'fixed';
  currency?: string;
}

/** Insert or update the one active rate for a link. RLS rejects non-parties. */
export async function saveLinkRate(input: SaveLinkRateInput): Promise<LinkRate> {
  if (!(input.amount > 0)) throw new Error('Rate must be greater than 0');
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  if (!userId) throw new Error('You must be signed in to save rates.');

  let lookup = supabase
    .from('wg_link_rates')
    .select('id')
    .eq('project_id', input.projectId)
    .eq('link_kind', input.kind)
    .eq('seller_party_id', input.sellerPartyId)
    .is('effective_to', null);
  lookup = input.buyerPartyId ? lookup.eq('buyer_party_id', input.buyerPartyId) : lookup.is('buyer_party_id', null);
  lookup = input.subjectNodeId ? lookup.eq('subject_graph_node_id', input.subjectNodeId) : lookup.is('subject_graph_node_id', null);
  const { data: existing, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) {
    if (isMissingTable(lookupError)) throw new Error('Per-link rates need database migration 044, which is not applied yet.');
    throw new Error(lookupError.message);
  }

  const row = {
    project_id: input.projectId,
    link_kind: input.kind,
    seller_party_id: input.sellerPartyId,
    buyer_party_id: input.kind === 'supply' ? input.buyerPartyId || null : null,
    subject_graph_node_id: input.subjectNodeId || null,
    amount: input.amount,
    rate_type: input.rateType || 'hourly',
    currency: (input.currency || 'EUR').toUpperCase(),
  };
  const query = existing?.id
    ? supabase.from('wg_link_rates').update(row).eq('id', existing.id).select('*').single()
    : supabase.from('wg_link_rates').insert({ ...row, created_by: userId }).select('*').single();
  const { data, error } = await query;
  if (error) throw new Error(error.message || 'Could not save the rate');
  return rowToLinkRate(data);
}
