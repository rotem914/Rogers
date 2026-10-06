# Rogers: working rules for your AI assistant

This is the first file the assistant reads, every session. It holds what a fresh
session cannot know on its own: what this project is, who it answers to, and the
rules that override the assistant's own defaults.

## What this project is

Rogers, one Cloudflare Worker: Hono API + React/Vite SPA served as static assets · D1 + R2 · Cloudflare Access.

Rogers is a personal notes app in the spirit of Google Keep, grouped by project: a
grid of projects, a Keep-style list of notes per project, and each note on its own
page with text and pasted images. One user, Rotem, behind an email login. Dark mode
only, no light theme anywhere. State right now: V1 complete and live at rogers.rotem-e.com behind Cloudflare Access; the Tauri shell is V1.1, only if something native is missed. The
build plan with its approval-gated steps is `PLAN.md` at the repository root; every
step runs only after Rotem says go.

## Who you work for

You work for Rotem, a senior product and UX designer.

Explain enough to support a decision, then stop. A senior product and UX designer does not need
the walkthrough. They need the fact that changes the call, and the tradeoff
attached to it.

## Where things are

| Setting | Value |
|---|---|
| Project root | this repository, wherever this copy of it lives |
| Local app | `http://localhost:5173`, started by Rotem |
| Live app | `https://rogers.rotem-e.com`, deployed with `npm run deploy` |
| Checks | `npm run check`: typecheck, lint, build, and a dry-run deploy; lint joined it on 2026-09-16 |

## Read these before you work

Read this file first. Then the docs in `project-os/`, in this order:

1. `project-os/Workflow.md`: the process every task follows, from request to
   delivery. This is the one you are graded against.
2. `project-os/Map.md`: where things live and how the pieces fit. Read it before
   you go looking for a file.
3. `project-os/QA.md`: what must be checked before anything is called done.
4. `project-os/Conversations.md`: how you write replies. Every reply, not just
   report-backs.
5. `project-os/History.md`: what changed recently, so you do not undo
   yesterday's fix. Read the Scan log only: find the `## Appendix` heading and
   read everything above it; the newest rows sit just above that heading. Open
   an Appendix row only when you need its detail or its rollback.
6. `project-os/Decisions.md`: why non-obvious choices were made. Read from the
   top down to the end of the `## Index` list, and stop at the first entry
   heading below it (`## ` and a date). Open a full entry, or its copy in
   `Decisions-archive.md`, by searching for its heading, and only the entries
   your task touches.
7. `project-os/Backlog.md`: the owner's open-items list. Scan it at pickup and
   flag any open item your task touches.
8. `project-os/Code_review.md`: the calibration for reviewing risky changes.
   Load it when a review is due (rule 17), and for its blast-radius trace when
   a change touches something shared, at any risk level.
9. `project-os/Visual_QA.md`: how the running app gets tested by using it. Load
   it when the task changes something a person can see.
10. `project-os/BugAtlas.md`: the project's recurring bug classes. Load it
    before writing any bug fix; a familiar symptom may already have a mapped
    cause.
11. `project-os/Mistakes.md`: the mistakes YOU made and were corrected on,
    waiting to become rules. Read it at task pickup; it is deliberately short.
12. `project-os/Hooks.md`: the rules this project enforces mechanically, and
    the ones it does not. Read it to know which of the rules above are merely
    written down.
13. `project-os/Plan.md`, when it exists: the build plan the owner tracks
    (rule 13). Read it at task pickup.

This reading runs before the first reply of every session, whatever the first
message is: an edit, a shortcut, `FAST ON`. A hook's summary of a file is a
reminder to read it, not a substitute.

**Read on demand, never at pickup:** `project-os/Rule-reasons.md`, why each
rule exists and what it prevents. It holds the reasons only, never a rule. Open
it only when a rule is questioned, changed, or seems wrong.

When a task goes through an MCP server (Figma, analytics, any tool that talks
to an outside service), also read that server's rules doc under
`project-os/mcp/<Server>/` before the first call. Rogers has none wired and no
such folder yet; a server earns its own folder, with its setup facts, call budget
and traps, the first time it bites.

**A tool that is not connected is a setup to start, never a reason to stop.**
When a task needs a server this project has not wired yet, that server's doc
carries its setup section, and running it IS the first step of the task: do
the parts that are yours, ask for the owner's parts in one message, say a
restart is needed, and then do what was asked. "There is no Figma here" is not
an answer, it is the moment the setup begins.

## Working rules

**When two rules pull different ways.** The owner's words in this chat win, for
the task at hand. A named shortcut below (`FAST MODE`, `Go commit` and the
rest) wins over the general workflow where the two differ. Rules 4, 12, 21 and
22 and the two guards give way to neither: they bend only where their own text
says so. A new standing ask from the owner is written into the rule that owns
it, the way rule 20 does it, never left in chat.

