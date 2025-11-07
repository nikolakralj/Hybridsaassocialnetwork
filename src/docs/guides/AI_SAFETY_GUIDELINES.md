# AI Safety Guidelines

**Version:** 1.0  
**Last Updated:** November 6, 2025  
**Status:** 📋 Mandatory for Phase 6

---

## ⚠️ Critical Safety Principles

**Before deploying AI to production, ALL team members must understand:**

1. **🛡️ AI augments humans, never replaces accountability**
2. **📊 Shadow mode is mandatory before assist mode**
3. **🚨 Kill switches must be tested weekly**
4. **📝 Every AI decision must be explainable**
5. **🔄 Learning from humans is continuous**

---

## 🚦 When to Use Each Mode

### **Shadow Mode (Always Start Here)**

**Use when:**
- ✅ First time deploying AI for a tenant
- ✅ Testing new model version
- ✅ New approval policy type
- ✅ After major code changes
- ✅ After accuracy drop >2%

**Duration:** Minimum 2 weeks OR 1000+ decisions

**Success Criteria:**
- Agreement rate ≥70%
- Zero critical errors
- Team reviewed and approved

**Do NOT skip shadow mode!**

---

### **Assist Mode (Human in Loop)**

**Use when:**
- ✅ Shadow mode completed successfully
- ✅ Agreement rate ≥80%
- ✅ Team trained on AI suggestions
- ✅ Override tracking working

**Duration:** Minimum 2 weeks

**Success Criteria:**
- Agreement rate ≥80%
- User satisfaction ≥8/10
- Override rate stable (<20%)

**Red flags to watch:**
- Humans blindly accepting AI suggestions (educate users!)
- Agreement rate dropping over time
- Specific user overriding >50% (investigate why)

---

### **Auto Mode (Supervised Automation)**

**Use when:**
- ✅ Assist mode completed successfully
- ✅ Agreement rate ≥85%
- ✅ Zero critical errors in 30 days
- ✅ Kill switch tested
- ✅ Safety caps configured

**Start conservatively:**
- Week 1: Max 10 auto-approvals/day
- Week 2: Max 25/day (if accuracy ≥99%)
- Month 2+: Dynamic based on rolling accuracy

**Never auto-approve:**
- ❌ New contractors (<30 days)
- ❌ Amounts >$5k (without explicit approval)
- ❌ Timesheets with flags
- ❌ When confidence <85%

---

## 🚨 Kill Switch Procedures

### **When to Activate Kill Switch:**

**Immediate (within 5 minutes):**
- 🔴 Auto-approval error rate >5% in last hour
- 🔴 Critical error (wrong amount, wrong person)
- 🔴 Webhook failures >10% in last hour
- 🔴 Anomaly rate >50% in last hour

**Within 1 hour:**
- 🟡 Agreement rate drops >5% from baseline
- 🟡 Multiple user complaints
- 🟡 Unexpected model behavior

**Planned (maintenance):**
- 🟢 Before deploying new model version
- 🟢 Before major code changes
- 🟢 During high-risk periods (year-end, audits)

---

### **How to Activate Kill Switch:**

**Via API:**
```bash
curl -X POST https://api.workgraph.com/admin/tenants/{id}/ai/disable \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"reason": "Error rate too high", "disabledBy": "ops-team"}'
```

**Via Dashboard:**
1. Go to Admin → Tenants → [Tenant Name]
2. Click "AI Settings"
3. Click "Emergency Stop"
4. Enter reason
5. Confirm

**Via Database (emergency):**
```sql
UPDATE tenant
SET settings = jsonb_set(settings, '{ai_mode}', '"assist"'::jsonb)
WHERE id = 'tenant-id';
```

---

### **After Activating Kill Switch:**

**Immediately:**
1. ✅ Verify AI mode switched to `assist`
2. ✅ Verify no pending auto-approvals
3. ✅ Post in #incidents Slack
4. ✅ Alert engineering team

