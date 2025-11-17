# 📋 Database Migration Instructions

**Status:** Ready for manual execution  
**Date:** November 14, 2024

---

## ⚠️ Why Manual Migration?

Supabase Edge Functions don't support direct postgres connections, so the automated migration couldn't run. But this is actually **simpler** - just copy/paste SQL!

---

## 🚀 Quick Start (5 Minutes)

### **Option 1: Click the Button**

1. **Open your app** → Navigate to `#/contracts`
2. **Click:** "Run Migration" button
3. **Follow** the instructions that appear
4. **Done!**

---

### **Option 2: Manual Steps**

1. **Open** [Supabase Dashboard](https://supabase.com/dashboard)
2. **Select** your project
3. **Click** "SQL Editor" in sidebar
4. **Copy** the SQL below
5. **Paste** into editor
6. **Click** "Run"
7. **Refresh** the app

---

## 📝 SQL to Run

```sql
-- ============================================================================
-- ORGANIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROJECT_CONTRACTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL,
  from_org_id TEXT NOT NULL,
  to_org_id TEXT NOT NULL,
  contract_type TEXT,
  rate DECIMAL,
  currency TEXT DEFAULT 'USD',
  relationship TEXT,
  disclosed_to_org_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

DO $$
BEGIN
  -- Add project foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_project_id_fkey'
  ) THEN
    ALTER TABLE project_contracts 
      ADD CONSTRAINT project_contracts_project_id_fkey 
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  -- Add from_org foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_from_org_id_fkey'
  ) THEN
    ALTER TABLE project_contracts 
      ADD CONSTRAINT project_contracts_from_org_id_fkey 
      FOREIGN KEY (from_org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- Add to_org foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_to_org_id_fkey'
  ) THEN
    ALTER TABLE project_contracts 
      ADD CONSTRAINT project_contracts_to_org_id_fkey 
      FOREIGN KEY (to_org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  -- Add disclosed_to_org foreign key (nullable)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'project_contracts_disclosed_to_org_id_fkey'
  ) THEN
    ALTER TABLE project_contracts 
      ADD CONSTRAINT project_contracts_disclosed_to_org_id_fkey 
      FOREIGN KEY (disclosed_to_org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Insert demo organizations
INSERT INTO organizations (id, name, type) VALUES 
  ('acme-inc', 'Acme Inc', 'client'),
  ('techcorp-agency', 'TechCorp Agency', 'agency'),
  ('devshop-sub', 'DevShop Subcontractor', 'subcontractor')
ON CONFLICT (id) DO NOTHING;

-- Insert demo project
INSERT INTO projects (id, name, description) VALUES 
  ('11111111-1111-1111-1111-111111111111', 
   'E-Commerce Platform Redesign', 
   'Complete redesign of customer-facing platform')
ON CONFLICT (id) DO NOTHING;

-- Insert demo contracts
INSERT INTO project_contracts (
  id, 
  project_id, 
  from_org_id, 
  to_org_id, 
  contract_type, 
  rate, 
  relationship, 
  status
) VALUES 
  (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'acme-inc',
    'techcorp-agency',
    'vendor',
    150.00,
    'client_to_agency',
    'active'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'techcorp-agency',
    'devshop-sub',
    'subcontractor',
    85.00,
    'agency_to_sub',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Migration successful!' as status,
       COUNT(*) as organizations_count
FROM organizations;

SELECT 'Projects created:' as status,
       COUNT(*) as projects_count
FROM projects;

SELECT 'Contracts created:' as status,
       COUNT(*) as contracts_count
FROM project_contracts;
```

---

## ✅ Expected Output

After running the SQL, you should see:

```
| status                  | count |
|-------------------------|-------|
| Migration successful!   | 3     |
| Projects created:       | 1     |
| Contracts created:      | 2     |
```

---

## 🎯 What Gets Created

### **Tables:**
- ✅ `organizations` (3 demo orgs)
- ✅ `projects` (1 demo project)
- ✅ `project_contracts` (2 demo contracts)

### **Foreign Keys:**
- ✅ `project_contracts.project_id` → `projects.id`
- ✅ `project_contracts.from_org_id` → `organizations.id`
- ✅ `project_contracts.to_org_id` → `organizations.id`
- ✅ `project_contracts.disclosed_to_org_id` → `organizations.id`

### **Sample Data:**
- ✅ **Acme Inc** (client)
- ✅ **TechCorp Agency** (agency)
- ✅ **DevShop Subcontractor** (subcontractor)
- ✅ Contract: Acme → TechCorp @ $150/hr
- ✅ Contract: TechCorp → DevShop @ $85/hr

---

## 🔍 Verify Migration

Run this query in Supabase to verify:

```sql
SELECT 
  pc.id,
  p.name as project,
  o1.name as from_org,
  o2.name as to_org,
  pc.rate
FROM project_contracts pc
JOIN projects p ON pc.project_id = p.id
JOIN organizations o1 ON pc.from_org_id = o1.id
JOIN organizations o2 ON pc.to_org_id = o2.id;
```

**Expected result:**
```
E-Commerce Platform Redesign | Acme Inc → TechCorp Agency | $150
E-Commerce Platform Redesign | TechCorp Agency → DevShop Subcontractor | $85
```

---

## 🐛 Troubleshooting

### **Error: "relation already exists"**
✅ This is fine! The migration is idempotent (can run multiple times safely).

### **Error: "foreign key violation"**
❌ Make sure to run the FULL SQL above, not just parts. Tables must be created in order.

### **No data appears in UI**
🔄 Refresh the app page after running migration.

---

## 🎉 After Migration

1. **Refresh** your app at `#/contracts`
2. **See real data** from database (not mock data)
3. **Switch views:**
   - Client: Sees contract with Agency
   - Agency: Sees BOTH contracts (buying & selling)
   - Sub: Sees contract with Agency only
4. **Test the Local Scope Visibility!**

---

## 📂 Full Migration File

The complete migration with indexes and additional tables is in:

```
/docs/database/CONTRACTS_MIGRATION_FIXED.sql
```

---

**Ready?** Copy the SQL above → Open Supabase → Paste → Run! 🚀
