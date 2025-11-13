import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import { format, endOfMonth } from 'date-fns';
import { 
  getTimesheetEntries, 
  createTimesheetEntry, 
  updateTimesheetEntry, 
  deleteTimesheetEntryById,
  type TimesheetEntry,
  type TimesheetEntryInput,
} from '../../../utils/api/timesheets';

interface UseTimesheetStateOptions {
  ownerId?: string;
  initialMonth?: Date;
}

interface DayData {
  dateKey: string;
  date: Date;
  entries: TimesheetEntry[];
  totalHours: number;
  hasVariance: boolean;
  peopleCount: number;
  statuses: Set<string>;
}

interface ConflictEntry {
  personId: string;
  personName: string;
  existingEntry: TimesheetEntry;
  newEntry: Partial<TimesheetEntry>;
}

export type ConflictResolution = 'replace' | 'merge' | 'skip';

export function useTimesheetState(options: UseTimesheetStateOptions = {}) {
  const { ownerId, initialMonth = new Date() } = options;

  // Core state
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());

  // Optimistic update tracking
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, TimesheetEntry>>(new Map());

  // Load entries for current month
  const loadEntries = useCallback(async (month?: Date) => {
    setIsLoading(true);
    try {
      const targetMonth = month || currentMonth;
      
      const startDate = format(targetMonth, 'yyyy-MM-01');
      const endDate = format(endOfMonth(targetMonth), 'yyyy-MM-dd');

      const result = await getTimesheetEntries({
        companyId: ownerId,
        startDate,
        endDate,
      });
      setEntries(result);
    } catch (error) {
      console.error('Failed to load timesheet entries:', error);
      toast.error('Failed to load entries. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, ownerId]);

  // Add new entry
  const addEntry = useCallback(async (entryData: TimesheetEntryInput) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticEntry: TimesheetEntry = {
      id: tempId,
      ...entryData,
      status: entryData.status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as TimesheetEntry;

    // Optimistic update
    setEntries(prev => [...prev, optimisticEntry]);
    setPendingUpdates(prev => new Map(prev).set(tempId, optimisticEntry));

    try {
      const newEntry = await createTimesheetEntry(entryData);
      
      // Replace optimistic entry with real one
      setEntries(prev => prev.map(e => e.id === tempId ? newEntry : e));
      setPendingUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(tempId);
        return updated;
      });

      toast.success('Entry added successfully');
      return newEntry;
    } catch (error) {
      console.error('Failed to add entry:', error);
      
      // Rollback optimistic update
      setEntries(prev => prev.filter(e => e.id !== tempId));
      setPendingUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(tempId);
        return updated;
      });

      toast.error('Failed to add entry. Please try again.');
      throw error;
    }
  }, []);

  // Update existing entry
  const updateEntry = useCallback(async (entryId: string, updates: Partial<TimesheetEntryInput>) => {
    const originalEntry = entries.find(e => e.id === entryId);
    if (!originalEntry) return;

    const optimisticEntry = { ...originalEntry, ...updates };

    // Optimistic update
    setEntries(prev => prev.map(e => e.id === entryId ? optimisticEntry : e));
    setPendingUpdates(prev => new Map(prev).set(entryId, optimisticEntry));

    try {
      const updatedEntry = await updateTimesheetEntry(entryId, updates);
      
      // Replace with server response
      setEntries(prev => prev.map(e => e.id === entryId ? updatedEntry : e));
      setPendingUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(entryId);
        return updated;
      });

      toast.success('Entry updated successfully');
      return updatedEntry;
    } catch (error) {
      console.error('Failed to update entry:', error);
      
      // Rollback
      setEntries(prev => prev.map(e => e.id === entryId ? originalEntry : e));
      setPendingUpdates(prev => {
        const updated = new Map(prev);
        updated.delete(entryId);
        return updated;
      });

      toast.error('Failed to update entry. Please try again.');
      throw error;
    }
  }, [entries]);

  // Delete entry
  const deleteEntry = useCallback(async (entryId: string) => {
    const originalEntry = entries.find(e => e.id === entryId);
    if (!originalEntry) return;

    // Optimistic update
    setEntries(prev => prev.filter(e => e.id !== entryId));

    try {
      await deleteTimesheetEntryById(entryId);
      toast.success('Entry deleted successfully');
    } catch (error) {
      console.error('Failed to delete entry:', error);
      
      // Rollback
      setEntries(prev => [...prev, originalEntry]);
      toast.error('Failed to delete entry. Please try again.');
      throw error;
    }
  }, [entries]);

  // Bulk update multiple entries
  const bulkUpdate = useCallback(async (
    entryIds: string[], 
    updates: Partial<TimesheetEntryInput>
  ) => {
    const originalEntries = entries.filter(e => entryIds.includes(e.id));
    
    // Optimistic update
    setEntries(prev => prev.map(e => 
      entryIds.includes(e.id) ? { ...e, ...updates } : e
    ));

    try {
      // Update each entry (in real app, could be a batch API endpoint)
      await Promise.all(
        entryIds.map(id => updateTimesheetEntry(id, updates))
      );

      toast.success(`${entryIds.length} entries updated successfully`);
    } catch (error) {
      console.error('Failed to bulk update entries:', error);
      
      // Rollback
      setEntries(prev => prev.map(e => {
        const original = originalEntries.find(o => o.id === e.id);
        return original || e;
      }));

      toast.error('Failed to update entries. Please try again.');
      throw error;
    }
  }, [entries]);

  // Copy entries to target dates
  const copyEntries = useCallback(async (
    sourceEntries: TimesheetEntry[],
    targetDates: string[],
    resolution: ConflictResolution = 'skip'
  ) => {
    const newEntries: TimesheetEntryInput[] = [];

    for (const sourceEntry of sourceEntries) {
      for (const targetDate of targetDates) {
        // Check for conflicts
        const conflict = entries.find(e => 
          e.personId === sourceEntry.personId && 
          e.date === targetDate
        );

        if (conflict) {
          if (resolution === 'skip') continue;
          if (resolution === 'replace') {
            await deleteEntry(conflict.id);
          }
          // If 'merge', we'll create both entries
        }

        newEntries.push({
          ownerId: sourceEntry.ownerId,
          personId: sourceEntry.personId,
          personName: sourceEntry.personName,
          date: targetDate,
          hours: sourceEntry.hours,
          task: sourceEntry.task,
          notes: sourceEntry.notes,
          status: sourceEntry.status,
          contractId: sourceEntry.contractId,
        });
      }
    }

    // Create all new entries
    try {
      await Promise.all(newEntries.map(entry => addEntry(entry)));
      toast.success(`Copied ${sourceEntries.length} entries to ${targetDates.length} days`);
    } catch (error) {
      console.error('Failed to copy entries:', error);
      toast.error('Failed to copy entries. Please try again.');
      throw error;
    }
  }, [entries, addEntry, deleteEntry]);

  // Get day data for a specific date
  const getDayData = useCallback((dateKey: string): DayData | null => {
    const dayEntries = entries.filter(e => e.date === dateKey);
    
    if (dayEntries.length === 0) return null;

    const totalHours = dayEntries.reduce((sum, e) => sum + e.hours, 0);
    const hours = dayEntries.map(e => e.hours);
    const avgHours = totalHours / dayEntries.length;
    const hasVariance = hours.some(h => Math.abs(h - avgHours) > 0.5);

    const statuses = new Set(dayEntries.map(e => e.status));

    // Parse date
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return {
      dateKey,
      date,
      entries: dayEntries,
      totalHours,
      hasVariance,
      peopleCount: dayEntries.length,
      statuses,
    };
  }, [entries]);

  // Detect conflicts for copy operation
  const detectConflicts = useCallback((
    sourceEntries: TimesheetEntry[],
    targetDate: string
  ): ConflictEntry[] => {
    const conflicts: ConflictEntry[] = [];

    for (const sourceEntry of sourceEntries) {
      const existing = entries.find(e => 
        e.personId === sourceEntry.personId && 
        e.date === targetDate
      );

      if (existing) {
        conflicts.push({
          personId: sourceEntry.personId,
          personName: sourceEntry.personName,
          existingEntry: existing,
          newEntry: {
            hours: sourceEntry.hours,
            task: sourceEntry.task,
            notes: sourceEntry.notes,
          },
        });
      }
    }

    return conflicts;
  }, [entries]);

  // Get entries for selected people
  const getEntriesForPeople = useCallback((peopleIds: string[]) => {
    return entries.filter(e => peopleIds.includes(e.personId));
  }, [entries]);

  // Get entries for date range
  const getEntriesForDateRange = useCallback((startDate: string, endDate: string) => {
    return entries.filter(e => e.date >= startDate && e.date <= endDate);
  }, [entries]);

  // Computed values
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    const dateKeys = new Set(entries.map(e => e.date));
    
    dateKeys.forEach(dateKey => {
      const data = getDayData(dateKey);
      if (data) map.set(dateKey, data);
    });

    return map;
  }, [entries, getDayData]);

  const hasPendingUpdates = pendingUpdates.size > 0;

  return {
    // State
    entries,
    isLoading,
    currentMonth,
    selectedPeople,
    selectedDays,
    hasPendingUpdates,

    // Setters
    setCurrentMonth,
    setSelectedPeople,
    setSelectedDays,

    // Actions
    loadEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    bulkUpdate,
    copyEntries,

    // Queries
    getDayData,
    detectConflicts,
    getEntriesForPeople,
    getEntriesForDateRange,
    
    // Computed
    dayDataMap,
  };
}