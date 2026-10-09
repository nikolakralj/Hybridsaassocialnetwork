/**
 * Close-readiness rules for one worker in one month.
 *
 * This module only classifies data the caller already loaded. It does not
 * invent rates, purchase-order numbers, approver names, or expected hours.
 * A week is "missing hours" when the timesheet calendar has started and no
 * positive hour total exists — not when the total differs from a default week.
 */

export type CloseRateState = 'set' | 'missing' | 'hidden' | 'unknown';
export type ClosePoState = 'set' | 'missing' | 'not_usable' | 'unknown';

export interface CloseReadinessWorker {
  personId: string;
  name: string;
  orgId?: string;
  orgName?: string;
  /** Auth user ids and graph ids that refer to the same worker. */
  aliasIds?: string[];
}

export interface CloseReadinessWeek {
  personId: string;
  graphNodeId?: string;
  weekStart: string;
  weekLabel?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  hours: number;
  rejectionNote?: string;
}

export interface CloseReadinessApproval {
  personIds: string[];
  weekStart: string;
  /** Real display name. Null when the record does not name an approver. */
  approverName: string | null;
  approvalLayer?: number;
}

export interface CloseReadinessRate {
  personId: string;
  rate: number;
  masked: boolean;
}

export interface CloseReadinessPurchaseOrder {
  poNumber: string;
  /** Lowercase status from the graph node or document. Empty when unstated. */
  status: string;
  /** Person and organization ids this PO is explicitly tied to. */
  linkedIds: string[];
  expiresOn?: string | null;
}

export interface CloseReadinessInput {
  monthKey: string;
  /** Mondays whose Mon–Fri week overlaps the month. Same list as the timesheet grid. */
  expectedWeekStarts: string[];
  /** Project start date (YYYY-MM-DD). Weeks that end before it are out of scope. */
  projectStartDate?: string | null;
  /** YYYY-MM-DD. Weeks that start after this day are not yet missing. */
  today: string;
  workers: CloseReadinessWorker[];
  weeks: CloseReadinessWeek[];
  approvals: CloseReadinessApproval[];
  rates: CloseReadinessRate[];
  purchaseOrders: CloseReadinessPurchaseOrder[];
  /** False when the private-rate query failed. Do not call that "missing". */
  ratesLoaded: boolean;
  /** Owner/editor can tell a hidden rate from a rate that was never saved. */
  viewerCanConfirmRates: boolean;
  /** False when purchase-order documents or the graph could not be read.
   *  A PO that did load still counts. Absence is "missing" only when both sources loaded. */
  purchaseOrdersLoaded: boolean;
  /** False when the pending-approval query failed. */
  approvalsLoaded: boolean;
}

export interface CloseReadinessRow {
  personId: string;
  workerName: string;
  orgName?: string;
  monthKey: string;
  loggedHours: number;
  missingWeekLabels: string[];
  /** Named approvers still waiting on a submitted week. */
  pendingApproverNames: string[];
  notSubmittedWeekCount: number;
  rejectedWeekCount: number;
  unknownApproverWeekCount: number;
  rejectionNotes: string[];
  rateState: CloseRateState;
  poState: ClosePoState;
  /** Real PO numbers or statuses already on the record. Never synthesized. */
  poDetail?: string;
  invoiceReady: boolean;
  blockers: string[];
}

const UNUSABLE_PO_STATUSES = new Set([
  'draft',
  'pending_signature',
  'countersigning',
  'rejected',
  'expired',
  'superseded',
  'closed',
  'terminated',
]);

const PO_NUMBER_KEYS = ['poNumber', 'po_number', 'purchaseOrder', 'purchase_order'] as const;

export function readPurchaseOrderNumber(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  for (const key of PO_NUMBER_KEYS) {
    const value = data[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && trimmed !== '••••') return trimmed;
    }
  }
  return null;
}

