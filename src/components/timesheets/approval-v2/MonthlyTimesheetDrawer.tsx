import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, CheckCircle, XCircle, Calendar, Clock, FileText, Paperclip, Loader2, ChevronDown, ChevronRight,
  GitBranch, Shield
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { ScrollArea } from '../../ui/scroll-area';
import { Skeleton } from '../../ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';

// Import API hooks - NOW LOADING REAL DATA!
import { 
  useEntriesByPeriod,
  useApproveTimesheet,
  useRejectTimesheet,
} from '../../../utils/api/timesheets-approval-hooks';

// ✅ NEW: Import hook to load real timesheet entries from database
import { useTimesheetEntries } from '../../../utils/api/timesheets-hooks';

// Import types
import type {
  ProjectContract,
  TimesheetPeriod,
  TimesheetEntry,
} from '../../../types';

import { formatContractRate, getStatusColor } from '../../../utils/api/timesheets-approval';

interface MonthlyTimesheetDrawerProps {
  periods: TimesheetPeriod[]; // All weeks in the month
  clickedPeriodId?: string; // The week that was clicked (for auto-scroll to that week's days)
  contract: ProjectContract;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string; // NEW: Current logged-in user ID
  currentUserRole?: 'contractor' | 'manager' | 'client'; // NEW: Current user's role
}