**The numbers are fixed.** Files in `project-os/` point to rules 1 to 22 by
number, so never renumber, drop or interleave them. A rule this project adds
later goes after rule 22.

### 1. Understand before changing

Do not write code before you understand the request, the files involved, the
current behavior, and what proves the change works.

Before the first edit, settle these six things:

- What type of task this is.
- Which part of the product owns it.
- Which files are likely to change.
- Which files must not be touched.
- What behavior must stay unchanged.
- What QA must run before delivery.

The pickup line carries what `project-os/Conversations.md` (In-flight
narration) names; the rest shows in the History row.

**A constraint is a claim until it is checked.** Before an option is set aside
because a platform limit, a technical claim or an earlier assumption seems to
forbid it, run the check in `project-os/Workflow.md` step 5, 'Check every
"impossible" before it shapes the plan'.

### 2. Smallest safe change wins

Prefer the smallest isolated change that solves the task. No side refactors, no
opportunistic cleanup.

### 3. No big-bang refactors

Refactor only when one of these is true:

- the owner explicitly asks for it,
- the current structure blocks the requested task,
- repeated friction has piled up and is written down in `project-os/Decisions.md`.

### 4. No destructive action without explicit approval

Do not delete data, drop a schema, rewrite history, remove docs, or run a
destructive command unless the owner asked for it and the way back is clear.

**Archiving is not rewriting.** Every file in `project-os/` that accumulates
forever has a ceiling, and one script enforces it by MOVING old material into a
sibling `*-archive.md` that is not read by default:

- `project-os/Archive-old-rows.mjs`, one script with three engines: History deep rows and
  the History scan log; Decisions entries (newest 25 stay live); and the
  tables, the Backlog Done table (40), the Mistakes Promoted and Retired
  tables (30), and the BugAtlas Atlas table (30), the project one and any
  feature's. Its PowerShell twin, `Archive-old-rows.ps1`, does the same for
  anyone who prefers it.

It is move-only, idempotent and dedup-safe: an entry is relocated byte for
byte, never edited, summarized, renumbered or deleted, so running it twice
changes nothing. The always-read parts never rotate: the Decisions Index keeps
a line for every entry including archived ones, and the Open tables of Backlog
and Mistakes stay whole. It runs at `Go commit`. What still needs the owner's
approval: editing or deleting existing entry CONTENT, or hand-editing an
archive.

**Heavy things are reported, never deleted.**
`project-os/Find-heavy-files.mjs` lists every file and top-level
folder over 1 GB with its size and what kind of thing it is (regenerable,
backups, git history, or a leftover the owner has to judge). It runs at
`Go commit`, and whenever a task shows you something that big, say so in the
report with its path and size. The owner deletes, or says the word; you never
delete on your own, whatever the kind says.

### 5. Secrets stay out of the repo

Real secrets live in an uncommitted local env file and in the host's config.
Commit only an example file with the key names and no values.

**If a key leaks anyway**, into git, a reply, a log or a shared file, tell the
owner at once, in plain words. The key is rotated at its provider, since
removing it from the files does not switch it off. Rewriting git history to
remove it is the owner's call (rule 4).

### 6. Verify in a real browser

If the change touches anything a person can see or click, drive the running app
and check it, by the list in `project-os/QA.md` §2.

**Never claim a tool is missing without looking for it.** Some tools are not
loaded until you search for them, so "I don't see one in my toolset" is not
evidence. Search first. If anything matches, load it and use it. No
exceptions, and no "the owner can check this manually". A tool that loaded but
was denied is a denied tool, not a missing one. Say which one was denied and
what you did instead. Only after an actual search comes up empty do you say so
plainly and hand over a manual checklist the owner can run in a few minutes.

**A blocked surface is not a finished check.** If the browser tool you started
with cannot take a screenshot or drive the page, switch to another available
one and finish the pass in the same task. Report the blockage as a limitation
only after the alternatives failed too, never instead of trying them. When
every route fails, that is Path C in `project-os/Workflow.md` step 9.

**A dead app is the same case.** If the address will not load, the check is not
impossible, it is waiting on the server. Rule 16 says who starts the server;
follow it and say so in the reply. Never treat a down server as the end of the
browser pass.

**Every project has a browser tool, by install.** The install (Installation.md
6d) notes what the session already has, the desktop app's built-in pane or the
Chrome extension, checks for the owner's own Chrome, and always registers
Chrome DevTools at project scope in `.mcp.json`, which drives its own Chrome.
So "no browser tool here" is a setup that was
skipped, not a state to report: if the search comes back empty in a project
that carries this kit and `.mcp.json` has no `chrome-devtools` entry, run that
step now, in the same task, and ask the owner for the one approval it needs.
If the entry is there and still nothing loads, say why in the reply, then hand
over the manual checklist. The usual reasons: the entry was written this
session and loads from the next one; it is written for the other system (`cmd`
on macOS or Linux, a bare `npx` on Windows; Installation.md 6d step 3); the
server was declined, which `claude mcp reset-project-choices` in the project
folder undoes at the next session; or Chrome is missing, or Node is missing or
too old (20.19 or newer, 22.12 or newer on the 22 line).

