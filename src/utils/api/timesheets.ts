import { createClient } from '../supabase/client';

const supabase = createClient();

export interface TimesheetEntry {
  id: string;
  userId: string; // Derived from period -> contract -> user_id
  companyId: string; // Derived from period -> contract -> organization_id
  date: string; // YYYY-MM-DD
  hours: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected'; // Derived from period.status
  projectId?: string | null; // Derived from period -> contract -> project_id
  notes?: string;
  taskId?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  workType?: 'regular' | 'overtime' | 'travel' | 'oncall';
  taskCategory?: string;
  taskDescription?: string;
  billable?: boolean;
  updatedAt: string;
  
  // Additional fields from actual DB schema
  periodId?: string; // For linking back to period
  days?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  initials: string;
  contractId?: string;
  contractRole?: string;
  contractStatus?: string;
}

// ============================================================================
// DIRECT SUPABASE QUERIES (MATCHES ACTUAL DB SCHEMA)
// ============================================================================

/**
 * Get timesheet entries for a user and date range
 * Architecture: User → Contracts → Periods → Entries
 */
export async function getTimesheetEntries(params: {
  userId?: string;
  companyId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<TimesheetEntry[]> {
  try {
    console.log('📊 Fetching timesheet entries with params:', params);
    
    if (!params.userId) {
      // If no userId, just return all entries in date range (for admin views)
      let query = supabase
        .from('timesheet_entries')
        .select('*, timesheet_periods!inner(*, project_contracts!inner(*))');
      
      if (params.startDate) {
        query = query.gte('entry_date', params.startDate);
      }
      if (params.endDate) {
        query = query.lte('entry_date', params.endDate);
      }
      
      const { data, error } = await query.order('entry_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching entries:', error);
        throw new Error(`Failed to fetch entries: ${error.message}`);
      }
      
      return mapDbEntriesToFrontend(data || []);
    }
    
    // Step 1: Get user's contracts
    const { data: contracts, error: contractError } = await supabase
      .from('project_contracts')
      .select('id')
      .eq('user_id', params.userId);
    
    if (contractError) {
      console.error('Error fetching contracts:', contractError);
      throw new Error(`Failed to fetch contracts: ${contractError.message}`);
    }
    
    if (!contracts || contracts.length === 0) {
      console.log('📊 No contracts found for user:', params.userId);
      return [];
    }
    
    const contractIds = contracts.map(c => c.id);
    console.log('📊 Found contracts:', contractIds);
    
    // Step 2: Get periods for those contracts
    let periodQuery = supabase
      .from('timesheet_periods')
      .select('id')
      .in('contract_id', contractIds);
    
    if (params.startDate && params.endDate) {
      periodQuery = periodQuery
        .gte('week_start_date', params.startDate)
        .lte('week_end_date', params.endDate);
    }
    
    const { data: periods, error: periodError } = await periodQuery;
    
    if (periodError) {
      console.error('Error fetching periods:', periodError);
      throw new Error(`Failed to fetch periods: ${periodError.message}`);
    }
    
    if (!periods || periods.length === 0) {
      console.log('📊 No periods found for contracts:', contractIds);
      return [];
    }
    
    const periodIds = periods.map(p => p.id);
    console.log('📊 Found periods:', periodIds);
    
    // Step 3: Get entries for those periods
    let entryQuery = supabase
      .from('timesheet_entries')
      .select('*, timesheet_periods!inner(*, project_contracts!inner(*))')
      .in('period_id', periodIds);
    
    if (params.startDate) {
      entryQuery = entryQuery.gte('entry_date', params.startDate);
    }
    if (params.endDate) {
      entryQuery = entryQuery.lte('entry_date', params.endDate);
    }
    
    const { data, error } = await entryQuery.order('entry_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching entries:', error);
      throw new Error(`Failed to fetch entries: ${error.message}`);
    }
    
    console.log('📊 Found entries:', data?.length || 0);
    
    return mapDbEntriesToFrontend(data || []);
  } catch (error) {
    console.error('Error in getTimesheetEntries:', error);
    throw error;
  }
}

/**
 * Map database entries to frontend format
 */
