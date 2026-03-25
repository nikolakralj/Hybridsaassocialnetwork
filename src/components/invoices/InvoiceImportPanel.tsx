import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Plus, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type CurrencyCode = string;

type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
};

type ImportedInvoice = {
  id: string;
  sourceFileName: string;
  sourceFileType: string;
  uploadedAt: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  vendor: string;
  client: string;
  currency: CurrencyCode;
  lineItems: InvoiceLineItem[];
  total: string;
  notes: string;
  isTotalManuallyEdited: boolean;
  aiStatus: 'idle' | 'suggested' | 'manual_required';
  aiMessage: string;
  requiresManualReview: boolean;
  templateApplied: boolean;
};

type FileHints = {
  invoiceNumber?: string;
  issueDate?: string;
  currency?: CurrencyCode;
  total?: string;
};

export type ProjectInvoiceLineDefault = {
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
};

export type ProjectInvoiceTemplate = {
  templateName: string;
  vendor: string;
  client: string;
  currency: CurrencyCode;
  notes: string;
  dueDateOffsetDays: number;
  lineDefaults: ProjectInvoiceLineDefault[];
  updatedAt: string;
};

type InvoiceImportPanelProps = {
  projectId: string;
  defaultVendor: string;
  defaultClient: string;
  projectTemplate?: ProjectInvoiceTemplate | null;
  onTemplateSaved?: (template: ProjectInvoiceTemplate) => void;
};

