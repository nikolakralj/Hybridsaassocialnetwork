// Phase 5 Day 3: Global Approvals Workbench
// Cross-project approval inbox with filters, bulk actions, and graph overlay

import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  Filter, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  Sparkles,
  Clock,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner@2.0.3';
import {
  getApprovalQueue,
  approveItem,
  rejectItem,
  bulkApprove,
  type ApprovalQueueItem,
  type ApprovalQueueFilters,
} from '../../utils/api/approvals-supabase';
import { GraphOverlayModal } from './GraphOverlayModal';
import { usePersona } from '../../contexts/PersonaContext'; // ✅ TEST MODE

// Helper interface for UI display
export interface UIApprovalItem {
  id: string;
  objectType: 'timesheet' | 'expense' | 'invoice' | 'contract' | 'deliverable' | string;
  project: {
    id: string;
    name: string;
  };
  stepOrder: number;
  totalSteps: number;
  policyVersion: number;
  partyId: string;
  partyName: string;
  period: { start: string; end: string };
  person: {
    id: string;
    name: string;
    role?: string;
  };
  hours: number;
  amount: number | null;
  canViewRates: boolean;
  gating: {
    blocked: boolean;
    reasons: string[];
  };
  sla: {
    breached: boolean;
  };
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
}

interface ApprovalsWorkbenchProps {
  projectFilter?: string; // Optional: filter to specific project
  statusFilter?: 'all' | 'pending' | 'approved' | 'rejected';
}

