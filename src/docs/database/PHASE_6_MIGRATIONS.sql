-- Phase 6: AI + Automation Foundation
-- Database Migrations
-- Version: 1.0
-- Date: 2025-11-06

-- =============================================================================
-- MIGRATION 1: Multi-Tenant Core (if not exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  settings jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_created_at ON tenant(created_at);

-- =============================================================================
-- MIGRATION 2: Visual Graph Nodes & Edges
-- =============================================================================

CREATE TABLE IF NOT EXISTS node (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('human', 'ai_agent', 'n8n', 'data_check', 'delay', 'router')),
  label text NOT NULL,
  config jsonb DEFAULT '{}',
  position jsonb DEFAULT '{"x": 0, "y": 0}',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_node_project_id ON node(project_id);
CREATE INDEX IF NOT EXISTS idx_node_type ON node(type);
CREATE INDEX IF NOT EXISTS idx_node_version ON node(project_id, version);

COMMENT ON COLUMN node.type IS 'Node type: human (approver), ai_agent (auto-approve/route), n8n (workflow trigger), data_check (validation), delay (time-based), router (conditional branching)';
COMMENT ON COLUMN node.config IS 'Type-specific configuration (rules, thresholds, webhooks, etc.)';
COMMENT ON COLUMN node.position IS 'Visual position in graph editor: {x, y}';

-- =============================================================================

CREATE TABLE IF NOT EXISTS edge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  src uuid NOT NULL REFERENCES node(id) ON DELETE CASCADE,
  dst uuid NOT NULL REFERENCES node(id) ON DELETE CASCADE,
  condition jsonb DEFAULT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_project_id ON edge(project_id);
CREATE INDEX IF NOT EXISTS idx_edge_src ON edge(src);
CREATE INDEX IF NOT EXISTS idx_edge_dst ON edge(dst);

COMMENT ON COLUMN edge.condition IS 'Optional condition for edge traversal (e.g., amount > 1000)';
COMMENT ON COLUMN edge.label IS 'Optional label for UI (e.g., "if amount > $5k", "approved path")';

-- =============================================================================
-- MIGRATION 3: Approvals & Policies
-- =============================================================================

CREATE TABLE IF NOT EXISTS approval (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  node_id uuid REFERENCES node(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'skipped', 'auto_approved', 'escalated')),
  assignee_id uuid,
  decided_by text,
  decided_at timestamptz,
  decision jsonb DEFAULT '{}',
  sla_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_project_id ON approval(project_id);
CREATE INDEX IF NOT EXISTS idx_approval_subject ON approval(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON approval(status);
CREATE INDEX IF NOT EXISTS idx_approval_assignee ON approval(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approval_sla ON approval(sla_deadline) WHERE sla_deadline IS NOT NULL AND status = 'pending';

COMMENT ON COLUMN approval.decided_by IS 'user:uuid or ai_agent or system';
COMMENT ON COLUMN approval.decision IS 'Decision metadata (reason, ai_score, flags, etc.)';
COMMENT ON COLUMN approval.sla_deadline IS 'When this approval becomes overdue';

-- =============================================================================

CREATE TABLE IF NOT EXISTS policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  scope text NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}',
  mode text NOT NULL CHECK (mode IN ('shadow', 'assist', 'auto')) DEFAULT 'shadow',
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  model_version_id uuid REFERENCES ai_model_version(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_project_id ON policy(project_id);
CREATE INDEX IF NOT EXISTS idx_policy_scope ON policy(scope);
CREATE INDEX IF NOT EXISTS idx_policy_active ON policy(is_active) WHERE is_active = true;

COMMENT ON COLUMN policy.scope IS 'What this policy applies to (timesheet, invoice, expense, etc.)';
COMMENT ON COLUMN policy.mode IS 'AI mode: shadow (log only), assist (suggest), auto (execute)';
COMMENT ON COLUMN policy.rules IS 'Thresholds, flags, routing rules, confidence levels, fallbacks';

-- =============================================================================
-- MIGRATION 4: AI Model Versions & Decisions
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_model_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  model_type text NOT NULL,
  version text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  training_date timestamptz,
  metrics jsonb DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_model_tenant ON ai_model_version(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_active ON ai_model_version(is_active) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_model_tenant_type_version ON ai_model_version(tenant_id, model_type, version);

COMMENT ON COLUMN ai_model_version.model_type IS 'rule_engine, gbdt, llm_router, etc.';
COMMENT ON COLUMN ai_model_version.config IS 'Hyperparameters, thresholds, feature list';
COMMENT ON COLUMN ai_model_version.metrics IS 'Accuracy, precision, recall, AUC, etc.';

-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_decision (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid REFERENCES approval(id) ON DELETE CASCADE,
  model_version_id uuid REFERENCES ai_model_version(id) ON DELETE SET NULL,
  features jsonb NOT NULL DEFAULT '{}',
  score numeric(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  flags text[] DEFAULT '{}',
  suggested_action text NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  explanation jsonb NOT NULL DEFAULT '{}',
  human_override boolean DEFAULT NULL,
  human_decision text,
  human_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_decision_approval ON ai_decision(approval_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_model ON ai_decision(model_version_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_override ON ai_decision(human_override) WHERE human_override IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_decision_score ON ai_decision(score DESC);

COMMENT ON COLUMN ai_decision.features IS 'Input features used for this decision (for reproducibility)';
COMMENT ON COLUMN ai_decision.score IS 'Decision score (0.0 to 1.0)';
COMMENT ON COLUMN ai_decision.flags IS 'Anomaly flags (rate_mismatch, hours_spike, etc.)';
COMMENT ON COLUMN ai_decision.suggested_action IS 'approve, reject, flag, route';
COMMENT ON COLUMN ai_decision.explanation IS 'Human-readable reasoning (reason, features_used, rules_triggered)';
COMMENT ON COLUMN ai_decision.human_override IS 'Did human disagree with AI? (for learning)';

-- =============================================================================
-- MIGRATION 5: Events & Outbox (Reliable Event Delivery)
-- =============================================================================

CREATE TABLE IF NOT EXISTS event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES project(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_project_id ON event(project_id);
CREATE INDEX IF NOT EXISTS idx_event_type ON event(type);
CREATE INDEX IF NOT EXISTS idx_event_occurred_at ON event(occurred_at DESC);

COMMENT ON TABLE event IS 'Append-only event log (source of truth for integrations)';
COMMENT ON COLUMN event.type IS 'approval.completed, sla.breached, project.created, etc.';

-- =============================================================================

CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  headers jsonb DEFAULT '{}',
  body jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')) DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  error_message text,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_idempotency ON outbox(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_outbox_next_attempt ON outbox(next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_outbox_event_id ON outbox(event_id);

COMMENT ON TABLE outbox IS 'Transactional outbox pattern for reliable webhook delivery';
COMMENT ON COLUMN outbox.idempotency_key IS 'Unique key for deduplication on receiving side';
COMMENT ON COLUMN outbox.next_attempt_at IS 'When to retry delivery (exponential backoff)';

-- =============================================================================
-- MIGRATION 6: Webhook Subscriptions
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  endpoint text NOT NULL,
  secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_project ON webhook_subscription(project_id);
CREATE INDEX IF NOT EXISTS idx_webhook_event_type ON webhook_subscription(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_active ON webhook_subscription(is_active) WHERE is_active = true;

COMMENT ON TABLE webhook_subscription IS 'n8n webhook endpoints per project';
COMMENT ON COLUMN webhook_subscription.secret IS 'HMAC secret for signing (encrypted at rest)';

-- =============================================================================
-- MIGRATION 7: Workflow Executions (n8n tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS workflow_execution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES event(id) ON DELETE CASCADE,
  workflow_name text NOT NULL,
  n8n_execution_id text,
  status text NOT NULL CHECK (status IN ('running', 'success', 'failed')) DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  meta jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_workflow_event ON workflow_execution(event_id);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow_execution(status);
CREATE INDEX IF NOT EXISTS idx_workflow_n8n_id ON workflow_execution(n8n_execution_id) WHERE n8n_execution_id IS NOT NULL;

COMMENT ON TABLE workflow_execution IS 'Track n8n workflow executions (populated via callbacks)';
COMMENT ON COLUMN workflow_execution.n8n_execution_id IS 'n8n internal execution ID (from callback)';

-- =============================================================================
-- MIGRATION 8: Contractor Performance Metrics (for AI matching)
-- =============================================================================

CREATE TABLE IF NOT EXISTS contractor_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL,
  period daterange NOT NULL,
  on_time_delivery_pct numeric(5,2),
  quality_score numeric(3,2) CHECK (quality_score >= 0 AND quality_score <= 5),
  budget_variance_pct numeric(5,2),
  hours_available_weekly numeric(5,1),
  skills jsonb DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contractor_metrics_contractor ON contractor_metrics(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_metrics_period ON contractor_metrics(period);
CREATE INDEX IF NOT EXISTS idx_contractor_metrics_quality ON contractor_metrics(quality_score DESC);

COMMENT ON TABLE contractor_metrics IS 'Performance metrics for AI contractor matching';
COMMENT ON COLUMN contractor_metrics.skills IS 'Array of skill objects: [{skill, level, verified}]';

-- =============================================================================
-- MIGRATION 9: Audit Log
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  actor text NOT NULL,
  action text NOT NULL,
  subject_type text,
  subject_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_subject ON audit_log(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

COMMENT ON TABLE audit_log IS 'Append-only audit trail for compliance';
COMMENT ON COLUMN audit_log.actor IS 'user:uuid, ai_agent, system, or external';
COMMENT ON COLUMN audit_log.action IS 'approval.created, ai.evaluate, webhook.sent, etc.';

-- =============================================================================
-- MIGRATION 10: Helper Functions
-- =============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_tenant_updated_at BEFORE UPDATE ON tenant
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_node_updated_at BEFORE UPDATE ON node
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approval_updated_at BEFORE UPDATE ON approval
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policy_updated_at BEFORE UPDATE ON policy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_subscription_updated_at BEFORE UPDATE ON webhook_subscription
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contractor_metrics_updated_at BEFORE UPDATE ON contractor_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- MIGRATION 11: Useful Views
-- =============================================================================

-- View: Pending approvals with SLA status
CREATE OR REPLACE VIEW pending_approvals_with_sla AS
SELECT
  a.*,
  CASE
    WHEN a.sla_deadline IS NULL THEN 'no_sla'
    WHEN now() > a.sla_deadline THEN 'breached'
    WHEN now() > (a.sla_deadline - interval '20% of (a.sla_deadline - a.created_at)') THEN 'approaching'
    ELSE 'on_track'
  END as sla_status,
  EXTRACT(EPOCH FROM (a.sla_deadline - now())) / 3600 as hours_until_breach
FROM approval a
WHERE a.status = 'pending';

COMMENT ON VIEW pending_approvals_with_sla IS 'Pending approvals with computed SLA status';

-- =============================================================================

-- View: AI performance summary
CREATE OR REPLACE VIEW ai_performance_summary AS
SELECT
  p.project_id,
  p.scope,
  p.mode,
  COUNT(d.id) as total_decisions,
  COUNT(*) FILTER (WHERE d.human_override IS NOT NULL) as decisions_with_human,
  COUNT(*) FILTER (WHERE d.human_override = false) as agreements,
  COUNT(*) FILTER (WHERE d.human_override = true) as overrides,
  ROUND(
    COUNT(*) FILTER (WHERE d.human_override = false) * 100.0 /
    NULLIF(COUNT(*) FILTER (WHERE d.human_override IS NOT NULL), 0),
    2
  ) as agreement_rate_pct,
  AVG(d.score) as avg_score,
  AVG(d.confidence) as avg_confidence
FROM policy p
LEFT JOIN ai_decision d ON d.approval_id IN (
  SELECT id FROM approval WHERE project_id = p.project_id
)
WHERE d.created_at > now() - interval '7 days'
GROUP BY p.project_id, p.scope, p.mode;

COMMENT ON VIEW ai_performance_summary IS 'AI performance metrics (last 7 days)';

-- =============================================================================
-- MIGRATION 12: Seed Data (Development Only)
-- =============================================================================

-- Create default AI model version (rule engine)
INSERT INTO ai_model_version (
  id,
  tenant_id,
  model_type,
  version,
  config,
  metrics,
  is_active
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  (SELECT id FROM tenant LIMIT 1),
  'rule_engine',
  'v1.0.0',
  '{
    "auto_approve_max_cents": 100000,
    "auto_approve_min_confidence": 0.85,
    "reject_if_hours_over": 80,
    "flag_if_rate_change_pct": 10,
    "flag_if_hours_change_pct": 20,
    "flag_if_new_contractor_days": 30
  }',
  '{
    "accuracy": 0.92,
    "precision": 0.94,
    "recall": 0.90
  }',
  true
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- MIGRATION 13: Indexes for Performance
-- =============================================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_approval_project_status ON approval(project_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_assignee_status ON approval(assignee_id, status) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_project_type ON event(project_id, type);
CREATE INDEX IF NOT EXISTS idx_ai_decision_created_score ON ai_decision(created_at DESC, score DESC);

-- GiST index for daterange queries
CREATE INDEX IF NOT EXISTS idx_contractor_metrics_period_gist ON contractor_metrics USING GIST (period);

-- =============================================================================
-- MIGRATION 14: Row-Level Security (RLS) - Optional
-- =============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies (example - adjust based on your auth system)
CREATE POLICY approval_tenant_isolation ON approval
  USING (
    project_id IN (
      SELECT id FROM project WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  );

CREATE POLICY ai_decision_tenant_isolation ON ai_decision
  USING (
    approval_id IN (
      SELECT id FROM approval WHERE project_id IN (
        SELECT id FROM project WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
      )
    )
  );

CREATE POLICY audit_log_tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================================================
-- MIGRATION 15: Cleanup Old Data (Maintenance)
-- =============================================================================

-- Function to archive old events (run monthly)
CREATE OR REPLACE FUNCTION archive_old_events()
RETURNS void AS $$
BEGIN
  -- Move events older than 90 days to archive table
  INSERT INTO event_archive
  SELECT * FROM event
  WHERE occurred_at < now() - interval '90 days';
  
  -- Delete archived events
  DELETE FROM event
  WHERE occurred_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_old_events IS 'Archive events older than 90 days (run monthly)';

-- =============================================================================
-- END OF MIGRATIONS
-- =============================================================================

-- Verify migrations
DO $$
BEGIN
  RAISE NOTICE 'Phase 6 migrations completed successfully!';
  RAISE NOTICE 'Tables created: %', (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'node', 'edge', 'approval', 'policy', 'ai_model_version',
        'ai_decision', 'event', 'outbox', 'webhook_subscription',
        'workflow_execution', 'contractor_metrics', 'audit_log'
      )
  );
END $$;
