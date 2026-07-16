// ============================================================================
// Invoices API — direct Supabase persistence for wg_invoices / wg_invoice_templates
//
// P4-1 rewrite (2026-07-08):
//   - Replaced undeployed edge-function fetches with the shared Supabase client
//     (same pattern as projects-api.ts / approvals-supabase.ts).
//   - Removed the isUuid() cloud gate — after D3 every project is cloud-backed
//     (TEXT ids like proj_xxx included). localStorage remains ONLY as an
//     offline/network-failure fallback, surfaced via syncState: 'local'.
//   - Added resolveProjectRates(): originally read rates from person nodes in
//     wg_projects.graph. Trust Core now reads private wg_contract_rates rows
//     first; graph fallback is dev-only.
// ============================================================================

import { createClient } from '../supabase/client';

const supabase = createClient();
const ALLOW_GRAPH_RATE_FALLBACK = import.meta.env.VITE_ALLOW_GRAPH_RATE_FALLBACK === 'true';

const LOCAL_INVOICES_KEY = (projectId: string) => `workgraph-invoices-${projectId}`;
const LOCAL_INVOICE_INDEX_KEY = 'workgraph-invoice-index-v1';
const LOCAL_TEMPLATES_KEY = (scope: string) => `workgraph-invoice-templates-${scope}`;

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceTemplateLineDefault {
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

export interface InvoiceTemplateBillingDefaults {
  fromPartyName?: string;
  fromAddress?: string;
  fromTaxId?: string;
  fromIban?: string;
  toPartyName?: string;
  toAddress?: string;
  toTaxId?: string;
  taxRate?: number;
  paymentRef?: string;
  notes?: string;
  currency?: string;
  dueDateOffsetDays?: number;
  lineItemDescription?: string;
}

export interface InvoiceTemplate {
  id?: string;
  ownerId?: string;
  projectId?: string;
  templateName: string;
  vendor: string;
  client: string;
  currency: string;
  notes: string;
  dueDateOffsetDays: number;
  lineDefaults: InvoiceTemplateLineDefault[];
  updatedAt: string;
  name?: string;
  locale?: string;
  layout?: Record<string, any>;
  fieldMap?: Record<string, any>;
  compliance?: Record<string, any>;
  billingDefaults?: InvoiceTemplateBillingDefaults;
  branding?: Record<string, any> | null;
  sourceFile?: string | null;
  isDefault?: boolean;
  createdAt?: string;
}

export interface Invoice {
  id: string;
  projectId: string;
  templateId?: string | null;
  invoiceNumber: string;
  fromPartyId: string;
  toPartyId: string;
  fromPartyName?: string | null;
  toPartyName?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  taxRate?: number;
  fromTaxId?: string | null;
  toTaxId?: string | null;
  fromIban?: string | null;
  issueDate: string;
  dueDate: string;
  deliveryDate?: string | null;
  currency: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  status: InvoiceStatus;
  timesheetIds: string[];
  en16931Xml?: string | null;
  pdfUrl?: string | null;
  paymentRef?: string | null;
  notes?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  projectName?: string;
  clientName?: string;
  personId?: string;
  personName?: string;
  weekStart?: string;
  weekLabel?: string;
  hours?: number;
  rate?: number;
  amount?: number;
  lineItemTemplateDescription?: string;
  syncState?: 'cloud' | 'local';
}

export interface InvoicePayload {
  projectId: string;
  id?: string;
  projectName?: string;
  clientName?: string;
  personId?: string;
  personName?: string;
  weekStart?: string;
  weekLabel?: string;
  number?: string;
  invoiceNumber?: string;
  date?: string;
  issueDate?: string;
  dueDate?: string;
  currency?: string;
  hours?: number;
  rate?: number;
  amount?: number;
  subtotal?: number;
  taxTotal?: number;
  total?: number;
  status?: InvoiceStatus;
  notes?: string;
  lineItemTemplateDescription?: string;
  templateId?: string | null;
  fromPartyId?: string;
  toPartyId?: string;
  fromPartyName?: string | null;
  toPartyName?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  taxRate?: number;
  fromTaxId?: string | null;
  toTaxId?: string | null;
  fromIban?: string | null;
  deliveryDate?: string | null;
  timesheetIds?: string[];
  lineItems?: InvoiceLineItem[];
  en16931Xml?: string | null;
  pdfUrl?: string | null;
  paymentRef?: string | null;
}

// ----------------------------------------------------------------------------
// Graph-defined rates
// ----------------------------------------------------------------------------

export type PersonRateType = 'hourly' | 'daily' | 'fixed' | 'unknown';

export interface PersonRate {
  personId: string;
  personName?: string;
  rate: number;
  rateType: PersonRateType;
  currency?: string;
  /** true when the graph stores a masked placeholder instead of a number */
  masked: boolean;
}

export interface SaveProjectPersonRateInput {
  projectId: string;
  personId: string;
  personName?: string;
  rate: number;
  rateType: Exclude<PersonRateType, 'unknown'>;
  currency?: string;
}

const MASK_PLACEHOLDER = '••••';

function extractNodeRate(node: any): PersonRate | null {
  const data = node?.data;
  if (!data || typeof node?.id !== 'string') return null;

  const contractType = normalizeString(data.contractType).toLowerCase();
  const hourlyRaw = data.hourlyRate;
  const dailyRaw = data.dailyRate;
  const fixedRaw = data.fixedAmount;

  const masked = hourlyRaw === MASK_PLACEHOLDER || dailyRaw === MASK_PLACEHOLDER;

  let rateType: PersonRateType = 'unknown';
  let rate = 0;
  if ((contractType === 'hourly' || !contractType) && toNumber(hourlyRaw) > 0) {
    rateType = 'hourly';
    rate = toNumber(hourlyRaw);
  } else if (contractType === 'daily' && toNumber(dailyRaw) > 0) {
    rateType = 'daily';
    rate = toNumber(dailyRaw);
  } else if (contractType === 'fixed' && toNumber(fixedRaw) > 0) {
    rateType = 'fixed';
    rate = toNumber(fixedRaw);
  } else if (toNumber(dailyRaw) > 0) {
    rateType = 'daily';
    rate = toNumber(dailyRaw);
  }

  if (rate <= 0 && !masked) return null;

  return {
    personId: node.id,
    personName: normalizeString(data.name ?? data.label) || undefined,
    rate,
    rateType,
    currency: normalizeString(data.currency).toUpperCase() || undefined,
    masked,
  };
}

async function resolvePrivateProjectRates(projectId: string): Promise<Record<string, PersonRate>> {
  const scope = normalizeString(projectId);
  if (!scope) return {};

  const { data, error } = await supabase
    .from('wg_contract_rates')
    .select('subject_graph_node_id, subject_user_id, amount, rate_type, currency, rate_scope, effective_from, effective_to')
    .eq('project_id', scope)
    .eq('rate_scope', 'bill')
    .is('effective_to', null);

  if (error) {
    console.warn(`[invoices] private rate lookup failed for ${scope}: ${error.message}`);
    return {};
  }

  const rates: Record<string, PersonRate> = {};
  (Array.isArray(data) ? data : []).forEach((row: any) => {
    const personId = normalizeString(row?.subject_graph_node_id || row?.subject_user_id);
    const amount = toNumber(row?.amount);
    const rateType = normalizeString(row?.rate_type).toLowerCase() as PersonRateType;
    if (!personId || amount <= 0) return;
    rates[personId] = {
      personId,
      rate: amount,
      rateType: rateType === 'daily' || rateType === 'fixed' ? rateType : 'hourly',
      currency: normalizeString(row?.currency).toUpperCase() || undefined,
      masked: false,
    };
  });
  return rates;
}

async function resolveLegacyGraphRates(projectId: string): Promise<Record<string, PersonRate>> {
  const scope = normalizeString(projectId);
  if (!scope) return {};

  const { data, error } = await supabase
    .from('wg_projects')
    .select('graph')
    .eq('id', scope)
    .maybeSingle();

  if (error) {
    console.warn(`[invoices] resolveProjectRates failed for ${scope}: ${error.message}`);
    return {};
  }

  const graph = (data as any)?.graph;
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const rates: Record<string, PersonRate> = {};
  nodes.forEach((node: any) => {
    const personRate = extractNodeRate(node);
    if (personRate) rates[personRate.personId] = personRate;
  });
  return rates;
}

/**
 * Returns private, RLS-filtered bill rates keyed by graph person node id.
 * Legacy graph-rate fallback exists only for explicit local/dev recovery.
 */
export async function resolveProjectRates(projectId: string): Promise<Record<string, PersonRate>> {
  const privateRates = await resolvePrivateProjectRates(projectId);
  if (Object.keys(privateRates).length > 0 || !ALLOW_GRAPH_RATE_FALLBACK) return privateRates;
  return resolveLegacyGraphRates(projectId);
}

export async function saveProjectPersonRate(input: SaveProjectPersonRateInput): Promise<PersonRate> {
  const projectId = normalizeString(input.projectId);
  const personId = normalizeString(input.personId);
  const amount = toNumber(input.rate);
  const rateType = input.rateType === 'daily' || input.rateType === 'fixed' ? input.rateType : 'hourly';
  const currency = normalizeString(input.currency).toUpperCase() || 'EUR';

  if (!projectId) throw new Error('projectId is required');
  if (!personId) throw new Error('personId is required');
  if (amount <= 0) throw new Error('Rate must be greater than 0');

  const userId = await getSessionUserId();
  if (!userId) throw new Error('You must be signed in to save rates.');

  const { data: existing, error: fetchError } = await supabase
    .from('wg_contract_rates')
    .select('id')
    .eq('project_id', projectId)
    .eq('subject_graph_node_id', personId)
    .eq('rate_scope', 'bill')
    .is('effective_to', null)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message || 'Failed to load existing rate');

  const row = {
    project_id: projectId,
    subject_graph_node_id: personId,
    rate_scope: 'bill',
    rate_type: rateType,
    amount,
    currency,
    source: 'api',
    created_by: userId,
  };

  const result = existing?.id
    ? await supabase
        .from('wg_contract_rates')
        .update({
          rate_type: row.rate_type,
          amount: row.amount,
          currency: row.currency,
          source: row.source,
        })
        .eq('id', existing.id)
        .select('subject_graph_node_id, amount, rate_type, currency')
        .single()
    : await supabase
        .from('wg_contract_rates')
        .insert(row)
        .select('subject_graph_node_id, amount, rate_type, currency')
        .single();

  if (result.error) {
    if (result.error.code === '42501') {
      throw new Error('You do not have permission to save billing rates for this project.');
    }
    throw new Error(result.error.message || 'Failed to save billing rate');
  }

  const saved = result.data as any;
  return {
    personId: normalizeString(saved?.subject_graph_node_id) || personId,
    personName: input.personName,
    rate: toNumber(saved?.amount, amount),
    rateType: normalizeString(saved?.rate_type).toLowerCase() === 'daily'
      ? 'daily'
      : normalizeString(saved?.rate_type).toLowerCase() === 'fixed'
        ? 'fixed'
        : 'hourly',
    currency: normalizeString(saved?.currency).toUpperCase() || currency,
    masked: false,
  };
}

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------

