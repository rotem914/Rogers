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
- 2026-09-04 · One nullable pinned_at column carries both the pin and the pinned order
- 2026-09-04 · The API speaks its own shape, not the table shape
- 2026-09-04 · Project order is a nullable position column, written for the whole list at once

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

---

## 2026-09-04 - One nullable pinned_at column carries both the pin and the pinned order

### Context

The project page shows pinned notes first, in the order they were pinned, then
everything else newest first, in one list. The schema had to carry three facts:
whether a note is pinned, when it was pinned, and where it sits in the list.

### Options

1. A boolean `pinned` column, plus a separate column for the pinned order.
2. A nullable `pinned_at` timestamp, null meaning not pinned.
3. A `position` column maintained by hand across both sections.

### Decision

Option 2, taken by the assistant while writing the first migration.

### Consequences

One column answers all three questions, and the list needs one query with no
CASE expression and no second fetch: `ORDER BY pinned_at DESC, created_at DESC`.
SQLite sorts nulls last under DESC, so unpinned notes fall below pinned ones by
themselves. Proven on the local database: pinned newest first, then unpinned
newest first, archived excluded, and the query planner uses `notes_by_project`
with no separate sort step.

What future work must not break: pinning is a timestamp write, never a boolean,
and unpinning writes null rather than a flag. Anything that starts storing a
manual order for notes has to revisit this, because a `position` column would
then compete with `pinned_at` for the same job. Revisit if drag to reorder is
ever wanted inside a section.

---

## 2026-09-04 - The API speaks its own shape, not the table shape

### Context

The shared types define what the Worker sends and the app receives. The easy
route is to send table rows straight out, which needs no mapping code at all.

### Options

1. Send rows as they are: snake_case, `archived_at` included, `images` as the
   stored JSON string.
2. Define a separate wire shape and map row to wire inside the Worker.

### Decision

Option 2, taken by the assistant while writing the shared types.

### Consequences

Three things follow. `archived_at` never appears in a response type, so an
archived note cannot reach a screen by accident, which protects the invariant
that a delete is recoverable and invisible rather than merely hidden by a
filter someone might forget. `images` is a real array on the wire and a JSON
string in the column, parsed in one place. And reading reports state,
`pinnedAt`, while writing expresses intent, `pinned` as a boolean, so no
redundant flag can drift away from the column that orders the list.

The cost is a mapping function per table, in the Worker. Future work must not
bypass it: a route that answers with a raw row would leak `archived_at` and
hand the app a JSON string where it expects an array. A check that reads the
columns and the types and compares them ran clean at this step and can be run
again whenever the schema moves.

---

## 2026-09-04 - Project order is a nullable position column, written for the whole list at once

### Context

Home shows projects in creation order. Rotem asked to drag them into an order of
his own, with no grip icon on the tile. `PLAN.md` had already anticipated this
and left it out of V1: "no position column in V1, one migration away if wanted."
Two questions had to be answered: how the order is stored without rewriting rows
that already exist, and what the browser sends when a tile is dropped.

### Options

1. Backfill a position for every existing project in the migration, so the
   column is never null.
2. Add a nullable position, leave every existing row untouched, and sort
   unpositioned projects after positioned ones, still by creation date.
3. Store a fractional position and write only the row that moved.

### Decision

Option 2 for the column, taken by the assistant. The migration adds
`position INTEGER` with no default, so no existing row is rewritten, which is
the additive-migration invariant in `CLAUDE.md` rule 11. The list sorts
`position IS NULL, position ASC, created_at ASC`, so a database nobody has
reordered keeps exactly the order it had, and a project created after a reorder
lands at the end where a new tile has always appeared.

For the write, the browser sends the whole ordered list of ids to
`PUT /api/projects/order` and the Worker writes a position to every one of them
in a single D1 batch. Option 3 was rejected: a fractional position is one write
instead of a handful, but it drifts, needs a rebalance nobody remembers to
write, and buys nothing at this size.

### Consequences

The order on screen and the order in the database are one fact rather than two
that have to agree, and a connection lost halfway cannot leave half of each,
because the batch is atomic. The cost is a write per project on every drop,
which is nothing at a few dozen projects and would need revisiting at a few
hundred. The list query now depends on the column, so **the migration must reach
a database before code that reads it does**: applying it to the live database is
a prerequisite of the next deploy, not a follow-up.
