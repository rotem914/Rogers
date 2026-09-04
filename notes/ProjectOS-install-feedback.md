# ProjectOS install feedback, Rogers, 2026-09-04

Notes from one real install, written by the assistant that ran it, for improving the kit.
Context: a brand-new project with a plan but no code, on Windows, Claude Code inside the desktop app, owner on a metered plan, one tool call at a time by the owner's rule.

## What worked

- The two-pile question batch. Pile one got zero corrections, pile two got three one-word answers. The install waited on nothing else.
- Invariants written as consequences. Six candidates, six yes answers, one word each. The owner judged them in seconds.
- The length dial shown as two sample replies instead of numbers. Instant answer.
- The installer script: idempotent, backs up, reads both settings files, prints what it did. Nothing to improve.
- "Prove one hook actually speaks." It passed here in both shells, and the instinct is right: a silent hook looks identical to a working one.
- The rotation scripts' dry run as proof that paths resolve. Cheap and convincing.

## What to improve

**1 · Reading cost is the biggest bill of the install**

Step 1 demands every file in full: about 180 KB, roughly 45,000 tokens, and 42 KB of that is two PowerShell scripts whose internals the install never needs.
On a metered plan this one step costs more than the rest of the install combined.
Suggest: exempt the two `.ps1` files and `install-hooks.mjs` from "read in full", ask for their header and parameter block only.
Suggest: let a project that will delete an MCP folder delete it before reading it, since the folders are only read to be filled.

**2 · A project with no code has no outcome in step 3**

The check command has three outcomes: passed, failed, refused.
Rogers had a fourth: nothing exists to run, and the dev URL does not exist either.
The install had to invent a convention: name the future command, say which plan step creates it, mark it "nothing to run before that" in every table.
Suggest: a fourth outcome, "does not exist yet", with that convention written down and a fixed line for the report.

**3 · The kit collides with the assistant's own memory and says nothing about reconciling it**

Rule 12 forbids rules in the assistant's private memory, and Conversations rule 16 forbids a second home for reply rules.
The assistant arrived with four memory notes about this project, written before the kit existed, and the install law never asks about them.
The owner cannot see that folder, so the kit is the only thing that can raise it.
Suggest: an install step "memory audit": list what private memory holds about this project and hand the owner a keep-or-trim verdict in the report.

**4 · Deleting Installation.md leaves dangling mentions**

Hooks.md, install-hooks.mjs and Conversations.md name Installation.md, and step 9 deletes it.
A reader follows the pointer and finds nothing.
Suggest: keep the file by default, or phrase the mentions as "the install law" without a filename, or have step 9 rewrite them.

**5 · Two dash rules disagree**

Conversations rule 17 bans long dashes in every text the assistant writes, docs included.
Decisions.md's required heading is `## YYYY-MM-DD — Title` with an em dash, and rotate-docs.ps1 parses that heading.
The first decision entry has to break one of the two.
Suggest: make the Decisions heading a hyphen or a middle dot, update the script's pattern, and say so in rule 17.

**6 · The reply ceiling has no exemption for the question batch**

Rule 1 says the ceiling holds for every reply and exempts only the install report.
The step-4 question batch cannot fit in three lines and the law requires it to be complete.
Suggest: exempt the question batch in both files, the same way the report is exempted.

**7 · Rule 16 assumes the owner runs a dev server**

A solo owner working through the assistant's desktop app has no server running, so browser QA has nowhere to go and rule 16 forbids starting one.
Suggest: a pile-two question at install: who starts the dev server and where, with the answer written into rule 16.
A preview pane inside the assistant's own app is the owner's window, not a second instance, and the kit should be able to say so.

**8 · The hooks rewording has no recipe**

6b says rewrite the standing-rules text for this project and gives no shape.
It worked, but a three-line recipe would save a wrong first attempt: which rules earn a line, the character budget, no apostrophes, test in both shells.
Also, the shipped SessionStart text carries `${CLAUDE_PROJECT_DIR}`, which PowerShell and cmd do not expand, so on Windows it prints as literal text.
This install dropped it and used relative names.
Suggest: drop it from the shipped text.

**9 · A chat-driven install works but the README does not say so**

The README expects the owner to paste the install prompt.
Here the owner said "install it" with a link, and the assistant read the README, then Installation.md, and followed it.
Suggest: one README line: "or just tell your assistant to install it, it reads Installation.md either way."

**10 · A pre-existing plan has no home**

Rule 13 sends loose markdown to `notes/`, but a build plan the owner tracks with checkboxes, that the hooks name, and that survives a model switch is not a scratch document.
This install left `PLAN.md` at the root and raised it as a clash.
Suggest: name a home for a plan, root or `project-os/Plan.md`, and say that plan plus kit is the handoff when the owner switches models between steps.

**11 · The "what you can say to me" list has no slot for project triggers**

For a plan-driven project the most used phrase is "go 1.1", and the kit's closing list cannot hold it.
Suggest: a slot for project-specific triggers, filled at install.

**12 · A placeholder hides inside an example fence**

`{{DEV_URL}}` sits inside a `~~~` example in Conversations.md.
A blind replace catches it; a careful reader of the placeholder table would not expect one there.
Suggest: mention in step 5 that examples carry placeholders too.

**13 · "Under ten minutes" is optimistic**

This install took about twenty tool calls, most of them reading, at one call at a time.
Suggest: "under ten minutes of your time" is the honest claim; the assistant's time is longer.
