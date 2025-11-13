# 🚀 Migration to Pure Supabase - STATUS & NEXT STEPS

## ✅ COMPLETED

1. **Created `timesheet_entries` table** in Supabase via SQL editor:
   ```sql
   CREATE TABLE timesheet_entries (
     id TEXT PRIMARY KEY,
     period_id TEXT NOT NULL REFERENCES timesheet_periods(id) ON DELETE CASCADE,
     date DATE NOT NULL,
     hours NUMERIC(5,2) NOT NULL,
     task_id TEXT NOT NULL,
     task_category TEXT DEFAULT 'Development',
     task_description TEXT,
     work_type TEXT DEFAULT 'regular',
     billable BOOLEAN DEFAULT true,
     start_time TIME,
     end_time TIME,
     break_minutes INTEGER DEFAULT 0,
     notes TEXT,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );
   ```

2. **Updated POST `/timesheets` endpoint** - Now writes directly to Supabase `timesheet_entries` table

## ⚠️ INCOMPLETE - NEEDS WORK

### 1. GET `/timesheets` Endpoint - Line ~87
**Current Issue:** Uses complex joins that may not work with current schema

**Fix needed:**
```typescript
// Simplify the query - just get entries and manually enrich them
let query = supabase
  .from('timesheet_entries')
  .select('*');

// Add filters
if (startDate) query = query.gte('date', startDate);
if (endDate) query = query.lte('date', endDate);

const { data: entries } = await query;

// For each entry, fetch the period and contract separately if needed
// Or join manually in application code
```

### 2. Seed Script - Line ~1059-1116
**Current Issue:** Still creates KV entries. Should create Supabase `timesheet_entries` instead.

**Fix needed:**
Replace this block:
```typescript
// ✅ Step 5: Create matching KV timesheet entries (daily breakdown)
console.log('Creating KV timesheet entries (daily breakdown)...');

let kvEntriesCount = 0;
for (const period of periodData) {
  // ... KV logic ...
  await kv.set(kvKey, entry);
  kvEntriesCount++;
}
```

With Supabase inserts:
```typescript
// ✅ Step 5: Create timesheet_entries in Supabase (daily breakdown)
console.log('Creating Supabase timesheet entries (daily breakdown)...');

const entriesToInsert = [];
for (const period of periodData) {
  const contract = contractData.find(c => c.id === period.contract_id);
  if (!contract) continue;
  
  const weekStart = new Date(period.week_start_date + 'T12:00:00');
  const weekTotalHours = period.total_hours;
  const daysInWeek = 5;
  const hoursPerDay = Math.round((weekTotalHours / daysInWeek) * 2) / 2;
  
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(weekStart.getDate() + dayOffset);
    const dayOfWeek = currentDate.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    const dateStr = currentDate.toISOString().split('T')[0];
    const taskId = 'task-1';
    const entryId = `${contract.user_id.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}-${taskId}`;
    
    entriesToInsert.push({
      id: entryId,
      period_id: period.id,
      date: dateStr,
      hours: hoursPerDay,
      task_id: taskId,
      start_time: '09:00',
      end_time: dayOfWeek === 5 ? '16:30' : '17:00',
      break_minutes: 30,
      work_type: 'regular',
      task_category: 'Development',
      task_description: 'Project work',
      billable: true,
      notes: '',
    });
  }
}

const { data: entriesData, error: entriesError } = await supabase
  .from('timesheet_entries')
  .insert(entriesToInsert)
  .select();

if (entriesError) {
  console.error('Error creating timesheet entries:', entriesError);
  return c.json({ error: 'Failed to create entries', details: entriesError }, 500);
}

console.log(`✓ Created ${entriesData.length} timesheet entries in Supabase`);
```

### 3. Bulk Operations - Lines ~320-500
**Issue:** All bulk endpoints still use KV store

**Endpoints to update:**
- POST `/timesheets/bulk` - Line ~320
- POST `/timesheets/bulk-apply` - Line ~327  
- PUT `/timesheets/:entryId` - Line ~503
- DELETE `/timesheets/:entryId` - Line ~569

### 4. Remove KV Import (Final Step)
Once all endpoints are migrated, remove:
```typescript
import * as kv from "./kv_store.tsx";
```

## 📊 BENEFITS AFTER MIGRATION

1. **Single Source of Truth** - All data in Supabase PostgreSQL
2. **No Sync Issues** - No more KV ↔ Supabase synchronization bugs
3. **Better Queries** - Use SQL joins, aggregations, filtering
4. **Data Integrity** - Foreign key constraints enforced
5. **Simpler Architecture** - One database, not two

## 🔄 ROLLBACK PLAN

If you need to revert, the KV code is still in place. Just don't use the new Supabase endpoints.

## 🎯 TESTING CHECKLIST

After completing migration:
- [ ] Run seed script - verify entries appear in Supabase
- [ ] Add a timesheet entry - verify it saves to Supabase
- [ ] View timesheets tab - verify entries display correctly
- [ ] Edit an entry - verify updates work
- [ ] Delete an entry - verify deletions work
- [ ] Bulk apply - verify multi-person operations work
- [ ] Check WorkGraph tab - verify data syncs properly
