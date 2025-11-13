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
} from '../../utils/api/approvals-queue';
import { GraphOverlayModal } from './GraphOverlayModal';

interface ApprovalsWorkbenchProps {
  projectFilter?: string;  // Optional: filter to specific project
  statusFilter?: "all" | "pending" | "approved" | "rejected";  // Optional: filter by status
  embedded?: boolean;  // Optional: embedded mode (no header)
}

export function ApprovalsWorkbench({ 
  projectFilter, 
  statusFilter = "all",
  embedded = false 
}: ApprovalsWorkbenchProps = {}) {
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [filters, setFilters] = useState<QueueFilters>({
    projects: projectFilter ? [projectFilter] : [],
    parties: [],
    steps: [],
    workTypes: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Filter state
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedParty, setSelectedParty] = useState<string>('all');
  const [selectedStep, setSelectedStep] = useState<string>('all');
  const [selectedSLA, setSelectedSLA] = useState<string>('all');
  
  // Graph overlay state
  const [graphOverlayOpen, setGraphOverlayOpen] = useState(false);
  const [graphOverlayItem, setGraphOverlayItem] = useState<ApprovalQueueItem | null>(null);
  
  // Load queue data
  useEffect(() => {
    loadQueue();
  }, [selectedProject, selectedParty, selectedStep, selectedSLA]);
  
  async function loadQueue() {
    setIsLoading(true);
    try {
      const params: any = {};
      if (selectedProject !== 'all') params.projectId = selectedProject;
      if (selectedParty !== 'all') params.partyId = selectedParty;
      if (selectedStep !== 'all') params.step = parseInt(selectedStep);
      if (selectedSLA !== 'all') params.sla = selectedSLA;
      
      const response = await getApprovalQueueMock(params);
      setItems(response.items);
      setFilters(response.filters);
      
      console.log('✅ Loaded approval queue:', response.items.length, 'items');
    } catch (error) {
      console.error('Error loading queue:', error);
      toast.error('Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  }
  
  // Handle approve
  async function handleApprove(itemId: string) {
    try {
      await approveItemMock(itemId, {
        approvedBy: 'current-user',
        notes: 'Approved from workbench',
      });
      
      toast.success('Approved!', {
        description: 'Moving to next approval step',
      });
      
      loadQueue();
    } catch (error) {
      toast.error('Failed to approve');
    }
  }
  
  // Handle reject
  async function handleReject(itemId: string) {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    
    try {
      await rejectItemMock(itemId, {
        rejectedBy: 'current-user',
        reason,
      });
      
      toast.success('Rejected', {
        description: 'Contractor will be notified',
      });
      
      loadQueue();
    } catch (error) {
      toast.error('Failed to reject');
    }
  }
  
  // Handle bulk approve
  async function handleBulkApprove() {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }
    
    try {
      const result = await bulkApproveItemsMock({
        approvedBy: 'current-user',
        itemIds: Array.from(selectedItems),
        threshold: 10000, // $10k threshold
      });
      
      if (result.failed.length > 0) {
        toast.warning(`Approved ${result.approved}, failed ${result.failed.length}`, {
          description: 'Some items exceeded threshold',
        });
      } else {
        toast.success(`Approved ${result.approved} items!`);
      }
      
      setSelectedItems(new Set());
      loadQueue();
    } catch (error) {
      toast.error('Bulk approve failed');
    }
  }
  
  // Toggle selection
  function toggleSelection(itemId: string) {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  }
  
  // Select all
  function selectAll() {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  }
  
  // Open graph overlay
  function openGraphOverlay(item: ApprovalQueueItem) {
    setGraphOverlayItem(item);
    setGraphOverlayOpen(true);
  }
  
  // Close graph overlay and refresh if approval happened
  function closeGraphOverlay() {
    setGraphOverlayOpen(false);
    setGraphOverlayItem(null);
  }
  
  // Get SLA badge
  function getSLABadge(item: ApprovalQueueItem) {
    if (item.sla.breached) {
      return <Badge variant="destructive" className="text-xs">⚠️ Breach</Badge>;
    }
    if (item.sla.etaHours && item.sla.etaHours < 24) {
      return <Badge variant="default" className="bg-amber-500 text-xs">🟡 {'<'}24h</Badge>;
    }
    return <Badge variant="outline" className="text-xs">✅ OK</Badge>;
  }
  
  // Stats
  const breachedCount = items.filter(i => i.sla.breached).length;
  const soonCount = items.filter(i => !i.sla.breached && i.sla.etaHours && i.sla.etaHours < 24).length;
  const totalHours = items.reduce((sum, i) => sum + i.hours, 0);
  const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0);
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      {!embedded && (
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl text-gray-900">My Approvals</h1>
              <p className="text-sm text-gray-500 mt-1">
                Cross-project approval workbench
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-base px-4 py-2">
                🔔 {items.length} pending
              </Badge>
              {breachedCount > 0 && (
                <Badge variant="destructive" className="text-base px-4 py-2">
                  ⚠️ {breachedCount} breached
                </Badge>
              )}
            </div>
          </div>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <Clock className="h-4 w-4" />
                Total Hours
              </div>
              <div className="text-2xl">{totalHours.toFixed(1)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <TrendingUp className="h-4 w-4" />
                Total Amount
              </div>
              <div className="text-2xl">${(totalAmount / 1000).toFixed(1)}k</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <AlertTriangle className="h-4 w-4" />
                SLA Breach
              </div>
              <div className="text-2xl text-red-600">{breachedCount}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <BarChart3 className="h-4 w-4" />
                Due Soon
              </div>
              <div className="text-2xl text-amber-600">{soonCount}</div>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-gray-400" />
            
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {filters.projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedParty} onValueChange={setSelectedParty}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Parties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                {filters.parties.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedStep} onValueChange={setSelectedStep}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Steps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Steps</SelectItem>
                {filters.steps.map(s => (
                  <SelectItem key={s.order} value={s.order.toString()}>
                    {s.label} ({s.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedSLA} onValueChange={setSelectedSLA}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All SLA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SLA</SelectItem>
                <SelectItem value="breach">⚠️ Breached</SelectItem>
                <SelectItem value="soon">🟡 Due Soon</SelectItem>
              </SelectContent>
            </Select>
            
            {(selectedProject !== 'all' || selectedParty !== 'all' || selectedStep !== 'all' || selectedSLA !== 'all') && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setSelectedProject('all');
                  setSelectedParty('all');
                  setSelectedStep('all');
                  setSelectedSLA('all');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Bulk Action Toolbar */}
      {selectedItems.size > 0 && (
        <div className="bg-purple-50 border-b px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={selectedItems.size === items.length}
              onCheckedChange={selectAll}
            />
            <span className="text-sm font-medium">
              {selectedItems.size} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleBulkApprove}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Selected
            </Button>
            <Button 
              variant="outline"
              onClick={() => setSelectedItems(new Set())}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      
      {/* Queue Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-3" />
              <p className="text-gray-600">Loading approvals...</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-xl text-gray-900 mb-2">All caught up!</h3>
              <p className="text-gray-600">No pending approvals</p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto p-6">
            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.id}
                  className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={() => toggleSelection(item.id)}
                    />
                    
                    {/* Content */}
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900">
                              {item.person.name}
                            </h3>
                            {item.person.role && (
                              <Badge variant="outline" className="text-xs">
                                {item.person.role}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{item.project.name}</span>
                            <span>•</span>
                            <span>Week of {new Date(item.period.start).toLocaleDateString()}</span>
                            <span>•</span>
                            <span>Step {item.stepOrder} of {item.totalSteps}</span>
                          </div>
                        </div>
                        
                        {/* SLA Badge */}
                        {getSLABadge(item)}
                      </div>
                      
                      {/* Stats */}
                      <div className="flex items-center gap-6 mb-3 text-sm">
                        <div>
                          <span className="text-gray-600">Hours: </span>
                          <span className="font-medium">{item.hours.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Amount: </span>
                          <span className="font-medium">
                            {item.amount ? `$${item.amount.toLocaleString()}` : '•••'}
                          </span>
                          {!item.canViewRates && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Rate masked
                            </Badge>
                          )}
                        </div>
                        <div>
                          <span className="text-gray-600">Submitted: </span>
                          <span className="font-medium">
                            {new Date(item.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(item.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(item.id)}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Why?
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openGraphOverlay(item)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View path on graph
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Keyboard Shortcuts Helper */}
      <div className="bg-gray-100 border-t px-6 py-2 text-xs text-gray-600">
        <span className="font-medium">Keyboard shortcuts:</span>
        <span className="ml-3">j/k = navigate</span>
        <span className="ml-3">x = select</span>
        <span className="ml-3">a = approve</span>
        <span className="ml-3">r = reject</span>
      </div>
      
      {/* Graph Overlay Modal */}
      <GraphOverlayModal
        open={graphOverlayOpen}
        onClose={closeGraphOverlay}
        item={graphOverlayItem}
        onApprovalComplete={loadQueue}
      />
    </div>
  );
}