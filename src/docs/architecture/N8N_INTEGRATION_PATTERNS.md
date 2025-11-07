# n8n Integration Patterns

**Version:** 1.0  
**Last Updated:** November 6, 2025  
**Status:** 📋 Planned for Phase 6

---

## 🎯 Overview

This document defines **production-ready patterns** for integrating WorkGraph with n8n workflow automation platform.

**Key Patterns:**
- 🔗 **Outbound Webhooks:** WorkGraph → n8n (signed, idempotent)
- 🔄 **Inbound Callbacks:** External systems → WorkGraph
- 📦 **Template Library:** Pre-built workflows
- 🔒 **Security:** HMAC signing, secret rotation
- 🛡️ **Reliability:** Retries, DLQ, monitoring

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────┐
│ WorkGraph                                        │
│                                                  │
│ Domain Event → Outbox Table → Worker            │
└──────────────┬───────────────────────────────────┘
               │
               │ POST webhook
               │ HMAC signature
               │ Idempotency key
               ▼
┌──────────────────────────────────────────────────┐
│ n8n Workflow                                     │
│                                                  │
│ Webhook → Verify HMAC → Process → Side Effects  │
└──────────────┬───────────────────────────────────┘
               │
      ┌────────┴────────┬────────────┬──────────┐
      ▼                 ▼            ▼          ▼
   Slack            QuickBooks    Email      GitHub
   message          invoice       alert      commit
      │                 │            │          │
      └─────────────────┴────────────┴──────────┘
                        │
                  (Optional callback)
                        ▼
┌──────────────────────────────────────────────────┐
│ WorkGraph Callback Endpoint                     │
│                                                  │
│ POST /callbacks/external → Update state         │
└──────────────────────────────────────────────────┘
```

---

## 📤 Pattern 1: Outbound Webhooks (WorkGraph → n8n)

### **Transactional Outbox Pattern**

**Problem:** How to reliably emit events without losing data?

**Solution:** Write event + outbox in same database transaction.

```typescript
async function emitApprovalCompleted(approvalId: string) {
  
  const approval = await getApproval(approvalId);
  const timesheet = await getTimesheet(approval.subject_id);
  const project = await getProject(approval.project_id);
  
  // Prepare event payload
  const eventPayload = {
    event: 'approval.completed',
    version: '2025-11-01',
    idempotencyKey: `evt_${approvalId}_${Date.now()}`,
    tenantId: project.tenant_id,
    projectId: approval.project_id,
    nodeId: approval.node_id,
    subject: {
      type: 'timesheet',
      id: timesheet.id,
    },
    decision: {
      status: approval.status,
      by: approval.decided_by,
      at: approval.decided_at,
      reason: approval.decision?.reason,
    },
    amount: {
      valueCents: timesheet.amount_cents,
      currency: timesheet.currency || 'USD',
    },
    links: {
      detailUrl: `https://app.workgraph.com/approvals/${approvalId}`,
    },
  };
  
  // Write to DB in transaction
  await db.transaction(async (tx) => {
    
    // 1. Store event
    const event = await tx.query(`
      INSERT INTO event (id, project_id, type, payload, occurred_at)
      VALUES ($1, $2, $3, $4, now())
      RETURNING *
    `, [uuid(), project.id, 'approval.completed', eventPayload]);
    
    // 2. Get webhook endpoints for this project
    const webhooks = await tx.query(`
      SELECT endpoint, secret
      FROM webhook_subscription
      WHERE project_id = $1
        AND event_type = 'approval.completed'
        AND is_active = true
    `, [project.id]);
    
    // 3. Create outbox entries
    for (const webhook of webhooks.rows) {
      await tx.query(`
        INSERT INTO outbox (
          id,
          event_id,
          endpoint,
          headers,
          body,
          status,
          idempotency_key,
          next_attempt_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, now())
      `, [
        uuid(),
        event.rows[0].id,
        webhook.endpoint,
        {
          'Content-Type': 'application/json',
          'X-WorkGraph-Signature': '', // Computed by worker
          'X-Idempotency-Key': eventPayload.idempotencyKey,
        },
        eventPayload,
        eventPayload.idempotencyKey,
      ]);
    }
  });
  
  console.log(`Event emitted: approval.completed for ${approvalId}`);
}
```

---

### **Outbox Worker (Reliable Delivery)**

```typescript
// Runs continuously (or via cron every 30s)
async function processOutbox() {
  
  // Get pending jobs (due now)
  const jobs = await db.query(`
    SELECT *
    FROM outbox
    WHERE status = 'pending'
      AND next_attempt_at <= now()
    ORDER BY next_attempt_at ASC
    LIMIT 100
    FOR UPDATE SKIP LOCKED  -- Prevent concurrent processing
  `);
  
  for (const job of jobs.rows) {
    try {
      await deliverWebhook(job);
    } catch (error) {
      console.error(`Failed to deliver webhook ${job.id}:`, error);
    }
  }
}