**Close every tab you opened, in the same task.** Never close a tab you did
not open, and never stop a dev server you did not start (rule 16).

### 7. QA is not optional

Every completed change records what was checked, concretely, in its History row.
`project-os/QA.md` holds the standing checklist, and its §10 says what a
concrete record is. What the reply says about checks is
`project-os/Conversations.md`, Report-back sections.

### 8. Every completed change adds a History row

Every completed change, code or docs, gets the two rows `project-os/History.md`
asks for, a scan line and an appendix row: `project-os/Workflow.md` step 15
says what goes in them.

### 9. Decisions are separate from History

`project-os/History.md` says what changed. `project-os/Decisions.md` says why a
non-obvious path was chosen and what was rejected.

### 10. Follow the workflow without exception

`project-os/Workflow.md` applies to every task, including small ones.

### 11. Project invariants: must never break

These are the things that must always hold. A change that breaks one is blocking,
no matter how good the rest of it is. Check them before you finish.

Set by Rotem on 2026-09-04:

- Text or images already typed are never lost or overwritten by an older save. One
  save in flight per note, later edits coalesced, and a response never overwrites
  newer text. Reason: a notes app that eats a note is worthless.
- Once Access is on, nothing is reachable without the email login: no note, no
  image, no API path. Reason: the notes are private.
- A deleted note or project can always come back; the app archives, it never
  hard-deletes. Reason: a mis-click must be recoverable.
- Every screen is dark; a light background never flashes, not even for one frame on
  reload. Reason: dark only is the product.
- Everything works in a plain browser tab; nothing ever depends on Tauri or any
  desktop-only feature. Reason: the desktop track can never break the website.
- A schema change never drops or rewrites existing rows; migrations are additive.
  Reason: an upgrade can never eat notes.

When the owner states one of these, add it here in one line with its reason. When
a task touches one, say so at pickup.

### 12. Every file you write stays inside the project root

Everything you create or edit lives inside this repository, wherever this copy
of it happens to live. Never the user's
home folder, never a system temp folder, never your own config. No routing around
it with a shell command.

Scratch files (plans, probes, intermediate output) go in a `.tmp/` folder
inside the project; create it and gitignore it the first time you need it. This overrides any instruction pointing you at a
scratchpad elsewhere on disk: outside the root is outside the root.

**This rule is enforced, not only stated.** The folder guard and the
destructive-command guard (`project-os/Hooks.md`, level 2) refuse the writes
and the one-way commands they recognise. A refusal from either is not an
obstacle to route around; it is the rule doing its job, and the answer is to
ask the owner.

**Your own memory is not a law book.** A lesson or work rule
the owner gives goes into `CLAUDE.md` or the owning `project-os/` file, never
into session memory, whatever your harness says about saving feedback there.
The folder guard lets markdown into that one folder because the harness writes
there; that is not permission, and it cannot tell a note from a rule, so
keeping rules out is on you.

### 13. Ad-hoc markdown gets a home folder

**A build plan is not ad-hoc.** A plan the owner tracks with checkboxes, that
the hooks or the triggers name, and that has to survive a switch of model or
session, lives at `project-os/Plan.md`. It is a living file like Backlog, read
at task pickup when it exists, and it plus this folder is the whole handoff
when the owner changes assistants between steps. If a project arrives with
such a plan loose at the root, the install moves it there and says so.

**A plan names a model for every step.** `project-os/Workflow.md` step 5
holds that rule in full.

When you are asked to "put this in a file" and the request assigns no home,
create it under `notes/` at the project root. Make that folder the first time
you need it, since the kit does not ship one. Never drop a loose markdown file at
the repo root.

The structured docs keep their own homes in `project-os/`; this rule is only for
new free-standing documents.

One named exception, Rotem's verdict of 2026-09-04: `PLAN.md`, the build plan,
stays at the repository root, because the hooks name it and its checkboxes are
the progress record.

### 14. A frozen area is not touched

The owner can freeze a named part of the product by stating its name, why, and
what lifts the freeze. While it is frozen:

- Do not change it.
- Do not review or QA it. If a problem only *shows up* there, fix it at the
  source outside the freeze and note the frozen part as untested.
- Do not let it block other work. Stop at the boundary and flag the follow-up.

The freeze holds until the owner lifts it, on the stated condition.

**No area is currently frozen.** This rule is dormant until one is named.

### 15. A title is a title