export function purchaseOrdersFromGraph(
  nodes: Array<{ id: string; type?: string; data?: Record<string, unknown> | null }>,
  edges: Array<{ source: string; target: string }>,
): CloseReadinessPurchaseOrder[] {
  const orders: CloseReadinessPurchaseOrder[] = [];

  nodes.forEach((node) => {
    const data = node.data || undefined;
    const poNumber = readPurchaseOrderNumber(data);
    if (!poNumber) return;

    const isPoNode = node.type === 'po';
    const isCarrier = node.type === 'person' || node.type === 'party' || node.type === 'contract';
    if (!isPoNode && !isCarrier) return;

    const linked = new Set<string>();
    if (!isPoNode) linked.add(node.id);

    if (isPoNode) {
      edges.forEach((edge) => {
        if (edge.source === node.id && edge.target) linked.add(edge.target);
        if (edge.target === node.id && edge.source) linked.add(edge.source);
      });
      ['partyId', 'personId', 'orgId', 'organizationId', 'subjectGraphNodeId', 'workerId'].forEach((key) => {
        const value = data?.[key];
        if (typeof value === 'string' && value.trim()) linked.add(value.trim());
      });
    }

    orders.push({
      poNumber,
      status: isPoNode ? normalizeStatus(data?.status ?? data?.poStatus) : normalizeStatus(data?.poStatus),
      linkedIds: [...linked],
      expiresOn: isPoNode
        ? readIsoDate(data?.endDate ?? data?.expiryDate ?? data?.expiresAt)
        : readIsoDate(data?.poExpiry ?? data?.poExpiresAt),
    });
  });

  return orders;
}

export function purchaseOrdersFromDocuments(
  rows: Array<{
    type?: string | null;
    status?: string | null;
    from_party?: string | null;
    to_party?: string | null;
    data?: Record<string, unknown> | null;
    expires_at?: string | null;
  }>,
): CloseReadinessPurchaseOrder[] {
  const orders: CloseReadinessPurchaseOrder[] = [];

  rows.forEach((row) => {
    if (row.type && row.type !== 'purchase_order') return;
    const data = row.data || undefined;
    const poNumber = readPurchaseOrderNumber(data);
    if (!poNumber) return;

    const linked = new Set<string>();
    [row.from_party, row.to_party].forEach((partyId) => {
      if (typeof partyId === 'string' && partyId.trim()) linked.add(partyId.trim());
    });
    ['partyId', 'personId', 'orgId', 'subjectGraphNodeId', 'workerId'].forEach((key) => {
      const value = data?.[key];
      if (typeof value === 'string' && value.trim()) linked.add(value.trim());
    });

    orders.push({
      poNumber,
      status: normalizeStatus(row.status),
      linkedIds: [...linked],
      expiresOn: readIsoDate(row.expires_at ?? data?.expiryDate ?? data?.expiresAt),
    });
  });

  return orders;
}

export function buildCloseReadinessRows(input: CloseReadinessInput): CloseReadinessRow[] {
  const dueWeekStarts = input.expectedWeekStarts.filter((weekStart) => (
    weekHasStarted(weekStart, input.today)
    && !weekEndsBefore(weekStart, input.projectStartDate)
  ));

  return input.workers
    .map((worker) => buildRow(worker, input, dueWeekStarts))
    .sort((left, right) => {
      if (left.invoiceReady !== right.invoiceReady) return left.invoiceReady ? 1 : -1;
      return left.workerName.localeCompare(right.workerName);
    });
}

export function countUnlinkedPurchaseOrders(orders: CloseReadinessPurchaseOrder[]): number {
  return orders.filter((order) => order.linkedIds.length === 0).length;
}

