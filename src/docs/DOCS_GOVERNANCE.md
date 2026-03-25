# Docs Governance

This file is the hard rulebook for docs in this workspace.
If it conflicts with another doc, this file wins.

## Hard Rules

- One topic, one canonical file.
- No duplicated blocker lists, status tables, or long narrative across active docs.
- Active docs should stay at 120 lines or fewer.
- Absolute hard cap for active docs is 180 lines.
- Active docs should stay at 12 KB or less.
- Absolute hard cap for active docs is 24 KB.
- Archive completed, superseded, or historical content as soon as it stops being live.
- Dated snapshots use `TOPIC_YYYY-MM-DD.md`.
- Long-running history uses `_ARCHIVE.md`.
- Timestamps stay on one line and use the workspace timezone.

## One-Page Handoff

Use this exact structure for any substantive docs handoff:

```md
## What Changed

## Why

## Verification

## Risks
```

- Keep each section short enough that the whole handoff fits on one page.
- If the handoff gets long, move detail to the archive and link it.
- `Verification` may say `Not run` if nothing was run.

## Archive Policy

- Move old detail into the archive instead of copying it forward.
- Preserve dates in archived entries.
- Keep the active worklog focused on blockers, current assignments, and recent activity.
- Add a short pointer from the active doc to the archive when you move material.
- If a table gets noisy, trim it before adding rows.

## New Doc Rule

- Check whether an existing file already owns the topic before creating a new one.
- If yes, extend the owner file instead of adding a parallel summary.
- If no, create the new file and add a pointer from the index.