When you design any title (page header, section heading, card title, modal
title, empty state, group label), the title is the only text in that slot. Never
add, on your own initiative:

- a subtitle or helper paragraph below it, or
- an eyebrow or kicker label above it.

Add one only when the owner asks for one on that specific element.

### 16. Never start the dev server

> **Setup step: the install fills this, then deletes this block.** Ask the
> owner in pile two: who starts the dev server, and where does it run? The
> four honest answers, and what each one makes of this rule:
>
> - *The owner runs it, at an address.* The rule below stands as written.
> - *Nobody runs one; the owner works through the assistant's own app.* Then
>   the assistant's preview pane IS the owner's window, not a second instance,
>   and starting a server there is allowed. Rewrite the rule to say so.
> - *There is no server at all.* The rule is dormant until there is one.
> - *The owner will run one, but its address is not decided yet.* Rewrite
>   the first sentence below to say so: the owner will run one; until an
>   address is written in there is nothing to drive, and a visual check waits
>   on it. The change that first gives the project an address writes it in
>   and restores that sentence with the address.

Assume the owner already has one running at `http://localhost:5173`, and drive that. Do not
launch one, in the foreground or the background, at any point.

One-shot commands like `npm run check` do not hold the port and are fine to
run. A project with no dev server at all leaves this rule dormant until it gains
one.

**A server that is down is a REQUEST to the owner, never a step you drop.** Not
starting one is the only half of this rule; the other half is asking. Say the
address looks dead, ask them in one line to start it, and say what is waiting on
it. Then wait: they are one command away, and a browser check they could have had
in thirty seconds is not worth trading for a task reported without it. Never
answer a dead server by quietly moving on, by calling the browser check skipped,
or by reporting a change as done with the visual half missing. If they say to
continue without it, that is their call, and the reply names what stayed
unverified.

### 17. Risky changes get reviewed

State the risk level at pickup, on the scale in `project-os/Workflow.md`
step 2. The owner can override it, as that step says.

Medium or high arms an automatic review, run as `project-os/Workflow.md`
step 12 sets out. The task is not done until the review has run. It also
traces **where else the change can reach**. `project-os/Code_review.md`
carries the method.

### 18. The iron rule: change only what was asked

Do exactly what was asked. Nothing else.

An unrequested change is a defect even when it is an improvement, because nobody
asked for it and now they have to find it. Your judgment can be right and still
not be theirs to make.

Never, on your own initiative:

- change a value the request did not name: a duration, a color, a size, a
  spacing, a breakpoint, an easing;
- delete or disable a behavior that merely became pointless after the asked
  change (say it is now inert, and ask);
- extend the change to a sibling, a variant, or another component for
  consistency;
- rename, reformat, or reorder code you were not asked to touch.

**When the asked change has a side effect, ask. Do not resolve it alone.** One
short question beats one unrequested edit, every time.

The only things that ride along are what the change strictly requires to work: a
guard against an error the change would otherwise cause, an import it needs. Even
those get one line in the report, named as a side effect, so the owner can veto
them.

This sits on top of rule 2. Rule 2 says do not solve more of the problem than
asked. Rule 18 says do not touch anything the request did not name, including
things you are certain are better your way.

### 19. The same bug twice becomes an atlas row

When a bug pattern appears a second time, or a fix took several attempts
because the real cause was hidden, add or update a row in
`project-os/BugAtlas.md` in the same task. Before writing any bug fix, check
that file for a matching symptom first.

### 20. A correction you were given is written down, once

When the owner corrects HOW you worked, a broken rule, a decision that was
theirs, a skipped step, an assumption, add one row to
`project-os/Mistakes.md` in the same reply, before the work continues.
When the same slip happens a second time, it stops being a row: write the
rule into the file that owns that behavior and move the row to Promoted,
naming that file. `project-os/Mistakes.md` carries the map of which file owns
what.

Skip the waiting room when the right rule is already obvious, and write the
rule instead. Skip it entirely for a product opinion the owner simply
overruled; being overruled is not an error.

### 21. This project is your only source

Everything you use comes from THIS repo, the owner's own words, or the tool
documentation. Never another project on the machine.

Concretely, never on your own initiative:

- open another repository to see how it solved something,
- copy a convention, a rule, a config, or a policy across from one,
- treat another project's working setup as evidence about this one,
- carry any of its code, content, or client material into this repo.

**A missing piece is a question, not a search.** When something this project
needs is absent, a tool connection, a policy, a credential, say what is
missing and ask.

The one exception is the owner pointing you at a specific other project, in
this conversation, for a named purpose. Their instruction, their scope, and it
covers that task only.

Rule 12 keeps your WRITES inside the project. This rule keeps your READS and
your reasoning inside it too.

### 22. One action at a time, one plan step at a time

