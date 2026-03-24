# WorkGraph Local Development Runbook

Last updated: March 24, 2026 (Europe/Zagreb)
Owner: Codex

## 1. Recommended Workspace Path

Use this path for reliable installs and runtime behavior:

- `C:\Users\NK\Projects\HybridSocialApp-run`

Avoid active development in Google Drive synced folders when possible:

- `G:\My Drive\HybridSocialApp`

Reason: `node_modules` extraction and file locks can cause `EPERM`, `EBADSIZE`, and partial installs.

## 2. Start The App (Two-Terminal Setup)

Terminal A (frontend):

```powershell
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```

Terminal B (edge function API):

```powershell
npm run edge:serve
```

If Terminal B is not running, API calls may fail and the app can fall back to `localStorage`, which looks like "mock mode."

## 3. What "Working" Looks Like

When both services are running:

- Project CRUD persists across refreshes and relogins.
- Invite and membership routes respond from the edge server.
- Timesheet/approval data is loaded from API routes, not only local cache.

When edge is not running:

- Project create/list can appear inconsistent.
- Invite actions fail or no-op.
- Data appears to save but may only exist in browser storage.

## 4. Fast Troubleshooting Checklist

If project create fails:

1. Confirm `npm run edge:serve` is running.
2. Open browser devtools and check network calls to edge API endpoints.
3. Verify `.env` values are present for local edge runtime.

If graph viewer does not carry to timesheets/approvals:

1. Confirm `workgraph-viewer-meta:${projectId}` updates in `sessionStorage`.
2. Switch Graph -> Timesheets -> Approvals and verify eye badge consistency.

If approvals do not route:

1. Verify same-company approver exists for submitter party.
2. Verify fallback chain is generated (upstream -> client).
3. Verify submitter/approver relationship exists in approval derivation.

## 5. Manual QA Flow (Current Priority)

Use this scenario after major changes:

1. Login with real user account.
2. Create/open a project with parties `TIA` and `NAS`.
3. Add people: `David` (submitter), `Nikola` (same-org approver), `John` (client approver).
4. In Graph tab:
   - select `David` in "Viewing as"
   - switch to Timesheets and Approvals
   - confirm viewer stays consistent.
5. Submit a week as `David`.
6. Confirm `Nikola` can approve if configured.
7. Remove/disable same-company approver and confirm fallback reaches `John`.

## 6. Coordination Rule For Multi-Agent Work

Before editing shared files:

1. Claim ownership in `src/docs/AGENT_WORKLOG.md`.
2. Avoid parallel edits to the same file.
3. Handoff with status + test notes before another agent picks up the file.