function buildRow(
  worker: CloseReadinessWorker,
  input: CloseReadinessInput,
  dueWeekStarts: string[],
): CloseReadinessRow {
  const identity = identitySet(worker);
  const workerWeeks = input.weeks.filter((week) => weekMatches(week, identity));
  const weeksByStart = new Map<string, CloseReadinessWeek>();
  workerWeeks.forEach((week) => {
    const current = weeksByStart.get(week.weekStart);
    if (!current || week.hours > current.hours) weeksByStart.set(week.weekStart, week);
  });

  const loggedHours = roundHours([...weeksByStart.values()].reduce((sum, week) => sum + (Number.isFinite(week.hours) ? week.hours : 0), 0));
  const missingWeekLabels: string[] = [];
  const pendingNames = new Set<string>();
  const rejectionNotes: string[] = [];
  let notSubmittedWeekCount = 0;
  let rejectedWeekCount = 0;
  let unknownApproverWeekCount = 0;
  let approvalsUnavailable = false;

  dueWeekStarts.forEach((weekStart) => {
    const week = weeksByStart.get(weekStart);
    const label = week?.weekLabel || formatWeekLabel(weekStart);
    if (!week || week.hours <= 0) {
      missingWeekLabels.push(label);
      return;
    }

    if (week.status === 'rejected') {
      rejectedWeekCount += 1;
      const note = week.rejectionNote?.trim();
      if (note) rejectionNotes.push(note);
      return;
    }

    if (week.status === 'draft') {
      notSubmittedWeekCount += 1;
      return;
    }

    if (week.status === 'submitted') {
      if (!input.approvalsLoaded) {
        approvalsUnavailable = true;
        return;
      }
      const approver = pendingApproverFor(input.approvals, identity, weekStart);
      if (approver) pendingNames.add(approver);
      else unknownApproverWeekCount += 1;
    }
  });

  const rateState = rateStateFor(worker, input);
  const po = poStateFor(worker, input);
  const blockers = blockersFor({
    dueWeekCount: dueWeekStarts.length,
    missingWeekLabels,
    pendingApproverNames: [...pendingNames],
    notSubmittedWeekCount,
    rejectedWeekCount,
    unknownApproverWeekCount,
    approvalsUnavailable,
    rateState,
    poState: po.state,
    poDetail: po.detail,
  });

  return {
    personId: worker.personId,
    workerName: worker.name,
    orgName: worker.orgName,
    monthKey: input.monthKey,
    loggedHours,
    missingWeekLabels,
    pendingApproverNames: [...pendingNames],
    notSubmittedWeekCount,
    rejectedWeekCount,
    unknownApproverWeekCount,
    rejectionNotes,
    rateState,
    poState: po.state,
    poDetail: po.detail,
    invoiceReady: blockers.length === 0,
    blockers,
  };
}

function blockersFor(state: {
  dueWeekCount: number;
  missingWeekLabels: string[];
  pendingApproverNames: string[];
  notSubmittedWeekCount: number;
  rejectedWeekCount: number;
  unknownApproverWeekCount: number;
  approvalsUnavailable: boolean;
  rateState: CloseRateState;
  poState: ClosePoState;
  poDetail?: string;
}): string[] {
  const blockers: string[] = [];
  if (state.dueWeekCount === 0) blockers.push('No week in this month has started.');
  if (state.missingWeekLabels.length > 0) blockers.push(`Missing hours: ${state.missingWeekLabels.join(', ')}`);
  if (state.notSubmittedWeekCount > 0) {
    blockers.push(state.notSubmittedWeekCount === 1 ? '1 week is not submitted.' : `${state.notSubmittedWeekCount} weeks are not submitted.`);
  }
  if (state.rejectedWeekCount > 0) {
    blockers.push(state.rejectedWeekCount === 1 ? '1 week was rejected.' : `${state.rejectedWeekCount} weeks were rejected.`);
  }
  if (state.pendingApproverNames.length > 0) blockers.push(`Pending approval: ${state.pendingApproverNames.join(', ')}`);
  if (state.unknownApproverWeekCount > 0) blockers.push('Submitted, but the pending approver is not recorded.');
  if (state.approvalsUnavailable) blockers.push('Pending approvals could not be loaded.');
  if (state.rateState === 'missing') blockers.push('Missing billing rate.');
  if (state.rateState === 'hidden') blockers.push('Billing rate is not visible.');
  if (state.rateState === 'unknown') blockers.push('Billing rate could not be loaded.');
  if (state.poState === 'missing') blockers.push('Missing PO.');
  if (state.poState === 'not_usable') blockers.push(state.poDetail ? `PO not active (${state.poDetail}).` : 'PO not active.');
  if (state.poState === 'unknown') blockers.push('Purchase orders could not be loaded.');
  return blockers;
}

