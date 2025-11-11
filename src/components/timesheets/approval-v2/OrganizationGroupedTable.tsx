import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Users, Building2, FileText, MoreVertical, Eye, CheckCircle, XCircle, Download, MessageSquare, History, Network } from 'lucide-react';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Badge } from '../../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';

// Import types from centralized location
import type {
  ProjectContract,
  TimesheetPeriod,
  ApprovalStatus,
} from '../../../types';

// Import the nested data structure type
import type { OrganizationWithData } from '../../../utils/api/timesheets-approval-hooks';

// Import aggregation utilities
import {
  aggregatePeriodsIntoMonths,
  getMonthDateRange,
  formatMonth,
  type MonthlyPeriodSummary
} from './period-aggregation';

interface OrganizationGroupedTableProps {
  organizations: OrganizationWithData[]; // Organizations with nested contracts and periods
  selectedContracts: Set<string>; // NOW: Contract IDs instead of period IDs
  onToggleContract: (contractId: string) => void; // NEW: Toggle single contract
  onToggleOrganization: (contractIds: string[]) => void; // NEW: Toggle all contracts in org
  onOpenDrawer?: (period: TimesheetPeriod, contract: ProjectContract) => void;
  onQuickApprove?: (periodId: string, contractId: string) => void;
  onQuickReject?: (periodId: string, contractId: string) => void;
  onViewInGraph?: (userId: string, submittedAt?: string) => void; // NEW: Deep link to graph
  viewMode?: 'month' | 'week'; // NEW: Control whether to show monthly or weekly periods
  filterPeriodStart?: Date; // NEW: Filter to only show periods within this range
  filterPeriodEnd?: Date; // NEW: Filter to only show periods within this range
}

