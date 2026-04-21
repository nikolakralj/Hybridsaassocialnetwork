import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, Clock, DollarSign, FileText, Loader2, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { InvoiceDetailPrintView } from './InvoiceDetailPrintView';
import { InvoiceImportPanel, readProjectInvoiceTemplate, type ProjectInvoiceTemplate } from './InvoiceImportPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useMonthContextSafe } from '../../contexts/MonthContext';
import { useTimesheetStore } from '../../contexts/TimesheetDataContext';
import { sumWeekHours } from '../../types/timesheets';
import type { StoredWeek } from '../../types/timesheets';
import {
  createInvoice,
  isUuidProjectId,
  listInvoices,
  updateInvoiceStatus,
  type Invoice as PersistedInvoice,
  type InvoiceLineItem,
  type InvoiceStatus as ApiInvoiceStatus,
} from '../../utils/api/invoices-api';

export type InvoiceDraft = {
  id: string;
  number: string;
  projectId: string;
  projectName: string;
  clientName: string;
  personId: string;
  personName: string;
  weekStart: string;
  weekLabel: string;
  date: string;
  dueDate: string;
  hours: number;
  rate: number;
  amount: number;
  currency?: string;
  notes?: string;
  lineItemTemplateDescription?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  apiStatus?: ApiInvoiceStatus;
  syncState?: 'cloud' | 'local';
  timesheetKey?: string;
  lineItems?: InvoiceLineItem[];
};

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isRemoteProject(projectId: string): boolean {
  return isUuidProjectId(projectId);
}

function readNameDir(projectId: string): Record<string, { name?: string }> {
  try {
    const raw = sessionStorage.getItem(`workgraph-name-dir:${projectId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readApprovalParties(projectId: string): Array<{ id: string; name?: string; partyType?: string }> {
  try {
    const raw = sessionStorage.getItem(`workgraph-approval-dir:${projectId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.parties) ? parsed.parties : [];
  } catch {
    return [];
  }
}

function readClientName(projectId: string): string {
  const parties = readApprovalParties(projectId);
  const client = parties.find((party) => party?.partyType === 'client');
  return client?.name || 'Client';
}

function readPartyIds(projectId: string): { fromPartyId: string; toPartyId: string } {
  const parties = readApprovalParties(projectId);
  const seller = parties.find((party) => party?.partyType === 'company' || party?.partyType === 'agency') || parties[0];
  const buyer = parties.find((party) => party?.partyType === 'client') || parties[1] || parties[0];

  return {
    fromPartyId: seller?.id || projectId,
    toPartyId: buyer?.id || projectId,
  };
}

function parseTimesheetKey(key?: string): { personId: string; weekStart: string } | null {
  if (!key) return null;
  const parts = key.split(':');
  if (parts.length < 2) return null;
  return {
    personId: parts.slice(0, -1).join(':'),
    weekStart: parts[parts.length - 1],
  };
}

function makeTimesheetKey(personId: string, weekStart: string): string {
  return `${personId}:${weekStart}`;
}

function uiStatusFromApiStatus(status: ApiInvoiceStatus): InvoiceDraft['status'] {
  switch (status) {
    case 'paid':
      return 'paid';
    case 'overdue':
      return 'overdue';
    case 'issued':
    case 'partially_paid':
      return 'sent';
    default:
      return 'draft';
  }
}

function apiStatusFromUiStatus(status: InvoiceDraft['status']): ApiInvoiceStatus {
  switch (status) {
    case 'paid':
      return 'paid';
    case 'overdue':
      return 'overdue';
    case 'sent':
      return 'issued';
    default:
      return 'draft';
  }
}

function statusBadgeInfo(status: ApiInvoiceStatus | InvoiceDraft['status']) {
  switch (status) {
    case 'issued':
    case 'sent':
      return { label: 'Issued', className: 'border-blue-200 bg-blue-50 text-blue-700' };
    case 'paid':
      return { label: 'Paid', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    case 'partially_paid':
      return { label: 'Partially paid', className: 'border-amber-200 bg-amber-50 text-amber-700' };
    case 'overdue':
      return { label: 'Overdue', className: 'border-rose-200 bg-rose-50 text-rose-700' };
    default:
      return { label: 'Draft', className: 'border-slate-200 text-slate-600' };
  }
}

function syncBadgeInfo(isCloudProject: boolean) {
  return isCloudProject
    ? { label: 'Saved to cloud', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
    : { label: 'Local only', className: 'border-amber-200 bg-amber-50 text-amber-700' };
}

function displayCurrency(value: number, currency?: string): string {
  const safeCurrency = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: safeCurrency,
    }).format(value);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }
}

