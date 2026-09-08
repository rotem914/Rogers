# History.md - Scan-log Archive

NOT read by default - consult only when digging into old changes.
Moved here verbatim by project-os/rotate-history.ps1. Movement only: rows are never rewritten, compressed, or deleted.

| Date | Area | What changed |
|---|---|---|
| 2026-09-04 | plan | **The build plan exists.** `PLAN.md` at the root holds the architecture, data model, API, UI, 46 approval-gated steps, and the log of three external reviews. |
| 2026-09-04 | process | **ProjectOS installed.** `CLAUDE.md` and `project-os/` now govern every task and reply; hooks repeat the rules on every message from the next session on. |
| 2026-09-04 | process | **Clash verdicts applied and a model rule added.** Mockups stay, memory is a pointer, Rotem starts the dev server, `PLAN.md` stays at the root; every task now names its model and effort at pickup (rule 23), and the hooks say so on every message. |
| 2026-09-04 | repo | **The repo is on GitHub.** origin is github.com/rotem914/Rogers, created by Rotem; main pushed with the plan commit. Plan step 0.4 done. |
| 2026-09-04 | process | **Pushing is Rotem's alone.** The commit flow now stops after the commit; every "push" in PLAN.md names him; the hooks say so on every message. |
| 2026-09-04 | cloud | **Wrangler is logged in to Rotem's Cloudflare account.** Plan step 0.2 done; phase 0 complete. |
| 2026-09-04 | scaffold | **The app skeleton exists.** React, Vite, Hono and the Cloudflare Workers plugin, one `npm run dev`, one Worker serving both the API and the built SPA. Still the template's own page; Rogers screens arrive at 1.3 and 4.x. |
| 2026-09-04 | scaffold | **The code is split the way Rogers will keep it.** `src/api` is the Worker, `src/web` the app, `src/shared` the types both use. `/api/health` answers JSON, `/api/*` always reaches the Worker, and every other address returns the app shell so deep links work. |
| 2026-09-04 | docs | **The map matches the code again.** `project-os/Map.md` carries the real tree and says which area owns the Worker, the app and the shared types. |
| 2026-09-04 | build | **The check command actually checks now.** Its typecheck stage was compiling nothing, so a type error could pass unnoticed; it now runs the real project build and was proven by catching a deliberate error. |
| 2026-09-04 | design | **Rogers looks like Rogers.** Dark ground, one warm yellow accent, a thin top bar, and a palette every colour comes from. The tab says Rogers, the page paints dark on the first frame, and the template page is gone. |
| 2026-09-04 | app | **Rogers has its three screens and can survive being logged out.** Home, a project and a note are real addresses, so a note can be opened directly, reloaded or kept in a tab. When the login expires, unsaved text is rescued before the page returns to the login instead of the app appearing to break. |
| 2026-09-04 | repo | **Phase 1 is committed.** Everything from the scaffold through the routes and the API client is in one commit, `b4d67e1`, waiting for Rotem to push. |
| 2026-09-04 | data | **Rogers has a database.** `rogers-db` exists on Cloudflare and the Worker is wired to it, so notes have somewhere to live. It is still empty; the tables arrive at plan step 2.2. |
| 2026-09-04 | data | **The tables exist.** Projects and notes, with pinning, archiving and image links built in. A note is never deleted, only archived, so a mis-click can be undone. Applied to the local copy; the live one is next. |
| 2026-09-04 | data | **The live database has the same tables as the local one.** Both copies now hold projects and notes with identical columns, so what works locally will work once Rogers is deployed. |
| 2026-09-04 | app | **The Worker and the app now agree on what a project and a note look like.** One file describes every answer and every request, so the two halves cannot drift apart. Archived notes are impossible to send by accident. |
| 2026-09-04 | api | **Projects can be created and listed.** Each one reports how many live notes it holds, counted in the same query, and archived notes are never counted. Every failure now answers in the same shape, which stopped a server error from looking like being signed out. |
| 2026-09-04 | api | **A project can be renamed, recoloured and put away.** Putting one away hides it but keeps every word of it, and its notes stay whole underneath. Renaming no longer risks wiping the colour. |
| 2026-09-04 | process | **Work now runs step after step without stopping for approval.** Rotem lifted the per-step gate; the assistant stops only for a real problem, for something only he can do, or before anything that reaches the public. |
| 2026-09-04 | api | **Notes can be added to a project and listed back in Keep's order.** Pinned notes come first, then the newest, and a long note sends only its opening to the list. Hebrew and English together survive the round trip intact. |
| 2026-09-04 | api | **A note can be opened, saved, pinned and put away.** Saving one part of a note never disturbs the other parts, which is the promise that autosave depends on. Putting a note away keeps every word and every picture. |
| 2026-09-04 | api | **A lost connection can no longer turn a saved thing into an error.** Sending the same create twice now answers with what is already there instead of failing, and every bad request is answered clearly rather than crashing. |
| 2026-09-04 | tooling | **A blank screen turned out to be the dev server, not the code.** A server left running across dependency installs serves mismatched copies of React and blanks the page while the build stays green. Restarting it fixes it, and the symptom is now written down. |
| 2026-09-04 | app | **Home shows your projects and makes new ones.** Each tile carries its name and how many notes are in it. The plus tile turns into a name field where the new tile will appear, so making a project is one click and one line. |
| 2026-09-04 | app | **A project tile can be renamed, given a colour, or put away.** The menu appears on the tile itself, renaming happens in place, and putting a project away hides it without losing anything. |
| 2026-09-04 | app | **A project opens as a list of its notes, newest first.** Each note is a full-width row showing its title and the start of its text, and the project can be renamed from its own header. A pasted link no longer runs off the edge of a row. |
| 2026-09-04 | app | **Notes can be written, from the project page and on their own page, and nothing typed gets lost.** The composer opens on a click, saves from the first keystroke, and discards an empty draft. The note page saves as you type, on blur, on the way back, when the tab closes, and even when the login expires mid-sentence. |
| 2026-09-04 | app | **The project page reads like Keep now.** Pinned notes sit in their own section above the rest, a pin and a menu appear when a row is hovered, N starts a note, Escape leaves one, and loading shows the shape of what is coming instead of a word. |
