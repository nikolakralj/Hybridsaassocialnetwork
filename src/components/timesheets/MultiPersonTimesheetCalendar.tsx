import { useState, useEffect, useMemo, Fragment } from "react";
import { ChevronLeft, ChevronRight, Download, Calendar, RefreshCw, User, Users } from "lucide-react";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { toast } from "sonner@2.0.3";
import { useMultiDaySelection } from "./hooks/useMultiDaySelection";
import { MultiPersonCalendarCell, type DayData, type PersonEntry } from "./drag-drop/MultiPersonCalendarCell";
import { MultiPersonDayModal, type PersonEntry as ModalPersonEntry } from "./modal/MultiPersonDayModal";
import { DragDropConflictDialog, type DraggedData, type ConflictingEntry, type ConflictResolution } from "./modal/DragDropConflictDialog";
import * as timesheetApi from "../../utils/api/timesheets";

// Demo company ID
const DEMO_COMPANY_ID = 'company-1'; // ✅ Match DatabaseSyncTest's company ID

interface Contractor {
  id: string;
  name: string;
  initials: string;
  company?: string;
}

interface Person {
  id: string;
  name: string;
  initials: string;
  role?: string;
}

interface MultiPersonTimesheetCalendarProps {
  userRole: 'individual-contributor' | 'company-owner' | 'agency-owner';
  currentUserId: string;
  currentUserName: string;
  contractors: Contractor[];
  canViewTeam: boolean;
  isCompanyOwner: boolean;
  // NEW: External control for which contractors to show (from checkboxes)
  externalContractorIds?: Set<string>;
}

