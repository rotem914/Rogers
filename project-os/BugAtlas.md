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