function applyTemplateToDraft(invoice: InvoiceDraft, template: ProjectInvoiceTemplate): InvoiceDraft {
  const dueDateOffset = Number.isFinite(template.dueDateOffsetDays) ? template.dueDateOffsetDays : 30;
  const lineDefault = template.lineDefaults[0];
  const amount = invoice.hours * invoice.rate;

  return {
    ...invoice,
    dueDate: addDays(invoice.date, dueDateOffset),
    amount,
    currency: template.currency || invoice.currency || 'USD',
    notes: template.notes || invoice.notes,
    lineItemTemplateDescription: lineDefault?.description || invoice.lineItemTemplateDescription,
  };
}

function buildDraftFromWeek(
  week: StoredWeek,
  projectId: string,
  projectName: string,
  clientName: string,
  personNameLookup: Record<string, { name?: string }>,
  defaultRate: number,
  todayIso: string,
  index: number,
  template?: ProjectInvoiceTemplate | null
): InvoiceDraft {
  const personName = personNameLookup[week.personId]?.name || week.personId;
  const hours = sumWeekHours(week);
  const amount = hours * defaultRate;
  const shortPerson = week.personId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  const weekStamp = week.weekStart.replace(/-/g, '');
  const base: InvoiceDraft = {
    id: `inv_${week.personId}_${week.weekStart}`,
    number: `INV-${weekStamp}-${shortPerson || String(index + 1).padStart(3, '0')}`,
    projectId,
    projectName: projectName || 'Project',
    clientName,
    personId: week.personId,
    personName,
    weekStart: week.weekStart,
    weekLabel: week.weekLabel,
    date: todayIso,
    dueDate: addDays(todayIso, 30),
    hours,
    rate: defaultRate,
    amount,
    currency: 'USD',
    status: 'draft',
    timesheetKey: makeTimesheetKey(week.personId, week.weekStart),
    lineItems: [
      {
        id: `line_${week.personId}_${week.weekStart}`,
        description: `Approved timesheet - ${week.weekLabel} (${personName})`,
        quantity: hours,
        unitPrice: defaultRate,
        amount,
      },
    ],
  };

  return template ? applyTemplateToDraft(base, template) : base;
}

function toInvoicePayload(invoice: InvoiceDraft) {
  const apiStatus = invoice.apiStatus || apiStatusFromUiStatus(invoice.status);
  const partyIds = readPartyIds(invoice.projectId);
  const lineItems = invoice.lineItems && invoice.lineItems.length > 0
    ? invoice.lineItems
    : [
        {
          id: `line_${invoice.personId}_${invoice.weekStart}`,
          description: invoice.lineItemTemplateDescription || `Approved timesheet - ${invoice.weekLabel} (${invoice.personName})`,
          quantity: invoice.hours,
          unitPrice: invoice.rate,
          amount: invoice.amount,
        },
      ];

  return {
    projectId: invoice.projectId,
    projectName: invoice.projectName,
    clientName: invoice.clientName,
    personId: invoice.personId,
    personName: invoice.personName,
    weekStart: invoice.weekStart,
    weekLabel: invoice.weekLabel,
    number: invoice.number,
    invoiceNumber: invoice.number,
    date: invoice.date,
    issueDate: invoice.date,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    hours: invoice.hours,
    rate: invoice.rate,
    amount: invoice.amount,
    subtotal: invoice.amount,
    taxTotal: 0,
    total: invoice.amount,
    status: apiStatus,
    notes: invoice.notes,
    lineItemTemplateDescription: invoice.lineItemTemplateDescription,
    fromPartyId: partyIds.fromPartyId,
    toPartyId: partyIds.toPartyId,
    timesheetIds: invoice.timesheetKey ? [invoice.timesheetKey] : [makeTimesheetKey(invoice.personId, invoice.weekStart)],
    lineItems,
  };
}

