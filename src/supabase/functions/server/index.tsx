import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    
    console.log('📥 GET /timesheets - Query params:', { userId, companyId, startDate, endDate });
    
    // ✅ ALLOW FETCHING ALL ENTRIES when no filters provided (for building org structure)
    // This is needed for the approval system to discover all organizations and contracts
    
    let entries;
    
    if (userId) {
      // Get entries for specific user
      entries = await kv.getByPrefix(`timesheet:${userId}:`);
      console.log(`📊 Found ${entries.length} entries for user ${userId}`);
      
      // ✅ Also filter by companyId if provided
      if (companyId) {
        entries = entries.filter((entry: any) => entry.companyId === companyId);
        console.log(`📊 After filtering by companyId ${companyId}: ${entries.length} entries`);
      }
    } else if (companyId) {
      // Get entries for all users in company
      entries = await kv.getByPrefix(`timesheet:`);
      console.log(`📊 Found ${entries.length} total timesheet entries in KV store`);
      // Filter to only entries matching the companyId
      entries = entries.filter((entry: any) => entry.companyId === companyId);
      console.log(`📊 After filtering by companyId ${companyId}: ${entries.length} entries`);
    } else {
      // ✅ NEW: No filters - return ALL entries (for discovery/organization building)
      entries = await kv.getByPrefix(`timesheet:`);
      console.log(`📊 Found ${entries.length} total timesheet entries (no filters)`);
    }
    
    // Normalize old format entries (userId:date) to new format (userId:date:taskId)
    const normalizedEntries = entries.map((entry: any) => {
      // Check if entry has taskId
      if (!entry.taskId) {
        // Old format entry - add default taskId
        return {
          ...entry,
          taskId: 'task-1',
          id: `${entry.userId}:${entry.date}:task-1`
        };
      }
      return entry;
    });
    
    // Filter by date range if provided
    let filteredEntries = normalizedEntries;
    if (startDate || endDate) {
      filteredEntries = normalizedEntries.filter((entry: any) => {
        const entryDate = entry.date;
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });
    }
    
    console.log('🔍 SERVER GET: Returning entries sample:', {
      count: filteredEntries.length,
      firstEntry: filteredEntries[0],
      firstEntryTaskDescription: filteredEntries[0]?.taskDescription,
    });
    
    return c.json({ entries: filteredEntries });
  } catch (error) {
    console.log(`Error fetching timesheets: ${error}`);
    return c.json({ error: String(error) }, 500);
  }
});