async function deliverWebhook(job: OutboxJob) {
  
  // 1. Get tenant secret for HMAC
  const tenant = await getTenantByProjectId(job.project_id);
  const secret = await getSecret(tenant.id, 'webhook_secret');
  
  // 2. Sign payload
  const body = JSON.stringify(job.body);
  const signature = hmacSHA256(body, secret);
  
  // 3. Send request
  const response = await fetch(job.endpoint, {
    method: 'POST',
    headers: {
      ...job.headers,
      'X-WorkGraph-Signature': signature,
    },
    body,
    signal: AbortSignal.timeout(10000), // 10s timeout
  });
  
  // 4. Handle response
  if (response.ok) {
    // Success!
    await db.query(`
      UPDATE outbox
      SET status = 'delivered',
          delivered_at = now()
      WHERE id = $1
    `, [job.id]);
    
    console.log(`✅ Webhook delivered: ${job.endpoint}`);
    
  } else {
    // Failure - retry with exponential backoff
    const newAttempts = job.attempts + 1;
    const maxAttempts = 5;
    
    if (newAttempts >= maxAttempts) {
      // Move to DLQ
      await db.query(`
        UPDATE outbox
        SET status = 'failed',
            error_message = $2
        WHERE id = $1
      `, [job.id, `Failed after ${maxAttempts} attempts: ${response.statusText}`]);
      
      console.error(`❌ Webhook failed permanently: ${job.endpoint}`);
      
      // Alert ops team
      await alertOps('webhook_dlq', {
        jobId: job.id,
        endpoint: job.endpoint,
        error: response.statusText,
      });
      
    } else {
      // Schedule retry (exponential backoff: 1s, 2s, 4s, 8s, 16s)
      const delaySec = Math.pow(2, newAttempts);
      await db.query(`
        UPDATE outbox
        SET attempts = $2,
            next_attempt_at = now() + interval '${delaySec} seconds',
            error_message = $3
        WHERE id = $1
      `, [job.id, newAttempts, response.statusText]);
      
      console.warn(`⏳ Webhook retry scheduled in ${delaySec}s: ${job.endpoint}`);
    }
  }
}