export function ApprovalsWorkbench({ 
  projectFilter,
  statusFilter: externalStatusFilter 
}: ApprovalsWorkbenchProps = {}) {
  const { currentPersona } = usePersona();
  const [items, setItems] = useState<UIApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [selectedGraphItem, setSelectedGraphItem] = useState<UIApprovalItem | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [availableFilters, setAvailableFilters] = useState<Record<string, string[]> | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>(externalStatusFilter || 'all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('date');
  
  // Load data
  useEffect(() => {
    loadApprovals();
  }, [currentPersona, projectFilter]);
  
  const loadApprovals = async () => {
    setLoading(true);
    try {
      const filters: ApprovalQueueFilters = {
        status: statusFilter === 'all' ? undefined : statusFilter as any,
        subjectType: typeFilter === 'all' ? undefined : typeFilter as any,
        projectId: projectFilter,
      };
      
      const data = await getApprovalQueue(filters);
      
      // Transform to expected format for UI
      const transformedItems = (data || []).map(item => ({
        id: item.id,
        objectType: item.subjectType,
        project: {
          id: item.projectId,
          name: item.projectName || 'Unknown Project',
        },
        stepOrder: item.approvalLayer,
        totalSteps: item.approvalLayer, // TODO: Calculate from approval chain
        policyVersion: 1,
        partyId: item.approverUserId,
        partyName: item.approverName,
        period: {
          start: item.timesheetData?.weekStart || '',
          end: item.timesheetData?.weekEnd || '',
        },
        person: {
          id: item.approverUserId,
          name: item.timesheetData?.contractorName || 'Unknown',
          role: 'Contractor',
        },
        hours: item.timesheetData?.totalHours || 0,
        amount: item.timesheetData?.hourlyRate && item.timesheetData?.totalHours ? item.timesheetData.totalHours * item.timesheetData.hourlyRate : null,
        canViewRates: !!item.timesheetData?.hourlyRate,
        gating: {
          blocked: false,
          reasons: [],
        },
        sla: {
          breached: false,
        },
        submittedAt: item.submittedAt || new Date().toISOString(),
        status: item.status,
      }));
      
      setItems(transformedItems);
      setTotalCount(transformedItems.length);
    } catch (error) {
      toast.error('Failed to load approvals');
      console.error('Load error:', error);
      setItems([]); // Ensure items is always an array
    } finally {
      setLoading(false);
    }
  };
  
  // Filter and sort items
  const filteredItems = items
    .filter(item => {
      const searchText = `${item.person.name} ${item.project.name} ${item.objectType}`.toLowerCase();
      if (searchQuery && !searchText.includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (externalStatusFilter && externalStatusFilter !== 'all' && item.status !== externalStatusFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        // Sort by SLA breach status (breached items first)
        if (a.sla.breached && !b.sla.breached) return -1;
        if (!a.sla.breached && b.sla.breached) return 1;
      }
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  
  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };
  
  const handleToggleItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };
  
  const handleApprove = async (itemId: string) => {
    try {
      await approveItem(itemId, { approvedBy: currentPersona?.id || 'current-user' });
      toast.success('Approved successfully');
      loadApprovals();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };
  
  const handleReject = async (itemId: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    
    try {
      await rejectItem(itemId, { rejectedBy: currentPersona?.id || 'current-user', reason });
      toast.success('Rejected successfully');
      loadApprovals();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };
  
  const handleBulkApprove = async () => {
    try {
      await bulkApprove({ 
        approvedBy: currentPersona?.id || 'current-user',
        itemIds: Array.from(selectedItems) 
      });
      toast.success(`Approved ${selectedItems.size} items`);
      setSelectedItems(new Set());
      loadApprovals();
    } catch (error) {
      toast.error('Failed to bulk approve');
    }
  };
  
  const handleViewGraph = (item: UIApprovalItem) => {
    setSelectedGraphItem(item);
    setShowGraphModal(true);
  };
  
  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length,
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {projectFilter ? 'Project Approvals' : 'Approvals Workbench'}
          </h2>
          <Badge variant="outline" className="text-violet-600 border-violet-300">
            <Sparkles className="h-3 w-3 mr-1" />
            Multi-Party Graph
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Review and approve timesheets, expenses, and invoices across all projects
        </p>
      </div>
      
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Items</div>
          <div className="text-2xl font-semibold text-foreground mt-1">{stats.total}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4">
          <div className="text-xs font-medium text-amber-600 uppercase tracking-wide">Pending</div>
          <div className="text-2xl font-semibold text-amber-900 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-4">
          <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Approved</div>
          <div className="text-2xl font-semibold text-emerald-900 mt-1">{stats.approved}</div>
        </div>
        <div className="bg-red-50 border border-red-200/60 rounded-xl p-4">
          <div className="text-xs font-medium text-red-600 uppercase tracking-wide">Rejected</div>
          <div className="text-2xl font-semibold text-red-900 mt-1">{stats.rejected}</div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search approvals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 h-9 text-sm bg-background border-border/60"
        />
        
        {!externalStatusFilter && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        )}
        
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="timesheet">Timesheets</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
            <SelectItem value="invoice">Invoices</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'priority')}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" size="sm" onClick={loadApprovals} className="h-9 text-sm">
          Refresh
        </Button>
      </div>
      
      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="bg-accent-brand/5 border border-accent-brand/20 rounded-xl p-4 flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleBulkApprove}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              Approve All
            </Button>
            <Button
              onClick={() => setSelectedItems(new Set())}
              size="sm"
              variant="outline"
              className="h-8 text-xs"
            >
              Clear
            </Button>
          </div>
        </div>
      )}
      
      {/* Items List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground text-sm">
          No approvals found
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select All */}
          <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 rounded-lg">
            <Checkbox
              checked={selectedItems.size === filteredItems.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-xs font-medium text-muted-foreground">Select All</span>
          </div>
          
          {/* Items */}
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="border border-border/60 rounded-xl p-4 bg-card hover:shadow-md transition-all duration-200 shadow-[0_1px_3px_0_rgb(0_0_0/0.04)]"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onCheckedChange={() => handleToggleItem(item.id)}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-medium text-sm text-foreground">
                      {item.objectType === 'timesheet' ? 'Timesheet' : 'Expense Report'} - {item.person.name}
                    </h3>
                    <Badge variant={
                      item.status === 'approved' ? 'default' :
                      item.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }>
                      {item.status}
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {item.objectType}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] text-violet-600 border-violet-300">
                      Step {item.stepOrder} of {item.totalSteps}
                    </Badge>
                    {item.sla.breached && (
                      <Badge variant="destructive" className="text-[11px]">
                        SLA Breached
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-0.5 mt-2">
                    <div>Submitted by <span className="font-medium text-foreground">{item.person.name}</span> ({item.person.role || 'Freelancer'})</div>
                    <div>Project: <span className="font-medium text-foreground">{item.project.name}</span></div>
                    <div>Current Approver: <span className="font-medium text-foreground">{item.partyName}</span></div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-muted-foreground">
                    <div>Period: {item.period.start} to {item.period.end}</div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="font-medium text-foreground">{item.hours} hours</span>
                      {item.canViewRates && item.amount && (
                        <span className="font-medium text-foreground">${item.amount.toLocaleString()}</span>
                      )}
                      {!item.canViewRates && (
                        <span className="text-muted-foreground/60 italic">Rate masked</span>
                      )}
                    </div>
                  </div>
                  
                  {item.gating.blocked && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Blocked: {item.gating.reasons.join(', ')}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewGraph(item)}
                    className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Graph
                  </Button>
                  
                  {item.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                        disabled={item.gating.blocked}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(item.id)}
                        className="h-8 text-xs"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Graph Modal */}
      {showGraphModal && selectedGraphItem && (
        <GraphOverlayModal
          item={selectedGraphItem}
          open={showGraphModal}
          onClose={() => {
            setShowGraphModal(false);
            setSelectedGraphItem(null);
          }}
          onApprovalComplete={() => {
            loadApprovals();
          }}
        />
      )}
    </div>
  );
}