export function OrganizationGroupedTable({
  organizations,
  selectedContracts,
  onToggleContract,
  onToggleOrganization,
  onOpenDrawer,
  onQuickApprove,
  onQuickReject,
  onViewInGraph,
  viewMode = 'week', // DEFAULT: Show weekly periods
  filterPeriodStart,
  filterPeriodEnd,
}: OrganizationGroupedTableProps) {
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(
    new Set(organizations.map(o => o.id))
  );

  // Safety check: ensure selectedContracts is a Set
  const safeSelectedContracts = selectedContracts || new Set<string>();
  
  // Wrapper with logging to debug
  const safeOnToggleOrganization = (contractIds: string[]) => {
    console.log('🔴 safeOnToggleOrganization WRAPPER called with:', contractIds.length, 'contract IDs');
    console.log('🔴 onToggleOrganization type check:', typeof onToggleOrganization);
    
    if (typeof onToggleOrganization === 'function') {
      console.log('🔴 Calling parent onToggleOrganization...');
      console.warn('⚠️⚠️⚠️ ABOUT TO CALL PARENT WITH CONTRACT IDS:', contractIds);
      onToggleOrganization(contractIds);
      console.warn('⚠️⚠️⚠️ PARENT CALL COMPLETED');
      console.log('🔴 Parent onToggleOrganization called successfully');
    } else {
      console.error('❌ onToggleOrganization is not a function! Received:', typeof onToggleOrganization);
      console.error('Contract IDs that would have been toggled:', contractIds);
    }
  };
  
  // Log to verify the handler is a function
  console.log('🟣 OrganizationGroupedTable: onToggleOrganization type:', typeof onToggleOrganization);
  console.log('🟣 OrganizationGroupedTable: safeOnToggleOrganization type:', typeof safeOnToggleOrganization);

  // Use whichever handler is provided
  const handlePeriodClick = onOpenDrawer;
  
  // Add logging wrapper
  const handlePeriodClickWithLog = (period: TimesheetPeriod, contract: ProjectContract) => {
    console.log('🟡 OrganizationGroupedTable: handlePeriodClickWithLog called', {
      period,
      contract,
      handlePeriodClick: typeof handlePeriodClick,
      onOpenDrawer: typeof onOpenDrawer,
    });
    
    if (handlePeriodClick) {
      handlePeriodClick(period, contract);
    } else {
      console.error('❌ handlePeriodClick is undefined!');
    }
  };

  const toggleOrg = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    const variants: Record<ApprovalStatus, { variant: any; label: string }> = {
      pending: { variant: 'outline', label: 'Pending' },
      approved: { variant: 'default', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      changes_requested: { variant: 'secondary', label: 'Changes Requested' },
    };
    
    const config = variants[status];
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatContractRate = (contract: ProjectContract) => {
    if (contract.hideRate) return 'Hidden';
    
    switch (contract.contractType) {
      case 'hourly':
        return contract.hourlyRate ? `$${contract.hourlyRate}/hr` : 'Not set';
      case 'daily':
        return contract.dailyRate ? `$${contract.dailyRate}/day` : 'Not set';
      case 'fixed':
        return contract.fixedAmount ? `$${contract.fixedAmount.toLocaleString()}` : 'Not set';
      default:
        return 'Custom';
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {organizations.map(org => {
        // Safety check: ensure contracts array exists
        const contracts = org.contracts || [];
        
        // Filter contracts to only those with periods in the selected date range
        const visibleContracts = contracts.filter(contract => {
          const periods = contract.periods || [];
          const filteredPeriods = periods.filter(period => {
            if (!filterPeriodStart || !filterPeriodEnd) {
              return true; // No filter, show all
            }
            
            const periodStart = new Date(period.weekStartDate);
            const periodEnd = new Date(period.weekEndDate);
            
            // Only show periods that START within the selected month
            return periodStart >= filterPeriodStart && periodStart <= filterPeriodEnd;
          });
          
          return filteredPeriods.length > 0;
        });
        
        // Get all periods from visible contracts only
        const allPeriods = visibleContracts.flatMap(c => {
          const periods = c.periods || [];
          return periods.filter(period => {
            if (!filterPeriodStart || !filterPeriodEnd) {
              return true;
            }
            const periodStart = new Date(period.weekStartDate);
            return periodStart >= filterPeriodStart && periodStart <= filterPeriodEnd;
          });
        });
        
        const isExpanded = expandedOrgs.has(org.id);
        
        const allContractIds = visibleContracts.map(c => c.id);
        const allSelected = allContractIds.length > 0 && allContractIds.every(id => safeSelectedContracts.has(id));
        const someSelected = allContractIds.some(id => safeSelectedContracts.has(id)) && !allSelected;

        const pendingCount = allPeriods.filter(p => p.status === 'pending').length;
        const approvedCount = allPeriods.filter(p => p.status === 'approved').length;
        const rejectedCount = allPeriods.filter(p => p.status === 'rejected').length;

        // Skip organizations with no visible contracts in the selected date range
        if (visibleContracts.length === 0) {
          return null;
        }

        return (
          <div key={org.id} className="border-b last:border-b-0">
            {/* Organization Header */}
            <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition-colors">
              <Checkbox
                checked={someSelected && !allSelected ? "indeterminate" : allSelected}
                onCheckedChange={(checked) => {
                  console.log('✅ Org checkbox clicked:', org.name, 'checked:', checked);
                  safeOnToggleOrganization(allContractIds);
                }}
              />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleOrg(org.id)}
                className="p-0 h-auto hover:bg-transparent"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </Button>

              {org.type === 'freelancer' ? (
                <Users className="h-5 w-5 text-blue-600" />
              ) : (
                <Building2 className="h-5 w-5 text-purple-600" />
              )}

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{org.logo} {org.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {visibleContracts.length} {visibleContracts.length === 1 ? 'person' : 'people'}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                {pendingCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    <span className="text-gray-600">{pendingCount} pending</span>
                  </div>
                )}
                {approvedCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-gray-600">{approvedCount} approved</span>
                  </div>
                )}
                {rejectedCount > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-gray-600">{rejectedCount} rejected</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contracts and Periods (when expanded) */}
            {isExpanded && (
              <div className="divide-y">
                {contracts.map(contract => {
                  const periods = contract.periods || [];
                  
                  // FILTER periods based on the selected date range
                  const filteredPeriods = periods.filter(period => {
                    if (!filterPeriodStart || !filterPeriodEnd) {
                      return true; // No filter, show all
                    }
                    
                    const periodStart = new Date(period.weekStartDate);
                    const periodEnd = new Date(period.weekEndDate);
                    
                    // Only show periods that START within the selected month
                    // This prevents September periods from showing in October view
                    return periodStart >= filterPeriodStart && periodStart <= filterPeriodEnd;
                  });
                  
                  if (filteredPeriods.length === 0) {
                    return null; // Skip contracts with no periods in the selected range
                  }
                  
                  // Calculate contract-level checkbox state
                  const isContractSelected = safeSelectedContracts.has(contract.id);

                  return (
                    <div key={contract.id} className="bg-white">
                      {/* Contract Header */}
                      <div className="bg-gray-25 px-4 py-2 flex items-center gap-3 border-t border-gray-100">
                        <Checkbox
                          checked={isContractSelected}
                          onCheckedChange={() => {
                            console.log('✅ Contract checkbox clicked:', contract.userName);
                            onToggleContract(contract.id);
                          }}
                        />
                        <div className="w-4" /> {/* Spacer for chevron alignment */}
                        <FileText className="h-4 w-4 text-gray-400" />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">
                              {contract.userName}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {contract.userRole?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {contract.projectName} • {formatContractRate(contract)}
                          </div>
                        </div>

                        <div className="text-xs text-gray-500">
                          {filteredPeriods.length} {filteredPeriods.length === 1 ? 'period' : 'periods'}
                        </div>
                      </div>

                      {/* Periods */}
                      <div className="divide-y">
                        {viewMode === 'month' ? (
                          // Monthly view - NO checkboxes on month rows, only at contract level
                          aggregatePeriodsIntoMonths(filteredPeriods).map(monthSummary => {
                            const monthlyPeriods = monthSummary.periods;
                            const monthDateRange = getMonthDateRange(monthSummary.month, monthSummary.year);
                            const monthLabel = formatMonth(monthSummary.month, monthSummary.year);

                            return (
                              <div key={`${monthSummary.month}-${monthSummary.year}`} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group cursor-pointer"
                                onClick={() => handlePeriodClickWithLog(monthlyPeriods[0], contract)}
                              >
                                {/* NO checkbox in monthly view */}
                                <div className="w-5" /> {/* Spacer where checkbox would be */}
                                <div className="w-4" /> {/* Spacer for chevron */}
                                <div className="w-4" /> {/* Spacer */}
                                
                                <div 
                                  className="flex-1 grid grid-cols-5 gap-4 items-center cursor-pointer"
                                  onClick={() => handlePeriodClickWithLog(monthlyPeriods[0], contract)}
                                >
                                  {/* Month Range */}
                                  <div className="col-span-1">
                                    <div className="text-sm font-medium text-gray-900">
                                      {monthDateRange}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {monthLabel}
                                    </div>
                                  </div>

                                  {/* Hours/Days */}
                                  <div className="col-span-1">
                                    <div className="text-sm text-gray-900">
                                      {monthlyPeriods.reduce((total, p) => total + (p.totalHours || 0), 0)}h
                                    </div>
                                    {monthlyPeriods.some(p => p.totalDays) && (
                                      <div className="text-xs text-gray-500">
                                        {monthlyPeriods.reduce((total, p) => total + (p.totalDays || 0), 0)} days
                                      </div>
                                    )}
                                  </div>

                                  {/* Amount */}
                                  <div className="col-span-1">
                                    {monthlyPeriods.some(p => p.totalAmount && !contract.hideRate) ? (
                                      <div className="text-sm font-medium text-gray-900">
                                        ${monthlyPeriods.reduce((total, p) => total + (p.totalAmount || 0), 0).toLocaleString()}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-gray-400">-</div>
                                    )}
                                  </div>

                                  {/* Status */}
                                  <div className="col-span-1">
                                    {getStatusBadge(monthlyPeriods[0].status)}
                                  </div>

                                  {/* Flags/Notes */}
                                  <div className="col-span-1 flex items-center gap-2 justify-end">
                                    {monthlyPeriods.some(p => p.reviewFlags && p.reviewFlags.length > 0) && (
                                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                        {monthlyPeriods.reduce((total, p) => total + (p.reviewFlags?.length || 0), 0)} {monthlyPeriods.reduce((total, p) => total + (p.reviewFlags?.length || 0), 0) === 1 ? 'flag' : 'flags'}
                                      </Badge>
                                    )}
                                    {monthlyPeriods.some(p => p.attachments && p.attachments.length > 0) && (
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        {monthlyPeriods.reduce((total, p) => total + (p.attachments?.length || 0), 0)} {monthlyPeriods.reduce((total, p) => total + (p.attachments?.length || 0), 0) === 1 ? 'file' : 'files'}
                                      </Badge>
                                    )}
                                    {monthlyPeriods.some(p => p.contractorNotes) && (
                                      <Badge variant="outline" className="text-xs bg-gray-50">
                                        Note
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Actions Menu */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                      <span className="sr-only">Open menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={(e) => {
                                      console.log('🟠 View Details menu item clicked!');
                                      e.stopPropagation();
                                      handlePeriodClickWithLog(monthlyPeriods[0], contract);
                                    }}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      onViewInGraph?.(contract.userId, monthlyPeriods[0].submittedAt);
                                    }}>
                                      <Network className="mr-2 h-4 w-4" />
                                      View on graph
                                    </DropdownMenuItem>
                                    
                                    {monthlyPeriods[0].status === 'pending' && (
                                      <>
                                        <DropdownMenuItem 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onQuickApprove?.(monthlyPeriods[0].id, contract.id);
                                          }}
                                          className="text-green-600"
                                        >
                                          <CheckCircle className="mr-2 h-4 w-4" />
                                          Quick Approve
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onQuickReject?.(monthlyPeriods[0].id, contract.id);
                                          }}
                                          className="text-red-600"
                                        >
                                          <XCircle className="mr-2 h-4 w-4" />
                                          Request Changes
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    
                                    <DropdownMenuSeparator />
                                    
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('Download PDF for period:', monthlyPeriods[0].id);
                                    }}>
                                      <Download className="mr-2 h-4 w-4" />
                                      Download PDF
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('Add comment for period:', monthlyPeriods[0].id);
                                    }}>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Add Comment
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('View history for period:', monthlyPeriods[0].id);
                                    }}>
                                      <History className="mr-2 h-4 w-4" />
                                      View History
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            );
                          })
                        ) : (
                          // Weekly view - NO individual period checkboxes, only contract checkbox above
                          filteredPeriods.map(period => {
                            return (
                              <div
                                key={period.id}
                                className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group"
                              >
                                {/* NO checkbox in weekly view - selection is at contract level */}
                                <div className="w-5" /> {/* Spacer where checkbox would be */}
                                <div className="w-4" /> {/* Spacer for chevron */}
                                <div className="w-4" /> {/* Spacer */}
                                
                                <div 
                                  className="flex-1 grid grid-cols-5 gap-4 items-center cursor-pointer"
                                  onClick={() => handlePeriodClickWithLog(period, contract)}
                                >
                                  {/* Week Range */}
                                  <div className="col-span-1">
                                    <div className="text-sm font-medium text-gray-900">
                                      {formatDate(period.weekStartDate)} - {formatDate(period.weekEndDate)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Week {new Date(period.weekStartDate).toLocaleDateString('en-US', { 
                                        year: 'numeric', 
                                        month: 'short' 
                                      })}
                                    </div>
                                  </div>

                                  {/* Hours/Days */}
                                  <div className="col-span-1">
                                    <div className="text-sm text-gray-900">
                                      {period.totalHours || 0}h
                                    </div>
                                    {period.totalDays && (
                                      <div className="text-xs text-gray-500">
                                        {period.totalDays} days
                                      </div>
                                    )}
                                  </div>

                                  {/* Amount */}
                                  <div className="col-span-1">
                                    {period.totalAmount && !contract.hideRate ? (
                                      <div className="text-sm font-medium text-gray-900">
                                        ${period.totalAmount.toLocaleString()}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-gray-400">-</div>
                                    )}
                                  </div>

                                  {/* Status */}
                                  <div className="col-span-1">
                                    {getStatusBadge(period.status)}
                                  </div>

                                  {/* Flags/Notes */}
                                  <div className="col-span-1 flex items-center gap-2 justify-end">
                                    {period.reviewFlags && period.reviewFlags.length > 0 && (
                                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                        {period.reviewFlags.length} {period.reviewFlags.length === 1 ? 'flag' : 'flags'}
                                      </Badge>
                                    )}
                                    {period.attachments && period.attachments.length > 0 && (
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        {period.attachments.length} {period.attachments.length === 1 ? 'file' : 'files'}
                                      </Badge>
                                    )}
                                    {period.contractorNotes && (
                                      <Badge variant="outline" className="text-xs bg-gray-50">
                                        Note
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Actions Menu */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                      <span className="sr-only">Open menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={(e) => {
                                      console.log('🟠 View Details menu item clicked!');
                                      e.stopPropagation();
                                      handlePeriodClickWithLog(period, contract);
                                    }}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      onViewInGraph?.(contract.userId, period.submittedAt);
                                    }}>
                                      <Network className="mr-2 h-4 w-4" />
                                      View on graph
                                    </DropdownMenuItem>
                                    
                                    {period.status === 'pending' && (
                                      <>
                                        <DropdownMenuItem 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onQuickApprove?.(period.id, contract.id);
                                          }}
                                          className="text-green-600"
                                        >
                                          <CheckCircle className="mr-2 h-4 w-4" />
                                          Quick Approve
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onQuickReject?.(period.id, contract.id);
                                          }}
                                          className="text-red-600"
                                        >
                                          <XCircle className="mr-2 h-4 w-4" />
                                          Request Changes
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    
                                    <DropdownMenuSeparator />
                                    
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('Download PDF for period:', period.id);
                                    }}>
                                      <Download className="mr-2 h-4 w-4" />
                                      Download PDF
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('Add comment for period:', period.id);
                                    }}>
                                      <MessageSquare className="mr-2 h-4 w-4" />
                                      Add Comment
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={(e) => {
                                      e.stopPropagation();
                                      console.log('View history for period:', period.id);
                                    }}>
                                      <History className="mr-2 h-4 w-4" />
                                      View History
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Empty State */}
      {organizations.length === 0 && (
        <div className="px-4 py-12 text-center text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-sm mb-2">No timesheets match the selected filters</p>
          <p className="text-xs text-muted-foreground">
            Once contractors submit timesheets, you'll see them here with approval options
          </p>
        </div>
      )}
    </div>
  );
}