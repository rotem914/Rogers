# Code review, 2026-09-16

Pass: `Go code review`, the whole repository at commit `c384ffd`, clean tree.
Reviewer: Fable at high effort, one agent, no fan-out.
Areas covered, all of them read in full: the Worker (`src/api/*`, `wrangler.json`),
the schema (`migrations/*`), the shared types, the web platform and libraries
(`src/web/platform/*`, `src/web/lib/*`), the three pages, every component, the
styles, the PWA files (`public/*`, `index.html`), and the build config.
Baseline: `npm run check` green, exit 0. `npm run lint` red, exit 1 (T8).
Every finding below is pre-existing; nothing was fixed in this pass.

Counts: 1 blocking, 3 important, 7 nits.

Verdict, Rotem, 2026-09-16: fix all. Every block below is fixed in the same day's change; see the History row.

## Blocking

```
T1 · The composer throws typed text away when the note could not be created
Where:   src/web/components/Composer.tsx:194-213 (close), :177-191 (reset), :240 (session expiry)
Problem: Until the create request succeeds there is no saver. A click anywhere outside the
         composer, Escape, Enter in the title, or an expiring login then runs reset() and the
         typed text is gone, with no park and no way back. When the create is still in flight
         and fails, close() awaits the rejected promise unhandled and the composer silently
         stays open instead; that is the accident that keeps the text, not a design.
Fix:     In close(), when saverRef is null and the draft is not empty, keep the composer
         open and show "Could not save" rather than resetting. Park the draft (title, body,
         images, under the composer's own id) on session expiry and before any reset that
         still holds text. Wrap the await of creatingRef in try/catch.
Verify:  Take the Worker down or set DevTools to offline. Type in the composer, click the
         page: the text is still there and the status reads Could not save. Go online, type
         one key: the note appears in the list after Close.
Status:  [x] done, 2026-09-16; verified in the browser, see the History row
```

## Important

```
T2 · A save on blur or on the way back fails for a long note
Where:   src/web/lib/autosave.ts:127; src/web/pages/Note.tsx:171, :331, :341
Problem: Every flush sends with keepalive, and the fetch spec caps a keepalive body at 64 KB.
         A note past that size fails every blur save and every back-arrow save with
         "Could not save". The text is parked in session storage and saved only if the same
         note is opened again in the same tab; closing the tab first loses the edit.
Fix:     keepalive only on the pagehide flush (a separate flag from "final"), or only when the
         body is under 60 KB; every other flush sends a normal request.
Verify:  Paste 70 KB of text into a note, click outside the field: status reads Saved and the
         network tab shows a 200 PATCH. Press back, reopen: the text is there.
Status:  [x] done, 2026-09-16; verified in the browser, see the History row
```

```
T3 · Closing or reloading the tab while a save is in flight loses what was typed during it
Where:   src/web/lib/autosave.ts:67-83 (flush), :106 (send); src/web/pages/Note.tsx:227
Problem: flush() returns without sending when a save is already out, so on pagehide the
         keystrokes typed during that save are neither sent with keepalive nor parked, and
         the in-flight request itself has no keepalive either. A reload or tab close within
         600 ms of typing can drop both patches.
Fix:     On pagehide park the pending patch first, then flush; parking covers reload and
         navigation, keepalive covers the close. When a flush arrives during an in-flight
         save, mark the follow-up send as final so it goes out with keepalive.
Verify:  Type, and within half a second press reload: the text is back after the reload.
         Type, wait for Saving, type more, reload: the second burst is back too.
Status:  [x] done, 2026-09-16; verified in the browser, see the History row
```

```
T4 · Leaving a note or closing the composer during an upload drops or misplaces the picture
Where:   src/web/pages/Note.tsx:118-131, :170-184; src/web/components/Composer.tsx:160-175, :194-213
Problem: goBack and close wait for the text save but not for uploads. On the note page the
         key arrives after the saver is disposed and the picture is never attached: uploaded
         to R2, in no note. In the composer it lands in a fresh empty draft and creates a
         second, picture-only note.
Fix:     Track uploads in a ref and await them in goBack and close before flushing; or refuse
         to leave while uploading > 0, with the Uploading indicator saying why.
Verify:  Throttle the network, drop a large picture, press back at once, reopen: the picture
         is in the note. Same in the composer, then Close: one note in the list, not two.
Status:  [x] done, 2026-09-16; verified in the browser, see the History row
```

## Nits

