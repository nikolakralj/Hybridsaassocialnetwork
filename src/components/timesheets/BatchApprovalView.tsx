import { useState, useEffect, useMemo } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BatchApprovalBar } from './BatchApprovalBar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Clock, 
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Download,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getTimesheetEntries,
  updateTimesheetEntry,
  type TimesheetEntry 
} from '../../utils/api/timesheets';
import { 
  generateDemoTimesheets, 
  getDemoUserName, 
  getDemoUserRole, 
  getDemoUserRate 
} from './demo-data';

interface ContractorSummary {
  userId: string;
  name: string;
  role?: string;
  totalHours: number;
  billableAmount?: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  periodStart: string;
  periodEnd: string;
  entries: TimesheetEntry[];
}

interface BatchApprovalViewProps {
  companyId: string;
  userRole: 'company-owner' | 'agency-owner' | 'manager';
  showRates?: boolean;
  demoMode?: boolean; // Use demo data instead of API
}

export function BatchApprovalView({ 
  companyId, 
  userRole,
  showRates = true,
  demoMode = false
}: BatchApprovalViewProps) {
  // State
  const [contractors, setContractors] = useState<ContractorSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('current-month');
  
  // Dialog state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);

  // Load contractor summaries
  useEffect(() => {
    loadContractorData();
  }, [companyId, dateFilter]);

  const loadContractorData = async () => {
    setLoading(true);
    try {
      // Determine date range based on filter
      const { startDate, endDate } = getDateRange(dateFilter);
      
      let entries: TimesheetEntry[];
      
      if (demoMode) {
        // Use demo data
        entries = generateDemoTimesheets(companyId);
        // Filter by date range
        entries = entries.filter(e => e.date >= startDate && e.date <= endDate);
      } else {
        // Fetch all entries for the period
        entries = await getTimesheetEntries({
          companyId,
          startDate,
          endDate
        });
      }

      // Group by user and calculate summaries
      const summaries = groupEntriesByUser(entries, startDate, endDate);
      setContractors(summaries);
    } catch (error) {
      console.error('Error loading contractor data:', error);
      toast.error('Failed to load timesheet data');
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (filter: string) => {
    const now = new Date();
    let startDate: string;
    let endDate: string;

    switch (filter) {
      case 'current-week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = weekStart.toISOString().split('T')[0];
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        endDate = weekEnd.toISOString().split('T')[0];
        break;
        
      case 'last-week':
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
        endDate = lastWeekEnd.toISOString().split('T')[0];
        
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        startDate = lastWeekStart.toISOString().split('T')[0];
        break;
        
      case 'current-month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
        
      case 'last-month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
    }

    return { startDate, endDate };
  };

  const groupEntriesByUser = (
    entries: TimesheetEntry[],
    startDate: string,
    endDate: string
  ): ContractorSummary[] => {
    const userMap = new Map<string, ContractorSummary>();

    entries.forEach(entry => {
      if (!userMap.has(entry.userId)) {
        const userName = demoMode ? getDemoUserName(entry.userId) : entry.userId;
        const userRole = demoMode ? getDemoUserRole(entry.userId) : undefined;
        
        userMap.set(entry.userId, {
          userId: entry.userId,
          name: userName,
          role: userRole,
          totalHours: 0,
          billableAmount: 0,
          status: entry.status as any,
          periodStart: startDate,
          periodEnd: endDate,
          entries: []
        });
      }

      const summary = userMap.get(entry.userId)!;
      summary.totalHours += entry.hours;
      summary.entries.push(entry);
      
      // Calculate billable amount if rates are shown
      if (showRates) {
        const hourlyRate = demoMode ? getDemoUserRate(entry.userId) : 75;
        summary.billableAmount! += entry.hours * hourlyRate;
      }

      // Determine overall status (most restrictive)
      if (entry.status === 'submitted' && summary.status !== 'rejected') {
        summary.status = 'submitted';
      } else if (entry.status === 'draft' && summary.status === 'approved') {
        summary.status = 'draft';
      }
    });

    return Array.from(userMap.values());
  };

  // Filtered contractors
  const filteredContractors = useMemo(() => {
    return contractors.filter(contractor => {
      // Search filter
      if (searchQuery && !contractor.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && contractor.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [contractors, searchQuery, statusFilter]);

  // Selected contractors for batch actions
  const selectedContractors = useMemo(() => {
    return filteredContractors
      .filter(c => selectedIds.has(c.userId))
      .map(c => ({
        contractorId: c.userId,
        contractorName: c.name,
        hours: c.totalHours,
        amount: c.billableAmount,
        status: c.status
      }));
  }, [filteredContractors, selectedIds]);

  // Handlers
  const toggleSelection = (userId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContractors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContractors.map(c => c.userId)));
    }
  };

  const handleBatchApprove = async () => {
    setActionInProgress(true);
    try {
      // Filter to only submitted timesheets
      const toApprove = selectedContractors.filter(c => c.status === 'submitted');
      
      if (toApprove.length === 0) {
        toast.error('No submitted timesheets to approve');
        return;
      }

      if (demoMode) {
        // Demo mode: Update local state only
        setContractors(prev => prev.map(contractor => {
          if (toApprove.some(c => c.contractorId === contractor.userId)) {
            return {
              ...contractor,
              status: 'approved' as const,
              entries: contractor.entries.map(e => 
                e.status === 'submitted' ? { ...e, status: 'approved' as const } : e
              )
            };
          }
          return contractor;
        }));
      } else {
        // Real mode: Update via API
        for (const contractor of toApprove) {
          const summary = contractors.find(c => c.userId === contractor.contractorId);
          if (summary) {
            for (const entry of summary.entries) {
              if (entry.status === 'submitted') {
                await updateTimesheetEntry(entry.id, {
                  status: 'approved'
                });
              }
            }
          }
        }
        await loadContractorData();
      }

      toast.success(`Approved ${toApprove.length} timesheet${toApprove.length > 1 ? 's' : ''}`);
      
      // Clear selection
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error approving timesheets:', error);
      toast.error('Failed to approve timesheets');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleBatchReject = () => {
    setShowRejectDialog(true);
  };

  const confirmBatchReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setActionInProgress(true);
    try {
      const toReject = selectedContractors.filter(c => c.status === 'submitted');
      
      if (toReject.length === 0) {
        toast.error('No submitted timesheets to reject');
        return;
      }

      if (demoMode) {
        // Demo mode: Update local state only
        setContractors(prev => prev.map(contractor => {
          if (toReject.some(c => c.contractorId === contractor.userId)) {
            return {
              ...contractor,
              status: 'rejected' as const,
              entries: contractor.entries.map(e => 
                e.status === 'submitted' 
                  ? { 
                      ...e, 
                      status: 'rejected' as const,
                      notes: `${e.notes || ''}\n\nRejected: ${rejectionReason}`.trim()
                    } 
                  : e
              )
            };
          }
          return contractor;
        }));
      } else {
        // Real mode: Update via API
        for (const contractor of toReject) {
        const summary = contractors.find(c => c.userId === contractor.contractorId);
        if (summary) {
          for (const entry of summary.entries) {
            if (entry.status === 'submitted') {
              await updateTimesheetEntry(entry.id, {
                status: 'rejected',
                notes: `${entry.notes || ''}\n\nRejected: ${rejectionReason}`.trim()
              });
            }
          }
        }
        }
        await loadContractorData();
      }

      toast.success(`Rejected ${toReject.length} timesheet${toReject.length > 1 ? 's' : ''}`);
      
      // Clear state
      setShowRejectDialog(false);
      setRejectionReason('');
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error rejecting timesheets:', error);
      toast.error('Failed to reject timesheets');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'submitted': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-3 h-3" />;
      case 'submitted': return <Clock className="w-3 h-3" />;
      case 'rejected': return <XCircle className="w-3 h-3" />;
      default: return <FileText className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Batch Approval Bar */}
      <BatchApprovalBar
        selectedTimesheets={selectedContractors}
        showRates={showRates}
        onApproveAll={handleBatchApprove}
        onRejectAll={handleBatchReject}
        onClearSelection={handleClearSelection}
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Batch Approval</h1>
            <p className="text-muted-foreground mt-1">
              Review and approve multiple timesheets at once
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadContractorData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-1">
              <Label htmlFor="search" className="text-xs text-muted-foreground mb-2">
                Search Contractor
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <Label htmlFor="status-filter" className="text-xs text-muted-foreground mb-2">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div>
              <Label htmlFor="date-filter" className="text-xs text-muted-foreground mb-2">
                Period
              </Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger id="date-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-week">Current Week</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="current-month">Current Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick Actions */}
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                disabled={filteredContractors.length === 0}
                className="flex-1"
              >
                {selectedIds.size === filteredContractors.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(searchQuery || statusFilter !== 'all') && (
            <div className="mt-4 pt-4 border-t flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span>Active filters:</span>
              {searchQuery && (
                <Badge variant="secondary">Search: {searchQuery}</Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant="secondary">Status: {statusFilter}</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="ml-auto"
              >
                Clear filters
              </Button>
            </div>
          )}
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Contractors</p>
                <p className="text-2xl font-semibold">{filteredContractors.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Awaiting Approval</p>
                <p className="text-2xl font-semibold">
                  {filteredContractors.filter(c => c.status === 'submitted').length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-semibold">
                  {filteredContractors.filter(c => c.status === 'approved').length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-semibold">
                  {filteredContractors.reduce((sum, c) => sum + c.totalHours, 0).toFixed(1)}h
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Contractor List */}
        <div className="space-y-3">
          {loading ? (
            <Card className="p-8">
              <div className="flex items-center justify-center gap-3 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <p>Loading timesheets...</p>
              </div>
            </Card>
          ) : filteredContractors.length === 0 ? (
            <Card className="p-8">
              <div className="text-center text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No timesheets found</p>
                <p className="text-sm mt-1">
                  Try adjusting your filters or date range
                </p>
              </div>
            </Card>
          ) : (
            filteredContractors.map((contractor) => (
              <Card
                key={contractor.userId}
                className={`p-4 transition-all ${
                  selectedIds.has(contractor.userId)
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <Checkbox
                    checked={selectedIds.has(contractor.userId)}
                    onCheckedChange={() => toggleSelection(contractor.userId)}
                  />

                  {/* Contractor Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{contractor.name}</h3>
                      <Badge 
                        variant={getStatusBadgeVariant(contractor.status)}
                        className="gap-1"
                      >
                        {getStatusIcon(contractor.status)}
                        {contractor.status}
                      </Badge>
                    </div>
                    {contractor.role && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {contractor.role}
                      </p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Hours</p>
                      <p className="font-semibold">{contractor.totalHours.toFixed(1)}h</p>
                    </div>

                    {showRates && contractor.billableAmount !== undefined && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-semibold">
                          ${contractor.billableAmount.toLocaleString()}
                        </p>
                      </div>
                    )}

                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Entries</p>
                      <p className="font-semibold">{contractor.entries.length}</p>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Rejection Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Selected Timesheets</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to reject {selectedContractors.filter(c => c.status === 'submitted').length} timesheet(s). 
              Please provide a reason for rejection.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Rejection Reason *</Label>
            <Textarea
              id="rejection-reason"
              placeholder="e.g., Hours exceed approved budget, missing project details..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionInProgress}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBatchReject}
              disabled={!rejectionReason.trim() || actionInProgress}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionInProgress ? 'Rejecting...' : 'Reject Timesheets'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
