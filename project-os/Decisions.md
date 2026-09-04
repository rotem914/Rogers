# Rogers — Decisions

Why non-obvious choices were made.

`project-os/History.md` records **what** changed. This file records **why** a direction was
chosen, so nobody re-argues it in six months and nobody quietly undoes it.

## How you maintain this file

- Add an entry when a choice was non-obvious and a reasonable person would have
  picked differently. Routine work needs no entry.
- **Append only.** Never rewrite or delete a past entry, even a wrong one. The
  wrong ones are the record of what this project already tried.
- **A changed decision is superseded, not edited.** Write a new entry naming the
  one it replaces, and italicize the old line in the Index so nobody follows a
  rule that has moved.
- **A fully replaced entry may move to an archive.** When superseded entries pile
  up, create `Decisions-archive.md` beside this file — the first time you need
  it, not before — and move the entry verbatim: never rewritten, never
  summarized. Its Index line stays here, marked superseded, so the trail
  survives.
- **This file also rotates, the way History does.** `project-os/rotate-docs.ps1`
  keeps the newest 25 entries live at `Go commit` and moves older ones into the
  same `Decisions-archive.md`, under its own `## Archived decisions` heading.
  Those entries still BIND the project; they only aged out of the live read, so
  treat one exactly as if it were still here. The Index keeps its line for every
  one of them, so nothing becomes invisible. Two kinds of entry therefore share
  that archive — superseded (dead) and rotated (alive) — and its header says so.
- Every new entry also gets a line in the Index, in the same change. The Index is
  the part people read; an entry missing from it is an entry nobody opens.
- Use the required format below. All four parts, every time — an entry without
  Consequences is a note, not a decision.
- Write it so a stranger can follow it without the conversation that produced it.

## Required format

```md
## YYYY-MM-DD — Decision title

### Context
What problem or constraint forced a choice.

### Options
1. Option one.
2. Option two.
3. Option three.

### Decision
What was chosen, and by whom.

### Consequences
What this enables, what it costs, what future work must not break, and what
would make it worth revisiting.
```

## Index

Every decision below, oldest first. Read this list; open only the entries your
task touches. A line in _italics_ means part of that entry no longer holds.

- 2026-09-04 · Plan v1 decisions live in PLAN.md until code exists

---

## 2026-09-04 — Plan v1 decisions live in PLAN.md until code exists

### Context

Rogers was planned before ProjectOS was installed. `PLAN.md` section 12 already
holds the verdicts of three external reviews: Tauri deferred to V1.1, no TanStack
Query, no project position column, Rive rejected, autosave serialized per note, no
real data before Access is verified.

### Options

1. Copy every verdict into this file now.
2. Leave them in `PLAN.md`, point here, and start this file at the first decision
   made after the install.
3. Move `PLAN.md` into `project-os/`.

### Decision

Option 2, taken by the assistant during the install. Where `PLAN.md` itself lives
is Rotem's call, raised in the install report under Clashes.

### Consequences

`PLAN.md` stays the one place for the build plan and its review log. A decision
that changes a `PLAN.md` verdict gets an entry here and one line in `PLAN.md`
section 12 pointing at it, so the two never disagree. Revisit when the plan is
done and `PLAN.md` retires to `notes/`.
