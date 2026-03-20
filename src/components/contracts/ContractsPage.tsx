import React, { useState, useEffect } from 'react';
import { Plus, FileText, Download, MoreVertical, Trash2, Edit, DollarSign, ArrowRight, Loader2, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useAuth } from '../../contexts/AuthContext';
import {
  listContracts,
  createContract,
  deleteContract,
  updateContract,
} from '../../utils/api/contracts-api';
import { toast } from 'sonner';

interface ContractFormData {
  providerName: string;
  providerType: 'individual' | 'company' | 'agency';
  recipientName: string;
  recipientType: 'company' | 'agency' | 'client';
  baseHourlyRate: number;
  currency: string;
  billingCycle: string;
  status: string;
}

const EMPTY_FORM: ContractFormData = {
  providerName: '',
  providerType: 'individual',
  recipientName: '',
  recipientType: 'company',
  baseHourlyRate: 0,
  currency: 'USD',
  billingCycle: 'monthly',
  status: 'active',
};

export function ContractsPage() {
  const { user, accessToken } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingContract, setEditingContract] = useState<any | null>(null);
  const [formData, setFormData] = useState<ContractFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const loadContracts = async () => {
    setIsLoading(true);
    try {
      const data = await listContracts(accessToken);
      setContracts(data);
    } catch (error) {
      console.error('Error loading contracts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContracts();
  }, [accessToken]);

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      await createContract(
        {
          providerName: formData.providerName || user?.name || 'Me',
          providerType: formData.providerType,
          recipientName: formData.recipientName,
          recipientType: formData.recipientType,
          baseHourlyRate: formData.baseHourlyRate,
          currency: formData.currency,
          billingCycle: formData.billingCycle,
          status: formData.status,
        },
        accessToken
      );
      toast.success('Contract created');
      setShowCreateDialog(false);
      setFormData(EMPTY_FORM);
      loadContracts();
    } catch (error: any) {
      console.error('Create contract error:', error);
      toast.error(error.message || 'Failed to create contract');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingContract) return;
    setIsSaving(true);
    try {
      await updateContract(
        editingContract.id,
        {
          providerName: formData.providerName,
          providerType: formData.providerType,
          recipientName: formData.recipientName,
          recipientType: formData.recipientType,
          baseHourlyRate: formData.baseHourlyRate,
          currency: formData.currency,
          billingCycle: formData.billingCycle,
          status: formData.status,
        },
        accessToken
      );
      toast.success('Contract updated');
      setEditingContract(null);
      setFormData(EMPTY_FORM);
      loadContracts();
    } catch (error: any) {
      console.error('Update contract error:', error);
      toast.error(error.message || 'Failed to update contract');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (contractId: string) => {
    if (!confirm('Delete this contract?')) return;
    try {
      await deleteContract(contractId, accessToken);
      setContracts(contracts.filter(c => c.id !== contractId));
      toast.success('Contract deleted');
    } catch (error: any) {
      console.error('Delete contract error:', error);
      toast.error(error.message || 'Failed to delete contract');
    }
  };

  const openEdit = (contract: any) => {
    setFormData({
      providerName: contract.providerName || '',
      providerType: contract.providerType || 'individual',
      recipientName: contract.recipientName || '',
      recipientType: contract.recipientType || 'company',
      baseHourlyRate: contract.baseHourlyRate || 0,
      currency: contract.currency || 'USD',
      billingCycle: contract.billingCycle || 'monthly',
      status: contract.status || 'active',
    });
    setEditingContract(contract);
  };

  const filtered = contracts.filter(c =>
    (c.providerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.recipientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.contractNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'expired': return <Badge variant="outline" className="text-amber-600 border-amber-200">Expired</Badge>;
      case 'terminated': return <Badge variant="outline" className="text-red-600 border-red-200">Terminated</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '\u20AC';
      case 'GBP': return '\u00A3';
      default: return '$';
    }
  };

  const totalActive = contracts.filter(c => c.status === 'active').length;
  const totalValue = contracts.reduce((sum, c) => sum + (c.baseHourlyRate || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground m-0">Contracts & Agreements</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your vendors, customers, and active statements of work.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9"
            onClick={() => toast.info('Export will generate a CSV of your contracts')}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
          <Button
            size="sm"
            className="gap-2 h-9"
            onClick={() => {
              setFormData({ ...EMPTY_FORM, providerName: user?.name || '' });
              setShowCreateDialog(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Contracts</div>
          <div className="text-2xl font-semibold">{contracts.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Active</div>
          <div className="text-2xl font-semibold text-emerald-600">{totalActive}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg. Hourly Rate</div>
          <div className="text-2xl font-semibold">
            {contracts.length > 0 ? `$${Math.round(totalValue / contracts.length)}` : '$0'}/hr
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contracts..."
            className="pl-10 bg-background border-border/60 h-9 text-sm"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border-2 border-dashed border-border/60 bg-muted/20">
          <div className="max-w-sm mx-auto">
            <div className="h-14 w-14 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-foreground font-medium mb-1">No contracts yet</h3>
            <p className="text-muted-foreground text-sm mb-5">
              Create your first contract to define rate agreements between parties
            </p>
            <Button
              onClick={() => {
                setFormData({ ...EMPTY_FORM, providerName: user?.name || '' });
                setShowCreateDialog(true);
              }}
              className="bg-foreground text-background hover:bg-foreground/90 rounded-full h-9 px-4 text-sm gap-2"
            >
              <Plus className="h-4 w-4" />
              Create First Contract
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(contract => (
            <Card key={contract.id} className="p-5 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-muted-foreground font-mono mb-1">{contract.contractNumber}</div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-medium truncate">{contract.providerName}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{contract.recipientName}</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(contract)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(contract.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mb-3">
                {getStatusBadge(contract.status)}
                <Badge variant="secondary" className="text-[11px] capitalize">{contract.providerType}</Badge>
                <Badge variant="secondary" className="text-[11px] capitalize">{contract.recipientType}</Badge>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground text-sm">
                    {getCurrencySymbol(contract.currency)}{contract.baseHourlyRate}/hr
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Billing: {contract.billingCycle}</span>
                </div>
                {contract.effectiveDate && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Since {new Date(contract.effectiveDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Work Type Rates */}
              {contract.workTypeRates && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <div className="text-[11px] text-muted-foreground mb-1.5">Rate Schedule</div>
                  <div className="grid grid-cols-2 gap-1 text-[11px]">
                    <span className="text-muted-foreground">Regular:</span>
                    <span>{getCurrencySymbol(contract.currency)}{contract.workTypeRates.regular}/hr</span>
                    <span className="text-muted-foreground">Overtime:</span>
                    <span>{getCurrencySymbol(contract.currency)}{contract.workTypeRates.overtime}/hr</span>
                    <span className="text-muted-foreground">Travel:</span>
                    <span>{getCurrencySymbol(contract.currency)}{contract.workTypeRates.travel}/hr</span>
                    <span className="text-muted-foreground">On-call:</span>
                    <span>{getCurrencySymbol(contract.currency)}{contract.workTypeRates.oncall}/hr</span>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create Contract Dialog */}
      <ContractFormDialog
        open={showCreateDialog}
        onClose={() => { setShowCreateDialog(false); setFormData(EMPTY_FORM); }}
        title="Create New Contract"
        description="Define a rate agreement between two parties"
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleCreate}
        isSaving={isSaving}
        submitLabel="Create Contract"
      />

      {/* Edit Contract Dialog */}
      <ContractFormDialog
        open={!!editingContract}
        onClose={() => { setEditingContract(null); setFormData(EMPTY_FORM); }}
        title="Edit Contract"
        description={`Editing ${editingContract?.contractNumber || ''}`}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleUpdate}
        isSaving={isSaving}
        submitLabel="Save Changes"
      />
    </div>
  );
}

// ============================================================================
// Contract Form Dialog (reused for create & edit)
// ============================================================================

function ContractFormDialog({
  open,
  onClose,
  title,
  description,
  formData,
  setFormData,
  onSubmit,
  isSaving,
  submitLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  formData: ContractFormData;
  setFormData: (d: ContractFormData) => void;
  onSubmit: () => void;
  isSaving: boolean;
  submitLabel: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Provider */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Provider Name</Label>
              <Input
                value={formData.providerName}
                onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                placeholder="e.g., Your Name / Company"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Provider Type</Label>
              <Select
                value={formData.providerType}
                onValueChange={(v) => setFormData({ ...formData, providerType: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client / Recipient Name</Label>
              <Input
                value={formData.recipientName}
                onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                placeholder="e.g., Acme Corp"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Recipient Type</Label>
              <Select
                value={formData.recipientType}
                onValueChange={(v) => setFormData({ ...formData, recipientType: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Company</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rate & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Hourly Rate</Label>
              <Input
                type="number"
                value={formData.baseHourlyRate || ''}
                onChange={(e) => setFormData({ ...formData, baseHourlyRate: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(v) => setFormData({ ...formData, currency: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Billing Cycle</Label>
              <Select
                value={formData.billingCycle}
                onValueChange={(v) => setFormData({ ...formData, billingCycle: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(v) => setFormData({ ...formData, status: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isSaving || !formData.recipientName}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}