import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, DollarSign, FileCheck2, FileText, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoiceDetailPrintView } from './InvoiceDetailPrintView';
import { InvoiceImportPanel, readProjectInvoiceTemplate, type ProjectInvoiceTemplate } from './InvoiceImportPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useMonthContextSafe } from '../../contexts/MonthContext';
import { useTimesheetStore } from '../../contexts/TimesheetDataContext';
import { sumWeekHours } from '../../types/timesheets';
import type { StoredWeek } from '../../types/timesheets';
import {
  createInvoice,
  deleteDraftInvoice,
  listInvoices,
  listTemplates,
  resolveProjectRates,
  saveTemplate,
  updateInvoice,
  updateInvoiceStatus,
  type Invoice as PersistedInvoice,
  type InvoiceLineItem,
  type InvoicePayload,
  type InvoiceStatus as ApiInvoiceStatus,
  type InvoiceTemplate,
  type PersonRate,
} from '../../utils/api/invoices-api';

export type InvoiceDraft = {
  id: string;
  templateId?: string | null;
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
  /** All timesheet keys covered by this invoice (consolidated invoices span several weeks/people). */
  timesheetIds?: string[];
  lineItems?: InvoiceLineItem[];
  fromPartyName?: string | null;
  toPartyName?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  taxRate?: number;
  fromTaxId?: string | null;
  toTaxId?: string | null;
  fromIban?: string | null;
  paymentRef?: string | null;
};

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayOffset(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 30;
  return Math.max(0, Math.round((to - from) / (1000 * 60 * 60 * 24)));
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

function readPartyIds(projectId: string): { fromPartyId: string; toPartyId: string; fromPartyName: string; toPartyName: string } {
  const parties = readApprovalParties(projectId);
  const seller = parties.find((party) => party?.partyType === 'company' || party?.partyType === 'agency') || parties[0];
  const buyer = parties.find((party) => party?.partyType === 'client' && party?.id !== seller?.id)
    || parties.find((party) => party?.id !== seller?.id)
    || parties[0];

  return {
    fromPartyId: seller?.id || projectId,
    toPartyId: buyer?.id || projectId,
    fromPartyName: seller?.name || '',
    toPartyName: buyer?.name || '',
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

function syncBadgeInfo(syncState?: 'cloud' | 'local') {
  return syncState !== 'local'
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

  return {
    ...invoice,
    dueDate: addDays(invoice.date, dueDateOffset),
    currency: template.currency || invoice.currency || 'EUR',
    notes: template.notes || invoice.notes,
    lineItemTemplateDescription: lineDefault?.description || invoice.lineItemTemplateDescription,
  };
}

function draftLineItems(invoice: InvoiceDraft): InvoiceLineItem[] {
  if (Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) return invoice.lineItems;
  return [
    {
      id: `line_${invoice.personId}_${invoice.weekStart}`,
      description: invoice.lineItemTemplateDescription || `Approved timesheet - ${invoice.weekLabel} (${invoice.personName})`,
      quantity: invoice.hours,
      unitPrice: invoice.rate,
      amount: invoice.amount,
    },
  ];
}

function applyBillingTemplateToDraft(invoice: InvoiceDraft, template: InvoiceTemplate): InvoiceDraft {
  const defaults = template.billingDefaults ?? {};
  const dueDateOffset = typeof defaults.dueDateOffsetDays === 'number' && Number.isFinite(defaults.dueDateOffsetDays)
    ? defaults.dueDateOffsetDays
    : template.dueDateOffsetDays;
  const lineDescription = defaults.lineItemDescription || template.lineDefaults?.[0]?.description || invoice.lineItemTemplateDescription;
  const lineItems = draftLineItems(invoice).map((line, index) => (
    index === 0 && lineDescription ? { ...line, description: lineDescription } : line
  ));

  return {
    ...invoice,
    templateId: template.id ?? invoice.templateId,
    dueDate: addDays(invoice.date, typeof dueDateOffset === 'number' && Number.isFinite(dueDateOffset) ? dueDateOffset : 30),
    currency: (defaults.currency || template.currency || invoice.currency || 'EUR').toUpperCase(),
    fromPartyName: defaults.fromPartyName || template.vendor || invoice.fromPartyName,
    fromAddress: defaults.fromAddress || invoice.fromAddress,
    fromTaxId: defaults.fromTaxId || invoice.fromTaxId,
    fromIban: defaults.fromIban || invoice.fromIban,
    toPartyName: defaults.toPartyName || template.client || invoice.toPartyName,
    toAddress: defaults.toAddress || invoice.toAddress,
    toTaxId: defaults.toTaxId || invoice.toTaxId,
    taxRate: typeof defaults.taxRate === 'number' && Number.isFinite(defaults.taxRate) ? defaults.taxRate : invoice.taxRate,
    paymentRef: defaults.paymentRef || invoice.paymentRef,
    notes: defaults.notes || template.notes || invoice.notes,
    lineItemTemplateDescription: lineDescription || invoice.lineItemTemplateDescription,
    lineItems,
  };
}

function buildTemplatePatch(invoice: InvoiceDraft, template: InvoiceTemplate): Partial<InvoicePayload> {
  const nextInvoice = applyBillingTemplateToDraft(invoice, template);
  return {
    templateId: nextInvoice.templateId,
    dueDate: nextInvoice.dueDate,
    currency: nextInvoice.currency,
    fromPartyName: nextInvoice.fromPartyName,
    fromAddress: nextInvoice.fromAddress,
    fromTaxId: nextInvoice.fromTaxId,
    fromIban: nextInvoice.fromIban,
    toPartyName: nextInvoice.toPartyName,
    toAddress: nextInvoice.toAddress,
    toTaxId: nextInvoice.toTaxId,
    taxRate: nextInvoice.taxRate,
    paymentRef: nextInvoice.paymentRef,
    notes: nextInvoice.notes,
    lineItemTemplateDescription: nextInvoice.lineItemTemplateDescription,
    lineItems: nextInvoice.lineItems,
    taxTotal: undefined,
    total: undefined,
  };
}

function buildTemplateFromInvoice(invoice: InvoiceDraft, templateName: string): InvoiceTemplate {
  const firstLine = draftLineItems(invoice)[0];
  const dueDateOffsetDays = dayOffset(invoice.date, invoice.dueDate);
  const billingDefaults = {
    fromPartyName: invoice.fromPartyName || invoice.projectName,
    fromAddress: invoice.fromAddress || '',
    fromTaxId: invoice.fromTaxId || '',
    fromIban: invoice.fromIban || '',
    toPartyName: invoice.toPartyName || invoice.clientName,
    toAddress: invoice.toAddress || '',
    toTaxId: invoice.toTaxId || '',
    taxRate: invoice.taxRate ?? 0,
    paymentRef: invoice.paymentRef || '',
    notes: invoice.notes || '',
    currency: (invoice.currency || 'EUR').toUpperCase(),
    dueDateOffsetDays,
    lineItemDescription: firstLine?.description || invoice.lineItemTemplateDescription || '',
  };

  return {
    projectId: invoice.projectId,
    templateName: templateName.trim() || `${billingDefaults.fromPartyName || 'Company'} invoice`,
    vendor: billingDefaults.fromPartyName,
    client: billingDefaults.toPartyName,
    currency: billingDefaults.currency,
    notes: billingDefaults.notes,
    dueDateOffsetDays,
    lineDefaults: [
      {
        description: firstLine?.description || '',
        quantity: String(firstLine?.quantity ?? invoice.hours ?? 1),
        unitPrice: String(firstLine?.unitPrice ?? invoice.rate ?? 0),
        amount: String(firstLine?.amount ?? invoice.amount ?? 0),
      },
    ],
    updatedAt: new Date().toISOString(),
    locale: 'hr-HR',
    compliance: {
      standard: 'urn:cen.eu:en16931:2017',
      taxScheme: 'VAT',
      paymentRefFormat: invoice.paymentRef?.startsWith('HR') ? 'HR' : 'custom',
    },
    billingDefaults,
    layout: { billingDefaults },
  };
}

function buildTemplateFromImportedProjectTemplate(projectId: string, template: ProjectInvoiceTemplate): InvoiceTemplate {
  const firstLine = template.lineDefaults[0];
  const billingDefaults = {
    fromPartyName: template.vendor,
    fromAddress: '',
    fromTaxId: '',
    fromIban: '',
    toPartyName: template.client,
    toAddress: '',
    toTaxId: '',
    taxRate: 0,
    paymentRef: '',
    notes: template.notes || '',
    currency: (template.currency || 'EUR').toUpperCase(),
    dueDateOffsetDays: Number.isFinite(template.dueDateOffsetDays) ? template.dueDateOffsetDays : 30,
    lineItemDescription: firstLine?.description || '',
  };

  return {
    id: `project_template_${projectId}`,
    projectId,
    templateName: template.templateName || 'Project Invoice Template',
    vendor: template.vendor,
    client: template.client,
    currency: billingDefaults.currency,
    notes: template.notes || '',
    dueDateOffsetDays: billingDefaults.dueDateOffsetDays,
    lineDefaults: template.lineDefaults,
    updatedAt: template.updatedAt || new Date().toISOString(),
    locale: 'hr-HR',
    compliance: {
      standard: 'urn:cen.eu:en16931:2017',
      taxScheme: 'VAT',
      paymentRefFormat: 'custom',
    },
    billingDefaults,
    layout: { billingDefaults },
  };
}

function buildBillingTemplateOptions(
  projectId: string,
  cloudTemplates: InvoiceTemplate[],
  projectTemplate: ProjectInvoiceTemplate | null,
): InvoiceTemplate[] {
  if (!projectTemplate) return cloudTemplates;
  const localTemplate = buildTemplateFromImportedProjectTemplate(projectId, projectTemplate);
  const hasEquivalentCloudTemplate = cloudTemplates.some((template) => (
    template.templateName === localTemplate.templateName
    && template.vendor === localTemplate.vendor
    && template.client === localTemplate.client
  ));
  return hasEquivalentCloudTemplate ? cloudTemplates : [localTemplate, ...cloudTemplates];
}
function countWorkedDays(week: StoredWeek): number {
  if (!Array.isArray(week.days)) return 0;
  return week.days.filter((day) => (day.totalHours ?? day.hours ?? 0) > 0).length;
}

function buildDraftFromWeek(
  week: StoredWeek,
  projectId: string,
  projectName: string,
  clientName: string,
  personNameLookup: Record<string, { name?: string }>,
  personRate: PersonRate | undefined,
  todayIso: string,
  index: number,
  template?: ProjectInvoiceTemplate | null
): InvoiceDraft {
  const personName = personNameLookup[week.personId]?.name || week.personId;
  const hours = sumWeekHours(week);

  // Graph-defined rate: hourly bills by hours, daily bills by worked days.
  // No rate on the person's graph node → 0 (caller warns), never a made-up rate.
  const usableRate = personRate && !personRate.masked ? personRate : undefined;
  const rateType = usableRate?.rateType ?? 'unknown';
  const rate = usableRate?.rate ?? 0;
  const quantity = rateType === 'daily' ? countWorkedDays(week) : hours;
  const amount = quantity * rate;
  const unitLabel = rateType === 'daily' ? 'days' : 'hours';
  const currency = usableRate?.currency || template?.currency || 'EUR';

  const shortPerson = week.personId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
  const weekStamp = week.weekStart.replace(/-/g, '');
  const base: InvoiceDraft = {
    id: `inv_${week.personId}_${week.weekStart}`,
    templateId: null,
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
    rate,
    amount,
    currency,
    status: 'draft',
    timesheetKey: makeTimesheetKey(week.personId, week.weekStart),
    lineItems: [
      {
        id: `line_${week.personId}_${week.weekStart}`,
        description: `Approved timesheet - ${week.weekLabel} (${personName}, ${quantity} ${unitLabel})`,
        quantity,
        unitPrice: rate,
        amount,
      },
    ],
  };

  return template ? applyTemplateToDraft(base, template) : base;
}

// ---------------------------------------------------------------------------
// Consolidated invoicing (P4-7 lite): one invoice per SELLER ORG per month,
// with a line per person-week — a company bills the agency once for all of
// its employees, instead of one invoice per person-week. People whose org
// can't be resolved fall back to their own per-person invoice.
// ---------------------------------------------------------------------------

interface SellerWeekGroup {
  sellerId?: string;
  sellerName?: string;
  buyerId?: string;
  buyerName?: string;
  weeks: StoredWeek[];
}

function groupWeeksBySellerOrg(weeks: StoredWeek[], projectId: string): SellerWeekGroup[] {
  const parties: any[] = readApprovalParties(projectId);
  const personToParty = new Map<string, any>();
  parties.forEach((party) => (party?.people || []).forEach((person: { id: string }) => {
    if (person?.id) personToParty.set(person.id, party);
  }));

  const groups = new Map<string, SellerWeekGroup>();
  weeks.forEach((week) => {
    const party = personToParty.get(week.personId);
    const key = party?.id || `solo:${week.personId}`;
    if (!groups.has(key)) {
      const buyer = party
        ? parties.find((p) => p?.id && Array.isArray(party.billsTo) && party.billsTo.includes(p.id))
        : undefined;
      groups.set(key, {
        sellerId: party?.id,
        sellerName: party?.name,
        buyerId: buyer?.id,
        buyerName: buyer?.name,
        weeks: [],
      });
    }
    groups.get(key)!.weeks.push(week);
  });
  return Array.from(groups.values());
}

function buildConsolidatedDraft(
  group: SellerWeekGroup,
  projectId: string,
  projectName: string,
  clientName: string,
  personNameLookup: Record<string, { name?: string }>,
  rates: Record<string, PersonRate>,
  todayIso: string,
  index: number,
  monthLabel: string,
  template?: ProjectInvoiceTemplate | null,
): InvoiceDraft {
  const perWeek = group.weeks.map((week, i) =>
    buildDraftFromWeek(week, projectId, projectName, clientName, personNameLookup, rates[week.personId], todayIso, index * 100 + i, null)
  );

  const lineItems: InvoiceLineItem[] = perWeek.map((draft) => ({
    id: `line_${draft.personId}_${draft.weekStart}`,
    description: draft.lineItems?.[0]?.description
      || `Approved timesheet - ${draft.weekLabel} (${draft.personName})`,
    quantity: draft.lineItems?.[0]?.quantity ?? draft.hours,
    unitPrice: draft.rate,
    amount: draft.amount,
  }));

  const totalAmount = perWeek.reduce((acc, draft) => acc + draft.amount, 0);
  const totalHours = perWeek.reduce((acc, draft) => acc + draft.hours, 0);
  const earliest = [...group.weeks].sort((a, b) => a.weekStart.localeCompare(b.weekStart))[0];
  const currency = perWeek.find((draft) => draft.currency)?.currency || 'EUR';
  const monthStamp = earliest.weekStart.slice(0, 7).replace('-', '');
  const sellerSlug = (group.sellerName || perWeek[0].personName).replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();

  const base: InvoiceDraft = {
    ...perWeek[0],
    id: `inv_month_${group.sellerId || perWeek[0].personId}_${monthStamp}`,
    number: `INV-${monthStamp}-${sellerSlug || String(index + 1).padStart(3, '0')}`,
    personName: group.sellerName || perWeek[0].personName,
    weekStart: earliest.weekStart,
    weekLabel: `${monthLabel} · ${group.weeks.length} week${group.weeks.length === 1 ? '' : 's'}`,
    hours: totalHours,
    rate: 0, // multi-line invoice: pricing lives on the per-week lines
    amount: totalAmount,
    currency,
    fromPartyName: group.sellerName || perWeek[0].fromPartyName,
    toPartyName: group.buyerName || perWeek[0].toPartyName || clientName,
    timesheetKey: makeTimesheetKey(perWeek[0].personId, perWeek[0].weekStart),
    timesheetIds: group.weeks.map((week) => makeTimesheetKey(week.personId, week.weekStart)),
    lineItems,
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
    templateId: invoice.templateId ?? null,
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
    subtotal: undefined,
    taxTotal: undefined,
    total: undefined,
    status: apiStatus,
    notes: invoice.notes,
    lineItemTemplateDescription: invoice.lineItemTemplateDescription,
    fromPartyId: partyIds.fromPartyId,
    toPartyId: partyIds.toPartyId,
    fromPartyName: invoice.fromPartyName || partyIds.fromPartyName || invoice.projectName,
    toPartyName: invoice.toPartyName || partyIds.toPartyName || invoice.clientName,
    fromAddress: invoice.fromAddress ?? undefined,
    toAddress: invoice.toAddress ?? undefined,
    taxRate: invoice.taxRate ?? 0,
    fromTaxId: invoice.fromTaxId ?? undefined,
    toTaxId: invoice.toTaxId ?? undefined,
    fromIban: invoice.fromIban ?? undefined,
    paymentRef: invoice.paymentRef ?? undefined,
    timesheetIds: invoice.timesheetIds && invoice.timesheetIds.length > 0
      ? invoice.timesheetIds
      : invoice.timesheetKey ? [invoice.timesheetKey] : [makeTimesheetKey(invoice.personId, invoice.weekStart)],
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
  const syncState = invoice.syncState || 'cloud';

  return {
    id: invoice.id,
    templateId: invoice.templateId ?? null,
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
    fromPartyName: invoice.fromPartyName ?? null,
    toPartyName: invoice.toPartyName ?? null,
    fromAddress: invoice.fromAddress ?? null,
    toAddress: invoice.toAddress ?? null,
    taxRate: typeof invoice.taxRate === 'number' ? invoice.taxRate : 0,
    fromTaxId: invoice.fromTaxId ?? null,
    toTaxId: invoice.toTaxId ?? null,
    fromIban: invoice.fromIban ?? null,
    paymentRef: invoice.paymentRef ?? null,
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
  const { selectedMonth, setSelectedMonth } = useMonthContextSafe();
  const { accessToken } = useAuth();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [storedInvoices, setStoredInvoices] = useState<PersistedInvoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isSavingInvoices, setIsSavingInvoices] = useState(false);
  // One invoice per seller org per month (lines per person-week) vs one per person-week.
  const [consolidateInvoices, setConsolidateInvoices] = useState(true);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [projectTemplate, setProjectTemplate] = useState<ProjectInvoiceTemplate | null>(() => readProjectInvoiceTemplate(projectId));
  const [billingTemplates, setBillingTemplates] = useState<InvoiceTemplate[]>([]);
  const [selectedBillingTemplateId, setSelectedBillingTemplateId] = useState<string>('none');
  const [isTemplateBusy, setIsTemplateBusy] = useState(false);

  const currentProjectName = projectName || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('currentProjectName') : null) || 'Project';
  const defaultClientName = useMemo(() => readClientName(projectId), [projectId]);
  const personNameLookup = useMemo(() => readNameDir(projectId), [projectId]);

  useEffect(() => {
    setProjectTemplate(readProjectInvoiceTemplate(projectId));
  }, [projectId]);

  const currentMonth = selectedMonth instanceof Date ? selectedMonth : new Date(selectedMonth);
  const monthKey = monthKeyFromDate(currentMonth);
  const selectedMonthLabel = formatMonthLabel(currentMonth);

  const handleMonthChange = useCallback((nextMonth: Date) => {
    setSelectedMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
  }, [setSelectedMonth]);

  const handleMonthInputChange = useCallback((value: string) => {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    handleMonthChange(new Date(`${value}-01T00:00:00`));
  }, [handleMonthChange]);

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

  const refreshTemplates = useCallback(async () => {
    setIsTemplateBusy(true);
    try {
      const data = await listTemplates(projectId, accessToken);
      setBillingTemplates(data);
    } catch (error) {
      console.error('Failed to load invoice templates:', error);
      toast.error('Could not load invoice templates.');
    } finally {
      setIsTemplateBusy(false);
    }
  }, [accessToken, projectId]);

  useEffect(() => {
    void refreshInvoices();
  }, [refreshInvoices]);

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

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

  const availableBillingTemplates = useMemo(
    () => buildBillingTemplateOptions(projectId, billingTemplates, projectTemplate),
    [billingTemplates, projectId, projectTemplate],
  );

  const selectedBillingTemplate = useMemo(
    () => availableBillingTemplates.find((template) => template.id === selectedBillingTemplateId) || null,
    [availableBillingTemplates, selectedBillingTemplateId],
  );

  useEffect(() => {
    if (selectedInvoiceId && !monthInvoices.some((invoice) => invoice.id === selectedInvoiceId)) {
      setSelectedInvoiceId(null);
    }
  }, [monthInvoices, selectedInvoiceId]);

  const handleGenerateDrafts = useCallback(async () => {
    if (approvedWeeks.length === 0) {
      toast.info(`No approved timesheets found for ${selectedMonthLabel} yet.`);
      return;
    }

    // Rates come from person nodes in the project graph (wg_projects.graph).
    const rates = await resolveProjectRates(projectId).catch(() => ({} as Record<string, PersonRate>));
    const todayIso = new Date().toISOString().slice(0, 10);

    // Dedup BEFORE building: a week already covered by any stored invoice
    // (including inside a consolidated invoice's timesheetIds) is skipped.
    const existingKeys = new Set<string>();
    storedInvoices.forEach((invoice) => {
      const normalized = normalizePersistedInvoice(invoice, projectId, currentProjectName, defaultClientName, personNameLookup, weekLookup);
      existingKeys.add(getInvoiceKey(normalized));
      (invoice.timesheetIds || []).forEach((key) => existingKeys.add(key));
    });

    const weeksToInvoice = approvedWeeks.filter((week) => !existingKeys.has(makeTimesheetKey(week.personId, week.weekStart)));
    if (weeksToInvoice.length === 0) {
      toast.info('All approved weeks already have invoices.');
      return;
    }

    const missingRateNames = Array.from(new Set(
      weeksToInvoice
        .filter((week) => {
          const rate = rates[week.personId];
          return !rate || rate.masked || rate.rate <= 0;
        })
        .map((week) => personNameLookup[week.personId]?.name || week.personId)
    ));
    if (missingRateNames.length > 0) {
      toast.warning(
        `No rate found in the graph for: ${missingRateNames.join(', ')}. Drafts use 0 — set rates on their nodes in the Graph tab.`,
        { duration: 8000 },
      );
    }

    const draftsToCreate = consolidateInvoices
      ? groupWeeksBySellerOrg(weeksToInvoice, projectId).map((group, index) => {
          const draft = buildConsolidatedDraft(
            group,
            projectId,
            currentProjectName,
            defaultClientName,
            personNameLookup,
            rates,
            todayIso,
            index,
            selectedMonthLabel,
            projectTemplate,
          );
          return selectedBillingTemplate ? applyBillingTemplateToDraft(draft, selectedBillingTemplate) : draft;
        })
      : weeksToInvoice.map((week, index) => {
          const draft = buildDraftFromWeek(
            week,
            projectId,
            currentProjectName,
            defaultClientName,
            personNameLookup,
            rates[week.personId],
            todayIso,
            index,
            projectTemplate,
          );
          return selectedBillingTemplate ? applyBillingTemplateToDraft(draft, selectedBillingTemplate) : draft;
        });

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
  }, [accessToken, approvedWeeks, consolidateInvoices, currentProjectName, defaultClientName, personNameLookup, projectId, projectTemplate, refreshInvoices, selectedBillingTemplate, selectedMonthLabel, storedInvoices, weekLookup]);

  const handleSaveInvoice = useCallback(async (invoiceId: string, patch: Partial<InvoicePayload>) => {
    await updateInvoice(invoiceId, patch, accessToken);
    await refreshInvoices();
    toast.success('Invoice updated.');
  }, [accessToken, refreshInvoices]);

  const handleApplyInvoiceTemplate = useCallback(async (invoice: InvoiceDraft, templateId: string) => {
    const template = availableBillingTemplates.find((item) => item.id === templateId);
    if (!template) {
      toast.error('Template not found.');
      return;
    }

    setIsTemplateBusy(true);
    try {
      await updateInvoice(invoice.id, buildTemplatePatch(invoice, template), accessToken);
      await refreshInvoices();
      toast.success(`Applied ${template.templateName}.`);
    } catch (error) {
      console.error('Failed to apply invoice template:', error);
      const message = error instanceof Error ? error.message : 'Could not apply the template.';
      toast.error(message);
    } finally {
      setIsTemplateBusy(false);
    }
  }, [accessToken, availableBillingTemplates, refreshInvoices]);

  const handleSaveInvoiceTemplate = useCallback(async (invoice: InvoiceDraft, templateName: string) => {
    setIsTemplateBusy(true);
    try {
      const saved = await saveTemplate(buildTemplateFromInvoice(invoice, templateName), accessToken);
      await refreshTemplates();
      if (saved.id) setSelectedBillingTemplateId(saved.id);
      toast.success(`Saved ${saved.templateName} as a reusable invoice template.`);
    } catch (error) {
      console.error('Failed to save invoice template:', error);
      const message = error instanceof Error ? error.message : 'Could not save the template.';
      toast.error(message);
    } finally {
      setIsTemplateBusy(false);
    }
  }, [accessToken, refreshTemplates]);

  const handleImportedTemplateSaved = useCallback(async (template: ProjectInvoiceTemplate): Promise<'api' | 'fallback'> => {
    setProjectTemplate(template);
    setIsTemplateBusy(true);
    try {
      const saved = await saveTemplate(buildTemplateFromImportedProjectTemplate(projectId, template), accessToken);
      await refreshTemplates();
      if (saved.id) setSelectedBillingTemplateId(saved.id);
      return saved.id?.startsWith('tpl_') ? 'api' : 'fallback';
    } catch (error) {
      console.error('Failed to persist imported invoice template:', error);
      return 'fallback';
    } finally {
      setIsTemplateBusy(false);
    }
  }, [accessToken, projectId, refreshTemplates]);

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

  const handleDeleteDraftInvoice = useCallback(async (invoice: InvoiceDraft) => {
    const invoiceStatus = invoice.apiStatus ?? apiStatusFromUiStatus(invoice.status);
    if (invoiceStatus !== 'draft') {
      toast.info('Only draft invoices can be deleted. Use cancel/void for issued invoices.');
      return;
    }

    const confirmed = window.confirm(`Delete draft invoice ${invoice.number}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingInvoiceId(invoice.id);
    try {
      await deleteDraftInvoice(invoice.id, accessToken);
      if (selectedInvoiceId === invoice.id) setSelectedInvoiceId(null);
      await refreshInvoices();
      toast.success(`Deleted draft invoice ${invoice.number}.`);
    } catch (error) {
      console.error('Failed to delete draft invoice:', error);
      const message = error instanceof Error ? error.message : 'Could not delete the draft invoice.';
      toast.error(message);
    } finally {
      setDeletingInvoiceId(null);
    }
  }, [accessToken, refreshInvoices, selectedInvoiceId]);

  if (selectedInvoice) {
    const detailSyncBadge = syncBadgeInfo(selectedInvoice.syncState);
    return (
      <div className="flex h-full flex-col space-y-4">
        <div className="flex items-center justify-end gap-2">
          <Badge variant="outline" className={detailSyncBadge.className}>
            {detailSyncBadge.label}
          </Badge>
          {(selectedInvoice.apiStatus || selectedInvoice.status) === 'draft' ? (
            <>
              <Button
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={() => void handleDeleteDraftInvoice(selectedInvoice)}
                disabled={deletingInvoiceId === selectedInvoice.id}
              >
                {deletingInvoiceId === selectedInvoice.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete draft
              </Button>
              <Button
                variant="default"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => void handleMarkIssued(selectedInvoice)}
                disabled={updatingInvoiceId === selectedInvoice.id}
              >
                {updatingInvoiceId === selectedInvoice.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Mark issued
              </Button>
            </>
          ) : null}
        </div>
        <InvoiceDetailPrintView
          invoice={selectedInvoice}
          onBack={() => setSelectedInvoiceId(null)}
          onSave={selectedInvoice.syncState !== 'local'
            ? (patch) => handleSaveInvoice(selectedInvoice.id, patch)
            : undefined}
          templates={availableBillingTemplates}
          onApplyTemplate={selectedInvoice.syncState !== 'local'
            ? (templateId) => handleApplyInvoiceTemplate(selectedInvoice, templateId)
            : undefined}
          onSaveTemplate={selectedInvoice.syncState !== 'local'
            ? (templateName) => handleSaveInvoiceTemplate(selectedInvoice, templateName)
            : undefined}
          templateBusy={isTemplateBusy}
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
            Generate invoice drafts for {selectedMonthLabel} from approved timesheets and persist them to Supabase.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => handleMonthChange(addMonths(currentMonth, -1))}
              aria-label="Previous invoice month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              className="h-9 w-[145px] rounded-none border-0 px-2 text-center shadow-none focus-visible:ring-0"
              value={monthKey}
              onChange={(event) => handleMonthInputChange(event.target.value)}
              aria-label="Invoice month"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => handleMonthChange(addMonths(currentMonth, 1))}
              aria-label="Next invoice month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
          <Select value={selectedBillingTemplateId} onValueChange={setSelectedBillingTemplateId} disabled={isTemplateBusy}>
            <SelectTrigger className="w-[220px] bg-white shadow-sm">
              <SelectValue placeholder="Invoice template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No saved template</SelectItem>
              {availableBillingTemplates.map((template) => (
                <SelectItem key={template.id || template.templateName} value={template.id || template.templateName}>
                  {template.templateName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground" title="One monthly invoice per organization with a line per person-week — instead of a separate invoice for every week.">
            <input
              type="checkbox"
              checked={consolidateInvoices}
              onChange={(e) => setConsolidateInvoices(e.target.checked)}
              className="h-3.5 w-3.5 accent-indigo-600"
            />
            One invoice per organization
          </label>
          <Button
            variant="default"
            className="bg-indigo-600 shadow-sm hover:bg-indigo-700"
            onClick={() => void handleGenerateDrafts()}
            disabled={isSavingInvoices}
          >
            {isSavingInvoices ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Generate for {selectedMonthLabel}
          </Button>
        </div>
      </div>

      <InvoiceImportPanel
        projectId={projectId}
        defaultVendor={currentProjectName}
        defaultClient={defaultClientName}
        projectTemplate={projectTemplate}
        onTemplateSaved={handleImportedTemplateSaved}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="flex items-center justify-between p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Approved Weeks</p>
              <p className="text-[11px] text-slate-400">{selectedMonthLabel}</p>
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
              <p className="text-[11px] text-slate-400">{selectedMonthLabel}</p>
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
              <p className="text-[11px] text-slate-400">{selectedMonthLabel}</p>
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
              <p className="text-[11px] text-slate-400">{selectedMonthLabel}</p>
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
                No invoice records for {selectedMonthLabel}. Click <strong>Generate for {selectedMonthLabel}</strong> to create invoices from approved timesheets in this month.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleInvoices.map((invoice) => {
                const badgeInfo = statusBadgeInfo(invoice.apiStatus || invoice.status);
                const rowSyncBadge = syncBadgeInfo(invoice.syncState);
                const invoiceStatus = invoice.apiStatus ?? apiStatusFromUiStatus(invoice.status);
                const canDeleteDraft = invoiceStatus === 'draft';
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
                        <Badge variant="outline" className={rowSyncBadge.className}>
                          {rowSyncBadge.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {canDeleteDraft ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteDraftInvoice(invoice);
                            }}
                            disabled={deletingInvoiceId === invoice.id}
                          >
                            {deletingInvoiceId === invoice.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
                            Delete
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
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