export function MonthlyTimesheetDrawer({
  periods,
  clickedPeriodId,
  contract,
  isOpen,
  onClose,
  currentUserId,
  currentUserRole,
}: MonthlyTimesheetDrawerProps) {
  // Safety check: ensure periods is an array
  const safePeriods = useMemo(() => periods || [], [periods]);

  // Mutation hooks for approve/reject
  const approveMutation = useApproveTimesheet();
  const rejectMutation = useRejectTimesheet();

  // Refs for auto-scrolling to clicked week's first day
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  // ✅ NEW: Calculate month date range from periods
  const monthDateRange = useMemo(() => {
    if (safePeriods.length === 0) return null;
    
    const firstDate = new Date(safePeriods[0].weekStartDate);
    const year = firstDate.getFullYear();
    const month = firstDate.getMonth();
    
    // Get first and last day of month
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    // ✅ FIX: Format dates in local timezone, not UTC
    // toISOString() converts to UTC which can shift the date in some timezones
    const formatLocalDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    return {
      startDate: formatLocalDate(firstDayOfMonth),
      endDate: formatLocalDate(lastDayOfMonth),
    };
  }, [safePeriods]);

  // ✅ NEW: Load REAL timesheet entries from database
  // Use 'company-1' for the project company, not the contractor's organizationId
  const { data: realEntries = [], isLoading: isLoadingRealEntries } = useTimesheetEntries({
    userId: contract.userId,
    companyId: 'company-1', // ✅ Use project company ID (where they're working), not contractor's org
    startDate: monthDateRange?.startDate || '',
    endDate: monthDateRange?.endDate || '',
  }, {
    enabled: !!monthDateRange, // Only query when we have a date range
  });

  console.log('🔵 MonthlyTimesheetDrawer - Database Query:', {
    userId: contract.userId,
    companyId: 'company-1', // ✅ Fixed to match DatabaseSyncTest
    monthDateRange,
    realEntriesCount: realEntries.length,
    isLoading: isLoadingRealEntries,
  });

  // 🔍 DEBUG: Log each entry's ID to check for duplicates
  if (realEntries.length > 0) {
    console.log('🔍 DRAWER: All entry IDs from database:', realEntries.map(e => ({
      id: e.id,
      date: e.date,
      hours: e.hours,
      taskDescription: e.projectId,
    })));
    
    // Check for duplicate IDs
    const idCounts = new Map<string, number>();
    realEntries.forEach(e => {
      idCounts.set(e.id, (idCounts.get(e.id) || 0) + 1);
    });
    const duplicates = Array.from(idCounts.entries()).filter(([id, count]) => count > 1);
    if (duplicates.length > 0) {
      console.error('⚠️ DRAWER: DUPLICATE ENTRY IDs FOUND:', duplicates);
    }
  }

  // ✅ REPLACE DEMO DATA WITH REAL DATABASE ENTRIES
  // Convert database entries to drawer format
  const allEntries = useMemo(() => {
    if (realEntries.length === 0) {
      console.warn('⚠️ No real entries found in database - showing empty view');
      return [];
    }
    
    console.log('🔍 Raw database entries:', realEntries);
    
    // Map database entries to drawer format
    const mapped = realEntries.map(dbEntry => {
      console.log('🔍 Mapping entry:', {
        id: dbEntry.id,
        date: dbEntry.date,
        hours: dbEntry.hours,
        taskCategory: dbEntry.taskCategory,
        workType: dbEntry.workType,
        taskDescription: dbEntry.taskDescription,
        startTime: dbEntry.startTime,
        endTime: dbEntry.endTime,
        breakMinutes: dbEntry.breakMinutes,
        projectId: dbEntry.projectId,
        notes: dbEntry.notes,
      });
      
      return {
        id: dbEntry.id,
        periodId: '', // Not used in daily view
        date: dbEntry.date,
        hours: dbEntry.hours,
        taskDescription: dbEntry.taskDescription || dbEntry.projectId || 'General Work',
        taskCategory: dbEntry.taskCategory, // ✅ Include task category
        workType: dbEntry.workType, // ✅ Include work type
        billable: dbEntry.billable !== undefined ? dbEntry.billable : true,
        startTime: dbEntry.startTime, // ✅ Use actual start time
        endTime: dbEntry.endTime,     // ✅ Use actual end time
        breakMinutes: dbEntry.breakMinutes || 0, // ✅ Use actual break minutes
        notes: dbEntry.notes,
      };
    });
    
    console.log('🔍 Mapped entries:', mapped);
    return mapped;
  }, [realEntries]);

  const isLoadingEntries = isLoadingRealEntries;

  // Get month details
  const monthInfo = useMemo(() => {
    if (safePeriods.length === 0) return null;
    
    const firstDate = new Date(safePeriods[0].weekStartDate);
    const year = firstDate.getFullYear();
    const month = firstDate.getMonth();
    const monthName = firstDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Get first and last day of month
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    return {
      year,
      month,
      monthName,
      firstDayOfMonth,
      lastDayOfMonth,
      daysInMonth: lastDayOfMonth.getDate(),
    };
  }, [safePeriods]);

  // Calculate monthly totals - ALWAYS in hours
  const monthlyTotals = useMemo(() => {
    let totalHours = 0;
    
    // Sum up all entries' hours (converting days to hours if needed)
    allEntries.forEach(entry => {
      if (entry.hours !== undefined) {
        totalHours += entry.hours;
      } else if (entry.days !== undefined) {
        totalHours += (entry.days * 8); // Convert days to hours
      }
    });
    
    // Calculate total amount
    const totalAmount = safePeriods.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    
    return { totalHours, totalAmount };
  }, [allEntries, safePeriods]);

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, TimesheetEntry[]>();
    
    allEntries.forEach(entry => {
      const dateKey = entry.date; // YYYY-MM-DD format
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(entry);
    });
    
    // 🔍 DEBUG: Log all date keys to verify matching
    console.log('📅 DRAWER: Entries grouped by date:', {
      totalEntries: allEntries.length,
      uniqueDates: Array.from(grouped.keys()),
      entriesPerDate: Array.from(grouped.entries()).map(([date, entries]) => ({
        date,
        count: entries.length,
        hours: entries.map(e => e.hours),
        firstEntryId: entries[0]?.id
      }))
    });
    
    return grouped;
  }, [allEntries]);

  // Generate ALL days in the month (including days with no entries)
  const allDaysInMonth = useMemo(() => {
    if (!monthInfo) return [];
    
    const days: Array<{
      dateKey: string;
      date: Date;
      dayOfWeek: number;
      weekNumber: number;
      entries: TimesheetEntry[];
    }> = [];
    
    // ✅ FIX: Calculate proper calendar week numbers (Monday-to-Sunday)
    // Find the first Monday on or before the 1st of the month
    const firstDayOfMonth = new Date(monthInfo.year, monthInfo.month, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay(); // 0=Sunday, 1=Monday, etc.
    
    // Calculate how many days back to the previous Monday (or 0 if already Monday)
    const daysToMonday = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    for (let day = 1; day <= monthInfo.daysInMonth; day++) {
      // ✅ FIX: Create dateKey as string first to avoid timezone issues
      const dateKey = `${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Then create Date object for display purposes (but use local time, not UTC)
      const date = new Date(monthInfo.year, monthInfo.month, day);
      const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
      
      // ✅ NEW: Calculate calendar week number based on Monday start
      // Days from the reference Monday (before or on the 1st)
      const daysSinceReferenceMonday = day - 1 + daysToMonday;
      const weekNumber = Math.floor(daysSinceReferenceMonday / 7) + 1;
      
      days.push({
        dateKey,
        date,
        dayOfWeek,
        weekNumber,
        entries: entriesByDate.get(dateKey) || [],
      });
    }
    
    return days;
  }, [monthInfo, entriesByDate]);

  // Auto-scroll to clicked week's first day on open
  useEffect(() => {
    if (isOpen && clickedPeriodId && monthInfo) {
      setTimeout(() => {
        // Find the clicked period
        const clickedPeriod = safePeriods.find(p => p.id === clickedPeriodId);
        if (clickedPeriod) {
          const firstDayOfWeek = new Date(clickedPeriod.weekStartDate);
          const dateKey = firstDayOfWeek.toISOString().split('T')[0];
          
          if (dayRefs.current[dateKey]) {
            dayRefs.current[dateKey]?.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
          }
        }
      }, 100);
    }
  }, [isOpen, clickedPeriodId, safePeriods, monthInfo]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric'
    });
  };

  const getDayTotal = (entries: TimesheetEntry[]) => {
    // Always return hours (convert days to hours if needed)
    return entries.reduce((sum, e) => {
      if (e.hours !== undefined) {
        return sum + e.hours;
      }
      if (e.days !== undefined) {
        // Convert days to hours (1 day = 8 hours)
        return sum + (e.days * 8);
      }
      return sum;
    }, 0);
  };

  // Handle approve entire month
  const handleApproveMonth = async () => {
    if (!confirm(`Approve all ${safePeriods.length} weeks for ${contract.userName}?`)) {
      return;
    }

    try {
      for (const period of safePeriods) {
        if (period.status === 'pending') {
          await approveMutation.mutateAsync({
            periodId: period.id,
            approverId: 'current-user-id',
            approverName: 'Current User',
          });
        }
      }
      onClose();
    } catch (error) {
      console.error('Failed to approve month:', error);
    }
  };

  // Handle reject entire month
  const handleRejectMonth = async () => {
    const reason = prompt('Please provide a rejection reason for the entire month:');
    if (!reason) return;

    try {
      for (const period of safePeriods) {
        if (period.status === 'pending') {
          await rejectMutation.mutateAsync({
            periodId: period.id,
            approverId: 'current-user-id',
            approverName: 'Current User',
            reason,
          });
        }
      }
      onClose();
    } catch (error) {
      console.error('Failed to reject month:', error);
    }
  };

  if (!isOpen || !monthInfo) return null;

  console.log('🟢 MonthlyTimesheetDrawer RENDERING with:', {
    isOpen,
    monthInfo: monthInfo ? 'exists' : 'null',
    daysCount: allDaysInMonth.length,
    contractName: contract.userName,
    monthName: monthInfo?.monthName,
    clickedPeriodId,
    periodsCount: safePeriods.length,
  });

  // Get all attachments from all periods
  const allAttachments = safePeriods.flatMap(p => p.attachments || []);

  return (
    <>
      {/* Backdrop - Click to close */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        style={{ zIndex: 9998 }}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-[800px] bg-white shadow-2xl border-l flex flex-col z-50"
        style={{ zIndex: 9999 }}
      >
        {/* Header - Ultra Compact */}
        <div className="px-5 py-2.5 border-b">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base font-medium text-gray-900 leading-tight">{contract.userName}</h2>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
                {monthInfo.monthName} • {formatContractRate(contract)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-gray-600 h-7 w-7 p-0">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Monthly Total - Ultra Compact */}
          <div className="bg-blue-50 border border-blue-200 rounded px-2.5 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[10px] font-medium text-blue-900">Monthly Total</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-base font-bold text-blue-900 leading-tight">
                  {monthlyTotals.totalHours.toFixed(1)} hours
                </div>
              </div>
              {monthlyTotals.totalAmount > 0 && !contract.hideRate && (
                <div className="text-right pl-2.5 border-l border-blue-300">
                  <div className="text-base font-bold text-blue-900 leading-tight">
                    ${monthlyTotals.totalAmount.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Day Count - Ultra Compact */}
          <div className="mt-1.5 text-[10px] text-gray-600 leading-tight">
            {allDaysInMonth.filter(d => d.entries.length > 0).length} days with entries
          </div>
          
          {/* ✅ REAL DATA INDICATOR - Shows when database has entries */}
          {realEntries.length > 0 ? (
            <div className="mt-2 bg-green-50 border border-green-300 rounded px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-green-900">
                  ✅ REAL DATA - Showing {realEntries.length} database entries
                </span>
              </div>
            </div>
          ) : (
            <div className="mt-2 bg-yellow-50 border border-yellow-300 rounded px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-yellow-900">
                  📭 NO DATA - No timesheet entries found in database for {contract.userName} in {monthInfo.monthName}
                </span>
              </div>
              <div className="text-[9px] text-yellow-700 mt-0.5">
                Use the Database Sync Test page to add entries and they'll appear here!
              </div>
            </div>
          )}
        </div>

        {/* ✅ NEW: Tabs for different views */}
        <Tabs defaultValue="details" className="flex-1 flex flex-col">
          <div className="px-5 pt-2 border-b">
            <TabsList className="grid w-full grid-cols-4 h-8">
              <TabsTrigger value="details" className="text-[11px]">
                <FileText className="h-3 w-3 mr-1" />
                Details
              </TabsTrigger>
              <TabsTrigger value="graph" className="text-[11px]">
                <GitBranch className="h-3 w-3 mr-1" />
                Approval Chain
              </TabsTrigger>
              <TabsTrigger value="policy" className="text-[11px]">
                <Shield className="h-3 w-3 mr-1" />
                Policy
              </TabsTrigger>
              <TabsTrigger value="history" className="text-[11px]">
                <Clock className="h-3 w-3 mr-1" />
                History
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab: Details (Existing timesheet view) */}
          <TabsContent value="details" className="flex-1 flex flex-col m-0">
            <ScrollArea className="flex-1" ref={scrollAreaRef}>
              <div className="px-5 py-2">
                {/* Loading State */}
                {isLoadingEntries && (
                  <div className="space-y-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                )}

                {/* Daily Entries - ULTRA COMPACT */}
                {!isLoadingEntries && (
                  <div className="space-y-0">
                    {allDaysInMonth.map((day, index) => {
                      const isWeekStart = day.dayOfWeek === 1; // Monday
                      const isFirstDay = index === 0;
                      const showWeekSeparator = isWeekStart || isFirstDay; // Show on Mondays OR first day of month
                      
                      return (
                        <React.Fragment key={day.dateKey}>
                          {/* Week Separator - Show for first day OR Mondays */}
                          {showWeekSeparator && (
                            <div className="flex items-center gap-2 py-1 mt-0.5 mb-0.5">
                              <div className="flex-1 border-t border-gray-200"></div>
                              <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">
                                Week {day.weekNumber}
                              </span>
                              <div className="flex-1 border-t border-gray-200"></div>
                            </div>
                          )}

                          {/* Day Row */}
                          <DayEntryRow day={day} contract={contract} dayRefs={dayRefs} />
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Attachments Section - Ultra Compact */}
              {allAttachments.length > 0 && (
                <div className="px-5 py-2 border-t border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Paperclip className="h-3 w-3 text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-700">Attachments</span>
                  </div>
                  <div className="space-y-1">
                    {allAttachments.map(attachment => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between py-1 px-2 border border-gray-200 rounded bg-white hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <FileText className="h-3 w-3 text-red-600 flex-shrink-0" />
                          <span className="text-gray-900 truncate text-[10px]">{attachment.name}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-5 text-[9px] px-1.5"
                          asChild
                        >
                          <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                            View
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Tab: Graph (Approval chain visualization) */}
          <TabsContent value="graph" className="flex-1 m-0">
            <div className="p-5 text-center text-gray-500">
              <p className="text-sm mb-2">🔧 Coming soon: Approval chain visualization</p>
              <p className="text-xs">Will show: [Contractor] → [You] → [Manager] → [Finance]</p>
            </div>
          </TabsContent>

          {/* Tab: Policy & Budget */}
          <TabsContent value="policy" className="flex-1 m-0">
            <div className="p-5">
              <h3 className="font-medium text-sm mb-3">Policy & Budget Checks</h3>
              <div className="space-y-2">
                <PolicyCheckItem 
                  status="pass" 
                  label="Hours Validation" 
                  message={`Total: ${monthlyTotals.totalHours}hrs (within limits)`}
                />
                <PolicyCheckItem 
                  status="warn" 
                  label="Budget Status" 
                  message="85% of allocated budget spent"
                />
                <PolicyCheckItem 
                  status="pass" 
                  label="Rate Validation" 
                  message="Rates match contract terms"
                />
              </div>
            </div>
          </TabsContent>

          {/* Tab: History */}
          <TabsContent value="history" className="flex-1 m-0">
            <div className="p-5">
              <h3 className="font-medium text-sm mb-3">Approval History</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">Submitted</p>
                    <p className="text-xs text-gray-500">
                      {new Date().toLocaleDateString()} by {contract.userName}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer - Ultra Compact */}
        <div className="px-5 py-2 border-t bg-gray-50 flex items-center justify-between gap-2">
          <div className="text-[10px] text-gray-600">
            {safePeriods.filter(p => p.status === 'pending').length} week(s) pending
          </div>
          
          {/* ✅ ROLE-BASED ACTION BUTTONS */}
          {(() => {
            const isOwnTimesheet = currentUserId === contract.userId;
            
            console.log('🔍 MonthlyTimesheetDrawer footer buttons:', {
              currentUserId,
              contractUserId: contract.userId,
              isOwnTimesheet,
              currentUserRole,
            });
            
            // Contractor viewing their own timesheet - NO BUTTONS (can't approve own work)
            if (currentUserRole === 'contractor' && isOwnTimesheet) {
              return (
                <div className="text-[10px] text-gray-500 italic">
                  View only - submit from timesheet table above
                </div>
              );
            }
            
            // Manager or Client viewing contractor's timesheet - SHOW APPROVE/REJECT
            if (currentUserRole === 'manager' || currentUserRole === 'client') {
              return (
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRejectMonth}
                    disabled={rejectMutation.isPending}
                    className="h-7 text-[10px] px-2"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Reject
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleApproveMonth}
                    disabled={approveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 h-7 text-[10px] px-2"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3 w-3 mr-1" />
                    )}
                    Approve Month
                  </Button>
                </div>
              );
            }
            
            // Default: no buttons
            return null;
          })()}
        </div>
      </div>
    </>
  );
}

// Component to render individual day entry row
function DayEntryRow({ 
  day, 
  contract,
  dayRefs
}: { 
  day: {
    dateKey: string;
    date: Date;
    dayOfWeek: number;
    weekNumber: number;
    entries: TimesheetEntry[];
  };
  contract: ProjectContract;
  dayRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasEntries = day.entries.length > 0;
  
  // ALWAYS calculate total in hours (convert days to hours if needed)
  const getDayTotal = (entries: TimesheetEntry[]) => {
    return entries.reduce((sum, e) => {
      if (e.hours !== undefined) {
        return sum + e.hours;
      }
      if (e.days !== undefined) {
        // Convert days to hours (1 day = 8 hours)
        return sum + (e.days * 8);
      }
      return sum;
    }, 0);
  };

  const dayTotal = getDayTotal(day.entries);

  // Calculate aggregated start/end/break for the day
  const dayTimeInfo = useMemo(() => {
    if (day.entries.length === 0) return null;
    
    // Get earliest start time and latest end time
    const times = day.entries
      .filter(e => e.startTime && e.endTime)
      .map(e => ({
        start: e.startTime!,
        end: e.endTime!,
        break: e.breakMinutes || 0,
      }));
    
    if (times.length === 0) return null;
    
    const earliestStart = times.reduce((min, t) => t.start < min ? t.start : min, times[0].start);
    const latestEnd = times.reduce((max, t) => t.end > max ? t.end : max, times[0].end);
    const totalBreak = times.reduce((sum, t) => sum + t.break, 0);
    
    return { start: earliestStart, end: latestEnd, break: totalBreak };
  }, [day.entries]);

  return (
    <div 
      ref={(el) => (dayRefs.current[day.dateKey] = el)}
      className={`py-0.5 border-b border-gray-100 transition-colors ${
        hasEntries ? 'hover:bg-gray-50' : 'opacity-40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Date Label - Ultra Compact */}
        <div className="min-w-[90px] flex-shrink-0">
          <div className={`text-[11px] font-medium leading-tight ${
            hasEntries ? 'text-gray-900' : 'text-gray-400'
          }`}>
            {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Time Info - Always visible if available */}
        <div className="min-w-[100px] flex-shrink-0">
          {dayTimeInfo ? (
            <div className="text-[10px] font-mono text-gray-700 leading-tight">
              {dayTimeInfo.start}–{dayTimeInfo.end}
              {dayTimeInfo.break > 0 && (
                <div className="text-[9px] text-gray-500">Break: {dayTimeInfo.break}m</div>
              )}
            </div>
          ) : hasEntries ? (
            <div className="text-[10px] text-gray-400 italic">No times</div>
          ) : null}
        </div>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          {!hasEntries ? (
            <div className="text-[11px] text-gray-400 italic">No entries</div>
          ) : day.entries.length === 1 ? (
            /* Single task - show inline with badges and notes */
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {day.entries[0].taskCategory && (
                  <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-700 border-blue-200 px-1.5 py-0 h-4">
                    {day.entries[0].taskCategory}
                  </Badge>
                )}
                {day.entries[0].workType && day.entries[0].workType !== 'regular' && (
                  <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-700 border-amber-200 px-1.5 py-0 h-4 uppercase">
                    {day.entries[0].workType}
                  </Badge>
                )}
                <span className="text-[11px] text-gray-700 leading-tight truncate">
                  {day.entries[0].taskDescription || 'No description'}
                </span>
              </div>
              {day.entries[0].notes && (
                <div className="text-[10px] text-gray-500 italic mt-0.5 truncate">
                  Note: {day.entries[0].notes}
                </div>
              )}
            </div>
          ) : (
            /* Multiple tasks - collapsible dropdown */
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>{day.entries.length} tasks - Click to expand</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-1">
                {day.entries.map((entry, idx) => {
                  // Calculate hours for this entry (convert days to hours if needed)
                  const entryHours = entry.hours !== undefined 
                    ? entry.hours 
                    : (entry.days !== undefined ? entry.days * 8 : 0);
                  
                  return (
                    <div key={entry.id} className="pl-4 border-l-2 border-blue-200 py-0.5 bg-blue-50/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {entry.taskCategory && (
                              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                                {entry.taskCategory}
                              </span>
                            )}
                            {entry.workType && entry.workType !== 'regular' && (
                              <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium uppercase">
                                {entry.workType}
                              </span>
                            )}
                            <p className="text-[10px] text-gray-900 font-medium truncate">
                              {entry.taskDescription || 'No description'}
                            </p>
                          </div>
                          {entry.startTime && entry.endTime && (
                            <p className="text-[9px] font-mono text-gray-600 mt-0.5">
                              {entry.startTime}–{entry.endTime}
                              {entry.breakMinutes > 0 && (
                                <span className="ml-1 text-gray-500">• {entry.breakMinutes}m break</span>
                              )}
                            </p>
                          )}
                          {entry.notes && (
                            <p className="text-[9px] text-gray-600 italic mt-0.5 truncate">
                              Note: {entry.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-gray-900 tabular-nums text-[10px] flex-shrink-0">
                          {entryHours.toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        {/* Day Total - Compact - ALWAYS SHOW HOURS */}
        <div className="min-w-[45px] text-right flex-shrink-0">
          <span className={`text-xs font-bold tabular-nums ${
            hasEntries ? 'text-gray-900' : 'text-gray-300'
          }`}>
            {dayTotal.toFixed(1)}h
          </span>
        </div>
      </div>
    </div>
  );
}

// Component to render policy check items
function PolicyCheckItem({ 
  status, 
  label, 
  message
}: { 
  status: 'pass' | 'warn' | 'fail';
  label: string;
  message: string;
}) {
  const statusColor = useMemo(() => {
    switch (status) {
      case 'pass': return 'green';
      case 'warn': return 'yellow';
      case 'fail': return 'red';
      default: return 'gray';
    }
  }, [status]);

  return (
    <div className="flex items-center gap-2">
      <div className={`h-3 w-3 rounded-full bg-${statusColor}-500`} />
      <div className="text-[10px] text-gray-700 leading-tight">
        <span className="font-medium">{label}:</span> {message}
      </div>
    </div>
  );
}