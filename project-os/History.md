# Rogers — History

The change log. Every completed change lands here, in two layers: a scan table
you always read, and an appendix you read only when digging.

The scan table answers "what happened lately". The appendix answers "what exactly
did that change do, and how do I undo it".

## How you maintain this file

- **After every completed change**, add one scan row AND one appendix row. Both,
  in the same change that did the work.
- **One change = one row.** Not one row per file, not one row per session. A log
  that has to be reassembled from fragments is a log nobody reads.
- Write the scan row for a reader who was not there. Name the behavior that
  changed, not the files.
- Keep appendix rows short — a few lines, not an essay. The full story is in the
  commit diff; a real decision belongs in `project-os/Decisions.md`.
- Record the commit SHA from **before** the change. That is the rollback target.
- Never rewrite or delete a past row. Correct a wrong one by adding a new row —
  an edited log cannot be trusted about anything.
- A `medium` or `high` risk row names its review result under **What was
  checked**: findings found, findings fixed, pre-existing ones flagged. A
  medium-or-higher row without that is a task that is not finished.
- Never write "tested" or "QA passed". Those phrases record nothing. Name the
  input, the screen, and what happened.
- When this file gets long, move the oldest rows into an archive file beside it.
  `project-os/rotate-history.ps1` does exactly that at `Go commit`, and creates
  the archive the first time it is needed. Rows move **verbatim** — never
  rewritten, never summarized, never merged, because the detail you drop is the
  one the next reader needed. Never hand-move rows: the script dedups, so it is
  safe to run every time, and a hand-move breaks that guarantee.

## Risk scale

The scale's one home is `project-os/Workflow.md` step 2 — read it there, so the
two files can never disagree. State the level at task pickup; the owner's
override wins.

## Scan log

Newest at the bottom.

| Date | Area | What changed |
|---|---|---|
| 2026-09-04 | plan | **The build plan exists.** `PLAN.md` at the root holds the architecture, data model, API, UI, 46 approval-gated steps, and the log of three external reviews. |
| 2026-09-04 | process | **ProjectOS installed.** `CLAUDE.md` and `project-os/` now govern every task and reply; hooks repeat the rules on every message from the next session on. |
| 2026-09-04 | process | **Clash verdicts applied and a model rule added.** Mockups stay, memory is a pointer, Rotem starts the dev server, `PLAN.md` stays at the root; every task now names its model and effort at pickup (rule 23), and the hooks say so on every message. |
| 2026-09-04 | repo | **The repo is on GitHub.** origin is github.com/rotem914/Rogers, created by Rotem; main pushed with the plan commit. Plan step 0.4 done. |

## Appendix — deep rows

Newest at the bottom, same as the scan log.

| Date | Task | What changed | What was checked | Result | Risk | Commit before | Rollback |
|---|---|---|---|---|---|---|---|
| 2026-09-04 | Plan v1 | `PLAN.md` written and revised through Claude, Gemini and GPT reviews; `.gitignore`, `.gitattributes`; git initialized on main. | Read back after each review round; every verdict logged in `PLAN.md` section 12. No code exists, so nothing ran. | Pass | low | none, first commit `a244ab1` | delete `PLAN.md`; nothing depends on it |
| 2026-09-04 | Install ProjectOS | Kit copied in; placeholders replaced; description, six invariants, worst bug classes, commit policy, reply dial and rule 22 set from Rotem's answers; MCP folders and `Installation.md` removed; hooks reworded for Rogers and installed to `.claude/settings.local.json`. | Hook command run from the settings file in bash and PowerShell: the standing-rules text came back in both. Both rotation scripts dry-run: paths resolved, nothing to move. No placeholder left; every `project-os/*.md` link resolves. Self-review of the kit edits: clashes listed in the install report, none overridden. | Pass | medium | `a244ab1` | `git checkout a244ab1 -- .`, delete `CLAUDE.md`, `project-os/`, `.claude/settings.local.json` |
| 2026-09-04 | Apply install verdicts | Conversations rule 12 exception for mockups; CLAUDE.md rule 13 exception for `PLAN.md`; CLAUDE.md rule 23, model and effort at pickup; PLAN.md dev-server wording in three spots; hooks text reworded and reinstalled with replace; private memory trimmed to one pointer. | Hook command run from the settings file: the new line 4 came back. The three edited rules read back. No placeholder or dangling link introduced. | Pass | medium | `a244ab1` | `git checkout a244ab1 -- .` for the tracked files; re-run the hook installer with the previous text |
| 2026-09-04 | Plan 0.4, remote and push | `git remote add origin`, `git push -u origin main`; PLAN.md 0.4 ticked. | `git ls-remote` reached the empty repo; push reported new branch main tracking origin/main. | Pass | low | `a244ab1` | `git remote remove origin`; delete the branch on GitHub |
