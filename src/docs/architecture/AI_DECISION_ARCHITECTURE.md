# AI Decision Architecture

**Version:** 1.0  
**Last Updated:** November 6, 2025  
**Status:** 📋 Planned for Phase 6

---

## 🎯 Overview

WorkGraph's AI Decision System enables **intelligent, automated approval routing** that learns from human decisions and gradually takes over routine approvals while maintaining full audit compliance.

**Key Design Principles:**
- 🛡️ **Safety First:** Shadow → Assist → Auto progression
- 🧠 **Explainable:** Every decision has human-readable reasoning
- 🔄 **Learning:** Improves from human overrides
- 🚨 **Reversible:** Instant kill switches per tenant
- 📊 **Observable:** Complete metrics and audit trail

---

## 🏗️ System Architecture

### **High-Level Flow**

```
┌─────────────────────────────────────────────────────┐
│ Timesheet Submitted                                 │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ Feature Extraction                                  │
│ - Amount, rate, hours                               │
│ - Week-over-week change                             │
│ - Contractor history                                │
│ - Manager queue depth                               │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ Rule Engine Evaluation                              │
│ - Check thresholds                                  │
│ - Detect anomalies                                  │
│ - Calculate confidence score                        │
│ - Generate explanation                              │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│ Policy Mode Decision                                │
│ - Shadow: Log only                                  │
│ - Assist: Suggest to human                          │
│ - Auto: Execute if safe                             │
└──────────────┬──────────────────────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
   Auto Mode     Human Mode
   (Execute)     (Suggest)
        │             │
        ▼             ▼
   Approval      Approval Task
   Complete      Created
        │             │
        └──────┬──────┘
               ▼
        Audit Logged
```

---

## 🔄 Three-Mode Progression

### **Mode 1: Shadow (Learning)**

**Purpose:** Collect data without affecting system

**Behavior:**
- AI evaluates every submission
- Scores and decisions logged to DB
- **Zero impact** on approval flow
- Humans approve as normal
- System learns what humans do

**Duration:** 2-4 weeks minimum

**Example:**
```
Timesheet submitted
  ↓
AI evaluates: "Would approve (score: 0.92)"
  ↓
Logged to ai_decision table
  ↓
Human approves normally
  ↓
AI compares: Did human agree? (Yes = good signal)
```

**Exit Criteria:**
- ✅ 1000+ decisions logged
- ✅ Agreement rate ≥70%
- ✅ No false positives in top 100 confident decisions
- ✅ Team reviewed and approved

---

### **Mode 2: Assist (Augmenting)**

**Purpose:** Help humans make faster decisions

**Behavior:**
- AI shows suggestions inline
- Humans can accept or override
- One-click approve if agree
- Override tracked for learning
- AI confidence visible

**Duration:** 2-4 weeks minimum

**Example:**
```
Timesheet in approval queue
  ↓
UI shows badge: "AI suggests: Approve ✓ (95% confident)"
  ↓
Human clicks "Accept AI Suggestion"
  ↓
Approved in 1 click (vs 5 clicks manual)
  ↓
Override tracked: No override = agreement
```

**UI Mockup:**
```
┌──────────────────────────────────────────────────┐
│ Jane Doe - Senior Developer                     │
│ Mobile App · Week of 10/29                      │
│ 40.0h · $6,000                                   │
│                                                   │
│ 🤖 AI suggests: Approve ✓ (95% confident)       │
│    No anomalies detected. Amount within budget.  │
│                                                   │
│ [Accept AI Suggestion] [Review Manually] [Why?] │
└──────────────────────────────────────────────────┘
```

**Exit Criteria:**
- ✅ Agreement rate ≥80%
- ✅ Override rate stable (<20%)
- ✅ User satisfaction ≥8/10
- ✅ Zero critical errors

---

### **Mode 3: Auto (Autonomous)**

**Purpose:** Execute routine approvals without human intervention