export function MultiPersonTimesheetCalendar({
  userRole,
  currentUserId,
  currentUserName,
  contractors,
  canViewTeam,
  isCompanyOwner,
  externalContractorIds,
}: MultiPersonTimesheetCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [viewMode, setViewMode] = useState<'my-timesheet' | 'team-timesheet'>('my-timesheet');
  
  // Modal states
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingDragData, setPendingDragData] = useState<DraggedData | null>(null);
  const [detectedConflicts, setDetectedConflicts] = useState<ConflictingEntry[]>([]);
  
  // Multi-day selection hook
  const {
    selectedDates,
    handleDayClick,
    clearSelection: clearDateSelection,
    selectionCount,
  } = useMultiDaySelection({
    allowMultiSelect: true,
    allowRangeSelect: true,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Generate calendar days
  const { calendarDays, weeks } = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];
    // Calculate offset for Monday-first week (0=Sun, 1=Mon, ..., 6=Sat)
    const startOffset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    // Pad to complete the last week (ensure each week has 7 cells)
    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      for (let i = 0; i < remainingCells; i++) {
        days.push(null);
      }
    }

    // Split into weeks
    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return { calendarDays: days, weeks };
  }, [year, month]);

  // Use state for day data (so we can mutate it on drag-copy)
  const [dayDataMap, setDayDataMap] = useState<Map<string, DayData>>(new Map());
  
  // Store full timesheet entries for editing
  const [timesheetEntriesMap, setTimesheetEntriesMap] = useState<Map<string, timesheetApi.TimesheetEntry[]>>(new Map());
  
  // Load people on mount and when props change
  // ✅ Convert Set/Array to sorted string for stable dependency comparison
  const contractorsKey = useMemo(() => 
    contractors.map(c => c.id).sort().join(','),
    [contractors]
  );
  const externalContractorIdsKey = useMemo(() => 
    externalContractorIds ? Array.from(externalContractorIds).sort().join(',') : 'undefined',
    [externalContractorIds]
  );
  
  useEffect(() => {
    loadPeople();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractorsKey, currentUserId, currentUserName, viewMode, canViewTeam, isCompanyOwner, userRole, externalContractorIdsKey]);
  
  const loadPeople = async () => {
    try {
      setIsLoading(true);
      
      // Determine which people to show based on role and view mode
      let peopleToShow: Person[];
      
      if (!canViewTeam) {
        // Solo freelancer - always show just self
        peopleToShow = [{
          id: currentUserId,
          name: currentUserName,
          initials: currentUserName.split(' ').map(n => n[0]).join(''),
          role: userRole,
        }];
      } else if (isCompanyOwner) {
        // Company owner - always show team, no personal view
        // ✅ Deduplicate contractors by ID (safety measure)
        const uniqueContractors = new Map<string, Contractor>();
        contractors.forEach(c => {
          if (!uniqueContractors.has(c.id)) {
            uniqueContractors.set(c.id, c);
          }
        });
        
        peopleToShow = Array.from(uniqueContractors.values()).map(c => ({
          id: c.id,
          name: c.name,
          initials: c.initials,
          role: userRole,
        }));
      } else {
        // Agency owner - toggle between personal and team
        if (viewMode === 'my-timesheet') {
          peopleToShow = [{
            id: currentUserId,
            name: currentUserName,
            initials: currentUserName.split(' ').map(n => n[0]).join(''),
            role: userRole,
          }];
        } else {
          // ✅ Deduplicate contractors by ID (safety measure)
          const uniqueContractors = new Map<string, Contractor>();
          contractors.forEach(c => {
            if (!uniqueContractors.has(c.id)) {
              uniqueContractors.set(c.id, c);
            }
          });
          
          peopleToShow = Array.from(uniqueContractors.values()).map(c => ({
            id: c.id,
            name: c.name,
            initials: c.initials,
            role: userRole,
          }));
        }
      }
      
      // Apply external contractor filter
      // ✅ If externalContractorIds is undefined, show empty (user must select checkboxes first)
      // ✅ If externalContractorIds is a Set, filter to only show those IDs
      if (externalContractorIds === undefined) {
        peopleToShow = []; // Show empty state with "Select contractors above" message
      } else if (externalContractorIds.size > 0) {
        peopleToShow = peopleToShow.filter(p => externalContractorIds.has(p.id));
      } else {
        peopleToShow = []; // Empty selection = show nothing
      }
      
      const convertedPeople: Person[] = peopleToShow;
      
      console.log('👥 Loaded people for calendar:', {
        total: convertedPeople.length,
        people: convertedPeople.map(p => ({ id: p.id, name: p.name })),
      });
      
      setPeople(convertedPeople);
      
      // ✅ Auto-select ALL people when externalContractorIds is provided (respecting checkboxes)
      // Otherwise, auto-select first 3 people
      if (convertedPeople.length > 0) {
        if (externalContractorIds) {
          // When controlled externally, select all filtered people
          setSelectedPeople(new Set(convertedPeople.map(p => p.id)));
        } else {
          // Legacy behavior: auto-select first 3
          setSelectedPeople(new Set(convertedPeople.slice(0, 3).map(p => p.id)));
        }
      } else {
        // No people found, show a helpful message
        console.warn('No people found. You may need to seed demo data.');
      }
    } catch (error) {
      console.error('Error loading people:', error);
      // Don't show error toast on initial load - user might not have seeded data yet
      // toast.error('Failed to load people. Try seeding demo data first.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load timesheet data when selectedPeople or month changes
  // ✅ Convert Set to sorted string for stable dependency comparison
  const selectedPeopleKey = Array.from(selectedPeople).sort().join(',');
  
  useEffect(() => {
    if (selectedPeople.size === 0) {
      setDayDataMap(new Map());
      return;
    }
    
    loadTimesheetData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeopleKey, year, month]);
  
  const loadTimesheetData = async () => {
    try {
      // ✅ FIX: Use proper last day of month instead of hardcoded 31
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0); // Day 0 of next month = last day of current month
      
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      
      console.log('📅 Calendar loadTimesheetData:', {
        startDate,
        endDate,
        selectedPeople: Array.from(selectedPeople),
        peopleList: people.map(p => ({ id: p.id, name: p.name })),
      });
      
      const entries = await timesheetApi.getTimesheetEntries({
        companyId: DEMO_COMPANY_ID,
        startDate,
        endDate,
      }).catch((error) => {
        console.warn('Failed to load timesheet data, using empty state:', error);
        return []; // Return empty array if API fails
      });
      
      console.log('📊 Loaded entries from DB:', entries.length, entries);
      
      // ✅ DEBUG: Check if taskDescription is in the raw API response
      if (entries.length > 0) {
        console.log('🔍 CALENDAR: First entry from API:', {
          fullEntry: entries[0],
          hasTaskDescription: 'taskDescription' in entries[0],
          taskDescriptionValue: entries[0].taskDescription,
          allFields: Object.keys(entries[0]),
        });
      }
      
      // Filter to only selected people and deduplicate by userId+date
      const seenKeys = new Set<string>();
      const filteredEntries = entries.filter(e => {
        if (!selectedPeople.has(e.userId)) return false;
        
        const key = `${e.userId}:${e.date}`;
        if (seenKeys.has(key)) {
          // Skip duplicate silently (API may return duplicates)
          return false;
        }
        seenKeys.add(key);
        return true;
      });
      
      console.log('✅ Filtered entries:', filteredEntries.length, filteredEntries);
      
      // Group by date and person (aggregate multi-task entries)
      const map = new Map<string, DayData>();
      const entriesMap = new Map<string, timesheetApi.TimesheetEntry[]>();
      const personDayMap = new Map<string, { totalHours: number; tasks: string[]; entries: typeof filteredEntries }>();
      
      // First pass: aggregate tasks by person+day
      filteredEntries.forEach(entry => {
        const person = people.find(p => p.id === entry.userId);
        if (!person) return;
        
        const personDayKey = `${entry.userId}:${entry.date}`;
        const existing = personDayMap.get(personDayKey);
        
        if (existing) {
          existing.totalHours += entry.hours;
          if (entry.projectId && !existing.tasks.includes(entry.projectId)) {
            existing.tasks.push(entry.projectId);
          }
          existing.entries.push(entry);
        } else {
          personDayMap.set(personDayKey, {
            totalHours: entry.hours,
            tasks: entry.projectId ? [entry.projectId] : [],
            entries: [entry],
          });
        }
      });
      
      // Second pass: create day data with aggregated person entries
      personDayMap.forEach((personDay, personDayKey) => {
        const [userId, dateKey] = personDayKey.split(':');
        const person = people.find(p => p.id === userId);
        if (!person) return;
        
        const firstEntry = personDay.entries[0];
        const taskDisplay = personDay.tasks.length > 1 
          ? `${personDay.tasks.length} tasks`
          : personDay.tasks[0] || 'General Work';
        
        const personEntry: PersonEntry = {
          id: firstEntry.id,
          personId: userId,
          personName: person.name,
          personInitials: person.initials,
          hours: personDay.totalHours,
          task: taskDisplay,
          notes: personDay.entries.map(e => e.notes).filter(Boolean).join('; '),
          status: firstEntry.status as any,
        };
        
        const existingDay = map.get(dateKey);
        
        if (existingDay) {
          existingDay.entries.push(personEntry);
          existingDay.totalHours += personDay.totalHours;
        } else {
          const [y, m, d] = dateKey.split('-').map(Number);
          map.set(dateKey, {
            date: new Date(y, m - 1, d),
            dateKey,
            totalHours: personDay.totalHours,
            entries: [personEntry],
          });
        }
        
        // Store full entries by date for editing
        const existingEntries = entriesMap.get(dateKey) || [];
        entriesMap.set(dateKey, [...existingEntries, ...personDay.entries]);
      });
      
      setDayDataMap(map);
      setTimesheetEntriesMap(entriesMap);
    } catch (error) {
      console.error('Error loading timesheet data:', error);
      toast.error('Failed to load timesheet data');
    }
  };
  
  const handleSeedData = async () => {
    try {
      setIsSeeding(true);
      await timesheetApi.seedDemoData();
      toast.success('Demo data created successfully!');
      await loadPeople();
    } catch (error) {
      console.error('Error seeding data:', error);
      toast.error('Failed to seed demo data');
    } finally {
      setIsSeeding(false);
    }
  };

  // Phase 1C: Edit handlers
  const handleUpdateEntry = async (entryId: string, updates: Partial<timesheetApi.TimesheetEntry>) => {
    try {
      // Optimistic update
      setDayDataMap(prev => {
        const updated = new Map(prev);
        updated.forEach((dayData) => {
          dayData.entries = dayData.entries.map(entry => 
            entry.id === entryId ? { ...entry, ...updates } : entry
          );
        });
        return updated;
      });

      // API call
      await timesheetApi.updateTimesheetEntry(entryId, updates);
      
      // Reload data to ensure sync
      await loadTimesheetData();
      
      toast.success('Entry updated successfully');
    } catch (error) {
      console.error('Failed to update entry:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to update entry: ${errorMessage}. Make sure you've seeded demo data first.`);
      // Rollback by reloading
      await loadTimesheetData();
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      // Optimistic update
      setDayDataMap(prev => {
        const updated = new Map(prev);
        updated.forEach((dayData) => {
          dayData.entries = dayData.entries.filter(e => e.id !== entryId);
        });
        return updated;
      });

      // API call
      await timesheetApi.deleteTimesheetEntryById(entryId);
      
      // Reload data
      await loadTimesheetData();
      
      toast.success('Entry deleted successfully');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to delete entry: ${errorMessage}`);
      await loadTimesheetData();
    }
  };

  const handleBulkUpdate = async (
    entryIds: string[], 
    updates: Partial<timesheetApi.TimesheetEntry>
  ) => {
    try {
      // Optimistic update
      setDayDataMap(prev => {
        const updated = new Map(prev);
        updated.forEach((dayData) => {
          dayData.entries = dayData.entries.map(entry =>
            entryIds.includes(entry.id) ? { ...entry, ...updates } : entry
          );
        });
        return updated;
      });

      // API calls (parallel)
      await Promise.all(
        entryIds.map(id => timesheetApi.updateTimesheetEntry(id, updates))
      );
      
      // Reload data
      await loadTimesheetData();
      
      toast.success(`${entryIds.length} entries updated successfully`);
    } catch (error) {
      console.error('Failed to bulk update:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to update entries: ${errorMessage}`);
      await loadTimesheetData();
    }
  };

  const handleSavePersonTasks = async (personId: string, tasks: any[]) => {
    if (!selectedDayDate) return;
    
    try {
      const dateKey = formatDateKey(selectedDayDate);
      
      console.log('💾 handleSavePersonTasks called with:', {
        personId,
        dateKey,
        tasksCount: tasks.length,
        tasks: JSON.stringify(tasks, null, 2),
      });
      
      // Delete existing entries for this person on this day
      const existingEntries = await timesheetApi.getTimesheetEntries({
        userId: personId,
        startDate: dateKey,
        endDate: dateKey
      });
      
      await Promise.all(
        existingEntries.map(e => timesheetApi.deleteTimesheetEntryById(e.id))
      );
      
      // Create new entries from tasks - include time details
      const newEntries = tasks.map(task => ({
        userId: personId,
        companyId: DEMO_COMPANY_ID,
        date: dateKey,
        hours: parseFloat(task.hours) || 0,
        status: 'draft' as const,
        notes: task.notes || '',
        projectId: task.task || task.taskCategory || '',
        // ✅ Include task category and work type
        workType: task.workType || 'regular',
        taskCategory: task.taskCategory || 'Development',
        // ✅ FIX: Save taskDescription field properly
        taskDescription: task.taskDescription || task.task || '',
        billable: task.billable !== undefined ? task.billable : true,
        // ✅ Include time tracking fields
        startTime: task.startTime || null,
        endTime: task.endTime || null,
        breakMinutes: task.breakMinutes || 0,
      }));
      
      console.log('💾 About to save new entries:', {
        count: newEntries.length,
        entries: JSON.stringify(newEntries, null, 2),
      });
      
      console.log('🔍 CLIENT: Detailed entry inspection:', {
        firstEntry: newEntries[0],
        taskDescription: newEntries[0]?.taskDescription,
        task_field_from_input: tasks[0]?.task,
        taskDescription_field_from_input: tasks[0]?.taskDescription,
      });
      
      await timesheetApi.bulkSaveTimesheetEntries(newEntries);
      
      // Reload data to sync
      await loadTimesheetData();
      
      toast.success('Tasks saved successfully');
    } catch (error) {
      console.error('Failed to save person tasks:', error);
      throw error; // Let the modal handle the error
    }
  };

  const handleApplyToOthers = async (params: {
    templatePersonId: string;
    targetPersonIds: string[];
    dateRangeType: 'day' | 'week' | 'month';
    overwriteExisting: boolean;
  }) => {
    if (!selectedDayDate) return;

    try {
      const templateDate = formatDateKey(selectedDayDate);
      
      console.log('🔄 Applying timesheet to others:', {
        templatePersonId: params.templatePersonId,
        templateDate,
        targetPersonIds: params.targetPersonIds,
        dateRangeType: params.dateRangeType,
        overwriteExisting: params.overwriteExisting,
      });

      const result = await timesheetApi.bulkApplyTimesheet({
        templatePersonId: params.templatePersonId,
        templateDate,
        targetPersonIds: params.targetPersonIds,
        dateRangeType: params.dateRangeType,
        overwriteExisting: params.overwriteExisting,
        companyId: DEMO_COMPANY_ID,
      });
      
      console.log('✅ Bulk apply result:', result);

      // Reload data to show new entries
      await loadTimesheetData();

      // Show success message with details
      const parts = [];
      if (result.created > 0) parts.push(`Created ${result.created}`);
      if (result.overwritten > 0) parts.push(`Overwritten ${result.overwritten}`);
      if (result.skipped > 0) parts.push(`Skipped ${result.skipped}`);
      
      const message = parts.length > 0 
        ? `${parts.join(', ')} entries`
        : 'No changes made';
      
      toast.success(message);
    } catch (error) {
      console.error('Failed to apply timesheet:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to apply timesheet: ${errorMessage}`);
      throw error; // Let the dialog handle it
    }
  };

  const handleDragCopy = (sourceDateKey: string, targetDateKey: string, entries: PersonEntry[]) => {
    // Parse dates
    const sourceDate = parseDateKey(sourceDateKey);
    const targetDate = parseDateKey(targetDateKey);
    
    // Check for conflicts
    const targetDayData = dayDataMap.get(targetDateKey);
    const conflicts: ConflictingEntry[] = [];
    
    if (targetDayData && targetDayData.entries.length > 0) {
      // Find people who already have entries on target day
      entries.forEach(sourceEntry => {
        const existingEntry = targetDayData.entries.find(e => e.personId === sourceEntry.personId);
        if (existingEntry) {
          conflicts.push({
            personId: sourceEntry.personId,
            personName: sourceEntry.personName,
            existingHours: existingEntry.hours,
            existingTask: existingEntry.task, // Use actual task from entry
            newHours: sourceEntry.hours,
            newTask: sourceEntry.task, // Use actual task from entry
          });
        }
      });
    }
    
    // Prepare drag data - copy actual task and notes from source entries
    const dragData: DraggedData = {
      sourceDate,
      targetDate,
      entries: entries.map(e => ({
        personId: e.personId,
        personName: e.personName,
        personInitials: e.personInitials,
        hours: e.hours,
        task: e.task, // ✅ Use actual task from entry
        notes: e.notes || '', // ✅ Use actual notes from entry
      })),
    };
    
    if (conflicts.length > 0) {
      // Show conflict resolution dialog
      setPendingDragData(dragData);
      setDetectedConflicts(conflicts);
      setConflictDialogOpen(true);
    } else {
      // No conflicts, copy directly
      performCopy(dragData, 'merge', new Set());
    }
  };
  
  const performCopy = async (dragData: DraggedData, resolution: ConflictResolution, skipPeopleIds: Set<string>) => {
    const entriesToCopy = dragData.entries.filter(e => !skipPeopleIds.has(e.personId));
    const targetDateKey = formatDateKey(dragData.targetDate);
    
    try {
      // Prepare entries to save to database - include task/project info
      const apiEntries = entriesToCopy.map(e => ({
        userId: e.personId,
        companyId: DEMO_COMPANY_ID,
        date: targetDateKey,
        hours: e.hours,
        status: 'draft' as const,
        notes: e.notes || '',
        projectId: e.task || '', // ✅ Save task/project info
      }));
      
      // Save to database
      await timesheetApi.bulkSaveTimesheetEntries(apiEntries);
      
      // ✅ Reload data from database to ensure consistency
      await loadTimesheetData();
      
      toast.success(`Copied ${entriesToCopy.length} ${entriesToCopy.length === 1 ? 'entry' : 'entries'}`, {
        description: resolution === 'replace' ? 'Replaced existing entries' : 
                     resolution === 'merge' ? 'Merged with existing entries' :
                     'Skipped conflicting entries'
      });
    } catch (error) {
      console.error('Error copying timesheet entries:', error);
      toast.error('Failed to copy entries');
    }
  };
  
  const handleConflictResolution = (resolution: ConflictResolution, skipPeopleIds?: Set<string>) => {
    if (pendingDragData) {
      performCopy(pendingDragData, resolution, skipPeopleIds || new Set());
      setPendingDragData(null);
      setDetectedConflicts([]);
    }
  };
  
  const handleCellClick = (dateKey: string, event: React.MouseEvent) => {
    // Check if Ctrl/Cmd/Shift are pressed (for multi-select)
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      // Use existing multi-select behavior
      handleDayClick(dateKey, event);
    } else {
      // Open day modal
      const date = parseDateKey(dateKey);
      setSelectedDayDate(date);
      setDayModalOpen(true);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isToday = (date: Date | null): boolean => {
    if (!date) return false;
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isWeekend = (date: Date | null): boolean => {
    if (!date) return false;
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Determine header title based on role and view mode
  const getHeaderTitle = () => {
    if (!canViewTeam) return "My Timesheet";
    if (isCompanyOwner) return "Team Timesheets";
    return viewMode === 'my-timesheet' ? "My Timesheet" : "Team Timesheets";
  };

  const getHeaderSubtitle = () => {
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // When using external control (from checkboxes), show actual people count
    const peopleCount = externalContractorIds ? people.length : contractors.length;
    
    if (!canViewTeam) return `${monthName} - ${currentUserName}`;
    if (isCompanyOwner) return `${monthName} - ${peopleCount} ${peopleCount === 1 ? 'contractor' : 'contractors'} selected`;
    if (viewMode === 'my-timesheet') return `${monthName} - ${currentUserName}`;
    return `${monthName} - ${peopleCount} ${peopleCount === 1 ? 'contractor' : 'contractors'} selected`;
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        {/* Header */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="mb-1">{getHeaderTitle()}</h2>
              <p className="text-sm text-muted-foreground">
                {getHeaderSubtitle()}
              </p>
            </div>
            <div className="flex gap-2">
              {people.length === 0 && (
                <Button 
                  variant="default" 
                  size="sm" 
                  className="gap-2"
                  onClick={handleSeedData}
                  disabled={isSeeding}
                >
                  <RefreshCw className={`w-4 h-4 ${isSeeding ? 'animate-spin' : ''}`} />
                  Seed Demo Data
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </div>
        </Card>

        {/* View Mode Toggle - For Agency Owners Only */}
        {canViewTeam && !isCompanyOwner && (
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "my-timesheet" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("my-timesheet")}
              className="gap-2"
            >
              <User className="w-4 h-4" />
              My Timesheets
            </Button>
            <Button
              variant={viewMode === "team-timesheet" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("team-timesheet")}
              className="gap-2"
            >
              <Users className="w-4 h-4" />
              Team Timesheets
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading timesheet data...</p>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && people.length === 0 && (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-3">
              <Calendar className="w-12 h-12 text-muted-foreground" />
              <div className="text-center">
                {externalContractorIds === undefined ? (
                  <>
                    <h3 className="mb-1">Select Contractors</h3>
                    <p className="text-sm text-muted-foreground">
                      Use the checkboxes in the table above to select contractors, then their calendar data will appear here
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="mb-1">No Data Found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Click "Seed Demo Data" to create sample users and timesheet entries
                    </p>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Selection Summary (for multi-day selection only) */}
        {!isLoading && people.length > 0 && selectionCount > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {selectedPeople.size} {selectedPeople.size === 1 ? 'person' : 'people'} viewing
                  {selectionCount > 0 && ` • ${selectionCount} ${selectionCount === 1 ? 'day' : 'days'} selected`}
                </p>
                {selectionCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Bulk operations: {selectedPeople.size} people × {selectionCount} days = {selectedPeople.size * selectionCount} entries
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearDateSelection}
              >
                Clear Date Selection
              </Button>
            </div>
          </Card>
        )}

        {/* Calendar */}
        {!isLoading && people.length > 0 && (
        <div className="overflow-x-auto">
        <Card className="overflow-hidden min-w-[800px]">
          {/* Month Navigation */}
          <div className="p-4 border-b border-border bg-accent/30">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={handlePreviousMonth}>
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <h3 className="m-0">{formatMonthYear(currentDate)}</h3>

              <Button variant="ghost" size="sm" onClick={handleNextMonth}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-4">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2 auto-rows-fr">
              {weeks.map((week, weekIndex) => (
                <Fragment key={weekIndex}>
                  {week.map((date, dayIndex) => {
                    if (!date) {
                      return (
                        <div
                          key={`empty-${weekIndex}-${dayIndex}`}
                          className="aspect-square rounded-lg bg-transparent"
                          aria-hidden="true"
                        />
                      );
                    }

                    const dateKey = formatDateKey(date);
                    const dayData = dayDataMap.get(dateKey) || null;
                    const isSelected = selectedDates.has(dateKey);

                    return (
                      <MultiPersonCalendarCell
                        key={dateKey}
                        date={date}
                        dayData={dayData}
                        isSelected={isSelected}
                        isToday={isToday(date)}
                        isWeekend={isWeekend(date)}
                        onDayClick={handleCellClick}
                        onDragCopy={handleDragCopy}
                        enableDragDrop={true}
                        showVariance={true}
                        showStatusIcons={true}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="border-t border-border p-4 bg-accent/20">
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-success bg-success/10" />
                <span className="text-muted-foreground">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-warning bg-warning/10" />
                <span className="text-muted-foreground">Pending</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning/20 border border-warning/40 flex items-center justify-center text-warning text-[8px] font-bold">
                  ≠
                </div>
                <span className="text-muted-foreground">Hours vary across people</span>
              </div>
            </div>
          </div>
        </Card>
        </div>
        )}

        {/* Day Entry Modal */}
        {selectedDayDate && (
          <MultiPersonDayModal
            open={dayModalOpen}
            onOpenChange={setDayModalOpen}
            date={selectedDayDate}
            entries={timesheetEntriesMap.get(formatDateKey(selectedDayDate)) || []}
            people={people}
            selectedPeopleIds={selectedPeople}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={handleDeleteEntry}
            onBulkUpdate={handleBulkUpdate}
            onSavePersonTasks={handleSavePersonTasks}
            onApplyToOthers={handleApplyToOthers}
            onDeleteAll={() => {
              const dateKey = formatDateKey(selectedDayDate);
              const fullEntries = timesheetEntriesMap.get(dateKey) || [];
              if (fullEntries.length === 0) return;
              
              if (!confirm(`Delete all ${fullEntries.length} entries for this day?`)) return;
              
              Promise.all(fullEntries.map(e => handleDeleteEntry(e.id)))
                .then(() => {
                  toast.success(`Deleted ${fullEntries.length} entries`);
                })
                .catch(() => {
                  toast.error('Failed to delete some entries');
                });
            }}
            userRole="company-owner"
            hourlyRate={75}
          />
        )}

        {/* Drag-Drop Conflict Dialog */}
        <DragDropConflictDialog
          open={conflictDialogOpen}
          onOpenChange={setConflictDialogOpen}
          draggedData={pendingDragData}
          conflicts={detectedConflicts}
          onConfirm={handleConflictResolution}
          onCancel={() => {
            setPendingDragData(null);
            setDetectedConflicts([]);
          }}
        />
      </div>
    </DndProvider>
  );
}

// Helper functions
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDateShort(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${month}/${day}`;
}