function mapDbEntriesToFrontend(dbEntries: any[]): TimesheetEntry[] {
  return dbEntries.map(entry => {
    const period = entry.timesheet_periods;
    const contract = period?.project_contracts;
    
    return {
      id: entry.id,
      userId: contract?.user_id || '',
      companyId: contract?.organization_id || '',
      projectId: contract?.project_id || null,
      date: entry.entry_date, // ✅ Use entry_date from DB
      hours: entry.hours || 0,
      status: mapPeriodStatusToEntryStatus(period?.status || 'pending'),
      notes: entry.description, // ✅ Use description from DB
      taskDescription: entry.description,
      billable: entry.billable !== false,
      updatedAt: entry.updated_at,
      periodId: entry.period_id,
    };
  });
}

/**
 * Map period status to entry status
 */
function mapPeriodStatusToEntryStatus(periodStatus: string): 'draft' | 'submitted' | 'approved' | 'rejected' {
  if (periodStatus === 'draft' || periodStatus === 'pending') return 'draft';
  if (periodStatus === 'approved' || periodStatus === 'fully_approved') return 'approved';
  if (periodStatus === 'rejected') return 'rejected';
  return 'submitted';
}

/**
 * Save a timesheet entry
 * This is more complex because we need to find/create the right period first
 */
export async function saveTimesheetEntry(entry: Omit<TimesheetEntry, 'id' | 'updatedAt'>) {
  try {
    console.log('💾 Saving timesheet entry:', entry);
    
    // Step 1: Find the user's contract
    const { data: contracts, error: contractError } = await supabase
      .from('project_contracts')
      .select('id')
      .eq('user_id', entry.userId)
      .eq('organization_id', entry.companyId)
      .limit(1);
    
    if (contractError || !contracts || contracts.length === 0) {
      throw new Error(`No contract found for user ${entry.userId} in company ${entry.companyId}`);
    }
    
    const contractId = contracts[0].id;
    
    // Step 2: Find or create the period for this week
    const weekStart = getWeekStart(entry.date);
    const weekEnd = getWeekEnd(entry.date);
    
    let { data: periods, error: periodError } = await supabase
      .from('timesheet_periods')
      .select('id')
      .eq('contract_id', contractId)
      .eq('week_start_date', weekStart)
      .limit(1);
    
    if (periodError) {
      throw new Error(`Failed to find period: ${periodError.message}`);
    }
    
    let periodId: string;
    
    if (!periods || periods.length === 0) {
      // Create new period
      console.log('📅 Creating new period for week:', weekStart);
      const { data: newPeriod, error: createError } = await supabase
        .from('timesheet_periods')
        .insert({
          id: `period-${contractId}-${weekStart}`,
          contract_id: contractId,
          week_start_date: weekStart,
          week_end_date: weekEnd,
          total_hours: 0,
          status: 'draft', // ✅ Use 'draft' instead of 'pending'
        })
        .select()
        .single();
      
      if (createError || !newPeriod) {
        throw new Error(`Failed to create period: ${createError?.message}`);
      }
      
      periodId = newPeriod.id;
    } else {
      periodId = periods[0].id;
    }
    
    console.log('📅 Using period:', periodId);
    
    // Step 3: Upsert the entry (simplified schema: only id, period_id, entry_date, hours, description, billable)
    const dbEntry = {
      id: entry.taskId || `entry-${periodId}-${entry.date}`,
      period_id: periodId,
      entry_date: entry.date, // ✅ Use entry_date column
      hours: entry.hours,
      description: entry.notes || entry.taskDescription || 'Work', // ✅ Use description column
      billable: entry.billable !== false,
      updated_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('timesheet_entries')
      .upsert(dbEntry)
      .select('*, timesheet_periods!inner(*, project_contracts!inner(*))')
      .single();
    
    if (error) {
      console.error('❌ Failed to save entry:', error);
      throw new Error(`Failed to save entry: ${error.message}`);
    }
    
    console.log('✅ Saved entry:', data.id);
    
    // Step 4: Update period total hours
    await updatePeriodTotalHours(periodId);
    
    return mapDbEntriesToFrontend([data])[0];
  } catch (error) {
    console.error('❌ Failed to save entry:', error);
    throw error;
  }
}

/**
 * Update the total hours for a period
 */
async function updatePeriodTotalHours(periodId: string) {
  const { data: entries } = await supabase
    .from('timesheet_entries')
    .select('hours')
    .eq('period_id', periodId);
  
  const totalHours = (entries || []).reduce((sum, e) => sum + (e.hours || 0), 0);
  
  await supabase
    .from('timesheet_periods')
    .update({ total_hours: totalHours })
    .eq('id', periodId);
}

/**
 * Get Monday of the week for a given date
 */
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Get Sunday of the week for a given date
 */
function getWeekEnd(dateStr: string): string {
  const weekStart = getWeekStart(dateStr);
  const monday = new Date(weekStart + 'T00:00:00');
  const sunday = new Date(monday.setDate(monday.getDate() + 6));
  return sunday.toISOString().split('T')[0];
}

// Bulk save timesheet entries (for drag-copy operations)
export async function bulkSaveTimesheetEntries(entries: Omit<TimesheetEntry, 'id' | 'updatedAt'>[]) {
  console.log('💾 Bulk saving entries:', entries.length);
  const savedEntries = [];
  
  for (const entry of entries) {
    const saved = await saveTimesheetEntry(entry);
    savedEntries.push(saved);
  }
  
  return savedEntries;
}

// Delete a timesheet entry
export async function deleteTimesheetEntry(userId: string, date: string) {
  try {
    // Find entries for this user and date
    const entries = await getTimesheetEntries({ userId, startDate: date, endDate: date });
    
    for (const entry of entries) {
      if (entry.periodId) {
        await supabase
          .from('timesheet_entries')
          .delete()
          .eq('id', entry.id);
        
        // Update period totals
        await updatePeriodTotalHours(entry.periodId);
      }
    }
  } catch (error) {
    console.error('Failed to delete entry:', error);
    throw error;
  }
}

// Update a timesheet entry by ID
export async function updateTimesheetEntry(entryId: string, updates: Partial<Omit<TimesheetEntry, 'id' | 'userId' | 'companyId'>>) {
  try {
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (updates.date) dbUpdates.date = updates.date;
    if (updates.hours !== undefined) dbUpdates.hours = updates.hours;
    if (updates.days !== undefined) dbUpdates.days = updates.days;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.taskCategory !== undefined) dbUpdates.task_category = updates.taskCategory;
    if (updates.taskDescription !== undefined) dbUpdates.task_description = updates.taskDescription;
    if (updates.workType) dbUpdates.work_type = updates.workType;
    if (updates.billable !== undefined) dbUpdates.billable = updates.billable;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.breakMinutes !== undefined) dbUpdates.break_minutes = updates.breakMinutes;
    
    const { data, error } = await supabase
      .from('timesheet_entries')
      .update(dbUpdates)
      .eq('id', entryId)
      .select('*, timesheet_periods!inner(*, project_contracts!inner(*))')
      .single();
    
    if (error) {
      throw new Error(`Failed to update entry: ${error.message}`);
    }
    
    // Update period totals
    if (data.period_id) {
      await updatePeriodTotalHours(data.period_id);
    }
    
    return mapDbEntriesToFrontend([data])[0];
  } catch (error) {
    console.error('Failed to update entry:', error);
    throw error;
  }
}