**Within 1 hour:**
1. ✅ Root cause analysis
2. ✅ Review last 100 AI decisions
3. ✅ Check for incorrect auto-approvals
4. ✅ Notify affected users if needed

**Within 24 hours:**
1. ✅ Fix root cause
2. ✅ Add regression test
3. ✅ Update monitoring/alerts
4. ✅ Document incident in postmortem

**Before re-enabling:**
1. ✅ Confirm fix deployed
2. ✅ Run shadow mode for 24h
3. ✅ Get approval from engineering lead
4. ✅ Monitor closely for 48h

---

## 📊 Monitoring Requirements

### **Must Monitor (Real-Time):**

```
Auto-approval rate      → Alert if >20% or <5%
Agreement rate          → Alert if drops >5%
Override rate           → Alert if >30%
Error rate              → Alert if >2%
Webhook success rate    → Alert if <95%
DLQ depth               → Alert if >10
Confidence distribution → Alert if p50 <0.7
```

### **Must Review (Daily):**

```
Top 10 overrides        → Why did humans disagree?
Low confidence items    → Are we routing correctly?
Anomaly patterns        → Are we flagging correctly?
Feature importance      → Is model using right signals?
```

### **Must Review (Weekly):**

```
Agreement trend         → Improving or degrading?
Override breakdown      → By user, by project, by amount
Model drift metrics     → Is accuracy stable?
Safety cap utilization  → Should we increase caps?
```

---

## 🎯 Decision Checklist

### **Before Enabling AI for a Tenant:**

- [ ] Tenant has ≥100 historical approvals
- [ ] Shadow mode ran for ≥2 weeks
- [ ] Agreement rate ≥70% in shadow mode
- [ ] Zero critical errors in shadow mode
- [ ] Team trained on AI features
- [ ] Kill switch tested
- [ ] Alerts configured
- [ ] Tenant explicitly opted in
- [ ] Legal/compliance approved

### **Before Switching Shadow → Assist:**

- [ ] Shadow mode criteria met
- [ ] Team reviewed AI suggestions and approved
- [ ] UI shows AI confidence clearly
- [ ] Override tracking working
- [ ] Users trained on how to override
- [ ] Agreement rate ≥80%

### **Before Switching Assist → Auto:**

- [ ] Assist mode ran for ≥2 weeks
- [ ] Agreement rate ≥85%
- [ ] Zero critical errors in 30 days
- [ ] Safety caps configured (start at 10/day)
- [ ] Kill switch tested this week
- [ ] Ops team on-call and aware
- [ ] Users notified about auto-approvals
- [ ] Audit trail verified working

---

## ⚖️ Compliance & Audit

### **Every AI Decision Must:**

1. **Be logged** to `ai_decision` table
2. **Include explanation** (human-readable reason)
3. **Store features** used (for reproducibility)
4. **Link to approval** record
5. **Track overrides** (for learning)

### **Audit Trail Requirements:**

```sql
-- Must be able to answer these questions:
-- 1. What did AI decide?
SELECT decision, score, confidence FROM ai_decision WHERE id = ?;

-- 2. Why did AI decide that?
SELECT explanation, features FROM ai_decision WHERE id = ?;

-- 3. What rules were triggered?
SELECT flags FROM ai_decision WHERE id = ?;

-- 4. What model version was used?
SELECT model_version_id FROM ai_decision WHERE id = ?;

-- 5. Did human agree?
SELECT human_override, human_decision FROM ai_decision WHERE id = ?;

-- 6. Can we reproduce this decision?
-- Yes - features + model_version + rules → same decision
```

### **Compliance Checklist:**

