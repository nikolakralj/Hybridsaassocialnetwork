/**
 * DevApprovalChainPanel — DEV-ONLY test scaffolding.
 *
 * WHY THIS EXISTS: the multi-party chain (Rodman → Nikola → G2 → NAS) can't be
 * walked with real logins yet, because G2 and NAS are graph party nodes with no
 * human accounts (counterparty invitation flow not built). This panel lets the
 * project OWNER advance every pending layer themselves so the full money loop
 * (submit → approve → invoice) can be exercised end-to-end by one person.
 *
 * IT BYPASSES NOTHING. It calls the same approveItem()/rejectItem() as the real
 * queue. Every write still goes through RLS — it only works because the owner is
 * legitimately allowed to update approval records in their own project
 * (migration 014: `wg_user_owns_project OR approver_user_id = auth.uid()`), and
 * the DB trigger (026) still owns the canonical week sync. No new DB objects.
 *
 * REMOVE BEFORE PILOTS: delete this file + its guarded mount in
 * ProjectApprovalsTab. It is additionally gated behind import.meta.env.DEV, so
 * it is never present in a production bundle even if the mount is forgotten.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldAlert, Check, X, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import {
  approveItem,
  getApprovalQueue,
  type ApprovalQueueItem,
} from '../../utils/api/approvals-supabase';

interface DevApprovalChainPanelProps {
  projectId: string;
}

interface Row {
  id: string;
  person: string;
  period: string;
  approverName: string;
  layer: number;
  subjectType: string;
}

function describe(item: ApprovalQueueItem): Row {
  const snap = (item.subjectSnapshot ?? {}) as Record<string, any>;
  const person = snap.submitterName || snap.title || item.submitterUserId || 'Unknown';
  const start = snap.periodStart || '';
  const end = snap.periodEnd || '';
  const period = start && end ? `${start} → ${end}` : (start || '—');
  return {
    id: item.id,
    person,
    period,
    approverName: item.approverName || snap.currentApproverName || `layer ${item.approvalLayer}`,
    layer: item.approvalLayer,
    subjectType: item.subjectType,
  };
}

export function DevApprovalChainPanel({ projectId }: DevApprovalChainPanelProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const items = await getApprovalQueue({ projectId, status: 'pending' });
      setRows(items.map(describe).sort((a, b) => a.person.localeCompare(b.person) || a.period.localeCompare(b.period)));
    } catch (error) {
      console.error('[dev-chain] load failed', error);
      toast.error('Could not load pending approvals.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (row: Row, action: 'approve' | 'reject') => {
    setActingId(row.id);
    try {
      if (action === 'approve') {
        const res = await approveItem(row.id);
        toast.success(
          res.spawnedNextLayer
            ? `Approved as ${row.approverName} → advanced to next approver.`
            : `Approved as ${row.approverName} → final layer, week is now approved.`,
        );
      } else {
        const { rejectItem } = await import('../../utils/api/approvals-supabase');
        await rejectItem(row.id, { reason: '[dev] rejected via chain panel' });
        toast.success(`Rejected as ${row.approverName}.`);
      }
      await load();
      window.dispatchEvent(new CustomEvent('workgraph-approvals-updated', {
        detail: { projectId, at: new Date().toISOString() },
      }));
    } catch (error) {
      console.error('[dev-chain] action failed', error);
      toast.error(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      setActingId(null);
    }
  }, [load, projectId]);

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-800">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Dev chain walker — bypasses nothing, owner privilege only. Remove before pilots.
          </span>
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-amber-800" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 mb-0 text-xs text-amber-700">
          {loading ? 'Loading…' : 'No pending approvals anywhere in this project. The chain is fully walked.'}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2">
              <div className="min-w-0 text-xs">
                <span className="font-medium text-slate-900">{row.person}</span>
                <span className="text-slate-400"> · {row.subjectType} · {row.period}</span>
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                  waiting on {row.approverName} (L{row.layer})
                </span>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  className="h-7 bg-emerald-600 px-2.5 text-[11px] hover:bg-emerald-700"
                  onClick={() => void act(row, 'approve')}
                  disabled={actingId === row.id}
                >
                  {actingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Approve as {row.approverName}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[11px] text-rose-600"
                  onClick={() => void act(row, 'reject')}
                  disabled={actingId === row.id}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