**Behavior:**
- AI auto-approves if confidence ≥ threshold
- Safety caps enforced (max N per day)
- Fallback to human if uncertain
- Full audit trail maintained
- Kill switch available

**Duration:** Ongoing (with monitoring)

**Example:**
```
Timesheet submitted ($800, no flags, 0.96 confidence)
  ↓
AI checks:
  - Amount < $1000 ✓
  - No anomalies ✓
  - Confidence ≥ 0.85 ✓
  - Daily cap not exceeded ✓
  ↓
Auto-approved by AI
  ↓
Approval record created (decided_by: 'ai_agent')
  ↓
Event emitted → n8n workflow → Invoice generated
  ↓
Contractor notified
  ↓
Complete in 2 seconds (vs 24 hours manual)
```

**Safety Caps:**
```
Daily Caps (start conservative, increase based on accuracy):
- Week 1: Max 10 auto-approvals/day per project
- Week 2: Max 25/day (if accuracy ≥99%)
- Week 3: Max 50/day (if accuracy ≥99.5%)
- Month 2+: Dynamic based on 7-day rolling accuracy
```

**Exit Criteria:**
- ✅ Running in production for 1+ month
- ✅ Accuracy ≥99.5%
- ✅ Zero critical errors in 30 days
- ✅ User trust established

---

## 🧮 Feature Extraction

### **Timesheet Features**

```typescript
interface TimesheetFeatures {
  // Basic
  amount_cents: number;
  hourly_rate_cents: number;
  total_hours: number;
  
  // Temporal
  submission_day_of_week: string;
  submission_hour: number;
  days_until_period_end: number;
  
  // Historical (contractor)
  contractor_tenure_days: number;
  contractor_avg_hours_per_week: number;
  contractor_streak_weeks: number;
  contractor_approval_rate: number; // % approved vs rejected
  
  // Deltas (changes)
  rate_change_pct: number;          // vs contract rate
  hours_change_pct: number;         // vs last week
  amount_change_pct: number;        // vs last week
  
  // Context
  manager_queue_depth: number;      // How busy is approver?
  manager_avg_response_hours: number;
  project_budget_remaining_pct: number;
  
  // Contract compliance
  rate_matches_contract: boolean;
  hours_within_contract_limit: boolean;
  has_active_contract: boolean;
}
```

### **Feature Computation**

```typescript
async function extractFeatures(
  timesheet: Timesheet,
  projectId: string
): Promise<TimesheetFeatures> {
  
  const contractor = await getContractor(timesheet.contractor_id);
  const contract = await getActiveContract(timesheet.contractor_id, projectId);
  const history = await getTimesheetHistory(timesheet.contractor_id, 8); // last 8 weeks
  const manager = await getAssignedManager(projectId, timesheet.contractor_id);
  
  return {
    // Basic
    amount_cents: timesheet.amount_cents,
    hourly_rate_cents: timesheet.rate_cents,
    total_hours: timesheet.hours,
    
    // Temporal
    submission_day_of_week: timesheet.created_at.day(),
    submission_hour: timesheet.created_at.hour(),
    days_until_period_end: daysUntil(timesheet.period.upper),
    
    // Historical
    contractor_tenure_days: daysSince(contractor.created_at),
    contractor_avg_hours_per_week: avg(history.map(h => h.hours)),
    contractor_streak_weeks: consecutiveWeeks(history),
    contractor_approval_rate: approvalRate(history),
    
    // Deltas
    rate_change_pct: percentChange(timesheet.rate_cents, contract.rate_cents),
    hours_change_pct: percentChange(timesheet.hours, lastWeek(history).hours),
    amount_change_pct: percentChange(timesheet.amount_cents, lastWeek(history).amount_cents),
    
    // Context
    manager_queue_depth: await countPendingApprovals(manager.id),
    manager_avg_response_hours: await avgResponseTime(manager.id),
    project_budget_remaining_pct: await budgetRemaining(projectId),
    
    // Contract compliance
    rate_matches_contract: timesheet.rate_cents === contract.rate_cents,
    hours_within_contract_limit: timesheet.hours <= contract.max_hours_per_week,
    has_active_contract: contract !== null,
  };
}
```