- [ ] GDPR: Right to explanation (provided via `explanation` field)
- [ ] GDPR: Right to human review (always available via override)
- [ ] GDPR: Data minimization (only necessary features stored)
- [ ] SOC 2: Audit trail (complete and immutable)
- [ ] SOC 2: Access controls (RBAC on AI settings)
- [ ] SOC 2: Change management (model versioning)
- [ ] SOX: Segregation of duties (AI can't change rules)

---

## 🧪 Testing Requirements

### **Before Deploying to Production:**

**Unit Tests:**
- [ ] Feature extraction (100+ test cases)
- [ ] Rule evaluation (50+ test cases)
- [ ] Safety caps (edge cases)
- [ ] Kill switch (activation + deactivation)

**Integration Tests:**
- [ ] Shadow mode flow
- [ ] Assist mode flow
- [ ] Auto mode flow
- [ ] Override tracking
- [ ] Audit logging

**E2E Tests:**
- [ ] Submit timesheet → AI evaluates → logs decision
- [ ] Submit timesheet → AI approves → event emits → audit logged
- [ ] AI suggests → human overrides → override logged
- [ ] Kill switch → all pending auto-approvals cancelled

**Chaos Tests:**
- [ ] Model service down → fallback to human
- [ ] Database slow → timeout handled gracefully
- [ ] Webhook fails → retry logic works
- [ ] High load (1000 req/s) → no errors

---

## 🔐 Security Considerations

### **Principle: AI Has Same Permissions as Users**

```typescript
// Before AI approves, check permissions
async function checkAIPermissions(
  projectId: string,
  timesheetId: string
): Promise<boolean> {
  
  // Would the assigned manager be able to approve this?
  const manager = await getAssignedManager(projectId);
  const canApprove = await checkPermission(
    manager.id,
    'approval.approve',
    projectId
  );
  
  if (!canApprove) {
    console.warn('AI cannot approve - manager lacks permission');
    return false;
  }
  
  return true;
}
```

### **Security Checklist:**

- [ ] AI decisions respect RBAC
- [ ] AI cannot escalate privileges
- [ ] AI cannot modify approval policies
- [ ] AI cannot access PII unless necessary
- [ ] AI decisions are tamper-proof (immutable audit log)
- [ ] Model weights stored securely
- [ ] Training data access controlled

---

## 🎓 Team Training Requirements

### **All Team Members Must:**

- [ ] Complete "AI Safety 101" training
- [ ] Understand shadow/assist/auto modes
- [ ] Know how to activate kill switch
- [ ] Know how to override AI suggestions
- [ ] Understand when to escalate

### **Approvers Must:**

- [ ] Understand AI confidence scores
- [ ] Know when to trust AI vs review manually
- [ ] Understand override impact (AI learns from it)
- [ ] Report suspicious AI behavior

### **Ops Team Must:**

- [ ] Monitor AI metrics daily
- [ ] Respond to alerts within SLA
- [ ] Perform weekly kill switch test
- [ ] Conduct monthly model drift review

### **Engineering Team Must:**

- [ ] Review AI code changes thoroughly
- [ ] Run full test suite before deploy
- [ ] Monitor rollout closely (48h)
- [ ] Conduct postmortems on incidents

---

## 🚀 Rollout Strategy

### **Phase 1: Internal Testing (2 weeks)**

- Enable shadow mode for 1 internal project
- Team uses system daily
- Collect feedback
- Fix issues

### **Phase 2: Pilot Tenant (2 weeks)**

- Select 1 friendly tenant
- Enable shadow mode
- Review daily
- Transition to assist mode if successful

### **Phase 3: Gradual Rollout (4 weeks)**

- Week 1: 5 tenants (shadow mode)
- Week 2: 10 tenants (assist mode for successful ones)
- Week 3: 25 tenants
- Week 4: 50 tenants (auto mode for proven ones)

### **Phase 4: General Availability (Ongoing)**

- New tenants start in shadow mode
- Opt-in for auto mode after 30 days
- Continuous monitoring

---

## ⚠️ Common Pitfalls to Avoid

### **1. Skipping Shadow Mode**

**Don't:** "We're confident in our model, let's go straight to auto!"  
**Do:** Always start with shadow mode, no exceptions.

### **2. Ignoring Overrides**

**Don't:** "Users are just being conservative."  
**Do:** Investigate every override. Humans see things AI misses.

### **3. Setting Caps Too High**

**Don't:** "Let's auto-approve 1000/day from day 1!"  
**Do:** Start at 10/day, increase gradually based on accuracy.

### **4. Not Testing Kill Switch**

**Don't:** "We'll test it if we need it."  
**Do:** Test weekly. If it doesn't work in practice, it doesn't work.

### **5. Trusting AI Blindly**

**Don't:** "99% accuracy is good enough."  
**Do:** 1% error on 10,000 approvals/month = 100 mistakes. Unacceptable.

### **6. Poor Explanations**

**Don't:** "score: 0.87" (unhelpful)  
**Do:** "Auto-approved: amount under $1k, no anomalies, contractor has 95% approval rate"

### **7. No Rollback Plan**

**Don't:** "We'll figure it out if things go wrong."  
**Do:** Document exact steps to revert to previous state.

---

## 📞 Incident Response

### **Severity Levels:**

**P0 (Critical):**
- Incorrect auto-approval (wrong amount, wrong person)
- PII leak via AI explanation
- AI bypass RBAC

**P1 (High):**
- Auto-approval error rate >10%
- Kill switch not working
- Audit trail gaps

**P2 (Medium):**
- Agreement rate drop >10%
- Webhook failures affecting users
- Model drift detected

**P3 (Low):**
- Single override anomaly
- UI confusion about AI suggestions
- Documentation gaps

### **Response Times:**

- P0: Immediate (kill switch), resolve within 2h
- P1: Respond within 30m, resolve within 4h
- P2: Respond within 2h, resolve within 24h
- P3: Respond within 24h, resolve within 1 week

---

## ✅ Pre-Launch Checklist

**Before launching AI to production:**

### **Technical:**
- [ ] All tests passing (unit, integration, E2E, chaos)
- [ ] Monitoring & alerts configured
- [ ] Kill switch tested this week
- [ ] Audit logging verified
- [ ] Performance tested (1000 req/s)
- [ ] Security review completed
- [ ] Code review completed

### **Operational:**
- [ ] On-call schedule updated
- [ ] Runbook documented
- [ ] Incident response plan ready
- [ ] Escalation paths defined
- [ ] Team trained

### **Compliance:**
- [ ] Legal review completed
- [ ] Privacy impact assessment done
- [ ] Audit trail verified
- [ ] Data retention policy documented

### **User Experience:**
- [ ] UI shows AI confidence clearly
- [ ] Override is easy
- [ ] Explanations are helpful
- [ ] Users trained
- [ ] Support documentation ready

---

## 🎯 Success Metrics

**Month 1 Goals:**
- Shadow mode: Agreement rate ≥70%
- Assist mode: Agreement rate ≥80%
- Auto mode: Zero critical errors

**Month 3 Goals:**
- Auto-approval rate: ≥10%
- Agreement rate: ≥85%
- Time saved: ≥50%
- User satisfaction: ≥8/10

**Month 6 Goals:**
- Auto-approval rate: ≥25%
- Agreement rate: ≥90%
- Time saved: ≥70%
- Cost per approval: -80%

---

## 📚 Required Reading

Before working on AI features, read:

1. **[AI Decision Architecture](../architecture/AI_DECISION_ARCHITECTURE.md)**
2. **[Google's Rules of ML](https://developers.google.com/machine-learning/guides/rules-of-ml)**
3. **[Stripe Radar Case Study](https://stripe.com/radar/guide)**
4. **[Model Cards Paper](https://arxiv.org/abs/1810.03993)**

---

## 🎉 Remember

**AI is a tool, not a replacement.** 

The goal is to:
- ✅ Save time on routine decisions
- ✅ Let humans focus on edge cases
- ✅ Learn continuously from feedback
- ✅ Maintain trust and transparency

**NOT to:**
- ❌ Replace human judgment
- ❌ Hide how decisions are made
- ❌ Optimize for speed over accuracy
- ❌ Deploy without thorough testing

**When in doubt, be conservative.** It's better to route to a human than to auto-approve incorrectly.

---

**Document Version:** 1.0  
**Status:** Mandatory Reading  
**Owner:** Engineering + Product + Legal
