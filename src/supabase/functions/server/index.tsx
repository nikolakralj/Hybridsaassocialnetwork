import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { registerEmailRoutes } from "./email.tsx"; // ✅ Phase 5 Day 8: Email sending
import { registerApprovalKVRoutes } from "./approvals-kv.tsx"; // ✅ Phase 5 Days 9-10: KV-based approval
import { timesheetApprovalsRouter } from "./timesheet-approvals.ts"; // ✅ Phase 5B: Graph-based approvals
import { graphVersionsRouter } from "./graph-versions.ts"; // ✅ Phase 5B: Graph versions API
import { graphDynamicNodesRouter } from "./graph-dynamic-nodes.ts"; // ✅ NEW: Dynamic graph nodes
import migrateContractsRouter from "./migrate-contracts.ts"; // ✅ LOCAL SCOPE: Contracts migration
import runMigrationRouter from "./run-migration.ts"; // ✅ LOCAL SCOPE: Direct SQL migration

// Force rebuild - 2025-01-23-v11 (Add direct SQL migration endpoint)

// Initialize Hono app
const app = new Hono();

// CORS must be configured to allow frontend to call
app.use("/*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Logging
app.use('*', logger(console.log));

// Register all routes
registerEmailRoutes(app); // ✅ Phase 5 Day 8: Email sending
registerApprovalKVRoutes(app); // ✅ Phase 5 Days 9-10: KV-based approval
app.route('/make-server-f8b491be/timesheet-approvals', timesheetApprovalsRouter); // ✅ Phase 5B: Graph approvals
app.route('/make-server-f8b491be/graph-versions', graphVersionsRouter); // ✅ Phase 5B: Graph versions
app.route('/make-server-f8b491be/graph/dynamic-nodes', graphDynamicNodesRouter); // ✅ NEW: Dynamic nodes
app.route('/', migrateContractsRouter); // ✅ LOCAL SCOPE: Contracts migration
app.route('/', runMigrationRouter); // ✅ LOCAL SCOPE: Direct SQL migration

// Start the server
Deno.serve(app.fetch);