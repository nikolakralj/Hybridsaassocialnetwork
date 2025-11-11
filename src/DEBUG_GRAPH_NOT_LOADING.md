# 🔧 Debug: Graph Not Loading from Database

## ✅ What I Just Fixed

**Added Month Navigation to WorkGraph**
- Added < October 2025 > navigation in top-left panel
- Graph now reloads when you change months
- Shows loading indicator when fetching

## 🔴 Core Problem

The graph is NOT loading from the database. You're seeing the template graph, not the real data you seeded.

### Symptoms:
1. Graph shows template nodes (demo data)
2. No "Loading graph..." spinner appears
3. Console shows errors from database queries

---

## 🎯 Step-by-Step Debugging

### Step 1: Check Browser Console (F12)

**Open DevTools → Console tab and look for:**

```
✅ GOOD - Should see:
🔄 Loading graph for project: proj-alpha
📅 Loading graph version for date: 2025-10-15
✅ Loaded graph version 1 for 2025-10-15
✅ Graph loaded: 1

❌ BAD - If you see:
❌ Failed to load graph: [error message]
ℹ️ No graph version found for 2025-10-15
ℹ️ No active version found, using template
```

**Screenshot the console and send to me!**

---

### Step 2: Test Database Connection

**Open browser console and run:**

```javascript
// Test if graph_versions table exists
fetch('https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-f8b491be/graph-versions/active?projectId=proj-alpha', {
  headers: { 'Authorization': 'Bearer YOUR_ANON_KEY' }
}).then(r => r.json()).then(console.log);
```

**Expected Response:**
```json
{
  "graphVersion": {
    "id": "graph-v1",
    "project_id": "proj-alpha",
    "version_number": 1,
    "graph_data": { "nodes": [...], "edges": [...] }
  }
}
```

**If Error:**
```json
{
  "error": "relation \"graph_versions\" does not exist"
}
```

**→ This means the SQL script didn't create the table!**

---

### Step 3: Verify SQL Script Was Run

**Go to Supabase Dashboard:**
1. Open your project
2. Go to **SQL Editor**
3. Click **History** tab
4. Check if you see `/COMPLETE_SETUP_WITH_GRAPH.sql` in the list

**If YES:**
- Check the "Results" tab for errors
- Look for "ERROR" in red

**If NO:**
- You didn't run the script yet!
- Go to Step 4

---

### Step 4: Run SQL Script (If Not Done Yet)

**Supabase Dashboard → SQL Editor → New Query**

1. Copy entire `/COMPLETE_SETUP_WITH_GRAPH.sql` file
2. Paste into SQL Editor
3. Click **Run** (or Ctrl+Enter)
4. Wait for completion (may take 10-30 seconds)
5. Check for errors in output

**Expected Output:**
```
CREATE TABLE
CREATE INDEX
INSERT 0 8  (parties)
INSERT 0 12 (timesheet_periods)
INSERT 0 40 (timesheet_entries)
INSERT 0 1  (graph_versions)
```

**If you see errors:** Screenshot and send to me!

---

### Step 5: Verify Graph Data Exists

**SQL Editor → Run this query:**

```sql
SELECT * FROM graph_versions WHERE project_id = 'proj-alpha';
```

**Expected Result:**
- 1 row with:
  - `id`: graph-v1
  - `version_number`: 1
  - `effective_from_date`: 2025-10-01
  - `graph_data`: (JSON object with nodes and edges)

**If ZERO rows:**
- The INSERT statement failed
- Check Step 4 for errors

---

### Step 6: Test Server Endpoint

**Terminal → Run:**

```bash
curl "https://YOUR_PROJECT_ID.supabase.co/functions/v1/make-server-f8b491be/graph-versions/active?projectId=proj-alpha" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Replace:**
- `YOUR_PROJECT_ID` with your Supabase project ID
- `YOUR_ANON_KEY` with your anon key

**Expected:** JSON response with graph data

**If error:** The server endpoint isn't working

---

## 🚨 Common Errors & Fixes

### Error: "relation 'graph_versions' does not exist"

**Fix:**
```sql
-- Run this in Supabase SQL Editor:
CREATE TABLE graph_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  project_id TEXT NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to_date DATE,
  graph_data JSONB NOT NULL,
  change_summary TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

CREATE INDEX idx_graph_versions_project ON graph_versions(project_id);
CREATE INDEX idx_graph_versions_active ON graph_versions(project_id, effective_to_date) WHERE effective_to_date IS NULL;
```

---

### Error: "Failed to load graph: 404"

**Fix:** Server endpoint doesn't exist. Check:
1. `/supabase/functions/server/index.tsx` has `/graph-versions/active` route
2. Edge Function is deployed (Supabase Dashboard → Edge Functions)

---

### Error: "No graph version found for 2025-10-15"

**Fix:** Insert seed data:

```sql
INSERT INTO graph_versions (
  id, 
  project_id, 
  version_number,
  effective_from_date,
  effective_to_date,
  graph_data,
  change_summary,
  created_by
) VALUES (
  'graph-v1',
  'proj-alpha',
  1,
  '2025-10-01',
  NULL,
  '{"nodes":[{"id":"user-sarah","type":"person","position":{"x":100,"y":100},"data":{"name":"Sarah Johnson","userId":"user-sarah","role":"company_employee","company":"Acme Dev Studio"}}],"edges":[]}'::jsonb,
  'Initial October 2025 graph setup',
  'system'
);
```

---

## 📋 What to Send Me

To help you debug, send me:

1. **Console screenshot** (F12 → Console tab)
2. **SQL query result:**
   ```sql
   SELECT COUNT(*) FROM graph_versions;
   SELECT * FROM graph_versions WHERE project_id = 'proj-alpha';
   ```
3. **Network tab screenshot** (F12 → Network → Filter by "graph-versions")
4. **Any error messages** you see

---

## ✅ Success Criteria

Once working, you should see:

### Browser Console:
```
🔄 Loading graph for project: proj-alpha
📅 Loading graph version for date: 2025-10-15
✅ Loaded graph version 1 for 2025-10-15
✅ Graph loaded: 1
```

### WorkGraph UI:
```
Top-left panel shows:
📅 < October 2025 >
5 Nodes | 3 Edges
[No "Loading graph..." spinner]
```

### Graph nodes show:
- Sarah Johnson
- Mike Chen  
- Sophia Martinez
- Acme Dev Studio
- BrightWorks Design

(Not the template demo data!)

---

## 🎯 Quick Test Script

**Run this in browser console:**

```javascript
// Quick diagnostic
(async () => {
  const projId = 'REPLACE_WITH_YOUR_PROJECT_ID';
  const anonKey = 'REPLACE_WITH_YOUR_ANON_KEY';
  
  console.log('🔍 Testing graph database...');
  
  try {
    const url = `https://${projId}.supabase.co/functions/v1/make-server-f8b491be/graph-versions/active?projectId=proj-alpha`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${anonKey}` }
    });
    
    const data = await res.json();
    
    if (data.graphVersion) {
      console.log('✅ Graph found!', data.graphVersion);
      console.log('📊 Nodes:', data.graphVersion.graph_data.nodes.length);
      console.log('🔗 Edges:', data.graphVersion.graph_data.edges.length);
    } else {
      console.log('❌ No graph found:', data);
    }
  } catch (err) {
    console.log('❌ Error:', err);
  }
})();
```

---

**Let me know what you find!** 🚀
