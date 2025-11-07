# Phase 6: AI + Automation Foundation

**Duration:** 6-8 weeks  
**Team Size:** 2-3 engineers  
**Status:** 📋 Planned  
**Dependencies:** Phase 5 complete (real database integration)

---

## 🎯 Executive Summary

Phase 6 introduces **intelligent automation** to WorkGraph by integrating:
- **AI-powered approval routing** (shadow → assist → auto modes)
- **n8n workflow automation** (Slack, email, QuickBooks, Jira, etc.)
- **Event-driven architecture** (outbox pattern, webhooks, callbacks)
- **Observability & compliance** (audit logs, metrics, kill switches)

**Goal:** Reduce manual approval time by 60% while maintaining 100% audit compliance.

---

## 📊 Architecture at a Glance

```
┌─────────────────────────────────────────────────────────┐
│ WorkGraph Core                                          │
│ - Projects, nodes, edges, approvals, policies          │
│ - Emits domain events                                   │
└──────────────┬──────────────────────────────────────────┘
               │
     ┌─────────┴─────────┐
     ▼                   ▼
┌──────────┐      ┌─────────────┐
│ Rules/AI │      │ Integration │
│ Service  │      │ Broker      │
└─────┬────┘      └──────┬──────┘
      │                  │
      ▼                  ▼
  Auto-approve      Signed webhooks
  Route smart            ↓
  Flag anomaly      ┌─────────┐
                    │   n8n   │
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
     Slack          QuickBooks         Email
     notify         invoice            alerts
```

**Key Principles:**
- 🛡️ **Safe AI rollout:** Shadow → Assist → Auto
- 🔒 **Security first:** HMAC signatures, tenant isolation, secrets vault
- 📊 **Observable:** Metrics, traces, audit logs
- 🔄 **Reliable:** Outbox pattern, idempotency, retries
- 🚨 **Reversible:** Per-tenant kill switches

---

## 🗓️ Week-by-Week Implementation Plan

### **Week 1: Event Infrastructure (Foundation)**

**Milestone M6.1: Event + Outbox Pattern**

**Tasks:**
- [ ] Implement `event` and `outbox` tables
- [ ] Create event emitter service
- [ ] Build outbox worker with exponential backoff
- [ ] Add idempotency key generation
- [ ] Unit tests for event persistence

**Deliverable:** Events are durably stored and delivered at-least-once.

---

**Milestone M6.2: Signed Webhooks to n8n**

**Tasks:**
- [ ] Implement HMAC-SHA256 signing
- [ ] Create webhook delivery service
- [ ] Add per-tenant secret management (vault)
- [ ] Build retry logic (exponential backoff, max 5 attempts)
- [ ] Dead-letter queue for failed deliveries

**Deliverable:** WorkGraph can securely deliver events to n8n.

---

**Milestone M6.3: Basic n8n Template (Slack Notify)**

**Tasks:**
- [ ] Create n8n workflow: approval.completed → Slack
- [ ] Set up webhook verification in n8n
- [ ] Test end-to-end: approve → event → n8n → Slack
- [ ] Document setup instructions
- [ ] Create template JSON export

**Deliverable:** One approval triggers Slack notification via n8n.

**Exit Criteria:**
- [x] Event emitted when approval completes
- [x] Webhook delivered to n8n with HMAC signature
- [x] n8n verifies signature successfully
- [x] Slack message appears in #finance channel
- [x] No duplicate messages (idempotency works)
- [x] Zero console errors
- [x] Documented setup guide

---

### **Week 2: AI Shadow Mode (Safe Learning)**

**Milestone M6.4: Rule Engine + Feature Extraction**

**Tasks:**
- [ ] Implement feature extraction from timesheets
  - Amount, rate, hours, week-over-week change
  - Contractor history (streak, average hours)
  - Manager queue depth
- [ ] Build rule engine (threshold-based)
  - Auto-approve if amount < $1k
  - Flag if hours > 80/week
  - Flag if rate changed > 10%
- [ ] Create `policy` table with rules JSON
- [ ] Unit tests for all rules

**Deliverable:** Rules engine evaluates timesheets and outputs scores.

---

