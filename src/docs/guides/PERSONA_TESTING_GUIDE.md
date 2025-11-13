# 🧪 Persona Testing Guide

**Phase 5 - Test Mode Only**  
**Will be replaced with real Supabase Auth in Phase 9**

---

## 🎯 Purpose

This lightweight persona switcher allows you to validate the end-to-end approval flow by switching between different user roles without implementing full authentication.

---

## 👥 Test Personas

### 1. **Alice Chen** (Contractor)
- **Email:** `alice@contractor.com`
- **Role:** `contractor`
- **Permissions:**
  - ✅ Create timesheets
  - ✅ View own timesheets
  - ✅ Submit timesheets for approval
  - ❌ Cannot approve timesheets

### 2. **Bob Martinez** (Manager)
- **Email:** `bob@techcorp.com`
- **Role:** `manager`
- **Permissions:**
  - ✅ Approve/reject timesheets from contractors
  - ✅ View all projects
  - ✅ Create projects
  - ❌ Cannot submit timesheets

### 3. **Charlie Davis** (Client)
- **Email:** `charlie@megacorp.com`
- **Role:** `client`
- **Permissions:**
  - ✅ Final approval on timesheets
  - ✅ View all approved timesheets
  - ❌ Cannot create timesheets or projects

---

## 🚀 How to Test End-to-End Approval Flow

### **Step 0: Setup Postgres Database (REQUIRED)**

**⚠️ IMPORTANT:** Before testing, you must set up Postgres tables first!

1. Go to **`/setup`** page
2. Click **"Run SQL Migrations"** to create tables
3. Click **"Seed Demo Data"** to add Alice, Bob, Charlie + timesheets
4. ✅ Verify: You should see success messages

**This creates:**
- ✅ 3 test users in Postgres (Alice, Bob, Charlie)
- ✅ Alice's timesheet: 40 hours @ $150/hr = $6,000
- ✅ Contracts, organizations, time entries

**Now you'll see Alice's timesheet in the Projects tab!**

---

### **Step 1: Seed Approval Workflow (Optional)**

Only if you want to test email-based approval:

1. Go to **"🔧 Database Setup"** in the dev nav
2. Click **"🌱 Seed Test Data"**
   - This creates approval tokens for Bob/Charlie
   - Does NOT create timesheet data (that's in Postgres)
3. You should see: "✅ Approval workflow created!"

---

### **Simplest Test Case: Contractor → Manager**

1. **Switch to Alice (Contractor)**
   - Click the persona switcher in the top nav
   - Select "Alice Chen - Contractor"
   
2. **View Your Timesheet**
   - Go to "Projects" tab → "Timesheets"
   - You should ONLY see Alice Chen's timesheet (40h, $6000)
   - Status should be "Submitted" (waiting for Bob)
   
3. **Switch to Bob (Manager)**
   - Click the persona switcher
   - Select "Bob Martinez - Manager"
   
4. **Approve the Timesheet**
   - Go to "✅ My Approvals" tab
   - Find Alice's pending timesheet (40h, $6000)
   - Click "✅ Approve" 
   - This moves it to Charlie for final approval
   
5. **Switch to Charlie (Client)**
   - Select "Charlie Davis - Client"
   - Go to "✅ My Approvals"
   - Find the same timesheet (now waiting for client approval)
   - Click "✅ Approve" for final approval
   
6. **Switch back to Alice**
   - Verify the timesheet status is now "Approved"
   - All 3 personas played their role! ✅

---

### **Full 3-Party Chain: Contractor → Manager → Client**

1. **As Alice (Contractor):** View submitted timesheet (status: pending)
2. **As Bob (Manager):** Approve to move to next level
3. **As Charlie (Client):** Final approval to complete
4. **As Alice (Contractor):** See final approved status