// Delete a timesheet entry by ID
export async function deleteTimesheetEntryById(entryId: string) {
  try {
    // Get entry to find its period
    const { data: entry } = await supabase
      .from('timesheet_entries')
      .select('period_id')
      .eq('id', entryId)
      .single();
    
    const periodId = entry?.period_id;
    
    const { error } = await supabase
      .from('timesheet_entries')
      .delete()
      .eq('id', entryId);
    
    if (error) {
      throw new Error(`Failed to delete entry: ${error.message}`);
    }
    
    // Update period totals
    if (periodId) {
      await updatePeriodTotalHours(periodId);
    }
  } catch (error) {
    console.error('Failed to delete entry:', error);
    throw error;
  }
}

// Create a new timesheet entry
export interface TimesheetEntryInput {
  userId: string;
  companyId: string;
  date: string;
  hours: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  projectId?: string | null;
  notes?: string;
}

export async function createTimesheetEntry(entry: TimesheetEntryInput) {
  return saveTimesheetEntry(entry);
}

// ============================================================================
// SEED DEMO DATA (for testing)
// ============================================================================

export async function seedDemoData() {
  console.log('🌱 Seed demo data called - this is a placeholder');
  console.log('📝 Use the DatabaseSetupPage to seed data instead');
  
  // This function is called from MultiPersonTimesheetCalendar
  // but the actual seeding should be done through DatabaseSetupPage
  // which has the full seed SQL
  
  throw new Error('Please use the Database Setup page to seed demo data');
}