**Milestone M6.5: Anomaly Detection Heuristics**

**Tasks:**
- [ ] Implement anomaly detection:
  - Hours spike (>20% above average)
  - Rate mismatch (contract vs submitted)
  - New contractor (<30 days)
  - Unusual submission time (weekends, 3am)
- [ ] Create `ai_decision` table
- [ ] Log all evaluations to audit log
- [ ] Build "explain decision" function

**Deliverable:** AI flags unusual patterns with human-readable reasons.

---

**Milestone M6.6: Smart Routing Logic**

**Tasks:**
- [ ] Implement routing based on:
  - Manager availability (calendar integration?)
  - Manager queue depth
  - Manager's avg response time
  - Round-robin with workload balancing
- [ ] Create assignee selection service
- [ ] Log routing decisions to audit

**Deliverable:** AI suggests best approver for each item.

**Exit Criteria:**
- [x] AI evaluates every submitted timesheet
- [x] Scores and flags logged to `ai_decision` table
- [x] UI shows AI suggestion (read-only badge)
- [x] Zero false positives in 100 test cases
- [x] Audit log captures all decisions
- [x] Documentation: "How AI Evaluates Timesheets"

---

### **Week 3: AI Assist Mode (Human in Loop)**

**Milestone M6.7: UI Shows AI Suggestions**

**Tasks:**
- [ ] Add AI badge to approval rows
  - "AI suggests: Approve (95% confident)"
  - "AI suggests: Flag - rate mismatch"
- [ ] Show explanation tooltip on hover
- [ ] Add "Why?" button to expand reasoning
- [ ] Create AI decision drawer component

**Deliverable:** Approvers see AI suggestions inline.

---

**Milestone M6.8: One-Click Approve AI Recommendation**

**Tasks:**
- [ ] Add "Accept AI Suggestion" button
- [ ] Pre-populate approval with AI reasoning
- [ ] Track acceptance rate per user
- [ ] A/B test: suggest vs no suggest

**Deliverable:** Humans can approve with one click if they agree.

---

**Milestone M6.9: Override Tracking for Learning**

**Tasks:**
- [ ] Track when human disagrees with AI
  - AI says approve, human rejects
  - AI says flag, human approves
- [ ] Store override in `ai_decision.human_override`
- [ ] Build "AI Performance" dashboard
- [ ] Create nightly report: agreement rate

**Deliverable:** System learns from human corrections.

**Exit Criteria:**
- [x] AI suggestions visible on all approval items
- [x] Humans can accept or override AI
- [x] Override rate tracked and visible
- [x] Agreement rate > 80% in first week
- [x] UI/UX tested with 5 real users
- [x] Documentation: "Using AI Assist Mode"

---

### **Week 4: AI Auto Mode (Supervised Automation)**

**Milestone M6.10: Auto-Approve for Low-Risk Items**

**Tasks:**
- [ ] Implement auto-approve logic:
  - If amount < $1k AND no flags AND confidence > 85%
  - Create approval record with `decided_by: 'ai_agent'`
  - Emit `approval.completed` event
  - Trigger n8n workflows
- [ ] Add per-project policy mode: shadow | assist | auto
- [ ] Create toggle in project settings
- [ ] Add safety caps:
  - Max 10 auto-approvals/day per project (start)
  - Increase cap based on accuracy
- [ ] Comprehensive testing (100+ scenarios)

**Deliverable:** AI auto-approves safe timesheets without human intervention.

---

**Milestone M6.11: SLA Breach Detection + Escalation**

**Tasks:**
- [ ] Create SLA calculation service
  - Based on policy rules (24h, 48h, etc.)
  - Store `sla_deadline` on approval
- [ ] Build cron job (every 15m):
  - Query approvals with `now() > sla_deadline AND status='pending'`
  - Emit `sla.breached` event
- [ ] Create n8n escalation workflow:
  - Slack message to manager's manager
  - Email alert
  - SMS (optional via Twilio)
- [ ] Add "SLA approaching" alert (80% of deadline)

**Deliverable:** Overdue approvals trigger automatic escalation.

---

**Milestone M6.12: Per-Tenant Kill Switch**