```
T5 · Ctrl+Z with the composer open also undoes a tab action
Where:   src/web/components/Composer.tsx:223-230; src/web/pages/Project.tsx:326-342
Problem: Both listen on document. When focus sits on a composer button (pin, image) rather
         than a field, the page's tab undo runs as well, so one keystroke reverts two things.
Fix:     The composer's handler calls stopPropagation, or the page skips while the composer
         is open.
Verify:  Add a tab, open the composer, type, click the pin, Ctrl+Z: only the text reverts.
Status:  [x] done, 2026-09-16; verified in the browser, see the History row
```

```
T6 · A dragged order sticks to a section after the drop
Where:   src/web/pages/Project.tsx:498-504, :548; the same shape in Home.tsx:86 and TabStrip.tsx:112
Problem: order is never cleared after a successful drop, so a later list with the same ids
         (pin a row, then unpin it) is shown in the stale dragged order instead of the
         Worker's, where the unpinned row belongs at the top.
Fix:     showOrder([]) after onChanged() in drop(), the same as the failure path.
Verify:  Drag two rows, pin a third, unpin it: it sits at the top, where the Worker puts it.
Status:  [x] done, 2026-09-16; verified in the browser, see the History row
```

```
T7 · The remembered lists grow without bound and are rewritten whole on every fetch
Where:   src/web/lib/useApi.ts:55-62
Problem: Every path ever visited stays in local storage forever, archived projects included,
         and each store serialises the whole map. At the 5 MB quota the write fails silently
         and remembering stops for good.
Fix:     Cap the map (drop the oldest paths past a limit) and drop paths that answered 404.
Verify:  Visit many projects; the stored blob stays under the cap.
Status:  [x] done, 2026-09-16; verified in the browser, see the History row
```

```
T8 · Lint is red, and nothing gates it
Where:   src/web/lib/useApi.ts:138 (react-hooks/set-state-in-effect, the one error);
         warnings at Composer.tsx:237, Note.tsx:236, worker-configuration.d.ts:10450, :10467
Problem: npm run lint exits 1. npm run check does not include lint, so the red never shows.
Fix:     Decide whether lint is a gate. If yes, add it to check and settle the one error: the
         hook is correct as written, so an inline disable with the reason is the honest fix.
Verify:  npm run lint exits 0.
Status:  [x] done, 2026-09-16; verified: lint exits 0 and the lines read back
```

```
T9 · A note in an archived project stays reachable by its address
Where:   src/api/notes.ts:282-291, :293-389, :391-414
Problem: The single-note routes never check that the project is live, so a note can be
         opened and edited by address after its project was archived, while the project
         routes describe such notes as unreachable.
Fix:     Either accept it and correct the comment in projects.ts:247, or join projects in
         ONE_SQL and answer 404 when the project is archived.
Verify:  Archive a project, open /n/<id> of one of its notes: 404 or the note, per the choice.
Status:  [x] done, 2026-09-16; verified in the browser, see the History row
```

```
T10 · The missing-thumbnails check lists the whole bucket on every app open
Where:   src/api/images.ts:70-84; src/web/App.tsx:28-31
Problem: Three seconds after every open the Worker walks every object in R2 to answer,
         and it keeps doing so after every picture has its copy. Cost grows with the bucket.
Fix:     Remember an empty answer in local storage for a day, or cache the list in the Worker.
Verify:  Open the app twice; the second open sends no /api/thumbs/missing.
Status:  [x] done, 2026-09-16; verified in the browser, see the History row
```

```
T11 · Docs and comments drifted from the code
Where:   project-os/Map.md (Saving row: pin, archive and the mark PATCH a note from
         NoteRow.tsx; tree note "src/web still holds the template's own page"; "once plan
         step 1.1 lands"); src/web/index.css:67 ("loaded from Google Fonts in index.html");
         migrations/0006_tab_position.sql:1 ("fourth migration"); src/api/projects.ts:6
         ("arrives at plan step 3.5", which landed); src/api/notes.ts:269-270 (a re-export
         for step 3.4 that nothing imports)
Problem: Each says something the code no longer does.
Fix:     One docs pass over the seven lines.
Verify:  Read them back.
Status:  [x] done, 2026-09-16; verified: lint exits 0 and the lines read back
```

## Reach

T1 to T4 sit on the save path, which is one class (`autosave.ts`) behind two
screens, the note page and the composer: Shared, both consumers named above.
T5 and T6 are Local to the files named. T7 reaches every list on every screen:
Shared. T8 to T11 change no behaviour.

## Not raised, on purpose

The six hex swatches in `ProjectTile.tsx` are stored values, not styling
tokens, so the Map's "a raw hex anywhere else is a bug" does not apply to them.
Title, body and name carry no length ceiling; D1 refuses a row past 2 MB with a
500, the client shows Could not save and parks the text, so nothing is lost.
