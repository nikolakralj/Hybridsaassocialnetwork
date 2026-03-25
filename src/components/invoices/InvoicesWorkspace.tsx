import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Search, Calendar, DollarSign, CheckCircle2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { InvoiceDetailPrintView } from './InvoiceDetailPrintView';
import { useTimesheetStore } from '../../contexts/TimesheetDataContext';
import { useMonthContextSafe } from '../../contexts/MonthContext';
import { sumWeekHours } from '../../types/timesheets';
import { toast } from 'sonner';

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
  status: 'draft' | 'sent' | 'paid' | 'overdue';
};

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function readNameDir(projectId: string): Record<string, { name?: string }> {
  try {
    const raw = sessionStorage.getItem(`workgraph-name-dir:${projectId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readClientName(projectId: string): string {
  try {
    const raw = sessionStorage.getItem(`workgraph-approval-dir:${projectId}`);
    if (!raw) return 'Client';
    const parsed = JSON.parse(raw);
    const parties = Array.isArray(parsed?.parties) ? parsed.parties : [];
    const client = parties.find((p: any) => p?.partyType === 'client');
    return client?.name || 'Client';
  } catch {
    return 'Client';
  }
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

  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDraft | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatedInvoices, setGeneratedInvoices] = useState<InvoiceDraft[]>([]);

  const currentMonth = selectedMonth instanceof Date ? selectedMonth : new Date(selectedMonth);
  const monthKey = monthKeyFromDate(currentMonth);

  const approvedWeeks = useMemo(() => {
    return store.getAllWeeksForMonth(monthKey).filter(week => week.status === 'approved');
  }, [store, monthKey, store.version]);

  const generateDrafts = () => {
    if (approvedWeeks.length === 0) {
      toast.info('No approved timesheets found for this month yet.');
      return;
    }

    const nameDir = readNameDir(projectId);
    const clientName = readClientName(projectId);
    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultRate = 95;

    const nextDrafts: InvoiceDraft[] = approvedWeeks.map((week, index) => {
      const personName = nameDir[week.personId]?.name || week.personId;
      const hours = sumWeekHours(week);
      const amount = hours * defaultRate;
      const shortPerson = week.personId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
      const weekStamp = week.weekStart.replace(/-/g, '');
      return {
        id: `inv_${week.personId}_${week.weekStart}`,
        number: `INV-${weekStamp}-${shortPerson || String(index + 1).padStart(3, '0')}`,
        projectId,
        projectName: projectName || sessionStorage.getItem('currentProjectName') || 'Project',
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
        status: 'draft',
      };
    });

    setGeneratedInvoices(prev => {
      const byId = new Map(prev.map(inv => [inv.id, inv]));
      nextDrafts.forEach(inv => byId.set(inv.id, inv));
      return Array.from(byId.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
    });

    toast.success(`Generated ${nextDrafts.length} invoice draft${nextDrafts.length === 1 ? '' : 's'} from approved timesheets.`);
  };

  if (selectedInvoice) {
    return (
      <InvoiceDetailPrintView
        invoice={selectedInvoice}
        onBack={() => setSelectedInvoice(null)}
      />
    );
  }

  const filteredInvoices = generatedInvoices.filter(i =>
    i.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.personName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDraftAmount = generatedInvoices.reduce((sum, i) => sum + i.amount, 0);
  const totalDraftHours = generatedInvoices.reduce((sum, i) => sum + i.hours, 0);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Invoices</h2>
          <p className="text-sm text-slate-500">
            Generate invoice drafts directly from approved timesheets.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search invoices..."
              className="pl-9 w-[250px] shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="default" className="shadow-sm bg-indigo-600 hover:bg-indigo-700" onClick={generateDrafts}>
            <Plus className="w-4 h-4 mr-2" />
            Generate from Approved
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Approved Weeks</p>
              <p className="text-2xl font-bold text-slate-900">{approvedWeeks.length}</p>
            </div>
            <div className="p-3 rounded-full bg-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Draft Invoices</p>
              <p className="text-2xl font-bold text-slate-900">{generatedInvoices.length}</p>
            </div>
            <div className="p-3 rounded-full bg-slate-100">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Draft Hours</p>
              <p className="text-2xl font-bold text-slate-900">{totalDraftHours.toFixed(1)}h</p>
            </div>
            <div className="p-3 rounded-full bg-indigo-100">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Draft Amount</p>
              <p className="text-2xl font-bold text-slate-900">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalDraftAmount)}
              </p>
            </div>
            <div className="p-3 rounded-full bg-amber-100">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/60 shadow-sm h-full">
        <CardHeader className="py-4 border-b border-slate-100">
          <CardTitle className="text-base font-medium">Invoice Drafts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500">
                No invoice drafts yet. Click <strong>Generate from Approved</strong> to create drafts.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedInvoice(inv)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{inv.number}</h4>
                      <p className="text-sm text-slate-500">{inv.personName} • {inv.clientName}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-8">
                    <div className="text-right hidden sm:block">
                      <h4 className="text-sm font-medium text-slate-900">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(inv.amount)}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center mt-0.5">
                        <Calendar className="w-3 h-3 mr-1" />
                        {inv.weekLabel} • Due {inv.dueDate}
                      </p>
                    </div>
                    <div className="w-24 text-right">
                      <Badge variant="outline" className="text-slate-600 border-slate-200">
                        Draft
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      View →
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