function rateStateFor(worker: CloseReadinessWorker, input: CloseReadinessInput): CloseRateState {
  if (!input.ratesLoaded) return 'unknown';
  const match = input.rates.find((rate) => identitySet(worker).has(rate.personId));
  if (match?.masked) return 'hidden';
  if (match && match.rate > 0) return 'set';
  if (!input.viewerCanConfirmRates) return 'hidden';
  return 'missing';
}

function poStateFor(
  worker: CloseReadinessWorker,
  input: CloseReadinessInput,
): { state: ClosePoState; detail?: string } {
  const identity = identitySet(worker);
  if (worker.orgId) identity.add(worker.orgId);
  const linked = input.purchaseOrders.filter((order) => order.linkedIds.some((id) => identity.has(id)));
  const usable = linked.filter((order) => purchaseOrderIsUsable(order, input.today));
  if (usable.length > 0) {
    return { state: 'set', detail: unique(usable.map((order) => order.poNumber)).join(', ') };
  }
  if (linked.length > 0) {
    const detail = unique(linked.map((order) => {
      const status = order.status ? humanizeStatus(order.status) : 'Unusable';
      return `${status} · ${order.poNumber}`;
    })).join(', ');
    return { state: 'not_usable', detail };
  }
  if (!input.purchaseOrdersLoaded) return { state: 'unknown' };
  return { state: 'missing' };
}

function purchaseOrderIsUsable(order: CloseReadinessPurchaseOrder, today: string): boolean {
  if (UNUSABLE_PO_STATUSES.has(order.status)) return false;
  if (order.expiresOn && order.expiresOn < today) return false;
  return order.poNumber.trim().length > 0;
}

function pendingApproverFor(
  approvals: CloseReadinessApproval[],
  identity: Set<string>,
  weekStart: string,
): string | null {
  const matches = approvals
    .filter((approval) => approval.weekStart === weekStart && approval.personIds.some((id) => identity.has(id)))
    .sort((left, right) => (left.approvalLayer ?? 99) - (right.approvalLayer ?? 99));
  return matches.find((approval) => approval.approverName)?.approverName || null;
}

function weekMatches(week: CloseReadinessWeek, identity: Set<string>): boolean {
  return identity.has(week.personId) || Boolean(week.graphNodeId && identity.has(week.graphNodeId));
}

function identitySet(worker: CloseReadinessWorker): Set<string> {
  return new Set([worker.personId, ...(worker.aliasIds || [])].filter(Boolean));
}

function weekHasStarted(weekStart: string, today: string): boolean {
  return Boolean(weekStart) && weekStart <= today;
}

function weekEndsBefore(weekStart: string, projectStartDate?: string | null): boolean {
  if (!projectStartDate) return false;
  const end = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(end.getTime())) return false;
  end.setDate(end.getDate() + 4);
  return formatIsoDate(end) < projectStartDate;
}

function formatWeekLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(start.getTime())) return weekStart;
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  if (startMonth === endMonth) return `${startMonth} ${start.getDate()}–${end.getDate()}`;
  return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}`;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function readIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : null;
}

function humanizeStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function usablePersonName(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === 'me' || lowered === 'unknown' || lowered === 'current user') return null;
  return trimmed;
}