---

## 🎲 Rule Engine

### **Threshold-Based Rules**

```typescript
interface PolicyRules {
  // Auto-approve thresholds
  auto_approve_max_cents: number;           // e.g., 100000 ($1k)
  auto_approve_min_confidence: number;      // e.g., 0.85
  
  // Anomaly flags
  reject_if_hours_over: number;             // e.g., 80 hours/week
  flag_if_rate_change_pct: number;          // e.g., 10%
  flag_if_hours_change_pct: number;         // e.g., 20%
  flag_if_new_contractor_days: number;      // e.g., 30 days
  
  // Sensitivity
  anomaly_sensitivity: 'low' | 'medium' | 'high';
  
  // Routing
  route_to_senior_if_amount_over: number;   // e.g., 500000 ($5k)
  route_round_robin: boolean;
}
```

### **Rule Evaluation**

```typescript
function evaluateRules(
  features: TimesheetFeatures,
  rules: PolicyRules
): { score: number; flags: string[]; decision: string; reason: string } {
  
  const flags: string[] = [];
  let score = 1.0; // Start perfect, deduct for issues
  
  // Check anomalies
  if (features.total_hours > rules.reject_if_hours_over) {
    flags.push('hours_over_limit');
    score -= 0.5;
  }
  
  if (Math.abs(features.rate_change_pct) > rules.flag_if_rate_change_pct) {
    flags.push('rate_mismatch');
    score -= 0.3;
  }
  
  if (Math.abs(features.hours_change_pct) > rules.flag_if_hours_change_pct) {
    flags.push('hours_spike');
    score -= 0.2;
  }
  
  if (features.contractor_tenure_days < rules.flag_if_new_contractor_days) {
    flags.push('new_contractor');
    score -= 0.1;
  }
  
  if (!features.rate_matches_contract) {
    flags.push('contract_rate_mismatch');
    score -= 0.4;
  }
  
  if (!features.has_active_contract) {
    flags.push('no_active_contract');
    score = 0; // Hard reject
  }
  
  // Positive signals (boost score)
  if (features.contractor_streak_weeks >= 4) {
    score += 0.05; // Consistent contractor
  }
  
  if (features.contractor_approval_rate >= 0.95) {
    score += 0.05; // Rarely rejected
  }
  
  // Cap between 0 and 1
  score = Math.max(0, Math.min(1, score));
  
  // Decision logic
  let decision: string;
  let reason: string;
  
  if (flags.includes('no_active_contract')) {
    decision = 'reject';
    reason = 'No active contract found';
  } else if (flags.length === 0 && features.amount_cents <= rules.auto_approve_max_cents && score >= rules.auto_approve_min_confidence) {
    decision = 'approve';
    reason = `Auto-approve: amount under $${rules.auto_approve_max_cents / 100}, no anomalies, high confidence (${(score * 100).toFixed(1)}%)`;
  } else if (flags.length > 0) {
    decision = 'flag';
    reason = `Flagged for review: ${flags.join(', ')}`;
  } else {
    decision = 'route';
    reason = `Amount over threshold or low confidence (${(score * 100).toFixed(1)}%)`;
  }
  
  return { score, flags, decision, reason };
}
```

---

## 🤖 AI Decision Service

### **Main Evaluation Flow**