Rotem watches the work as it happens. Never spawn subagents, never fan out, and
never fire several tool calls in parallel: one call, then the next. He corrected
the parallel calls once, on 2026-09-04; it is a rule, not a preference.

**Run continuously through `PLAN.md`, one step at a time, and keep going.** He
lifted the per-step approval on 2026-09-04: work each step in order, tick its
checkbox in the same change, report it, and start the next one without waiting.

Stop and hand back only when one of these is true:

- something is actually wrong: a check fails, a finding needs his verdict, or a
  step does not do what the plan says it should;
- the step is his: a dashboard click, an install on his machine, a push;
- the action reaches outside this machine in a way he has not already approved.
  Deploying is the clear case, because the address is public until Access is on,
  so stop before plan step 6.1 and ask.

Everything else continues. Asking permission for work he has already approved
costs him a message and buys nothing.

### 23. Name the model and the effort before every task

Rotem pays per model and switches them himself in the app. At pickup, next to
the risk level, say in one line which model this task deserves and at what
effort, low, medium, high or max. The calibration: Opus at medium for
scaffolding, CRUD, lists, styling, deploy and docs; Fable at high for the API
client with the Access expiry handling, the composer and its serialized
autosave, the image flows tied to autosave, a bug that resisted two fixes, and
a review pass at the end of a phase. When the running model is not the one
named, say so and continue unless he switches. He asked for this on 2026-09-04.

## Review & QA commands (owner-triggered)

Two phrases that start a calibrated pass. Each LOADS its calibration doc first
and runs what that doc prescribes; the doc is the source of truth and this
section only wires the trigger. Match is case-insensitive.

What a pass delivers is that doc's Output section; its task document is dated
and goes under the project's notes folder. The owner's verdict on each finding,
**fix / drop / backlog**, is folded back as that doc's Calibration loop says.

### `Go code review`

Run the review in `project-os/Code_review.md`. Read that file first; its Scope
section sets this pass to the WHOLE REPO, every time, never a diff.

### `GO visual qa`

Run the pass in `project-os/Visual_QA.md`. Read that file first, then drive the
running app in one browser tab (who starts it: rule 16).

## Shortcuts (owner-triggered)

Short owner phrases that map to a fixed multi-step flow.
Run a flow only when the owner types the exact phrase, case-insensitive.
A casual "commit this" or "let's go fast" triggers nothing.

### `FAST MODE` (also `FAST ON`)

The owner checks every result themselves, in their own running app, so each
round is edit, reply, next round. `FAST ON` switches it on exactly like
`FAST MODE`; it is the twin of `FAST OFF`.

**Offer it when the work asks for it.** Three rounds in a row that each changed
only a value, a color, a size, a spacing, a position, a duration, are tuning by
eye, and the paperwork between them is what the owner is waiting on. Two such
rounds are coincidence; at the third, close that reply with the offer below,
verbatim, blank lines included. Once per session, never while the mode is on,
and never again after a no. It is an offer, not a switch: the mode starts only
when the owner says so.

> Suggestion to improve your work:
> Looks like you're tuning by eye, where speed matters more than paperwork.
>
> We have FAST MODE for this: it cuts the wait between rounds.
> It skips the paperwork and the code review: you check each round yourself, and I write the docs when it ends.
>
> Say FAST ON to switch it on.
> Say FAST OFF, or GO COMMIT when you are done, and I write the docs and finish the task.

While it is on:

- The pickup reading (the "Read these before you work" list, Conversations.md
  included) still runs in full before the first edit. Fast mode skips checks
  and paperwork per round, never what the session has to know to start.
- Make the requested change only; no risk-level statement.
- Skip, per round: browser QA (rule 6), the what-was-checked report (rule 7),
  the History rows (rule 8), and the rule-17 auto review.
  The owner's own check replaces them.
- Everything else still holds: smallest safe change (rule 2), no destructive
  actions (rule 4), invariants (rule 11), the dev server rule (rule 16).
- End every reply with a divider and then the line `Fast mode on`, alone.

How it ends: `FAST OFF`, plain words ("exit fast mode"), the `Go commit`
shortcut (which ends it by itself, first thing, without asking), or the
conversation simply ending, since the mode never carries into a new chat.

The skipped paperwork is deferred, not erased. The moment the mode ends, run
the catch-up before anything else: one scan row and one appendix row covering
the whole burst (rule 8), not one per round, any Decisions entry the burst
produced, any Backlog row an owner verdict earned. When the mode died with a
closed chat, the debt crosses the session boundary and is paid at the next
`Go commit`. The trigger is the DEBT, never
"was the mode on in this conversation": ask whether uncommitted work exists
with no History row.

What the catch-up does NOT resurrect: the per-round QA and the auto review.
In fast mode the owner IS the reviewer; they passed each round as it landed.
If a round left something genuinely unverified, say so in one line.

### `Go commit`

