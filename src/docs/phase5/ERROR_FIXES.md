# Error Fixes - "Failed to fetch"

## Errors Fixed

```
❌ Error loading active graph version: TypeError: Failed to fetch
❌ Failed to load graph: TypeError: Failed to fetch
❌ Seed error: TypeError: Failed to fetch
```

---

## Root Cause

The frontend was trying to call API routes that didn't exist on the server:

1. **Graph Versions API** - `/graph-versions/active`, `/graph-versions/for-date`
2. **Seed Demo Data** - `timesheetApi.seedDemoData()`

---

## Fixes Applied

### 1. Created Graph Versions API

**File:** `/supabase/functions/server/graph-versions.ts`

**Routes added:**
```
GET  /make-server-f8b491be/graph-versions/active
GET  /make-server-f8b491be/graph-versions/for-date
POST /make-server-f8b491be/graph-versions/save
GET  /make-server-f8b491be/graph-versions/history
GET  /make-server-f8b491be/graph-versions/:versionId
```

**Why they return null:**
- Graph versioning is Phase 6 feature
- For now, they return graceful "not implemented" messages
- This prevents frontend errors while we're in Phase 5

**Example response:**
```json
{
  "version": null,
  "message": "No active graph version found (this is expected for new projects)"
}
```

---

### 2. Added seedDemoData Function

**File:** `/utils/api/timesheets.ts`

**Added:**
```typescript
export async function seedDemoData() {
  console.log('🌱 Seed demo data called - this is a placeholder');
  console.log('📝 Use the DatabaseSetupPage to seed data instead');
  
  throw new Error('Please use the Database Setup page to seed demo data');
}
```

**Why it throws an error:**
- The proper way to seed data is through **DatabaseSetupPage**
- That page has the full SQL schema + seed data
- This error message guides users to the right place

---

### 3. Registered Routes in Server

**File:** `/supabase/functions/server/index.tsx`

**Added:**
```typescript
import { graphVersionsRouter } from "./graph-versions.ts";

app.route('/make-server-f8b491be/graph-versions', graphVersionsRouter);
```

---

## Testing

### 1. Refresh the page
The errors should be gone now!

### 2. Check console logs
You should see:
```
📊 Getting active graph version for project: proj-alpha
✅ No active graph version found (this is expected)
```

### 3. If you click "Seed Demo Data" button
You'll see a helpful error:
```
❌ Please use the Database Setup page to seed demo data
```

---

## What to Do Instead

### For Seeding Data

1. Go to **Database Setup Page** (in the app)
2. Click "Check Tables" - ensure all tables exist
3. Click "Seed Demo Data" - creates Alice, Bob, Charlie + timesheets
4. Switch to Alice's view to see her timesheet

### For Graph Versioning (Phase 6)

Graph versioning will be implemented in Phase 6 with:
- Proper database table for versions
- Save/load functionality
- Version history
- Month-specific versions

For now, the graph just uses in-memory state (resets on refresh).

---

## Files Changed

```
✅ /supabase/functions/server/graph-versions.ts ......... NEW (stub routes)
✅ /supabase/functions/server/index.tsx ................. UPDATED (registered routes)
✅ /utils/api/timesheets.ts ............................. UPDATED (added seedDemoData stub)
```

---

## Summary

The errors were caused by **missing API routes**. The frontend was trying to call endpoints that didn't exist yet.

**Solution:**
- Added stub routes that return graceful "not implemented" messages
- Added placeholder seedDemoData function with helpful error
- Registered all routes in main server

**Result:**
- ✅ No more "Failed to fetch" errors
- ✅ Graph loads (with empty/template state)
- ✅ Users are guided to proper seeding method

**The app should now load without errors!** 🎉