```typescript
async function evaluateTimesheet(
  timesheetId: string,
  projectId: string
): Promise<AIDecision> {
  
  // 1. Load policy
  const policy = await loadPolicy(projectId, 'timesheet');
  
  // 2. Extract features
  const timesheet = await getTimesheet(timesheetId);
  const features = await extractFeatures(timesheet, projectId);
  
  // 3. Evaluate rules
  const { score, flags, decision, reason } = evaluateRules(features, policy.rules);
  
  // 4. Store AI decision
  const aiDecision = await createAIDecision({
    approval_id: null, // Will link later
    model_version_id: policy.model_version_id,
    features,
    score,
    flags,
    suggested_action: decision,
    confidence: score,
    explanation: {
      reason,
      features_used: Object.keys(features),
      rules_triggered: flags,
    },
  });
  
  // 5. Act based on policy mode
  if (policy.mode === 'shadow') {
    // Log only, create human task
    const approval = await createApprovalTask(timesheetId, projectId);
    await linkAIDecision(aiDecision.id, approval.id);
    
    console.log(`[Shadow] AI would ${decision}: ${reason}`);
    
  } else if (policy.mode === 'assist') {
    // Create task with AI suggestion
    const approval = await createApprovalTask(timesheetId, projectId, {
      ai_suggestion: decision,
      ai_confidence: score,
      ai_reason: reason,
    });
    await linkAIDecision(aiDecision.id, approval.id);
    
  } else if (policy.mode === 'auto') {
    // Check safety caps
    const todayAutoCount = await countAutoApprovalsToday(projectId);
    const dailyCap = policy.rules.auto_approve_daily_cap || 10;
    
    if (decision === 'approve' && todayAutoCount < dailyCap) {
      // Auto-approve!
      const approval = await createApproval({
        timesheet_id: timesheetId,
        project_id: projectId,
        status: 'approved',
        decided_by: 'ai_agent',
        decided_at: new Date(),
        decision: {
          ai_model_version: policy.model_version_id,
          score,
          flags,
          reason,
        },
      });
      await linkAIDecision(aiDecision.id, approval.id);
      
      // Emit event for n8n
      await emitEvent('approval.completed', {
        approvalId: approval.id,
        timesheetId,
        projectId,
        decidedBy: 'ai_agent',
        score,
      });
      
      console.log(`[Auto] Approved: ${reason}`);
      
    } else {
      // Fallback to human (cap exceeded or flagged)
      const approval = await createApprovalTask(timesheetId, projectId, {
        ai_suggestion: decision,
        ai_confidence: score,
        ai_reason: decision === 'approve' ? 'Daily auto-approve cap exceeded' : reason,
      });
      await linkAIDecision(aiDecision.id, approval.id);
      
      console.log(`[Auto] Fallback to human: ${decision === 'approve' ? 'cap exceeded' : reason}`);
    }
  }
  
  // 6. Audit log
  await audit('ai.evaluate', {
    timesheetId,
    projectId,
    mode: policy.mode,
    decision,
    score,
    flags,
  });
  
  return aiDecision;
}
```

---

## 🎓 Learning from Humans

### **Override Tracking**

```typescript
async function handleHumanDecision(
  approvalId: string,
  humanDecision: 'approve' | 'reject',
  humanUserId: string
) {
  
  // Get AI decision
  const aiDecision = await getAIDecisionByApproval(approvalId);
  
  if (aiDecision) {
    // Did human agree with AI?
    const agreed = (
      (aiDecision.suggested_action === 'approve' && humanDecision === 'approve') ||
      (aiDecision.suggested_action === 'reject' && humanDecision === 'reject')
    );
    
    // Update override flag
    await updateAIDecision(aiDecision.id, {
      human_override: !agreed,
      human_decision: humanDecision,
      human_user_id: humanUserId,
    });
    
    // Log disagreement for learning
    if (!agreed) {
      await logLearningSignal({
        ai_decision_id: aiDecision.id,
        ai_suggested: aiDecision.suggested_action,
        human_decided: humanDecision,
        features: aiDecision.features,
        score: aiDecision.score,
        flags: aiDecision.flags,
      });
      
      console.log(`[Learning] Human disagreed: AI said ${aiDecision.suggested_action}, human said ${humanDecision}`);
    }
  }
}
```