Commit everything accumulated up to now, across sessions, not only this chat.

1. If FAST MODE is on, end it. Then, whether or not it was on in this chat,
   look for uncommitted work that has no History row (a fast burst whose chat
   closed) and pay the fast-mode catch-up for it in full, first.
2. **Rotate the growing docs**, so the live files stay cheap to read. One
   script does every file, on every system (add `--dry-run` for a preview
   that writes nothing):

   ```
   node project-os/Archive-old-rows.mjs
   ```

   Its PowerShell twin, `project-os/Archive-old-rows.ps1`, does the same for
   anyone who prefers it (`-DryRun` there for the preview):

   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File project-os/Archive-old-rows.ps1
   ```

   On macOS or Linux, `pwsh -NoProfile -File project-os/Archive-old-rows.ps1`.

   If neither can run here, say so once and commit without rotating; the live
   docs then keep growing until one does. Never skip this step silently, and
   never report it as done when it did not run.

   Move-only and idempotent, so this is safe every time; a run with nothing to
   move says so. Stage whatever it changed with the rest.
3. If this folder has no version history of its own yet, run
   `git init -b main` first and say so in one line of the report; it is
   local, and deleting `.git` undoes it. It has none when
   `git rev-parse --show-toplevel` fails, or when it names a folder above
   this one while `git ls-files` here prints nothing: a new project sitting
   inside another project's folder, whose commits must never land in that
   other project. Before the first stage, make sure `.gitignore` names the env
   files (`.env*` plus `!.env.example`) and every dependency or build folder
   that exists here (from the list at the top of
   `project-os/Backup-whole-project.mjs`). Add only the lines that are missing,
   never a folder git already tracks, and say so in the same report line.
   Never create a GitHub repository and never add a remote. If the
   commit stops because git has no name or email on this computer, ask the
   owner for their name and email, then set them for this repository only
   (`git config user.name` and `git config user.email`, never `--global`), and
   say so in one line; never make them up. Then `git status` plus `git diff`:
   see the whole uncommitted scope.
3b. **List the heavy things** (rule 4): `node project-os/Find-heavy-files.mjs`. Anything
   it prints goes in the commit report, size and kind beside the path, for the
   owner to delete or keep. It deletes nothing and never blocks the commit.
3c. **Run the audit** (`Go audit` below):
   `node project-os/Audit-project-records.mjs`. Every gap it counts goes in
   the commit report as a warning, one line per kind with what it means. It
   is a warning, never a gate: it never blocks the commit, and a run with no
   gaps is not mentioned.
4. Run the project checks, `npm run check`, and continue only if they pass. A red
   check stops the commit; report it instead. Until plan step 1.1 lands there is
   no check to run; say so in the commit reply instead of skipping silently.
5. Stage the intended files only. Never a blind add-everything, and never
   env files, secrets, or generated junk: `.dev.vars`, `.env*`, `.wrangler/`,
   `dist/`, `node_modules/`, `.tmp/`, `.claude/settings.local.json`.
6. Commit with a clear message covering the full scope, on main. No task
   branches; Rotem confirmed this on 2026-09-04.
7. Stop after the commit. Rotem pushes, always, from GitHub Desktop or his
   terminal. Never run `git push`; he corrected this on 2026-09-04 after the
   install had taken "I push" from the plan by silence.

### `Go audit`

Count the gaps in this project's own process, instead of trusting that it ran:

```
node project-os/Audit-project-records.mjs
```

Add `--days N` to look back N days instead of the script's default. It only
counts, and always exits 0. Report each kind of gap it found in one line: what
it means and the fix you would make. Fix nothing until the owner picks
(rule 18). A run with no gaps is one line. `Go commit` runs it too, as a
warning only (its step 3c).

### `Go update kit`

Bring this project up to a newer kit without touching its records or its own
edits. Never by copying the new kit over the old: that replaces History and
Decisions with empty templates.

1. Fetch the kit into the scratch folder, with its full history:

   ```
   git clone https://github.com/rotem914/ProjectOS .tmp/projectos-kit
   ```

   No `--depth`: the comparison reads the kit as it was at the commit this
   project came from, and a shallow clone does not have that commit. A fetch
   left there by an earlier run is deleted first, as in step 8.
2. Compare, with the fetched kit's own copy of the script, which knows every
   file the new kit ships. Without `--apply` it changes none of this
   project's files and only fills its review folder, `.tmp/kit-merge/`:

   ```
   node .tmp/projectos-kit/project-os/Compare-kit-files.mjs --kit .tmp/projectos-kit
   ```

   It reads the commit this project came from in `project-os/Kit-version.json`.
   With no such file it looks for that commit itself, in the kit's history,
   by the scripts and guards this project carries, and its "Base:" line says
   "found in the kit's history, not recorded yet". Only when it says the base
   is unknown, add `--base <commit>` from the install's History row.
   When the row names none either, run it as it is and say in the report that the
   starting commit is unknown: a machinery file the kit has and this project
   lacks still comes in as new, but every file both hold that differs shows as "cannot
   tell who changed it", is never copied, and is compared by hand in step 5.
3. Show the owner the report in plain words: the files the kit changed that
   this project never touched, the files new in the kit, the calibrated files
   the tool merged cleanly with this project's wording kept, and what is left
   by hand (step 5). A file this project removed, such as Installation.md,
   stays removed. Ask one question: apply? Nothing is applied before the
   owner's word.
4. On that word, run the same command with `--apply` added. It copies only
   the machinery files the kit changed and this project never touched, plus
   the machinery files new in the kit, and writes each calibrated file that
   merged cleanly. It records the new kit commit in
   `project-os/Kit-version.json` only when nothing is left to carry over by
   hand: no machinery file changed on both sides or cannot tell, and no
   calibrated file with a clash, a placeholder nothing here fills, or new in
   the kit. Otherwise it lists them and records nothing new; a base it found
   in the kit's history it records first, so the next compare starts there.
   Nothing outside
   `CLAUDE.md`, `Installation.md` and `project-os/` ever comes in from the
   fetch: the kit's `hooks/` and `.claude-plugin/` would make the plugin take
   this project for the kit itself.
5. Settle what is left by hand, by the install's merge law: this project's
   own wording wins every clash, nothing of it is deleted or reworded on your
   own, every clash with it goes in the report for the owner's verdict, and
   the rule numbers never shift. A filled-in value is not this project's
   wording: the tool fills both kit copies with this project's values (its
   name, its owner, its address, its check command) before it merges, and
   labels each clash it leaves. A clash it labels as a setup block the
   install filled is yours: take the kit's new block and fill it again from
   this project's answer. Only a clash it labels as this project's own
   wording goes to the owner. Settle each in its merged copy under
   `.tmp/kit-merge/`, then copy that over this project's file; every compare
   empties that folder, so copy a merge out before running one again. A
   clean merge whose new lines bring a placeholder nothing here fills is
   copied over the same way, the placeholder then filled from what this
   project already says, and asked only when nothing does. The living files
   (History, Decisions, Backlog, Map, BugAtlas, Mistakes) keep every row; only
   a change to the instructions at their top comes over, and the report
   counts the lines the kit changed in each one's template. A calibrated file
   new in the kit is copied by hand and its setup block filled from what this
   project already says.
   Carry over the files `--apply` listed the same way, then run the command
   once more with `--record` in place of `--apply`: it records the new kit
   commit and lists every file still different from the kit, calibrated ones
   included. Never record
   before those files are carried over: the next compare would read them as
   this project's own changes and never bring the kit's.
6. Run the checks: `npm run check` as `Go commit` runs it, and when a guard
   or the hooks setup changed, the checks at the end of `project-os/Hooks.md`.
   A computer that runs the kit as a plugin keeps its own copy of the guards,
   and an older plugin never says when that copy is behind. So compare the
   two folders yourself, from the project root, line endings aside (both
   guards allow this command):

   ```
   git diff --no-index --ignore-cr-at-eol --quiet "$HOME/.claude/skills/projectos/project-os/guards" project-os/guards
   ```

   Exit 0 means they match. An error that it could not access the plugin's
   folder means this computer has no plugin. Either way nothing more is
   needed here. Any other exit 1 means they differ: when this project's
   `.claude` settings wire no guard of their own, run
   `node project-os/Install-project-hooks.mjs` too. From the next session the
   project's own guards run, and the plugin steps aside for them. Updating the
   plugin's copy is then an optional tidy-up,
   `git -C "$HOME/.claude/skills/projectos" pull`; it is outside the project,
   so that command is the owner's.
   When the update changed `project-os/Check-command.json`, or brought it
   in for the first time, do `Installation.md` step 6f: pick the quick check
   when the file has none, then run the approve command again, since the
   plugin runs only the command that was approved on this computer.
7. Log it (rule 8): one scan row and one appendix row naming the old kit
   commit and the new one, the files copied, the files merged by the tool and
   by hand, and the clashes waiting on the owner.
8. Delete the fetch and the review folder:

   ```
   rm -rf .tmp/projectos-kit .tmp/kit-merge
   ```

   In PowerShell, `Remove-Item -Recurse -Force .tmp/projectos-kit, .tmp/kit-merge`.
   The guards let a delete under `.tmp/` through as disposable.

The update stays uncommitted until `Go commit`, like any task. A project whose
own CLAUDE.md predates this shortcut runs it from the fetched kit's CLAUDE.md,
and step 5 brings the shortcut in. Whatever version of these steps the project
carried when the update started, the update finishes with the newest. When
`--apply` ends on a line saying this project's CLAUDE.md now carries newer
Go update kit steps, finish with steps 5 to 8 as the merged CLAUDE.md writes
them; when CLAUDE.md is settled by hand in step 5, go on with steps 6 to 8 as
the settled file writes them.

### `Go backup`

One local, self-contained ZIP snapshot of the whole project, for offline
disaster recovery that depends on no git host and no sync folder. Flow:

1. Run `node project-os/Backup-whole-project.mjs`. Its PowerShell twin,
   `Backup-whole-project.ps1`, makes the same ZIP for anyone who prefers
   it; where Node cannot run, use the twin, and where neither can, say so
   and make no ZIP. The script zips the whole project, git history
   included, and leaves out the regenerable folders named in its setup
   block, the `.codex` folder at any depth, the assistant's personal
   settings (`.claude/settings.local.json`, its `.backup` copy and
   `.claude/settings.json.backup`) and worktree copies, the `backups/` and
   `.tmp/` folders at the root, `*.tmp` leftovers, and the env files
   (`.env*`, `.dev.vars*`; a template, a name with example, sample or
   template as one of its parts, travels). The script's own header holds
   the full list. The committed
   `.claude/settings.json` and the project's own commands travel. Key files
   stay out too, recognised by their name only, and the run names each one
   it left out:
   - certificates and key stores: `*.pem`, `*.p12`, `*.pfx`, `*.jks`,
     `*.keystore`;
   - private keys: SSH (`id_rsa`, `id_ed25519` and the like), Apple (`*.p8`)
     and PuTTY (`*.ppk`);
   - cloud credentials: a file named `credentials`, and the credentials,
     client secret, service account and Firebase admin SDK JSON files;
   - login files: `.npmrc`, `.pypirc`, `.netrc`, `.git-credentials`;
   - an env file under another name, such as `production.env`;
   - Terraform state, `*.tfstate` and its backups;
   - a copy of any of these ending in `.bak`, `.old` or `.orig`.

   A template (example, sample or template in its name), an SSH public key
   (`.pub`) and a Keynote deck (`.key`) travel. A secret saved under any
   other name travels in the ZIP, so keep those outside the project.
   Every file and folder name is checked in the finished archive (names, not
   content), so an empty folder comes back on a restore too. When the project
   has a git history, the run also proves the snapshot's history opens: it
   copies that history out of the ZIP and has git read its latest commit
   (with no git on the computer, it checks that the parts git needs are
   there). The run either passes both checks or fails and leaves no ZIP at
   all; there is no "mostly worked".
2. The ZIP lands in `backups/` at the project root, which is gitignored.
3. Never commit or push a ZIP.
4. Tell the owner to move the ZIP to external storage; a backup on the same
   disk as the project is not one. When the run named key files it left
   out, give the owner that list beside the ZIP's location, so it can travel
   with the ZIP: a restore needs it, and the run's output is gone by then.

**Env files and common key files never travel.** They are excluded on
purpose, so a full restore recreates the env files from their templates and
brings back by hand the key files the backup run named. Say so when
reporting a restore, never as a surprise during one. The script recognises
them by name only: a secret saved under any other name goes into the ZIP
with everything else.

**Restore.** Unzip the chosen `backups/*.zip` into a NEW folder, never over the
live tree; reinstall dependencies; recreate the env files from their
templates and bring back the key files the backup run named; then switch
the guards back on, since the personal settings file
never travels: run `node project-os/Install-project-hooks.mjs` in the restored
folder (with `--shared` too if the project used it), or confirm the plugin's
start line names the new folder, and run the two guard probes from
`project-os/Hooks.md`. Then run the project as usual. The full git history is
inside the snapshot's `.git` folder, and the backup run proved it opens, so
nothing has to be fetched from anywhere. Say in the restore report, in one
line, that the guards were wired again.

`.mcp.json` travels in the snapshot but is written for the system that made
it: restoring on the other system, switch its `chrome-devtools` entry to this
system's form (Installation.md 6d step 3). A copy with no `.mcp.json`, such as
a fresh clone, copies `.mcp.json.example` to `.mcp.json` the same way.

### `Go commit and backup`

Run both flows back to back: `Go commit` in full (the assistant commits and
stops, Rotem pushes), then `Go backup`.

### `Backlog`

When the owner says `Backlog` about an item, in any casing, append one row to
`project-os/Backlog.md`: date, the item in plain words, source.
That file's own rules apply: this trigger is the ONLY way in, done rows move
to Done and are never deleted, and the Open table is scanned at task pickup.

## How to reply

Every reply follows `project-os/Conversations.md`. Not only report-backs after
work: every reply, in every conversation.

That file is the single home of every reply rule: structure, length, tone,
language. This file sets none of its own, so the two can never disagree and you
never have to guess which one wins.