function normalizeString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStatus(value: unknown): InvoiceStatus {
  const status = normalizeString(value).toLowerCase();
  if (
    status === 'issued'
    || status === 'paid'
    || status === 'partially_paid'
    || status === 'overdue'
    || status === 'cancelled'
  ) {
    return status;
  }
  return 'draft';
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function isNetworkError(error: unknown): boolean {
  return error instanceof Error && /Failed to fetch|NetworkError|fetch failed|Load failed/i.test(error.message);
}

async function getSessionUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// localStorage cache (offline / network-failure fallback only)
// ----------------------------------------------------------------------------

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the UI responsive if storage is unavailable or full.
  }
}

function readInvoiceIndex(): Record<string, string> {
  return readJson<Record<string, string>>(LOCAL_INVOICE_INDEX_KEY, {});
}

function writeInvoiceIndex(invoices: Invoice[]): void {
  const nextIndex: Record<string, string> = {};
  invoices.forEach((invoice) => {
    nextIndex[invoice.id] = invoice.projectId;
  });
  writeJson(LOCAL_INVOICE_INDEX_KEY, nextIndex);
}

function findLocalInvoiceProjectId(invoiceId: string): string | null {
  const index = readInvoiceIndex();
  if (index[invoiceId]) return index[invoiceId];

  if (!hasStorage()) return null;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith('workgraph-invoices-')) continue;
    const records = readJson<Invoice[]>(key, []);
    if (records.some((invoice) => invoice.id === invoiceId)) {
      return key.replace('workgraph-invoices-', '');
    }
  }
  return null;
}

