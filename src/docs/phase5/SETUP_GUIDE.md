# 🔧 WorkGraph Database Setup Guide

**Status:** Required before using the app  
**Time:** ~5 minutes

---

## ⚠️ Important: You MUST Run SQL First

The app cannot create Postgres tables automatically. You must run the SQL schema in Supabase.

---

## 📋 Setup Steps

### **Step 1: Check Tables**

1. Go to `#/setup` page in the app
2. Click **"Check Tables"** button
3. If you see ✅ green success → Skip to Step 2
4. If you see ⚠️ orange warning → Continue below

---

### **Step 2: Copy & Run SQL Schema**

If tables are missing, you'll see:

```
⚠️ Missing 5 tables: organizations, projects, project_contracts, timesheet_periods, timesheet_entries

📋 REQUIRED: Copy SQL below and run it in Supabase:

1. Click "Copy SQL" button below
2. Go to Supabase Dashboard → SQL Editor
3. Paste the SQL
4. Click "Run"
5. Come back and click "Check Tables" again
```

**Action Required:**

1. ✅ Click **"Copy SQL"** button
2. ✅ Open new tab → Go to Supabase Dashboard
3. ✅ Click **"SQL Editor"** in left sidebar
4. ✅ Click **"New Query"**
5. ✅ Paste the SQL (Cmd+V / Ctrl+V)
6. ✅ Click **"Run"** (or press Cmd+Enter)
7. ✅ Wait for success message
8. ✅ Come back to WorkGraph setup page
9. ✅ Click **"Check Tables"** again

You should now see:

```
✅ All 5 tables already exist!

Tables: organizations, projects, project_contracts, timesheet_periods, timesheet_entries

🎯 Click "Seed Demo Data" to continue!
```

---

### **Step 3: Seed Demo Data**

1. Click **"Seed Demo Data"** button
2. Wait for success message:

```
✅ Demo data created!

👥 Users: Alice, Bob, Charlie
📋 Timesheet: 40h @ $150/hr = $6,000
📅 Period: Nov 4-10, 2025

🎯 Now switch to Alice to see her timesheet!
```

---

### **Step 4 (Optional): Create Approval Workflow**

This creates KV tokens for email-based approvals.

1. Click **"Create Approval Tokens"** button
2. Wait for success message

---

## ✅ You're Done!

Now you can:

1. **Switch to Alice Chen** (Contractor) using persona switcher
2. **Go to Projects** → **Timesheets**
3. **See Alice's timesheet** (40h, $6,000, submitted)
4. **Switch to Bob Martinez** (Manager)
5. **Go to My Approvals** → Approve Alice's timesheet
6. **Switch to Charlie Davis** (Client) → Final approval

---

## 🐛 Troubleshooting

### "Could not find the table 'public.projects' in the schema cache"

**Problem:** You clicked "Seed Demo Data" before running the SQL schema.

**Solution:** 
1. Click "Check Tables" 
2. Copy the SQL
3. Run it in Supabase SQL Editor
4. Come back and click "Check Tables" again
5. Then click "Seed Demo Data"

---

### "Could not find the 'icon' column of 'organizations'"

**Problem:** Old version of the schema was run.

**Solution:**
1. Copy the new SQL schema (includes icon column migration)
2. Run it in Supabase SQL Editor
3. The migration will add the icon column automatically
4. Click "Seed Demo Data" again

---

### "Error checking tables: ..."

**Problem:** Supabase connection issue.

**Solution:**
1. Check your internet connection
2. Make sure Supabase project is running
3. Check if `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly

---

## 🗄️ Database Schema

The app creates these tables:

1. **organizations** - Companies, agencies, freelancer virtual orgs
2. **projects** - Client projects
3. **project_contracts** - Links users to projects with rates
4. **timesheet_periods** - Weekly/monthly timesheet summaries
5. **timesheet_entries** - Daily time logs

Plus indexes for performance.

---

## 🧪 Test Personas

After seeding, you'll have:

| Name | Role | Email | Contract |
|------|------|-------|----------|
| **Alice Chen** | Contractor | alice@workgraph.dev | $150/hr, 40h submitted |
| **Bob Martinez** | Manager | bob@acmedev.com | Approves timesheets |
| **Charlie Davis** | Client | charlie@acmedev.com | Final approver |

---

**Status:** Follow these steps and your database will be ready! 🚀