### **Retraining Pipeline (Future: GBDT)**

```typescript
async function retrainModel() {
  // 1. Extract training data from audit log
  const decisions = await db.query(`
    SELECT
      d.features,
      CASE 
        WHEN a.status = 'approved' THEN 1
        WHEN a.status = 'rejected' THEN 0
      END as label
    FROM ai_decision d
    JOIN approval a ON a.id = d.approval_id
    WHERE a.decided_by != 'ai_agent'  -- Only human decisions
      AND a.decided_at > now() - interval '90 days'
  `);
  
  // 2. Split train/test
  const { train, test } = splitData(decisions, 0.8);
  
  // 3. Train GBDT model
  const model = await trainLightGBM(train, {
    objective: 'binary',
    num_leaves: 31,
    learning_rate: 0.05,
    feature_fraction: 0.9,
  });
  
  // 4. Evaluate on test set
  const metrics = await evaluate(model, test);
  console.log('Model metrics:', metrics);
  // { accuracy: 0.94, precision: 0.92, recall: 0.96, auc: 0.98 }
  
  // 5. Compare to current model
  const currentModel = await getCurrentModel();
  const currentMetrics = await evaluate(currentModel, test);
  
  if (metrics.accuracy > currentMetrics.accuracy) {
    // 6. Create new model version
    const newVersion = await createModelVersion({
      model_type: 'gbdt',
      version: `v${Date.now()}`,
      config: model.getConfig(),
      training_date: new Date(),
      metrics,
      is_active: false, // Start inactive
    });
    
    console.log(`New model trained: ${newVersion.version}, accuracy: ${metrics.accuracy}`);
    
    // 7. Canary rollout (10% traffic)
    await setCanaryTraffic(newVersion.id, 0.1);
    
  } else {
    console.log('New model not better than current, keeping current model');
  }
}
```

---

## 🚨 Kill Switch Implementation

### **Emergency Downgrade**

```typescript
async function disableAIForTenant(
  tenantId: string,
  reason: string,
  disabledBy: string
) {
  
  // 1. Update tenant settings
  await db.query(`
    UPDATE tenant
    SET settings = jsonb_set(
      settings,
      '{ai_mode}',
      '"assist"'::jsonb
    )
    WHERE id = $1
  `, [tenantId]);
  
  // 2. Cancel any pending auto-approvals
  await db.query(`
    UPDATE approval
    SET status = 'pending',
        decided_by = NULL,
        decided_at = NULL
    WHERE project_id IN (
      SELECT id FROM project WHERE tenant_id = $1
    )
    AND status = 'auto_approved'
    AND decided_at > now() - interval '5 minutes'
  `, [tenantId]);
  
  // 3. Audit log
  await audit('ai.kill_switch_activated', {
    tenantId,
    reason,
    disabledBy,
    previousMode: 'auto',
    newMode: 'assist',
  });
  
  // 4. Alert stakeholders
  await emitEvent('ai.disabled', {
    tenantId,
    reason,
    disabledBy,
  });
  
  console.log(`[Kill Switch] AI disabled for tenant ${tenantId}: ${reason}`);
}
```

### **Automatic Triggers**

