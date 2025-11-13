import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { registerEmailRoutes } from "./email.tsx"; // ✅ Phase 5 Day 8: Email sending
import { registerApprovalRoutes } from "./approvals.tsx"; // ✅ Phase 5 Days 9-10: Approval execution

// Force rebuild - 2025-01-23-v3
const app = new Hono();

// Create Supabase client for auth
const getSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-f8b491be/health", (c) => {
  return c.json({ status: "ok" });
});

// ============================================================
// AUTHENTICATION ENDPOINTS
// ============================================================

// Sign up new user
app.post("/make-server-f8b491be/auth/signup", async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    
    const supabase = getSupabaseClient();
    
    // Create user in Supabase Auth
    // Automatically confirm email since email server hasn't been configured
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      email_confirm: true,
    });
    
    if (authError) {
      console.log(`Auth error during signup: ${authError.message}`);
      return c.json({ error: authError.message }, 400);
    }
    
    // Store user profile in KV store
    await kv.set(`user:${authData.user.id}`, {
      id: authData.user.id,
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    });
    
    return c.json({ 
      user: authData.user,
      message: 'User created successfully' 
    });
  } catch (error) {
    console.log(`Error in signup: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================
// TIMESHEET ENDPOINTS
// ============================================================

// Get timesheet entries for a user/company in a date range
app.get("/make-server-f8b491be/timesheets", async (c) => {
  try {
    const userId = c.req.query('userId');
    const companyId = c.req.query('companyId');
    const startDate = c.req.query('startDate'); // YYYY-MM-DD
    const endDate = c.req.query('endDate'); // YYYY-MM-DD
    
    console.log('📥 GET /timesheets (SUPABASE) - Query params:', { userId, companyId, startDate, endDate });
    
    const supabase = getSupabaseClient();
    
    // Query timesheet_entries from Supabase
    let query = supabase
      .from('timesheet_entries')
      .select(`
        *,
        period:timesheet_periods!inner(
          contract_id,
          status,
          week_start_date,
          week_end_date,
          contract:project_contracts!inner(
            user_id,
            user_name,
            organization_id
          )
        )
      `);
    
    // Filter by userId if provided
    if (userId) {
      query = query.eq('period.contract.user_id', userId);
    }
    
    // Filter by date range
    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }
    
    const { data: entries, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching timesheet entries:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log(`✅ Returning ${entries?.length || 0} entries from Supabase`);
    
    // Transform entries to match expected format
    const transformedEntries = (entries || []).map((entry: any) => ({
      id: entry.id,
      userId: entry.period.contract.user_id,
      companyId: entry.period.contract.organization_id,
      date: entry.date,
      hours: parseFloat(entry.hours),
      status: entry.period.status,
      projectId: entry.period.contract.project_id,
      notes: entry.notes || '',
      taskId: entry.task_id,
      startTime: entry.start_time,
      endTime: entry.end_time,
      breakMinutes: entry.break_minutes || 0,
      workType: entry.work_type || 'regular',
      taskCategory: entry.task_category || 'Development',
      taskDescription: entry.task_description || '',
      billable: entry.billable !== false,
      updatedAt: entry.updated_at,
    }));
    
    return c.json({ entries: transformedEntries });
  } catch (error) {
    console.error('❌ Error in GET /timesheets:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Create/Update timesheet entry
app.post("/make-server-f8b491be/timesheets", async (c) => {
  try {
    const { userId, companyId, date, hours, status, projectId, notes, taskId, startTime, endTime, breakMinutes, workType, taskCategory, taskDescription, billable } = await c.req.json();
    
    console.log('🔍 SERVER: Received timesheet POST (PURE SUPABASE):', {
      userId,
      companyId,
      date,
      hours,
      status,
      workType,
      taskCategory,
      taskDescription,
      billable,
      startTime,
      endTime,
      breakMinutes,
    });
    
    if (!userId || !date || hours === undefined) {
      return c.json({ error: 'Missing required fields: userId, date, hours' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // Find the user's contract
    const { data: contracts, error: contractError } = await supabase
      .from('project_contracts')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    
    if (contractError || !contracts || contracts.length === 0) {
      console.error('❌ No contract found for user:', userId);
      return c.json({ error: 'No contract found for user' }, 404);
    }
    
    const contract = contracts[0];
    
    // Determine week boundaries (Monday to Sunday)
    const dateObj = new Date(date + 'T12:00:00');
    const dayOfWeek = dateObj.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    const weekStartDate = new Date(dateObj);
    weekStartDate.setDate(dateObj.getDate() - daysToMonday);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    
    const weekStart = weekStartDate.toISOString().split('T')[0];
    const weekEnd = weekEndDate.toISOString().split('T')[0];
    
    console.log(`📅 Week: ${weekStart} to ${weekEnd}`);
    
    // Find or create period
    let { data: periods } = await supabase
      .from('timesheet_periods')
      .select('*')
      .eq('contract_id', contract.id)
      .eq('week_start_date', weekStart)
      .eq('week_end_date', weekEnd);
    
    let period;
    if (!periods || periods.length === 0) {
      const { data: newPeriod } = await supabase
        .from('timesheet_periods')
        .insert({
          id: crypto.randomUUID(),
          contract_id: contract.id,
          week_start_date: weekStart,
          week_end_date: weekEnd,
          total_hours: 0,
          status: 'pending',
        })
        .select()
        .single();
      period = newPeriod;
      console.log(`✅ Created period: ${period?.id}`);
    } else {
      period = periods[0];
    }
    
    // Check if entry already exists
    const uniqueTaskId = taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entryId = `${userId.replace(/[^a-zA-Z0-9]/g, '-')}-${date}-${uniqueTaskId}`;
    
    const { data: existingEntries } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('period_id', period.id)
      .eq('date', date)
      .eq('task_id', uniqueTaskId);
    
    const existingEntry = existingEntries && existingEntries.length > 0 ? existingEntries[0] : null;
    const oldHours = existingEntry ? parseFloat(existingEntry.hours || 0) : 0;
    const newHours = parseFloat(hours);
    const hoursDelta = newHours - oldHours;
    
    console.log(`📊 Hours change: ${oldHours}h → ${newHours}h (delta: ${hoursDelta > 0 ? '+' : ''}${hoursDelta}h)`);
    
    // Update period total hours
    const currentTotal = parseFloat(period.total_hours || 0);
    const newTotal = Math.max(0, currentTotal + hoursDelta); // Ensure non-negative
    
    console.log(`📊 Updating period total: ${currentTotal}h + ${hoursDelta}h = ${newTotal}h`);
    
    await supabase
      .from('timesheet_periods')
      .update({ total_hours: newTotal })
      .eq('id', period.id);
    
    console.log(`✅ Updated period total: ${newTotal}h`);
    
    // Create or update timesheet entry
    const entryData = {
      id: entryId,
      period_id: period.id, // ✅ Link to timesheet_periods
      user_id: userId, // ✅ Add user_id for direct queries
      company_id: companyId || null, // ✅ Add company_id
      project_id: projectId || 'proj-alpha', // ✅ Add project_id
      date: date,
      hours: newHours,
      status: status || 'draft', // ✅ Add status
      notes: notes || '',
      task_id: uniqueTaskId,
      start_time: startTime || null,
      end_time: endTime || null,
      break_minutes: breakMinutes || 0,
      work_type: workType || 'regular',
      task_category: taskCategory || 'Development',
      task_description: taskDescription || '',
      billable: billable !== undefined ? billable : true,
      updated_at: new Date().toISOString(),
    };
    
    if (existingEntry) {
      // Update existing entry
      await supabase
        .from('timesheet_entries')
        .update(entryData)
        .eq('id', existingEntry.id);
      console.log(`✅ Updated entry: ${entryId}`);
    } else {
      // Create new entry
      await supabase
        .from('timesheet_entries')
        .insert(entryData);
      console.log(`✅ Created entry: ${entryId}`);
    }
    
    return c.json({ entry: entryData });
  } catch (error) {
    console.log(`Error creating timesheet: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Bulk create/update timesheet entries (for drag-copy operations)
app.post("/make-server-f8b491be/timesheets/bulk", async (c) => {
  try {
    const { entries } = await c.req.json();
    
    if (!Array.isArray(entries) || entries.length === 0) {
      return c.json({ error: 'entries array required' }, 400);
    }
    
    const savedEntries = [];
    
    for (const entry of entries) {
      const { userId, companyId, date, hours, status, projectId, notes, taskId, startTime, endTime, breakMinutes, workType, taskCategory, taskDescription, billable } = entry;
      
      if (!userId || !date || hours === undefined) {
        continue; // Skip invalid entries
      }
      
      // Support multi-task entries
      const uniqueTaskId = taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const entryId = `${userId}:${date}:${uniqueTaskId}`;
      
      const savedEntry = {
        id: entryId,
        userId,
        companyId,
        date,
        hours,
        status: status || 'draft',
        projectId: projectId || null,
        notes: notes || '',
        taskId: uniqueTaskId,
        // ✅ Include time tracking fields
        startTime: startTime || null,
        endTime: endTime || null,
        breakMinutes: breakMinutes || 0,
        // ✅ Include task category, description and work type
        workType: workType || 'regular',
        taskCategory: taskCategory || 'Development',
        taskDescription: taskDescription || '',
        billable: billable !== undefined ? billable : true,
        updatedAt: new Date().toISOString(),
      };
      
      await kv.set(`timesheet:${userId}:${date}:${uniqueTaskId}`, savedEntry);
      
      savedEntries.push(savedEntry);
    }
    
    return c.json({ entries: savedEntries, count: savedEntries.length });
  } catch (error) {
    console.log(`Error in bulk timesheet creation: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Bulk apply timesheet template to multiple people
app.post("/make-server-f8b491be/timesheets/bulk-apply", async (c) => {
  try {
    console.log('\n🚀 ========== BULK APPLY REQUEST START ==========');
    
    const requestBody = await c.req.json();
    console.log('📥 Request body:', JSON.stringify(requestBody, null, 2));
    
    const { templatePersonId, templateDate, targetPersonIds, dateRangeType, overwriteExisting, companyId } = requestBody;
    
    if (!templatePersonId || !templateDate || !Array.isArray(targetPersonIds) || targetPersonIds.length === 0) {
      console.log('❌ Validation failed: Missing required fields');
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    console.log(`📋 Bulk apply validated:`);
    console.log(`   Template Person: ${templatePersonId}`);
    console.log(`   Template Date: ${templateDate}`);
    console.log(`   Target Persons: ${targetPersonIds.join(', ')} (${targetPersonIds.length} total)`);
    console.log(`   Date Range Type: ${dateRangeType}`);
    console.log(`   Overwrite Existing: ${overwriteExisting}`);
    console.log(`   Company ID: ${companyId || 'not specified'}`);
    
    // Get template entries for the source person
    const lookupKey = `timesheet:${templatePersonId}:${templateDate}:`;
    console.log(`🔍 Looking for template entries with prefix: "${lookupKey}"`);
    
    const templateEntries = await kv.getByPrefix(lookupKey);
    
    console.log(`📊 Found ${templateEntries.length} template entries`);
    if (templateEntries.length > 0) {
      templateEntries.forEach((entry, i) => {
        console.log(`   Entry ${i + 1}: ${entry.hours}h - ${entry.taskCategory || 'Development'}`);
      });
    }
    
    if (templateEntries.length === 0) {
      console.log('❌ No template entries found - aborting');
      return c.json({ error: 'No template entries found' }, 404);
    }
    
    console.log(`Found ${templateEntries.length} template entries`);
    
    // Calculate date range
    const getDateRange = (baseDate: string): string[] => {
      console.log(`🔍 getDateRange called with: baseDate="${baseDate}", dateRangeType="${dateRangeType}"`);
      
      if (dateRangeType === 'day') {
        console.log(`  → Returning single day: [${baseDate}]`);
        return [baseDate];
      }
      
      // Parse date components from YYYY-MM-DD format to avoid timezone issues
      const [yearStr, monthStr, dayStr] = baseDate.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // JS months are 0-indexed
      const day = parseInt(dayStr, 10);
      
      console.log(`  📅 Parsed date: year=${year}, month=${month + 1}, day=${day}`);
      
      if (dateRangeType === 'week') {
        // Week: From current date to end of month
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
        console.log(`  📅 Rest of month: from day ${day} to day ${lastDayOfMonth}`);
        
        const dates: string[] = [];
        for (let d = day; d <= lastDayOfMonth; d++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          dates.push(dateStr);
        }
        console.log(`  → Returning ${dates.length} dates for "rest of month"`);
        return dates;
      }
      
      // Month: Full month (1st to last day)
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      console.log(`  📅 Full month: from day 1 to day ${lastDayOfMonth} (${lastDayOfMonth} total days)`);
      
      const dates: string[] = [];
      for (let d = 1; d <= lastDayOfMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        dates.push(dateStr);
      }
      console.log(`  → Returning ${dates.length} dates for "full month"`);
      return dates;
    };
    
    const dates = getDateRange(templateDate);
    console.log(`📅 Calculated date range (${dateRangeType}): ${dates.length} days`);
    console.log(`📅 Dates: ${dates.join(', ')}`);
    console.log(`👥 Target persons: ${targetPersonIds.join(', ')}`);
    console.log(`⚙️  Overwrite existing: ${overwriteExisting}`);
    
    const createdEntries = [];
    let skippedCount = 0;
    let overwrittenCount = 0;
    
    // Apply template to each target person and each date
    for (const targetPersonId of targetPersonIds) {
      console.log(`\n👤 Processing target person: ${targetPersonId}`);
      
      for (const date of dates) {
        console.log(`  📆 Processing date: ${date}`);
        
        // If overwriting, delete all existing entries for this person/date first
        if (overwriteExisting) {
          const existingEntries = await kv.getByPrefix(`timesheet:${targetPersonId}:${date}:`);
          if (existingEntries.length > 0) {
            console.log(`    🗑️  Deleting ${existingEntries.length} existing entries for ${date}`);
            for (const existing of existingEntries) {
              const key = `timesheet:${targetPersonId}:${date}:${existing.taskId}`;
              await kv.del(key);
              overwrittenCount++;
            }
          }
        } else {
          // Check if any entries exist for this person/date
          const existingEntries = await kv.getByPrefix(`timesheet:${targetPersonId}:${date}:`);
          if (existingEntries.length > 0) {
            console.log(`    ⏭️  Skipping date ${date} - ${existingEntries.length} entries already exist`);
            skippedCount += templateEntries.length; // Skip all template entries for this date
            continue; // Skip to next date
          }
        }
        
        // Create entries from template
        for (const templateEntry of templateEntries) {
          const newTaskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newEntryId = `${targetPersonId}:${date}:${newTaskId}`;
          
          const newEntry = {
            id: newEntryId,
            userId: targetPersonId,
            companyId: companyId || templateEntry.companyId,
            date: date,
            hours: templateEntry.hours,
            status: 'draft', // Always create as draft
            projectId: templateEntry.projectId,
            notes: templateEntry.notes || '',
            taskId: newTaskId,
            // ✅ Copy ALL fields from template entry
            startTime: templateEntry.startTime || null,
            endTime: templateEntry.endTime || null,
            breakMinutes: templateEntry.breakMinutes || 0,
            workType: templateEntry.workType || 'regular',
            taskCategory: templateEntry.taskCategory || 'Development',
            taskDescription: templateEntry.taskDescription || '',
            billable: templateEntry.billable !== undefined ? templateEntry.billable : true,
            updatedAt: new Date().toISOString(),
          };
          
          console.log(`    ✅ Creating entry: ${newEntry.hours}h - ${newEntry.taskCategory || 'Development'}`);
          await kv.set(`timesheet:${targetPersonId}:${date}:${newTaskId}`, newEntry);
          createdEntries.push(newEntry);
        }
      }
    }
    
    console.log(`\n✅ BULK APPLY COMPLETE:`);
    console.log(`   📝 Created: ${createdEntries.length} entries`);
    console.log(`   🗑️  Overwritten: ${overwrittenCount} entries`);
    console.log(`   ⏭️  Skipped: ${skippedCount} entries`);
    
    return c.json({ 
      created: createdEntries.length,
      skipped: skippedCount,
      overwritten: overwrittenCount,
      entries: createdEntries 
    });
  } catch (error) {
    console.log(`Error in bulk apply: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Update timesheet entry by ID (Phase 1C)
app.put("/make-server-f8b491be/timesheets/:entryId", async (c) => {
  try {
    const entryId = c.req.param('entryId');
    const updates = await c.req.json();
    
    console.log('📝 PUT /timesheets - Updating entry:', entryId);
    
    const supabase = getSupabaseClient();
    
    // Query the entry directly by ID
    const { data: existingEntry, error: fetchError } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();
    
    if (fetchError) {
      console.error('Error fetching entry:', fetchError);
      return c.json({ error: 'Failed to fetch entry', details: fetchError.message }, 500);
    }
    
    if (!existingEntry) {
      console.error('Entry not found:', entryId);
      return c.json({ error: 'Entry not found' }, 404);
    }
    
    // Calculate hours delta for period update
    const oldHours = parseFloat(existingEntry.hours || 0);
    const newHours = updates.hours !== undefined ? parseFloat(updates.hours) : oldHours;
    const hoursDelta = newHours - oldHours;
    
    console.log(`📊 Hours change: ${oldHours}h → ${newHours}h (delta: ${hoursDelta > 0 ? '+' : ''}${hoursDelta}h)`);
    
    // Update the entry
    const { data: updatedEntry, error: updateError } = await supabase
      .from('timesheet_entries')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entryId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating entry:', updateError);
      return c.json({ error: 'Failed to update entry', details: updateError.message }, 500);
    }
    
    // Update period total hours if hours changed
    if (hoursDelta !== 0 && existingEntry.period_id) {
      const { data: period } = await supabase
        .from('timesheet_periods')
        .select('total_hours')
        .eq('id', existingEntry.period_id)
        .single();
      
      if (period) {
        const currentTotal = parseFloat(period.total_hours || 0);
        const newTotal = Math.max(0, currentTotal + hoursDelta);
        
        await supabase
          .from('timesheet_periods')
          .update({ total_hours: newTotal })
          .eq('id', existingEntry.period_id);
        
        console.log(`✅ Updated period total: ${currentTotal}h → ${newTotal}h`);
      }
    }
    
    console.log(`✅ Updated entry: ${entryId}`);
    
    return c.json({ entry: updatedEntry });
  } catch (error) {
    console.log(`Error updating timesheet: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete timesheet entry by ID (Phase 1C)
app.delete("/make-server-f8b491be/timesheets/:entryId", async (c) => {
  try {
    const entryId = c.req.param('entryId');
    
    console.log('🗑️ DELETE /timesheets - Deleting entry:', entryId);
    
    const supabase = getSupabaseClient();
    
    // Fetch the entry first to get hours for period update
    const { data: existingEntry, error: fetchError } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();
    
    if (fetchError) {
      console.error('Error fetching entry:', fetchError);
      return c.json({ error: 'Failed to fetch entry', details: fetchError.message }, 500);
    }
    
    if (!existingEntry) {
      console.error('Entry not found:', entryId);
      return c.json({ error: 'Entry not found' }, 404);
    }
    
    // Delete the entry
    const { error: deleteError } = await supabase
      .from('timesheet_entries')
      .delete()
      .eq('id', entryId);
    
    if (deleteError) {
      console.error('Error deleting entry:', deleteError);
      return c.json({ error: 'Failed to delete entry', details: deleteError.message }, 500);
    }
    
    // Update period total hours (subtract deleted hours)
    if (existingEntry.period_id) {
      const deletedHours = parseFloat(existingEntry.hours || 0);
      
      const { data: period } = await supabase
        .from('timesheet_periods')
        .select('total_hours')
        .eq('id', existingEntry.period_id)
        .single();
      
      if (period) {
        const currentTotal = parseFloat(period.total_hours || 0);
        const newTotal = Math.max(0, currentTotal - deletedHours);
        
        await supabase
          .from('timesheet_periods')
          .update({ total_hours: newTotal })
          .eq('id', existingEntry.period_id);
        
        console.log(`✅ Updated period total: ${currentTotal}h - ${deletedHours}h = ${newTotal}h`);
      }
    }
    
    console.log(`✅ Deleted entry: ${entryId}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting timesheet: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Delete timesheet entry (legacy endpoint)
app.delete("/make-server-f8b491be/timesheets/:userId/:date", async (c) => {
  try {
    const userId = c.req.param('userId');
    const date = c.req.param('date');
    
    await kv.del(`timesheet:${userId}:${date}`);
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting timesheet: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Migrate old format entries to new format (utility endpoint)
app.post("/make-server-f8b491be/timesheets/migrate", async (c) => {
  try {
    console.log('Starting migration of old format entries...');
    
    // Get all timesheet entries
    const allEntries = await kv.getByPrefix('timesheet:');
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    // Define sample task categories and work types to randomly assign
    const taskCategories = ['Development', 'Design', 'Testing', 'Code Review', 'Meeting', 'Documentation'];
    const workTypes = ['regular', 'regular', 'regular', 'regular', 'overtime', 'travel'];
    
    for (const entry of allEntries) {
      let needsUpdate = false;
      let updatedEntry = { ...entry };
      
      // Check if entry needs taskId migration
      if (!entry.taskId) {
        const taskId = 'task-1';
        updatedEntry = {
          ...updatedEntry,
          taskId,
          id: `${entry.userId}:${entry.date}:${taskId}`,
        };
        needsUpdate = true;
      }
      
      // Check if entry needs taskCategory/workType migration
      if (!entry.taskCategory || !entry.workType) {
        // Assign random task category and work type for demo purposes
        updatedEntry = {
          ...updatedEntry,
          taskCategory: entry.taskCategory || taskCategories[Math.floor(Math.random() * taskCategories.length)],
          workType: entry.workType || workTypes[Math.floor(Math.random() * workTypes.length)],
        };
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        updatedEntry.updatedAt = new Date().toISOString();
        
        // Delete old key if taskId was missing
        if (!entry.taskId) {
          await kv.del(`timesheet:${entry.userId}:${entry.date}`);
        }
        
        // Save with correct key format
        const userId = updatedEntry.userId;
        const date = updatedEntry.date;
        const taskId = updatedEntry.taskId;
        await kv.set(`timesheet:${userId}:${date}:${taskId}`, updatedEntry);
        
        migratedCount++;
      } else {
        skippedCount++;
      }
    }
    
    console.log(`Migration complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
    
    return c.json({ 
      success: true, 
      migrated: migratedCount, 
      skipped: skippedCount,
      message: `Successfully migrated ${migratedCount} entries to new format`
    });
  } catch (error) {
    console.log(`Error during migration: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================
// PEOPLE/USERS ENDPOINTS
// ============================================================

// Get users by company
app.get("/make-server-f8b491be/companies/:companyId/people", async (c) => {
  try {
    const companyId = c.req.param('companyId');
    
    // Get all contracts for this company
    const contracts = await kv.getByPrefix(`contract:company:${companyId}:`);
    
    // Get user details for each contract
    const peoplePromises = contracts.map(async (contract: any) => {
      const user = await kv.get(`user:${contract.userId}`);
      return {
        ...user,
        contractId: contract.id,
        contractRole: contract.role,
        contractStatus: contract.status,
      };
    });
    
    const people = await Promise.all(peoplePromises);
    
    return c.json({ people: people.filter(p => p) });
  } catch (error) {
    console.log(`Error fetching company people: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================
// SEED SUPABASE TABLES (Real database seed)
// ============================================================

app.post("/make-server-f8b491be/seed-supabase", async (c) => {
  try {
    console.log('🌱 Starting Supabase database seed...');
    
    const supabase = getSupabaseClient();
    
    // ✅ Step 0: Create timesheet_entries table if it doesn't exist
    console.log('📋 Ensuring timesheet_entries table exists...');
    
    const { error: tableCheckError } = await supabase
      .from('timesheet_entries')
      .select('id')
      .limit(1);
    
    // If table doesn't exist, create it via raw SQL
    if (tableCheckError && tableCheckError.message.includes('does not exist')) {
      console.log('Creating timesheet_entries table...');
      
      // Use Supabase's RPC to execute raw SQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS timesheet_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          company_id TEXT,
          project_id TEXT,
          date DATE NOT NULL,
          hours NUMERIC(5,2) NOT NULL,
          status TEXT DEFAULT 'draft',
          notes TEXT,
          task_id TEXT NOT NULL,
          start_time TIME,
          end_time TIME,
          break_minutes INTEGER DEFAULT 0,
          work_type TEXT DEFAULT 'regular',
          task_category TEXT DEFAULT 'Development',
          task_description TEXT,
          billable BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
        
        CREATE INDEX IF NOT EXISTS idx_timesheet_entries_user_date ON timesheet_entries(user_id, date);
        CREATE INDEX IF NOT EXISTS idx_timesheet_entries_date ON timesheet_entries(date);
      `;
      
      // Note: We can't execute raw SQL in this environment, so we'll insert a dummy row to trigger table creation
      // Actually, let's just proceed - the table might already exist
      console.log('⚠️ Table might not exist yet - will be created on first insert');
    } else {
      console.log('✓ timesheet_entries table exists');
    }
    
    // ⚠️ CLEAR ALL EXISTING DATA FIRST (prevents UUID conflicts)
    console.log('🗑️ Clearing existing data...');
    
    // Delete in correct order (respecting foreign key constraints)
    const { error: entriesDeleteError } = await supabase
      .from('timesheet_entries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (entriesDeleteError) {
      console.warn('Warning: Failed to clear timesheet_entries:', entriesDeleteError);
    }
    
    const { error: periodsDeleteError } = await supabase
      .from('timesheet_periods')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (periodsDeleteError) {
      console.warn('Warning: Failed to clear timesheet_periods:', periodsDeleteError);
    }
    
    const { error: graphDeleteError } = await supabase
      .from('graph_versions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (graphDeleteError) {
      console.warn('Warning: Failed to clear graph_versions:', graphDeleteError);
    }
    
    const { error: contractsDeleteError } = await supabase
      .from('project_contracts')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (contractsDeleteError) {
      console.warn('Warning: Failed to clear project_contracts:', contractsDeleteError);
    }
    
    const { error: orgsDeleteError } = await supabase
      .from('organizations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (orgsDeleteError) {
      console.warn('Warning: Failed to clear organizations:', orgsDeleteError);
    }
    
    console.log('✓ Cleared all existing data');
    
    // ✅ Use consistent project ID so frontend can load it
    // The frontend defaults to 'proj-alpha' in WorkGraphBuilder.tsx
    const projectId = 'proj-alpha';
    console.log(`📋 Using project ID: ${projectId}`);
    
    // Step 1: Create Organizations
    console.log('Creating organizations...');
    const organizations = [
      { id: crypto.randomUUID(), name: 'Acme Dev Studio', type: 'company', logo: null },
      { id: crypto.randomUUID(), name: 'BrightWorks Design', type: 'company', logo: null },
      { id: crypto.randomUUID(), name: 'TechStaff Agency', type: 'agency', logo: null },
      { id: crypto.randomUUID(), name: 'Enterprise ClientCorp', type: 'company', logo: null },
    ];
    
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert(organizations)
      .select();
    
    if (orgError) {
      console.error('Error creating organizations:', orgError);
      return c.json({ error: 'Failed to create organizations', details: orgError }, 500);
    }
    
    console.log(`✓ Created ${orgData.length} organizations`);
    
    // Step 2: Create Project Contracts (10 contractors)
    console.log('Creating project contracts...');
    const contractors = [
      // Acme Dev Studio - Company Employees
      { name: 'Sarah Johnson', role: 'company_employee', orgId: orgData[0].id, rate: 150 },
      { name: 'Mike Chen', role: 'company_employee', orgId: orgData[0].id, rate: 140 },
      { name: 'Emily Davis', role: 'company_employee', orgId: orgData[0].id, rate: 135 },
      { name: 'Robert Garcia', role: 'company_employee', orgId: orgData[0].id, rate: 145 },
      { name: 'Lisa Anderson', role: 'company_employee', orgId: orgData[0].id, rate: 130 },
      
      // BrightWorks Design - Agency Contractors
      { name: 'Sophia Martinez', role: 'agency_contractor', orgId: orgData[1].id, rate: 125 },
      { name: 'Oliver Anderson', role: 'agency_contractor', orgId: orgData[1].id, rate: 120 },
      { name: 'Emma Thomas', role: 'agency_contractor', orgId: orgData[1].id, rate: 115 },
      
      // Individual Contributors - Freelancers
      { name: 'Alex Chen', role: 'individual_contributor', orgId: null, rate: 175 },
      { name: 'Jordan Rivera', role: 'individual_contributor', orgId: null, rate: 165 },
    ];
    
    const contractsToInsert = contractors.map((c, i) => ({
      id: crypto.randomUUID(), // ✅ Generate UUID for each contract
      user_id: crypto.randomUUID(), // Generate UUID for each user
      user_name: c.name,
      user_role: c.role,
      organization_id: c.orgId,
      project_id: projectId,
      contract_type: 'hourly',
      hourly_rate: c.rate,
      start_date: '2025-10-01',
    }));
    
    const { data: contractData, error: contractError } = await supabase
      .from('project_contracts')
      .insert(contractsToInsert)
      .select();
    
    if (contractError) {
      console.error('Error creating contracts:', contractError);
      return c.json({ error: 'Failed to create contracts', details: contractError }, 500);
    }
    
    console.log(`✓ Created ${contractData.length} project contracts`);
    
    // Step 3: Create Initial Graph Version
    console.log('Creating initial graph version...');
    
    // Build the initial graph structure from the seeded data
    const initialGraphData = {
      nodes: [
        // Client node
        { 
          id: 'client-1', 
          type: 'client', 
          label: 'Enterprise ClientCorp',
          organizationId: orgData[3].id,
          position: { x: 400, y: 50 }
        },
        // Company nodes
        {
          id: 'company-acme',
          type: 'company',
          label: 'Acme Dev Studio',
          organizationId: orgData[0].id,
          position: { x: 200, y: 200 }
        },
        {
          id: 'company-brightworks',
          type: 'company',
          label: 'BrightWorks Design',
          organizationId: orgData[1].id,
          position: { x: 600, y: 200 }
        },
        // Agency node
        {
          id: 'agency-techstaff',
          type: 'agency',
          label: 'TechStaff Agency',
          organizationId: orgData[2].id,
          position: { x: 400, y: 350 }
        },
        // ✅ CREATE PERSON NODES FOR ALL CONTRACTORS (not just freelancers)
        ...contractData.map((c, idx) => ({
          id: `person-${c.id}`,
          type: 'person',
          data: {
            name: c.user_name,
            role: c.user_role,
            userId: c.user_id, // ✅ CRITICAL: Link to database user_id
            contractId: c.id,
            organizationId: c.organization_id,
          },
          position: { 
            x: 100 + (idx % 5) * 150, 
            y: 500 + Math.floor(idx / 5) * 120 
          }
        }))
      ],
      edges: [
        // Client -> Companies
        { id: 'e1', source: 'client-1', target: 'company-acme' },
        { id: 'e2', source: 'client-1', target: 'company-brightworks' },
        // Client -> Freelancers (direct) - only for individual contributors
        ...contractData
          .filter(c => c.user_role === 'individual_contributor')
          .map((c, idx) => ({
            id: `e-client-freelancer-${idx}`,
            source: 'client-1',
            target: `person-${c.id}`
          })),
        // Companies -> Employees
        ...contractData
          .filter(c => c.organization_id === orgData[0].id) // Acme employees
          .map((c, idx) => ({
            id: `e-acme-emp-${idx}`,
            source: 'company-acme',
            target: `person-${c.id}`,
            data: { edgeType: 'employs' }
          })),
        ...contractData
          .filter(c => c.organization_id === orgData[1].id) // BrightWorks employees
          .map((c, idx) => ({
            id: `e-brightworks-emp-${idx}`,
            source: 'company-brightworks',
            target: `person-${c.id}`,
            data: { edgeType: 'employs' }
          }))
      ],
      metadata: {
        description: 'Initial project structure - October 2025',
        contractCount: contractData.length,
        organizationCount: orgData.length
      }
    };
    
    const { data: graphVersionData, error: graphVersionError } = await supabase
      .from('graph_versions')
      .insert({
        project_id: projectId,
        version_number: 1,
        effective_from_date: '2025-10-01',
        effective_to_date: null, // Currently active
        graph_data: initialGraphData,
        change_summary: 'Initial project setup with 4 organizations and 10 contractors',
        created_by: 'system',
      })
      .select()
      .single();
    
    if (graphVersionError) {
      console.error('Error creating graph version:', graphVersionError);
      return c.json({ error: 'Failed to create graph version', details: graphVersionError }, 500);
    }
    
    console.log(`✓ Created graph version 1`);
    
    // Step 4: Create Timesheet Periods (4 weeks of October 2025)
    console.log('Creating timesheet periods...');
    const weeks = [
      { start: '2025-09-29', end: '2025-10-05' }, // Week 1
      { start: '2025-10-06', end: '2025-10-12' }, // Week 2
      { start: '2025-10-13', end: '2025-10-19' }, // Week 3
      { start: '2025-10-20', end: '2025-10-26' }, // Week 4
    ];
    
    const periodsToInsert = [];
    for (const contract of contractData) {
      for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
        const week = weeks[weekIdx];
        
        // Vary status by week
        let status = 'pending';
        if (weekIdx === 0) status = 'approved';
        else if (weekIdx === 1) status = contract.user_id.endsWith('1') ? 'approved' : 'pending';
        else if (weekIdx === 2) status = 'pending';
        else status = 'pending';
        
        // Vary hours (35-45 hours per week)
        const baseHours = 40;
        const variance = (Math.random() * 10) - 5; // -5 to +5
        const totalHours = Math.round((baseHours + variance) * 2) / 2; // Round to .5
        
        periodsToInsert.push({
          id: crypto.randomUUID(), // ✅ Generate UUID for each period
          contract_id: contract.id,
          week_start_date: week.start,
          week_end_date: week.end,
          total_hours: totalHours,
          status: status,
          submitted_at: status !== 'pending' ? '2025-10-26T10:00:00Z' : null,
          // ✅ REMOVED: graph_version_id field (column doesn't exist yet)
        });
      }
    }
    
    const { data: periodData, error: periodError } = await supabase
      .from('timesheet_periods')
      .insert(periodsToInsert)
      .select();
    
    if (periodError) {
      console.error('Error creating periods:', periodError);
      return c.json({ error: 'Failed to create periods', details: periodError }, 500);
    }
    
    console.log(`✓ Created ${periodData.length} timesheet periods`);
    
    // ✅ Step 5: Create timesheet_entries in Supabase (daily breakdown)
    console.log('Creating Supabase timesheet entries (daily breakdown)...');
    
    const entriesToInsert = [];
    const periodTotalsMap = new Map(); // Track actual totals per period
    
    for (const period of periodData) {
      // Find the contract for this period
      const contract = contractData.find(c => c.id === period.contract_id);
      if (!contract) continue;
      
      // Break down the weekly total into daily entries (Mon-Fri)
      const weekStart = new Date(period.week_start_date + 'T12:00:00');
      const weekTotalHours = period.total_hours;
      const daysInWeek = 5; // Mon-Fri only
      const hoursPerDay = Math.round((weekTotalHours / daysInWeek) * 2) / 2; // Round to 0.5
      
      let actualWeekTotal = 0; // Track actual hours for this period
      
      // Create daily entries for Mon-Fri
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + dayOffset);
        const dayOfWeek = currentDate.getDay();
        
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        
        const dateStr = currentDate.toISOString().split('T')[0];
        const taskId = 'task-1';
        const entryId = `${contract.user_id.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}-${taskId}`;
        
        actualWeekTotal += hoursPerDay; // Sum up actual hours
        
        entriesToInsert.push({
          id: entryId,
          period_id: period.id,
          user_id: contract.user_id,
          company_id: contract.organization_id,
          project_id: projectId,
          date: dateStr,
          hours: hoursPerDay,
          status: period.status, // Match period status
          task_id: taskId,
          start_time: '09:00',
          end_time: dayOfWeek === 5 ? '16:30' : '17:00', // Friday half-day
          break_minutes: 30,
          work_type: 'regular',
          task_category: 'Development',
          task_description: 'Project work',
          billable: true,
          notes: '',
        });
      }
      
      // Store the actual total for this period
      periodTotalsMap.set(period.id, actualWeekTotal);
    }
    
    // Batch insert all entries
    const { data: entriesData, error: entriesError } = await supabase
      .from('timesheet_entries')
      .insert(entriesToInsert)
      .select();
    
    if (entriesError) {
      console.error('Error creating timesheet entries:', entriesError);
      return c.json({ error: 'Failed to create entries', details: entriesError }, 500);
    }
    
    console.log(`✓ Created ${entriesData.length} timesheet entries in Supabase`);
    
    // ✅ Step 6: Update period totals to match actual entries
    console.log('Updating period totals to match actual entries...');
    
    for (const [periodId, actualTotal] of periodTotalsMap.entries()) {
      await supabase
        .from('timesheet_periods')
        .update({ total_hours: actualTotal })
        .eq('id', periodId);
    }
    
    console.log(`✓ Updated ${periodTotalsMap.size} period totals`);
    
    // Success response
    return c.json({
      success: true,
      message: '✅ Supabase database seeded successfully with temporal graph versioning!',
      summary: {
        organizations: orgData.length,
        contracts: contractData.length,
        periods: periodData.length,
        entries: entriesData.length, // ✅ Now includes entries count
        graphVersions: 1,
        note: 'Using temporal versioning - graph changes are tracked',
      },
      details: {
        projectId: projectId,
        graphVersionId: graphVersionData.id,
        organizations: orgData.map(o => o.name),
        contractors: contractors.map(c => c.name),
        dateRange: 'October 2025 (4 weeks)',
        weeksPerContractor: 4,
        entriesPerContractor: entriesData.length / contractData.length,
      },
    });
    
  } catch (error) {
    console.error('❌ Error seeding Supabase:', error);
    return c.json({ 
      error: 'Failed to seed Supabase database',
      details: String(error),
    }, 500);
  }
});

// ============================================================
// GRAPH VERSION MANAGEMENT
// ============================================================

// Get the active graph version for a project
app.get("/make-server-f8b491be/graph-versions/active", async (c) => {
  try {
    const projectId = c.req.query('projectId');
    
    if (!projectId) {
      return c.json({ error: 'projectId required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // Get the active version (where effective_to_date is null)
    // ✅ Use maybeSingle() instead of single() to handle "no data" case gracefully
    const { data, error } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('project_id', projectId)
      .is('effective_to_date', null)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching active graph version:', error);
      return c.json({ error: 'Failed to fetch active graph version', details: error }, 500);
    }
    
    // Return null if no active version found (instead of throwing error)
    return c.json({ graphVersion: data });
  } catch (error) {
    console.error('Error in GET /graph-versions/active:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get graph version for a specific date (month-aware lookup)
app.get("/make-server-f8b491be/graph-versions/for-date", async (c) => {
  try {
    const projectId = c.req.query('projectId');
    const date = c.req.query('date'); // Format: YYYY-MM-DD or YYYY-MM-15 (mid-month)
    
    if (!projectId || !date) {
      return c.json({ error: 'projectId and date required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // Find the version that was active on the given date
    // effective_from_date <= date AND (effective_to_date > date OR effective_to_date IS NULL)
    // ✅ Use maybeSingle() to handle "no data" case gracefully
    const { data, error } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('project_id', projectId)
      .lte('effective_from_date', date)
      .or(`effective_to_date.is.null,effective_to_date.gt.${date}`)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching graph version for date:', error);
      return c.json({ error: 'Failed to fetch graph version for date', details: error }, 500);
    }
    
    // Return null if no version found for this date
    if (!data) {
      return c.json({ graphVersion: null, message: 'No graph version found for this date' });
    }
    
    return c.json({ graphVersion: data });
  } catch (error) {
    console.error('Error in GET /graph-versions/for-date:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get graph version by ID
app.get("/make-server-f8b491be/graph-versions/:versionId", async (c) => {
  try {
    const versionId = c.req.param('versionId');
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('id', versionId)
      .single();
    
    if (error) {
      console.error('Error fetching graph version:', error);
      return c.json({ error: 'Failed to fetch graph version', details: error }, 500);
    }
    
    return c.json({ graphVersion: data });
  } catch (error) {
    console.error('Error in GET /graph-versions/:versionId:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get all graph versions for a project (version history)
app.get("/make-server-f8b491be/graph-versions", async (c) => {
  try {
    const projectId = c.req.query('projectId');
    
    if (!projectId) {
      return c.json({ error: 'projectId required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });
    
    if (error) {
      console.error('Error fetching graph versions:', error);
      return c.json({ error: 'Failed to fetch graph versions', details: error }, 500);
    }
    
    return c.json({ graphVersions: data });
  } catch (error) {
    console.error('Error in GET /graph-versions:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Create a new graph version (when the graph is edited)
app.post("/make-server-f8b491be/graph-versions", async (c) => {
  try {
    const { projectId, graphData, changeSummary, createdBy } = await c.req.json();
    
    if (!projectId || !graphData) {
      return c.json({ error: 'projectId and graphData required' }, 400);
    }
    
    const supabase = getSupabaseClient();
    
    // Step 1: Get the current active version to determine the next version number
    // ✅ Use maybeSingle() to handle "no data" case gracefully
    const { data: currentVersion, error: currentError } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('project_id', projectId)
      .is('effective_to_date', null)
      .maybeSingle();
    
    if (currentError) {
      console.error('Error fetching current version:', currentError);
      return c.json({ error: 'Failed to fetch current version', details: currentError }, 500);
    }
    
    const nextVersionNumber = currentVersion ? currentVersion.version_number + 1 : 1;
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Step 2: Close the current version (set effective_to_date)
    if (currentVersion) {
      const { error: updateError } = await supabase
        .from('graph_versions')
        .update({ effective_to_date: now })
        .eq('id', currentVersion.id);
      
      if (updateError) {
        console.error('Error closing current version:', updateError);
        return c.json({ error: 'Failed to close current version', details: updateError }, 500);
      }
    }
    
    // Step 3: Create the new version
    const { data: newVersion, error: insertError } = await supabase
      .from('graph_versions')
      .insert({
        project_id: projectId,
        version_number: nextVersionNumber,
        effective_from_date: now,
        effective_to_date: null, // New active version
        graph_data: graphData,
        change_summary: changeSummary || `Version ${nextVersionNumber}`,
        created_by: createdBy || 'user',
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating new graph version:', insertError);
      return c.json({ error: 'Failed to create graph version', details: insertError }, 500);
    }
    
    console.log(`✅ Created graph version ${nextVersionNumber}`);
    
    return c.json({ 
      graphVersion: newVersion,
      message: `Graph version ${nextVersionNumber} created successfully` 
    });
  } catch (error) {
    console.error('Error in POST /graph-versions:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Register email routes
registerEmailRoutes(app);

// Register approval routes
registerApprovalRoutes(app);

Deno.serve(app.fetch);