function readLocalInvoices(projectId: string): Invoice[] {
  const records = readJson<Invoice[]>(LOCAL_INVOICES_KEY(projectId), []);
  return records.map((record) => normalizeInvoiceRecord(record, record.syncState === 'local' ? 'local' : 'cloud'));
}

function writeLocalInvoices(projectId: string, invoices: Invoice[]): void {
  const deduped = mergeInvoicesByIdentity([], invoices);
  writeJson(LOCAL_INVOICES_KEY(projectId), deduped);
  writeInvoiceIndex(deduped);
}

function readLocalTemplates(scope: string): InvoiceTemplate[] {
  const records = readJson<InvoiceTemplate[]>(LOCAL_TEMPLATES_KEY(scope), []);
  return records.map((record) => normalizeTemplateRecord(record));
}

function writeLocalTemplates(scope: string, templates: InvoiceTemplate[]): void {
  const deduped = mergeTemplatesByIdentity([], templates);
  writeJson(LOCAL_TEMPLATES_KEY(scope), deduped);
}

// ----------------------------------------------------------------------------
// Normalization / identity
// ----------------------------------------------------------------------------

function invoiceIdentity(invoice: Pick<Invoice, 'id' | 'invoiceNumber' | 'timesheetIds' | 'personId' | 'weekStart'>): string {
  const timesheetKey = Array.isArray(invoice.timesheetIds) && invoice.timesheetIds.length > 0 ? normalizeString(invoice.timesheetIds[0]) : '';
  if (timesheetKey) return timesheetKey;
  if (invoice.personId && invoice.weekStart) return `${invoice.personId}:${invoice.weekStart}`;
  if (invoice.invoiceNumber) return invoice.invoiceNumber;
  return invoice.id;
}

function templateIdentity(template: InvoiceTemplate): string {
  return template.id || template.templateName || template.updatedAt || generateId('template');
}

function normalizeLineItems(value: unknown): InvoiceLineItem[] {
  const items = Array.isArray(value) ? value : [];
  return items.map((item: any, index: number) => ({
    id: normalizeString(item?.id) || generateId(`line_${index}`),
    description: normalizeString(item?.description),
    quantity: toNumber(item?.quantity ?? item?.hours ?? 0),
    unitPrice: toNumber(item?.unitPrice ?? item?.rate ?? 0),
    amount: toNumber(item?.amount ?? item?.total ?? 0),
  }));
}

function deriveLineItemTotals(lineItems: InvoiceLineItem[]): { hours: number; rate: number; amount: number } {
  const hours = lineItems.reduce((sum, item) => sum + toNumber(item.quantity), 0);
  const amount = lineItems.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const rate = lineItems.length > 0 ? toNumber(lineItems[0].unitPrice, hours > 0 ? amount / hours : 0) : 0;
  return { hours, rate, amount };
}