**Tasks:**
- [ ] Add `tenant.settings.ai_mode` (shadow | assist | auto | disabled)
- [ ] Build emergency downgrade endpoint:
  - POST /admin/tenants/{id}/ai/disable
  - Immediately switches to assist mode
  - Logs incident to audit trail
- [ ] Create monitoring alerts:
  - Auto-approval error rate > 5%
  - Anomaly detection spike
  - Webhook failure rate > 10%
- [ ] Document kill switch procedures

**Deliverable:** Can instantly disable AI for any tenant.

**Exit Criteria:**
- [x] Auto-approve working for <$1k timesheets
- [x] Zero incorrect auto-approvals in 7 days
- [x] SLA breach escalation tested
- [x] Kill switch tested (disable → re-enable)
- [x] Safety caps working (max 10/day enforced)
- [x] Alert thresholds configured
- [x] Documentation: "AI Auto Mode Safety"

---

### **Week 5: n8n Template Library**

**Milestone M6.13: Invoice Generator Template**

**Tasks:**
- [ ] Create n8n workflow:
  - Trigger: `approval.completed` for timesheet
  - Generate PDF invoice (using template)
  - Upload to Supabase Storage
  - Return signed URL via callback
- [ ] Design invoice template (Handlebars)
- [ ] Add WorkGraph branding
- [ ] Test with 10 sample timesheets

**Deliverable:** Auto-generate invoices on approval.

---

**Milestone M6.14: Email Notification Template**

**Tasks:**
- [ ] Create n8n workflow:
  - Trigger: various events (approval, SLA, etc.)
  - SendGrid/SMTP integration
  - HTML email templates
  - Personalization (name, project, etc.)
- [ ] Templates for:
  - Approval request
  - Approval completed
  - SLA approaching
  - SLA breached
- [ ] Unsubscribe link + preferences

**Deliverable:** Automated email notifications.

---

**Milestone M6.15: QuickBooks Sync Template**

**Tasks:**
- [ ] Create n8n workflow:
  - Trigger: `approval.completed`
  - Create QuickBooks invoice
  - Map WorkGraph data → QuickBooks fields
  - Handle errors gracefully
- [ ] OAuth setup for QuickBooks
- [ ] Store QB invoice ID in WorkGraph
- [ ] Callback when invoice paid

**Deliverable:** Approved timesheets create QB invoices.

**Exit Criteria:**
- [x] 5 n8n templates ready to use:
  - Slack notify
  - Email alerts
  - Invoice generator
  - QuickBooks sync
  - SLA escalation
- [x] Each template exported as JSON
- [x] One-click install in UI
- [x] Documentation for each template
- [x] Video tutorial (5 min)

---

### **Week 6: Observability & Hardening**

**Milestone M6.16: AI Metrics Dashboard**

**Tasks:**
- [ ] Build analytics dashboard showing:
  - Auto-approval rate (daily, weekly)
  - Agreement rate (AI vs human)
  - Override frequency by user
  - Average decision time saved
  - Anomaly detection accuracy
  - Model confidence distribution
- [ ] Create `/analytics/ai-performance` route
- [ ] Add charts (Recharts)
- [ ] Export to CSV

**Deliverable:** Real-time AI performance visibility.

---

**Milestone M6.17: Webhook Retry + DLQ**

**Tasks:**
- [ ] Implement exponential backoff:
  - Retry after 1s, 2s, 4s, 8s, 16s
  - Max 5 attempts
- [ ] Create dead-letter queue for failures
- [ ] Build DLQ UI:
  - View failed webhooks
  - Manually retry
  - Mark as resolved
- [ ] Add alerts for DLQ depth > 10

**Deliverable:** Robust webhook delivery with error recovery.

---

**Milestone M6.18: Audit Log UI**

**Tasks:**
- [ ] Build audit log viewer:
  - Filter by: tenant, actor, action, subject
  - Date range picker
  - Full-text search
  - Export to CSV
- [ ] Show AI decision details:
  - Features used
  - Score breakdown
  - Explanation
  - Override info
- [ ] Pagination (100 items/page)

**Deliverable:** Complete audit trail UI.

