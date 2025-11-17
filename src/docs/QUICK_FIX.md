# ⚡ QUICK FIX - Missing Columns

**Error:** `column project_contracts.from_org_id does not exist`

**Solution:** Copy/paste this SQL into Supabase → Done in 30 seconds!

---

## 🚀 3-Step Fix

### **1. Open Supabase**
Go to: https://supabase.com/dashboard → Your Project → SQL Editor

### **2. Copy This SQL**
```sql
-- Add missing columns
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'from_org_id'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN from_org_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'to_org_id'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN to_org_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN project_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'relationship'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN relationship TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'contract_type'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN contract_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'rate'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN rate DECIMAL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_contracts' AND column_name = 'status'
  ) THEN
    ALTER TABLE project_contracts ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
END $$;

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert sample data
INSERT INTO organizations (id, name, type) VALUES 
  ('acme-inc', 'Acme Inc', 'client'),
  ('techcorp-agency', 'TechCorp Agency', 'agency'),
  ('devshop-sub', 'DevShop Subcontractor', 'subcontractor')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, description) VALUES 
  ('11111111-1111-1111-1111-111111111111', 
   'E-Commerce Platform Redesign', 
   'Complete redesign')
ON CONFLICT (id) DO NOTHING;

-- Insert sample contracts
INSERT INTO project_contracts (id, project_id, from_org_id, to_org_id, contract_type, rate, relationship, status) 
VALUES 
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'acme-inc', 'techcorp-agency', 'vendor', 150.00, 'client_to_agency', 'active'),
  ('33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111',
   'techcorp-agency', 'devshop-sub', 'subcontractor', 85.00, 'agency_to_sub', 'active')
ON CONFLICT (id) DO NOTHING;
```

### **3. Run It**
Click "Run" → Refresh your app → Done!

---

## ✅ What This Does

- ✅ Adds `from_org_id`, `to_org_id`, `project_id` columns to existing table
- ✅ Creates `organizations` and `projects` tables
- ✅ Inserts 3 demo organizations
- ✅ Inserts 1 demo project
- ✅ Inserts 2 demo contracts
- ✅ Safe to run multiple times (idempotent)

---

## 🎯 Expected Result

After running, your app at `#/contracts` will show:

**Client View (Acme Inc):**
- Contract with TechCorp Agency @ $150/hr

**Agency View (TechCorp):**
- Buying from Acme @ $150/hr
- Selling to DevShop @ $85/hr

**Sub View (DevShop):**
- Contract with TechCorp @ $85/hr

---

**Time:** 30 seconds  
**Difficulty:** Copy/Paste  
**Result:** ✅ Working contracts UI with real data!