function normalizeInvoiceRecord(row: any, syncState: 'cloud' | 'local' = 'cloud'): Invoice {
  const lineItems = normalizeLineItems(row?.lineItems ?? row?.line_items);
  const totals = deriveLineItemTotals(lineItems);
  const subtotal = toNumber(row?.subtotal ?? row?.sub_total, totals.amount);
  const taxTotal = toNumber(row?.taxTotal ?? row?.tax_total, 0);
  const total = toNumber(row?.total ?? row?.total_amount, subtotal + taxTotal);
  const issueDate = normalizeString(row?.issueDate ?? row?.issue_date ?? row?.date) || todayIso();
  const dueDate = normalizeString(row?.dueDate ?? row?.due_date) || addDays(issueDate, 30);
  const timesheetIds = Array.isArray(row?.timesheetIds ?? row?.timesheet_ids)
    ? (row.timesheetIds ?? row.timesheet_ids).map((item: unknown) => normalizeString(item)).filter(Boolean)
    : [];

  return {
    id: normalizeString(row?.id) || generateId('inv'),
    projectId: normalizeString(row?.projectId ?? row?.project_id),
    templateId: row?.templateId ?? row?.template_id ?? null,
    invoiceNumber: normalizeString(row?.invoiceNumber ?? row?.invoice_number ?? row?.number),
    fromPartyId: normalizeString(row?.fromPartyId ?? row?.from_party_id),
    toPartyId: normalizeString(row?.toPartyId ?? row?.to_party_id),
    fromPartyName: row?.fromPartyName ?? row?.from_party_name ?? null,
    toPartyName: row?.toPartyName ?? row?.to_party_name ?? null,
    fromAddress: row?.fromAddress ?? row?.from_address ?? null,
    toAddress: row?.toAddress ?? row?.to_address ?? null,
    taxRate: toNumber(row?.taxRate ?? row?.tax_rate, 0),
    fromTaxId: row?.fromTaxId ?? row?.from_tax_id ?? null,
    toTaxId: row?.toTaxId ?? row?.to_tax_id ?? null,
    fromIban: row?.fromIban ?? row?.from_iban ?? null,
    issueDate,
    dueDate,
    deliveryDate: row?.deliveryDate ?? row?.delivery_date ?? null,
    currency: normalizeString(row?.currency).toUpperCase() || 'EUR',
    lineItems,
    subtotal,
    taxTotal,
    total,
    status: normalizeStatus(row?.status),
    timesheetIds,
    en16931Xml: row?.en16931Xml ?? row?.en16931_xml ?? null,
    pdfUrl: row?.pdfUrl ?? row?.pdf_url ?? null,
    paymentRef: row?.paymentRef ?? row?.payment_ref ?? null,
    notes: row?.notes ?? null,
    createdBy: row?.createdBy ?? row?.created_by,
    createdAt: row?.createdAt ?? row?.created_at,
    updatedAt: row?.updatedAt ?? row?.updated_at,
    projectName: row?.projectName ?? undefined,
    clientName: row?.clientName ?? undefined,
    personId: row?.personId ?? undefined,
    personName: row?.personName ?? undefined,
    weekStart: row?.weekStart ?? undefined,
    weekLabel: row?.weekLabel ?? undefined,
    hours: toNumber(row?.hours, totals.hours),
    rate: toNumber(row?.rate, totals.rate),
    amount: toNumber(row?.amount, total),
    lineItemTemplateDescription: row?.lineItemTemplateDescription ?? lineItems[0]?.description ?? undefined,
    syncState,
  };
}

function normalizeTemplateLineDefaults(value: unknown): InvoiceTemplateLineDefault[] {
  const items = Array.isArray(value) ? value : [];
  return items.map((item: any, index: number) => ({
    description: normalizeString(item?.description) || `Line ${index + 1}`,
    quantity: normalizeString(item?.quantity) || '1',
    unitPrice: normalizeString(item?.unitPrice) || '0.00',
    amount: normalizeString(item?.amount) || '0.00',
  }));
}

function normalizeTemplateRecord(row: any): InvoiceTemplate {
  const layout = row?.layout ?? {};
  const branding = row?.branding ?? null;
  const templateName = normalizeString(
    row?.templateName
      ?? layout?.templateName
      ?? branding?.templateName
      ?? row?.name
  ) || 'Invoice Template';
  const currency = normalizeString(
    row?.currency
      ?? layout?.currency
      ?? branding?.currency
  ) || 'EUR';
  const billingDefaults = row?.billingDefaults ?? layout?.billingDefaults ?? branding?.billingDefaults ?? {};
  const dueDateOffsetDays = toNumber(
    row?.dueDateOffsetDays ?? layout?.dueDateOffsetDays ?? branding?.dueDateOffsetDays,
    30,
  );

  return {
    id: normalizeString(row?.id) || generateId('template'),
    ownerId: row?.ownerId ?? row?.owner_id ?? undefined,
    projectId: row?.projectId ?? row?.project_id ?? undefined,
    templateName,
    vendor: normalizeString(row?.vendor ?? layout?.vendor ?? branding?.vendor),
    client: normalizeString(row?.client ?? layout?.client ?? branding?.client),
    currency,
    notes: normalizeString(row?.notes ?? layout?.notes ?? branding?.notes),
    dueDateOffsetDays,
    lineDefaults: normalizeTemplateLineDefaults(row?.lineDefaults ?? layout?.lineDefaults ?? branding?.lineDefaults),
    updatedAt: normalizeString(row?.updatedAt ?? row?.updated_at) || todayIso(),
    name: row?.name ?? undefined,
    locale: row?.locale ?? undefined,
    layout: row?.layout ?? layout,
    fieldMap: row?.fieldMap ?? row?.field_map ?? {},
    compliance: row?.compliance ?? {},
    billingDefaults: {
      fromPartyName: normalizeString(billingDefaults?.fromPartyName),
      fromAddress: normalizeString(billingDefaults?.fromAddress),
      fromTaxId: normalizeString(billingDefaults?.fromTaxId),
      fromIban: normalizeString(billingDefaults?.fromIban),
      toPartyName: normalizeString(billingDefaults?.toPartyName),
      toAddress: normalizeString(billingDefaults?.toAddress),
      toTaxId: normalizeString(billingDefaults?.toTaxId),
      taxRate: toNumber(billingDefaults?.taxRate, 0),
      paymentRef: normalizeString(billingDefaults?.paymentRef),
      notes: normalizeString(billingDefaults?.notes),
      currency: normalizeString(billingDefaults?.currency || currency).toUpperCase() || currency,
      dueDateOffsetDays: toNumber(billingDefaults?.dueDateOffsetDays, dueDateOffsetDays),
      lineItemDescription: normalizeString(billingDefaults?.lineItemDescription),
    },
    branding: branding,
    sourceFile: row?.sourceFile ?? row?.source_file ?? null,
    isDefault: Boolean(row?.isDefault ?? row?.is_default),
    createdAt: row?.createdAt ?? row?.created_at,
  };
}

function mergeInvoicesByIdentity(primary: Invoice[], secondary: Invoice[]): Invoice[] {
  const merged = new Map<string, Invoice>();
  [...secondary, ...primary].forEach((invoice) => {
    if (!invoice?.id) return;
    merged.set(invoiceIdentity(invoice), invoice);
  });
  return Array.from(merged.values()).sort((a, b) => {
    const aDate = new Date(a.createdAt || a.updatedAt || a.issueDate || 0).getTime();
    const bDate = new Date(b.createdAt || b.updatedAt || b.issueDate || 0).getTime();
    return bDate - aDate;
  });
}

