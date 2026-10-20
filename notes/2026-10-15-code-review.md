# Code review, 2026-10-15

Pass: `Go code review`, the whole repository at commit `3117098`, clean tree.
Reviewer: Fable at high effort, one agent, no fan-out, one file at a time.
Areas covered, all of them read in full: the Worker (`src/api/*`, `wrangler.json`),
the schema (`migrations/*`), the shared types, the web platform and libraries
(`src/web/platform/*`, `src/web/lib/*`), the three pages, every component, the
styles, the PWA files (`public/*`, `index.html`), and the build and lint config.
Baseline: `npm run check` green, exit 0, with one lint warning (T8).
Nothing was reproduced in a running app: `http://localhost:5173` answered nothing
(curl exit 000) and the server is Rotem's to start, so every finding below is read
from the code, cited by line, and its Verify line is the check that shows it live.
Every finding is pre-existing; nothing was fixed in this pass.

Counts: 2 blocking, 3 important, 3 nits.

## Blocking

```
T1 · The composer has no way out on a reload, a closed tab, or the browser's back
Where:   src/web/components/Composer.tsx:285-298 (the only leave handler it has);
         compare src/web/pages/Note.tsx:239-250, which has both handlers
Problem: The note page parks and sends keepalive on pagehide, and parks again when the
         editor unmounts. The composer does neither. A reload, a closed tab, a closed PWA
         window, or the browser's back button while typing leaves the last settle window
         (up to 600 ms of typing) neither sent keepalive nor parked, and a patch still in
         flight may be cut off with it. The back button leaves the pending save to a timer
         on an unmounted editor; if that save fails, nothing parks it. The file's own header
         promises "closing the tab mid-sentence loses nothing"; the code delivers that only
         once the timer has fired. Invariant one.
Fix:     Give the composer the note page's two handlers. On pagehide: park {...sent,
         ...pending} together with the draft's id under the composer key, then flush(true).
         On unmount: dispose the saver so it parks. On mount, a composer-key draft that
         carries an id reuses it, so the retried create and the queued patch land on the
         same note instead of a second one.
Verify:  QA 10j item 3, run on the composer: type, dispatch pagehide within 600 ms, read
         sessionStorage rogers.draft.composer:<project>:<tab>; reload: the composer reopens
         with the text, and the list shows one note carrying all of it.
Status:  [ ] open
```

```
T2 · Close with a failed save closes anyway and parks the text where nobody looks
Where:   src/web/components/Composer.tsx:242-253 (close ignores what flush returns);
         the same shape at :287-292 (login expiry once the note exists) and in
         src/web/pages/Note.tsx:178-193 (goBack)
Problem: When the note exists on the server but the PATCH fails, close() resets the
         composer and refetches: the list shows the note with only the text that reached
         the server, and the rest sits in sessionStorage under note:<id>, which only the
         note page reads, and only in this tab. Decision 2026-09-16 called exactly this
         "a note lost more slowly" and fixed it for the create failure alone. A login that
         expires after the create does the same: the park goes under the note's key, and
         the composer that comes back after the reload never looks there. The note page's
         back arrow has the same shape, one step less hidden: the row just left is the one
         holding the park.
Fix:     In close(), when flush() returns false, stay open and red exactly as the create
         failure does: setStatus("error") and return. On expiry with a saver, also park the
         draft with its id under the composer key, so the reload reopens the composer on it.
         For the note page, one decision: refuse to leave on a failed flush, or keep the
         park and say so in the status line.
Verify:  QA 10j item 1, extended: let the create through, make the PATCH fail by wrapping
         window.fetch, type, click the page: the composer stays open, red, text intact; let
         requests through, click again: one note in the list with the whole text.
Status:  [ ] open
```

## Important

```
T3 · A refetch from a closing composer paints the old tab's notes under the new tab's name
Where:   src/web/lib/useApi.ts:127-160 (load closes over path, and refetch is that closure);
         src/web/pages/Project.tsx:445 (onClosed={notes.refetch});
         src/web/components/Composer.tsx:230-254
Problem: Clicking a tab chip fires pointerdown first, which starts close(); the click then
         switches the tab. close() waits for the save, then calls the onClosed it captured,
         which is the previous path's load. That load takes the newest run number, so its
         answer, the old tab's list, is written into state and shown under the new tab's
         name, and the new tab's own answer is dropped as stale. Every onChanged that lands
         after a switch (pin, archive, a drop) has the same race. QA 10d item 5 forbids
         exactly this, and nothing refreshes it until the next switch.
Fix:     In useApi, keep the current path in a ref and have load read it: an answer whose
         path is no longer current is stored for the remembered copy and never set into
         state. refetch then always loads the path on screen.
Verify:  Type in the composer and click another tab within half a second: the new tab's
         rows are its own. Then QA 10d item 5 and 10e item 3 as written.
Status:  [ ] open
```

