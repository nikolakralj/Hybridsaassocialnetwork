// Per-link rates in the node drawer (migration 044, wg_link_rates).
// Party node: the billing links it is on (who bills whom, at what rate) and,
// where the viewer can read both sides, its margin per worker. Person node:
// the employment (pay) rate set by the employer. The server (RLS) decides
// which rates come back; this component never derives a hidden rate.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { listLinkRates, saveLinkRate } from '../../utils/api/link-rates-api';
import { linkMargin, type ChainParty, type LinkRate } from '../../utils/billing/chain-billing';
import { buildScopedGraphDirectories } from '../../utils/graph/scoped-graph-directories';
import type { BaseEdge, BaseNode } from '../../types/workgraph';
import type { ViewerIdentity, VisibleEdge, VisibleNode } from './graph-visibility';

const BILLING_EDGE_TYPES = new Set(['billsTo', 'bills_to', 'subcontracts']);

interface LinkRow {
  key: string;
  kind: 'supply' | 'employment';
  sellerId: string;
  buyerId: string | null;
  subjectId: string | null;
  label: string;
  rate?: LinkRate;
}

function edgeKind(edge: VisibleEdge): string {
  return String((edge as any).data?.edgeType || edge.type || '');
}

export function LinkRatesSection({
  projectId,
  node,
  nodes,
  edges,
  viewer,
}: {
  projectId: string;
  node: VisibleNode;
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  viewer: ViewerIdentity;
}) {
  const [rates, setRates] = useState<LinkRate[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const result = await listLinkRates(projectId).catch(() => ({ available: false, rates: [] as LinkRate[] }));
    setAvailable(result.available);
    setRates(result.rates);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const nameOf = useCallback((id: string | null) => {
    if (!id) return '';
    const found = nodes.find((n) => n.id === id);
    return String(found?.data?.name || id);
  }, [nodes]);

  const rows: LinkRow[] = useMemo(() => {
    if (node.type === 'party') {
      return edges
        .filter((edge) => BILLING_EDGE_TYPES.has(edgeKind(edge)) && (edge.source === node.id || edge.target === node.id))
        .map((edge) => {
          const rate = rates.find((r) => r.kind === 'supply' && r.sellerPartyId === edge.source && r.buyerPartyId === edge.target && !r.subjectNodeId);
          return {
            key: `supply:${edge.source}>${edge.target}`,
            kind: 'supply' as const,
            sellerId: edge.source,
            buyerId: edge.target,
            subjectId: null,
            label: `${nameOf(edge.source)} → ${nameOf(edge.target)}`,
            rate,
          };
        });
    }
    if (node.type === 'person') {
      const employer = String(node.data?.partyId || node.data?.orgId || '');
      if (!employer) return [];
      const rate = rates.find((r) => r.kind === 'employment' && r.sellerPartyId === employer && r.subjectNodeId === node.id);
      return [{
        key: `employment:${employer}>${node.id}`,
        kind: 'employment' as const,
        sellerId: employer,
        buyerId: null,
        subjectId: node.id,
        label: `${nameOf(employer)} pays ${String(node.data?.name || 'this person')}`,
        rate,
      }];
    }
    return [];
  }, [edges, nameOf, node, rates]);

  const viewerParty = viewer.orgId || viewer.nodeId;
  const canEdit = (row: LinkRow) => viewer.type === 'admin'
    || viewerParty === row.sellerId
    || (row.kind === 'supply' && viewerParty === row.buyerId);

  const margins = useMemo(() => {
    if (node.type !== 'party' || rates.length === 0) return [];
    const parties = buildScopedGraphDirectories(nodes as BaseNode[], edges as BaseEdge[]).approvalDirectory as ChainParty[];
    return nodes
      .filter((n) => n.type === 'person')
      .map((person) => ({ person, result: linkMargin(node.id, person.id, parties, rates) }))
      .filter((entry) => entry.result !== null);
  }, [edges, node, nodes, rates]);

  if (rows.length === 0) return null;

  const handleSave = async (row: LinkRow) => {
    const amount = Number(value.replace(',', '.'));
    if (!(amount > 0)) {
      toast.error('Enter a rate greater than 0.');
      return;
    }
    setSaving(true);
    try {
      await saveLinkRate({
        projectId,
        kind: row.kind,
        sellerPartyId: row.sellerId,
        buyerPartyId: row.buyerId,
        subjectNodeId: row.subjectId,
        amount,
        currency: row.rate?.currency || 'EUR',
      });
      setEditingKey(null);
      await reload();
      toast.success('Rate saved. Only the companies on this link can see it.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the rate.';
      toast.error(/row-level security/i.test(message) ? 'Only the companies on this link can set its rate.' : message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="link-rates">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {node.type === 'party' ? 'Link rates' : 'Pay rate (employment)'}
      </div>
      {available === false ? (
        <div className="rounded-md bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
          Per-link rates are not enabled on this database yet (migration 044).
        </div>
      ) : rows.map((row) => (
        <div key={row.key} className="rounded-md bg-muted/30 px-2.5 py-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{row.label}</span>
            {row.rate ? (
              <span className="font-medium text-foreground">{row.rate.currency} {row.rate.amount.toLocaleString()}/hr</span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400"><Lock className="h-3 w-3" /> Not set or not visible to you</span>
            )}
          </div>
          {editingKey === row.key ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <input
                className="h-7 w-24 rounded border border-border bg-background px-2 text-xs"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="Rate per hour"
                inputMode="decimal"
              />
              <Button size="sm" className="h-7 px-2 text-[11px]" disabled={saving} onClick={() => void handleSave(row)}>Save</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => setEditingKey(null)}>Cancel</Button>
            </div>
          ) : canEdit(row) && available ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-6 px-2 text-[11px]"
              onClick={() => { setValue(row.rate ? String(row.rate.amount) : ''); setEditingKey(row.key); }}
            >
              <Pencil className="mr-1 h-3 w-3" />{row.rate ? 'Edit rate' : 'Set rate'}
            </Button>
          ) : null}
        </div>
      ))}
      {margins.length > 0 && (
        <div className="space-y-1">
          {margins.map(({ person, result }) => (
            <div key={person.id} className="flex justify-between rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800">
              <span>Your margin on {String(person.data?.name || person.id)}</span>
              <span className="font-medium">{result!.sell.currency} {result!.margin.toLocaleString()}/hr</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