function mergeTemplatesByIdentity(primary: InvoiceTemplate[], secondary: InvoiceTemplate[]): InvoiceTemplate[] {
  const merged = new Map<string, InvoiceTemplate>();
  [...secondary, ...primary].forEach((template) => {
    if (!template) return;
    merged.set(templateIdentity(template), template);
  });
  return Array.from(merged.values()).sort((a, b) => {
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });
}

// ----------------------------------------------------------------------------
// Payload → row mapping
// ----------------------------------------------------------------------------

function buildLineItemsFromPayload(payload: InvoicePayload): InvoiceLineItem[] {
  if (Array.isArray(payload.lineItems) && payload.lineItems.length > 0) {
    return payload.lineItems.map((item, index) => ({
      id: normalizeString(item.id) || generateId(`line_${index}`),
      description: normalizeString(item.description),
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      amount: toNumber(item.amount, toNumber(item.quantity) * toNumber(item.unitPrice)),
    }));
  }

  const hours = toNumber(payload.hours);
  const rate = toNumber(payload.rate);
  const amount = toNumber(payload.amount, hours * rate);
  return [
    {
      id: generateId('line'),
      description: normalizeString(payload.lineItemTemplateDescription) || `Approved timesheet - ${normalizeString(payload.weekLabel) || 'invoice'}`,
      quantity: hours,
      unitPrice: rate,
      amount,
    },
  ];
}

interface NormalizedInvoiceBody {
  projectId: string;
  templateId: string | null;
  invoiceNumber: string;
  fromPartyId: string;
  toPartyId: string;
  fromPartyName: string;
  toPartyName: string;
  fromAddress: string;
  toAddress: string;
  taxRate: number;
  fromTaxId: string;
  toTaxId: string;
  fromIban: string;
  issueDate: string;
  dueDate: string;
  deliveryDate: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  status: InvoiceStatus;
  timesheetIds: string[];
  notes: string;
  en16931Xml: string;
  pdfUrl: string;
  paymentRef: string;
}

function buildInvoiceRequestBody(payload: InvoicePayload): NormalizedInvoiceBody {
  const issueDate = normalizeString(payload.issueDate ?? payload.date) || todayIso();
  let dueDate = normalizeString(payload.dueDate) || addDays(issueDate, 30);
  // DB constraint: due_date >= issue_date
  if (dueDate < issueDate) dueDate = addDays(issueDate, 30);

  const lineItems = buildLineItemsFromPayload(payload);
  const totals = deriveLineItemTotals(lineItems);
  const subtotal = Math.max(0, toNumber(payload.subtotal, totals.amount));
  const taxRate = Math.min(100, Math.max(0, toNumber(payload.taxRate, 0)));
  const taxTotal = Math.max(0, toNumber(payload.taxTotal, Math.round(subtotal * taxRate) / 100));
  const total = Math.max(0, toNumber(payload.total, subtotal + taxTotal));
  const projectId = normalizeString(payload.projectId);

  return {
    projectId,
    templateId: payload.templateId ?? null,
    invoiceNumber: normalizeString(payload.invoiceNumber ?? payload.number) || `INV-${Date.now()}`,
    fromPartyId: normalizeString(payload.fromPartyId) || projectId,
    toPartyId: normalizeString(payload.toPartyId) || projectId,
    fromPartyName: normalizeString(payload.fromPartyName),
    toPartyName: normalizeString(payload.toPartyName),
    fromAddress: normalizeString(payload.fromAddress),
    toAddress: normalizeString(payload.toAddress),
    taxRate,
    fromTaxId: normalizeString(payload.fromTaxId),
    toTaxId: normalizeString(payload.toTaxId),
    fromIban: normalizeString(payload.fromIban),
    issueDate,
    dueDate,
    deliveryDate: normalizeString(payload.deliveryDate),
    currency: normalizeString(payload.currency).toUpperCase() || 'EUR',
    lineItems,
    subtotal,
    taxTotal,
    total,
    status: normalizeStatus(payload.status),
    timesheetIds: Array.isArray(payload.timesheetIds)
      ? payload.timesheetIds.map((item) => normalizeString(item)).filter(Boolean)
      : [],
    notes: normalizeString(payload.notes),
    en16931Xml: normalizeString(payload.en16931Xml),
    pdfUrl: normalizeString(payload.pdfUrl),
    paymentRef: normalizeString(payload.paymentRef),
  };
}

function toInvoiceRow(body: NormalizedInvoiceBody, userId: string): Record<string, any> {
  return {
    project_id: body.projectId,
    // Only cloud template ids (tpl_...) satisfy the FK; locally generated
    // template ids never exist in wg_invoice_templates.
    template_id: body.templateId && body.templateId.startsWith('tpl_') ? body.templateId : null,
    invoice_number: body.invoiceNumber,
    from_party_id: body.fromPartyId,
    to_party_id: body.toPartyId,
    from_party_name: body.fromPartyName || null,
    to_party_name: body.toPartyName || null,
    from_address: body.fromAddress || null,
    to_address: body.toAddress || null,
    tax_rate: body.taxRate,
    from_tax_id: body.fromTaxId || null,
    to_tax_id: body.toTaxId || null,
    from_iban: body.fromIban || null,
    issue_date: body.issueDate,
    due_date: body.dueDate,
    delivery_date: body.deliveryDate || null,
    currency: body.currency,
    line_items: body.lineItems,
    subtotal: body.subtotal,
    tax_total: body.taxTotal,
    total: body.total,
    status: body.status,
    timesheet_ids: body.timesheetIds,
    en16931_xml: body.en16931Xml || null,
    pdf_url: body.pdfUrl || null,
    payment_ref: body.paymentRef || null,
    notes: body.notes || null,
    created_by: userId,
  };
}