// Create/Update timesheet entry
app.post("/make-server-f8b491be/timesheets", async (c) => {
  try {
    const { userId, companyId, date, hours, status, projectId, notes, taskId, startTime, endTime, breakMinutes, workType, taskCategory, taskDescription, billable } = await c.req.json();
    
    console.log('🔍 SERVER: Received timesheet POST:', {
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
    
    if (!userId || !companyId || !date || hours === undefined) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // Support multi-task entries: if taskId provided, use it; otherwise generate unique ID
    const uniqueTaskId = taskId || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const entryId = `${userId}:${date}:${uniqueTaskId}`;
    
    const entry = {
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
    
    console.log('💾 SERVER: Saving entry to database:', entry);
    
    // Store with multi-task key (userId:date:taskId allows multiple entries per day)
    await kv.set(`timesheet:${userId}:${date}:${uniqueTaskId}`, entry);
    
    return c.json({ entry });
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
      
      if (!userId || !companyId || !date || hours === undefined) {
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
    
    // entryId format can be "userId:date:taskId" (multi-task) or "userId:date" (legacy single-task)
    const parts = entryId.split(':');
    const userId = parts[0];
    const date = parts[1];
    const taskId = parts[2]; // May be undefined for legacy entries
    
    if (!userId || !date) {
      return c.json({ error: 'Invalid entry ID format' }, 400);
    }
    
    // Try to get entry - first try new format, then old format
    let kvKey = taskId 
      ? `timesheet:${userId}:${date}:${taskId}`
      : `timesheet:${userId}:${date}`;
    
    let existingEntry = await kv.get(kvKey);
    
    // If not found and no taskId provided, this might be a normalized old entry
    // Try looking for the old format key
    if (!existingEntry && !taskId) {
      // Entry doesn't exist in old format either
      return c.json({ error: 'Entry not found' }, 404);
    }
    
    // If this is an old format entry being updated, migrate it to new format
    let needsMigration = false;
    if (existingEntry && !existingEntry.taskId) {
      needsMigration = true;
      existingEntry.taskId = 'task-1'; // Add default taskId
    }
    
    // Merge updates with existing entry
    const updatedTaskId = existingEntry.taskId || 'task-1';
    const updatedEntry = {
      ...existingEntry,
      ...updates,
      id: `${userId}:${date}:${updatedTaskId}`, // Use new format ID
      userId, // Ensure userId doesn't change
      companyId: existingEntry.companyId, // Ensure companyId doesn't change
      taskId: updatedTaskId,
      updatedAt: new Date().toISOString(),
    };
    
    // If migrating, delete old key and save to new key
    if (needsMigration) {
      await kv.del(`timesheet:${userId}:${date}`); // Delete old format
      await kv.set(`timesheet:${userId}:${date}:${updatedTaskId}`, updatedEntry); // Save new format
    } else {
      // Save updated entry with new key format
      const newKvKey = `timesheet:${userId}:${date}:${updatedTaskId}`;
      await kv.set(newKvKey, updatedEntry);
    }
    
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
    
    // entryId format can be "userId:date:taskId" (multi-task) or "userId:date" (legacy single-task)
    const parts = entryId.split(':');
    const userId = parts[0];
    const date = parts[1];
    const taskId = parts[2]; // May be undefined for legacy entries
    
    if (!userId || !date) {
      return c.json({ error: 'Invalid entry ID format' }, 400);
    }
    
    // Build the correct key based on format
    const kvKey = taskId 
      ? `timesheet:${userId}:${date}:${taskId}`
      : `timesheet:${userId}:${date}`;
    
    await kv.del(kvKey);
    
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
    
    // Generate a valid UUID for the demo project
    const projectId = crypto.randomUUID();
    console.log(`📋 Using project ID: ${projectId}`);
    
    // Step 1: Create Organizations
    console.log('Creating organizations...');
    const organizations = [
      { name: 'Acme Dev Studio', type: 'company', logo: null },
      { name: 'BrightWorks Design', type: 'company', logo: null },
      { name: 'TechStaff Agency', type: 'agency', logo: null },
      { name: 'Enterprise ClientCorp', type: 'company', logo: null },
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
        // Individual contractors
        ...contractData
          .filter(c => c.user_role === 'individual_contributor')
          .map((c, idx) => ({
            id: `freelancer-${c.id}`,
            type: 'individual',
            label: c.user_name,
            contractId: c.id,
            userId: c.user_id,
            position: { x: 100 + (idx * 150), y: 500 }
          }))
      ],
      edges: [
        // Client -> Companies
        { id: 'e1', source: 'client-1', target: 'company-acme' },
        { id: 'e2', source: 'client-1', target: 'company-brightworks' },
        // Client -> Freelancers (direct)
        ...contractData
          .filter(c => c.user_role === 'individual_contributor')
          .map((c, idx) => ({
            id: `e-client-freelancer-${idx}`,
            source: 'client-1',
            target: `freelancer-${c.id}`
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
          contract_id: contract.id,
          week_start_date: week.start,
          week_end_date: week.end,
          total_hours: totalHours,
          status: status,
          submitted_at: status !== 'pending' ? '2025-10-26T10:00:00Z' : null,
          graph_version_id: graphVersionData.id, // ✅ LINK TO GRAPH VERSION
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
    
    // Success! Skip creating daily entries since timesheet_entries table doesn't exist in simple schema
    console.log('✓ Skipping daily entries (using simple schema)');
    
    // Success response
    return c.json({
      success: true,
      message: '✅ Supabase database seeded successfully with temporal graph versioning!',
      summary: {
        organizations: orgData.length,
        contracts: contractData.length,
        periods: periodData.length,
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
    const { data, error } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('project_id', projectId)
      .is('effective_to_date', null)
      .single();
    
    if (error) {
      console.error('Error fetching active graph version:', error);
      return c.json({ error: 'Failed to fetch active graph version', details: error }, 500);
    }
    
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
    const { data, error } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('project_id', projectId)
      .lte('effective_from_date', date)
      .or(`effective_to_date.is.null,effective_to_date.gt.${date}`)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      // If no version found for this date, return null (not an error)
      if (error.code === 'PGRST116') {
        return c.json({ graphVersion: null, message: 'No graph version found for this date' });
      }
      console.error('Error fetching graph version for date:', error);
      return c.json({ error: 'Failed to fetch graph version for date', details: error }, 500);
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
    const { data: currentVersion, error: currentError } = await supabase
      .from('graph_versions')
      .select('*')
      .eq('project_id', projectId)
      .is('effective_to_date', null)
      .single();
    
    if (currentError && currentError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (this is OK for first version)
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

Deno.serve(app.fetch);