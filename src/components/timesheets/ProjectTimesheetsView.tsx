import { useState, useMemo, useCallback, useEffect } from "react";
import { CalendarDays, Database, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { MultiPersonTimesheetCalendar } from "./MultiPersonTimesheetCalendar";
import { TimesheetTableView } from "./table/TimesheetTableView";
import { PeriodSelector } from "./table/PeriodSelector";
import { OrganizationGroupedTable } from "./approval-v2/OrganizationGroupedTable";
import { MonthlyTimesheetDrawer } from "./approval-v2/MonthlyTimesheetDrawer";
import { 
  ProjectContract,
  TimesheetPeriod,
} from "./approval-v2/demo-data-multi-party";
import { toast } from "sonner@2.0.3";
import * as timesheetApi from "../../utils/api/timesheets";
import { useSaveTimesheetEntry } from "../../utils/api/timesheets-hooks";
import { useApprovalsData } from "../../utils/api/timesheets-approval-hooks";
import type { OrganizationWithData } from "../../utils/api/timesheets-approval-hooks";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { verifySupabaseSetup } from "../../utils/api/supabase-setup-check";
import { DatabaseStatusInline } from "../DatabaseStatusInline";
import { useMonthContextSafe } from "../../contexts/MonthContext";

/**
 * PROJECT-SCOPED Timesheets View - UNIFIED
 * 
 * New Architecture (Simplified):
 * - Top: Organization-grouped approval table (see all contractors)
 * - Bottom: Week/Calendar/Month timesheet views
 * - No separate tabs needed - everything in one place
 * 
 * Context: Lives inside Project Workspace
 * Scope: Shows ALL contractors working on THIS specific project
 * 
 * Who sees this:
 * ✅ Project Owner (sees all vendors on their project)
 * ✅ Client PM (sees all contractors across all vendors)
 */

interface Contractor {
  id: string;
  name: string;
  initials: string;
  company?: string;
}

interface ProjectTimesheetsViewProps {
  ownerId: string;
  ownerName: string;
  contractors: Contractor[];
  hourlyRate?: number;
}

export function ProjectTimesheetsView({
  ownerId,
  ownerName,
  contractors,
  hourlyRate = 95
}: ProjectTimesheetsViewProps) {
  const [viewMode, setViewMode] = useState<"month" | "week" | "calendar">("month");
  
  // ✅ USE SHARED MONTH CONTEXT (synchronized with WorkGraph tab)
  const { selectedMonth, setSelectedMonth } = useMonthContextSafe();
  
  // Calculate period start/end from the selected month
  const periodStart = useMemo(() => startOfMonth(selectedMonth), [selectedMonth]);
  const periodEnd = useMemo(() => endOfMonth(selectedMonth), [selectedMonth]);
  
  // ✅ DATABASE SAVE MUTATION
  const saveEntryMutation = useSaveTimesheetEntry();
  
  // ✅ Get query client for invalidation
  const queryClient = useQueryClient();

  // Approval drawer state (for daily view)
  const [selectedDrawerState, setSelectedDrawerState] = useState<{
    periods: TimesheetPeriod[]; // All periods for the month
    clickedPeriodId: string; // Which period was clicked (for auto-scroll)
    contract: ProjectContract;
  } | null>(null);

  // Selection state - NOW AT CONTRACT LEVEL instead of period level
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  
  // REMOVED: Period-level selection - checkboxes now directly control selectedContracts
  // const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());

  // Local entries state - allows editing demo data
  const [localEntries, setLocalEntries] = useState<Record<string, Record<string, timesheetApi.TimesheetEntry>>>({});

  // ✅ LOAD REAL DATA FROM DATABASE instead of using demo data
  const { data: organizationsWithData = [], isLoading: isLoadingData } = useApprovalsData();

  // ✅ LOAD DATABASE ENTRIES for selected contractors
  const selectedUserIds = useMemo(() => {
    const allContracts = organizationsWithData.flatMap(org => org.contracts);
    const userIds: string[] = [];
    selectedContracts.forEach(contractId => {
      const contract = allContracts.find(c => c.id === contractId);
      if (contract) {
        userIds.push(contract.userId);
      }
    });
    return userIds;
  }, [selectedContracts, organizationsWithData]);

  // Fetch timesheet entries for all selected users
  // ✅ Use sorted JSON string of IDs to prevent query key changing when order changes
  const selectedUserIdsKey = useMemo(() => JSON.stringify([...selectedUserIds].sort()), [selectedUserIds]);
  
  const { data: databaseEntries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ['timesheet-entries-bulk', selectedUserIdsKey, format(periodStart, 'yyyy-MM-dd'), format(periodEnd, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (selectedUserIds.length === 0) return [];
      
      console.log('📊 LOADING TIMESHEET ENTRIES FROM DATABASE:', {
        userIds: selectedUserIds,
        startDate: format(periodStart, 'yyyy-MM-dd'),
        endDate: format(periodEnd, 'yyyy-MM-dd'),
      });
      
      // Fetch entries for all selected users in parallel
      const allEntries = await Promise.all(
        selectedUserIds.map(userId =>
          timesheetApi.getTimesheetEntries({
            userId,
            companyId: 'company-1',
            startDate: format(periodStart, 'yyyy-MM-dd'),
            endDate: format(periodEnd, 'yyyy-MM-dd'),
          })
        )
      );
      
      const flatEntries = allEntries.flat();
      console.log(`✅ LOADED ${flatEntries.length} DATABASE ENTRIES:`, flatEntries);
      
      return flatEntries;
    },
    enabled: selectedUserIds.length > 0,
    staleTime: 10 * 1000, // 10 seconds - refresh often to show latest data
  });

  // ✅ Stable callback: Handle clicking on a contractor to open monthly view
  const handleSelectPeriod = useCallback((period: TimesheetPeriod, contract: ProjectContract) => {
    // Find periods for this contract
    const contractData = organizationsWithData
      .flatMap(org => org.contracts)
      .find(c => c.id === contract.id);
    
    const allPeriods = contractData?.periods || [];
    
    // Filter to only periods within the selected month range
    const filteredPeriods = allPeriods.filter(p => {
      const pStart = new Date(p.weekStartDate);
      return pStart >= periodStart && pStart <= periodEnd;
    });
    
    setSelectedDrawerState({ 
      periods: filteredPeriods.length > 0 ? filteredPeriods : allPeriods, // Fallback to all if no match
      clickedPeriodId: period.id, 
      contract 
    });
  }, [organizationsWithData, periodStart, periodEnd]);

  // ✅ Stable callback: Toggle selection of a single contract (called by checkboxes at contract/period level)
  const handleToggleContract = useCallback((contractId: string) => {
    setSelectedContracts(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(contractId)) {
        newSelection.delete(contractId);
      } else {
        newSelection.add(contractId);
      }
      return newSelection;
    });
  }, []);

  // ✅ Stable callback: Toggle selection of all contracts in an organization (called by org-level checkbox)
  const handleToggleOrganization = useCallback((contractIds: string[]) => {
    setSelectedContracts(prev => {
      const allSelected = contractIds.every(id => prev.has(id));
      const newSelection = new Set(prev);
      
      if (allSelected) {
        contractIds.forEach(id => newSelection.delete(id));
      } else {
        contractIds.forEach(id => newSelection.add(id));
      }
      
      return newSelection;
    });
  }, []);

  const handleApproveTimesheet = useCallback(() => {
    if (selectedDrawerState) {
      toast.success(`Approved timesheet for ${selectedDrawerState.contract.userName}`);
      setSelectedDrawerState(null);
      // TODO: Update backend
    }
  }, [selectedDrawerState]);

  const handleRejectTimesheet = useCallback(() => {
    if (selectedDrawerState) {
      const reason = prompt("Reason for rejection:");
      if (reason) {
        toast.error(`Rejected timesheet for ${selectedDrawerState.contract.userName}`, {
          description: reason
        });
        setSelectedDrawerState(null);
        // TODO: Update backend
      }
    }
  }, [selectedDrawerState]);

  // ✅ Stable callbacks: Quick approve/reject handlers
  const handleQuickApprove = useCallback((periodId: string, contractId: string) => {
    // Find contract from real data
    const contract = organizationsWithData
      .flatMap(org => org.contracts)
      .find(c => c.id === contractId);
    
    if (contract) {
      toast.success(`Approved timesheet for ${contract.userName}`);
      // TODO: Update backend
    }
  }, [organizationsWithData]);

  const handleQuickReject = useCallback((periodId: string, contractId: string) => {
    // Find contract from real data
    const contract = organizationsWithData
      .flatMap(org => org.contracts)
      .find(c => c.id === contractId);
    
    if (contract) {
      const reason = prompt(`Reject timesheet for ${contract.userName}?\n\nReason:`);
      if (reason) {
        toast.error(`Rejected timesheet for ${contract.userName}`, {
          description: reason
        });
        // TODO: Update backend
      }
    }
  }, [organizationsWithData]);

  // ✅ PHASE 3: Deep link to graph from timesheet row
  const handleViewInGraph = useCallback((userId: string, submittedAt?: string) => {
    const params = new URLSearchParams();
    params.set('scope', 'approvals');
    params.set('focus', `user-${userId}`); // ✅ Add 'user-' prefix to match graph node IDs
    if (submittedAt) {
      params.set('asOf', submittedAt);
    }
    
    // Use hash-based routing (works in Figma Make iframe)
    window.location.hash = params.toString();
    
    // Add visual toast for confirmation
    toast.success('Opening Project Graph: approval chain view', {
      duration: 2000,
    });
    
    // Trigger tab change to project-graph
    const event = new CustomEvent('changeTab', { detail: 'project-graph' });
    window.dispatchEvent(event);
  }, []);

  // ✅ Stable callbacks: Timesheet entry handlers for table view
  const handleUpdateEntry = useCallback(async (entryId: string, updates: Partial<timesheetApi.TimesheetEntry>) => {
    try {
      await timesheetApi.updateTimesheetEntry(entryId, updates);
      toast.success('Entry updated successfully');
    } catch (error) {
      console.error('Failed to update entry:', error);
      toast.error('Failed to update entry');
    }
  }, []);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    try {
      await timesheetApi.deleteTimesheetEntryById(entryId);
      toast.success('Entry deleted successfully');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete entry');
    }
  }, []);

  const handleBulkUpdate = useCallback(async (entryIds: string[], updates: Partial<timesheetApi.TimesheetEntry>) => {
    try {
      await Promise.all(entryIds.map(id => timesheetApi.updateTimesheetEntry(id, updates)));
      toast.success(`${entryIds.length} entries updated successfully`);
    } catch (error) {
      console.error('Failed to bulk update:', error);
      toast.error('Failed to update entries');
    }
  }, []);

  const handleSavePersonTasks = useCallback(async (personId: string, tasks: any[]) => {
    try {
      // ✅ FIX: When deleting all tasks (empty array), we still need the date
      // The date should be passed from the modal, but fallback to extracting from task if available
      let dateKey: string;
      
      if (tasks.length > 0 && tasks[0]?.date) {
        // Normal save: get date from first task
        dateKey = tasks[0].date;
      } else {
        // Empty array (delete all): This shouldn't happen if the modal passes date correctly
        // But as a fallback, use today (this is a bug scenario that needs to be fixed in the modal)
        console.error('⚠️ handleSavePersonTasks called without date! tasks:', tasks);
        toast.error('Cannot save: date is missing');
        return;
      }
      
      console.log('💾 ============ SAVE OPERATION START ============');
      console.log('💾 Person ID:', personId);
      console.log('💾 Date:', dateKey);
      console.log('💾 Tasks received:', tasks);
      console.log('💾 Tasks count:', tasks.length);
      
      // ✅ FIX: Delete ALL existing entries for this person on this date FIRST
      const existingEntries = await timesheetApi.getTimesheetEntries({
        userId: personId,
        companyId: 'company-1', // Demo company ID
        startDate: dateKey,
        endDate: dateKey
      });
      
      console.log(`🗑️ Found ${existingEntries.length} existing entries for ${personId} on ${dateKey}:`, existingEntries);
      
      await Promise.all(
        existingEntries.map(e => timesheetApi.deleteTimesheetEntryById(e.id))
      );
      
      console.log(`✅ Deleted all ${existingEntries.length} existing entries`);
      
      // ✅ NOW create new entries from tasks (FILTER OUT TASKS WITH 0 HOURS - those are "delete all" markers)
      const newEntries = tasks
        .filter(task => {
          const hours = parseFloat(task.hours);
          console.log(`🔍 Checking task: hours="${task.hours}" parsed=${hours} shouldKeep=${hours > 0}`);
          return hours > 0;
        })
        .map(task => ({
          userId: personId,
          companyId: 'company-1', // Demo company ID
          date: dateKey,
          hours: parseFloat(task.hours) || 0,
          status: 'draft' as const,
          notes: task.notes || '',
          projectId: task.task || task.taskCategory || '',
          // ✅ Include all task fields
          workType: task.workType || 'regular',
          taskCategory: task.taskCategory || 'Development',
          taskDescription: task.task || task.notes || 'Work',
          billable: task.billable !== undefined ? task.billable : true,
          startTime: task.startTime,
          endTime: task.endTime,
          breakMinutes: task.breakMinutes,
        }));
      
      console.log(`💾 Creating ${newEntries.length} new entries for ${personId} on ${dateKey}:`, newEntries);
      
      // Save all new entries to database
      await Promise.all(
        newEntries.map(entry => timesheetApi.saveTimesheetEntry(entry))
      );
      
      // ✅ Refetch database entries to show updated data
      await queryClient.invalidateQueries({ 
        queryKey: ['timesheet-entries-bulk', selectedUserIds, format(periodStart, 'yyyy-MM-dd'), format(periodEnd, 'yyyy-MM-dd')]
      });
      
      // ✅ Update local state for optimistic UI
      setLocalEntries(prev => {
        const updated = { ...prev };
        
        if (!updated[personId]) {
          updated[personId] = {};
        }
        
        // ✅ FIX: If there are no tasks (delete all), remove the date entry instead of creating an empty one
        if (newEntries.length === 0) {
          // Delete the date entry completely
          delete updated[personId][dateKey];
          
          // If this was the last date for this person, remove the person entry too
          if (Object.keys(updated[personId]).length === 0) {
            delete updated[personId];
          }
        } else {
          // Normal save: update the date entry with new tasks
          updated[personId][dateKey] = {
            date: dateKey,
            entries: tasks
              .filter(task => parseFloat(task.hours) > 0) // Only include tasks with hours
              .map(task => ({
                id: task.entryId || task.taskId || `entry-${Date.now()}-${Math.random()}`,
                taskCategory: task.taskCategory || 'Development',
                taskDescription: task.task || task.notes || 'Work',
                hours: parseFloat(task.hours) || 0,
                workType: task.workType || 'regular',
                billable: task.billable !== undefined ? task.billable : true,
                startTime: task.startTime,
                endTime: task.endTime,
                breakMinutes: task.breakMinutes,
                status: 'draft' as const,
                notes: task.notes || '',
              })),
          };
        }
        
        return updated;
      });
      
      if (newEntries.length === 0) {
        toast.success(`Deleted all tasks for ${dateKey}`);
      } else {
        toast.success(`Saved ${newEntries.length} task(s) for ${dateKey}`);
      }
    } catch (error) {
      console.error('Failed to save tasks:', error);
      throw error;
    }
  }, [queryClient, selectedUserIds, periodStart, periodEnd]);

  // ✅ Stable callback for table entry changes - wrapped in useCallback to prevent infinite loops
  const handleEntriesChange = useCallback(async (personId: string, date: Date, entries: timesheetApi.TimesheetEntry) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    console.log("💾 Entry changed - SAVING TO DATABASE:", personId, dateKey, entries);
    
    try {
      // Delete ALL existing entries for this date FIRST
      const existingEntries = await timesheetApi.getTimesheetEntries({
        userId: personId,
        companyId: 'company-1',
        startDate: dateKey,
        endDate: dateKey
      });
      
      console.log(`🗑️ Deleting ${existingEntries.length} existing entries before saving new ones`);
      
      await Promise.all(
        existingEntries.map(e => timesheetApi.deleteTimesheetEntryById(e.id))
      );
      
      // Update local entries state FIRST (optimistic update)
      setLocalEntries(prev => ({
        ...prev,
        [personId]: {
          ...(prev[personId] || {}),
          [dateKey]: entries,
        }
      }));
      
      // NOW save new entries to database
      if (entries.entries && entries.entries.length > 0) {
        for (const entry of entries.entries) {
          await timesheetApi.saveTimesheetEntry({
            userId: personId,
            companyId: 'company-1',
            date: dateKey,
            hours: entry.hours || 0,
            projectId: entry.description || entry.taskDescription || 'Work',
            workType: entry.workType || 'regular',
            taskCategory: entry.category || entry.taskCategory || 'Development',
            taskDescription: entry.taskDescription || entry.description || 'Work',
            billable: entry.billable !== undefined ? entry.billable : true,
            startTime: entry.startTime,
            endTime: entry.endTime,
            breakMinutes: entry.breakMinutes,
            notes: entry.notes || '',
            status: entry.status || 'draft',
          });
        }
        
        toast.success(`✅ Saved ${entries.entries.length} task(s)`);
      } else {
        toast.success(`✅ Deleted all tasks for ${dateKey}`);
      }
      
      // Invalidate query to refetch
      await queryClient.invalidateQueries({ 
        queryKey: ['timesheet-entries-bulk']
      });
      
    } catch (error) {
      console.error('❌ Failed to save to database:', error);
      toast.error(`Failed to save timesheet for ${dateKey}`);
    }
  }, [queryClient]);

  // Map contract IDs to people for table view
  const selectedPeopleForTable = useMemo(() => {
    if (selectedContracts.size === 0) {
      // Show nothing when no one is selected
      return [];
    }
    
    // Filter to show only selected contractors from real data
    const allContracts = organizationsWithData.flatMap(org => org.contracts);
    const selectedContractsList = allContracts.filter(c => selectedContracts.has(c.id));
    
    return selectedContractsList.map(contract => ({
      id: contract.userId,
      name: contract.userName,
      initials: contract.userName.split(' ').map(n => n[0]).join(''),
      role: contract.userRole.replace('_', ' '),
    }));
  }, [selectedContracts, organizationsWithData]);

  // Map contract IDs to contractors for calendar view
  const selectedContractorsForCalendar = useMemo(() => {
    // Always show all available contractors from real data
    const allContracts = organizationsWithData.flatMap(org => org.contracts);
    
    // ✅ Deduplicate by userId - same person may have multiple contracts
    const uniqueContractors = new Map<string, {
      id: string;
      name: string;
      initials: string;
      company?: string;
    }>();
    
    allContracts.forEach(contract => {
      if (!uniqueContractors.has(contract.userId)) {
        uniqueContractors.set(contract.userId, {
          id: contract.userId,
          name: contract.userName,
          initials: contract.userName.split(' ').map(n => n[0]).join(''),
          company: organizationsWithData.find(org => org.id === contract.organizationId)?.name,
        });
      }
    });
    
    return Array.from(uniqueContractors.values());
  }, [organizationsWithData]);
  
  // Extract just the contractor IDs for the calendar (from contracts, not user IDs)
  // ✅ IMPORTANT: Memoize the Set by creating it once and only updating when dependencies change
  const selectedContractorIds = useMemo(() => {
    if (selectedContracts.size === 0) {
      return undefined; // Return undefined so calendar shows "Select contractors above" message
    }
    
    // Map from contract ID to userId for calendar filtering
    const allContracts = organizationsWithData.flatMap(org => org.contracts);
    const userIds = new Set<string>();
    
    selectedContracts.forEach(contractId => {
      const contract = allContracts.find(c => c.id === contractId);
      if (contract) {
        userIds.add(contract.userId);
      }
    });
    
    return userIds;
  }, [selectedContracts, organizationsWithData]);

  // Convert approval data to table format (from REAL DATABASE DATA)
  const tableEntriesFromApprovalData = useMemo(() => {
    if (selectedContracts.size === 0) {
      // Show nothing when no one is selected
      return {};
    }
    
    // ✅ CONVERT DATABASE ENTRIES TO TABLE FORMAT
    const entriesByUserAndDate: Record<string, Record<string, timesheetApi.TimesheetEntry>> = {};
    
    // Group database entries by userId and date
    databaseEntries.forEach(entry => {
      if (!entriesByUserAndDate[entry.userId]) {
        entriesByUserAndDate[entry.userId] = {};
      }
      
      if (!entriesByUserAndDate[entry.userId][entry.date]) {
        entriesByUserAndDate[entry.userId][entry.date] = {
          date: entry.date,
          entries: [],
        };
      }
      
      // Add this entry to the date's entries array
      entriesByUserAndDate[entry.userId][entry.date].entries.push({
        id: entry.id,
        taskCategory: entry.taskCategory || 'Development',
        taskDescription: entry.projectId || entry.taskDescription || 'Work',
        hours: entry.hours || 0,
        workType: entry.workType || 'regular',
        billable: entry.billable !== undefined ? entry.billable : true,
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakMinutes: entry.breakMinutes,
        status: entry.status || 'draft',
        notes: entry.notes || '',
      });
    });
    
    console.log('📋 TABLE ENTRIES FROM DATABASE:', entriesByUserAndDate);
    
    // Merge with local entries (local entries override database for optimistic updates)
    Object.keys(localEntries).forEach(userId => {
      if (!entriesByUserAndDate[userId]) {
        entriesByUserAndDate[userId] = {};
      }
      Object.assign(entriesByUserAndDate[userId], localEntries[userId]);
    });
    
    return entriesByUserAndDate;
  }, [selectedContracts, databaseEntries, localEntries]);

  // Show loading state while data is being fetched
  if (isLoadingData) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-1">Project Timesheets</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Loading timesheet data...
          </p>
        </div>
      </div>
    );
  }

  // Show empty state if no organizations found
  if (!isLoadingData && organizationsWithData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-1">Project Timesheets</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Manage timesheets and approvals for all contractors on this project
          </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: Empty state message */}
          <div className="flex flex-col items-center justify-center py-8 px-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center space-y-3">
              <div className="text-6xl mb-2">📋</div>
              <h3 className="text-lg font-semibold text-gray-900">No Timesheet Data Yet</h3>
              <p className="text-sm text-gray-600 max-w-md">
                Database tables need to be set up and populated with data. Check the status on the right, 
                then visit the setup page to create tables and seed demo data.
              </p>
              <div className="flex flex-col gap-2 pt-4">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'setup' }))}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Go to Setup Page
                </button>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'db-sync-test' }))}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Database Sync Test
                </button>
              </div>
            </div>
          </div>
          
          {/* Right: Database status checker */}
          <DatabaseStatusInline />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex gap-4">
        <div className="flex-1">
          <h2 className="mb-1">Project Timesheets</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Manage timesheets and approvals for all contractors on this project
          </p>
          
          {/* Unified Period Selector with View Mode Tabs */}
          <PeriodSelector
            view={viewMode}
            onViewChange={(v) => setViewMode(v)}
            startDate={periodStart}
            endDate={periodEnd}
            onNavigate={(start, end) => {
              // Update the shared month context (will automatically update periodStart/periodEnd via useMemo)
              setSelectedMonth(start);
            }}
            showCalendarTab={true}
          />
        </div>
        
        {/* Database Status Panel (always visible) */}
        <div className="w-80 flex-shrink-0">
          <DatabaseStatusInline />
        </div>
      </div>

      {/* Organization-Grouped Approval Table */}
      <OrganizationGroupedTable
        organizations={organizationsWithData}
        selectedContracts={selectedContracts}
        onToggleContract={handleToggleContract}
        onToggleOrganization={handleToggleOrganization}
        onOpenDrawer={handleSelectPeriod}
        onQuickApprove={handleQuickApprove}
        onQuickReject={handleQuickReject}
        onViewInGraph={handleViewInGraph}
        viewMode={viewMode === 'calendar' ? 'month' : viewMode} // Calendar uses month view
        filterPeriodStart={periodStart}
        filterPeriodEnd={periodEnd}
      />

      {/* Detailed Timesheet View (changes based on selected view mode) */}
      <div className="space-y-4">
        {/* Section Header */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-1">Timesheet Details</h3>
          <p className="text-sm text-muted-foreground">
            {selectedContracts.size === 0 
              ? 'Select contractors above to view their timesheets.'
              : `Viewing ${selectedContracts.size} selected contractor${selectedContracts.size === 1 ? '' : 's'}`
            }
          </p>
        </div>

        {/* Month View */}
        {viewMode === "month" && (
          <TimesheetTableView
            people={selectedPeopleForTable}
            entries={tableEntriesFromApprovalData}
            viewMode="month"
            startDate={periodStart}
            endDate={periodEnd}
            onEntriesChange={handleEntriesChange}
            onSavePersonTasks={handleSavePersonTasks}
          />
        )}

        {/* Week View */}
        {viewMode === "week" && (
          <TimesheetTableView
            people={selectedPeopleForTable}
            entries={tableEntriesFromApprovalData}
            viewMode="week"
            startDate={periodStart}
            endDate={periodEnd}
            onEntriesChange={handleEntriesChange}
            onSavePersonTasks={handleSavePersonTasks}
          />
        )}

        {/* Calendar View */}
        {viewMode === "calendar" && (
          <MultiPersonTimesheetCalendar
            userRole="company-owner"
            currentUserId={ownerId}
            currentUserName={ownerName}
            contractors={selectedContractorsForCalendar}
            canViewTeam={true}
            isCompanyOwner={true}
            externalContractorIds={selectedContractorIds}
          />
        )}
      </div>

      {/* Monthly Timesheet Drawer (for approvals) */}
      {selectedDrawerState && (
        <MonthlyTimesheetDrawer
          periods={selectedDrawerState.periods}
          clickedPeriodId={selectedDrawerState.clickedPeriodId}
          contract={selectedDrawerState.contract}
          isOpen={!!selectedDrawerState}
          onClose={() => setSelectedDrawerState(null)}
        />
      )}
    </div>
  );
}