function localFallbackInvoice(payload: InvoicePayload, syncState: 'local'): Invoice {
  const lineItems = buildLineItemsFromPayload(payload);
  const totals = deriveLineItemTotals(lineItems);
  const issueDate = normalizeString(payload.issueDate ?? payload.date) || todayIso();
  return normalizeInvoiceRecord({
    id: payload.id || generateId('inv_local'),
    projectId: payload.projectId,
    templateId: payload.templateId ?? null,
    invoiceNumber: normalizeString(payload.invoiceNumber ?? payload.number),
    fromPartyId: normalizeString(payload.fromPartyId),
    toPartyId: normalizeString(payload.toPartyId),
    fromPartyName: payload.fromPartyName ?? null,
    toPartyName: payload.toPartyName ?? null,
    fromAddress: payload.fromAddress ?? null,
    toAddress: payload.toAddress ?? null,
    taxRate: payload.taxRate ?? 0,
    fromTaxId: payload.fromTaxId ?? null,
    toTaxId: payload.toTaxId ?? null,
    fromIban: payload.fromIban ?? null,
    issueDate,
    dueDate: normalizeString(payload.dueDate) || addDays(issueDate, 30),
    deliveryDate: payload.deliveryDate ?? null,
    currency: normalizeString(payload.currency).toUpperCase() || 'EUR',
    lineItems,
    subtotal: toNumber(payload.subtotal, totals.amount),
    taxTotal: toNumber(payload.taxTotal, 0),
    total: toNumber(payload.total, totals.amount),
    status: normalizeStatus(payload.status),
    timesheetIds: Array.isArray(payload.timesheetIds)
      ? payload.timesheetIds.map((item) => normalizeString(item)).filter(Boolean)
      : [],
    notes: payload.notes ?? null,
    en16931Xml: payload.en16931Xml ?? null,
    pdfUrl: payload.pdfUrl ?? null,
    paymentRef: payload.paymentRef ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    projectName: payload.projectName,
    clientName: payload.clientName,
    personId: payload.personId,
    personName: payload.personName,
    weekStart: payload.weekStart,
    weekLabel: payload.weekLabel,
    hours: toNumber(payload.hours, totals.hours),
    rate: toNumber(payload.rate, totals.rate),
    amount: toNumber(payload.amount, totals.amount),
    lineItemTemplateDescription: payload.lineItemTemplateDescription,
    syncState,
  }, syncState);
}

function warnFallback(action: string, scope: string, reason: unknown): void {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.warn(`[invoices] ${action} falling back to localStorage for ${scope}: ${message}`);
}

function storeLocalInvoice(payload: InvoicePayload, projectId: string): Invoice {
  const localInvoice = localFallbackInvoice(payload, 'local');
  const nextInvoices = mergeInvoicesByIdentity([localInvoice], readLocalInvoices(projectId));
  writeLocalInvoices(projectId, nextInvoices);
  return localInvoice;
}

function cacheCloudInvoice(invoice: Invoice, projectId: string): void {
  const nextInvoices = mergeInvoicesByIdentity([invoice], readLocalInvoices(projectId));
  writeLocalInvoices(projectId, nextInvoices);
}

// ----------------------------------------------------------------------------
// Invoices CRUD (direct Supabase)
// ----------------------------------------------------------------------------

export async function createInvoice(invoice: InvoicePayload, _accessToken?: string | null): Promise<Invoice> {
  const projectId = normalizeString(invoice.projectId);
  if (!projectId) throw new Error('projectId is required');

  const userId = await getSessionUserId();
  if (!userId) {
    // Not signed in — RLS would reject the insert. Keep the draft locally.
    warnFallback('createInvoice', projectId, 'no authenticated session');
    return storeLocalInvoice(invoice, projectId);
  }

  const body = buildInvoiceRequestBody(invoice);
  let row = toInvoiceRow(body, userId);

  try {
    let { data, error } = await supabase.from('wg_invoices').insert(row).select().single();

    // FK violation on template_id → retry without the template link.
    if (error && error.code === '23503' && row.template_id) {
      row = { ...row, template_id: null };
      ({ data, error } = await supabase.from('wg_invoices').insert(row).select().single());
    }

    // Duplicate invoice number for this project → retry once with a suffix.
    if (error && error.code === '23505') {
      row = { ...row, invoice_number: `${row.invoice_number}-${Date.now() % 10000}` };
      ({ data, error } = await supabase.from('wg_invoices').insert(row).select().single());
    }

    if (error) {
      if (error.code === '42501') {
        throw new Error('You do not have permission to create invoices on this project (owner or accepted member required).');
      }
      throw new Error(error.message || 'Failed to create invoice');
    }

    const created = normalizeInvoiceRecord({
      ...invoice,
      ...(data as Record<string, any>),
      projectId,
    }, 'cloud');
    cacheCloudInvoice(created, projectId);
    return created;
  } catch (error) {
    if (isNetworkError(error)) {
      warnFallback('createInvoice', projectId, error);
      return storeLocalInvoice(invoice, projectId);
    }
    throw error;
  }
}

