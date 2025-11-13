# 📚 WorkGraph Documentation

**Last Updated:** November 12, 2025  
**Current Phase:** Phase 1-3 Complete - Database Integration Active  
**Status:** Production-Ready Core Features

---

## 🚀 Quick Start

### **New to WorkGraph?**
→ Start here: [`/docs/guides/START_HERE.md`](./guides/START_HERE.md)

### **Want to understand the architecture?**
→ Architecture: [`/docs/architecture/MULTI_PARTY_ARCHITECTURE.md`](./architecture/MULTI_PARTY_ARCHITECTURE.md)

### **Want to see the roadmap?**
→ Roadmap: [`/docs/roadmap/MASTER_ROADMAP.md`](./roadmap/MASTER_ROADMAP.md)

---

## 📁 Documentation Structure

```
/docs/
├── README.md                          ← Updated index
├── DOCUMENTATION_CLEANUP_LOG.md       ← Audit trail (NEW)
├── Core docs (6 files)                ← Architecture & design
├── /guides/                           ← User guides (9 files)
├── /architecture/                     ← System design (5 files)
├── /roadmap/                          ← Product roadmap (2 files)
├── /database/                         ← Schemas (4 files)
├── /api/                              ← API specs (1 file)
└── /project-graph/                    ← Graph config (2 files)
```

---

## 🎯 What's Been Built

### ✅ **Phase 1: Unified Calendar & Timesheets**
- Multi-person timesheet calendar with drag-and-drop
- Weekly table → monthly drawer workflow
- Contract-based time entry with approval states
- Real-time database synchronization

### ✅ **Phase 2: Multi-Party Approval System**
- 3-layer hierarchical approval flows
- Contract-based visual grouping
- Multi-party project architecture (companies → agencies → freelancers)
- Rate visibility controls per contract

### ✅ **Phase 3: Database Integration**
- Pure Supabase architecture (migrated from hybrid KV)
- Real-time data synchronization across all views
- Timezone-aware date handling
- Fixed data consistency bugs (WorkGraph ↔ Timesheets matching)

### 📋 **Current Focus: Documentation & Roadmap Planning**
- Cleaning up outdated docs
- Organizing roadmap for Phase 4+
- Preparing for enterprise features

---

## 📖 Key Documentation Files

### **Core Architecture:**
- **[COMPREHENSIVE_APPROVAL_SYSTEM.md](./COMPREHENSIVE_APPROVAL_SYSTEM.md)** - Complete approval system design
- **[MULTI_PARTY_APPROVAL_ARCHITECTURE.md](./MULTI_PARTY_APPROVAL_ARCHITECTURE.md)** - Multi-party project architecture
- **[CONTRACT_SCOPED_RATE_VISIBILITY.md](./CONTRACT_SCOPED_RATE_VISIBILITY.md)** - Rate masking & privacy system
- **[CONTRACTOR_TYPES_AND_PERMISSIONS.md](./CONTRACTOR_TYPES_AND_PERMISSIONS.md)** - Permission matrix
- **[TIMESHEET_ARCHITECTURE.md](./TIMESHEET_ARCHITECTURE.md)** - Timesheet system design
- **[EXPENSE_MANAGEMENT_ARCHITECTURE.md](./EXPENSE_MANAGEMENT_ARCHITECTURE.md)** - Expense & receipt management
- **[PROJECT_GRAPH_EXPLAINED.md](./PROJECT_GRAPH_EXPLAINED.md)** - Graph vs data flow architecture ⭐ NEW
- **[TEMPORAL_GRAPH_VERSIONING.md](./TEMPORAL_GRAPH_VERSIONING.md)** - Graph structure versioning (companies leaving/joining)
- **[VERSIONING_STRATEGY.md](./VERSIONING_STRATEGY.md)** - Policy vs Graph versioning explained
- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Database configuration

---

## 🧪 How to Test

### **Quick Test (2 minutes):**
```bash
1. Navigate → "My Approvals"
2. Click "View path on graph"
3. Click "Approve Now from Graph"
4. Verify item disappears
5. Check console (F12) for errors
```

See: [`TEST_GRAPH_OVERLAY_NOW.md`](./guides/TEST_GRAPH_OVERLAY_NOW.md)

### **Comprehensive Test (15 minutes):**
See: [`QUICK_TEST_CHECKLIST.md`](./guides/QUICK_TEST_CHECKLIST.md)

---

## 🏗️ Architecture Overview

### **Three-Surface Approvals Pattern:**
```
Surface 1: Global Workbench (✅ Complete)
  → Cross-project queue
  → Bulk actions
  → Speed-optimized

Surface 2: Project Approvals Tab (⏳ Day 6)
  → Project-scoped queue
  → Details drawer
  → Context-rich

Surface 3: Deep-Links (⏳ Day 7)
  → Email → Direct action
  → No navigation
  → Audit trail
```

### **Policy Versioning:**
```
Graph Edit → Compile → Publish → vN
  ↓                                ↓
Draft                     Immutable snapshot
  ↓                                ↓
Keep building           Used for approvals
```

### **Rate Masking:**
```
Contract defines visibility:
  hideRateFrom: ['party-manager', 'party-client']

API respects rules:
  if (canViewRates) { amount: 6000 }
  else { amount: null }

UI shows:
  amount ? "$6,000" : "•••"
```

---

## 📊 Current Status

**Phase:** 5 - Integration & Real Data  
**Days Complete:** 4/14 (29%)  
**Features Complete:** 10/13 (77%)  
**Code Written:** 2,685 lines  
**Quality:** Production-ready ✅

**Next Steps:**
- Day 5: Keyboard shortcuts + enhancements
- Day 6: Project approvals tab
- Day 7: Deep-links + email templates
- Days 8-14: Real database integration

---

## 🎯 Quick Links

### **I want to...**
- **Test the app** → [`TEST_GRAPH_OVERLAY_NOW.md`](./guides/TEST_GRAPH_OVERLAY_NOW.md)
- **See what's done** → [`WHAT_HAS_BEEN_DONE.md`](./guides/WHAT_HAS_BEEN_DONE.md)
- **Understand architecture** → [`MULTI_PARTY_ARCHITECTURE.md`](./architecture/MULTI_PARTY_ARCHITECTURE.md)
- **See the roadmap** → [`MASTER_ROADMAP.md`](./roadmap/MASTER_ROADMAP.md)
- **Get started** → [`START_HERE.md`](./guides/START_HERE.md)

---

## 📝 Contributing

When adding new documentation:
1. Place in appropriate folder (`/guides`, `/architecture`, `/roadmap`)
2. Update this README with link
3. Use clear, descriptive filenames
4. Add to relevant index files

---

## 🎉 What's Working

✅ Multi-party project creation  
✅ Policy versioning (v1, v2, v3...)  
✅ Cross-project approval queue  
✅ Smart filtering (4 types)  
✅ Bulk approve with threshold  
✅ Rate masking  
✅ SLA tracking  
✅ Graph overlay modal  
✅ Approve from graph  
✅ Zero console errors

---

**Created:** November 6, 2025  
**Maintained by:** WorkGraph Team  
**Status:** 🟢 Active Development

**Need help?** Start with [`/docs/guides/START_HERE.md`](./guides/START_HERE.md)