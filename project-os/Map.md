# Rogers — Map

The architecture snapshot: the stack in a line, the folder tree, where the data
lives, what owns what.

Read it at task pickup to find your way around. Keep it true, because a map that
lies costs more than no map.

## How you maintain this file

- **Replace the skeleton tree below with the real one during setup.** Walk the
  project root, then write what is actually there. Until you do, this file
  describes a project that does not exist.
- **Update it in the same change** that adds, moves or removes a folder, a route,
  a data store, or a major file. Never as a follow-up task — a follow-up is a
  task that does not happen.
- One line per entry: what it is, not how it works. The how lives in the code.
- Paths are relative to the repository root.
- This is a snapshot, not a plan. Nothing here describes work that has not landed.

## Stack

one Cloudflare Worker: Hono API + React/Vite SPA served as static assets · D1 + R2 · Cloudflare Access

| Setting | Value |
|---|---|
| Project root | this repository, wherever this copy of it lives |
| Runs locally at | `http://localhost:5173`, once plan step 1.1 lands |
| Checks | `npm run check`, defined at plan step 1.1; nothing to run before that |

## Tree

```text
Rogers/
├── CLAUDE.md              # entry file, read first
├── PLAN.md                # the build plan: approval-gated steps and the review log
├── project-os/            # the process docs, hooks installer, rotation scripts
├── .claude/               # settings.local.json with the hooks; personal, not committed
├── .tmp/                  # scratch, gitignored
├── .gitignore
└── .gitattributes
```

No application code yet. `src/`, `migrations/` and `desktop/` arrive with the plan
steps that create them, and this tree is updated in the same change.

## Data

Where state lives and who is allowed to write it.

| What | Where | Format | Written by |
|---|---|---|---|
| Nothing stored yet | the planned stores are described in `PLAN.md` section 4 | | |

## Ownership

Which area owns which files. Use this to answer "who owns this?" before changing
anything.

| Area | Files | Notes |
|---|---|---|
| Process | `CLAUDE.md`, `project-os/*` | The kit. Rules change only through the workflow's documentation routing. |
| Plan | `PLAN.md` | Rotem's approval-gated build plan; its checkboxes track progress. |