function createId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayOffset(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 30;
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function parseAmount(value: string): number {
  const normalized = value.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tryParseAmount(value: string): number | null {
  const normalized = value.replace(/,/g, '.').replace(/[^0-9.-]/g, '');
  if (normalized.trim() === '' || normalized === '-' || normalized === '.') return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatAmount(value: number): string {
  return value.toFixed(2);
}

function fileNameWithoutExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '');
}

function parseIssueDate(fileName: string): string | undefined {
  const ymd = fileName.match(/\b(20\d{2})[-_.](0[1-9]|1[0-2])[-_.](0[1-9]|[12]\d|3[01])\b/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const dmy = fileName.match(/\b(0[1-9]|[12]\d|3[01])[-_.](0[1-9]|1[0-2])[-_.](20\d{2})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return undefined;
}

function parseInvoiceNumber(fileName: string): string | undefined {
  const explicit = fileName.match(/(?:invoice|inv)[\s\-_#]*(?:no|number|num)?[\s\-_#]*([a-z0-9-]{3,})/i);
  if (explicit?.[1]) return explicit[1].toUpperCase();
  const fallback = fileName.match(/\b([A-Z]{2,}-\d{2,}|[A-Z0-9]{6,})\b/i);
  if (fallback?.[1]) return fallback[1].toUpperCase();
  return undefined;
}

function parseCurrency(fileName: string): CurrencyCode | undefined {
  if (/\beur\b|\u20AC/i.test(fileName)) return 'EUR';
  if (/\bgbp\b|\u00A3/i.test(fileName)) return 'GBP';
  if (/\bcad\b|c\$/i.test(fileName)) return 'CAD';
  if (/\busd\b|\$/i.test(fileName)) return 'USD';
  return undefined;
}

function normalizeAmountToken(token: string): string {
  if (token.includes(',') && token.includes('.')) return token.replace(/,/g, '');
  if (token.includes(',')) return token.replace(',', '.');
  return token;
}

function parseTotal(fileName: string): string | undefined {
  const explicit = fileName.match(/(?:total|amount|amt)[\s\-_]*([\d.,]+)/i);
  if (!explicit?.[1]) return undefined;
  const parsed = parseAmount(normalizeAmountToken(explicit[1]));
  return parsed > 0 ? formatAmount(parsed) : undefined;
}

function deriveFileHints(fileName: string): FileHints {
  const cleanName = fileNameWithoutExtension(fileName);
  return {
    invoiceNumber: parseInvoiceNumber(cleanName),
    issueDate: parseIssueDate(cleanName),
    currency: parseCurrency(cleanName),
    total: parseTotal(cleanName),
  };
}

function lineItemsTotal(items: InvoiceLineItem[]): number {
  return items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
}

function normalizeLineItem(item: InvoiceLineItem, field: 'description' | 'quantity' | 'unitPrice' | 'amount'): InvoiceLineItem {
  if (field === 'description') return item;

  const quantity = tryParseAmount(item.quantity);
  const unitPrice = tryParseAmount(item.unitPrice);
  const amount = tryParseAmount(item.amount);

  if (field === 'amount') {
    if (amount !== null) {
      const safeQuantity = quantity && quantity !== 0 ? quantity : 1;
      return {
        ...item,
        quantity: safeQuantity.toString(),
        unitPrice: formatAmount(amount / safeQuantity),
        amount: formatAmount(amount),
      };
    }
    return item;
  }

  if (quantity !== null && unitPrice !== null) {
    return {
      ...item,
      amount: formatAmount(quantity * unitPrice),
    };
  }

  return item;
}

function ensureLineItem(line: Partial<ProjectInvoiceLineDefault> | null | undefined, fallbackDescription: string): InvoiceLineItem {
  const quantity = line?.quantity?.trim() || '1';
  const unitPrice = line?.unitPrice?.trim() || '0.00';
  const amount = line?.amount?.trim() || formatAmount(parseAmount(quantity) * parseAmount(unitPrice));
  const draftLine: InvoiceLineItem = {
    id: createId('line'),
    description: line?.description?.trim() || fallbackDescription,
    quantity,
    unitPrice,
    amount,
  };

  // Keep template-derived values internally consistent before rendering/editing.
  return line?.amount?.trim() ? normalizeLineItem(draftLine, 'amount') : normalizeLineItem(draftLine, 'unitPrice');
}

export function invoiceTemplateStorageKey(projectId: string): string {
  return `invoice-template:${projectId}`;
}

function writeProjectInvoiceTemplate(projectId: string, template: ProjectInvoiceTemplate): void {
  try {
    localStorage.setItem(invoiceTemplateStorageKey(projectId), JSON.stringify(template));
  } catch {
    // Keep UI responsive even if storage is unavailable.
  }
}

export function readProjectInvoiceTemplate(projectId: string): ProjectInvoiceTemplate | null {
  try {
    const raw = localStorage.getItem(invoiceTemplateStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ProjectInvoiceTemplate>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.vendor !== 'string' || typeof parsed.client !== 'string') return null;
    if (typeof parsed.currency !== 'string' || typeof parsed.notes !== 'string') return null;
    if (typeof parsed.dueDateOffsetDays !== 'number') return null;
    const lineDefaults = Array.isArray(parsed.lineDefaults) ? parsed.lineDefaults : [];
    const normalizedNotes = parsed.notes
      .replace(/Imported from .*?\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      templateName: typeof parsed.templateName === 'string' ? parsed.templateName : 'Project Invoice Template',
      vendor: parsed.vendor,
      client: parsed.client,
      currency: parsed.currency,
      notes: normalizedNotes,
      dueDateOffsetDays: parsed.dueDateOffsetDays,
      lineDefaults: lineDefaults.map(line => ({
        description: typeof line?.description === 'string' ? line.description : '',
        quantity: typeof line?.quantity === 'string' ? line.quantity : '1',
        unitPrice: typeof line?.unitPrice === 'string' ? line.unitPrice : '0.00',
        amount: typeof line?.amount === 'string' ? line.amount : '0.00',
      })),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : todayIso(),
    };
  } catch {
    return null;
  }
}

function applyTemplateToInvoice(invoice: ImportedInvoice, template: ProjectInvoiceTemplate, reason: 'upload' | 'manual'): ImportedInvoice {
  const lineItems = template.lineDefaults.length > 0
    ? template.lineDefaults.map(defaultLine => ensureLineItem(defaultLine, 'Template line item'))
    : invoice.lineItems;
  const issueDate = invoice.issueDate || todayIso();
  const total = lineItemsTotal(lineItems);

  return {
    ...invoice,
    vendor: template.vendor || invoice.vendor,
    client: template.client || invoice.client,
    currency: template.currency || invoice.currency,
    notes: template.notes || invoice.notes,
    dueDate: addDays(issueDate, template.dueDateOffsetDays),
    lineItems,
    total: invoice.isTotalManuallyEdited ? invoice.total : formatAmount(total),
    templateApplied: true,
    requiresManualReview: false,
    aiStatus: invoice.aiStatus === 'manual_required' ? 'idle' : invoice.aiStatus,
    aiMessage: reason === 'upload'
      ? 'Project template settings applied on upload (settings/format reuse, not visual PDF cloning).'
      : 'Project template settings applied (settings/format reuse, not visual PDF cloning).',
  };
}

function createImportedInvoice(
  file: File,
  defaults: Pick<InvoiceImportPanelProps, 'defaultVendor' | 'defaultClient'>,
  template: ProjectInvoiceTemplate | null,
): ImportedInvoice {
  const uploadedAt = todayIso();
  const hints = deriveFileHints(file.name);
  const fallbackInvoiceNumber = `IMP-${Date.now().toString().slice(-6)}`;
  const baseLineItem = ensureLineItem(
    {
      description: `Imported charge from ${file.name}`,
      quantity: '1',
      unitPrice: hints.total ?? '0.00',
      amount: hints.total ?? '0.00',
    },
    `Imported charge from ${file.name}`,
  );

  const baseInvoice: ImportedInvoice = {
    id: createId('import'),
    sourceFileName: file.name,
    sourceFileType: file.type || 'unknown',
    uploadedAt,
    invoiceNumber: hints.invoiceNumber ?? fallbackInvoiceNumber,
    issueDate: hints.issueDate ?? uploadedAt,
    dueDate: addDays(hints.issueDate ?? uploadedAt, 30),
    vendor: defaults.defaultVendor,
    client: defaults.defaultClient,
    currency: hints.currency ?? 'USD',
    lineItems: [baseLineItem],
    total: hints.total ?? baseLineItem.amount,
    notes: `Imported from ${file.name}.`,
    isTotalManuallyEdited: false,
    aiStatus: 'idle',
    aiMessage: 'Ready for editing. AI Adapt is optional.',
    requiresManualReview: false,
    templateApplied: false,
  };

  return template ? applyTemplateToInvoice(baseInvoice, template, 'upload') : baseInvoice;
}

function toTemplate(invoice: ImportedInvoice): ProjectInvoiceTemplate {
  const dueDateOffsetDays = dayOffset(invoice.issueDate, invoice.dueDate);
  const sanitizedNotes = invoice.notes
    .replace(/Imported from .*?\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    templateName: 'Project Invoice Template',
    vendor: invoice.vendor,
    client: invoice.client,
    currency: invoice.currency || 'USD',
    notes: sanitizedNotes,
    dueDateOffsetDays: Number.isFinite(dueDateOffsetDays) ? dueDateOffsetDays : 30,
    lineDefaults: invoice.lineItems.map(line => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: line.amount,
    })),
    updatedAt: todayIso(),
  };
}

export function InvoiceImportPanel({
  projectId,
  defaultVendor,
  defaultClient,
  projectTemplate,
  onTemplateSaved,
}: InvoiceImportPanelProps) {
  const [importedInvoices, setImportedInvoices] = useState<ImportedInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [localTemplate, setLocalTemplate] = useState<ProjectInvoiceTemplate | null>(() => readProjectInvoiceTemplate(projectId));

  useEffect(() => {
    setLocalTemplate(projectTemplate ?? readProjectInvoiceTemplate(projectId));
  }, [projectId, projectTemplate]);

  const activeTemplate = projectTemplate ?? localTemplate;

  const selectedInvoice = useMemo(() => {
    if (importedInvoices.length === 0) return null;
    if (selectedInvoiceId) {
      const byId = importedInvoices.find(inv => inv.id === selectedInvoiceId);
      if (byId) return byId;
    }
    return importedInvoices[0];
  }, [importedInvoices, selectedInvoiceId]);

  useEffect(() => {
    if (importedInvoices.length === 0) {
      if (selectedInvoiceId !== null) setSelectedInvoiceId(null);
      return;
    }

    if (!selectedInvoiceId || !importedInvoices.some(inv => inv.id === selectedInvoiceId)) {
      setSelectedInvoiceId(importedInvoices[0].id);
    }
  }, [importedInvoices, selectedInvoiceId]);

  const updateInvoice = (invoiceId: string, updater: (invoice: ImportedInvoice) => ImportedInvoice) => {
    setImportedInvoices(prev => prev.map(inv => (inv.id === invoiceId ? updater(inv) : inv)));
  };

  const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    const nextInvoices = files.map(file => createImportedInvoice(file, { defaultVendor, defaultClient }, activeTemplate ?? null));
    setImportedInvoices(prev => [...nextInvoices, ...prev]);
    setSelectedInvoiceId(nextInvoices[0]?.id ?? null);
    event.target.value = '';

    const templateMsg = activeTemplate ? ' Template settings were auto-applied.' : '';
    toast.success(`Imported ${nextInvoices.length} file${nextInvoices.length === 1 ? '' : 's'} for invoice review.${templateMsg}`);
  };

  const handleFieldChange = (
    invoiceId: string,
    field: 'invoiceNumber' | 'issueDate' | 'dueDate' | 'vendor' | 'client' | 'currency' | 'total' | 'notes',
    value: string,
  ) => {
    updateInvoice(invoiceId, invoice => {
      if (field === 'currency') {
        return {
          ...invoice,
          currency: value.toUpperCase().slice(0, 6) || 'USD',
          templateApplied: false,
        };
      }

      if (field === 'total') {
        return {
          ...invoice,
          total: value,
          isTotalManuallyEdited: true,
          templateApplied: false,
        };
      }

      return {
        ...invoice,
        [field]: value,
        templateApplied: false,
      };
    });
  };

  const handleLineItemChange = (
    invoiceId: string,
    lineItemId: string,
    field: 'description' | 'quantity' | 'unitPrice' | 'amount',
    value: string,
  ) => {
    updateInvoice(invoiceId, invoice => {
      const lineItems = invoice.lineItems.map(item => {
        if (item.id !== lineItemId) return item;
        const updated = { ...item, [field]: value };
        return normalizeLineItem(updated, field);
      });
      return {
        ...invoice,
        lineItems,
        total: invoice.isTotalManuallyEdited ? invoice.total : formatAmount(lineItemsTotal(lineItems)),
        templateApplied: false,
      };
    });
  };

  const addLineItem = (invoiceId: string) => {
    updateInvoice(invoiceId, invoice => {
      const lineItems = [...invoice.lineItems, ensureLineItem(null, '')];
      return {
        ...invoice,
        lineItems,
        total: invoice.isTotalManuallyEdited ? invoice.total : formatAmount(lineItemsTotal(lineItems)),
        templateApplied: false,
      };
    });
  };

  const removeLineItem = (invoiceId: string, lineItemId: string) => {
    updateInvoice(invoiceId, invoice => {
      const filtered = invoice.lineItems.filter(item => item.id !== lineItemId);
      const lineItems = filtered.length > 0 ? filtered : [ensureLineItem(null, '')];
      return {
        ...invoice,
        lineItems,
        total: invoice.isTotalManuallyEdited ? invoice.total : formatAmount(lineItemsTotal(lineItems)),
        templateApplied: false,
      };
    });
  };

  const useLineItemTotal = (invoiceId: string) => {
    updateInvoice(invoiceId, invoice => ({
      ...invoice,
      total: formatAmount(lineItemsTotal(invoice.lineItems)),
      isTotalManuallyEdited: false,
    }));
  };

  const runAiAdapt = (invoiceId: string) => {
    updateInvoice(invoiceId, invoice => {
      const hints = deriveFileHints(invoice.sourceFileName);
      const defaultIssueDate = invoice.uploadedAt;
      const defaultDueDate = addDays(defaultIssueDate, 30);
      let suggestionsApplied = 0;
      let nextInvoice = { ...invoice };

      if (hints.invoiceNumber && (invoice.invoiceNumber.trim() === '' || invoice.invoiceNumber.startsWith('IMP-'))) {
        nextInvoice.invoiceNumber = hints.invoiceNumber;
        suggestionsApplied += 1;
      }

      if (hints.issueDate && invoice.issueDate === defaultIssueDate) {
        nextInvoice.issueDate = hints.issueDate;
        if (invoice.dueDate === defaultDueDate) nextInvoice.dueDate = addDays(hints.issueDate, 30);
        suggestionsApplied += 1;
      }

      if (hints.currency && invoice.currency === 'USD') {
        nextInvoice.currency = hints.currency;
        suggestionsApplied += 1;
      }

      if (hints.total && !invoice.isTotalManuallyEdited && parseAmount(invoice.total) === 0) {
        nextInvoice.total = hints.total;
        if (invoice.lineItems.length > 0) {
          const [first, ...rest] = invoice.lineItems;
          const amount = hints.total;
          nextInvoice.lineItems = [{ ...first, quantity: '1', unitPrice: amount, amount }, ...rest];
        }
        suggestionsApplied += 1;
      }

      nextInvoice.requiresManualReview = suggestionsApplied === 0;
      nextInvoice.aiStatus = suggestionsApplied > 0 ? 'suggested' : 'manual_required';
      nextInvoice.aiMessage = suggestionsApplied > 0
        ? `AI Adapt updated ${suggestionsApplied} field${suggestionsApplied === 1 ? '' : 's'}.`
        : 'AI Adapt could not infer confident values from this file. Manual review required.';
      nextInvoice.templateApplied = false;
      return nextInvoice;
    });

    toast.info('AI Adapt completed.');
  };

  const removeImportedInvoice = (invoiceId: string) => {
    setImportedInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
  };

  const saveSelectedAsTemplate = () => {
    if (!selectedInvoice) return;
    const template = toTemplate(selectedInvoice);
    writeProjectInvoiceTemplate(projectId, template);
    setLocalTemplate(template);
    onTemplateSaved?.(template);
    toast.success('Project template saved. Future imports and drafts can reuse these settings.');
  };

  const applyTemplateToSelected = () => {
    if (!selectedInvoice || !activeTemplate) {
      toast.info('Save a project template first, then apply it.');
      return;
    }

    updateInvoice(selectedInvoice.id, invoice => applyTemplateToInvoice(invoice, activeTemplate, 'manual'));
    toast.success('Project template applied to this imported invoice.');
  };

  const templateBadgeText = activeTemplate ? 'Template saved' : 'No template yet';

  return (
    <Card className="border-slate-200/60 shadow-sm">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Invoice Import + Template Reuse</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Upload invoice files, edit fields, and reuse project template settings. This reuses invoice format/settings,
              not exact OCR or visual PDF cloning.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={activeTemplate ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}>
              {templateBadgeText}
            </Badge>
            <Badge variant="outline" className="w-fit border-indigo-200 bg-indigo-50 text-indigo-700">
              {importedInvoices.length} imported
            </Badge>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <Label htmlFor="invoice-file-upload" className="mb-2 text-xs uppercase tracking-wide text-slate-500">
            Upload files (PDF, DOC, DOCX, images, or any format)
          </Label>
          <div className="flex items-center gap-3">
            <Upload className="h-4 w-4 text-slate-500" />
            <Input
              id="invoice-file-upload"
              type="file"
              multiple
              accept="*/*,.pdf,.doc,.docx,image/*"
              onChange={handleUploadChange}
              className="h-10 cursor-pointer bg-white"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {importedInvoices.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-600">
              No files imported yet. Upload an invoice to start editing and optionally save template settings for this project.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imported Documents</p>
              </div>
              <div className="max-h-[650px] space-y-2 overflow-y-auto p-3">
                {importedInvoices.map(invoice => {
                  let badgeLabel = 'Ready';
                  let badgeClass = 'border-slate-200 text-slate-600';
                  if (invoice.requiresManualReview) {
                    badgeLabel = 'Needs Review';
                    badgeClass = 'border-amber-200 bg-amber-50 text-amber-700';
                  } else if (invoice.templateApplied) {
                    badgeLabel = 'Template Applied';
                    badgeClass = 'border-emerald-200 bg-emerald-50 text-emerald-700';
                  } else if (invoice.aiStatus === 'suggested') {
                    badgeLabel = 'AI Adapted';
                    badgeClass = 'border-indigo-200 bg-indigo-50 text-indigo-700';
                  }

                  return (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => setSelectedInvoiceId(invoice.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                        selectedInvoice?.id === invoice.id
                          ? 'border-indigo-200 bg-indigo-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{invoice.sourceFileName}</p>
                          <p className="text-xs text-slate-500">{invoice.invoiceNumber}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-rose-600"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeImportedInvoice(invoice.id);
                          }}
                          aria-label={`Remove ${invoice.sourceFileName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className={badgeClass}>
                          {badgeLabel}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedInvoice && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{selectedInvoice.sourceFileName}</h4>
                    <p className="text-xs text-slate-500">
                      Type: {selectedInvoice.sourceFileType} | Uploaded: {selectedInvoice.uploadedAt}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-slate-200 text-slate-700 hover:bg-slate-50"
                      onClick={saveSelectedAsTemplate}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save as Template
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!activeTemplate}
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={applyTemplateToSelected}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Apply Project Template
                    </Button>
                    <Button
                      variant="outline"
                      className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      onClick={() => runAiAdapt(selectedInvoice.id)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      AI Adapt
                    </Button>
                  </div>
                </div>

                {selectedInvoice.requiresManualReview ? (
                  <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Manual review required</AlertTitle>
                    <AlertDescription>{selectedInvoice.aiMessage}</AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="mb-4 border-slate-200 bg-slate-50 text-slate-800">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Editing mode</AlertTitle>
                    <AlertDescription>{selectedInvoice.aiMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`invoice-number-${selectedInvoice.id}`}>Invoice Number</Label>
                    <Input
                      id={`invoice-number-${selectedInvoice.id}`}
                      value={selectedInvoice.invoiceNumber}
                      onChange={event => handleFieldChange(selectedInvoice.id, 'invoiceNumber', event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`currency-${selectedInvoice.id}`}>Currency</Label>
                    <Input
                      id={`currency-${selectedInvoice.id}`}
                      value={selectedInvoice.currency}
                      onChange={event => handleFieldChange(selectedInvoice.id, 'currency', event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`issue-date-${selectedInvoice.id}`}>Issue Date</Label>
                    <Input
                      id={`issue-date-${selectedInvoice.id}`}
                      type="date"
                      value={selectedInvoice.issueDate}
                      onChange={event => handleFieldChange(selectedInvoice.id, 'issueDate', event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`due-date-${selectedInvoice.id}`}>Due Date</Label>
                    <Input
                      id={`due-date-${selectedInvoice.id}`}
                      type="date"
                      value={selectedInvoice.dueDate}
                      onChange={event => handleFieldChange(selectedInvoice.id, 'dueDate', event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`vendor-${selectedInvoice.id}`}>Vendor</Label>
                    <Input
                      id={`vendor-${selectedInvoice.id}`}
                      value={selectedInvoice.vendor}
                      onChange={event => handleFieldChange(selectedInvoice.id, 'vendor', event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`client-${selectedInvoice.id}`}>Client</Label>
                    <Input
                      id={`client-${selectedInvoice.id}`}
                      value={selectedInvoice.client}
                      onChange={event => handleFieldChange(selectedInvoice.id, 'client', event.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                    <h5 className="text-sm font-semibold text-slate-800">Line Items</h5>
                    <Button variant="ghost" size="sm" onClick={() => addLineItem(selectedInvoice.id)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Add item
                    </Button>
                  </div>
                  <div className="space-y-3 p-3">
                    {selectedInvoice.lineItems.map(item => (
                      <div key={item.id} className="rounded-md border border-slate-200 p-3">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                          <div className="md:col-span-5">
                            <Label htmlFor={`desc-${item.id}`}>Description</Label>
                            <Input
                              id={`desc-${item.id}`}
                              value={item.description}
                              onChange={event => handleLineItemChange(selectedInvoice.id, item.id, 'description', event.target.value)}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label htmlFor={`qty-${item.id}`}>Qty</Label>
                            <Input
                              id={`qty-${item.id}`}
                              inputMode="decimal"
                              value={item.quantity}
                              onChange={event => handleLineItemChange(selectedInvoice.id, item.id, 'quantity', event.target.value)}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label htmlFor={`unit-price-${item.id}`}>Unit Price</Label>
                            <Input
                              id={`unit-price-${item.id}`}
                              inputMode="decimal"
                              value={item.unitPrice}
                              onChange={event => handleLineItemChange(selectedInvoice.id, item.id, 'unitPrice', event.target.value)}
                            />
                          </div>
                          <div className="md:col-span-3">
                            <Label htmlFor={`amount-${item.id}`}>Amount</Label>
                            <Input
                              id={`amount-${item.id}`}
                              inputMode="decimal"
                              value={item.amount}
                              onChange={event => handleLineItemChange(selectedInvoice.id, item.id, 'amount', event.target.value)}
                            />
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-500 hover:text-rose-600"
                            onClick={() => removeLineItem(selectedInvoice.id, item.id)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-1">
                    <Label htmlFor={`total-${selectedInvoice.id}`}>Total</Label>
                    <Input
                      id={`total-${selectedInvoice.id}`}
                      inputMode="decimal"
                      value={selectedInvoice.total}
                      onChange={event => handleFieldChange(selectedInvoice.id, 'total', event.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={() => useLineItemTotal(selectedInvoice.id)}>
                    Use line-item sum ({lineItemsTotal(selectedInvoice.lineItems).toFixed(2)})
                  </Button>
                </div>

                <div className="mt-4 space-y-1">
                  <Label htmlFor={`notes-${selectedInvoice.id}`}>Notes</Label>
                  <Textarea
                    id={`notes-${selectedInvoice.id}`}
                    value={selectedInvoice.notes}
                    onChange={event => handleFieldChange(selectedInvoice.id, 'notes', event.target.value)}
                    className="min-h-24"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