```
T4 · An error page from the edge reloads the app in a loop instead of showing a toast
Where:   src/web/platform/api-client.ts:36-44, :71-76
Problem: isSessionExpired reads any non-JSON body as the login page, whatever the status.
         A Cloudflare error page (1101 or 1102 for a Worker that was killed, a 52x during
         an incident) is text/html with a 5xx status, so the client parks and reloads; the
         reload fetches again, gets the same page, and reloads again, for as long as the
         incident lasts. The remembered lists cannot even be read, because the reload fires
         before any toast would. Text is parked and restored on every lap, so nothing is
         lost; the app is simply unusable while it happens, with no message.
Fix:     Check the status first: a 5xx is never Access, so it becomes an ApiError carrying
         the status line. Only a redirect, an opaque redirect, 401, 403, or a 2xx without
         JSON means the session is gone.
Verify:  Wrap window.fetch to answer 503 text/html for /api/projects: the toast reads
         "Could not load your projects", the page stays, no reload.
Status:  [ ] open
```

```
T5 · A note or a project archived by a mis-click has no way back in the product
Where:   src/api/notes.ts:302-398 (no archived field on the note PATCH);
         src/api/projects.ts:143-222 (none on the project PATCH);
         src/web/components/NoteRow.tsx:234-244, src/web/components/ProjectTile.tsx:343,
         src/web/pages/Note.tsx:150-158 (the three Archive items)
Problem: Invariant three exists because "a mis-click must be recoverable". Archive sits
         on a right-click menu with no confirmation and no undo, and neither PATCH route
         accepts archived: false, so the only way back is a hand-written UPDATE on the live
         database. Tabs got undo on 2026-09-06; notes and projects never did. The rows are
         kept, so the invariant's letter holds; its reason does not.
Fix:     Accept archived: false on both PATCH routes the way the tab route does: clear
         archived_at, and for a project nothing more, since its notes were left alone. In
         the app, an "Archived · Undo" toast after a row or tile archive, and Ctrl+Z on
         the project page for a row, beside the tab undo that is already there.
Verify:  Archive a throwaway note, click Undo: it is back in its place; reload: still
         there. The same for a throwaway project.
Status:  [ ] open
```

## Nits

```
T6 · A project can be created twice from one name
Where:   src/web/pages/Home.tsx:185-212 (create), :222-233 (the outside click)
Problem: create() makes a new id on every call and never checks saving, and the
         pointerdown listener stays live while a create is out. Enter followed by a click
         outside before the answer sends two creates with two ids: two projects, one name.
         A retry after a lost answer makes a second project too, which is what the comment
         at :195 says the id prevents.
Fix:     Make the id once per naming session, in a ref set when naming opens, and return
         from create() while saving is true.
Verify:  Throttle the network, type a name, press Enter, click the page: one project.
Status:  [ ] open
```

```
T7 · A picture's remove button cannot be reached from the keyboard
Where:   src/web/components/ImageStrip.tsx:72-79
Problem: The button is `hidden` (display: none) until its thumbnail is hovered. A
         display-none element is skipped by Tab, so `focus-visible:flex` can never apply.
         QA section 6 asks for every control to be reachable without a pointer; the
         composer and the note page both show this strip.
Fix:     Hide it with opacity-0 and reveal with group-hover/thumb:opacity-100 and
         focus-visible:opacity-100, so it stays in the tab order.
Verify:  Tab through an open note with a picture: the remove button takes focus and shows.
Status:  [ ] open
```

```
T8 · npm run check prints a warning from a kit file on every run
Where:   eslint.config.js:10; the warning is at project-os/guards/Check-on-stop.mjs:160
Problem: eslint . reaches into project-os, which is the kit's code, not the app's, and
         reports an unused disable directive there. The check stays green, but a run that
         always prints one warning teaches the eye to skip warnings.
Fix:     Add "project-os" to the ignores in eslint.config.js; the kit lints its own files.
Verify:  npm run lint prints no problems.
Status:  [ ] open
```

## Reach

T1 and T2 sit on the composer and the saver: Local to `Composer.tsx` plus a park
helper in `autosave.ts`; the note page shares the saver but keeps its own handlers.
T3 is `useApi`, which sits behind every screen and the tile prefetch: Shared
(Home, Project, Note, ProjectTile). T4 is the API client, behind every request:
Shared, every screen. T5 is the Worker's two PATCH routes plus three screens:
Shared. T6, T7 and T8 are Local to the files named.

## Not raised, on purpose

- Last write wins between two open tabs on the same note: `PLAN.md` section 5
  states it, and there is one user.
- The project and tab rename fields save twice on Enter, because the blur that
  follows saves the same name again: idempotent, no visible effect.
- The saver's `leaveAfter` flag can stay set after a pagehide flush whose save
  succeeded with nothing pending, so the next ordinary save goes keepalive
  under the cap: harmless, keepalive on a plain request is allowed.
- The `notes_by_project` index comment in `0001_init.sql` describes the
  original order; the query has moved on and the index still serves its
  equality columns. A migration is never edited.
- The six swatches in `ProjectTile.tsx` are stored values, as the previous
  review noted.
