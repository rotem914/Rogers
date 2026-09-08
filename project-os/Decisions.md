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
- 2026-09-04 · A dragged note order is per section, and an undragged note sorts first
- 2026-09-05 · Rogers lives on rogers.rotem-e.com, not on workers.dev
- 2026-09-05 · Undo is the note's own stack, with pictures in it, not the browser's
- 2026-09-06 · Main is not a row, and a removed tab's notes fall back to Main
- 2026-09-06 · Main's name lives on the project, and tab undo replays actions
- 2026-09-07 · Lists are remembered across screens, the note editor never is
- 2026-09-07 · The remembered lists live in local storage, by the owner's call
- 2026-09-08 · Coming back to a project restores its place, from a page-lifetime map

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

---

## 2026-09-04 - A dragged note order is per section, and an undragged note sorts first

### Context

Rotem asked for the same drag reordering inside a project that Home had just
got. A project list is not a grid of tiles: it is split into PINNED and the
rest, the order inside each is different, and the composer sits above it so new
notes arrive at the top. Two behaviours already existed and could not change: a
new note appears first, and pinning a note puts it at the top of Pinned.

### Options

1. One order across the whole page, so a row dragged from one section into the
   other is pinned or unpinned by the drop.
2. One order per section, with a drag that crosses the line simply refused.
3. No manual order in the pinned section at all.

### Decision

Option 2, taken by the assistant. Each section sends only its own ids to
`PUT /api/projects/:projectId/notes/order`, and the two sections keep separate
drag state on the page, which is what makes a cross-section drop impossible
rather than merely discouraged: the section being dragged into never learns a
drag is running, so it never becomes a drop target.

Two supporting choices came with it. A note with no position sorts FIRST inside
its section, the opposite of the projects grid, so a new note keeps arriving at
the top under the composer even after the rows below have been arranged.
And pinning or unpinning clears the note's position, so pinning still puts a
note at the top of Pinned instead of dropping it wherever its old number
happened to land among the pinned rows.

### Consequences

Changing a note's section stays the pin button's job, which is one obvious
control rather than two ways to do the same thing. The cost is the one behaviour
that does shift: a note that is unpinned comes back at the TOP of the list
rather than in its creation slot, because clearing its position is what puts it
back among the undragged. Revisit if Rotem wants a drop across the line to pin,
which would mean the drag has to write the pinned state as well as the order.

## 2026-09-05 - Rogers lives on rogers.rotem-e.com, not on workers.dev

### Context

Rotem's iPhone on 4G could not open rogers.rotem914.workers.dev: a white page
and a progress bar frozen near the start, in Chrome, in Incognito, and in
Safari. Cloudflare's own login host loaded fine on the same phone, and so did
everything else, but Cloudflare's demo page on workers.dev hung the same way.
Some mobile carriers drop the whole workers.dev domain family because of the
abuse it hosts; nothing in Rogers can change what a carrier drops.

### Options

1. A domain of Rotem's own in front of the Worker, with the login extended to it.
2. Keep workers.dev and accept that the phone only works on other networks.
3. A different temporary domain family, such as pages.dev, by moving the hosting.

### Decision

Option 1, chosen by Rotem: the Worker gets `rogers.rotem-e.com` as a custom
domain under his existing rotem-e.com zone, and the Access application covers
the new hostname first, so the new address is never public for a moment.

### Consequences

The phone can reach Rogers on any network, and the address is his, not
Cloudflare's. Wrangler disables the workers.dev address the moment a route is
declared, so the old bookmark goes dark unless `workers_dev: true` is added
back; that is an open verdict, not a decision. Every future deploy carries the
custom domain, and the Access application must keep the hostname or the notes
become public. Revisit only if the domain itself moves.

---
## 2026-09-05 - Undo is the note's own stack, with pictures in it, not the browser's

### Context

Rotem asked for undo and redo covering text and pictures. A textarea already
undoes its own typing, but that stack is per field, knows nothing about a
removed picture, and vanishes the moment React sets the field's value from
outside, which is what restoring a picture or a parked draft does.

### Options

1. Leave text to the browser and add a separate undo for pictures only.
2. One stack per open editor, owned by the app: title, body and pictures as
   one history, Ctrl+Z taken over from the browser.
