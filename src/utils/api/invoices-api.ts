import { projectId as supabaseProjectId, publicAnonKey } from '../supabase/info';

const BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-f8b491be`;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCAL_INVOICES_KEY = (projectId: string) => `workgraph-invoices-${projectId}`;
const LOCAL_INVOICE_INDEX_KEY = 'workgraph-invoice-index-v1';
const LOCAL_TEMPLATES_KEY = (scope: string) => `workgraph-invoice-templates-${scope}`;

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partially_paid' | 'overdue';

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

function isUuid(value?: string | null): value is string {
  return Boolean(value && UUID_REGEX.test(value));
}

export function isUuidProjectId(value?: string | null): value is string {
  return isUuid(value);
}

function getHeaders(accessToken?: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken || publicAnonKey}`,
  };
}

function normalizeStatus(value: unknown): InvoiceStatus {
  const status = normalizeString(value).toLowerCase();
  if (status === 'issued' || status === 'paid' || status === 'partially_paid' || status === 'overdue') {
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

  return {
    id: normalizeString(row?.id) || generateId('template'),
    ownerId: row?.ownerId ?? row?.owner_id ?? undefined,
    projectId: row?.projectId ?? row?.project_id ?? undefined,
    templateName,
    vendor: normalizeString(row?.vendor ?? layout?.vendor ?? branding?.vendor),
    client: normalizeString(row?.client ?? layout?.client ?? branding?.client),
    currency,
    notes: normalizeString(row?.notes ?? layout?.notes ?? branding?.notes),
    dueDateOffsetDays: toNumber(row?.dueDateOffsetDays ?? layout?.dueDateOffsetDays ?? branding?.dueDateOffsetDays, 30),
    lineDefaults: normalizeTemplateLineDefaults(row?.lineDefaults ?? layout?.lineDefaults ?? branding?.lineDefaults),
    updatedAt: normalizeString(row?.updatedAt ?? row?.updated_at) || todayIso(),
    name: row?.name ?? undefined,
    locale: row?.locale ?? undefined,
    layout: row?.layout ?? layout,
    fieldMap: row?.fieldMap ?? row?.field_map ?? {},
    compliance: row?.compliance ?? {},
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

function buildInvoiceRequestBody(payload: InvoicePayload): Record<string, any> {
  const issueDate = normalizeString(payload.issueDate ?? payload.date) || todayIso();
  const lineItems = buildLineItemsFromPayload(payload);
  const totals = deriveLineItemTotals(lineItems);
  const subtotal = toNumber(payload.subtotal, totals.amount);
  const taxTotal = toNumber(payload.taxTotal, 0);
  const total = toNumber(payload.total, subtotal + taxTotal);

  return {
    projectId: normalizeString(payload.projectId),
    templateId: payload.templateId ?? null,
    invoiceNumber: normalizeString(payload.invoiceNumber ?? payload.number),
    fromPartyId: normalizeString(payload.fromPartyId),
    toPartyId: normalizeString(payload.toPartyId),
    fromTaxId: normalizeString(payload.fromTaxId),
    toTaxId: normalizeString(payload.toTaxId),
    fromIban: normalizeString(payload.fromIban),
    issueDate,
    dueDate: normalizeString(payload.dueDate) || addDays(issueDate, 30),
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

function canFallback(status?: number): boolean {
  return status === undefined || status === 404 || status === 429 || status >= 500;
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

export async function createInvoice(invoice: InvoicePayload, accessToken?: string | null): Promise<Invoice> {
  const projectId = normalizeString(invoice.projectId);
  if (!projectId) throw new Error('projectId is required');

  if (!isUuid(projectId)) {
    const localInvoice = localFallbackInvoice(invoice, 'local');
    const nextInvoices = mergeInvoicesByIdentity([localInvoice], readLocalInvoices(projectId));
    writeLocalInvoices(projectId, nextInvoices);
    return localInvoice;
  }

  const requestBody = buildInvoiceRequestBody(invoice);

  try {
    const res = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify(requestBody),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (canFallback(res.status)) {
        warnFallback('createInvoice', projectId, data?.error || res.status);
        const localInvoice = localFallbackInvoice(invoice, 'local');
        const nextInvoices = mergeInvoicesByIdentity([localInvoice], readLocalInvoices(projectId));
        writeLocalInvoices(projectId, nextInvoices);
        return localInvoice;
      }
      throw new Error(data?.error || 'Failed to create invoice');
    }

    const created = normalizeInvoiceRecord({
      ...invoice,
      ...data.invoice,
      projectId,
      syncState: 'cloud',
    }, 'cloud');
    const nextInvoices = mergeInvoicesByIdentity([created], readLocalInvoices(projectId));
    writeLocalInvoices(projectId, nextInvoices);
    return created;
  } catch (error) {
    if (error instanceof Error && /Failed to fetch/i.test(error.message)) {
      warnFallback('createInvoice', projectId, error);
      const localInvoice = localFallbackInvoice(invoice, 'local');
      const nextInvoices = mergeInvoicesByIdentity([localInvoice], readLocalInvoices(projectId));
      writeLocalInvoices(projectId, nextInvoices);
      return localInvoice;
    }
    throw error;
  }
}

export async function listInvoices(projectId: string, accessToken?: string | null): Promise<Invoice[]> {
  const scope = normalizeString(projectId);
  if (!scope) return [];

  if (!isUuid(scope)) {
    return readLocalInvoices(scope);
  }

  const localInvoices = readLocalInvoices(scope);

  try {
    const res = await fetch(`${BASE}/invoices?project_id=${encodeURIComponent(scope)}`, {
      headers: getHeaders(accessToken),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (canFallback(res.status)) {
        warnFallback('listInvoices', scope, data?.error || res.status);
        return localInvoices;
      }
      throw new Error(data?.error || 'Failed to list invoices');
    }

    const apiInvoices = Array.isArray(data.invoices)
      ? data.invoices.map((row: any) => normalizeInvoiceRecord({ ...row, syncState: 'cloud' }, 'cloud'))
      : [];
    const merged = mergeInvoicesByIdentity(apiInvoices, localInvoices);
    writeLocalInvoices(scope, merged);
    return merged;
  } catch (error) {
    if (error instanceof Error && /Failed to fetch/i.test(error.message)) {
      warnFallback('listInvoices', scope, error);
      return localInvoices;
    }
    throw error;
  }
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

export async function updateInvoiceStatus(id: string, status: string, accessToken?: string | null): Promise<void> {
  const nextStatus = normalizeStatus(status);
  if (!id) throw new Error('Invoice id is required');

  const projectId = findLocalInvoiceProjectId(id);

  if (projectId && !isUuid(projectId)) {
    updateLocalInvoiceStatus(id, nextStatus);
    return;
  }

  try {
    const res = await fetch(`${BASE}/invoices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: getHeaders(accessToken),
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (canFallback(res.status) && projectId) {
        warnFallback('updateInvoiceStatus', projectId, data?.error || res.status);
        updateLocalInvoiceStatus(id, nextStatus);
        return;
      }
      throw new Error(data?.error || 'Failed to update invoice status');
    }

    const updated = normalizeInvoiceRecord({ ...data.invoice, syncState: 'cloud' }, 'cloud');
    const targetProjectId = updated.projectId || projectId;
    if (targetProjectId) {
      const invoices = readLocalInvoices(targetProjectId);
      const nextInvoices = mergeInvoicesByIdentity([updated], invoices);
      writeLocalInvoices(targetProjectId, nextInvoices);
    }
  } catch (error) {
    if (error instanceof Error && /Failed to fetch/i.test(error.message) && projectId) {
      warnFallback('updateInvoiceStatus', projectId, error);
      updateLocalInvoiceStatus(id, nextStatus);
      return;
    }
    throw error;
  }
}

export async function saveTemplate(template: InvoiceTemplate, accessToken?: string | null): Promise<InvoiceTemplate> {
  const scope = normalizeString(template.projectId ?? template.ownerId);
  if (!scope) throw new Error('projectId or ownerId is required to save a template');

  const normalizedTemplate = normalizeTemplateRecord(template);

  if (!isUuid(scope)) {
    const nextTemplates = mergeTemplatesByIdentity([normalizedTemplate], readLocalTemplates(scope));
    writeLocalTemplates(scope, nextTemplates);
    return normalizedTemplate;
  }

  try {
    const res = await fetch(`${BASE}/invoice-templates`, {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify({
        projectId: scope,
        template: {
          templateName: normalizedTemplate.templateName,
          vendor: normalizedTemplate.vendor,
          client: normalizedTemplate.client,
          currency: normalizedTemplate.currency,
          notes: normalizedTemplate.notes,
          dueDateOffsetDays: normalizedTemplate.dueDateOffsetDays,
          lineDefaults: normalizedTemplate.lineDefaults,
        },
        isDefault: normalizedTemplate.isDefault ?? false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (canFallback(res.status)) {
        warnFallback('saveTemplate', scope, data?.error || res.status);
        const nextTemplates = mergeTemplatesByIdentity([normalizedTemplate], readLocalTemplates(scope));
        writeLocalTemplates(scope, nextTemplates);
        return normalizedTemplate;
      }
      throw new Error(data?.error || 'Failed to save template');
    }

    const saved = normalizeTemplateRecord({
      ...normalizedTemplate,
      ...data.template,
      projectId: scope,
      syncState: 'cloud',
    });
    const nextTemplates = mergeTemplatesByIdentity([saved], readLocalTemplates(scope));
    writeLocalTemplates(scope, nextTemplates);
    return saved;
  } catch (error) {
    if (error instanceof Error && /Failed to fetch/i.test(error.message)) {
      warnFallback('saveTemplate', scope, error);
      const nextTemplates = mergeTemplatesByIdentity([normalizedTemplate], readLocalTemplates(scope));
      writeLocalTemplates(scope, nextTemplates);
      return normalizedTemplate;
    }
    throw error;
  }
}

export async function listTemplates(ownerId: string, accessToken?: string | null): Promise<InvoiceTemplate[]> {
  const scope = normalizeString(ownerId);
  if (!scope) return [];

  if (!isUuid(scope)) {
    return readLocalTemplates(scope);
  }

  const localTemplates = readLocalTemplates(scope);

  try {
    const res = await fetch(`${BASE}/invoice-templates?owner_id=${encodeURIComponent(scope)}`, {
      headers: getHeaders(accessToken),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (canFallback(res.status)) {
        warnFallback('listTemplates', scope, data?.error || res.status);
        return localTemplates;
      }
      throw new Error(data?.error || 'Failed to list templates');
    }

    const apiTemplates = Array.isArray(data.templates)
      ? data.templates.map((row: any) => normalizeTemplateRecord({ ...row, syncState: 'cloud' }))
      : [];
    const merged = mergeTemplatesByIdentity(apiTemplates, localTemplates);
    writeLocalTemplates(scope, merged);
    return merged;
  } catch (error) {
    if (error instanceof Error && /Failed to fetch/i.test(error.message)) {
      warnFallback('listTemplates', scope, error);
      return localTemplates;
    }
    throw error;
  }
}