function getInvoiceKey(invoice: Pick<InvoiceDraft, 'id' | 'personId' | 'weekStart' | 'timesheetKey' | 'number'>): string {
  if (invoice.timesheetKey) return invoice.timesheetKey;
  if (invoice.personId && invoice.weekStart) return makeTimesheetKey(invoice.personId, invoice.weekStart);
  return invoice.number || invoice.id;
}

function normalizePersistedInvoice(
  invoice: PersistedInvoice,
  projectId: string,
  projectName: string,
  clientName: string,
  personNameLookup: Record<string, { name?: string }>,
  weekLookup: Map<string, { weekLabel: string }>,
): InvoiceDraft {
  const timesheetKey = invoice.timesheetIds?.[0] || (
    invoice.personId && invoice.weekStart ? makeTimesheetKey(invoice.personId, invoice.weekStart) : undefined
  );
  const parsed = parseTimesheetKey(timesheetKey);
  const personId = invoice.personId || parsed?.personId || '';
  const weekStart = invoice.weekStart || parsed?.weekStart || invoice.issueDate;
  const weekLabel = invoice.weekLabel || weekLookup.get(timesheetKey || '')?.weekLabel || weekStart;
  const lineItem = invoice.lineItems?.[0];
  const hours = typeof invoice.hours === 'number'
    ? invoice.hours
    : Array.isArray(invoice.lineItems)
      ? invoice.lineItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      : 0;
  const rate = typeof invoice.rate === 'number' ? invoice.rate : (lineItem ? Number(lineItem.unitPrice || 0) : 0);
  const amount = typeof invoice.amount === 'number' ? invoice.amount : invoice.total;
  const syncState = invoice.syncState || (isRemoteProject(projectId) ? 'cloud' : 'local');

  return {
    id: invoice.id,
    number: invoice.invoiceNumber,
    projectId,
    projectName: invoice.projectName || projectName || 'Project',
    clientName: invoice.clientName || clientName,
    personId,
    personName: invoice.personName || personNameLookup[personId]?.name || personId,
    weekStart,
    weekLabel,
    date: invoice.issueDate,
    dueDate: invoice.dueDate,
    hours,
    rate,
    amount,
    currency: (invoice.currency || 'USD').toUpperCase(),
    notes: invoice.notes || undefined,
    lineItemTemplateDescription: invoice.lineItemTemplateDescription || lineItem?.description || undefined,
    status: uiStatusFromApiStatus(invoice.status),
    apiStatus: invoice.status,
    syncState,
    timesheetKey,
    lineItems: Array.isArray(invoice.lineItems) ? invoice.lineItems : [],
  };
}

function formatMonthKeyForInvoice(invoice: Pick<InvoiceDraft, 'weekStart' | 'date' | 'timesheetKey'>): string | null {
  if (invoice.weekStart) return invoice.weekStart.slice(0, 7);
  const parsed = parseTimesheetKey(invoice.timesheetKey);
  if (parsed?.weekStart) return parsed.weekStart.slice(0, 7);
  if (invoice.date) return invoice.date.slice(0, 7);
  return null;
}

