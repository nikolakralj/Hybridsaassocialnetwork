# Phase 3 Gate Checklist (Auth, Invites, Incremental Supply Chain)

Use this checklist before moving to Phase 4.

## A. Identity And Viewer Consistency

- [ ] Sign in as a real user (no test persona switch needed)
- [ ] Open Work Graph and change `Viewing as`
- [ ] Confirm selected viewer persists after refresh
- [ ] Confirm `YOU` marker matches selected viewer context

## B. Project + Graph Persistence (DB-first)

- [ ] Create project
- [ ] Reload app and verify project still exists
- [ ] Open project and verify graph nodes/edges persist
- [ ] Click `Repair Graph` and verify migration runs without data loss

## C. Invite + Membership Flow

- [ ] Invite member from Projects list
- [ ] Confirm invitation appears in recipient invitation panel
- [ ] Accept invitation as recipient
- [ ] Confirm project appears in recipient project list
- [ ] Decline invitation path also works

## D. Incremental Supply Chain

- [ ] Create project with incomplete chain (draft)
- [ ] Add missing party/member later
- [ ] Save and confirm existing history remains intact

## E. Visibility Rules

- [ ] Person viewer sees own org colleagues
- [ ] Approver sees connected chain participants based on visibility rules
- [ ] Hidden people (`visibleToChain=false`) remain hidden externally

## F. Exit Gate

Phase 3 is complete when a real team can:

1. Onboard with real identity and invites
2. Create and evolve a project graph incrementally
3. Maintain stable scoped visibility per viewer
4. Persist all project/graph state through DB-backed APIs
