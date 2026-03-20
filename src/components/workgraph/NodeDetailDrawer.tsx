/**
 * NodeDetailDrawer
 * 
 * Interactive detail panel that replaces the old static DetailPanel.
 * Shows contextual data per node type with actionable navigation:
 * 
 * - Person: "My Chain" path, contracts, timesheets, documents, quick actions
 * - Organization: People list, contracts, aggregate hours, actions
 * - Contract: Parties, rate details, covered people, NDAs
 * 
 * The graph becomes a navigation hub: click a node → see real data → jump to pages.
 */

import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import {
  X,
  ChevronRight,
  Clock,
  FileText,
  Receipt,
  ShieldCheck,
  Shield,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
  EyeOff,
  User,
  Users,
  Building2,
  ExternalLink,
  ArrowRight,
  CircleDot,
  Pencil,
  Send,
  ThumbsUp,
  ThumbsDown,
  Undo2,
  Save,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import type { ViewerIdentity, VisibleNode, VisibleEdge } from './graph-visibility';
import {
  getSnapshotForMonth,
  getPersonMonthlyActivity,
} from './graph-data-flows';
import { useTimesheetStoreSafe, sumWeekHours } from '../../contexts/TimesheetDataContext';
import type { StoredWeek, StoredDay } from '../../contexts/TimesheetDataContext';

// ============================================================================
// Types
// ============================================================================

interface NodeDetailDrawerProps {
  selectedId: string;
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  viewer: ViewerIdentity;
  selectedMonth: string;
  onClose: () => void;
  onSelectNode: (id: string) => void;
  onNavigate: (target: string, context?: Record<string, string>) => void;
}

// ============================================================================
// Mock contextual data (would come from KV store in production)
// Timesheet data now lives in TimesheetStore (contexts/TimesheetDataContext)
// ============================================================================

interface PersonContract {
  id: string;
  name: string;
  orgName: string;
  type: string;
  rate?: string;
  rateMasked?: boolean;
  status: 'active' | 'expired' | 'draft';
  startDate: string;
}

interface PersonDocument {
  id: string;
  type: 'nda' | 'compliance' | 'background_check' | 'certification';
  name: string;
  status: 'signed' | 'pending' | 'expired' | 'approved';
  date: string;
  withParty: string;
}

const PERSON_CONTRACTS: Record<string, PersonContract[]> = {
  'user-sarah': [
    { id: 'c-1', name: 'Acme ↔ Enterprise MSA', orgName: 'Acme Dev Studio', type: 'hourly', rate: '$150/hr', status: 'active', startDate: '2025-06-01' },
  ],
  'user-mike': [
    { id: 'c-1', name: 'Acme ↔ Enterprise MSA', orgName: 'Acme Dev Studio', type: 'hourly', rate: '$150/hr', status: 'active', startDate: '2025-06-01' },
  ],
  'user-alex': [
    { id: 'c-3', name: 'Direct Contract', orgName: 'Enterprise ClientCorp', type: 'hourly', rate: '$120/hr', status: 'active', startDate: '2025-07-01' },
  ],
  'user-sophia': [
    { id: 'c-2', name: 'BrightWorks ↔ Enterprise', orgName: 'BrightWorks Agency', type: 'daily', rate: '$1,200/day', status: 'active', startDate: '2025-05-15' },
  ],
  'user-lisa': [
    { id: 'c-1', name: 'Acme ↔ Enterprise MSA', orgName: 'Acme Dev Studio', type: 'hourly', rate: '$130/hr', status: 'active', startDate: '2025-11-01' },
  ],
  'user-oliver': [
    { id: 'c-2', name: 'BrightWorks ↔ Enterprise', orgName: 'BrightWorks Agency', type: 'daily', rate: '$1,000/day', status: 'active', startDate: '2025-05-15' },
  ],
  'user-emma': [
    { id: 'c-2', name: 'BrightWorks ↔ Enterprise', orgName: 'BrightWorks Agency', type: 'daily', rate: '$900/day', status: 'active', startDate: '2025-10-01' },
  ],
  'user-robert': [
    { id: 'c-1', name: 'Acme ↔ Enterprise MSA', orgName: 'Acme Dev Studio', type: 'hourly', rate: '$145/hr', status: 'active', startDate: '2025-10-01' },
  ],
  'user-jordan': [
    { id: 'c-4', name: 'Direct Contract', orgName: 'Enterprise ClientCorp', type: 'hourly', rate: '$110/hr', status: 'active', startDate: '2025-10-15' },
  ],
};

const PERSON_DOCUMENTS: Record<string, PersonDocument[]> = {
  'user-sarah': [
    { id: 'd-1', type: 'nda', name: 'NDA with Enterprise ClientCorp', status: 'signed', date: '2025-06-01', withParty: 'Enterprise ClientCorp' },
    { id: 'd-2', type: 'background_check', name: 'Background verification', status: 'approved', date: '2025-05-20', withParty: 'Acme Dev Studio' },
  ],
  'user-alex': [
    { id: 'd-3', type: 'nda', name: 'NDA with Enterprise ClientCorp', status: 'signed', date: '2025-07-01', withParty: 'Enterprise ClientCorp' },
    { id: 'd-4', type: 'certification', name: 'UX certification', status: 'approved', date: '2025-03-15', withParty: 'Independent' },
  ],
  'user-lisa': [
    { id: 'd-5', type: 'nda', name: 'NDA with Enterprise ClientCorp', status: 'pending', date: '2025-11-01', withParty: 'Enterprise ClientCorp' },
    { id: 'd-6', type: 'background_check', name: 'Background verification', status: 'pending', date: '2025-11-01', withParty: 'Acme Dev Studio' },
  ],
  'user-robert': [
    { id: 'd-7', type: 'nda', name: 'NDA with Enterprise ClientCorp', status: 'signed', date: '2025-10-01', withParty: 'Enterprise ClientCorp' },
    { id: 'd-8', type: 'background_check', name: 'Background verification', status: 'approved', date: '2025-10-03', withParty: 'Acme Dev Studio' },
  ],
};

// ============================================================================
// Chain Visualization (mini breadcrumb path)
// ============================================================================

function MyChainVisualization({
  selectedId,
  nodes,
  edges,
  onSelectNode,
}: {
  selectedId: string;
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  onSelectNode: (id: string) => void;
}) {
  // Build the full approval chain that includes the selected node
  const chain = useMemo(() => {
    const node = nodes.find(n => n.id === selectedId);
    if (!node) return [];

    // Build directed adjacency: person → org → client (forward)
    // and reverse adjacency for walking backward from orgs/clients to people
    const forward = new Map<string, string[]>();
    const backward = new Map<string, string[]>();

    edges.forEach(e => {
      const edgeType = e.data?.edgeType;
      if (edgeType === 'employs' || edgeType === 'assigns') {
        // Edge: org → person. Forward = person → org
        if (!forward.has(e.target)) forward.set(e.target, []);
        forward.get(e.target)!.push(e.source);
        if (!backward.has(e.source)) backward.set(e.source, []);
        backward.get(e.source)!.push(e.target);
      } else if (edgeType === 'approves') {
        if (!forward.has(e.source)) forward.set(e.source, []);
        forward.get(e.source)!.push(e.target);
        if (!backward.has(e.target)) backward.set(e.target, []);
        backward.get(e.target)!.push(e.source);
      } else if (edgeType === 'billsTo' || edgeType === 'funds') {
        if (!forward.has(e.source)) forward.set(e.source, []);
        forward.get(e.source)!.push(e.target);
        if (!backward.has(e.target)) backward.set(e.target, []);
        backward.get(e.target)!.push(e.source);
      }
    });

    // Walk backward from selected node to find the chain root (deepest person)
    const walkBack = (startId: string, maxDepth: number): string[] => {
      const path: string[] = [startId];
      const visited = new Set<string>([startId]);
      let current = startId;
      for (let d = 0; d < maxDepth; d++) {
        const preds = backward.get(current) || [];
        const next = preds.find(p => !visited.has(p) && nodes.some(n => n.id === p));
        if (!next) break;
        visited.add(next);
        path.unshift(next);
        current = next;
      }
      return path;
    };

    // Walk forward from selected node to find the chain end (client)
    const walkForward = (startId: string, maxDepth: number, visited: Set<string>): string[] => {
      const path: string[] = [];
      let current = startId;
      for (let d = 0; d < maxDepth; d++) {
        const succs = forward.get(current) || [];
        const next = succs.find(s => !visited.has(s) && nodes.some(n => n.id === s));
        if (!next) break;
        visited.add(next);
        path.push(next);
        current = next;
      }
      return path;
    };

    // Build full chain: walk back to root, then forward to client
    const backPath = walkBack(selectedId, 5);
    const visitedSet = new Set(backPath);
    const rootId = backPath[0];
    const forwardPath = walkForward(backPath[backPath.length - 1], 5, visitedSet);

    // If we walked back, we also need to walk forward from the root
    // (the backPath already includes selected, so combine)
    const fullChainIds = [...backPath, ...forwardPath];

    // Resolve to nodes
    const fullChain = fullChainIds
      .map(id => nodes.find(n => n.id === id))
      .filter(Boolean) as VisibleNode[];

    return fullChain;
  }, [selectedId, nodes, edges]);

  // Auto-scroll the selected node into view — must be before early return to maintain hook order
  const selectedRef = useCallback((el: HTMLButtonElement | null) => {
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    }
  }, []);

  if (chain.length <= 1) return null;

  const iconForNode = (n: VisibleNode) => {
    if (n.type === 'person') return <User className="h-3 w-3" />;
    if (n.type === 'contract') return <FileText className="h-3 w-3" />;
    if (n.data?.partyType === 'client') return <Building2 className="h-3 w-3" />;
    if (n.data?.partyType === 'agency') return <Users className="h-3 w-3" />;
    return <Building2 className="h-3 w-3" />;
  };

  const colorForNode = (n: VisibleNode): string => {
    if (n.id === selectedId) return 'bg-blue-100 border-blue-300 text-blue-700';
    if (n.type === 'person') return 'bg-slate-100 border-slate-200 text-slate-600';
    if (n.type === 'contract') return 'bg-amber-50 border-amber-200 text-amber-600';
    if (n.data?.partyType === 'client') return 'bg-amber-50 border-amber-200 text-amber-600';
    if (n.data?.partyType === 'agency') return 'bg-violet-50 border-violet-200 text-violet-600';
    return 'bg-blue-50 border-blue-200 text-blue-600';
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Your Chain
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {chain.map((n, i) => (
          <React.Fragment key={n.id}>
            <button
              ref={n.id === selectedId ? selectedRef : undefined}
              onClick={() => onSelectNode(n.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-medium whitespace-nowrap transition-colors hover:shadow-sm shrink-0 ${colorForNode(n)}`}
            >
              {iconForNode(n)}
              <span className="max-w-[90px] truncate">{n.data?.name}</span>
            </button>
            {i < chain.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Timesheet Section (daily breakdown + inline edit + approval workflow)
// ============================================================================

/** Mini sparkline bars for daily hours — shown in collapsed week rows */
function DailySparkline({ days, maxHours = 10 }: { days: StoredDay[]; maxHours?: number }) {
  return (
    <div className="flex items-end gap-px h-4">
      {days.map((d, i) => {
        const pct = Math.min(d.hours / maxHours, 1);
        return (
          <div key={i} className="flex flex-col items-center gap-0" title={`${d.day}: ${d.hours}h`}>
            <div
              className={`w-[5px] rounded-sm transition-all ${d.hours === 0 ? 'bg-slate-200' : 'bg-blue-400'}`}
              style={{ height: `${Math.max(pct * 16, 2)}px` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function TimesheetSection({
  personId,
  month,
  viewer,
  edges,
  onNavigate,
}: {
  personId: string;
  month: string;
  viewer: ViewerIdentity;
  edges: VisibleEdge[];
  onNavigate: (target: string) => void;
}) {
  const store = useTimesheetStoreSafe();
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDays, setEditDays] = useState<StoredDay[]>([]);
  const [editTasks, setEditTasks] = useState('');
  const [rejectingIdx, setRejectingIdx] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Read entries from shared store (re-renders on store.version changes)
  const entries: StoredWeek[] = useMemo(() => {
    if (!store) return [];
    return store.getWeeksForPerson(personId, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, store?.version, personId, month]);

  // Reset UI state on person/month change
  useEffect(() => {
    setEditingIdx(null);
    setRejectingIdx(null);
    setExpandedIdx(null);
  }, [personId, month]);

  if (!store || entries.length === 0) return null;

  // Permissions
  const isOwn = viewer.nodeId === personId;
  const isAdmin = viewer.type === 'admin';

  // Approval authority via ReBAC edges
  const canApprove = (() => {
    if (isAdmin) return true;
    if (isOwn) return false;
    const personOrg = edges.find(
      e => (e.data?.edgeType === 'employs' || e.data?.edgeType === 'assigns') && e.target === personId
    )?.source;
    if (!personOrg) return false;
    if (viewer.nodeId === personOrg) return true;
    if (viewer.orgId === personOrg) return true;
    if (edges.some(e => e.data?.edgeType === 'approves' && (e.source === viewer.nodeId || e.source === viewer.orgId) && e.target === personOrg)) return true;
    if (viewer.type === 'client') return true;
    return false;
  })();

  const totalHours = entries.reduce((sum, e) => sum + sumWeekHours(e), 0);
  const approvedHours = entries.filter(e => e.status === 'approved').reduce((sum, e) => sum + sumWeekHours(e), 0);
  const pendingCount = entries.filter(e => e.status === 'submitted' || e.status === 'draft').length;

  const statusIcon: Record<string, React.ReactNode> = {
    draft: <CircleDot className="h-3 w-3 text-slate-400" />,
    submitted: <Clock className="h-3 w-3 text-blue-500" />,
    approved: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
    rejected: <AlertCircle className="h-3 w-3 text-red-500" />,
  };

  const statusColors: Record<string, string> = {
    draft: 'text-slate-500',
    submitted: 'text-blue-600',
    approved: 'text-emerald-600',
    rejected: 'text-red-600',
  };

  // --- Actions (write to shared store) ---

  const handleStartEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditDays(entries[idx].days.map(d => ({ ...d })));
    setEditTasks(entries[idx].tasks.join(', '));
    setExpandedIdx(null);
    setRejectingIdx(null);
  };

  const handleEditDayHours = (dayIdx: number, value: number) => {
    setEditDays(prev => {
      const next = [...prev];
      next[dayIdx] = { ...next[dayIdx], hours: Math.max(0, Math.min(24, value)) };
      return next;
    });
  };

  const sumEditDays = () => editDays.reduce((s, d) => s + d.hours, 0);

  const handleSaveEdit = (idx: number) => {
    const entry = entries[idx];
    const newTasks = editTasks.split(',').map(t => t.trim()).filter(Boolean);
    store.updateWeekDays(personId, entry.weekStart, editDays);
    store.updateWeekTasks(personId, entry.weekStart, newTasks);
    setEditingIdx(null);
    toast.success(`Saved ${entry.weekLabel} timesheet (${sumEditDays()}h)`);
  };

  const handleSubmit = (idx: number) => {
    const entry = entries[idx];
    store.setWeekStatus(personId, entry.weekStart, 'submitted');
    setEditingIdx(null);
    toast.success(`Submitted ${entry.weekLabel} for approval`, { description: 'Waiting for manager review' });
  };

  const handleRecall = (idx: number) => {
    const entry = entries[idx];
    store.setWeekStatus(personId, entry.weekStart, 'draft');
    toast.info(`Recalled ${entry.weekLabel} to draft`);
  };

  const handleApprove = (idx: number) => {
    const entry = entries[idx];
    const hrs = sumWeekHours(entry);
    store.setWeekStatus(personId, entry.weekStart, 'approved', { by: viewer.name });
    toast.success(`Approved ${entry.weekLabel} (${hrs}h)`, { description: `Approved by ${viewer.name}` });
  };

  const handleReject = (idx: number) => { setRejectingIdx(idx); setRejectNote(''); };

  const handleConfirmReject = (idx: number) => {
    const entry = entries[idx];
    store.setWeekStatus(personId, entry.weekStart, 'rejected', { by: viewer.name, note: rejectNote });
    setRejectingIdx(null);
    toast.error(`Rejected ${entry.weekLabel}`, { description: rejectNote || 'No reason provided' });
  };

  const handleApproveAll = () => {
    const ct = store.batchApproveMonth(personId, month, viewer.name);
    toast.success(`Approved all ${ct} submitted timesheets`, { description: `Batch approved by ${viewer.name}` });
  };

  const toggleExpand = (idx: number) => {
    if (editingIdx !== null) return;
    setExpandedIdx(prev => prev === idx ? null : idx);
  };

  const submittedCount = entries.filter(e => e.status === 'submitted').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Timesheets
          {(isOwn || canApprove) && (
            <span className="ml-1.5 text-[9px] font-normal normal-case text-blue-500">
              {isOwn ? '(yours)' : '(can approve)'}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('timesheets')}
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
        >
          View all <ExternalLink className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{totalHours}h</span>
            <span className="text-[10px] text-muted-foreground">total</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${(approvedHours / Math.max(totalHours, 1)) * 100}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground">{approvedHours}h approved</span>
          </div>
        </div>
        {pendingCount > 0 && (
          <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200 border">
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {/* Batch approve button */}
      {canApprove && submittedCount > 1 && (
        <button
          onClick={handleApproveAll}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 transition-colors"
        >
          <ThumbsUp className="h-3 w-3" />
          Approve all {submittedCount} submitted
        </button>
      )}

      {/* Week entries */}
      <div className="space-y-1">
        {entries.map((entry, i) => {
          const weekTotal = sumWeekHours(entry);
          const isExpanded = expandedIdx === i && editingIdx !== i;
          const isEditing = editingIdx === i;
          const isRejecting = rejectingIdx === i;

          return (
            <div key={`${personId}-${month}-${i}`}>
              {/* Main row */}
              <button
                onClick={() => toggleExpand(i)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left ${
                  isEditing ? 'bg-blue-50/60 ring-1 ring-blue-200' :
                  isRejecting ? 'bg-red-50/60 ring-1 ring-red-200' :
                  isExpanded ? 'bg-muted/50' :
                  'hover:bg-muted/40'
                }`}
              >
                {statusIcon[entry.status]}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-foreground">{entry.weekLabel}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {entry.tasks.join(', ')}
                  </div>
                </div>
                <DailySparkline days={entry.days} />
                <span className="text-[12px] font-semibold text-foreground ml-1">{weekTotal}h</span>
                <span className={`text-[10px] font-medium capitalize ${statusColors[entry.status]}`}>
                  {entry.status}
                </span>

                {/* Edit icon for own drafts/rejected (stops propagation to avoid toggle) */}
                {isOwn && (entry.status === 'draft' || entry.status === 'rejected') && !isEditing && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); handleStartEdit(i); }}
                    className="p-1 rounded-md hover:bg-blue-100 text-blue-500 transition-colors"
                    title="Edit daily hours"
                  >
                    <Pencil className="h-3 w-3" />
                  </span>
                )}

                {/* Recall icon for own submitted */}
                {isOwn && entry.status === 'submitted' && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); handleRecall(i); }}
                    className="p-1 rounded-md hover:bg-amber-100 text-amber-500 transition-colors"
                    title="Recall to draft"
                  >
                    <Undo2 className="h-3 w-3" />
                  </span>
                )}
              </button>

              {/* Expanded: read-only daily breakdown (click row to toggle) */}
              {isExpanded && (
                <div className="mx-2.5 mt-1 mb-2 p-2.5 bg-muted/30 rounded-lg border border-border/50">
                  <div className="grid grid-cols-5 gap-1.5">
                    {entry.days.map((d, di) => (
                      <div key={di} className="text-center">
                        <div className="text-[9px] font-medium text-muted-foreground uppercase">{d.day}</div>
                        <div className={`text-[13px] font-semibold mt-0.5 ${d.hours === 0 ? 'text-slate-300' : 'text-foreground'}`}>
                          {d.hours}h
                        </div>
                        {/* Mini bar */}
                        <div className="h-1 mt-1 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${d.hours >= 8 ? 'bg-blue-400' : d.hours > 0 ? 'bg-blue-300' : 'bg-transparent'}`}
                            style={{ width: `${Math.min((d.hours / 10) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Escape hatch to full editor */}
                  <button
                    onClick={() => onNavigate('timesheets')}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[10px] text-blue-600 hover:text-blue-700 font-medium py-1.5 rounded-md hover:bg-blue-50 transition-colors"
                  >
                    <Clock className="h-3 w-3" />
                    Open full editor for start/end times, breaks & notes
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}

              {/* Inline daily edit form */}
              {isEditing && (
                <div className="mx-2.5 mt-1 mb-2 p-3 bg-white rounded-lg border border-blue-200 space-y-3 shadow-sm">
                  {/* Daily hours grid */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Daily Hours</label>
                      <span className="text-[11px] font-semibold text-blue-600">{editDays.reduce((s, d) => s + d.hours, 0)}h total</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {editDays.map((d, di) => (
                        <div key={di} className="text-center">
                          <div className="text-[9px] font-medium text-muted-foreground uppercase mb-1">{d.day}</div>
                          <input
                            type="number"
                            min={0}
                            max={24}
                            value={d.hours}
                            onChange={e => handleEditDayHours(di, Number(e.target.value))}
                            className="w-full h-8 text-center text-[13px] font-semibold rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition-colors"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick fill shortcuts */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-muted-foreground">Quick:</span>
                    {[8, 6, 4, 0].map(h => (
                      <button
                        key={h}
                        onClick={() => setEditDays(prev => prev.map(d => ({ ...d, hours: h })))}
                        className="px-2 py-0.5 text-[9px] font-medium rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                      >
                        All {h}h
                      </button>
                    ))}
                  </div>

                  {/* Tasks */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tasks</label>
                    <input
                      type="text"
                      value={editTasks}
                      onChange={e => setEditTasks(e.target.value)}
                      placeholder="Task 1, Task 2, ..."
                      className="w-full h-7 px-2.5 text-[11px] rounded-md border border-slate-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleSaveEdit(i)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium hover:bg-slate-200 transition-colors"
                    >
                      <Save className="h-3 w-3" /> Save draft
                    </button>
                    <button
                      onClick={() => { handleSaveEdit(i); setTimeout(() => handleSubmit(i), 50); }}
                      className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md bg-blue-500 text-white text-[11px] font-medium hover:bg-blue-600 transition-colors"
                    >
                      <Send className="h-3 w-3" /> Submit
                    </button>
                    <button
                      onClick={() => setEditingIdx(null)}
                      className="h-7 px-2 rounded-md border border-slate-200 text-slate-400 text-[11px] hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Escape hatch */}
                  <button
                    onClick={() => onNavigate('timesheets')}
                    className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground hover:text-blue-600 font-medium py-1 rounded-md hover:bg-blue-50/50 transition-colors"
                  >
                    Need start/end times or breaks? Open full timesheet editor
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                </div>
              )}

              {/* Approval actions for submitted entries */}
              {canApprove && entry.status === 'submitted' && !isRejecting && !isEditing && (
                <div className="mx-2.5 mt-1 mb-1 flex items-center gap-1.5">
                  <button
                    onClick={() => handleApprove(i)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium hover:bg-emerald-100 transition-colors"
                  >
                    <ThumbsUp className="h-3 w-3" /> Approve
                  </button>
                  <button
                    onClick={() => handleReject(i)}
                    className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md bg-red-50 border border-red-200 text-red-600 text-[11px] font-medium hover:bg-red-100 transition-colors"
                  >
                    <ThumbsDown className="h-3 w-3" /> Reject
                  </button>
                </div>
              )}

              {/* Reject with note */}
              {isRejecting && (
                <div className="mx-2.5 mt-1 mb-2 p-3 bg-white rounded-lg border border-red-200 space-y-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-red-600 uppercase tracking-wider">
                    <MessageSquare className="h-3 w-3" /> Rejection Note
                  </div>
                  <input
                    type="text"
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="Reason for rejection (optional)..."
                    autoFocus
                    className="w-full h-7 px-2.5 text-[11px] rounded-md border border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleConfirmReject(i)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-7 rounded-md bg-red-500 text-white text-[11px] font-medium hover:bg-red-600 transition-colors"
                    >
                      <ThumbsDown className="h-3 w-3" /> Confirm Reject
                    </button>
                    <button
                      onClick={() => setRejectingIdx(null)}
                      className="h-7 px-3 rounded-md border border-slate-200 text-slate-400 text-[11px] hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Contracts Section
// ============================================================================

function ContractsSection({
  personId,
  viewer,
  onNavigate,
}: {
  personId: string;
  viewer: ViewerIdentity;
  onNavigate: (target: string) => void;
}) {
  const contracts = PERSON_CONTRACTS[personId];
  if (!contracts || contracts.length === 0) return null;

  // Mask rates if viewer doesn't have access
  const shouldMaskRate = viewer.type === 'client' || (viewer.type === 'agency' && personId.startsWith('user-'));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Contracts
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate('contracts')}
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
        >
          View all <ExternalLink className="h-2.5 w-2.5" />
        </Button>
      </div>

      <div className="space-y-1.5">
        {contracts.map(c => (
          <button
            key={c.id}
            onClick={() => onNavigate('contracts')}
            className="w-full flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left group border border-transparent hover:border-border"
          >
            <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-foreground truncate">{c.name}</div>
              <div className="text-[10px] text-muted-foreground">{c.orgName}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[9px] capitalize">{c.type}</Badge>
                {shouldMaskRate ? (
                  <span className="text-[10px] text-slate-300 flex items-center gap-0.5">
                    <Lock className="h-2.5 w-2.5" /> Rate hidden
                  </span>
                ) : c.rate ? (
                  <span className="text-[10px] font-semibold text-foreground">{c.rate}</span>
                ) : null}
                <Badge
                  variant="outline"
                  className={`text-[9px] ${c.status === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                >
                  {c.status}
                </Badge>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors mt-1" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Documents Section
// ============================================================================

function DocumentsSection({ personId }: { personId: string }) {
  const docs = PERSON_DOCUMENTS[personId];
  if (!docs || docs.length === 0) return null;

  const docIcons: Record<string, React.ReactNode> = {
    nda: <ShieldCheck className="h-3 w-3 text-violet-500" />,
    compliance: <FileCheck className="h-3 w-3 text-cyan-500" />,
    background_check: <FileCheck className="h-3 w-3 text-blue-500" />,
    certification: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  };

  const statusColors: Record<string, string> = {
    signed: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    expired: 'bg-red-100 text-red-600',
    approved: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Documents & Compliance
      </div>
      <div className="space-y-1.5">
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/30">
            {docIcons[doc.type] || <FileText className="h-3 w-3 text-slate-400" />}
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium text-foreground truncate">{doc.name}</div>
              <div className="text-[10px] text-muted-foreground">with {doc.withParty}</div>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${statusColors[doc.status] || 'bg-slate-100 text-slate-500'}`}>
              {doc.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Quick Actions
// ============================================================================

function QuickActions({
  node,
  onNavigate,
}: {
  node: VisibleNode;
  onNavigate: (target: string) => void;
}) {
  const actions: { label: string; icon: React.ReactNode; target: string; color: string }[] = [];

  if (node.type === 'person') {
    actions.push(
      { label: 'View Timesheets', icon: <Clock className="h-3.5 w-3.5" />, target: 'timesheets', color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
      { label: 'View Contracts', icon: <FileText className="h-3.5 w-3.5" />, target: 'contracts', color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
      { label: 'View Approvals', icon: <CheckCircle2 className="h-3.5 w-3.5" />, target: 'approvals', color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
    );
  } else if (node.type === 'party') {
    actions.push(
      { label: 'View Timesheets', icon: <Clock className="h-3.5 w-3.5" />, target: 'timesheets', color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100' },
      { label: 'View Contracts', icon: <FileText className="h-3.5 w-3.5" />, target: 'contracts', color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
    );
  } else if (node.type === 'contract') {
    actions.push(
      { label: 'Open Contract', icon: <FileText className="h-3.5 w-3.5" />, target: 'contracts', color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100' },
      { label: 'View Approvals', icon: <CheckCircle2 className="h-3.5 w-3.5" />, target: 'approvals', color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100' },
    );
  }

  if (actions.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Quick Actions
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {actions.map(action => (
          <button
            key={action.label}
            onClick={() => onNavigate(action.target)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-medium transition-all ${action.color}`}
          >
            {action.icon}
            <span className="flex-1 text-left">{action.label}</span>
            <ExternalLink className="h-3 w-3 opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Org People List
// ============================================================================

function OrgPeopleList({
  orgId,
  nodes,
  edges,
  selectedMonth,
  onSelectNode,
}: {
  orgId: string;
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  selectedMonth: string;
  onSelectNode: (id: string) => void;
}) {
  const people = useMemo(() => {
    // Find people via employs/assigns edges
    const employEdges = edges.filter(
      e => (e.data?.edgeType === 'employs' || e.data?.edgeType === 'assigns') && e.source === orgId
    );
    const peopleFromEdges = employEdges
      .map(e => nodes.find(n => n.id === e.target))
      .filter(Boolean) as VisibleNode[];

    // Also find people via partyId in node data (auto-generated graphs)
    const edgePeopleIds = new Set(peopleFromEdges.map(p => p.id));
    const peopleFromData = nodes.filter(
      n => n.type === 'person' && n.data?.partyId === orgId && !edgePeopleIds.has(n.id)
    ) as VisibleNode[];

    return [...peopleFromEdges, ...peopleFromData];
  }, [orgId, nodes, edges]);

  if (people.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        People ({people.length})
      </div>
      <div className="space-y-1">
        {people.map(person => {
          const activity = getPersonMonthlyActivity(person.id, selectedMonth);
          const initials = (person.data?.name || '').split(' ').map((w: string) => w[0]).join('').slice(0, 2);
          
          return (
            <button
              key={person.id}
              onClick={() => onSelectNode(person.id)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/40 transition-colors text-left group"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold border shrink-0
                ${activity?.status === 'onboarding' ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-100 border-slate-200 text-slate-500'}
              `}>
                {person.visibility === 'masked' ? <Lock className="h-2.5 w-2.5" /> : initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-foreground truncate">
                  {person.visibility === 'masked' ? 'Hidden User' : person.data?.name}
                </div>
                <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                  <span>{person.data?.role?.replace(/_/g, ' ') || 'Employee'}</span>
                  {person.data?.canApprove && (
                    <span className="inline-flex items-center gap-0.5 px-1 rounded bg-blue-50 text-blue-600 text-[8px] font-semibold">
                      <Shield className="h-2 w-2" /> approver
                    </span>
                  )}
                  {person.data?.visibleToChain === false && (
                    <span className="inline-flex items-center gap-0.5 px-1 rounded bg-orange-100 text-orange-600 text-[8px] font-semibold">
                      <EyeOff className="h-2 w-2" /> internal
                    </span>
                  )}
                </div>
              </div>
              {activity && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  {activity.hoursSubmitted}h
                </span>
              )}
              <ChevronRight className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Data Flows Section (with approval actions)
// ============================================================================

function DataFlowsSection({
  flows: initialFlows,
  snapshotLabel,
  viewer,
  selectedId,
  edges,
  flowIcons,
  statusColors,
}: {
  flows: { id: string; type: string; label: string; status: string; fromNodeId: string; toNodeId: string }[];
  snapshotLabel: string;
  viewer: ViewerIdentity;
  selectedId: string;
  edges: VisibleEdge[];
  flowIcons: Record<string, React.ReactNode>;
  statusColors: Record<string, string>;
}) {
  const [flowStatuses, setFlowStatuses] = useState<Record<string, string>>({});

  // Reset on flow changes
  useEffect(() => {
    setFlowStatuses({});
  }, [selectedId]);

  const getStatus = (flow: { id: string; status: string }) => flowStatuses[flow.id] || flow.status;

  // Can viewer approve flows on this node?
  const isAdmin = viewer.type === 'admin';
  const canApproveFlows = isAdmin || viewer.type === 'client' || (() => {
    // Check if viewer has approval authority (is in the chain above)
    const hasApprovalEdge = edges.some(
      e => e.data?.edgeType === 'approves' &&
        (e.source === viewer.nodeId || e.source === viewer.orgId)
    );
    // Or viewer's org is the target (org approving own flows)
    const isOrgViewer = edges.some(
      e => (e.data?.edgeType === 'employs' || e.data?.edgeType === 'assigns') &&
        e.source === selectedId && e.source === viewer.orgId
    );
    return hasApprovalEdge || isOrgViewer;
  })();

  const handleApproveFlow = (flowId: string, label: string) => {
    setFlowStatuses(prev => ({ ...prev, [flowId]: 'approved' }));
    toast.success(`Approved: ${label}`, { description: `Approved by ${viewer.name}` });
  };

  const handleRejectFlow = (flowId: string, label: string) => {
    setFlowStatuses(prev => ({ ...prev, [flowId]: 'rejected' }));
    toast.error(`Rejected: ${label}`, { description: `Rejected by ${viewer.name}` });
  };

  const pendingFlows = initialFlows.filter(f => {
    const s = getStatus(f);
    return s === 'pending' || s === 'submitted';
  });

  const handleApproveAllFlows = () => {
    const updates: Record<string, string> = {};
    pendingFlows.forEach(f => { updates[f.id] = 'approved'; });
    setFlowStatuses(prev => ({ ...prev, ...updates }));
    toast.success(`Approved all ${pendingFlows.length} pending items`, { description: `Batch approved by ${viewer.name}` });
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Data Flows ({snapshotLabel})
      </div>

      {/* Batch approve for pending flows */}
      {canApproveFlows && pendingFlows.length > 1 && (
        <button
          onClick={handleApproveAllFlows}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-medium hover:bg-emerald-100 transition-colors"
        >
          <ThumbsUp className="h-3 w-3" />
          Approve all {pendingFlows.length} pending
        </button>
      )}

      <div className="space-y-1.5">
        {initialFlows.map(flow => {
          const status = getStatus(flow);
          const isPending = status === 'pending' || status === 'submitted';

          return (
            <div key={flow.id}>
              <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${isPending && canApproveFlows ? 'bg-amber-50/50 border border-amber-100' : 'bg-muted/30'}`}>
                {flowIcons[flow.type] || <CircleDot className="h-3 w-3 text-slate-400" />}
                <span className="text-[11px] text-foreground flex-1 truncate">{flow.label}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${statusColors[status] || 'bg-slate-100 text-slate-500'}`}>
                  {status}
                </span>
              </div>
              {/* Approval actions for pending/submitted flows */}
              {canApproveFlows && isPending && (
                <div className="mx-2.5 mt-1 mb-1 flex items-center gap-1.5">
                  <button
                    onClick={() => handleApproveFlow(flow.id, flow.label)}
                    className="flex-1 flex items-center justify-center gap-1 h-6 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium hover:bg-emerald-100 transition-colors"
                  >
                    <ThumbsUp className="h-2.5 w-2.5" /> Approve
                  </button>
                  <button
                    onClick={() => handleRejectFlow(flow.id, flow.label)}
                    className="flex-1 flex items-center justify-center gap-1 h-6 rounded-md bg-red-50 border border-red-200 text-red-600 text-[10px] font-medium hover:bg-red-100 transition-colors"
                  >
                    <ThumbsDown className="h-2.5 w-2.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main Drawer Component
// ============================================================================

export function NodeDetailDrawer({
  selectedId,
  nodes,
  edges,
  viewer,
  selectedMonth,
  onClose,
  onSelectNode,
  onNavigate,
}: NodeDetailDrawerProps) {
  const node = nodes.find(n => n.id === selectedId);
  
  // Fallback when node not found in filtered list
  if (!node) {
    return (
      <div className="w-[360px] h-full border-l border-border bg-card flex flex-col shrink-0 z-10">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[15px] font-semibold text-foreground">Node not visible</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                This node ({selectedId}) may be filtered out by the current month or search filter.
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const snapshot = getSnapshotForMonth(selectedMonth);
  const activity = node.type === 'person' ? getPersonMonthlyActivity(node.id, selectedMonth) : null;

  // Monthly flow items for this node — filtered by ReBAC visibility
  const visibleNodeIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes]);
  const relevantFlows = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.flows.filter(f => {
      // Flow must touch this node
      const touchesSelected = f.fromNodeId === selectedId || f.toNodeId === selectedId;
      if (!touchesSelected) return false;
      // Both endpoints must be visible to the current viewer (ReBAC)
      return visibleNodeIds.has(f.fromNodeId) && visibleNodeIds.has(f.toNodeId);
    });
  }, [snapshot, selectedId, visibleNodeIds]);

  const flowIcons: Record<string, React.ReactNode> = {
    timesheet: <Clock className="h-3 w-3 text-blue-500" />,
    nda: <ShieldCheck className="h-3 w-3 text-violet-500" />,
    contract: <FileText className="h-3 w-3 text-amber-500" />,
    invoice: <Receipt className="h-3 w-3 text-emerald-500" />,
    compliance: <FileCheck className="h-3 w-3 text-cyan-500" />,
    approval: <CheckCircle2 className="h-3 w-3 text-blue-500" />,
    payment: <Receipt className="h-3 w-3 text-green-500" />,
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    submitted: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
    signed: 'bg-emerald-100 text-emerald-700',
    paid: 'bg-green-100 text-green-700',
    expired: 'bg-slate-100 text-slate-500',
  };

  // Icon for node header
  const headerIcon = node.type === 'person'
    ? <User className="h-4 w-4" />
    : node.type === 'contract'
      ? <FileText className="h-4 w-4" />
      : node.data?.partyType === 'agency'
        ? <Users className="h-4 w-4" />
        : <Building2 className="h-4 w-4" />;

  const headerColor = node.type === 'person'
    ? 'bg-slate-100 text-slate-600'
    : node.type === 'contract'
      ? 'bg-amber-100 text-amber-600'
      : node.data?.partyType === 'agency'
        ? 'bg-violet-100 text-violet-600'
        : node.data?.partyType === 'client'
          ? 'bg-amber-100 text-amber-600'
          : 'bg-blue-100 text-blue-600';

  return (
    <div className="w-[360px] h-full border-l border-border bg-card flex flex-col shrink-0 z-10 overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${headerColor} flex items-center justify-center shrink-0`}>
              {headerIcon}
            </div>
            <div>
              <div className="text-[15px] font-semibold text-foreground leading-tight">
                {node.data?.name}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 capitalize">
                {node.type}
                {node.data?.partyType ? ` \u00b7 ${node.data.partyType}` : ''}
                {node.data?.role && node.data.role !== '\u2022\u2022\u2022\u2022' ? ` \u00b7 ${node.data.role.replace(/_/g, ' ')}` : ''}
              </div>
              {activity && (
                <Badge
                  variant="outline"
                  className={`text-[9px] mt-1.5 capitalize ${
                    activity.status === 'onboarding' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                    activity.status === 'offboarding' ? 'bg-red-50 border-red-200 text-red-500' :
                    'bg-emerald-50 border-emerald-200 text-emerald-600'
                  }`}
                >
                  {activity.status}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {node.visibility !== 'full' && (
          <div className="flex items-center gap-1.5 mt-3 text-[10px] text-amber-600 bg-amber-50 rounded-md px-2.5 py-1.5">
            <EyeOff className="h-3 w-3 shrink-0" />
            <span>Some data is hidden from <span className="font-medium">{viewer.name}</span></span>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">

          {/* My Chain (for all node types) */}
          <MyChainVisualization
            selectedId={selectedId}
            nodes={nodes}
            edges={edges}
            onSelectNode={onSelectNode}
          />

          {/* Monthly Activity (for people) */}
          {activity && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {snapshot?.label} Hours
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground">Submitted</div>
                  <div className="text-lg font-semibold text-foreground">{activity.hoursSubmitted}h</div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <div className="text-[10px] text-muted-foreground">Approved</div>
                  <div className={`text-lg font-semibold ${
                    activity.hoursApproved >= activity.hoursSubmitted ? 'text-emerald-600' : 'text-amber-600'
                  }`}>{activity.hoursApproved}h</div>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Timesheets (for people) — interactive with inline edit + approval */}
          {node.type === 'person' && (
            <TimesheetSection
              personId={node.id}
              month={selectedMonth}
              viewer={viewer}
              edges={edges}
              onNavigate={onNavigate}
            />
          )}

          {/* Contracts */}
          {node.type === 'person' && (
            <ContractsSection
              personId={node.id}
              viewer={viewer}
              onNavigate={onNavigate}
            />
          )}

          {/* Documents */}
          {node.type === 'person' && (
            <DocumentsSection personId={node.id} />
          )}

          {/* Org: people list */}
          {node.type === 'party' && (
            <OrgPeopleList
              orgId={node.id}
              nodes={nodes}
              edges={edges}
              selectedMonth={selectedMonth}
              onSelectNode={onSelectNode}
            />
          )}

          {/* Contract details */}
          {node.type === 'contract' && (
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Contract Details
              </div>
              <div className="space-y-1.5">
                {node.data?.contractType && (
                  <div className="flex justify-between text-xs px-2.5 py-1.5 bg-muted/30 rounded-md">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium text-foreground capitalize">{node.data.contractType}</span>
                  </div>
                )}
                {node.data?.hourlyRate && (
                  <div className="flex justify-between text-xs px-2.5 py-1.5 bg-muted/30 rounded-md">
                    <span className="text-muted-foreground">Rate</span>
                    <span className={`font-medium ${node.data.hourlyRate === '\u2022\u2022\u2022\u2022' ? 'text-slate-300' : 'text-foreground'}`}>
                      {node.data.hourlyRate === '\u2022\u2022\u2022\u2022' ? (
                        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Hidden</span>
                      ) : `$${node.data.hourlyRate}/hr`}
                    </span>
                  </div>
                )}
                {node.data?.startDate && (
                  <div className="flex justify-between text-xs px-2.5 py-1.5 bg-muted/30 rounded-md">
                    <span className="text-muted-foreground">Start</span>
                    <span className="font-medium text-foreground">{node.data.startDate}</span>
                  </div>
                )}
                {node.data?.status && (
                  <div className="flex justify-between text-xs px-2.5 py-1.5 bg-muted/30 rounded-md">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="text-[9px] capitalize">{node.data.status}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data Flows this month (with approval actions) */}
          {relevantFlows.length > 0 && (
            <DataFlowsSection
              flows={relevantFlows}
              snapshotLabel={snapshot?.label || ''}
              viewer={viewer}
              selectedId={selectedId}
              edges={edges}
              flowIcons={flowIcons}
              statusColors={statusColors}
            />
          )}

          {/* Connections */}
          <ConnectionsList
            selectedId={selectedId}
            nodes={nodes}
            edges={edges}
            onSelectNode={onSelectNode}
          />

          <Separator />

          {/* Quick Actions */}
          <QuickActions node={node} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Connections List (compact)
// ============================================================================

function ConnectionsList({
  selectedId,
  nodes,
  edges,
  onSelectNode,
}: {
  selectedId: string;
  nodes: VisibleNode[];
  edges: VisibleEdge[];
  onSelectNode: (id: string) => void;
}) {
  const connections = edges.filter(e => e.source === selectedId || e.target === selectedId);
  if (connections.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Connections ({connections.length})
      </div>
      <div className="space-y-1">
        {connections.map(conn => {
          const otherId = conn.source === selectedId ? conn.target : conn.source;
          const otherNode = nodes.find(n => n.id === otherId);
          const direction = conn.source === selectedId ? 'outbound' : 'inbound';

          return (
            <button
              key={conn.id}
              onClick={() => onSelectNode(otherId)}
              className="w-full flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-colors group"
            >
              <ChevronRight className={`h-3 w-3 text-muted-foreground shrink-0 ${direction === 'inbound' ? 'rotate-180' : ''}`} />
              <span className="text-foreground truncate flex-1 text-[11px] text-left">
                {otherNode?.data?.name || otherId}
              </span>
              <Badge variant="outline" className="text-[8px] shrink-0">{conn.data?.edgeType}</Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}