export async function listInvoices(projectId: string, _accessToken?: string | null): Promise<Invoice[]> {
  const scope = normalizeString(projectId);
  if (!scope) return [];

  const localInvoices = readLocalInvoices(scope);

  try {
    const { data, error } = await supabase
      .from('wg_invoices')
      .select('*')
      .eq('project_id', scope)
      .order('created_at', { ascending: false });

    if (error) {
      warnFallback('listInvoices', scope, error.message);
      return localInvoices;
    }

    const cloudInvoices = Array.isArray(data)
      ? data.map((rowData: any) => normalizeInvoiceRecord(rowData, 'cloud'))
      : [];
    const merged = mergeInvoicesByIdentity(cloudInvoices, localInvoices);
    writeLocalInvoices(scope, merged);
    return merged;
  } catch (error) {
    if (isNetworkError(error)) {
      warnFallback('listInvoices', scope, error);
      return localInvoices;
    }
    throw error;
  }
}

/**
 * Edit a draft invoice: parties, dates, line items (rate/hours), VAT %, payment
 * details, notes. Fetch-merge-recompute so totals always stay consistent with
 * the line items and tax rate actually stored.
 */
export async function updateInvoice(
  id: string,
  patch: Partial<InvoicePayload>,
  _accessToken?: string | null
): Promise<Invoice> {
  if (!id) throw new Error('Invoice id is required');

  const { data: existingRow, error: fetchError } = await supabase
    .from('wg_invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message || 'Failed to load invoice');
  if (!existingRow) throw new Error('Invoice not found in the cloud (local-only drafts cannot be edited yet).');

  const existing = normalizeInvoiceRecord(existingRow, 'cloud');

  const merged: InvoicePayload = {
    projectId: existing.projectId,
    templateId: patch.templateId !== undefined ? patch.templateId : existing.templateId,
    invoiceNumber: patch.invoiceNumber ?? patch.number ?? existing.invoiceNumber,
    issueDate: patch.issueDate ?? patch.date ?? existing.issueDate,
    dueDate: patch.dueDate ?? existing.dueDate,
    deliveryDate: patch.deliveryDate ?? existing.deliveryDate,
    currency: patch.currency ?? existing.currency,
    fromPartyId: existing.fromPartyId,
    toPartyId: existing.toPartyId,
    fromPartyName: patch.fromPartyName ?? existing.fromPartyName,
    toPartyName: patch.toPartyName ?? existing.toPartyName,
    fromAddress: patch.fromAddress ?? existing.fromAddress,
    toAddress: patch.toAddress ?? existing.toAddress,
    taxRate: patch.taxRate ?? existing.taxRate,
    fromTaxId: patch.fromTaxId ?? existing.fromTaxId,
    toTaxId: patch.toTaxId ?? existing.toTaxId,
    fromIban: patch.fromIban ?? existing.fromIban,
    lineItems: patch.lineItems ?? existing.lineItems,
    status: patch.status ?? existing.status,
    timesheetIds: existing.timesheetIds,
    paymentRef: patch.paymentRef ?? existing.paymentRef,
    notes: patch.notes ?? existing.notes ?? undefined,
    en16931Xml: existing.en16931Xml,
    pdfUrl: existing.pdfUrl,
  };

  const body = buildInvoiceRequestBody(merged);
  const row = toInvoiceRow(body, existing.createdBy || '');
  // Immutable on update: identity, ownership, project linkage.
  delete row.created_by;
  delete row.project_id;

  const { data, error } = await supabase
    .from('wg_invoices')
    .update(row)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '42501') {
      throw new Error('You do not have permission to edit this invoice.');
    }
    if (error.code === '23505') {
      throw new Error(`Invoice number "${body.invoiceNumber}" is already used in this project.`);
    }
    throw new Error(error.message || 'Failed to update invoice');
  }

  const updated = normalizeInvoiceRecord(data, 'cloud');
  cacheCloudInvoice(updated, updated.projectId);
  return updated;
}

function updateLocalInvoiceStatus(invoiceId: string, status: InvoiceStatus): Invoice {
  const projectId = findLocalInvoiceProjectId(invoiceId);
  if (!projectId) throw new Error('Invoice not found');

  const invoices = readLocalInvoices(projectId);
  const nextInvoices = invoices.map((invoice) => (
    invoice.id === invoiceId ? { ...invoice, status, updatedAt: new Date().toISOString(), syncState: 'local' as const } : invoice
  ));
  const nextInvoice = nextInvoices.find((invoice) => invoice.id === invoiceId);
  if (!nextInvoice) throw new Error('Invoice not found');
  writeLocalInvoices(projectId, nextInvoices);
  return nextInvoice;
}

function deleteLocalDraftInvoice(invoiceId: string): void {
  const projectId = findLocalInvoiceProjectId(invoiceId);
  if (!projectId) throw new Error('Invoice not found');

  const invoices = readLocalInvoices(projectId);
  const target = invoices.find((invoice) => invoice.id === invoiceId);
  if (!target) throw new Error('Invoice not found');
  if (normalizeStatus(target.status) !== 'draft') {
    throw new Error('Only draft invoices can be deleted. Use cancel/void for issued invoices.');
  }

  writeLocalInvoices(projectId, invoices.filter((invoice) => invoice.id !== invoiceId));
}

export async function deleteDraftInvoice(id: string, _accessToken?: string | null): Promise<void> {
  if (!id) throw new Error('Invoice id is required');

  try {
    const { data: existingRow, error: fetchError } = await supabase
      .from('wg_invoices')
      .select('id, project_id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      if (fetchError.code === '42501') {
        throw new Error('You do not have permission to delete this invoice.');
      }
      throw new Error(fetchError.message || 'Failed to load invoice');
    }

    if (!existingRow) {
      deleteLocalDraftInvoice(id);
      return;
    }

    if (normalizeStatus((existingRow as Record<string, any>).status) !== 'draft') {
      throw new Error('Only draft invoices can be deleted. Use cancel/void for issued invoices.');
    }

    const { error } = await supabase
      .from('wg_invoices')
      .delete()
      .eq('id', id)
      .eq('status', 'draft');

    if (error) {
      if (error.code === '42501') {
        throw new Error('You do not have permission to delete this invoice.');
      }
      throw new Error(error.message || 'Failed to delete draft invoice');
    }

    const projectId = normalizeString((existingRow as Record<string, any>).project_id) || findLocalInvoiceProjectId(id);
    if (projectId) {
      writeLocalInvoices(projectId, readLocalInvoices(projectId).filter((invoice) => invoice.id !== id));
    }
  } catch (error) {
    if (isNetworkError(error)) {
      warnFallback('deleteDraftInvoice', id, error);
      deleteLocalDraftInvoice(id);
      return;
    }
    throw error;
  }
}

