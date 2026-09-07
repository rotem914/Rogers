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
