# Rogers — Bug Atlas

The map of this project's recurring bug classes.

`project-os/History.md` records that a bug was fixed. This file records the
PATTERN, so the next session recognizes it in minutes instead of rediscovering
it in hours. Read the matching row before writing a fix.

## When a bug earns a row

Add or update a row when:

- the same bug pattern appears a second time,
- a fix took several attempts because the real root cause was hidden,
- a library or API behaves in a known dangerous way,
- a future session is likely to reach for the same WRONG fix again.

A one-off typo earns nothing. The atlas is for classes, not incidents.

## How to use it

1. Name the symptom you see.
2. Search this table for a matching row.
3. If a row matches, follow its fix and checklist before debugging anew.
4. If nothing matches, debug normally.
5. If the issue turns out to be a pattern, add the row in the same task.

## Rotation

`project-os/rotate-docs.ps1` keeps the newest 30 Atlas rows live and moves
older ones verbatim into `BugAtlas-archive.md` at `Go commit`. Rows are
relocated, never edited, renumbered or deleted, so an archived row still
answers a search.

## Atlas

| # | Symptom | Root cause | The fix that holds | Times bitten | Where recorded |
|---|---|---|---|---|---|
| 1 | The app bounces to the Cloudflare Access login for no reason, and whatever was on screen is gone | An `/api` route answered with something that is not JSON. The client treats a non-JSON answer under `/api` as proof that Access served its login page, so a plain-text crash or a framework default page is read as an expired session and triggers a reload | Every answer under `/api` is JSON, successes included. `app.onError` and `app.notFound` in `src/api/index.ts` guarantee it even for an unpredicted crash. Two traps to avoid: never let a route fall through to a framework default, and never answer 204 No Content, because an empty body carries no content type and reads exactly like the login page | 1x | History 2026-09-04, plan step 3.1 |
| 2 | The whole screen goes blank and the console says `Invalid hook call` and `more than one copy of React` | The dev server has been running since before a dependency was installed. Vite re-optimizes on install and stamps a new hash, but the long-running process keeps serving modules from several different optimization runs at once, so React and React DOM come from different copies. Nothing is wrong with the code, and the build passes, which is what makes it so misleading | Compare the `?v=` hashes the server serves for `react.js`, `react-dom_client.js` and `react-router.js` against `browserHash` in `node_modules/.vite/deps/_metadata.json`. If they disagree, the server is stale: Rotem restarts it, and it comes back. A hard reload does not fix it, and neither does a new tab | 1x | History 2026-09-04, plan step 4.1 |
| 3 | A Tailwind class is on the element, the rule exists in the stylesheet, and nothing happens | Two utilities that set the same property, and the one you did not mean wins on source order rather than on the order you wrote them in the className. `block` with `line-clamp-3` is the case that bit: line-clamp needs `display:-webkit-box`, Tailwind emits `.block` after `.line-clamp-3`, so the clamp is silently dead | Never pair a display utility with `line-clamp-*`. More generally, when a class looks ignored, read the computed style and compare the two rules' positions in `document.styleSheets` rather than adding more classes | 1x | History 2026-09-04, plan step 4.3 |
| 4 | A Tailwind class added to a component does nothing in dev, but works in the production build | The dev server regenerates the stylesheet when the CSS entry changes, not when a component adds a new utility. So a class used for the first time in a `.tsx` file has no rule until something touches `src/web/index.css` | Compare the dev stylesheet with the built one: `curl localhost:5173/src/web/index.css` against `dist/client/assets/*.css`. If the class is only in the built one, touch `src/web/index.css` and it regenerates. Do not go looking for a bug in the component | 1x | History 2026-09-04, plan step 4.3 |
| 5 | Typing in an editor saves nothing, no request, no status, no error, while the build is green | An object with a one-way `dispose()` was created during render and disposed in a mount effect's cleanup. React's development mode runs mount, cleanup, mount, so the object was dead before the first keystroke and every call into it returned early | Anything an effect cleanup disposes is created inside that same effect, so the second mount gets a fresh one. And `dispose()` parks unsaved text rather than dropping it, so even a wrong lifetime cannot lose a keystroke | 1x | History 2026-09-04, plan step 4.6 |