**Exit Criteria:**
- [x] Metrics dashboard live
- [x] Webhook success rate > 99%
- [x] DLQ monitored and alerting
- [x] Audit log searchable
- [x] All metrics exported to observability platform
- [x] On-call runbook created

---

### **Weeks 7-8: Polish (Optional Stretch Goals)**

**Milestone M6.19: Graph Versioning + Simulation**

**Tasks:**
- [ ] Add `node.version` and `edge.version`
- [ ] Store graph snapshot on approval creation
- [ ] Build simulation mode:
  - Upload sample timesheet
  - Highlight path through graph
  - Show AI scores at each node
  - Preview which n8n workflows would fire
- [ ] Graph diff viewer
- [ ] Rollback to previous version

**Deliverable:** Safe graph editing with preview.

---

**Milestone M6.20: GBDT Model Training**

**Tasks:**
- [ ] Build training pipeline:
  - Extract features from audit log
  - Label = final human decision
  - Train GBDT model (LightGBM)
  - Offline evaluation vs golden set
- [ ] Model versioning in `ai_model_version` table
- [ ] Canary rollout (10% traffic)
- [ ] A/B test vs rule engine
- [ ] Document model card

**Deliverable:** ML-powered approvals (optional).

**Exit Criteria (Stretch):**
- [x] Graph simulation working
- [x] GBDT model trained
- [x] Model accuracy > rule engine
- [x] Canary tested with 1 project
- [x] Documentation complete

---

## 📦 Phase 6 Deliverables

### **Code:**
- [ ] Event + outbox infrastructure
- [ ] AI rule engine + anomaly detection
- [ ] Smart routing service
- [ ] n8n integration layer
- [ ] 5+ n8n workflow templates
- [ ] Metrics dashboard
- [ ] Audit log UI
- [ ] Kill switch + safety caps
- [ ] API endpoints (15+)
- [ ] Database migrations (10+ tables)

### **Documentation:**
- [ ] Architecture diagrams
- [ ] API contracts (OpenAPI)
- [ ] n8n template library docs
- [ ] AI safety guidelines
- [ ] Security review report
- [ ] User guides (shadow/assist/auto)
- [ ] On-call runbook
- [ ] Video tutorials (3x)

### **Testing:**
- [ ] Unit tests (>500 tests)
- [ ] Integration tests (event → n8n → callback)
- [ ] E2E tests (submit → auto-approve → invoice)
- [ ] Chaos tests (network failures, retries)
- [ ] Security tests (HMAC tampering, RBAC)
- [ ] Load tests (1k events/sec)

---

## ✅ Phase 6 Exit Criteria

Phase 6 is complete when **ALL** of these are true:

### **Functionality:**
1. [x] At least 1 n8n workflow live in production
2. [x] AI auto-approves ≥10% of submitted items
3. [x] Zero incorrect auto-approvals in 7 days
4. [x] SLA breach escalation working
5. [x] 5+ n8n templates ready to use

### **Quality:**
6. [x] Webhook delivery success rate ≥99%
7. [x] AI agreement rate ≥80% (AI vs human)
8. [x] Zero duplicate webhooks (idempotency verified)
9. [x] All code reviewed and merged
10. [x] Test coverage ≥85%

### **Observability:**
11. [x] Metrics dashboard shows AI performance
12. [x] Audit log captures every AI decision
13. [x] Alerts configured for critical issues
14. [x] Dead-letter queue monitored
15. [x] Traces propagate across systems

### **Security:**
16. [x] HMAC signatures on all webhooks
17. [x] Secrets stored in vault (not DB)
18. [x] RBAC enforced on node execution
19. [x] Kill switch tested and documented
20. [x] Security review passed

### **Documentation:**
21. [x] Architecture docs complete
22. [x] API contracts published
23. [x] User guides written
24. [x] On-call runbook ready
25. [x] Video tutorials published

### **Compliance:**
26. [x] Audit trail is complete and immutable
27. [x] PII minimization enforced
28. [x] Tenant isolation verified
29. [x] Data retention policy documented
30. [x] GDPR compliance reviewed

---

## 🎯 Success Metrics

Track these KPIs during and after Phase 6:

