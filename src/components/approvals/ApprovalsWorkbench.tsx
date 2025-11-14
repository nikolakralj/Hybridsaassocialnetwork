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
  getApprovalQueueMock,
  approveItemMock,
  rejectItemMock,
  bulkApproveItemsMock,
  type ApprovalQueueItem,
  type QueueFilters,
  type ApprovalQueueResponse,
} from '../../utils/api/approvals-queue';
import { GraphOverlayModal } from './GraphOverlayModal';
import { usePersona } from '../../contexts/PersonaContext'; // ✅ TEST MODE

interface ApprovalsWorkbenchProps {
  projectFilter?: string; // Optional: filter to specific project
  statusFilter?: 'all' | 'pending' | 'approved' | 'rejected';
}

export function ApprovalsWorkbench({ 
  projectFilter,
  statusFilter: externalStatusFilter 
}: ApprovalsWorkbenchProps = {}) {
  const { currentPersona } = usePersona();
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showGraphModal, setShowGraphModal] = useState(false);
  const [selectedGraphItem, setSelectedGraphItem] = useState<ApprovalQueueItem | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [availableFilters, setAvailableFilters] = useState<QueueFilters | null>(null);
  
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
      const params: any = {
        status: statusFilter === 'all' ? undefined : statusFilter as any,
        workType: typeFilter === 'all' ? undefined : typeFilter as any,
        projectId: projectFilter,
      };
      
      const response = await getApprovalQueueMock(params);
      setItems(response.items || []);
      setTotalCount(response.total || 0);
      setAvailableFilters(response.filters || null);
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
      await approveItemMock(itemId, { approvedBy: currentPersona?.id || 'current-user' });
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
      await rejectItemMock(itemId, { rejectedBy: currentPersona?.id || 'current-user', reason });
      toast.success('Rejected successfully');
      loadApprovals();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };
  
  const handleBulkApprove = async () => {
    try {
      await bulkApproveItemsMock({ 
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
  
  const handleViewGraph = (item: ApprovalQueueItem) => {
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
          <h2 className="text-2xl font-semibold text-gray-900">
            {projectFilter ? 'Project Approvals' : 'Approvals Workbench'}
          </h2>
          <Badge variant="outline" className="text-purple-600 border-purple-300">
            <Sparkles className="h-3 w-3 mr-1" />
            Multi-Party Graph
          </Badge>
        </div>
        <p className="text-sm text-gray-600">
          Review and approve timesheets, expenses, and invoices across all projects
        </p>
      </div>
      
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm text-gray-600">Total Items</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-sm text-yellow-700">Pending</div>
          <div className="text-2xl font-semibold text-yellow-900 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-sm text-green-700">Approved</div>
          <div className="text-2xl font-semibold text-green-900 mt-1">{stats.approved}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-700">Rejected</div>
          <div className="text-2xl font-semibold text-red-900 mt-1">{stats.rejected}</div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search approvals..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64"
        />
        
        {!externalStatusFilter && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" size="sm" onClick={loadApprovals}>
          Refresh
        </Button>
      </div>
      
      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="text-sm font-medium text-blue-900">
            {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleBulkApprove}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve All
            </Button>
            <Button
              onClick={() => setSelectedItems(new Set())}
              size="sm"
              variant="outline"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}
      
      {/* Items List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No approvals found
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select All */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
            <Checkbox
              checked={selectedItems.size === filteredItems.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm font-medium text-gray-700">Select All</span>
          </div>
          
          {/* Items */}
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onCheckedChange={() => handleToggleItem(item.id)}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900">
                      {item.objectType === 'timesheet' ? 'Timesheet' : 'Expense Report'} - {item.person.name}
                    </h3>
                    <Badge variant={
                      item.status === 'approved' ? 'default' :
                      item.status === 'rejected' ? 'destructive' :
                      'secondary'
                    }>
                      {item.status}
                    </Badge>
                    <Badge variant="outline">
                      {item.objectType}
                    </Badge>
                    <Badge variant="outline" className="text-purple-600 border-purple-300">
                      Step {item.stepOrder} of {item.totalSteps}
                    </Badge>
                    {item.sla.breached && (
                      <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-300">
                        SLA Breached
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Submitted by <span className="font-medium">{item.person.name}</span> ({item.person.role || 'Freelancer'})</div>
                    <div>Project: <span className="font-medium">{item.project.name}</span></div>
                    <div>Current Approver: <span className="font-medium">{item.partyName}</span></div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-500">
                    <div>Period: {item.period.start} to {item.period.end}</div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="font-medium">{item.hours} hours</span>
                      {item.canViewRates && item.amount && (
                        <span className="font-medium text-gray-900">${item.amount.toLocaleString()}</span>
                      )}
                      {!item.canViewRates && (
                        <span className="text-gray-400 italic">Rate masked</span>
                      )}
                    </div>
                  </div>
                  
                  {item.gating.blocked && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Blocked: {item.gating.reasons.join(', ')}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewGraph(item)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Graph
                  </Button>
                  
                  {item.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(item.id)}
                        className="bg-green-600 hover:bg-green-700"
                        disabled={item.gating.blocked}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(item.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
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
          isOpen={showGraphModal}
          onClose={() => {
            setShowGraphModal(false);
            setSelectedGraphItem(null);
          }}
        />
      )}
    </div>
  );
}