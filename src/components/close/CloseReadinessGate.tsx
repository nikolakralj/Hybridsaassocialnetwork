import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMonthContext } from '../../contexts/MonthContext';
import { getMondaysForMonth, useTimesheetStore } from '../../contexts/TimesheetDataContext';
import type { StoredWeek } from '../../types/timesheets';
import { sumWeekHours } from '../../types/timesheets';
import type { ProjectMember } from '../../types/collaboration';
import type { BaseEdge, BaseNode } from '../../types/workgraph';
import { buildPersonToOrgMap } from '../workgraph/graph-visibility';
import { fetchScopedGraph } from '../../utils/api/scoped-graph-api';
import { buildScopedGraphDirectories } from '../../utils/graph/scoped-graph-directories';
import { getApprovalQueue, type ApprovalQueueItem } from '../../utils/api/approvals-supabase';
import { resolveProjectRates, type PersonRate } from '../../utils/api/invoices-api';
import { createClient } from '../../utils/supabase/client';
import {
  buildCloseReadinessRows,
  countUnlinkedPurchaseOrders,
  purchaseOrdersFromDocuments,
  purchaseOrdersFromGraph,
  usablePersonName,
  type ClosePoState,
  type CloseRateState,
  type CloseReadinessApproval,
  type CloseReadinessPurchaseOrder,
  type CloseReadinessRow,
  type CloseReadinessWorker,
} from '../../utils/close-readiness';

interface CloseReadinessGateProps {
  projectId: string;
  projectName: string;
  canConfirmRates: boolean;
  members?: ProjectMember[];
}