export async function updateInvoiceStatus(id: string, status: string, _accessToken?: string | null): Promise<void> {
  const nextStatus = normalizeStatus(status);
  if (!id) throw new Error('Invoice id is required');

  try {
    // NOTE: .update().eq() silently succeeds on 0-row matches — always select
    // the updated rows and check the count (see CLAUDE.md "Things That Bite You").
    const { data, error } = await supabase
      .from('wg_invoices')
      .update({ status: nextStatus })
      .eq('id', id)
      .select('id, project_id, status, updated_at');

    if (error) {
      if (error.code === '42501') {
        throw new Error('You do not have permission to update this invoice.');
      }
      throw new Error(error.message || 'Failed to update invoice status');
    }

    const updatedRows = Array.isArray(data) ? data : [];
    if (updatedRows.length === 0) {
      // Not in the cloud (or not visible under RLS) — try the local cache
      // where offline-created drafts live.
      updateLocalInvoiceStatus(id, nextStatus);
      return;
    }

    const updated = updatedRows[0] as Record<string, any>;
    const targetProjectId = normalizeString(updated.project_id) || findLocalInvoiceProjectId(id);
    if (targetProjectId) {
      const invoices = readLocalInvoices(targetProjectId).map((invoice) => (
        invoice.id === id
          ? { ...invoice, status: nextStatus, updatedAt: normalizeString(updated.updated_at) || new Date().toISOString(), syncState: 'cloud' as const }
          : invoice
      ));
      writeLocalInvoices(targetProjectId, invoices);
    }
  } catch (error) {
    if (isNetworkError(error)) {
      warnFallback('updateInvoiceStatus', id, error);
      updateLocalInvoiceStatus(id, nextStatus);
      return;
    }
    throw error;
  }
}

// ----------------------------------------------------------------------------
// Templates (owner-scoped, wg_invoice_templates)
// ----------------------------------------------------------------------------

function templateToRow(template: InvoiceTemplate, ownerId: string): Record<string, any> {
  return {
    ...(template.id && template.id.startsWith('tpl_') ? { id: template.id } : {}),
    owner_id: ownerId,
    name: template.templateName,
    locale: template.locale || 'hr-HR',
    layout: {
      templateName: template.templateName,
      vendor: template.vendor,
      client: template.client,
      currency: template.currency,
      notes: template.notes,
      dueDateOffsetDays: template.dueDateOffsetDays,
      lineDefaults: template.lineDefaults,
      ...(template.layout || {}),
      billingDefaults: template.billingDefaults ?? template.layout?.billingDefaults ?? {},
    },
    field_map: template.fieldMap || {},
    ...(template.compliance && Object.keys(template.compliance).length > 0 ? { compliance: template.compliance } : {}),
    branding: template.branding ?? null,
    source_file: template.sourceFile ?? null,
    is_default: template.isDefault ?? false,
  };
}

export async function saveTemplate(template: InvoiceTemplate, _accessToken?: string | null): Promise<InvoiceTemplate> {
  const scope = normalizeString(template.projectId ?? template.ownerId);
  if (!scope) throw new Error('projectId or ownerId is required to save a template');

  const normalizedTemplate = normalizeTemplateRecord(template);
  const userId = await getSessionUserId();

  if (!userId) {
    const nextTemplates = mergeTemplatesByIdentity([normalizedTemplate], readLocalTemplates(scope));
    writeLocalTemplates(scope, nextTemplates);
    return normalizedTemplate;
  }

  try {
    const { data, error } = await supabase
      .from('wg_invoice_templates')
      .upsert(templateToRow(normalizedTemplate, userId), { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(error.message || 'Failed to save template');

    const saved = normalizeTemplateRecord({ ...normalizedTemplate, ...(data as Record<string, any>) });
    const nextTemplates = mergeTemplatesByIdentity([saved], readLocalTemplates(scope));
    writeLocalTemplates(scope, nextTemplates);
    return saved;
  } catch (error) {
    if (isNetworkError(error)) {
      warnFallback('saveTemplate', scope, error);
      const nextTemplates = mergeTemplatesByIdentity([normalizedTemplate], readLocalTemplates(scope));
      writeLocalTemplates(scope, nextTemplates);
      return normalizedTemplate;
    }
    throw error;
  }
}

export async function listTemplates(ownerId: string, _accessToken?: string | null): Promise<InvoiceTemplate[]> {
  const scope = normalizeString(ownerId);
  if (!scope) return [];

  const localTemplates = readLocalTemplates(scope);

  try {
    const userId = await getSessionUserId();
    if (!userId) return localTemplates;

    const { data, error } = await supabase
      .from('wg_invoice_templates')
      .select('*')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      warnFallback('listTemplates', scope, error.message);
      return localTemplates;
    }

    const cloudTemplates = Array.isArray(data)
      ? data.map((rowData: any) => normalizeTemplateRecord(rowData))
      : [];
    const merged = mergeTemplatesByIdentity(cloudTemplates, localTemplates);
    writeLocalTemplates(scope, merged);
    return merged;
  } catch (error) {
    if (isNetworkError(error)) {
      warnFallback('listTemplates', scope, error);
      return localTemplates;
    }
    throw error;
  }
}