function hmacSHA256(data: string, secret: string): string {
  const crypto = require('crypto');
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64');
}
```

---

### **Event Contract (JSON Schema)**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ApprovalCompletedEvent",
  "type": "object",
  "required": [
    "event",
    "version",
    "idempotencyKey",
    "tenantId",
    "projectId",
    "subject",
    "decision"
  ],
  "properties": {
    "event": {
      "type": "string",
      "enum": ["approval.completed"]
    },
    "version": {
      "type": "string",
      "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
      "description": "API version (YYYY-MM-DD)"
    },
    "idempotencyKey": {
      "type": "string",
      "description": "Unique key for deduplication"
    },
    "tenantId": {
      "type": "string",
      "format": "uuid"
    },
    "projectId": {
      "type": "string",
      "format": "uuid"
    },
    "nodeId": {
      "type": "string",
      "format": "uuid",
      "description": "Approval node in graph"
    },
    "subject": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": ["timesheet", "invoice", "expense"]
        },
        "id": {
          "type": "string",
          "format": "uuid"
        }
      }
    },
    "decision": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "enum": ["approved", "rejected"]
        },
        "by": {
          "type": "string",
          "description": "user:uuid or ai_agent"
        },
        "at": {
          "type": "string",
          "format": "date-time"
        },
        "reason": {
          "type": "string"
        }
      }
    },
    "amount": {
      "type": "object",
      "properties": {
        "valueCents": {
          "type": "integer",
          "description": "Amount in smallest currency unit"
        },
        "currency": {
          "type": "string",
          "pattern": "^[A-Z]{3}$"
        }
      }
    },
    "links": {
      "type": "object",
      "properties": {
        "detailUrl": {
          "type": "string",
          "format": "uri"
        }
      }
    },
    "signature": {
      "type": "string",
      "description": "HMAC-SHA256 signature (base64)"
    }
  }
}
```

---

## 📥 Pattern 2: Inbound Callbacks (External → WorkGraph)

### **Callback Endpoint**

```typescript
// POST /callbacks/external
async function handleExternalCallback(req: Request) {
  
  const body = await req.json();
  
  // 1. Verify signature (if provider supports it)
  const signature = req.headers.get('X-Provider-Signature');
  const isValid = await verifyProviderSignature(signature, body);
  
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  // 2. Route by event type
  switch (body.event) {
    
    case 'payment.received':
      await handlePaymentReceived(body);
      break;
      
    case 'invoice.paid':
      await handleInvoicePaid(body);
      break;
      
    case 'jira.issue_updated':
      await handleJiraIssueUpdated(body);
      break;
      
    default:
      console.warn(`Unknown callback event: ${body.event}`);
  }
  
  // 3. Always return 200 (prevents retries)
  return new Response('OK', { status: 200 });
}

async function handlePaymentReceived(payload: any) {
  
  // Find invoice by external ID
  const invoice = await db.query(`
    SELECT *
    FROM invoice
    WHERE external_id = $1
  `, [payload.invoiceId]);
  
  if (!invoice.rows[0]) {
    console.warn(`Invoice not found: ${payload.invoiceId}`);
    return;
  }
  
  // Update status
  await db.query(`
    UPDATE invoice
    SET status = 'paid',
        paid_at = $2,
        payment_provider = $3
    WHERE id = $1
  `, [invoice.rows[0].id, payload.paidAt, payload.provider]);
  
  // Emit event
  await emitEvent('invoice.paid', {
    invoiceId: invoice.rows[0].id,
    projectId: invoice.rows[0].project_id,
    amount: payload.amount,
    provider: payload.provider,
  });
  
  console.log(`Invoice paid: ${invoice.rows[0].id}`);
}
```

---

## 📦 Pattern 3: n8n Template Library

### **Template Structure**

