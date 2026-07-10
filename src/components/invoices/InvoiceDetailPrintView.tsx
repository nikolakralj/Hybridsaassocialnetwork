import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, FileCheck2, Loader2, Pencil, Printer, Save, Send, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { InvoiceDraft } from './InvoicesWorkspace';
import type { InvoiceLineItem, InvoicePayload, InvoiceTemplate } from '../../utils/api/invoices-api';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  }
}

function toNumber(value: string | number | undefined | null, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

interface EditableLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface InvoiceForm {
  number: string;
  date: string;
  dueDate: string;
  fromName: string;
  fromAddress: string;
  fromTaxId: string;
  fromIban: string;
  toName: string;
  toAddress: string;
  toTaxId: string;
  lines: EditableLine[];
  taxRate: string;
  paymentRef: string;
  notes: string;
}

function baseLines(invoice: InvoiceDraft): InvoiceLineItem[] {
  if (Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) return invoice.lineItems;
  return [
    {
      id: `line_${invoice.id}`,
      description:
        invoice.lineItemTemplateDescription?.trim()
        || `Approved timesheet - ${invoice.weekLabel} (${invoice.personName})`,
      quantity: invoice.hours,
      unitPrice: invoice.rate,
      amount: invoice.amount,
    },
  ];
}

function buildForm(invoice: InvoiceDraft): InvoiceForm {
  return {
    number: invoice.number || '',
    date: invoice.date || '',
    dueDate: invoice.dueDate || '',
    fromName: invoice.fromPartyName || invoice.projectName || '',
    fromAddress: invoice.fromAddress || '',
    fromTaxId: invoice.fromTaxId || '',
    fromIban: invoice.fromIban || '',
    toName: invoice.toPartyName || invoice.clientName || '',
    toAddress: invoice.toAddress || '',
    toTaxId: invoice.toTaxId || '',
    lines: baseLines(invoice).map((line) => ({
      id: line.id,
      description: line.description,
      quantity: String(line.quantity ?? 0),
      unitPrice: String(line.unitPrice ?? 0),
    })),
    taxRate: String(invoice.taxRate ?? 0),
    paymentRef: invoice.paymentRef || '',
    notes: invoice.notes || '',
  };
}

export function InvoiceDetailPrintView({
  invoice,
  onBack,
  onSave,
  templates = [],
  onApplyTemplate,
  onSaveTemplate,
  templateBusy = false,
}: {
  invoice: InvoiceDraft;
  onBack: () => void;
  onSave?: (patch: Partial<InvoicePayload>) => Promise<void>;
  templates?: InvoiceTemplate[];
  onApplyTemplate?: (templateId: string) => Promise<void>;
  onSaveTemplate?: (templateName: string) => Promise<void>;
  templateBusy?: boolean;
}) {
  const currency = invoice.currency || 'EUR';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<InvoiceForm>(() => buildForm(invoice));
  const [templateSelectValue, setTemplateSelectValue] = useState('template-picker');
  const [templateName, setTemplateName] = useState(`${invoice.fromPartyName || invoice.projectName || 'Company'} invoice`);

  const canEdit = Boolean(onSave) && (invoice.apiStatus || invoice.status) === 'draft';
  const canUseTemplates = canEdit && !editing;

  const displayLines = baseLines(invoice);
  const subtotal = displayLines.reduce((acc, item) => acc + toNumber(item.amount), 0);
  const taxRate = invoice.taxRate ?? 0;
  const tax = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + tax;

  const editSubtotal = useMemo(
    () => form.lines.reduce((acc, line) => acc + toNumber(line.quantity) * toNumber(line.unitPrice), 0),
    [form.lines],
  );
  const editTaxRate = Math.min(100, Math.max(0, toNumber(form.taxRate)));
  const editTax = Math.round(editSubtotal * editTaxRate) / 100;
  const editTotal = editSubtotal + editTax;

  const setField = (field: keyof InvoiceForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setLine = (index: number, field: keyof EditableLine, value: string) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    }));
  };

  const startEdit = () => {
    setForm(buildForm(invoice));
    setEditing(true);
  };

  const handleApplyTemplate = async (templateId: string) => {
    if (templateId === 'template-picker') return;
    if (!onApplyTemplate) return;
    setTemplateSelectValue(templateId);
    try {
      await onApplyTemplate(templateId);
    } finally {
      setTemplateSelectValue('template-picker');
    }
  };

  const handleSaveTemplate = async () => {
    if (!onSaveTemplate) return;
    const name = templateName.trim() || `${invoice.fromPartyName || invoice.projectName || 'Company'} invoice`;
    await onSaveTemplate(name);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({
        invoiceNumber: form.number.trim(),
        issueDate: form.date.trim(),
        dueDate: form.dueDate.trim(),
        fromPartyName: form.fromName.trim(),
        fromAddress: form.fromAddress.trim(),
        fromTaxId: form.fromTaxId.trim(),
        fromIban: form.fromIban.trim(),
        toPartyName: form.toName.trim(),
        toAddress: form.toAddress.trim(),
        toTaxId: form.toTaxId.trim(),
        lineItems: form.lines.map((line) => ({
          id: line.id,
          description: line.description.trim(),
          quantity: toNumber(line.quantity),
          unitPrice: toNumber(line.unitPrice),
          amount: Math.round(toNumber(line.quantity) * toNumber(line.unitPrice) * 100) / 100,
        })),
        taxRate: editTaxRate,
        subtotal: undefined,
        taxTotal: undefined,
        total: undefined,
        paymentRef: form.paymentRef.trim(),
        notes: form.notes.trim(),
      });
      setEditing(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the invoice.';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const StatusBadge = ({ status }: { status: InvoiceDraft['status'] }) => {
    switch (status) {
      case 'paid':
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-none px-3 py-1 text-sm"><CheckCircle2 className="w-4 h-4 mr-1.5" /> PAID</Badge>;
      case 'sent':
        return <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 border-none px-3 py-1 text-sm">AWAITING PAYMENT</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border-none px-3 py-1 text-sm">OVERDUE</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-500 border-slate-200 px-3 py-1 text-sm">DRAFT</Badge>;
    }
  };

  const PartyBlock = ({
    label,
    name,
    address,
    taxId,
    iban,
    extra,
  }: {
    label: string;
    name: string;
    address?: string | null;
    taxId?: string | null;
    iban?: string | null;
    extra?: React.ReactNode;
  }) => (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{label}</h3>
      <p className="font-semibold text-slate-900 text-lg">{name || '—'}</p>
      <div className="text-slate-600 text-sm leading-relaxed space-y-1">
        {address?.trim() ? <p className="whitespace-pre-line">{address.trim()}</p> : null}
        {taxId?.trim() ? <p><span className="text-slate-400">Tax ID / OIB:</span> {taxId.trim()}</p> : null}
        {iban?.trim() ? <p><span className="text-slate-400">IBAN:</span> {iban.trim()}</p> : null}
        {extra}
      </div>
    </div>
  );

  const fieldLabel = 'text-[11px] font-medium uppercase tracking-wide text-slate-400';

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden mb-6">
        <Button variant="ghost" onClick={onBack} className="text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Invoices
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void handleSave()} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Save changes
              </Button>
            </>
          ) : (
            <>
              {canUseTemplates && (
                <>
                  <Select
                    value={templateSelectValue}
                    onValueChange={(value) => void handleApplyTemplate(value)}
                    disabled={!onApplyTemplate || templates.length === 0 || templateBusy}
                  >
                    <SelectTrigger className="w-[190px] bg-white">
                      <FileCheck2 className="mr-2 h-4 w-4 text-slate-500" />
                      <SelectValue placeholder="Apply template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="template-picker" disabled>Apply template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id || template.templateName} value={template.id || template.templateName}>
                          {template.templateName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    className="h-9 w-[180px] bg-white"
                    placeholder="Template name"
                    disabled={!onSaveTemplate || templateBusy}
                  />
                  <Button variant="outline" onClick={() => void handleSaveTemplate()} disabled={!onSaveTemplate || templateBusy}>
                    {templateBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save template
                  </Button>
                </>
              )}
              {canEdit && (
                <Button variant="outline" onClick={startEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
              {invoice.status === 'draft' && (
                <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700">
                  <Send className="w-4 h-4 mr-2" />
                  Send to Client
                </Button>
              )}
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              {/* Until P4-3 ships a real PDF generator, route through the browser's
                  print dialog — "Save as PDF" produces the identical document. */}
              <Button variant="outline" onClick={() => window.print()}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto bg-white border border-slate-200/60 shadow-md rounded-xl p-12 print:shadow-none print:border-none print:p-0">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 uppercase">INVOICE</h1>
              {editing ? (
                <div className="mt-3 w-64">
                  <p className={fieldLabel}>Invoice number</p>
                  <Input value={form.number} onChange={(e) => setField('number', e.target.value)} className="mt-1 h-9 font-mono" />
                </div>
              ) : (
                <p className="text-slate-500 mt-2 font-mono text-lg">{invoice.number}</p>
              )}
            </div>
            <div className="text-right flex flex-col items-end">
              <StatusBadge status={invoice.status} />
              {editing ? (
                <div className="mt-4 space-y-2 text-left">
                  <div>
                    <p className={fieldLabel}>Date issued</p>
                    <Input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} className="mt-1 h-9 w-44" />
                  </div>
                  <div>
                    <p className={fieldLabel}>Due date</p>
                    <Input type="date" value={form.dueDate} onChange={(e) => setField('dueDate', e.target.value)} className="mt-1 h-9 w-44" />
                  </div>
                </div>
              ) : (
                <div className="mt-6 text-slate-500 text-sm space-y-1 text-right">
                  <p><span className="font-semibold text-slate-700">Date Issued:</span> {invoice.date}</p>
                  <p><span className="font-semibold text-slate-700">Due Date:</span> {invoice.dueDate}</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12">
            {editing ? (
              <>
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">From</h3>
                  <div>
                    <p className={fieldLabel}>Name</p>
                    <Input value={form.fromName} onChange={(e) => setField('fromName', e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <p className={fieldLabel}>Address</p>
                    <Textarea value={form.fromAddress} onChange={(e) => setField('fromAddress', e.target.value)} className="mt-1 min-h-16" placeholder={'Street 1\n10000 Zagreb, Croatia'} />
                  </div>
                  <div>
                    <p className={fieldLabel}>Tax ID / OIB</p>
                    <Input value={form.fromTaxId} onChange={(e) => setField('fromTaxId', e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <p className={fieldLabel}>IBAN</p>
                    <Input value={form.fromIban} onChange={(e) => setField('fromIban', e.target.value)} className="mt-1 h-9 font-mono" />
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bill To</h3>
                  <div>
                    <p className={fieldLabel}>Name</p>
                    <Input value={form.toName} onChange={(e) => setField('toName', e.target.value)} className="mt-1 h-9" />
                  </div>
                  <div>
                    <p className={fieldLabel}>Address</p>
                    <Textarea value={form.toAddress} onChange={(e) => setField('toAddress', e.target.value)} className="mt-1 min-h-16" />
                  </div>
                  <div>
                    <p className={fieldLabel}>Tax ID / OIB</p>
                    <Input value={form.toTaxId} onChange={(e) => setField('toTaxId', e.target.value)} className="mt-1 h-9" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <PartyBlock
                  label="From"
                  name={invoice.fromPartyName || invoice.projectName}
                  address={invoice.fromAddress}
                  taxId={invoice.fromTaxId}
                  iban={invoice.fromIban}
                />
                <PartyBlock
                  label="Bill To"
                  name={invoice.toPartyName || invoice.clientName}
                  address={invoice.toAddress}
                  taxId={invoice.toTaxId}
                  extra={<p className="text-slate-400">Project: {invoice.projectName} · Source week: {invoice.weekLabel}</p>}
                />
              </>
            )}
          </div>

          <div className="mb-12">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900">
                  <th className="py-3 font-bold text-sm text-slate-900 uppercase tracking-wide">Description</th>
                  <th className="py-3 font-bold text-sm text-slate-900 uppercase tracking-wide text-right w-28">Qty / Hours</th>
                  <th className="py-3 font-bold text-sm text-slate-900 uppercase tracking-wide text-right w-32">Rate</th>
                  <th className="py-3 font-bold text-sm text-slate-900 uppercase tracking-wide text-right w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {editing
                  ? form.lines.map((line, index) => (
                      <tr key={line.id}>
                        <td className="py-3 pr-4">
                          <Input value={line.description} onChange={(e) => setLine(index, 'description', e.target.value)} className="h-9" />
                        </td>
                        <td className="py-3 pl-2 text-right">
                          <Input
                            value={line.quantity}
                            onChange={(e) => setLine(index, 'quantity', e.target.value)}
                            className="h-9 text-right font-mono"
                            inputMode="decimal"
                          />
                        </td>
                        <td className="py-3 pl-2 text-right">
                          <Input
                            value={line.unitPrice}
                            onChange={(e) => setLine(index, 'unitPrice', e.target.value)}
                            className="h-9 text-right font-mono"
                            inputMode="decimal"
                          />
                        </td>
                        <td className="py-3 pl-2 text-right font-mono text-sm font-semibold text-slate-900">
                          {formatMoney(toNumber(line.quantity) * toNumber(line.unitPrice), currency)}
                        </td>
                      </tr>
                    ))
                  : displayLines.map((item) => (
                      <tr key={item.id}>
                        <td className="py-4 text-sm text-slate-800 font-medium">{item.description}</td>
                        <td className="py-4 text-sm text-slate-600 text-right font-mono">{toNumber(item.quantity).toFixed(2)}</td>
                        <td className="py-4 text-sm text-slate-600 text-right font-mono">{formatMoney(toNumber(item.unitPrice), currency)}</td>
                        <td className="py-4 text-sm text-slate-900 text-right font-mono font-semibold">
                          {formatMoney(toNumber(item.amount), currency)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-16">
            <div className="w-80 bg-slate-50 rounded-xl p-6 border border-slate-100">
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatMoney(editing ? editSubtotal : subtotal, currency)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-600">
                  {editing ? (
                    <span className="flex items-center gap-2">
                      VAT
                      <Input
                        value={form.taxRate}
                        onChange={(e) => setField('taxRate', e.target.value)}
                        className="h-8 w-16 text-right font-mono"
                        inputMode="decimal"
                      />
                      %
                    </span>
                  ) : (
                    <span>VAT ({taxRate}%)</span>
                  )}
                  <span className="font-mono">{formatMoney(editing ? editTax : tax, currency)}</span>
                </div>
                <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-base font-bold text-slate-900 uppercase tracking-wide">Total Due</span>
                  <span className="text-2xl font-bold text-indigo-600 font-mono">
                    {formatMoney(editing ? editTotal : total, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 mt-auto text-sm text-slate-500">
            <h4 className="font-semibold text-slate-700 mb-2">Payment Terms</h4>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <p className={fieldLabel}>Payment reference (poziv na broj)</p>
                  <Input value={form.paymentRef} onChange={(e) => setField('paymentRef', e.target.value)} className="mt-1 h-9 w-72 font-mono" placeholder="HR99 ..." />
                </div>
                <div>
                  <p className={fieldLabel}>Notes</p>
                  <Textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} className="mt-1 min-h-16" placeholder="Payment terms, bank details, legal notes…" />
                </div>
              </div>
            ) : (
              <>
                {invoice.paymentRef?.trim() ? (
                  <p><span className="text-slate-400">Payment reference:</span> <span className="font-mono">{invoice.paymentRef.trim()}</span></p>
                ) : null}
                <p className="mt-1">Generated from approved timesheets. Standard payment terms: Net 30.</p>
                {invoice.notes?.trim() ? <p className="mt-2">{invoice.notes.trim()}</p> : null}
                <p className="mt-4 italic">Thank you for your business.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
