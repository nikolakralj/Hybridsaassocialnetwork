/**
 * React Query Hooks for Timesheet Entry Management
 * 
 * Provides hooks for individual contractors to manage their timesheet entries.
 * Integrates with the approval system via shared database.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from './timesheets';
import type { TimesheetEntry } from './timesheets';

// ============================================================================
// QUERY KEYS (for cache management)
// ============================================================================

export const timesheetQueryKeys = {
  entries: ['timesheet-entries'] as const,
  entriesByUser: (userId: string) => ['timesheet-entries', 'user', userId] as const,
  entriesByPeriod: (userId: string, startDate: string, endDate: string) => 
    ['timesheet-entries', 'user', userId, 'period', startDate, endDate] as const,
};

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Fetch timesheet entries for a specific user and date range
 * Used by the timesheet calendar to display entries
 */
export function useTimesheetEntries(params: {
  userId: string;
  companyId?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}, options?: Omit<UseQueryOptions<TimesheetEntry[], Error>, 'queryKey' | 'queryFn'>) {
  return useQuery<TimesheetEntry[], Error>({
    queryKey: timesheetQueryKeys.entriesByPeriod(params.userId, params.startDate, params.endDate),
    queryFn: () => api.getTimesheetEntries(params),
    staleTime: 30 * 1000, // 30 seconds - fresh data for active entry
    ...options,
  });
}

/**
 * Fetch all entries for a user (no date filter)
 */
export function useUserTimesheetEntries(
  userId: string,
  companyId?: string,
  options?: Omit<UseQueryOptions<TimesheetEntry[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TimesheetEntry[], Error>({
    queryKey: timesheetQueryKeys.entriesByUser(userId),
    queryFn: () => api.getTimesheetEntries({ userId, companyId }),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Save a single timesheet entry (create or update)
 */
export function useSaveTimesheetEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (entry: Omit<TimesheetEntry, 'id' | 'updatedAt'>) => 
      api.saveTimesheetEntry(entry),
    
    onSuccess: (savedEntry, variables) => {
      // Invalidate all entry queries for this user
      queryClient.invalidateQueries({ 
        queryKey: timesheetQueryKeys.entriesByUser(variables.userId) 
      });
      
      // Also invalidate period-specific queries
      queryClient.invalidateQueries({ 
        queryKey: ['timesheet-entries', 'user', variables.userId] 
      });
      
      // Invalidate approval system queries so drawer shows updated data
      queryClient.invalidateQueries({ 
        queryKey: ['entries'] 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ['periods'] 
      });
      
      toast.success('Entry saved', {
        description: 'Your timesheet entry has been saved.',
      });
    },
    
    onError: (error: Error) => {
      console.error('Failed to save timesheet entry:', error);
      toast.error('Failed to save entry', {
        description: error.message,
      });
    },
  });
}

/**
 * Bulk save multiple timesheet entries
 * Useful for drag-copy operations
 */
export function useBulkSaveTimesheetEntries() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (entries: Omit<TimesheetEntry, 'id' | 'updatedAt'>[]) => 
      api.bulkSaveTimesheetEntries(entries),
    
    onSuccess: (savedEntries, variables) => {
      // Get unique user IDs from the saved entries
      const userIds = [...new Set(variables.map(e => e.userId))];
      
      // Invalidate queries for all affected users
      userIds.forEach(userId => {
        queryClient.invalidateQueries({ 
          queryKey: timesheetQueryKeys.entriesByUser(userId) 
        });
      });
      
      // Invalidate approval system queries
      queryClient.invalidateQueries({ 
        queryKey: ['entries'] 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ['periods'] 
      });
      
      toast.success(`${savedEntries.length} entries saved`, {
        description: 'Your timesheet entries have been saved.',
      });
    },
    
    onError: (error: Error) => {
      console.error('Failed to bulk save timesheet entries:', error);
      toast.error('Failed to save entries', {
        description: error.message,
      });
    },
  });
}

/**
 * Delete a timesheet entry
 */
export function useDeleteTimesheetEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ entryId, userId }: { entryId: string; userId: string }) => {
      // TODO: Implement delete API endpoint
      throw new Error('Delete endpoint not yet implemented');
    },
    
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: timesheetQueryKeys.entriesByUser(variables.userId) 
      });
      
      // Invalidate approval system queries
      queryClient.invalidateQueries({ 
        queryKey: ['entries'] 
      });
      
      toast.success('Entry deleted', {
        description: 'Your timesheet entry has been deleted.',
      });
    },
    
    onError: (error: Error) => {
      console.error('Failed to delete timesheet entry:', error);
      toast.error('Failed to delete entry', {
        description: error.message,
      });
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to convert entries to a Map keyed by date
 * Used by TimesheetCalendarView
 */
export function entriesToDateMap(entries: TimesheetEntry[]): Map<string, TimesheetEntry[]> {
  const map = new Map<string, TimesheetEntry[]>();
  
  entries.forEach(entry => {
    const existing = map.get(entry.date) || [];
    map.set(entry.date, [...existing, entry]);
  });
  
  return map;
}

/**
 * Helper to format date for API calls
 */
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}
