import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Send, Printer, CheckCircle2 } from 'lucide-react';
import type { InvoiceDraft } from './InvoicesWorkspace';

export function InvoiceDetailPrintView({
  invoice,
  onBack,
}: {
  invoice: InvoiceDraft;
  onBack: () => void;
}) {
  const lineItems = [
    {
      desc: `Approved timesheet • ${invoice.weekLabel} (${invoice.personName})`,
      hours: invoice.hours,
      rate: invoice.rate,
      amount: invoice.amount,
    },
  ];

  const subtotal = lineItems.reduce((acc, item) => acc + item.amount, 0);
  const tax = 0;
  const total = subtotal + tax;

  const StatusBadge = ({ status }: { status: InvoiceDraft['status'] }) => {
    switch (status) {
      case 'paid': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-none px-3 py-1 text-sm"><CheckCircle2 className="w-4 h-4 mr-1.5" /> PAID</Badge>;
      case 'sent': return <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 border-none px-3 py-1 text-sm">AWAITING PAYMENT</Badge>;
      case 'overdue': return <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 border-none px-3 py-1 text-sm">OVERDUE</Badge>;
      default: return <Badge variant="outline" className="text-slate-500 border-slate-200 px-3 py-1 text-sm">DRAFT</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden mb-6">
        <Button variant="ghost" onClick={onBack} className="text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Invoices
        </Button>
        <div className="flex items-center space-x-2">
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
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto bg-white border border-slate-200/60 shadow-md rounded-xl p-12 print:shadow-none print:border-none print:p-0">
          <div className="flex justify-between items-start mb-12">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 uppercase">INVOICE</h1>
              <p className="text-slate-500 mt-2 font-mono text-lg">{invoice.number}</p>
            </div>
            <div className="text-right flex flex-col items-end">
              <StatusBadge status={invoice.status} />
              <div className="mt-6 text-slate-500 text-sm space-y-1 text-right">
                <p><span className="font-semibold text-slate-700">Date Issued:</span> {invoice.date}</p>
                <p><span className="font-semibold text-slate-700">Due Date:</span> {invoice.dueDate}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">From</h3>
              <p className="font-semibold text-slate-900 text-lg">{invoice.projectName}</p>
              <div className="text-slate-600 text-sm leading-relaxed">
                <p>WorkGraph Billing</p>
                <p className="mt-2 text-slate-400">billing@workgraph.com</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bill To</h3>
              <p className="font-semibold text-slate-900 text-lg">{invoice.clientName}</p>
              <div className="text-slate-600 text-sm leading-relaxed">
                <p>Project: {invoice.projectName}</p>
                <p className="mt-2 text-slate-400">Source week: {invoice.weekLabel}</p>
              </div>
            </div>
          </div>

          <div className="mb-12">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900">
                  <th className="py-3 font-bold text-sm text-slate-900 uppercase tracking-wide">Description</th>
                  <th className="py-3 font-bold text-sm text-slate-900 uppercase tracking-wide text-right w-24">Hours</th>
                  <th className="py-3 font-bold text-sm text-slate-900 uppercase tracking-wide text-right w-32">Rate</th>
                  <th className="py-3 font-bold text-sm text-slate-900 uppercase tracking-wide text-right w-32">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-4 text-sm text-slate-800 font-medium">{item.desc}</td>
                    <td className="py-4 text-sm text-slate-600 text-right font-mono">{item.hours.toFixed(2)}</td>
                    <td className="py-4 text-sm text-slate-600 text-right font-mono">${item.rate.toFixed(2)}</td>
                    <td className="py-4 text-sm text-slate-900 text-right font-mono font-semibold">
                      ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                  <span className="font-mono">${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Tax (0%)</span>
                  <span className="font-mono">${tax.toFixed(2)}</span>
                </div>
                <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-base font-bold text-slate-900 uppercase tracking-wide">Total Due</span>
                  <span className="text-2xl font-bold text-indigo-600 font-mono">
                    ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 mt-auto text-sm text-slate-500">
            <h4 className="font-semibold text-slate-700 mb-2">Payment Terms</h4>
            <p>Generated from approved timesheets. Standard payment terms: Net 30.</p>
            <p className="mt-4 italic">Thank you for your business.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