type RowFilter = 'all' | 'blocked' | 'ready';

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function readProjectStartDate(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const value = sessionStorage.getItem('currentProjectStartDate');
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function openProjectTab(tab: string) {
  window.dispatchEvent(new CustomEvent('changeTab', { detail: tab }));
}

function collectWorkers(
  nodes: BaseNode[],
  edges: BaseEdge[],
  weeks: StoredWeek[],
  timesheetPersonIds: string[],
  members: ProjectMember[],
): CloseReadinessWorker[] {
  const personToOrg = buildPersonToOrgMap(nodes, edges);
  const { nameDirectory } = buildScopedGraphDirectories(nodes, edges);
  const partyType = new Map(nodes.filter((node) => node.type === 'party').map((node) => [node.id, node.data?.partyType]));
  const timesheetIds = new Set(timesheetPersonIds);
  weeks.forEach((week) => {
    timesheetIds.add(week.personId);
    if (week.graphNodeId) timesheetIds.add(week.graphNodeId);
  });

  const aliasesByGraphId = new Map<string, Set<string>>();
  members.forEach((member) => {
    if (!member.graphNodeId) return;
    const aliases = aliasesByGraphId.get(member.graphNodeId) || new Set<string>();
    if (member.userId) aliases.add(member.userId);
    aliasesByGraphId.set(member.graphNodeId, aliases);
  });
  weeks.forEach((week) => {
    const graphId = week.graphNodeId;
    if (!graphId) return;
    const aliases = aliasesByGraphId.get(graphId) || new Set<string>();
    aliases.add(week.personId);
    aliasesByGraphId.set(graphId, aliases);
  });

  const workers = new Map<string, CloseReadinessWorker>();

  const addWorker = (personId: string, name: string | null, orgId?: string) => {
    const existing = workers.get(personId);
    const resolvedName = name || existing?.name || 'Unnamed worker';
    const aliases = new Set<string>(existing?.aliasIds || []);
    (aliasesByGraphId.get(personId) || []).forEach((alias) => aliases.add(alias));
    aliases.delete(personId);
    const partyName = orgId ? nameDirectory[orgId]?.name : undefined;
    workers.set(personId, {
      personId,
      name: resolvedName,
      orgId: orgId || existing?.orgId,
      orgName: partyName || existing?.orgName,
      aliasIds: [...aliases],
    });
  };

  nodes.forEach((node) => {
    if (node.type !== 'person') return;
    const orgId = personToOrg.get(node.id) || node.data?.partyId || node.data?.orgId;
    const approverOnly = node.data?.canApprove === true;
    const onClientParty = orgId ? partyType.get(orgId) === 'client' : false;
    const hasTimesheets = timesheetIds.has(node.id) || [...(aliasesByGraphId.get(node.id) || [])].some((alias) => timesheetIds.has(alias));
    if (!hasTimesheets && (approverOnly || onClientParty)) return;
    addWorker(node.id, usablePersonName(nameDirectory[node.id]?.name || node.data?.name), orgId);
  });

  weeks.forEach((week) => {
    const personId = week.graphNodeId || week.personId;
    if (workers.has(personId)) {
      addWorker(personId, workers.get(personId)?.name || null, workers.get(personId)?.orgId);
      return;
    }
    const member = members.find((item) => item.userId === week.personId || item.graphNodeId === personId);
    addWorker(
      personId,
      usablePersonName(nameDirectory[personId]?.name || member?.userName),
      personToOrg.get(personId) || member?.scope,
    );
  });

  timesheetPersonIds.forEach((personId) => {
    if ([...workers.values()].some((worker) => worker.personId === personId || worker.aliasIds?.includes(personId))) return;
    const member = members.find((item) => item.userId === personId || item.graphNodeId === personId);
    const graphId = member?.graphNodeId || personId;
    if (workers.has(graphId)) return;
    addWorker(graphId, usablePersonName(nameDirectory[graphId]?.name || nameDirectory[personId]?.name || member?.userName), member?.scope);
  });

  return [...workers.values()];
}

function approvalsFromQueue(
  items: ApprovalQueueItem[],
  nameDirectory: Record<string, { name?: string }>,
): CloseReadinessApproval[] {
  return items.flatMap((item) => {
    const parsed = parseTimesheetSubject(item.subjectId);
    const weekStart = parsed?.weekStart || item.timesheetData?.weekStart;
    if (!weekStart) return [];
    const personIds = [
      parsed?.personId,
      item.subjectSnapshot?.submitterId,
      item.timesheetData?.submitterId,
    ].filter((id): id is string => Boolean(id));
    if (personIds.length === 0) return [];
    const approverName = usablePersonName(item.approverName)
      || usablePersonName(item.subjectSnapshot?.currentApproverName)
      || usablePersonName(item.approverNodeId ? nameDirectory[item.approverNodeId]?.name : null)
      || usablePersonName(item.subjectSnapshot?.currentApproverNodeId
        ? nameDirectory[item.subjectSnapshot.currentApproverNodeId]?.name
        : null);
    return [{
      personIds,
      weekStart,
      approverName,
      approvalLayer: item.approvalLayer,
    }];
  });
}

function parseTimesheetSubject(subjectId?: string | null): { personId: string; weekStart: string } | null {
  if (!subjectId) return null;
  const parts = subjectId.split(':');
  if (parts.length < 2) return null;
  const weekStart = parts[parts.length - 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
  return { personId: parts.slice(0, -1).join(':'), weekStart };
}

function rateLabel(state: CloseRateState): string {
  switch (state) {
    case 'set': return 'Set';
    case 'missing': return 'Missing';
    case 'hidden': return 'Not visible';
    default: return 'Could not load';
  }
}

function poLabel(state: ClosePoState, detail?: string): string {
  if (state === 'set') return detail || 'Set';
  if (state === 'missing') return 'Missing';
  if (state === 'not_usable') return detail || 'Not active';
  return 'Could not load';
}

function approverLabel(row: CloseReadinessRow): string {
  const parts: string[] = [];
  if (row.pendingApproverNames.length > 0) parts.push(row.pendingApproverNames.join(', '));
  if (row.blockers.some((blocker) => blocker.startsWith('Pending approvals could not be loaded'))) {
    parts.push('Could not load');
  }
  if (row.unknownApproverWeekCount > 0) parts.push('Approver not recorded');
  if (row.notSubmittedWeekCount > 0) {
    parts.push(row.notSubmittedWeekCount === 1 ? 'Not submitted' : `${row.notSubmittedWeekCount} weeks not submitted`);
  }
  if (row.rejectedWeekCount > 0) {
    parts.push(row.rejectedWeekCount === 1 ? 'Rejected' : `${row.rejectedWeekCount} rejected`);
  }
  return parts.join(' · ') || '—';
}

export function CloseReadinessGate({
  projectId,
  projectName,
  canConfirmRates,
  members = [],
}: CloseReadinessGateProps) {
  const store = useTimesheetStore();
  const { selectedMonth, setSelectedMonth } = useMonthContext();
  const currentMonth = selectedMonth instanceof Date ? selectedMonth : new Date(selectedMonth);
  const monthKey = monthKeyFromDate(currentMonth);
  const monthLabel = formatMonthLabel(currentMonth);

  const [filter, setFilter] = useState<RowFilter>('all');
  const [search, setSearch] = useState('');
  const [loadingFacts, setLoadingFacts] = useState(true);
  const [graphNodes, setGraphNodes] = useState<BaseNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<BaseEdge[]>([]);
  const [rates, setRates] = useState<PersonRate[]>([]);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [approvals, setApprovals] = useState<CloseReadinessApproval[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<CloseReadinessPurchaseOrder[]>([]);
  const [purchaseOrdersLoaded, setPurchaseOrdersLoaded] = useState(false);
  const [approvalsLoaded, setApprovalsLoaded] = useState(false);
  const [graphWarning, setGraphWarning] = useState<string | null>(null);
  const [documentWarning, setDocumentWarning] = useState<string | null>(null);

  const monthWeeks = useMemo(
    () => store.getAllWeeksForMonth(monthKey),
    [store, monthKey, store.version],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingFacts(true);
      setGraphWarning(null);
      setDocumentWarning(null);

      const graphPromise = fetchScopedGraph(projectId)
        .then((graph) => ({ graph, error: null as string | null }))
        .catch((error: unknown) => ({
          graph: null,
          error: error instanceof Error ? error.message : 'The project graph could not be loaded.',
        }));

      const ratesPromise = resolveProjectRates(projectId)
        .then((resolved) => ({ rates: Object.values(resolved), loaded: true }))
        .catch((error: unknown) => {
          console.warn('[close] billing rates could not be loaded', error);
          return { rates: [] as PersonRate[], loaded: false };
        });

      const approvalsPromise = getApprovalQueue({
        projectId,
        subjectType: 'timesheet',
        status: 'pending',
      })
        .then((items) => ({ items, loaded: true }))
        .catch((error: unknown) => {
          console.warn('[close] pending approvals could not be loaded', error);
          return { items: [] as ApprovalQueueItem[], loaded: false };
        });

      const documentsPromise = createClient()
        .from('wg_documents')
        .select('type, status, from_party, to_party, data, expires_at')
        .eq('project_id', projectId)
        .eq('type', 'purchase_order')
        .then(({ data, error }) => {
          if (error) throw new Error(error.message);
          return { rows: Array.isArray(data) ? data : [], loaded: true };
        })
        .catch((error: unknown) => {
          console.warn('[close] purchase orders could not be loaded', error);
          return { rows: [], loaded: false };
        });

      const [graphResult, rateResult, approvalItems, documentResult] = await Promise.all([
        graphPromise,
        ratesPromise,
        approvalsPromise,
        documentsPromise,
      ]);

      if (cancelled) return;

      const nodes = (graphResult.graph?.nodes || []) as BaseNode[];
      const edges = (graphResult.graph?.edges || []) as BaseEdge[];
      const directories = buildScopedGraphDirectories(nodes, edges);
      const graphOrders = graphResult.graph ? purchaseOrdersFromGraph(nodes, edges) : [];
      const documentOrders = documentResult.loaded
        ? purchaseOrdersFromDocuments(documentResult.rows as Array<{
          type?: string | null;
          status?: string | null;
          from_party?: string | null;
          to_party?: string | null;
          data?: Record<string, unknown> | null;
          expires_at?: string | null;
        }>)
        : [];

      setGraphNodes(nodes);
      setGraphEdges(edges);
      setRates(rateResult.rates);
      setRatesLoaded(rateResult.loaded);
      setApprovals(approvalsFromQueue(approvalItems.items, directories.nameDirectory));
      setApprovalsLoaded(approvalItems.loaded);
      setPurchaseOrders([...graphOrders, ...documentOrders]);
      setPurchaseOrdersLoaded(Boolean(graphResult.graph) && documentResult.loaded);
      setGraphWarning(graphResult.error);
      setDocumentWarning(documentResult.loaded ? null : 'Purchase-order documents could not be loaded. A linked graph purchase order still counts; otherwise the PO check stays unknown.');
      setLoadingFacts(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, store.version]);

  const rows = useMemo(() => buildCloseReadinessRows({
    monthKey,
    expectedWeekStarts: getMondaysForMonth(monthKey),
    projectStartDate: readProjectStartDate(),
    today: todayIso(),
    workers: collectWorkers(graphNodes, graphEdges, monthWeeks, store.getPersonIds(), members),
    weeks: monthWeeks.map((week) => ({
      personId: week.personId,
      graphNodeId: week.graphNodeId,
      weekStart: week.weekStart,
      weekLabel: week.weekLabel,
      status: week.status,
      hours: sumWeekHours(week),
      rejectionNote: week.rejectionNote,
    })),
    approvals,
    rates: rates.map((rate) => ({ personId: rate.personId, rate: rate.rate, masked: rate.masked })),
    purchaseOrders,
    ratesLoaded,
    viewerCanConfirmRates: canConfirmRates,
    purchaseOrdersLoaded,
    approvalsLoaded,
  }), [
    approvals,
    canConfirmRates,
    graphEdges,
    graphNodes,
    members,
    monthKey,
    monthWeeks,
    purchaseOrders,
    purchaseOrdersLoaded,
    approvalsLoaded,
    rates,
    ratesLoaded,
    store,
    store.version,
  ]);

  const visibleRows = rows.filter((row) => {
    if (filter === 'ready' && !row.invoiceReady) return false;
    if (filter === 'blocked' && row.invoiceReady) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [row.workerName, row.orgName || '', row.pendingApproverNames.join(' ')].some((value) => value.toLowerCase().includes(query));
  });

  const readyCount = rows.filter((row) => row.invoiceReady).length;
  const unlinkedPoCount = countUnlinkedPurchaseOrders(purchaseOrders);
  const showDocumentWarning = Boolean(documentWarning);

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Close readiness</h2>
          <p className="text-sm text-slate-500">
            {projectName} · {monthLabel}. A worker-month is invoice-ready when started weeks have hours, every one of those weeks is approved, a billing rate is on file, and a purchase order is linked.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => setSelectedMonth(addMonths(currentMonth, -1))}
              aria-label="Previous close month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              className="h-9 w-[145px] rounded-none border-0 px-2 text-center shadow-none focus-visible:ring-0"
              value={monthKey}
              onChange={(event) => {
                if (!/^\d{4}-\d{2}$/.test(event.target.value)) return;
                setSelectedMonth(new Date(`${event.target.value}-01T00:00:00`));
              }}
              aria-label="Close month"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => setSelectedMonth(addMonths(currentMonth, 1))}
              aria-label="Next close month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={() => openProjectTab('timesheets')}>Timesheets</Button>
          <Button variant="outline" onClick={() => openProjectTab('approvals')}>Approvals</Button>
          <Button variant="outline" onClick={() => openProjectTab('invoices')}>Invoices</Button>
        </div>
      </div>

      {graphWarning ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="m-0">Graph could not be loaded ({graphWarning}). Workers are taken from timesheets already in this project.</p>
        </div>
      ) : null}
      {showDocumentWarning ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="m-0">{documentWarning}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Workers</p>
              <p className="text-[11px] text-slate-400">{monthLabel}</p>
              <p className="text-2xl font-bold text-slate-900">{rows.length}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-3">
              <ClipboardCheck className="h-5 w-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Invoice-ready</p>
              <p className="text-[11px] text-slate-400">{monthLabel}</p>
              <p className="text-2xl font-bold text-slate-900">{readyCount}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Not ready</p>
              <p className="text-[11px] text-slate-400">{monthLabel}</p>
              <p className="text-2xl font-bold text-slate-900">{rows.length - readyCount}</p>
            </div>
            <div className="rounded-full bg-amber-100 p-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ['all', 'All'],
          ['blocked', 'Not ready'],
          ['ready', 'Invoice-ready'],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? 'default' : 'outline'}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search workers"
          aria-label="Search workers"
          className="h-9 w-[220px]"
        />
      </div>

      {loadingFacts || store.isLoading ? (
        <div className="flex items-center gap-2 p-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading close readiness...
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-sm text-muted-foreground">
          {rows.length === 0
            ? 'No workers are on this project yet. People who submit time, and people on a billing organization who are not approver-only, show up here.'
            : 'No workers match this filter.'}
        </div>
      ) : (
        <Card className="border-slate-200/60 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Missing hours</TableHead>
                <TableHead>Pending approver</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>PO</TableHead>
                <TableHead>Invoice-ready</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.personId}>
                  <TableCell>
                    <div className="font-medium text-slate-900">{row.workerName}</div>
                    {row.orgName ? <div className="text-xs text-muted-foreground">{row.orgName}</div> : null}
                    <div className="text-xs text-muted-foreground">{row.loggedHours}h logged</div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {row.missingWeekLabels.length === 0 ? (
                      <span className="text-sm text-slate-600">None</span>
                    ) : (
                      <span className="text-sm text-amber-800">{row.missingWeekLabels.join(', ')}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px] whitespace-normal">
                    <div className="text-sm text-slate-800">{approverLabel(row)}</div>
                    {row.rejectionNotes.length > 0 ? (
                      <div className="mt-1 text-xs text-muted-foreground">{row.rejectionNotes.join(' ')}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={stateClass(row.rateState === 'set')}>
                      {rateLabel(row.rateState)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal">
                    <Badge variant="outline" className={stateClass(row.poState === 'set')}>
                      {poLabel(row.poState, row.poDetail)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.invoiceReady ? (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">Invoice-ready</Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">Not ready</Badge>
                        <p className="m-0 max-w-[280px] whitespace-normal text-xs text-muted-foreground">{row.blockers.join(' ')}</p>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {unlinkedPoCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {unlinkedPoCount === 1
            ? '1 purchase order on this project is not linked to a worker or organization, so it does not clear the PO check.'
            : `${unlinkedPoCount} purchase orders on this project are not linked to a worker or organization, so they do not clear the PO check.`}
        </p>
      ) : null}
    </div>
  );
}

function stateClass(ok: boolean): string {
  return ok
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-amber-200 bg-amber-50 text-amber-900';
}