export function InvoicesWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const store = useTimesheetStore();
  const { selectedMonth } = useMonthContextSafe();
  const { accessToken } = useAuth();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [storedInvoices, setStoredInvoices] = useState<PersistedInvoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isSavingInvoices, setIsSavingInvoices] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [projectTemplate, setProjectTemplate] = useState<ProjectInvoiceTemplate | null>(() => readProjectInvoiceTemplate(projectId));

  const currentProjectName = projectName || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('currentProjectName') : null) || 'Project';
  const defaultClientName = useMemo(() => readClientName(projectId), [projectId]);
  const personNameLookup = useMemo(() => readNameDir(projectId), [projectId]);

  useEffect(() => {
    setProjectTemplate(readProjectInvoiceTemplate(projectId));
  }, [projectId]);

  const currentMonth = selectedMonth instanceof Date ? selectedMonth : new Date(selectedMonth);
  const monthKey = monthKeyFromDate(currentMonth);

  const allWeeksForMonth = useMemo(() => store.getAllWeeksForMonth(monthKey), [store, monthKey, store.version]);
  const approvedWeeks = useMemo(() => {
    return allWeeksForMonth.filter((week) => week.status === 'approved');
  }, [allWeeksForMonth]);

  const weekLookup = useMemo(() => {
    const map = new Map<string, { weekLabel: string }>();
    allWeeksForMonth.forEach((week) => {
      map.set(makeTimesheetKey(week.personId, week.weekStart), { weekLabel: week.weekLabel });
    });
    return map;
  }, [allWeeksForMonth]);

  const refreshInvoices = useCallback(async () => {
    setIsLoadingInvoices(true);
    try {
      const data = await listInvoices(projectId, accessToken);
      setStoredInvoices(data);
    } catch (error) {
      console.error('Failed to load invoices:', error);
      toast.error('Could not load invoices for this project.');
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [accessToken, projectId]);

  useEffect(() => {
    void refreshInvoices();
  }, [refreshInvoices]);

  const monthInvoices = useMemo(() => {
    return storedInvoices
      .map((invoice) => normalizePersistedInvoice(invoice, projectId, currentProjectName, defaultClientName, personNameLookup, weekLookup))
      .filter((invoice) => formatMonthKeyForInvoice(invoice) === monthKey)
      .sort((a, b) => {
        const aDate = new Date(a.weekStart || a.date || 0).getTime();
        const bDate = new Date(b.weekStart || b.date || 0).getTime();
        return bDate - aDate;
      });
  }, [currentProjectName, defaultClientName, monthKey, personNameLookup, projectId, storedInvoices, weekLookup]);

  const visibleInvoices = useMemo(() => {
    return monthInvoices
      .filter((invoice) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return [
          invoice.number,
          invoice.projectName,
          invoice.clientName,
          invoice.personName,
          invoice.weekLabel,
          invoice.notes || '',
        ].some((value) => value.toLowerCase().includes(query));
      });
  }, [monthInvoices, searchQuery]);

  const selectedInvoice = useMemo(
    () => monthInvoices.find((invoice) => invoice.id === selectedInvoiceId) || null,
    [monthInvoices, selectedInvoiceId]
  );

  useEffect(() => {
    if (selectedInvoiceId && !monthInvoices.some((invoice) => invoice.id === selectedInvoiceId)) {
      setSelectedInvoiceId(null);
    }
  }, [monthInvoices, selectedInvoiceId]);

  const handleGenerateDrafts = useCallback(async () => {
    if (approvedWeeks.length === 0) {
      toast.info('No approved timesheets found for this month yet.');
      return;
    }

    const defaultRate = 95;
    const todayIso = new Date().toISOString().slice(0, 10);

    const approvedDrafts = approvedWeeks.map((week, index) => buildDraftFromWeek(
      week,
      projectId,
      currentProjectName,
      defaultClientName,
      personNameLookup,
      defaultRate,
      todayIso,
      index,
      projectTemplate,
    ));

    const existingKeys = new Set(storedInvoices.map((invoice) => {
      const normalized = normalizePersistedInvoice(invoice, projectId, currentProjectName, defaultClientName, personNameLookup, weekLookup);
      return getInvoiceKey(normalized);
    }));

    const draftsToCreate = approvedDrafts.filter((draft) => !existingKeys.has(getInvoiceKey(draft)));
    if (draftsToCreate.length === 0) {
      toast.info('All approved weeks already have invoices.');
      return;
    }

    setIsSavingInvoices(true);
    try {
      const results = await Promise.allSettled(
        draftsToCreate.map((draft) => createInvoice(toInvoicePayload(draft), accessToken))
      );

      const failedCount = results.filter((result) => result.status === 'rejected').length;
      await refreshInvoices();

      if (failedCount > 0) {
        toast.warning(`Saved ${draftsToCreate.length - failedCount} invoice${draftsToCreate.length - failedCount === 1 ? '' : 's'}, but ${failedCount} failed.`);
      } else {
        toast.success(`Saved ${draftsToCreate.length} invoice${draftsToCreate.length === 1 ? '' : 's'} to persistence.`);
      }
    } catch (error) {
      console.error('Failed to generate invoices:', error);
      toast.error('Unable to save generated invoices right now.');
    } finally {
      setIsSavingInvoices(false);
    }
  }, [accessToken, approvedWeeks, currentProjectName, defaultClientName, personNameLookup, projectId, projectTemplate, refreshInvoices, storedInvoices, weekLookup]);

  const handleMarkIssued = useCallback(async (invoice: InvoiceDraft) => {
    setUpdatingInvoiceId(invoice.id);
    try {
      await updateInvoiceStatus(invoice.id, 'issued', accessToken);
      await refreshInvoices();
      toast.success(`Invoice ${invoice.number} marked as issued.`);
    } catch (error) {
      console.error('Failed to update invoice status:', error);
      toast.error('Could not update invoice status.');
    } finally {
      setUpdatingInvoiceId(null);
    }
  }, [accessToken, refreshInvoices]);

  const isCloudProject = isRemoteProject(projectId);
  const syncBadge = syncBadgeInfo(isCloudProject);

  if (selectedInvoice) {
    return (
      <div className="flex h-full flex-col space-y-4">
        <div className="flex items-center justify-end gap-2">
          <Badge variant="outline" className={syncBadge.className}>
            {syncBadge.label}
          </Badge>
          {(selectedInvoice.apiStatus || selectedInvoice.status) === 'draft' ? (
            <Button
              variant="default"
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => void handleMarkIssued(selectedInvoice)}
              disabled={updatingInvoiceId === selectedInvoice.id}
            >
              {updatingInvoiceId === selectedInvoice.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mark issued
            </Button>
          ) : null}
        </div>
        <InvoiceDetailPrintView
          invoice={selectedInvoice}
          onBack={() => setSelectedInvoiceId(null)}
        />
      </div>
    );
  }

  const totalInvoiceAmount = monthInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalInvoiceHours = monthInvoices.reduce((sum, invoice) => sum + invoice.hours, 0);

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Invoices</h2>
          <p className="text-sm text-slate-500">
            Generate invoice drafts directly from approved timesheets and persist them to Supabase.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search invoices..."
              className="w-[250px] pl-9 shadow-sm"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Button
            variant="default"
            className="bg-indigo-600 shadow-sm hover:bg-indigo-700"
            onClick={() => void handleGenerateDrafts()}
            disabled={isSavingInvoices}
          >
            {isSavingInvoices ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Generate from Approved
          </Button>
        </div>
      </div>

      <InvoiceImportPanel
        projectId={projectId}
        defaultVendor={currentProjectName}
        defaultClient={defaultClientName}
        projectTemplate={projectTemplate}
        onTemplateSaved={setProjectTemplate}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Approved Weeks</p>
              <p className="text-2xl font-bold text-slate-900">{approvedWeeks.length}</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Invoices</p>
              <p className="text-2xl font-bold text-slate-900">{visibleInvoices.length}</p>
            </div>
            <div className="rounded-full bg-slate-100 p-3">
              <FileText className="h-5 w-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Invoice Hours</p>
              <p className="text-2xl font-bold text-slate-900">{totalInvoiceHours.toFixed(1)}h</p>
            </div>
            <div className="rounded-full bg-indigo-100 p-3">
              <Clock className="h-5 w-5 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Invoice Amount</p>
              <p className="text-2xl font-bold text-slate-900">
                {displayCurrency(totalInvoiceAmount, monthInvoices[0]?.currency)}
              </p>
            </div>
            <div className="rounded-full bg-amber-100 p-3">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-full border-slate-200/60 shadow-sm">
        <CardHeader className="border-b border-slate-100 py-4">
          <CardTitle className="text-base font-medium">Invoice Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingInvoices && visibleInvoices.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-slate-400" />
              Loading invoices...
            </div>
          ) : visibleInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500">
                No invoice records yet. Click <strong>Generate from Approved</strong> to create and persist invoices.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleInvoices.map((invoice) => {
                const badgeInfo = statusBadgeInfo(invoice.apiStatus || invoice.status);
                return (
                  <div
                    key={invoice.id}
                    className="group flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-slate-50"
                    onClick={() => setSelectedInvoiceId(invoice.id)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{invoice.number}</h4>
                        <p className="text-sm text-slate-500">
                          {invoice.personName} - {invoice.clientName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-8">
                      <div className="hidden text-right sm:block">
                        <h4 className="text-sm font-medium text-slate-900">
                          {displayCurrency(invoice.amount, invoice.currency)}
                        </h4>
                        <p className="mt-0.5 flex items-center text-xs text-slate-500">
                          <Calendar className="mr-1 h-3 w-3" />
                          {invoice.weekLabel} - Due {invoice.dueDate}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={badgeInfo.className}>
                          {badgeInfo.label}
                        </Badge>
                        <Badge variant="outline" className={syncBadge.className}>
                          {syncBadge.label}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="opacity-0 transition-opacity group-hover:opacity-100">
                        View
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