### **Efficiency Metrics:**
- **Auto-approval rate:** % of items approved without human (target: ≥10%)
- **Time saved per approval:** Avg seconds (target: -60%)
- **Manager workload reduction:** % fewer items to review (target: -40%)
- **Invoice generation time:** Manual vs auto (target: <2 min)

### **Quality Metrics:**
- **Auto-approval accuracy:** % correct (target: ≥99.5%)
- **AI agreement rate:** AI vs human (target: ≥80%)
- **Override rate:** Humans disagree with AI (target: ≤20%)
- **False positive rate:** Incorrectly flagged (target: ≤5%)

### **Reliability Metrics:**
- **Webhook success rate:** % delivered (target: ≥99%)
- **Event delivery latency:** p95 (target: <5s)
- **Outbox processing lag:** Max delay (target: <1 min)
- **n8n workflow success rate:** % completed (target: ≥95%)

### **Business Metrics:**
- **Cost per approval:** Manual vs auto (target: -70%)
- **Approval SLA compliance:** % on time (target: ≥95%)
- **User satisfaction:** NPS score (target: ≥8/10)
- **Integration adoption:** % tenants using n8n (target: ≥50%)

---

## 🚨 Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Over-automation causes errors | Medium | High | Shadow mode for 2 weeks; safety caps; kill switch |
| n8n integration fragility | Medium | Medium | Outbox pattern; retries; DLQ; synthetic monitors |
| AI model drift over time | Low | Medium | Monthly offline eval; canary rollout; version control |
| Security breach (webhook) | Low | Critical | HMAC signing; secret rotation; rate limiting |
| Performance degradation | Medium | Medium | Load testing; async processing; caching |
| User trust loss (AI errors) | Medium | High | Transparency (show reasoning); easy override; audit trail |
| Compliance violation | Low | Critical | Audit logs; PII minimization; legal review |
| Scope creep | High | Medium | Strict weekly milestones; defer non-critical features |

---

## 🔄 Dependencies

### **Prerequisites (must be complete):**
- ✅ Phase 5 complete (real database integration)
- ✅ Supabase backend working
- ✅ Approval queue implemented
- ✅ Policy versioning system
- ✅ Graph overlay modal

### **External Dependencies:**
- n8n instance (cloud or self-hosted)
- SMTP provider (SendGrid/Mailgun)
- QuickBooks developer account
- Slack app credentials
- Secrets vault (Supabase Vault or HashiCorp Vault)

### **Team Dependencies:**
- Backend engineer (event infra, AI logic)
- Frontend engineer (UI, dashboard)
- DevOps (n8n setup, monitoring)
- Product (define thresholds, rules)
- Legal (compliance review)

---

## 📚 Reference Implementations

Similar systems for inspiration:

- **Stripe Radar:** AI fraud detection (shadow → auto)
- **GitHub Actions:** Workflow automation
- **Zapier/Make:** No-code integrations
- **Temporal:** Durable workflows
- **Airflow:** Orchestration with retries

---

## 🎓 Learning Resources

For the team:

- [n8n Documentation](https://docs.n8n.io/)
- [LightGBM Guide](https://lightgbm.readthedocs.io/)
- [Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [Idempotency in APIs](https://stripe.com/docs/api/idempotent_requests)
- [HMAC Signatures](https://webhooks.fyi/security/hmac)

---

## 🎉 What Success Looks Like

At the end of Phase 6:

```
Sarah (PM):
"I used to spend 3 hours/day on approvals. Now AI handles 
the easy ones, I focus on edge cases. Approval time down 65%!"

Alex (Finance):
"Invoices now auto-generate in QuickBooks. I just verify and 
send. Saves me 10 hours/week!"

Jordan (DevOps):
"We get Slack alerts when SLAs breach. n8n workflows are 
rock solid. Zero incidents last month."

Casey (CEO):
"Compliance audit was seamless. Every AI decision is logged 
and explainable. Passed with flying colors!"
```

---

**Phase 6 Status:** 📋 Planned  
**Next Phase:** Phase 7 - Advanced AI (GBDT, contractor matching, predictive scheduling)

**Ready to build the future of work automation!** 🚀