```json
{
  "name": "WorkGraph: Invoice Generator",
  "description": "Auto-generate PDF invoice when timesheet approved",
  "version": "1.0.0",
  "author": "WorkGraph Team",
  "tags": ["invoice", "pdf", "quickbooks"],
  
  "trigger": {
    "event": "approval.completed",
    "filters": {
      "subject.type": "timesheet"
    }
  },
  
  "nodes": [
    {
      "id": "webhook",
      "type": "n8n-nodes-base.webhook",
      "name": "WorkGraph Webhook",
      "parameters": {
        "path": "workgraph-approval-completed",
        "httpMethod": "POST",
        "responseMode": "lastNode"
      }
    },
    {
      "id": "verify_signature",
      "type": "n8n-nodes-base.function",
      "name": "Verify HMAC Signature",
      "parameters": {
        "functionCode": "// Verify signature logic here"
      }
    },
    {
      "id": "get_timesheet",
      "type": "n8n-nodes-base.httpRequest",
      "name": "Get Timesheet Details",
      "parameters": {
        "url": "https://api.workgraph.com/timesheets/{{$json.subject.id}}",
        "authentication": "predefinedCredentialType",
        "method": "GET"
      }
    },
    {
      "id": "render_pdf",
      "type": "n8n-nodes-base.html",
      "name": "Render Invoice PDF",
      "parameters": {
        "html": "<html><!-- Invoice template --></html>"
      }
    },
    {
      "id": "upload_to_storage",
      "type": "n8n-nodes-base.httpRequest",
      "name": "Upload PDF to Supabase",
      "parameters": {
        "url": "https://api.supabase.com/storage/v1/object/invoices/{{$json.id}}.pdf",
        "method": "POST"
      }
    },
    {
      "id": "create_quickbooks_invoice",
      "type": "n8n-nodes-base.quickbooks",
      "name": "Create QuickBooks Invoice",
      "parameters": {
        "operation": "create",
        "resource": "invoice"
      }
    },
    {
      "id": "notify_slack",
      "type": "n8n-nodes-base.slack",
      "name": "Notify #finance",
      "parameters": {
        "channel": "#finance",
        "text": "✅ Invoice generated: {{$json.invoiceNumber}}"
      }
    },
    {
      "id": "callback",
      "type": "n8n-nodes-base.httpRequest",
      "name": "Callback to WorkGraph",
      "parameters": {
        "url": "https://api.workgraph.com/callbacks/external",
        "method": "POST",
        "bodyParameters": {
          "event": "invoice.generated",
          "invoiceId": "={{$json.id}}",
          "pdfUrl": "={{$json.pdfUrl}}"
        }
      }
    }
  ],
  
  "connections": {
    "webhook": { "main": [[{"node": "verify_signature"}]] },
    "verify_signature": { "main": [[{"node": "get_timesheet"}]] },
    "get_timesheet": { "main": [[{"node": "render_pdf"}]] },
    "render_pdf": { "main": [[{"node": "upload_to_storage"}]] },
    "upload_to_storage": { "main": [[{"node": "create_quickbooks_invoice"}, {"node": "notify_slack"}]] },
    "create_quickbooks_invoice": { "main": [[{"node": "callback"}]] }
  },
  
  "settings": {
    "errorWorkflow": "error-handler",
    "timezone": "America/Los_Angeles",
    "saveExecutionProgress": true,
    "saveManualExecutions": true
  }
}
```

---

### **Pre-Built Templates**

#### **1. Slack Notification**

```json
{
  "name": "WorkGraph: Slack Approval Notify",
  "trigger": "approval.completed",
  "actions": [
    {
      "type": "slack.postMessage",
      "channel": "#finance",
      "message": "✅ {{contractor.name}} timesheet approved\n💰 Amount: ${{amount}}\n📊 Project: {{project.name}}\n🔗 <{{links.detailUrl}}|View Details>"
    }
  ]
}
```

---

#### **2. Email Notification**

```json
{
  "name": "WorkGraph: Email Approval Notify",
  "trigger": "approval.completed",
  "actions": [
    {
      "type": "email.send",
      "to": "{{contractor.email}}",
      "subject": "Timesheet Approved - {{project.name}}",
      "html": "<h1>Good news!</h1><p>Your timesheet for {{period}} has been approved.</p><p>Amount: ${{amount}}</p>"
    }
  ]
}
```

---

#### **3. SLA Breach Escalation**