```typescript
// Run every 5 minutes
async function monitorAIHealth() {
  const tenants = await getTenantsWithAIEnabled();
  
  for (const tenant of tenants) {
    // Check error rate (last 24h)
    const errorRate = await getAIErrorRate(tenant.id, '24 hours');
    
    if (errorRate > 0.05) { // >5% error rate
      await disableAIForTenant(
        tenant.id,
        `Error rate too high: ${(errorRate * 100).toFixed(1)}%`,
        'system'
      );
      continue;
    }
    
    // Check anomaly spike
    const anomalyRate = await getAnomalyRate(tenant.id, '1 hour');
    
    if (anomalyRate > 0.5) { // >50% flagged in last hour
      await disableAIForTenant(
        tenant.id,
        `Anomaly spike: ${(anomalyRate * 100).toFixed(1)}% of items flagged`,
        'system'
      );
      continue;
    }
    
    // Check webhook failures
    const webhookFailureRate = await getWebhookFailureRate(tenant.id, '1 hour');
    
    if (webhookFailureRate > 0.1) { // >10% webhook failures
      console.warn(`[Monitor] Tenant ${tenant.id} webhook failures: ${(webhookFailureRate * 100).toFixed(1)}%`);
      // Don't disable AI, but alert
      await alertOps('webhook_failures', { tenantId: tenant.id, rate: webhookFailureRate });
    }
  }
}
```

---

## 📊 Metrics & Observability

### **Key Metrics to Track**

```typescript
interface AIMetrics {
  // Accuracy
  auto_approval_rate: number;        // % of items auto-approved
  agreement_rate: number;            // % AI agrees with human
  override_rate: number;             // % human overrides AI
  false_positive_rate: number;       // % incorrectly approved
  false_negative_rate: number;       // % incorrectly rejected
  
  // Performance
  avg_decision_time_ms: number;
  p95_decision_time_ms: number;
  decisions_per_second: number;
  
  // Quality
  confidence_calibration: number;    // Are 90% confident decisions 90% accurate?
  feature_importance: Record<string, number>;
  
  // Business
  time_saved_hours: number;
  cost_per_decision: number;
  approval_sla_compliance: number;
}
```

### **Dashboard Queries**

```sql
-- Auto-approval rate (last 7 days)
SELECT
  COUNT(*) FILTER (WHERE decided_by = 'ai_agent') * 100.0 / COUNT(*) as auto_approval_rate
FROM approval
WHERE created_at > now() - interval '7 days';

-- Agreement rate (AI vs human)
SELECT
  COUNT(*) FILTER (WHERE NOT human_override) * 100.0 / COUNT(*) as agreement_rate
FROM ai_decision
WHERE created_at > now() - interval '7 days'
  AND human_override IS NOT NULL;

-- Average decision time saved
SELECT
  AVG(
    EXTRACT(EPOCH FROM decided_at - created_at) / 3600
  ) as avg_hours_to_decision
FROM approval
WHERE decided_by = 'ai_agent'
  AND decided_at > now() - interval '7 days';
```

---

## 🔒 Security Considerations

### **Principle: Least Privilege**

```typescript
// AI can only approve what a human could approve
async function checkAIPermissions(
  timesheetId: string,
  projectId: string
): Promise<boolean> {
  
  // Would a manager be able to approve this?
  const manager = await getAssignedManager(projectId);
  const canApprove = await checkPermission(manager.id, 'approval.approve', projectId);
  
  if (!canApprove) {
    console.warn(`[Security] AI cannot approve - manager lacks permission`);
    return false;
  }
  
  return true;
}
```

### **Audit Trail**

Every AI decision must be fully auditable:

```sql
-- Complete audit trail
SELECT
  a.id,
  a.decided_by,
  a.decided_at,
  d.score,
  d.flags,
  d.explanation,
  d.human_override,
  d.features
FROM approval a
JOIN ai_decision d ON d.approval_id = a.id
WHERE a.id = 'approval_123';
```

---

## 🎯 Summary

WorkGraph's AI Decision Architecture provides:

✅ **Safe rollout** via Shadow → Assist → Auto  
✅ **Explainable decisions** with human-readable reasoning  
✅ **Continuous learning** from human overrides  
✅ **Safety mechanisms** (caps, kill switches, monitoring)  
✅ **Full observability** (metrics, logs, traces)  
✅ **Production-grade** (reliable, secure, compliant)

**Next:** Implement in Phase 6 (Weeks 2-4) 🚀

---

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Owner:** Engineering Team