3. A full document model with selection tracking, as an editor library would.

### Decision

Option 2. `src/web/lib/undo.ts` keeps snapshots of title, body and images; a
run of typing in one field within a second folds into one step, a picture is
always its own step. Undo and redo go through the same `change()` as typing,
so they queue a save like any edit. The shortcut keys on `event.code`, so a
Hebrew layout works, with the key name as fallback. Parking and the composer's
reset start the stack over, since neither is an edit the person made.

### Consequences

One Ctrl+Z means the same thing everywhere in a note, pictures included, and
an undone edit can never be lost because it is saved like typing. The cost is
that the browser's own undo is gone in these fields, and the caret lands at
the end of a field after an undo rather than where the change was; option 3
is what fixes that, and it was not worth its weight for a notes app. There is
no on-screen control yet, so on the phone the feature does not exist until
buttons are added.

---
## 2026-09-06 - Main is not a row, and a removed tab's notes fall back to Main

### Context

Rotem asked for tabs on the project page, each with its own list of notes:
nothing until a plus is clicked, then the existing list becomes "Main" and
"New tab" appears beside it, with a way to remove a tab. Two questions had to
be answered: what Main is in the database, and where a removed tab's notes go,
under the invariant that a notes app never loses a note.

### Options

1. Main is a real tab row, created with every project and backfilled for the
   existing ones, and every note gets a tab id.
2. Main is the absence of a tab: a null tab id, no row, and a project with no
   tab rows shows no strip at all.
3. On remove, move the tab's notes to Main by writing their tab id to null.
4. On remove, archive the tab and leave its notes pointing at it; the list
   query treats a note in no live tab as Main.
5. On remove, archive the notes with the tab, the way archiving a project
   hides its notes.

### Decision

Options 2 and 4, taken by the assistant. Main is null, so the migration
touches no row and a project with no tabs reads exactly as it did before.
Removing a tab writes one timestamp to the tab row; Main's query is "every
note in no live tab", so the notes reappear there at once, and clearing the
tab's archived_at brings the tab back with every note still in it.

### Consequences

A note is never hidden by removing a tab, and a mis-click costs one row write
that is fully reversible. Main cannot be removed or renamed, because it is not
a thing in the database. The cost is a subquery in Main's list and one extra
round trip on the project page, since the notes wait for the tabs so a tab's
address never flashes Main's list first. Option 5 was rejected because a tab
is a grouping, not content, and archiving content behind a grouping's remove
button is how a notes app eats notes. Revisit if tabs get their own restore
screen, or if moving notes between tabs arrives, which would make option 3 a
real choice.

---
## 2026-09-06 - Main's name lives on the project, and tab undo replays actions

### Context

Two questions came out of the same sitting. Rotem asked to rename the first
tab, which the entry above had deliberately left without a row of its own. He
also asked for undo and redo over adding, removing and renaming a tab, in a
project whose only undo so far was the note editor's stack of snapshots.

### Options

For the name:

1. Give Main a real tab row, created when the first tab is added, and write
   that id onto every note that had none.
2. Keep Main as the absence of a tab and store its name on the project, in one
   nullable column, null reading as "Main".

For the undo:

3. Reuse the note's `UndoStack` by snapshotting the whole tab list and
   replacing it on undo.
4. Keep the actions themselves, and undo one by asking the Worker to do its
   opposite.

### Decision

Options 2 and 4, taken by the assistant.

`migrations/0005_main_tab_name.sql` adds `main_tab_name` to projects: additive,
nullable, no row rewritten, and Main stays exactly what it was, the notes in no
live tab. Option 1 was rejected because it would rewrite every existing note
row to say what is already true, which is the one thing migrations here may not
do.

`TabHistory` in `src/web/lib/undo.ts` keeps a list of `add`, `remove` and
`rename` actions. Undoing an add archives the tab, undoing a remove restores it,
and undoing a rename sends the old name. Restoring needed a way back that did
not exist, so the tab route learned `archived: false`; because removing never
touched a note, clearing that one timestamp brings the tab back with every note
still in it. A step leaves the history only once the Worker agreed, so a failed
undo can simply be pressed again.

### Consequences