```json
{
  "name": "WorkGraph: SLA Breach Escalation",
  "trigger": "sla.breached",
  "actions": [
    {
      "type": "slack.postMessage",
      "channel": "#urgent",
      "message": "🚨 SLA BREACH\n⏰ Approval overdue: {{hours}}h\n👤 Approver: {{approver.name}}\n📋 Item: {{subject.type}} #{{subject.id}}"
    },
    {
      "type": "email.send",
      "to": "{{approver.manager.email}}",
      "subject": "URGENT: Approval SLA Breached",
      "priority": "high"
    },
    {
      "type": "sms.send",
      "to": "{{approver.phone}}",
      "message": "WorkGraph: Approval overdue - please review"
    }
  ]
}
```

---

#### **4. QuickBooks Invoice Sync**

```json
{
  "name": "WorkGraph: QuickBooks Invoice Sync",
  "trigger": "approval.completed",
  "filters": {
    "subject.type": "timesheet"
  },
  "actions": [
    {
      "type": "quickbooks.createInvoice",
      "customer": "{{project.client.qbCustomerId}}",
      "lineItems": [
        {
          "description": "{{contractor.name}} - {{period}}",
          "quantity": "{{hours}}",
          "rate": "{{hourlyRate}}",
          "amount": "{{amount}}"
        }
      ]
    },
    {
      "type": "callback",
      "url": "https://api.workgraph.com/callbacks/external",
      "payload": {
        "event": "invoice.created",
        "qbInvoiceId": "{{response.Id}}"
      }
    }
  ]
}
```

---

#### **5. Jira Integration**

```json
{
  "name": "WorkGraph: Jira Project Sync",
  "trigger": "project.created",
  "actions": [
    {
      "type": "jira.createProject",
      "key": "{{project.code}}",
      "name": "{{project.name}}",
      "lead": "{{project.manager.jiraId}}"
    },
    {
      "type": "jira.createBoard",
      "projectKey": "{{response.key}}",
      "boardType": "scrum"
    },
    {
      "type": "callback",
      "payload": {
        "event": "jira.project_created",
        "jiraProjectKey": "{{response.key}}"
      }
    }
  ]
}
```

---

## 🔒 Security Best Practices

### **1. HMAC Signature Verification (n8n Side)**

```javascript
// n8n Function node: Verify WorkGraph signature
const crypto = require('crypto');

const body = JSON.stringify($input.item.json);
const receivedSignature = $input.item.headers['x-workgraph-signature'];
const secret = $env.WORKGRAPH_WEBHOOK_SECRET;

const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(body)
  .digest('base64');

if (receivedSignature !== expectedSignature) {
  throw new Error('Invalid signature');
}

return $input.item.json;
```

---

### **2. Secret Rotation**

```typescript
async function rotateWebhookSecret(tenantId: string) {
  
  const newSecret = generateSecureSecret(); // 32 bytes random
  
  // Store new secret
  await storeSecret(tenantId, 'webhook_secret_v2', newSecret);
  
  // Update tenant to use new secret (grace period)
  await db.query(`
    UPDATE tenant
    SET settings = jsonb_set(
      settings,
      '{webhook_secret_version}',
      '2'::jsonb
    )
    WHERE id = $1
  `, [tenantId]);
  
  // Delete old secret after 7 days
  setTimeout(async () => {
    await deleteSecret(tenantId, 'webhook_secret_v1');
  }, 7 * 24 * 60 * 60 * 1000);
  
  console.log(`Rotated webhook secret for tenant ${tenantId}`);
}
```

---

### **3. Rate Limiting**

```typescript
// Protect callback endpoint
const rateLimiter = new RateLimiter({
  windowMs: 60 * 1000,   // 1 minute
  max: 100,              // 100 requests per minute
  keyGenerator: (req) => req.headers.get('X-Tenant-Id'),
});

app.post('/callbacks/external', rateLimiter.middleware, handleCallback);
```

---

## 📊 Monitoring & Observability

### **Metrics to Track**

```typescript
interface WebhookMetrics {
  // Delivery
  webhooks_sent_total: number;
  webhooks_delivered_total: number;
  webhooks_failed_total: number;
  webhook_delivery_duration_seconds: Histogram;
  
  // DLQ
  dlq_depth: number;
  dlq_age_seconds: Histogram;
  
  // Errors
  webhook_error_rate: number;
  signature_verification_failures: number;
  
  // Callbacks
  callbacks_received_total: number;
  callback_processing_duration_seconds: Histogram;
}
```

---

### **Alerts**

```yaml
alerts:
  - name: WebhookFailureRateHigh
    condition: webhook_error_rate > 0.1  # >10%
    duration: 5m
    severity: warning
    action: notify_ops_team
    
  - name: DLQDepthHigh
    condition: dlq_depth > 50
    duration: 1m
    severity: critical
    action: page_on_call
    
  - name: WebhookLatencyHigh
    condition: p95(webhook_delivery_duration_seconds) > 10
    duration: 5m
    severity: warning
    action: notify_ops_team
```

---

## 🧪 Testing Strategies

### **Unit Tests**

```typescript
describe('Webhook Delivery', () => {
  
  it('should sign payload with HMAC-SHA256', () => {
    const payload = { event: 'test' };
    const secret = 'test-secret';
    const signature = hmacSHA256(JSON.stringify(payload), secret);
    expect(signature).toBe('expected-signature-base64');
  });
  
  it('should retry failed webhooks with exponential backoff', async () => {
    const job = { id: 'job-1', attempts: 2 };
    await handleFailedWebhook(job);
    const updated = await getOutboxJob('job-1');
    expect(updated.attempts).toBe(3);
    expect(updated.next_attempt_at).toBeGreaterThan(Date.now() + 3000); // ≥4s
  });
  
  it('should move to DLQ after max attempts', async () => {
    const job = { id: 'job-2', attempts: 5 };
    await handleFailedWebhook(job);
    const updated = await getOutboxJob('job-2');
    expect(updated.status).toBe('failed');
  });
});
```

---

### **Integration Tests**

```typescript
describe('End-to-End Webhook Flow', () => {
  
  it('should deliver event to n8n webhook', async () => {
    // Setup n8n mock server
    const mockServer = setupMockN8N();
    
    // Emit event
    await emitApprovalCompleted('approval-123');
    
    // Wait for delivery
    await waitFor(() => mockServer.receivedRequests.length > 0);
    
    // Verify
    const request = mockServer.receivedRequests[0];
    expect(request.body.event).toBe('approval.completed');
    expect(request.headers['X-WorkGraph-Signature']).toBeDefined();
  });
});
```

---

### **Chaos Testing**

```typescript
describe('Webhook Reliability Under Failure', () => {
  
  it('should handle network failures gracefully', async () => {
    // Simulate network failure
    mockFetch.mockRejectedValue(new Error('Network error'));
    
    await deliverWebhook(job);
    
    const updated = await getOutboxJob(job.id);
    expect(updated.status).toBe('pending'); // Still retrying
    expect(updated.attempts).toBe(1);
  });
  
  it('should handle n8n downtime', async () => {
    // Simulate n8n returning 503
    mockFetch.mockResolvedValue(new Response(null, { status: 503 }));
    
    await deliverWebhook(job);
    
    // Should schedule retry
    const updated = await getOutboxJob(job.id);
    expect(updated.next_attempt_at).toBeGreaterThan(Date.now());
  });
});
```

---

## 🎯 Summary

WorkGraph's n8n integration provides:

✅ **Reliable delivery** via outbox pattern  
✅ **Security** via HMAC signatures  
✅ **Idempotency** to prevent duplicates  
✅ **Observability** via metrics and logs  
✅ **Resilience** via retries and DLQ  
✅ **Scalability** via async processing  

**Next:** Implement in Phase 6 (Weeks 1, 5) 🚀

---

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Owner:** Engineering Team