Renaming Main is a project edit, not a tab edit, so anything that later lists
tabs must remember that the first one is not among them. A snapshot undo
(option 3) would have had to invent ids to recreate removed tabs, and could not
have restored their notes at all; replaying actions costs one request per step
instead.

Two limits are worth knowing. Ctrl+Z on the project page steps through tabs
whenever the keystroke is not inside a field, so with the composer open and
focus off its fields, both stacks hear the same press. And the history lives in
the page, so leaving the project and coming back starts it empty, while the
changes themselves are already saved.

## 2026-09-07 - Lists are remembered across screens, the note editor never is

### Context

Rotem saw the project page assemble itself in steps on the way back from a
note: "Take a note" first, the rows a beat later. Two causes. Every screen is
unmounted on navigation and starts from nothing, so a list it showed a second
ago costs a full round trip again. And the notes waited for the tabs answer
before they were even asked for, so Main's list was always two round trips out.

### Options

1. A query library with a cache, which PLAN.md had already rejected for size.
2. Keep the last answer per address in the read hook, show it at once, and
   fetch the fresh copy behind it, for every read including the note.
3. The same, but opt-in per read, with the note page left out.
4. Prefetch a project's lists while the tile is hovered.

### Decision

Option 3, taken by the assistant. `useApi` grew a `remember` flag; the three
list reads opt in, the single-note read does not.

The note is left out on purpose. The editor seeds itself from the first answer
it gets and never from a later one, which is how a save response can never
overwrite newer text. A remembered note would be seeded from a stale copy, the
fresh copy would be ignored, and the next keystroke would save the stale text
over the newer one: the exact loss invariant one forbids. So the editor keeps
paying its round trip.

The waterfall fix rides along: when the address names no tab, the list is Main
whatever the tabs say, so it is fetched beside them instead of after them.

### Consequences

A list can show a preview or a note count that is up to one round trip old,
roughly a tenth of a second in the dev app, before the fresh answer replaces
it. That is the price of the instant paint, and it is a preview, never the
text being edited. Anything that later reads what it edits must not opt in.
Option 4 would make a first visit instant too and is still open.

## 2026-09-07 - The remembered lists live in local storage, by the owner's call

### Context

The remembered lists first went into session storage, which dies with the tab.
Rotem asked for everything that saves a load, and a new tab or a restarted
browser still paid one round trip.

### Options

1. Session storage: a reload paints at once, a new tab does not, and nothing
   about a private note outlives the window it was read in.
2. Local storage: every tab and every restart paint at once, and the note
   titles and previews stay on the machine until Rogers overwrites them,
   logged out or not.

### Decision

Option 2, Rotem's, on 2026-09-07, after the cost was laid out in plain words.
Rogers is his own machine's app; the speed is worth more than the exposure of
previews to someone at his unlocked computer.

### Consequences

The full note is still never stored, so the editor always starts from the
server. If Rogers is ever used on a shared machine, this is the entry to
revisit: one word in `useApi.ts` moves it back. Logging out does not clear
the copy; a "clear on logout" would need a logout the app does not have.

## 2026-09-08 - Coming back to a project restores its place, from a page-lifetime map

### Context

Opening a note and pressing back is a fresh arrival at the project's address,
not a step back through history, so the list started at the top again. The note
page rejects history-based back on purpose: a note opened from a link has no
history to step through.

### Options

1. Step back through history when there is history, and navigate to the address
   otherwise.
2. Remember the offset per address, for every arrival at that address.
3. Remember it only for the trip to a note, and forget it the moment the page
   is left for Home.
4. Any of the above, persisted in storage, so a reload lands where it was too.

### Decision

Option 3, Rotem's, on 2026-09-08, after option 2 put him mid-list when he
opened a project from Home.

The page cannot be told where a visit came from, so it is told where each visit
GOES instead: the address bar has already moved by the time the page is taken
down, so leaving for a note keeps the offset and leaving for anything else
drops it.

### Consequences

Every way back from a note lands in place, the arrow, Escape and the browser's
own back button, because what is remembered hangs off the address rather than
off the way the address was reached. Opening a project from Home always starts
at the top. A reload starts at the top too, which option 4 would change in two
lines. Nothing is written to storage, so no note text leaves memory. The one
thing a future change must not break: the departure is judged by the address
bar, so a new screen between the list and a note would have to be named there.
